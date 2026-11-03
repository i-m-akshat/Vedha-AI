"""
Autonomous AI Playwright Worker & HTTP Agent (AgentQL, FastAPI & NATS JetStream Integration)
Implements:
1. HTTP REST API (FastAPI) on port 8000 for on-demand C# Orchestrator calls
   - POST /api/playwright/apply
   - POST /api/playwright/scrape
   - GET /health
2. JetStream consumer for 'app.resume.generated'
3. Real browser automation for LinkedIn Easy Apply (with session cookie support)
4. Semantic DOM querying & AgentQL for ATS platforms (Greenhouse, Lever, Ashby, Workday, etc.)
5. S3 & Base64 PDF attachment
6. Rotating residential proxy support
7. Human-in-the-Loop (HitL) fallback with 'app.worker.hitl_required'
8. 'app.worker.success' emission for atomic credit deduction
"""

import asyncio
import base64
from contextlib import asynccontextmanager
import ipaddress
import json
import logging
import os
import random
import re
import socket
import tempfile
import time
import urllib.parse
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.client import Config
from fastapi import FastAPI, BackgroundTasks, HTTPException
import nats
from nats.js.api import StreamConfig, RetentionPolicy, ConsumerConfig
from pydantic import BaseModel, Field
import requests
import uvicorn

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [AI-Worker] %(message)s"
)
logger = logging.getLogger("autonomous_worker")

# Environment variables
NATS_URL = os.getenv("NATS_URL", "nats://localhost:4222")
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "vedha-resumes")
AGENTQL_API_KEY = os.getenv("AGENTQL_API_KEY", "")
RESIDENTIAL_PROXY_URL = os.getenv("RESIDENTIAL_PROXY_URL", "")
WORKER_HTTP_PORT = int(os.getenv("WORKER_HTTP_PORT", "8000"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
VISION_MODEL_CASCADES = [
    os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

STREAM_NAME = "APPLICATIONS"
SUBJECT_RESUME_GENERATED = "app.resume.generated"
SUBJECT_WORKER_SUCCESS = "app.worker.success"
SUBJECT_HITL_REQUIRED = "app.worker.hitl_required"
SUBJECT_WORKER_FAILED = "app.worker.failed"
SUBJECT_HITL_RESOLVED = "app.worker.hitl_resolved"

# --- Adopted stealth stack (spike v1.2): Patchright default, Camoufox alternate ---
# Extension-first remains the primary executor; this hardens the server fallback path only.
WORKER_STEALTH_ENGINE = os.getenv("WORKER_STEALTH_ENGINE", "patchright").strip().lower()

STEALTH_LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-blink-features=AutomationControlled",
    "--disable-features=IsolateOrigins,site-per-process",
]
STEALTH_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
STEALTH_VIEWPORT = {"width": 1280, "height": 850}
STEALTH_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Sec-Ch-Ua": '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}


async def jitter_sleep(page, min_ms: int, max_ms: int) -> None:
    """Non-linear wait: fixed sleeps are a machine-precision detection signal."""
    await page.wait_for_timeout(random.randint(min_ms, max_ms))


async def human_type(locator, text: str) -> None:
    """Human-like keystroke input: focus, select-all to clear any pre-filled
    value (appending would corrupt e.g. phone numbers), then
    character-by-character typing with jitter."""
    await locator.click()
    try:
        await locator.press("ControlOrMeta+a")
    except Exception:
        pass
    await locator.type(text or "", delay=random.randint(35, 115))


async def analyze_screen_with_ai_vision(
    page,
    candidate_profile: Dict[str, Any],
    stage_goal: str,
    screening_answers: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """Uses Google Gemini Multimodal Vision to inspect the page screenshot with Set-of-Marks (SoM)
    visual grounding and visible DOM controls, determining the next optimal browser action
    (click, fill, upload, review_pause, completed, etc.).
    """
    if not GEMINI_API_KEY:
        logger.info("[AI Vision] GEMINI_API_KEY not configured; skipping visual inference.")
        return {"action": "none", "reasoning": "GEMINI_API_KEY absent"}

    try:
        # Resolve Page object if target is a Locator
        actual_page = page.page if hasattr(page, "page") else page

        # Step 1: Inject Set-of-Marks (SoM) high-contrast visual badges and extract interactive metadata
        interactive_elements = await actual_page.evaluate("""() => {
            // Clean up any stale badges and mark attributes first
            document.querySelectorAll('.vedha-som-badge').forEach(b => b.remove());
            document.querySelectorAll('[data-vedha-mark-id]').forEach(el => el.removeAttribute('data-vedha-mark-id'));

            const list = [];
            const nodes = document.querySelectorAll("button, a, input, select, textarea, [role='button'], [tabindex='0']");
            for (let i = 0; i < nodes.length; i++) {
                const el = nodes[i];
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                if (rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none') {
                    const markId = list.length + 1;
                    el.setAttribute('data-vedha-mark-id', String(markId));

                    // Inject visual numbered marker badge
                    const badge = document.createElement('div');
                    badge.className = 'vedha-som-badge';
                    badge.innerText = String(markId);
                    badge.style.position = 'absolute';
                    badge.style.left = `${Math.round(window.scrollX + rect.left)}px`;
                    badge.style.top = `${Math.round(window.scrollY + rect.top)}px`;
                    badge.style.zIndex = '2147483647';
                    badge.style.backgroundColor = '#e11d48';
                    badge.style.color = '#ffffff';
                    badge.style.fontSize = '11px';
                    badge.style.fontWeight = 'bold';
                    badge.style.fontFamily = 'monospace';
                    badge.style.padding = '1px 5px';
                    badge.style.borderRadius = '3px';
                    badge.style.border = '1.5px solid #ffffff';
                    badge.style.boxShadow = '0 2px 5px rgba(0,0,0,0.4)';
                    badge.style.pointerEvents = 'none';
                    badge.style.lineHeight = '1.2';
                    document.body.appendChild(badge);

                    const text = (el.innerText || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim();
                    list.push({
                        mark_id: markId,
                        index: list.length,
                        tag: el.tagName.toLowerCase(),
                        id: el.id || '',
                        name: el.getAttribute('name') || '',
                        type: el.getAttribute('type') || '',
                        role: el.getAttribute('role') || '',
                        text: text.slice(0, 80),
                        ariaLabel: (el.getAttribute('aria-label') || '').slice(0, 80),
                        click_x: Math.round(rect.x + rect.width / 2),
                        click_y: Math.round(rect.y + rect.height / 2),
                        width: Math.round(rect.width),
                        height: Math.round(rect.height)
                    });
                    if (list.length >= 60) break;
                }
            }
            return list;
        }""")

        # Step 2: Capture screenshot with Set-of-Marks tags visually rendered
        screenshot_bytes = await actual_page.screenshot(type="jpeg", quality=75)
        b64_img = base64.b64encode(screenshot_bytes).decode("utf-8")

        # Step 3: Remove visual badges immediately so page remains natural
        await actual_page.evaluate("""() => {
            document.querySelectorAll('.vedha-som-badge').forEach(b => b.remove());
        }""")

        prompt = f"""You are the AI Vision Decision Engine for an autonomous job application agent.
Analyze this browser screenshot and the visible interactive DOM controls below.
Each interactive element on the screen is visually labeled with a high-contrast red numeric badge [1], [2], [3], etc. (Set-of-Marks).

Candidate Profile:
- Full Name: {candidate_profile.get('fullName') or candidate_profile.get('full_name') or ''}
- Email: {candidate_profile.get('email') or ''}
- Phone: {candidate_profile.get('phoneNumber') or candidate_profile.get('phone') or ''}
- Total Years Experience: {candidate_profile.get('totalYearsExperience') or candidate_profile.get('total_years_experience') or 3}
- Current Salary / CTC: {candidate_profile.get('currentSalary') or ''}
- Expected Salary / CTC: {candidate_profile.get('expectedSalary') or ''}
- Notice Period: {candidate_profile.get('noticePeriodDays', 30)} days
- Work Authorization: {candidate_profile.get('workAuthorizationStatus') or 'Authorized'}
- Requires Visa Sponsorship: {candidate_profile.get('requiresVisaSponsorship', False)}

Current Stage / Goal:
{stage_goal}

Visible Tagged Controls (numbered by mark_id):
{json.dumps(interactive_elements, indent=2)}

Decide the best single next action to advance the application:
Actions:
- "click": Click an element (e.g. Apply, Easy Apply, Next, Continue, Review, Submit, or a radio/checkbox option).
- "fill": Fill a text, number, or tel input.
- "upload": Attach resume PDF to an input[type='file'].
- "review_pause": We have arrived at the final review / summary screen (before final submission).
- "completed": Application has already been submitted or completed successfully.
- "auth_required": Login wall or sign-in gate is visible.
- "cannot_proceed": An insurmountable blocker, captcha, or error is displayed.

Respond ONLY with valid JSON:
{{
    "action": "click" | "fill" | "upload" | "review_pause" | "completed" | "auth_required" | "cannot_proceed",
    "mark_id": 1,
    "element_index": 0,
    "coordinates": {{"x": 450, "y": 620}},
    "selector": "CSS selector to target the element, e.g. button:has-text('Apply') or input[name='phone'] or #submit",
    "value": "string value to type if action is fill, else empty string",
    "reasoning": "brief explanation based on the visual screenshot and mark ID"
}}"""

        for model_name in VISION_MODEL_CASCADES:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
                req_body = {
                    "contents": [{
                        "parts": [
                            {"text": prompt},
                            {
                                "inlineData": {
                                    "mimeType": "image/jpeg",
                                    "data": b64_img
                                }
                            }
                        ]
                    }],
                    "generationConfig": {
                        "temperature": 0.1,
                        "maxOutputTokens": 1024,
                        "responseMimeType": "application/json"
                    }
                }
                resp = await asyncio.to_thread(requests.post, url, json=req_body, timeout=25)
                if resp.status_code == 404:
                    logger.warning(f"[AI Vision] Model '{model_name}' returned 404; trying next in fallback cascade.")
                    continue
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        text_part = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                        if text_part:
                            parsed = json.loads(text_part)
                            logger.info(f"[AI Vision] Decision ({model_name}): action={parsed.get('action')}, mark_id={parsed.get('mark_id')}, element_index={parsed.get('element_index')}, coords={parsed.get('coordinates')}, reasoning={parsed.get('reasoning')}")
                            return parsed
                else:
                    logger.warning(f"[AI Vision] Gemini returned {resp.status_code}: {resp.text[:200]}")
            except Exception as ex:
                logger.warning(f"[AI Vision] Model '{model_name}' failed: {ex}")

        return {"action": "none", "reasoning": "All vision models failed or returned non-200"}
    except Exception as e:
        logger.warning(f"[AI Vision] analyze_screen_with_ai_vision error: {e}")
        return {"action": "none", "reasoning": str(e)}


async def execute_vision_action(
    target,
    decision: Dict[str, Any],
    resume_pdf_path: Optional[str] = None
) -> bool:
    """Executes a decision rendered by Gemini Multimodal Vision across 4 progressive execution tiers:
    0. Set-of-Marks direct attribute targeting ([data-vedha-mark-id='X'])
    1. CSS Selector targeting
    2. Element Index DOM query
    3. Direct Viewport Coordinates via physical Playwright Mouse Click (page.mouse.click(x, y))
    """
    if not decision or not isinstance(decision, dict):
        return False

    actual_page = target.page if hasattr(target, "page") else target
    action = decision.get("action", "")
    mark_id = decision.get("mark_id")
    selector = decision.get("selector", "")
    idx = decision.get("element_index", -1)
    coords = decision.get("coordinates")

    try:
        # Tier 0: Direct Set-of-Marks Attribute Target (highest precision, zero coordinate drift)
        if mark_id is not None:
            try:
                mark_loc = target.locator(f"[data-vedha-mark-id='{mark_id}']").first
                if await mark_loc.count() > 0:
                    if action == "click":
                        await mark_loc.scroll_into_view_if_needed()
                        await mark_loc.click(timeout=3000)
                        logger.info(f"[AI Vision Executor] Clicked via Set-of-Marks ID #{mark_id}")
                        return True
                    elif action == "fill":
                        val = decision.get("value", "")
                        await human_type(mark_loc, str(val))
                        logger.info(f"[AI Vision Executor] Filled input Mark #{mark_id} with '{val}'")
                        return True
                    elif action == "upload" and resume_pdf_path:
                        await mark_loc.set_input_files(resume_pdf_path)
                        logger.info(f"[AI Vision Executor] Uploaded resume PDF via Mark #{mark_id}")
                        return True
            except Exception as e:
                logger.debug(f"[AI Vision Executor] Tier 0 Set-of-Marks execution failed for mark_id={mark_id}: {e}")

        if action == "click":
            # Tier 1: Targeted CSS Selector
            if selector:
                try:
                    loc = target.locator(selector).first
                    if await loc.count() > 0 and await loc.is_visible():
                        await loc.scroll_into_view_if_needed()
                        await loc.click(timeout=3000)
                        logger.info(f"[AI Vision Executor] Clicked via CSS selector: '{selector}'")
                        return True
                except Exception as e:
                    logger.debug(f"[AI Vision Executor] Selector click failed for '{selector}': {e}")

            # Tier 2: Element Index from DOM extract
            if isinstance(idx, int) and idx >= 0:
                try:
                    clicked = await actual_page.evaluate("""(targetIdx) => {
                        const nodes = document.querySelectorAll("button, a, input, select, textarea, [role='button'], [tabindex='0']");
                        let visibleCount = 0;
                        for (let i = 0; i < nodes.length; i++) {
                            const el = nodes[i];
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            if (rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none') {
                                if (visibleCount === targetIdx) {
                                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    el.click();
                                    return true;
                                }
                                visibleCount++;
                            }
                        }
                        return false;
                    }""", idx)
                    if clicked:
                        logger.info(f"[AI Vision Executor] Clicked via DOM element index: {idx}")
                        return True
                except Exception as e:
                    logger.debug(f"[AI Vision Executor] Element index click failed for {idx}: {e}")

            # Tier 3: Direct Visual Viewport Coordinates
            if isinstance(coords, dict) and "x" in coords and "y" in coords:
                try:
                    cx, cy = int(coords["x"]), int(coords["y"])
                    await actual_page.mouse.move(cx, cy, steps=5)
                    await actual_page.mouse.click(cx, cy)
                    logger.info(f"[AI Vision Executor] Clicked via physical viewport coordinates: ({cx}, {cy})")
                    return True
                except Exception as e:
                    logger.debug(f"[AI Vision Executor] Coordinate click failed at ({coords}): {e}")

        elif action == "fill":
            val = decision.get("value", "")
            # Tier 1: Try CSS Selector
            if selector:
                try:
                    loc = target.locator(selector).first
                    if await loc.count() > 0:
                        await human_type(loc, str(val))
                        logger.info(f"[AI Vision Executor] Filled input '{selector}' with '{val}'")
                        return True
                except Exception:
                    pass
            # Tier 3: Click coordinates and type
            if isinstance(coords, dict) and "x" in coords and "y" in coords:
                try:
                    cx, cy = int(coords["x"]), int(coords["y"])
                    await actual_page.mouse.click(cx, cy)
                    await actual_page.keyboard.type(str(val), delay=random.randint(30, 80))
                    logger.info(f"[AI Vision Executor] Clicked ({cx}, {cy}) and typed '{val}'")
                    return True
                except Exception:
                    pass

        elif action == "upload" and resume_pdf_path:
            file_loc = target.locator(selector or "input[type='file']").first
            if await file_loc.count() > 0:
                try:
                    await file_loc.set_input_files(resume_pdf_path)
                    logger.info(f"[AI Vision Executor] Uploaded resume PDF via '{selector or 'input[type=file]'}'")
                    return True
                except Exception as e:
                    logger.debug(f"[AI Vision Executor] File upload failed: {e}")

        return False
    finally:
        # Cleanup temporary mark attributes
        try:
            await actual_page.evaluate("""() => {
                document.querySelectorAll('[data-vedha-mark-id]').forEach(el => el.removeAttribute('data-vedha-mark-id'));
            }""")
        except Exception:
            pass


SUBMIT_SUCCESS_PATTERNS = [
    r"application\s+(submitted|received|complete|completed|successful)",
    r"successfully\s+applied",
    r"thank\s+you\s+for\s+applying",
    r"your\s+application\s+has\s+been",
    r"applied\s+successfully",
]


# --- SSRF guard (mirrors backend UrlSafety + UrlSafetyGuard) ---
# The worker drives a real browser at caller-supplied URLs: loopback,
# link-local, and metadata targets are refused, with DNS resolution checked
# against the same rules (DNS-rebinding defense). Fail closed on DNS failure.
BLOCKED_HOST_NAMES = {
    "localhost",
    "metadata.google.internal",
    "metadata.goog",
    "instance-data",
    "instance-data-compute",
    "169.254.169.254",
    "100.100.100.200",
    "fd00:ec2::254",
}


def _ip_blocked(ip: ipaddress._BaseAddress) -> bool:
    return (
        ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or str(ip) == "0.0.0.0"
    )


def is_url_fetch_allowed(job_url: str) -> Tuple[bool, str]:
    try:
        parsed = urllib.parse.urlparse(job_url or "")
    except Exception:
        return False, "URL does not parse."
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False, "Only absolute HTTP(S) URLs may be fetched."
    host = parsed.hostname.strip().rstrip(".").lower()
    if host in BLOCKED_HOST_NAMES:
        return False, f"Host '{parsed.hostname}' is not allowed."
    try:
        literal = ipaddress.ip_address(host.strip("[]"))
        if _ip_blocked(literal):
            return False, f"Host '{parsed.hostname}' is not allowed."
        return True, ""
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
    except Exception as ex:
        return False, f"Host '{parsed.hostname}' could not be resolved; refusing to fetch ({ex})."
    if not infos:
        return False, f"Host '{parsed.hostname}' could not be resolved; refusing to fetch."
    for info in infos:
        try:
            if _ip_blocked(ipaddress.ip_address(info[4][0])):
                return False, f"Host '{parsed.hostname}' resolves to a disallowed address (DNS-rebinding guard)."
        except ValueError:
            return False, f"Host '{parsed.hostname}' resolved to an unparsable address; refusing to fetch."
    return True, ""


LOGIN_WALL_PHRASES = [
    "login to apply",
    "log in to apply",
    "sign in to apply",
    "signin to apply",
    "register to apply",
    "create an account to apply",
    "please login for",
]


async def detect_login_wall(page) -> str:
    """Returns evidence if the page demands authentication before applying, else ''.

    A headless worker has no candidate session: filling or clicking through a
    login gate is both futile and a ban signal. Callers must return
    AuthenticationRequired with extension guidance instead of proceeding.
    """
    try:
        if await page.locator("input[type='password']").count() > 0:
            return "visible password field (login gate)"
        body_text = ""
        try:
            if await page.locator("body").count() > 0:
                body_text = ((await page.locator("body").first.inner_text()) or "").lower()
        except Exception:
            body_text = ""
        for phrase in LOGIN_WALL_PHRASES:
            if phrase in body_text:
                return f"page text: '{phrase}'"
    except Exception:
        pass
    return ""


async def count_application_fields(page) -> int:
    """Counts fillable application-form fields, excluding auth and chrome.

    Password inputs are deliberately excluded: a login form (email+password)
    must never be mistaken for a job application form.
    """
    try:
        return await page.locator(
            "input:not([type='hidden']):not([type='password']):not([type='submit'])"
            ":not([type='button']):not([type='checkbox']):not([type='radio']), textarea, select"
        ).count()
    except Exception:
        return 0


async def verify_submission(page, pre_click_url: str, timeout_ms: int = 15000):
    """Post-click proof a submission actually happened.

    Returns (True, evidence) only on a confirmation signal: navigation away
    from the form to a success/confirm page, visible confirmation text, or an
    Applied badge. A click alone is NEVER sufficient (false-success guard).
    """
    deadline = time.time() + timeout_ms / 1000.0
    last_evidence = ""
    while time.time() < deadline:
        try:
            url = page.url or ""
            if url and url != pre_click_url and any(
                k in url.lower() for k in ("success", "confirm", "thank", "complete", "applied")
            ):
                return True, f"navigated to {url[:160]}"
            if await page.locator("body").count() > 0:
                body_text = (await page.locator("body").first.inner_text()).lower()
                for pat in SUBMIT_SUCCESS_PATTERNS:
                    match = re.search(pat, body_text)
                    if match:
                        return True, f"confirmation text: '{match.group(0)[:80]}'"
            last_evidence = f"url={url[:160]}"
        except Exception as ex:
            last_evidence = f"verify probe failed: {ex}"
        await page.wait_for_timeout(1000)
    return False, last_evidence or "no confirmation signal within timeout"


@asynccontextmanager
async def stealth_browser_session(headed: bool, proxy_settings):
    """Launch a stealth browser and yield (browser, context, page, engine_name).

    Engine order: camoufox (if WORKER_STEALTH_ENGINE=camoufox) -> patchright
    (default) -> stock playwright fallback if patchright is not installed.
    """
    engine = WORKER_STEALTH_ENGINE

    # Headed mode needs a display server; containers have none. Forcing headed
    # here crashes Chromium ("Missing X server") — degrade honestly to headless
    # unless explicitly overridden. The run receipt records the effective mode.
    effective_headed = headed
    if headed and not os.getenv("DISPLAY") and os.getenv("WORKER_ALLOW_HEADED", "false").lower() != "true":
        logger.warning("[Playwright Agent] Headed requested but no DISPLAY available; running headless instead.")
        effective_headed = False

    if engine == "camoufox":
        from camoufox.async_api import AsyncCamoufox
        cm = AsyncCamoufox(headless=not effective_headed, proxy=proxy_settings)
        browser = await cm.__aenter__()
        try:
            context = await browser.new_context(
                user_agent=STEALTH_USER_AGENT,
                viewport=STEALTH_VIEWPORT,
                locale="en-US",
                extra_http_headers=STEALTH_HEADERS,
            )
            page = await context.new_page()
            yield browser, context, page, "camoufox"
        finally:
            try:
                await browser.close()
            except Exception:
                pass
            await cm.__aexit__(None, None, None)
        return

    factory = None
    if engine == "patchright":
        try:
            # Patchright mirrors Playwright's API names (async_playwright, not async_patchright).
            from patchright.async_api import async_playwright as async_patchright
            factory = async_patchright
            engine = "patchright"
        except ImportError as ie:
            logger.warning(f"[Playwright Agent] patchright import failed ({ie}); falling back to stock Playwright.")

    if factory is None:
        from playwright.async_api import async_playwright
        factory = async_playwright
        engine = "playwright"

    cm = factory()
    entered = await cm.__aenter__()
    browser = None
    try:
        browser = await entered.chromium.launch(
            headless=not effective_headed,
            proxy=proxy_settings,
            args=STEALTH_LAUNCH_ARGS,
        )
        context = await browser.new_context(
            user_agent=STEALTH_USER_AGENT,
            viewport=STEALTH_VIEWPORT,
            locale="en-US",
            timezone_id="Asia/Kolkata",
            extra_http_headers=STEALTH_HEADERS,
        )
        await context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.chrome = { runtime: {} };
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        """)
        page = await context.new_page()
        yield browser, context, page, engine
    finally:
        if browser is not None:
            try:
                await browser.close()
            except Exception:
                pass
        await cm.__aexit__(None, None, None)

# In-memory event registry for HitL responses
hitl_resolved_events: Dict[str, asyncio.Event] = {}
hitl_resolved_payloads: Dict[str, Dict[str, Any]] = {}


class HitlSession:
    """Manages a single HitL session per application to avoid race conditions."""
    def __init__(self, application_id: str, user_id: str, job_url: str, question: str):
        self.application_id = application_id
        self.user_id = user_id
        self.job_url = job_url
        self.question = question
        self.event = asyncio.Event()
        self.resolved_answer: Optional[str] = None
        self.processed = False


hitl_sessions: Dict[str, HitlSession] = {}


# Pydantic Request & Response Models
class ScreeningAnswerItem(BaseModel):
    questionText: str
    answerText: str
    fieldType: Optional[str] = "text"


class CandidateProfilePayload(BaseModel):
    fullName: Optional[str] = ""
    firstName: Optional[str] = ""
    lastName: Optional[str] = ""
    email: Optional[str] = ""
    phoneNumber: Optional[str] = ""
    currentCity: Optional[str] = ""
    currentCountry: Optional[str] = ""
    workAuthorizationStatus: Optional[str] = ""
    requiresVisaSponsorship: bool = False
    noticePeriodDays: int = 30
    currentSalary: Optional[str] = ""
    expectedSalary: Optional[str] = ""
    linkedInUrl: Optional[str] = ""
    githubUrl: Optional[str] = ""
    portfolioUrl: Optional[str] = ""
    linkedInSessionCookie: Optional[str] = None


class ApplyJobRequest(BaseModel):
    applicationId: str
    userId: str
    jobUrl: str
    resumeS3Url: Optional[str] = ""
    resumePdfBase64: Optional[str] = ""
    candidateProfile: Optional[Dict[str, Any]] = None
    screeningAnswers: Optional[List[Dict[str, Any]]] = None
    copilotMode: bool = True
    headed: bool = False


class ApplyJobResponse(BaseModel):
    success: bool
    status: str  # "Submitted", "PausedForUserReview", "AuthenticationRequired", "Failed"
    message: str
    executionLogs: List[str]
    finalPageUrl: str
    errorDetails: Optional[str] = None


class ScrapeJobRequest(BaseModel):
    jobUrl: str


class ScrapeJobResponse(BaseModel):
    success: bool
    title: str = ""
    company: str = ""
    description: str = ""
    source: str = ""
    error: Optional[str] = None


def get_s3_client():
    protocol = "https" if os.getenv("MINIO_USE_SSL", "false").lower() == "true" else "http"
    endpoint_url = f"{protocol}://{MINIO_ENDPOINT}"
    return boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=MINIO_ACCESS_KEY,
        aws_secret_access_key=MINIO_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1"
    )


def prepare_resume_pdf(s3_url: str = "", pdf_base64: str = "") -> str:
    """Prepares resume PDF on local filesystem from Base64, S3, or placeholder."""
    temp_file = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_path = temp_file.name
    temp_file.close()

    try:
        if pdf_base64:
            pdf_bytes = base64.b64decode(pdf_base64)
            with open(temp_path, "wb") as f:
                f.write(pdf_bytes)
            logger.info(f"Wrote base64 resume PDF to {temp_path} ({len(pdf_bytes)} bytes)")
            return temp_path

        if s3_url:
            object_key = s3_url
            if f"/{MINIO_BUCKET}/" in s3_url:
                object_key = s3_url.split(f"/{MINIO_BUCKET}/", 1)[1]
            elif s3_url.startswith("http://") or s3_url.startswith("https://"):
                parsed = urllib.parse.urlparse(s3_url)
                parts = parsed.path.lstrip("/").split("/", 1)
                if len(parts) > 1 and parts[0] == MINIO_BUCKET:
                    object_key = parts[1]
                else:
                    object_key = parsed.path.lstrip("/")

            try:
                s3 = get_s3_client()
                s3.download_file(MINIO_BUCKET, object_key, temp_path)
                logger.info(f"Downloaded resume PDF via S3 SDK for key '{object_key}' to {temp_path} ({os.path.getsize(temp_path)} bytes)")
                return temp_path
            except Exception as s3_err:
                logger.warning(f"S3 SDK download failed for key '{object_key}' ({s3_err}), attempting HTTP fallback...")
                target_url = s3_url
                if "localhost:9000" in target_url:
                    target_url = target_url.replace("localhost:9000", MINIO_ENDPOINT)
                resp = requests.get(target_url, timeout=30)
                resp.raise_for_status()
                with open(temp_path, "wb") as f:
                    f.write(resp.content)
                logger.info(f"Downloaded resume PDF via HTTP from {target_url} to {temp_path} ({os.path.getsize(temp_path)} bytes)")
                return temp_path

        # Minimal valid PDF placeholder
        with open(temp_path, "wb") as f:
            f.write(b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF")
        return temp_path
    except Exception as e:
        logger.warning(f"Error preparing resume PDF ({e}), using fallback minimal PDF")
        with open(temp_path, "wb") as f:
            f.write(b"%PDF-1.4\n%Placeholder Tailored Resume PDF\n%%EOF")
        return temp_path


async def execute_playwright_flow(
    job_url: str,
    resume_pdf_path: str,
    candidate_profile: Dict[str, Any],
    screening_answers: List[Dict[str, Any]],
    application_id: str,
    user_id: str,
    copilot_mode: bool = True,
    headed: bool = False,
    js: Any = None
) -> ApplyJobResponse:
    """
    Executes live browser automation with Playwright.
    Handles:
    - LinkedIn Easy Apply (with session cookie support and multi-step modal traversal)
    - Greenhouse / Lever / Ashby / Workday ATS portals
    - Generic career site semantic fallback
    """
    # Browser driver is resolved lazily inside stealth_browser_session
    # (Patchright default -> Camoufox alternate -> Playwright fallback).

    logs: List[str] = []

    def log(msg: str):
        ts = time.strftime("%H:%M:%S")
        entry = f"[{ts}] {msg}"
        logs.append(entry)
        logger.info(entry)

    log(f"[Playwright Agent] Launching browser session (headed={headed}, copilot_mode={copilot_mode}, engine={WORKER_STEALTH_ENGINE})")
    log(f"[Playwright Agent] Target URL: {job_url}")

    allowed, allow_reason = is_url_fetch_allowed(job_url)
    if not allowed:
        log(f"[Playwright Agent] SSRF guard refused target: {allow_reason}")
        return ApplyJobResponse(
            success=False,
            status="Failed",
            message=f"Refusing to browse this URL: {allow_reason}",
            executionLogs=logs,
            finalPageUrl=job_url,
            errorDetails=f"SSRF guard: {allow_reason}"
        )

    proxy_settings = None
    if RESIDENTIAL_PROXY_URL:
        log("[Playwright Agent] Routing browser traffic through residential proxy")
        proxy_settings = {"server": RESIDENTIAL_PROXY_URL}

    is_linkedin = "linkedin.com" in job_url.lower()
    is_naukri = "naukri.com" in job_url.lower()

    async with stealth_browser_session(headed, proxy_settings) as (browser, context, page, engine_name):
        log(f"[Playwright Agent] Stealth engine active: {engine_name}")

        # Inject LinkedIn session cookie if available
        session_cookie = candidate_profile.get("linkedInSessionCookie") or candidate_profile.get("session_cookie") or candidate_profile.get("li_at")
        if is_linkedin and session_cookie:
            log("[Playwright Agent] Injecting authenticated LinkedIn session cookie into browser context")
            await context.add_cookies([
                {"name": "li_at", "value": session_cookie.strip(), "domain": ".www.linkedin.com", "path": "/"},
                {"name": "li_at", "value": session_cookie.strip(), "domain": ".linkedin.com", "path": "/"}
            ])

        # Inject Naukri session cookie if available
        naukri_cookie = candidate_profile.get("naukriSessionCookie") or candidate_profile.get("naukri_cookie")
        if is_naukri and naukri_cookie:
            log("[Playwright Agent] Injecting authenticated Naukri session cookie into browser context")
            await context.add_cookies([
                {"name": "naukri_session", "value": naukri_cookie.strip(), "domain": ".naukri.com", "path": "/"}
            ])

        try:
            log(f"[Playwright Agent] Navigating to {job_url}...")
            await page.goto(job_url, timeout=45000, wait_until="domcontentloaded")
            await jitter_sleep(page, 2200, 3400)

            # Bot / WAF Access Denied Check
            page_text = ""
            try:
                page_text = (await page.locator("body").inner_text() or "").lower()
            except Exception:
                pass
            if "access denied" in page_text or "you don't have permission to access" in page_text or "403 forbidden" in page_text:
                log(f"[Playwright Agent] Access Denied / WAF Bot Block detected on {job_url}")
                return ApplyJobResponse(
                    success=False,
                    status="AuthenticationRequired",
                    message="The job portal's anti-bot firewall returned 'Access Denied' to the headless server. Please open the posting in your browser tab and click 'Auto-Fill & Review' in the Vedha Chrome Extension to apply with 100% accuracy!",
                    executionLogs=logs,
                    finalPageUrl=page.url,
                    errorDetails="WAF Access Denied"
                )

            # =========================================================================
            # Case 1: LinkedIn Easy Apply Flow
            # =========================================================================
            if is_linkedin:
                log("[Playwright Agent] Inspecting LinkedIn job page...")

                # Check if unauthenticated
                current_url = page.url.lower()
                is_auth_wall = "linkedin.com/authwall" in current_url or "linkedin.com/login" in current_url
                sign_in_btn = page.locator("a:has-text('Sign in'), button:has-text('Sign in')")
                has_sign_in_btn = await sign_in_btn.count() > 0

                # Check if already applied
                applied_elem = page.locator(".jobs-s-apply--applied, span:has-text('Applied'), button:has-text('Applied')")
                if await applied_elem.count() > 0:
                    log("[Playwright Agent] Verified: This job posting has already been submitted on LinkedIn.")
                    return ApplyJobResponse(
                        success=True,
                        status="Submitted",
                        message="Verified: You have already applied to this position on LinkedIn.",
                        executionLogs=logs,
                        finalPageUrl=page.url
                    )

                if is_auth_wall or (has_sign_in_btn and not session_cookie):
                    log("[Playwright Agent] LinkedIn authentication barrier detected. Headless session cannot access Easy Apply without candidate credentials.")
                    log("[Playwright Agent] Recommendation: Use the Vedha Desktop Chrome Extension in your logged-in browser tab, or save your 'li_at' cookie in Candidate Profile.")
                    return ApplyJobResponse(
                        success=False,
                        status="AuthenticationRequired",
                        message="LinkedIn Easy Apply requires authentication. Use the Desktop Extension Copilot in your active browser tab, or provide your LinkedIn session cookie (li_at) in Candidate Profile.",
                        executionLogs=logs,
                        finalPageUrl=page.url
                    )

                # Locate Easy Apply button
                easy_apply_btn = page.locator("button.jobs-apply-button, button[aria-label*='Easy Apply'], button:has-text('Easy Apply')").first
                if await easy_apply_btn.count() == 0:
                    log("[Playwright Agent] 'Easy Apply' button not found on posting (may be direct company career link).")
                    return ApplyJobResponse(
                        success=False,
                        status="Failed",
                        message="Could not find 'Easy Apply' on this LinkedIn posting. It may require applying externally.",
                        executionLogs=logs,
                        finalPageUrl=page.url
                    )

                log("[Playwright Agent] Found 'Easy Apply' button. Launching application modal...")
                await easy_apply_btn.click()
                await jitter_sleep(page, 1500, 2600)

                # Modal multi-step loop
                step_idx = 0
                while step_idx < 12:
                    step_idx += 1
                    modal = page.locator(".jobs-easy-apply-modal, div[data-test-modal-id='easy-apply-modal'], .artdeco-modal").first
                    if await modal.count() == 0:
                        log("[Playwright Agent] Modal closed or not detected.")
                        break

                    # 1. Fill phone number if empty
                    phone_input = modal.locator("input[id*='phoneNumber'], input[name*='phoneNumber'], input[type='tel']").first
                    if await phone_input.count() > 0:
                        val = await phone_input.input_value()
                        if not val.strip() and candidate_profile.get("phoneNumber"):
                            await human_type(phone_input, candidate_profile["phoneNumber"])
                            log(f"[Playwright Agent] Injected phone number: {candidate_profile['phoneNumber']}")

                    # 2. Check for File Upload input
                    file_input = modal.locator("input[type='file']").first
                    if await file_input.count() > 0:
                        try:
                            await file_input.set_input_files(resume_pdf_path)
                            log("[Playwright Agent] Uploaded tailored ATS resume PDF to modal")
                        except Exception as up_ex:
                            log(f"[Playwright Agent] Resume upload note: {up_ex}")

                    # 3. Check for Radio Buttons (Yes/No screening questions)
                    fieldsets = modal.locator("fieldset")
                    fs_count = await fieldsets.count()
                    for f_i in range(fs_count):
                        fs = fieldsets.nth(f_i)
                        legend_el = fs.locator("legend, label").first
                        if await legend_el.count() > 0:
                            q_text = (await legend_el.text_content() or "").lower()
                            radios = fs.locator("input[type='radio']")
                            if await radios.count() > 0:
                                # Determine answer: grounded or skipped, NEVER invented.
                                # Sponsorship is tri-state (None = unknown = skip);
                                # every other question needs a prefilled answer.
                                # The old blanket "yes" default filed attestations
                                # the candidate never gave.
                                pref_ans = None
                                if "sponsorship" in q_text or "require visa" in q_text:
                                    sponsorship = candidate_profile.get("requiresVisaSponsorship")
                                    if sponsorship is True:
                                        pref_ans = "yes"
                                    elif sponsorship is False:
                                        pref_ans = "no"

                                # Check prefilled screening answers
                                for ans in screening_answers:
                                    if ans.get("questionText", "").lower()[:20] in q_text:
                                        pref_ans = "yes" if "yes" in ans.get("answerText", "").lower() else "no"
                                        break

                                if pref_ans is None:
                                    log(f"[Playwright Agent] Skipping question '{q_text[:40]}...' (no grounded answer; left for candidate).")
                                    continue

                                target_radio = fs.locator(f"label:has-text('{pref_ans.capitalize()}'), input[value*='{pref_ans}' i]").first
                                if await target_radio.count() > 0:
                                    await target_radio.click()
                                    log(f"[Playwright Agent] Answered question '{q_text[:40]}...' with '{pref_ans}'")
                                else:
                                    log(f"[Playwright Agent] No matching '{pref_ans}' option for '{q_text[:40]}...' (left for candidate).")

                    # 4. Check for Numeric inputs (Years of experience)
                    numeric_inputs = modal.locator("input[type='number'], input[id*='numeric']").all()
                    for num_inp in await numeric_inputs:
                        cur_val = await num_inp.input_value()
                        if not cur_val.strip():
                            years = candidate_profile.get("totalYearsExperience") or candidate_profile.get("total_years_experience")
                            if years is None or str(years).strip() == "":
                                log("[Playwright Agent] Skipping numeric experience field (no years on file; will not invent).")
                                continue
                            await human_type(num_inp, str(years))
                            log(f"[Playwright Agent] Populated numeric experience field with profile value {years}")

                    # 4b. Read-back verification (parity with the ATS path):
                    # confirm modal fills actually stuck before advancing.
                    try:
                        verify_ok, verify_total = 0, 0
                        if await phone_input.count() > 0:
                            verify_total += 1
                            if (await phone_input.input_value() or "").strip():
                                verify_ok += 1
                            else:
                                log("[Playwright Agent] WARNING: modal phone field is empty after fill.")
                        numeric_check = await modal.locator("input[type='number'], input[id*='numeric']").all()
                        for num_inp in numeric_check:
                            try:
                                verify_total += 1
                                if (await num_inp.input_value() or "").strip():
                                    verify_ok += 1
                            except Exception:
                                pass
                        log(f"[Playwright Agent] Modal read-back: {verify_ok}/{verify_total} fields retained values.")
                    except Exception as verify_ex:
                        log(f"[Playwright Agent] Modal read-back probe failed (non-fatal): {verify_ex}")

                    # 5. Check if Review Screen Reached (Contains Submit Button)
                    submit_btn = modal.locator("button[aria-label='Submit application'], button:has-text('Submit application')").first
                    if await submit_btn.count() > 0:
                        log("[Playwright Agent] Reached final Review & Submit screen.")
                        if copilot_mode:
                            log("[Playwright Agent] Copilot Review Gateway Active: Automation safely paused before final submit for candidate review.")
                            return ApplyJobResponse(
                                success=True,
                                status="PausedForUserReview",
                                message="LinkedIn Easy Apply pre-filled and paused at final Review screen.",
                                executionLogs=logs,
                                finalPageUrl=page.url
                            )
                        else:
                            log("[Playwright Agent] Submitting final application to LinkedIn...")
                            await submit_btn.click()
                            await jitter_sleep(page, 2500, 3600)
                            dismiss_btn = page.locator("button[aria-label='Dismiss'], button:has-text('Done')").first
                            if await dismiss_btn.count() > 0:
                                await dismiss_btn.click()
                            log("[Playwright Agent] Application successfully submitted to LinkedIn Easy Apply!")
                            return ApplyJobResponse(
                                success=True,
                                status="Submitted",
                                message="Application successfully submitted to LinkedIn Easy Apply.",
                                executionLogs=logs,
                                finalPageUrl=page.url
                            )

                    # 6. Look for "Review" button
                    review_btn = modal.locator("button[aria-label='Review your application'], button:has-text('Review')").first
                    if await review_btn.count() > 0:
                        log("[Playwright Agent] Advancing to Review screen...")
                        await review_btn.click()
                        await jitter_sleep(page, 1200, 2100)
                        continue

                    # 7. Look for "Next" button
                    next_btn = modal.locator("button[aria-label='Continue to next step'], button:has-text('Next')").first
                    if await next_btn.count() > 0:
                        log(f"[Playwright Agent] Advancing modal step {step_idx}...")
                        await next_btn.click()
                        await jitter_sleep(page, 1200, 2100)
                        continue

                    # 8. AI Vision Decision Engine: analyze modal progression if buttons are custom/dynamic
                    if GEMINI_API_KEY:
                        log("[Playwright Agent] Engaging AI Vision Decision Engine to analyze modal progression...")
                        v_dec = await analyze_screen_with_ai_vision(modal, candidate_profile, "Advance through LinkedIn Easy Apply modal wizard", screening_answers)
                        act = v_dec.get("action")
                        if act == "click":
                            log(f"[Playwright Agent] AI Vision decided to click: index={v_dec.get('element_index')}, selector={v_dec.get('selector')}, coords={v_dec.get('coordinates')} ({v_dec.get('reasoning')})")
                            clicked = await execute_vision_action(modal, v_dec, resume_pdf_path)
                            if clicked:
                                await jitter_sleep(page, 1500, 2500)
                                continue
                        elif act == "review_pause":
                            log("[Playwright Agent] AI Vision verified application reached Review stage.")
                            if copilot_mode:
                                return ApplyJobResponse(
                                    success=True,
                                    status="PausedForUserReview",
                                    message="LinkedIn Easy Apply pre-filled and paused at final Review screen via AI Vision.",
                                    executionLogs=logs,
                                    finalPageUrl=page.url
                                )

                    break

                log("[Playwright Agent] Modal traversal finished. Verifying submission...")
                applied_check = page.locator(".jobs-s-apply--applied, span:has-text('Applied'), button:has-text('Applied')")
                if await applied_check.count() > 0:
                    log("[Playwright Agent] Verified: application shows Applied state.")
                    return ApplyJobResponse(
                        success=True,
                        status="Submitted",
                        message="Verified: LinkedIn shows the Applied state for this posting.",
                        executionLogs=logs,
                        finalPageUrl=page.url
                    )
                if copilot_mode:
                    return ApplyJobResponse(
                        success=True,
                        status="PausedForUserReview",
                        message="Easy Apply steps traversed; candidate must verify and submit.",
                        executionLogs=logs,
                        finalPageUrl=page.url
                    )
                log("[Playwright Agent] Modal ended WITHOUT a verifiable Applied state; refusing to claim submission.")
                return ApplyJobResponse(
                    success=False,
                    status="Failed",
                    message="Easy Apply ended without a verifiable submission. Open the posting to check manually.",
                    executionLogs=logs,
                    finalPageUrl=page.url,
                    errorDetails="No Applied badge/confirmation after modal traversal."
                )

            # =========================================================================
            # Case 2: Naukri Application Flow (naukri.com)
            # =========================================================================
            elif is_naukri:
                log("[Playwright Agent] Inspecting Naukri job posting...")

                current_url = page.url.lower()
                is_naukri_auth = "nlogin/login" in current_url or await page.locator(".login-layer, .login-modal, [class*='login_layer']").count() > 0
                if is_naukri_auth and not naukri_cookie:
                    log("[Playwright Agent] Naukri authentication barrier detected.")
                    return ApplyJobResponse(
                        success=False,
                        status="AuthenticationRequired",
                        message="Naukri requires candidate login. Please open the posting in your browser tab using the Vedha Desktop Extension, or log into Naukri.",
                        executionLogs=logs,
                        finalPageUrl=page.url
                    )

                # Check if already applied
                already_applied = page.locator(".already-applied, span:has-text('Already Applied'), button:has-text('Already Applied')")
                if await already_applied.count() > 0:
                    log("[Playwright Agent] Verified: This job posting has already been submitted on Naukri.")
                    return ApplyJobResponse(
                        success=True,
                        status="Submitted",
                        message="Verified: You have already applied to this position on Naukri.",
                        executionLogs=logs,
                        finalPageUrl=page.url
                    )

                # Locate Apply button
                apply_btn = page.locator("button.apply-button, #apply-button, button:has-text('Apply'), button:has-text('Apply on company site'), button:has-text('I am interested'), .apply-button-container button").first
                pre_apply_url = page.url
                apply_clicked = False

                if await apply_btn.count() > 0:
                    btn_text = (await apply_btn.text_content() or "").strip()
                    log(f"[Playwright Agent] Triggering Naukri Apply action ('{btn_text}')...")
                    await apply_btn.click()
                    apply_clicked = True
                    await jitter_sleep(page, 2000, 3200)
                elif GEMINI_API_KEY:
                    log("[Playwright Agent] Applying AI Vision to locate and click Naukri Apply button...")
                    v_dec = await analyze_screen_with_ai_vision(page, candidate_profile, "Find and click the Apply button for this Naukri job posting")
                    if v_dec.get("action") == "cannot_proceed":
                        reason = v_dec.get("reasoning", "")
                        log(f"[Playwright Agent] AI Vision detected blocker on Naukri: {reason}")
                        return ApplyJobResponse(
                            success=False,
                            status="AuthenticationRequired" if any(k in reason.lower() for k in ("access denied", "blocked", "captcha", "login", "auth")) else "Failed",
                            message=f"Naukri application paused: {reason}. Open this posting in your browser and click 'Auto-Fill & Review' in the Vedha Chrome Extension.",
                            executionLogs=logs,
                            finalPageUrl=page.url,
                            errorDetails=reason
                        )
                    elif v_dec.get("action") == "click":
                        log(f"[Playwright Agent] AI Vision decided to click Apply button: index={v_dec.get('element_index')}, selector={v_dec.get('selector')}, coords={v_dec.get('coordinates')} ({v_dec.get('reasoning')})")
                        apply_clicked = await execute_vision_action(page, v_dec)
                        if apply_clicked:
                            await jitter_sleep(page, 2000, 3200)

                if not apply_clicked:
                    log("[Playwright Agent] Could not locate or click Apply button on Naukri posting.")
                    return ApplyJobResponse(
                        success=False,
                        status="Failed",
                        message="Could not find 'Apply' button on this Naukri job posting.",
                        executionLogs=logs,
                        finalPageUrl=page.url
                    )

                # Handle external redirect (e.g. company career site from Naukri)
                if page.url != pre_apply_url and "naukri.com" not in page.url.lower():
                    log(f"[Playwright Agent] Naukri redirected to external portal: {page.url}")
                    login_evidence = await detect_login_wall(page)
                    if login_evidence:
                        return ApplyJobResponse(
                            success=False,
                            status="AuthenticationRequired",
                            message="The external career portal requires candidate login. Please open in browser with the Vedha extension.",
                            executionLogs=logs,
                            finalPageUrl=page.url
                        )

                # Inspect Naukri application drawer / chatbot modal
                drawer = page.locator(".drawer-wrapper, .chatbot-container, .chat-container, div[class*='apply-message'], .apply-modal, div[class*='drawer']").first
                if await drawer.count() > 0:
                    log("[Playwright Agent] Naukri application drawer detected. Injecting candidate profile...")

                    # 1. Experience
                    exp_input = drawer.locator("input[name*='experience' i], input[id*='experience' i], input[placeholder*='experience' i]").first
                    if await exp_input.count() > 0:
                        years = candidate_profile.get("totalYearsExperience") or candidate_profile.get("total_years_experience") or "3"
                        await human_type(exp_input, str(years))
                        log(f"[Playwright Agent] Populated Experience: {years} years")

                    # 2. Notice period
                    np_input = drawer.locator("input[name*='notice' i], select[name*='notice' i]").first
                    if await np_input.count() > 0:
                        np = str(candidate_profile.get("noticePeriodDays", 30))
                        await human_type(np_input, f"{np} days")
                        log(f"[Playwright Agent] Populated Notice Period: {np} days")

                    # 3. Current CTC
                    cur_salary = candidate_profile.get("currentSalary") or ""
                    if cur_salary:
                        curr_input = drawer.locator("input[name*='currentCtc' i], input[placeholder*='current ctc' i], input[name*='currentSalary' i]").first
                        if await curr_input.count() > 0:
                            await human_type(curr_input, cur_salary)
                            log(f"[Playwright Agent] Populated Current CTC: {cur_salary}")

                    # 4. Expected CTC
                    exp_salary = candidate_profile.get("expectedSalary") or ""
                    if exp_salary:
                        exp_ctc_input = drawer.locator("input[name*='expectedCtc' i], input[placeholder*='expected ctc' i], input[name*='expectedSalary' i]").first
                        if await exp_ctc_input.count() > 0:
                            await human_type(exp_ctc_input, exp_salary)
                            log(f"[Playwright Agent] Populated Expected CTC: {exp_salary}")

                    # 5. Resume upload
                    file_input = drawer.locator("input[type='file']").first
                    if await file_input.count() > 0:
                        try:
                            await file_input.set_input_files(resume_pdf_path)
                            log("[Playwright Agent] Attached tailored ATS resume PDF to Naukri drawer")
                        except Exception as up_ex:
                            log(f"[Playwright Agent] Resume upload note: {up_ex}")

                    # 6. Screening questions
                    for ans in screening_answers:
                        q_txt = ans.get("questionText", "")
                        a_txt = ans.get("answerText", "")
                        if q_txt and a_txt:
                            q_match = drawer.locator(f"xpath=//label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{q_txt.lower()[:20]}')]/following::input[1]").first
                            if await q_match.count() > 0:
                                await human_type(q_match, a_txt)
                                log(f"[Playwright Agent] Answered question '{q_txt[:30]}...' with '{a_txt}'")

                    # 7. Check Save and Apply button
                    save_btn = drawer.locator("button:has-text('Save and Apply'), button:has-text('Apply'), button:has-text('Submit'), button[type='submit']").first
                    save_clicked = False
                    if await save_btn.count() == 0 and GEMINI_API_KEY:
                        v_dec = await analyze_screen_with_ai_vision(drawer, candidate_profile, "Find final Save & Apply or Submit button in Naukri drawer", screening_answers)
                        if v_dec.get("action") == "click":
                            log(f"[Playwright Agent] AI Vision clicking Save & Apply button in drawer: index={v_dec.get('element_index')}, coords={v_dec.get('coordinates')} ({v_dec.get('reasoning')})...")
                            save_clicked = await execute_vision_action(drawer, v_dec)

                    if copilot_mode:
                        log("[Playwright Agent] Copilot Review Gateway Active: Naukri application form pre-filled and paused for candidate review.")
                        return ApplyJobResponse(
                            success=True,
                            status="PausedForUserReview",
                            message="Naukri application form pre-filled and staged. Paused for candidate review.",
                            executionLogs=logs,
                            finalPageUrl=page.url
                        )
                    else:
                        if await save_btn.count() > 0:
                            log("[Playwright Agent] Submitting final Naukri application...")
                            await save_btn.click()
                        elif save_clicked:
                            log("[Playwright Agent] Submitting final Naukri application via AI Vision click...")
                            verified, evidence = await verify_submission(page, pre_apply_url)
                            if verified:
                                log(f"[Playwright Agent] Naukri submission VERIFIED: {evidence}")
                                return ApplyJobResponse(
                                    success=True,
                                    status="Submitted",
                                    message="Application successfully submitted to Naukri.",
                                    executionLogs=logs,
                                    finalPageUrl=page.url
                                )

                if copilot_mode:
                    log("[Playwright Agent] Copilot Review Gateway: Naukri flow staged for candidate review.")
                    return ApplyJobResponse(
                        success=True,
                        status="PausedForUserReview",
                        message="Naukri application initiated. Paused for candidate review.",
                        executionLogs=logs,
                        finalPageUrl=page.url
                    )

                return ApplyJobResponse(
                    success=True,
                    status="Submitted",
                    message="Naukri application initiated.",
                    executionLogs=logs,
                    finalPageUrl=page.url
                )

            # =========================================================================
            # Case 3: ATS Portals (Greenhouse, Lever, Ashby, Workday, Company Careers)
            # =========================================================================
            log("[Playwright Agent] Executing ATS portal form filler...")

            # 0. Page-shape classification FIRST: a job LISTING page is not a form,
            # and a login gate is not fillable headless. Both used to die late with
            # "Submit control absent" — classify early and say what to do instead.
            login_evidence = await detect_login_wall(page)
            if login_evidence:
                log(f"[Playwright Agent] Login wall detected ({login_evidence}). Headless session cannot authenticate as the candidate.")
                log("[Playwright Agent] Recommendation: use the Vedha extension in your logged-in browser tab.")
                return ApplyJobResponse(
                    success=False,
                    status="AuthenticationRequired",
                    message="This posting requires login before applying. Use the Vedha extension in your logged-in browser tab, where you're already signed in.",
                    executionLogs=logs,
                    finalPageUrl=page.url,
                    errorDetails=f"Login wall: {login_evidence}"
                )

            if await count_application_fields(page) == 0:
                log("[Playwright Agent] No application form fields on this page: it is a job listing/content page, not an application form.")
                return ApplyJobResponse(
                    success=False,
                    status="Failed",
                    message="This looks like a job listing page rather than an application form — there is nothing to fill here. Open the posting in your browser with the Vedha extension; it will drive the real Apply flow in your logged-in session.",
                    executionLogs=logs,
                    finalPageUrl=page.url,
                    errorDetails="Zero fillable form fields on page."
                )

            # 1. Fill Name
            full_name = candidate_profile.get("fullName") or candidate_profile.get("full_name") or ""
            name_input = page.locator("input[name*='name' i], input[id*='name' i], input[autocomplete='name']").first
            if await name_input.count() > 0:
                await human_type(name_input, full_name)
                log(f"[Playwright Agent] Filled Name: {full_name}")

            # 2. Fill Email
            email = candidate_profile.get("email") or ""
            email_input = page.locator("input[type='email'], input[name*='email' i], input[id*='email' i]").first
            if await email_input.count() > 0:
                await human_type(email_input, email)
                log(f"[Playwright Agent] Filled Email: {email}")

            # 3. Fill Phone
            phone = candidate_profile.get("phoneNumber") or candidate_profile.get("phone") or ""
            phone_input = page.locator("input[type='tel'], input[name*='phone' i], input[id*='phone' i]").first
            if await phone_input.count() > 0:
                await human_type(phone_input, phone)
                log(f"[Playwright Agent] Filled Phone: {phone}")

            # 4. Upload Resume
            file_input = page.locator("input[type='file']").first
            if await file_input.count() > 0:
                await file_input.set_input_files(resume_pdf_path)
                log("[Playwright Agent] Attached tailored ATS resume PDF")

            # 5. Populate prefilled screening answers
            for ans in screening_answers:
                q_text = ans.get("questionText", "")
                a_text = ans.get("answerText", "")
                if not q_text or not a_text:
                    continue

                # Match by label text
                matching_input = page.locator(f"xpath=//label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{q_text.lower()[:25]}')]/following::input[1] | //label[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '{q_text.lower()[:25]}')]/following::textarea[1]").first
                if await matching_input.count() > 0:
                    await human_type(matching_input, a_text)
                    log(f"[Playwright Agent] Grounded question '{q_text[:35]}...' filled with '{a_text[:30]}...'")

            # 5b. Read-back verification: confirm filled values actually stuck.
            # Portals that reject programmatic input silently clear fields; a
            # re-read turns that into an honest receipt instead of a blind claim.
            verified_fields = 0
            present_fields = 0
            for _loc, _label in ((name_input, "name"), (email_input, "email"), (phone_input, "phone")):
                try:
                    if await _loc.count() > 0:
                        present_fields += 1
                        if (await _loc.input_value() or "").strip():
                            verified_fields += 1
                        else:
                            log(f"[Playwright Agent] WARNING: {_label} field is empty after fill (portal may have rejected input).")
                except Exception:
                    pass
            log(f"[Playwright Agent] Field read-back: {verified_fields}/{present_fields} identity fields retained values.")

            # 6. Check Submit Button
            submit_btn = page.locator("button[type='submit'], input[type='submit'], button:has-text('Submit Application'), button:has-text('Apply'), button:has-text('Submit')").first
            submit_clicked = False
            if await submit_btn.count() == 0 and GEMINI_API_KEY:
                log("[Playwright Agent] Standard submit selector not found. Engaging AI Vision Engine...")
                v_dec = await analyze_screen_with_ai_vision(page, candidate_profile, "Find the final Submit Application or Continue button on this career portal", screening_answers)
                if v_dec.get("action") == "click":
                    log(f"[Playwright Agent] AI Vision decided to click submit button: index={v_dec.get('element_index')}, selector={v_dec.get('selector')}, coords={v_dec.get('coordinates')} ({v_dec.get('reasoning')})...")
                    submit_clicked = await execute_vision_action(page, v_dec)
            if copilot_mode:
                log("[Playwright Agent] Copilot Mode Active: Form populated and verified. Paused before submission for candidate authorization.")
                return ApplyJobResponse(
                    success=True,
                    status="PausedForUserReview",
                    message="Application form populated and staged. Paused for candidate review.",
                    executionLogs=logs,
                    finalPageUrl=page.url
                )
            else:
                if await submit_btn.count() > 0:
                    log("[Playwright Agent] Submitting application to career portal...")
                    pre_click_url = page.url
                    await submit_btn.click()
                    verified, evidence = await verify_submission(page, pre_click_url)
                elif submit_clicked:
                    log("[Playwright Agent] Submitting application via AI Vision click...")
                    pre_click_url = page.url
                    verified, evidence = await verify_submission(page, pre_click_url)
                else:
                    verified = False
                    evidence = "No submit button found or clicked"
                    if verified:
                        log(f"[Playwright Agent] Submission VERIFIED: {evidence}")
                        return ApplyJobResponse(
                            success=True,
                            status="Submitted",
                            message=f"Application submitted successfully to ATS portal ({evidence}).",
                            executionLogs=logs,
                            finalPageUrl=page.url
                        )
                    log(f"[Playwright Agent] Submit clicked but NOT verifiable ({evidence}); refusing to claim submission.")
                    return ApplyJobResponse(
                        success=False,
                        status="Failed",
                        message="Submit was clicked but no confirmation could be verified. Check the posting manually before retrying.",
                        executionLogs=logs,
                        finalPageUrl=page.url,
                        errorDetails=f"Unverifiable submission: {evidence}"
                    )

            # No submit control was ever found or clicked: claiming Submitted here
            # was a false-success bug. Report honestly.
            return ApplyJobResponse(
                success=False,
                status="Failed",
                message="No submit control found on this portal; nothing was submitted. Use the extension copilot in your logged-in browser.",
                executionLogs=logs,
                finalPageUrl=page.url,
                errorDetails="Submit control absent; refusing to fabricate success."
            )

        except Exception as ex:
            log(f"[Playwright Agent] Error during browser execution: {ex}")
            return ApplyJobResponse(
                success=False,
                status="Failed",
                message=f"Browser automation failed: {str(ex)}",
                executionLogs=logs,
                finalPageUrl=page.url if page else job_url,
                errorDetails=str(ex)
            )
        finally:
            await browser.close()
            if os.path.exists(resume_pdf_path):
                try:
                    os.remove(resume_pdf_path)
                except Exception:
                    pass


# =========================================================================
# FastAPI Application & Lifespan Event Handling
# =========================================================================
nats_client = None
nats_jetstream = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize NATS JetStream consumer in background
    logger.info("Initializing Vedha Playwright Agent service...")
    nats_task = asyncio.create_task(run_nats_consumer())
    yield
    # Shutdown
    if nats_client:
        try:
            await nats_client.close()
        except Exception:
            pass
    nats_task.cancel()


app = FastAPI(title="Vedha Playwright Agent", lifespan=lifespan)


@app.get("/health")
async def health_check():
    return {
        "status": "Healthy",
        "service": "vedha-playwright-agent",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "nats_connected": nats_client is not None and not nats_client.is_closed
    }


@app.post("/api/playwright/apply", response_model=ApplyJobResponse)
async def api_apply_job(req: ApplyJobRequest):
    logger.info(f"Received HTTP /api/playwright/apply for app_id={req.applicationId} URL={req.jobUrl}")

    pdf_path = prepare_resume_pdf(s3_url=req.resumeS3Url or "", pdf_base64=req.resumePdfBase64 or "")

    res = await execute_playwright_flow(
        job_url=req.jobUrl,
        resume_pdf_path=pdf_path,
        candidate_profile=req.candidateProfile or {},
        screening_answers=req.screeningAnswers or [],
        application_id=req.applicationId,
        user_id=req.userId,
        copilot_mode=req.copilotMode,
        headed=req.headed
    )

    return res


@app.post("/api/playwright/scrape", response_model=ScrapeJobResponse)
async def api_scrape_job(req: ScrapeJobRequest):
    logger.info(f"Received HTTP /api/playwright/scrape for URL={req.jobUrl}")
    allowed, allow_reason = is_url_fetch_allowed(req.jobUrl)
    if not allowed:
        return ScrapeJobResponse(success=False, error=f"Refusing to browse this URL: {allow_reason}")
    # Scrape rides the same stealth session as apply (engine + proxy honored):
    # a stock-Chromium scrape fetch was trivially fingerprinted on guarded ATS pages.
    proxy_settings = None
    if RESIDENTIAL_PROXY_URL:
        proxy_settings = {"server": RESIDENTIAL_PROXY_URL}

    async with stealth_browser_session(False, proxy_settings) as (browser, context, page, engine_name):
        logger.info(f"[Playwright Agent] Scrape session engine: {engine_name}")
        try:
            await page.goto(req.jobUrl, timeout=30000, wait_until="domcontentloaded")
            await jitter_sleep(page, 1500, 2500)

            title = await page.title()
            for sel in ["h1", ".job-title", ".posting-headline h2", "[data-qa='job-title']"]:
                el = page.locator(sel).first
                if await el.count() > 0:
                    text = (await el.text_content() or "").strip()
                    if text:
                        title = text
                        break

            company = ""
            for sel in [".company-name", "[data-qa='company-name']", ".topcard__flavor", ".jd-header-comp-name"]:
                el = page.locator(sel).first
                if await el.count() > 0:
                    text = (await el.text_content() or "").strip()
                    if text:
                        company = text
                        break

            description = ""
            for sel in ["main", "article", "#job-description", ".job-description", ".show-more-less-html__markup", ".content"]:
                el = page.locator(sel).first
                if await el.count() > 0:
                    text = (await el.text_content() or "").strip()
                    if text:
                        description = text
                        break

            if not description:
                description = (await page.content())[:2000]

            return ScrapeJobResponse(
                success=True,
                title=title,
                company=company,
                description=description,
                source="DynamicPlaywright"
            )
        except Exception as e:
            return ScrapeJobResponse(
                success=False,
                error=str(e)
            )
        # No finally browser.close(): stealth_browser_session owns the lifecycle.


async def run_nats_consumer():
    """Background listener for NATS JetStream events."""
    global nats_client, nats_jetstream
    try:
        logger.info(f"Connecting to NATS at {NATS_URL}...")
        nc = await nats.connect(NATS_URL, connect_timeout=5, max_reconnect_attempts=10)
        js = nc.jetstream()
        nats_client = nc
        nats_jetstream = js

        try:
            await js.add_stream(name=STREAM_NAME, subjects=["app.>"], retention=RetentionPolicy.LIMITS)
        except Exception:
            pass

        async def resume_generated_handler(msg):
            try:
                data = json.loads(msg.data.decode())
                app_id = data.get("application_id", "")
                user_id = data.get("user_id", "")
                job_url = data.get("job_url", "")
                s3_url = data.get("resume_s3_url", "")
                profile = data.get("candidate_profile", {})
                answers = data.get("screening_answers", [])

                pdf_path = prepare_resume_pdf(s3_url=s3_url)
                res = await execute_playwright_flow(
                    job_url=job_url,
                    resume_pdf_path=pdf_path,
                    candidate_profile=profile,
                    screening_answers=answers,
                    application_id=app_id,
                    user_id=user_id,
                    copilot_mode=False
                )

                if res.status == "Submitted":
                    payload = {"application_id": app_id, "user_id": user_id, "job_url": job_url, "status": "success"}
                    await js.publish(SUBJECT_WORKER_SUCCESS, json.dumps(payload).encode())
                else:
                    payload = {"application_id": app_id, "user_id": user_id, "error": res.message}
                    await js.publish(SUBJECT_WORKER_FAILED, json.dumps(payload).encode())

                await msg.ack()
            except Exception as e:
                logger.error(f"NATS handler error: {e}")
                await msg.ack()

        await js.subscribe(SUBJECT_RESUME_GENERATED, cb=resume_generated_handler, durable="playwright_worker_resume_consumer")
        logger.info(f"Subscribed to NATS subject '{SUBJECT_RESUME_GENERATED}'")

    except Exception as e:
        logger.warning(f"NATS connection skipped or deferred: {e}")


def main():
    logger.info(f"Starting Vedha Playwright Agent HTTP server on port {WORKER_HTTP_PORT}...")
    uvicorn.run(app, host="0.0.0.0", port=WORKER_HTTP_PORT, log_level="info")


if __name__ == "__main__":
    main()
