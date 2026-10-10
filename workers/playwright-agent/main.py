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
]
STEALTH_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
STEALTH_VIEWPORT = {"width": 1280, "height": 850}


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
            context = await browser.new_context(user_agent=STEALTH_USER_AGENT, viewport=STEALTH_VIEWPORT)
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
        context = await browser.new_context(user_agent=STEALTH_USER_AGENT, viewport=STEALTH_VIEWPORT)
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

        try:
            log(f"[Playwright Agent] Navigating to {job_url}...")
            await page.goto(job_url, timeout=45000, wait_until="domcontentloaded")
            await jitter_sleep(page, 2200, 3400)

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
            # Case 2: ATS Portals (Greenhouse, Lever, Ashby, Workday, Company Careers)
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
            submit_btn = page.locator("button[type='submit'], input[type='submit'], button:has-text('Submit Application'), button:has-text('Apply')").first
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
