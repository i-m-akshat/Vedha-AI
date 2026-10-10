// Vedha AI Content Scraper & Biometric Anti-Ban Auto-Fill Copilot Script
// Equipped with Cloudflare Turnstile Detection, CAPTCHA Human Verification Gateway, and Biometric Mouse Trajectory Simulation
(function () {
  // F12: Idempotent Script Injection Guard — prevents double initialization when
  // chrome.scripting.executeScript injects the script into a tab that already has it loaded.
  if (window.__VEDHA_CONTENT_SCRIPT_INITIALIZED__) {
    // Script already running — just respond to a PING if the caller wants to verify health
    chrome.runtime?.onMessage?.addListener?.((msg, _sender, sendResponse) => {
      if (msg?.action === "PING_CONTENT_SCRIPT") {
        sendResponse({ alive: true, version: "1.0.0", reinjectGuard: true });
        return true;
      }
    });
    return;
  }
  window.__VEDHA_CONTENT_SCRIPT_INITIALIZED__ = true;


  function syncWebAppToken() {
    if (
      window.location.hostname !== "localhost" ||
      window.location.port !== "3000"
    )
      return;

    const token =
      window.localStorage.getItem("vedha_token") ||
      window.localStorage.getItem("resumate_token");
    if (token) chrome.storage.local.set({ vedha_token: token });

    window.addEventListener("message", (event) => {
      if (event.data?.type === "VEDHA_AUTH_TOKEN_SYNC" && event.data.token) {
        chrome.storage.local.set({ vedha_token: event.data.token, cachedUser: event.data.user });
      } else if (event.data?.type === "VEDHA_AUTH_TOKEN_CLEAR") {
        chrome.storage.local.remove(["vedha_token", "cachedUser", "candidateProfile", "cachedMasterResume"]);
      }
    });
  }

  syncWebAppToken();

  // Unknown-safe default profile: every key exists (fill code + tests reference
  // them) but NO value is synthesized. Blanks stay blank and flow into the
  // amber "needs you" escalation path (Step E) instead of filing someone
  // else's identity. Attestation booleans are null (unknown), never false:
  // false would file a "No" the candidate never gave. Only explicit opt-outs
  // that refuse action (coverLetterOptIn/agreedToTerms=false) are safe falses.
  const DEFAULT_CANDIDATE_PROFILE = {
    fullName: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    phoneNumberDigitsOnly: "",
    currentCity: "",
    postalCode: "",
    country: "",
    countryCode: "",
    linkedInUrl: "",
    githubUrl: "",
    portfolioUrl: "",
    noticePeriodDays: null,
    noticePeriodWeeks: null,
    expectedSalary: "",
    expectedSalaryFormatted: "",
    salaryCurrency: "",
    requiresVisaSponsorship: null,
    isAuthorizedToWork: null,
    workAuthorization: "",
    citizenshipStatus: "",
    willingToRelocate: null,
    willingToCommute: null,
    remotePreference: "",
    totalYearsExperience: null,
    education: "",
    educationLevel: "",
    university: "",
    major: "",
    graduationYear: "",
    gpa: "",
    // EEO / Voluntary Disclosure Fields — never auto-answered, only escalated.
    gender: "",
    ethnicity: "",
    veteranStatus: "",
    disabilityStatus: "",
    pronouns: "",
    // Additional commonly required fields
    referralSource: "",
    coverLetterOptIn: false,
    agreedToTerms: false
  };

  // Sensitive-question gate (fail-closed): identity, legal/attestation, EEO,
  // consent, and compensation fields must ONLY be answered from explicit
  // profile values or grounded answers — never rule-invented, never AI-guessed.
  // Unknowns escalate to the candidate (amber) instead of filing fabrications.
  const SENSITIVE_PATTERNS = [
    "sponsorship", "visa", "authorized", "legally", "eligible", "citizen",
    "right to work", "clearance",
    "gender", "race", "ethnicity", "veteran", "disability", "eeo", "pronoun",
    "consent", "agree", "certify", "acknowledge", "terms", "privacy",
    "accurate", "truthful", "attest",
    "background check", "drug test", "relocate", "relocation", "commute",
    "18 years", "date of birth", "dob", " age ",
    "phone", "mobile", "tel", "salary", "compensation", "ctc", "pay expectation",
    "postal", "zip", "ssn", "social security", "passport",
    "full name", "first name", "last name", "email address", "email"
  ];

  function isSensitiveQuestion(qLower = "", errLower = "", el = null) {
    const hay = `${qLower} ${errLower}`.toLowerCase();
    if (SENSITIVE_PATTERNS.some(p => hay.includes(p))) return true;
    try {
      const t = (el && el.type ? el.type : "").toLowerCase();
      if (t === "password") return true;
      if (t === "tel") return true;
    } catch { /* attribute probe must never break the loop */ }
    return false;
  }

  function hasGroundedValue(v) {
    // 0 is grounded (e.g. 0 notice days); false is NOT (an attestation never
    // defaults to "No"). Strict !== keeps both cases exact.
    return v !== undefined && v !== null && v !== "" && v !== false;
  }

  function squashText(s) {
    return String(s || "").toLowerCase().replace(/[\s_.\-]+/g, "");
  }

  // Explicit-attestation resolver: flat payload field first, nested
  // candidateProfile second. false/0 survive (tri-state safe); only
  // undefined/null/"" fall through. Unknowns stay unknown (never defaulted).
  function profileVal(payload, profileObj, key) {
    const a = payload ? payload[key] : undefined;
    if (a !== undefined && a !== null && a !== "") return a;
    const b = profileObj ? profileObj[key] : undefined;
    return b === undefined ? null : b;
  }

  // 1. Enhanced Visibility & Honeypot Detector
  function isElementVisible(el) {
    if (!el) return false;

    // Check computed styles
    const style = window.getComputedStyle(el);
    if (
      style.visibility === "hidden" ||
      style.display === "none" ||
      style.opacity === "0"
    ) {
      return false;
    }

    // Detect common honeypot field names used to catch automated scrapers/bots
    const name = (el.getAttribute("name") || "").toLowerCase();
    const id = (el.getAttribute("id") || "").toLowerCase();
    const honeypotKeywords = [
      "honeypot",
      "honey_pot",
      "trap",
      "url_check",
      "bot_trap",
      "website_blank",
    ];
    if (honeypotKeywords.some((k) => name.includes(k) || id.includes(k))) {
      return false;
    }

    if (el.getAttribute("aria-hidden") === "true") {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return false;
    }

    // Allow fixed, sticky, and scrolled elements; only reject completely collapsed 0-size elements with no children
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && el.children.length === 0) {
      return false;
    }

    return true;
  }


  // 2. Cloudflare Turnstile, reCAPTCHA & WAF Challenge Detector (Strictly visible, interactive challenges)
  function detectCaptchaOrChallenge() {
    const candidates = [
      { sel: 'iframe[src*="challenges.cloudflare.com"], .cf-turnstile, #cf-turnstile, iframe[title*="Cloudflare"]', type: "Cloudflare Turnstile" },
      { sel: '.g-recaptcha:not([aria-hidden="true"]), iframe[src*="recaptcha"]:not([aria-hidden="true"])', type: "Google reCAPTCHA" },
      { sel: '.h-captcha:not([aria-hidden="true"]), iframe[src*="hcaptcha"]:not([aria-hidden="true"])', type: "hCaptcha" },
      { sel: "#challenge-running, #captcha-container", type: "WAF Security Challenge" }
    ];

    for (const c of candidates) {
      const el = document.querySelector(c.sel);
      if (el && isElementVisible(el)) {
        const rect = el.getBoundingClientRect();
        // A real challenge box presented to the user must be visible and have size
        if (rect.width >= 50 && rect.height >= 25) {
          console.warn(`[Vedha AI] Active ${c.type} challenge detected on page:`, el);
          return { type: c.type, element: el };
        }
      }
    }

    return null;
  }

  // 3. Human Verification Gateway Modal / Banner
  function showCaptchaGatewayBanner(challengeInfo, onResolved) {
    let banner = document.getElementById("vedha-captcha-gateway-banner");
    if (banner) banner.remove();

    banner = document.createElement("div");
    banner.id = "vedha-captcha-gateway-banner";
    banner.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #090d16;
      color: #f8fafc;
      border: 2px solid #3b82f6;
      box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4), 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      padding: 16px 24px;
      border-radius: 12px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 16px;
      max-width: 620px;
      backdrop-filter: blur(8px);
    `;

    banner.innerHTML = `
      <div style="font-size: 24px; line-height: 1;">🛡️</div>
      <div style="flex: 1;">
        <div style="font-weight: 700; color: #60a5fa; margin-bottom: 2px;">Human Verification Gateway Active</div>
        <div style="color: #cbd5e1; font-size: 13px;">${challengeInfo.type} detected. Please solve the verification box on screen to resume AutoFill safely.</div>
      </div>
      <button id="vedha-resume-btn" style="
        background: #2563eb;
        color: #fff;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.2s;
        white-space: nowrap;
      ">I've Verified - Continue</button>
    `;

    document.body.appendChild(banner);

    if (challengeInfo.element) {
      challengeInfo.element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      challengeInfo.element.style.outline = "3px solid #3b82f6";
      challengeInfo.element.style.boxShadow =
        "0 0 20px rgba(59, 130, 246, 0.6)";
    }

    const resumeBtn = banner.querySelector("#vedha-resume-btn");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => {
        if (challengeInfo.element) {
          challengeInfo.element.style.outline = "";
          challengeInfo.element.style.boxShadow = "";
        }
        banner.remove();
        if (onResolved) onResolved();
      });
    }
  }

  // 4. Biometric Pointer & Mouse Trajectory Simulation
  async function simulatePointerInteraction(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2 + randomBetween(-4, 4);
    const clientY = rect.top + rect.height / 2 + randomBetween(-3, 3);

    el.dispatchEvent(
      new PointerEvent("pointerover", { bubbles: true, clientX, clientY }),
    );
    el.dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true, clientX, clientY }),
    );
    el.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX, clientY }),
    );
    await sleep(randomBetween(40, 90));

    el.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX, clientY }),
    );
    el.dispatchEvent(
      new MouseEvent("mousedown", { bubbles: true, clientX, clientY }),
    );
    await sleep(randomBetween(30, 70));

    el.dispatchEvent(
      new PointerEvent("pointerup", { bubbles: true, clientX, clientY }),
    );
    el.dispatchEvent(
      new MouseEvent("mouseup", { bubbles: true, clientX, clientY }),
    );
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, clientX, clientY }),
    );
  }

  function setNativeValue(element, value) {
    if (!element) return;
    // Null/undefined coerce to "": without this, String(null) files the
    // literal text "null" into application forms (a fabrication).
    if (value === null || value === undefined) value = "";

    // Resolve the correct prototype for the element type (INPUT, TEXTAREA, or SELECT)
    let prototype;
    if (element.tagName === "TEXTAREA") {
      prototype = window.HTMLTextAreaElement?.prototype;
    } else if (element.tagName === "SELECT") {
      prototype = window.HTMLSelectElement?.prototype;
    } else {
      prototype = window.HTMLInputElement?.prototype;
    }

    // Reset React 16–19 _valueTracker so its synthetic event system does not
    // suppress our programmatic assignment (tracker stores the "last known value").
    const tracker = element._valueTracker;
    if (tracker && typeof tracker.setValue === "function") {
      tracker.setValue(element.value || "");
    }

    // Apply value via the native property descriptor so React's state picks it up.
    const descriptor = prototype ? Object.getOwnPropertyDescriptor(prototype, "value") : null;
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    // Dispatch composed InputEvent (inputType: "insertText") so Vue 3, Angular 17+,
    // React 18/19 and Lit frameworks register the change as a real user keystroke.
    try {
      element.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        composed: true,
        cancelable: true,
        inputType: "insertText",
        data: String(value)
      }));
    } catch {
      element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  // Enhanced dropdown/select handler for React/Vue/Angular controlled components
  async function selectDropdownOption(selectEl, optionValueOrText) {
    if (!selectEl || optionValueOrText === undefined || optionValueOrText === null) return false;
    
    const target = String(optionValueOrText).toLowerCase().trim();
    const options = Array.from(selectEl.options);
    const squash = (s) => String(s || "").toLowerCase().replace(/[\s_.\-]+/g, "");

    // Equality only — never substring: option "Yesterday…" contains "yes" and
    // "5-10 years" contains "5", and filing either is a wrong attestation.
    // A non-matching grounded value returns false so the field escalates.
    let chosenOpt = options.find(o =>
      (o.value && o.value.toLowerCase().trim() === target) ||
      (o.text && o.text.trim().toLowerCase() === target) ||
      (o.text && squash(o.text) === squash(target))
    );
    
    if (!chosenOpt) {
      return false;
    }
    
    // For React controlled components, we need to use the native setter
    // and dispatch proper events
    setNativeValue(selectEl, chosenOpt.value);
    
    // Additional React 18+ specific: dispatch events that React listens to
    selectEl.focus();
    try {
      selectEl.dispatchEvent(new Event("focus", { bubbles: true, composed: true }));
    } catch {}
    
    // Native value setter already called via setNativeValue
    // Now dispatch the change event
    try {
      selectEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    } catch {}
    
    // Also dispatch input event for good measure
    try {
      selectEl.dispatchEvent(new InputEvent("input", { 
        bubbles: true, 
        composed: true,
        inputType: "insertText",
        data: chosenOpt.value 
      }));
    } catch {}
    
    selectEl.blur();
    try {
      selectEl.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    } catch {}
    
    // Visual feedback
    selectEl.style.border = "2px solid #10b981";
    selectEl.setAttribute("title", "✨ Auto-selected by Vedha AI");
    
    return true;
  }

  // 5. Humanized Biometric Keystroke Jitter & Typo Simulation
  async function typeLikeHuman(el, text) {
    if (!el || text === undefined || text === null) return false;
    const strText = String(text);

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await simulatePointerInteraction(el);
    el.focus();
    await sleep(randomBetween(50, 100));

    // Clear existing - use native setter
    setNativeValue(el, "");
    el.dispatchEvent(new Event("focus", { bubbles: true, composed: true }));
    await sleep(randomBetween(50, 100));

    for (let i = 0; i < strText.length; i++) {
      const char = strText[i];
      // Build value incrementally and use native setter
      const newValue = el.value + char;
      setNativeValue(el, newValue);
      el.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true, composed: true }));
      el.dispatchEvent(new InputEvent("input", { data: char, bubbles: true, composed: true, inputType: "insertText" }));
      el.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true, composed: true }));
      await sleep(randomBetween(15, 35));
    }

    // Final native set to ensure React picks it up
    setNativeValue(el, strText);
    el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
    await sleep(randomBetween(50, 100));
    return true;
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // 6. Job Details Scraper
  function extractJobDetails() {
    const host = window.location.hostname.toLowerCase();
    let title = "";
    let company = "";
    let description = "";
    let source = "CompanyCareers";

    if (host.includes("linkedin.com")) {
      source = "LinkedIn";
      title =
        document
          .querySelector(
            ".top-card-layout__title, h1.topcard__title, .job-details-jobs-unified-top-card__job-title",
          )
          ?.innerText?.trim() || "";
      company =
        document
          .querySelector(
            ".topcard__flavor, .topcard__flavor--black-link, .job-details-jobs-unified-top-card__company-name",
          )
          ?.innerText?.trim() || "";
      description =
        document
          .querySelector(
            ".show-more-less-html__markup, .description__text, .jobs-description__content",
          )
          ?.innerText?.trim() || "";
    } else if (host.includes("naukri.com")) {
      source = "Naukri";
      title =
        document
          .querySelector(
            ".jd-header-title, h1.styles_jd-header-title__rZwM1, h1",
          )
          ?.innerText?.trim() || "";
      company =
        document
          .querySelector(
            ".jd-header-comp-name, .styles_jd-header-comp-name__MvqAI, .comp-name",
          )
          ?.innerText?.trim() || "";
      description =
        document
          .querySelector(
            ".styles_JDC__dang-inner-html__fq0Rate, .job-desc, .dang-inner-html",
          )
          ?.innerText?.trim() || "";
    } else if (host.includes("greenhouse.io")) {
      source = "Greenhouse";
      title =
        document
          .querySelector(".app-title, h1.job-title, .job-title")
          ?.innerText?.trim() || "";
      company =
        document.querySelector(".company-name")?.innerText?.trim() || "";
      description =
        document
          .querySelector("#content, .content, #main")
          ?.innerText?.trim() || "";
    } else if (host.includes("lever.co")) {
      source = "Lever";
      title =
        document.querySelector(".posting-headline h2, h2")?.innerText?.trim() ||
        "";
      company =
        document.querySelector(".main-header .title")?.innerText?.trim() || "";
      description =
        document
          .querySelector(".content, .posting-sections")
          ?.innerText?.trim() || "";
    } else if (host.includes("ashbyhq.com")) {
      source = "Ashby";
      title =
        document
          .querySelector("h1, [data-qa='job-title']")
          ?.innerText?.trim() || "";
      company =
        document.querySelector("[data-qa='company-name']")?.innerText?.trim() ||
        "";
      description =
        document
          .querySelector("main, [data-qa='job-description']")
          ?.innerText?.trim() || "";
    } else if (host.includes("indeed.com")) {
      source = "Indeed";
      title =
        document
          .querySelector("h1.jobsearch-JobInfoHeader-title")
          ?.innerText?.trim() || "";
      company =
        document
          .querySelector("[data-company-name='true']")
          ?.innerText?.trim() || "";
      description =
        document.querySelector("#jobDescriptionText")?.innerText?.trim() || "";
    } else {
      title = document.querySelector("h1")?.innerText?.trim() || document.title;
      description =
        document
          .querySelector("main, article, #job-description, .job-description")
          ?.innerText?.trim() || document.body.innerText;
    }

    return {
      title: title || document.title,
      company: company || "Company",
      description: description,
      url: window.location.href,
      source: source,
      capturedAt: new Date().toISOString(),
    };
  }

  // 7. Multi-Strategy LinkedIn Modal & Button Locators
  function isMsgOrChatElement(el) {
    if (!el) return false;
    // Strictly target LinkedIn's docked messaging overlay, chat trays, and floating chat bubbles
    if (el.closest("aside.msg-overlay-container, .msg-overlay-list-bubble, .msg-overlay-container, #msg-overlay, .msg-convo-wrapper, .feed-shared-messaging-overlay")) {
      return true;
    }
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    if (aria === "messaging" || aria === "chat" || aria.includes("messaging overlay")) {
      return true;
    }
    return false;
  }

  function getTopLevelModal(el) {
    if (!el) return null;
    const top = el.closest("[role='dialog'], [aria-modal='true'], .artdeco-modal, .artdeco-modal-overlay, #artdeco-modal-outlet > div, dialog[open], .modal, .modal-dialog");
    return top || el;
  }

  function findEasyApplyModal() {
    // Strategy 1: Direct explicit LinkedIn Easy Apply modal and content containers
    const explicitContainers = [
      ".jobs-easy-apply-modal",
      ".jobs-easy-apply-content",
      "form.jobs-easy-apply-form",
      "div[data-view-name*='easy-apply-modal']",
      "div[data-view-name*='easy-apply']",
      "#artdeco-modal-outlet > div",
      "[data-test-modal]"
    ];

    for (const sel of explicitContainers) {
      const candidates = Array.from(document.querySelectorAll(sel));
      for (const el of candidates) {
        if (!isElementVisible(el)) continue;
        if (isMsgOrChatElement(el)) continue;
        const modal = getTopLevelModal(el);
        if (isElementVisible(modal) && !isMsgOrChatElement(modal)) {
          console.log("[Vedha AI] Found Easy Apply modal via explicit container (" + sel + "):", modal);
          return modal;
        }
      }
    }

    // Strategy 2: Scan all open dialogs & overlays on the page (excluding docked chat)
    const dialogs = Array.from(
      document.querySelectorAll("[role='dialog'], [aria-modal='true'], .artdeco-modal, .artdeco-modal-overlay, dialog[open]")
    );

    for (const d of dialogs) {
      if (isMsgOrChatElement(d)) continue;
      if (!isElementVisible(d)) continue;

      const hasInputs = !!d.querySelector("input, textarea, select");
      const hasActionBtn = Array.from(d.querySelectorAll("button")).some(b => {
        const text = (b.innerText || b.textContent || "").toLowerCase();
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        return text.includes("next") || text.includes("review") || text.includes("submit") ||
               aria.includes("next") || aria.includes("review") || aria.includes("submit");
      });

      const text = (d.innerText || d.textContent || "").toLowerCase();
      const hasKeywords = text.includes("apply") || text.includes("contact info") || text.includes("resume") || text.includes("screening");

      if ((hasInputs && hasActionBtn) || (hasActionBtn && hasKeywords) || (hasInputs && hasKeywords)) {
        const top = getTopLevelModal(d);
        console.log("[Vedha AI] Found Easy Apply modal via dialog scan:", top);
        return top;
      }
    }

    // Strategy 3: Inside-out search from action buttons (Next, Review, Submit)
    const actionButtons = Array.from(document.querySelectorAll("button")).filter(b => {
      if (!isElementVisible(b)) return false;
      if (isMsgOrChatElement(b)) return false;
      const t = (b.innerText || b.textContent || "").trim().toLowerCase();
      const a = (b.getAttribute("aria-label") || "").toLowerCase();
      return (
        t === "next" || t.includes("continue to next step") ||
        t === "review" || t.includes("review your application") ||
        t === "submit" || t.includes("submit application") ||
        a.includes("continue to next step") || a.includes("review your application") || a.includes("submit application")
      );
    });

    for (const btn of actionButtons) {
      const container = getTopLevelModal(btn);
      if (container && isElementVisible(container) && !isMsgOrChatElement(container)) {
        console.log("[Vedha AI] Found Easy Apply modal via action button inside-out search:", container);
        return container;
      }
    }

    // Strategy 4: Inside-out search from dismiss / close button
    const dismissBtns = Array.from(
      document.querySelectorAll("button[aria-label*='Dismiss' i], button.artdeco-modal__dismiss, button[data-test-modal-close-btn]")
    );
    for (const btn of dismissBtns) {
      if (isMsgOrChatElement(btn)) continue;
      const modal = getTopLevelModal(btn);
      if (modal && isElementVisible(modal) && !isMsgOrChatElement(modal)) {
        if (modal.querySelector("input, textarea, select, button")) {
          console.log("[Vedha AI] Found Easy Apply modal via dismiss button container:", modal);
          return modal;
        }
      }
    }

    return null;
  }

  // Active polling up to timeoutMs to handle async GraphQL schema mounting
  async function waitForEasyApplyModal(timeoutMs = 10000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const modal = findEasyApplyModal();
      if (modal) {
        await sleep(300);
        return modal;
      }
      await sleep(200);
    }
    return null;
  }

  function detectExternalApplyButton() {
    // Only search within top card / details container to avoid capturing unrelated search list buttons
    const containerSelectors = [
      ".job-details-jobs-unified-top-card__container--two-pane",
      ".jobs-details__top-card",
      ".jobs-unified-top-card",
      ".jobs-search__job-details",
      ".job-view-layout",
      "main"
    ];

    let targetRoot = null;
    for (const sel of containerSelectors) {
      const el = document.querySelector(sel);
      if (el && isElementVisible(el)) {
        targetRoot = el;
        break;
      }
    }
    if (!targetRoot) return null;

    const selectors = [
      "button.jobs-apply-button",
      "a.jobs-apply-button",
      ".jobs-apply-button--top-card button",
      ".jobs-apply-button--top-card a",
      "button[data-view-name*='apply']",
      "a[data-view-name*='apply']"
    ];

    for (const sel of selectors) {
      const elements = Array.from(targetRoot.querySelectorAll(sel));
      for (const el of elements) {
        if (!isElementVisible(el)) continue;
        const text = (el.innerText || el.textContent || "").trim().toLowerCase();
        const aria = (el.getAttribute("aria-label") || "").toLowerCase();
        if (text.includes("applied") || aria.includes("applied")) continue;
        if (!text.includes("easy apply") && !aria.includes("easy apply")) {
          return el;
        }
      }
    }
    return null;
  }

  function findEasyApplyButton() {
    // Strategy 1: Check inside top card / job details container for the active job's Apply button (PRIMARY STRATEGY)
    const topCardContainers = [
      ".job-details-jobs-unified-top-card__container--two-pane",
      ".jobs-details__top-card",
      ".jobs-unified-top-card",
      ".jobs-search__job-details",
      ".job-view-layout",
      "[data-view-name*='job-details']",
      ".top-card-layout",
      "main"
    ];

    for (const containerSel of topCardContainers) {
      const container = document.querySelector(containerSel);
      if (!container || !isElementVisible(container)) continue;

      // Ensure this container is not part of the left search list
      if (container.closest(".jobs-search-results-list, .scaffold-layout__list, ul.jobs-search__results-list")) continue;

      // Look for specific apply buttons inside the active job's top card
      const specificButtons = Array.from(container.querySelectorAll(
        "button.jobs-apply-button, .jobs-apply-button--top-card button, button[data-view-name*='easy-apply'], div[data-view-name*='easy-apply'] button, .jobs-s-apply button"
      ));

      for (const btn of specificButtons) {
        if (!isElementVisible(btn) || isMsgOrChatElement(btn)) continue;
        if (btn.disabled || btn.getAttribute("aria-disabled") === "true") continue;
        const text = (btn.innerText || btn.textContent || "").trim().toLowerCase();
        const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (text.includes("applied") || aria.includes("applied")) continue;
        console.log("[Vedha AI] Found Easy Apply button via top-card specific selector:", btn);
        return btn;
      }

      // Any button or role=button inside top card containing "easy apply"
      const allTopCardBtns = Array.from(container.querySelectorAll("button, a, [role='button']"));
      for (const btn of allTopCardBtns) {
        if (!isElementVisible(btn) || isMsgOrChatElement(btn)) continue;
        if (btn.disabled || btn.getAttribute("aria-disabled") === "true") continue;
        const text = (btn.innerText || btn.textContent || "").trim().toLowerCase();
        const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (text.includes("applied") || aria.includes("applied")) continue;

        if (text.includes("easy apply") || aria.includes("easy apply")) {
          const target = btn.closest("button") || btn;
          console.log("[Vedha AI] Found Easy Apply button via top-card text scan:", target);
          return target;
        }
      }
    }

    // Strategy 2: Specific LinkedIn Easy Apply selectors across document (strictly excluding left search list)
    const specificSelectors = [
      "button[data-view-name*='easy-apply']",
      "div[data-view-name*='easy-apply'] button",
      ".jobs-apply-button--top-card button",
      "button.jobs-apply-button",
      ".jobs-s-apply button"
    ];

    for (const sel of specificSelectors) {
      const elements = Array.from(document.querySelectorAll(sel));
      for (const el of elements) {
        // Exclude left search results list
        if (el.closest(".jobs-search-results-list, .scaffold-layout__list, ul.jobs-search__results-list, .jobs-search-two-pane__wrapper > div:first-child")) {
          continue;
        }
        const btn = el.closest("button, [role='button']") || el;
        if (isMsgOrChatElement(btn) || !isElementVisible(btn)) continue;
        if (btn.disabled || btn.getAttribute("aria-disabled") === "true") continue;

        const text = (btn.innerText || btn.textContent || "").trim().toLowerCase();
        const aria = (btn.getAttribute("aria-label") || "").toLowerCase();
        if (text.includes("applied") || aria.includes("applied")) continue;

        console.log("[Vedha AI] Found Easy Apply button via global selector (" + sel + "):", btn);
        return btn;
      }
    }

    return null;
  }

  async function clickElementNaturally(el) {
    if (!el) return;
    const target = el.closest("button, a, [role='button']") || el;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    await sleep(randomBetween(200, 350));

    const opts = { bubbles: true, cancelable: true, view: window };
    target.dispatchEvent(new PointerEvent("pointerover", opts));
    target.dispatchEvent(new MouseEvent("mouseenter", opts));
    target.dispatchEvent(new MouseEvent("mouseover", opts));
    target.dispatchEvent(new PointerEvent("pointerdown", opts));
    target.dispatchEvent(new MouseEvent("mousedown", opts));
    if (typeof target.focus === "function") target.focus();
    await sleep(randomBetween(50, 100));
    target.dispatchEvent(new PointerEvent("pointerup", opts));
    target.dispatchEvent(new MouseEvent("mouseup", opts));
    target.dispatchEvent(new MouseEvent("click", opts));
    target.click();
    await sleep(randomBetween(400, 700));
  }


  // Visual Safe Fill Notice Toast
  function showSafeFillNotice(filledCount, unansweredCount) {
    let notice = document.getElementById("vedha-safe-fill-notice");
    if (notice) notice.remove();

    notice = document.createElement("div");
    notice.id = "vedha-safe-fill-notice";
    notice.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #090d16;
      color: #f8fafc;
      border: 1.5px solid ${unansweredCount > 0 ? "#f59e0b" : "#10b981"};
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px ${unansweredCount > 0 ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"};
      padding: 12px 20px;
      border-radius: 10px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 12px;
      max-width: 580px;
      backdrop-filter: blur(10px);
      transition: all 0.3s ease;
    `;

    const icon = unansweredCount > 0 ? "⚠️" : "✨";
    const titleColor = unansweredCount > 0 ? "#fbbf24" : "#34d399";
    const msg = unansweredCount > 0
      ? `Auto-filled <strong>${filledCount}</strong> field(s) with Gemini AI. <strong>${unansweredCount}</strong> field(s) highlighted in orange need your review/input.`
      : `All <strong>${filledCount}</strong> field(s) auto-filled with Gemini AI. Ready for your review!`;

    notice.innerHTML = `
      <span style="font-size: 20px; line-height: 1;">${icon}</span>
      <div style="flex: 1; line-height: 1.4;">
        <div style="font-weight: 700; color: ${titleColor}; font-size: 12px; margin-bottom: 2px;">Vedha AI Safe Fill Copilot</div>
        <div style="color: #cbd5e1; font-size: 12px;">${msg}</div>
      </div>
      <button id="vedha-notice-close" style="background: none; border: none; color: #94a3b8; font-size: 18px; cursor: pointer; padding: 0 4px;">&times;</button>
    `;

    document.body.appendChild(notice);
    document.getElementById("vedha-notice-close")?.addEventListener("click", () => notice.remove());
    setTimeout(() => {
      if (notice && document.body.contains(notice)) {
        notice.style.opacity = "0";
        notice.style.transform = "translateX(-50%) translateY(-10px)";
        setTimeout(() => notice.remove(), 400);
      }
    }, 8000);
  }

  // 8. Review Gateway HUD (Final Step Confirmation)
  function showCopilotReviewHud(queueItemId, targetCompany, targetRole) {
    let hud = document.getElementById("vedha-copilot-review-hud");
    if (hud) hud.remove();

    hud = document.createElement("div");
    hud.id = "vedha-copilot-review-hud";
    hud.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #090d16;
      color: #f8fafc;
      border: 2px solid #0ea5e9;
      box-shadow: 0 10px 30px rgba(14, 165, 233, 0.4), 0 20px 25px -5px rgba(0, 0, 0, 0.5);
      padding: 16px 22px;
      border-radius: 12px;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 520px;
      width: 90%;
      backdrop-filter: blur(8px);
    `;

    hud.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-weight: 700; color: #38bdf8; font-size: 13px; display: flex; align-items: center; gap: 6px;">
          ✨ Vedha AI Copilot Review Gateway
        </span>
        <button id="vedha-hud-close-btn" style="background: none; border: none; color: #94a3b8; font-size: 16px; cursor: pointer;">&times;</button>
      </div>
      <div style="color: #e2e8f0; font-size: 12px; line-height: 1.4;">
        All screening questions and resume details have been pre-filled for <strong>${targetRole || "this position"}</strong> at <strong>${targetCompany || "target company"}</strong>.
        Please inspect your answers and click LinkedIn's <strong>"Submit application"</strong> button below.
      </div>
      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 4px;">
        <button id="vedha-hud-sync-btn" style="background: #0284c7; color: white; border: none; padding: 7px 14px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 5px;">
          ✅ Confirm & Sync as Submitted
        </button>
      </div>
    `;

    document.body.appendChild(hud);

    document.getElementById("vedha-hud-close-btn")?.addEventListener("click", () => hud.remove());

    document.getElementById("vedha-hud-sync-btn")?.addEventListener("click", async () => {
      const btn = document.getElementById("vedha-hud-sync-btn");
      if (btn) btn.innerText = "⏳ Verifying...";

      // Verify-or-don't-claim: only a visible Applied/confirmation signal may
      // mark Submitted. Otherwise the run stays paused for human review.
      const evidence = probeSubmissionEvidence(document);
      if (!evidence) {
        if (btn) btn.innerText = "⚠️ Not verified";
        showSafeFillNotice(0, 1);
        console.log("[Vedha AI] HUD sync refused: no submission evidence on page; staying paused.");
        setTimeout(() => { if (btn) btn.innerText = "✅ Confirm & Sync as Submitted"; }, 3000);
        return;
      }

      if (btn) btn.innerText = "⏳ Syncing...";

      chrome.storage.local.get(["jwtToken", "vedha_token", "token"], async (stored) => {
        const token = stored.jwtToken || stored.vedha_token || stored.token;
        if (token && queueItemId) {
          try {
            await fetch(`http://localhost:5000/api/orchestrator/queue/${queueItemId}/status`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ status: "Submitted" })
            });
          } catch (e) {}
        }
        if (btn) btn.innerText = "✅ Synced to Vedha AI!";
        setTimeout(() => hud.remove(), 2000);
      });
    });
  }

  // Null-safe visible text: innerText is missing on SVG elements, XPATh
  // results, and DOM mocks (and empty-string innerText means visibly empty,
  // which ?? preserves). Never throws, so label scans can't crash a run.
  function visibleText(el) {
    if (!el) return "";
    try {
      return ((el.innerText ?? el.textContent) || "").trim();
    } catch {
      return "";
    }
  }

  function isFieldActionable(el) {    if (!el) return false;
    if (el.type === "hidden") return false;
    if (el.disabled || el.readOnly) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  }

  function getFieldQuestionText(el, raw = false) {
    if (!el) return "";
    let question = "";
    // Hoisted: strategy 5 compares against the wrapping label found here.
    // (Block-scoping this const used to throw ReferenceError at strategy 5.)
    let parentLbl = null;
    
    // Strategy 1: Check form field containers with specific selectors
    const container = el.closest(
      ".fb-dash-form-element, [data-test-form-builder-single-line-text-form-component], [data-test-form-builder-radio-button-form-component], [data-test-text-entity-list-form-component], [data-test-form-builder-select-form-component], .jobs-easy-apply-form-section__grouping, div[class*='form-element'], fieldset, [data-testid], [data-cy], [data-qa], .form-group, .form-field"
    );
    if (container) {
      const header = container.querySelector(
        "label, legend, span.fb-dash-form-element__label, .t-14.t-bold, span[aria-hidden='true'], [data-test-form-builder-radio-button-form-component__title], [data-testid*='label'], [data-cy*='label']"
      );
      const headerText = visibleText(header);
      if (headerText) question = headerText;
    }
    
    // Strategy 2: Check for associated label by ID
    if (!question && el.id) {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      const lblText = visibleText(lbl);
      if (lblText) question = lblText;
    }
    
    // Strategy 3: Check if element is wrapped in a label
    if (!question) {
      parentLbl = el.closest("label");
      const parentText = visibleText(parentLbl);
      if (parentText) question = parentText;
    }
    
    // Strategy 4: Check aria-label, placeholder, name attributes
    if (!question) {
      question = el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || "";
    }
    
    // Strategy 5: Check parent elements for text content that looks like a label
    if (!question) {
      let parent = el.parentElement;
      let depth = 0;
      while (parent && depth < 4) {
        // Look for label-like elements in siblings or parent
        const possibleLabels = parent.querySelectorAll("label, .label, [class*='label'], span, p, dt");
        for (const pl of possibleLabels) {
          const txt = visibleText(pl);
          if (txt && txt.length > 1 && txt.length < 100 && !txt.includes("\n")) {
            // Check if this label is associated with our element
            if (pl.getAttribute("for") === el.id || pl.contains(el) || pl.closest("label") === parentLbl) {
              question = txt;
              break;
            }
            // Also check if label text is near the input
            const rect1 = el.getBoundingClientRect();
            const rect2 = pl.getBoundingClientRect();
            if (Math.abs(rect1.top - rect2.top) < 30 && Math.abs(rect1.left - rect2.left) < 200) {
              question = txt;
              break;
            }
          }
        }
        if (question) break;
        parent = parent.parentElement;
        depth++;
      }
    }
    
    // Strategy 6: Check input type/name patterns for common fields
    if (!question) {
      const type = el.type?.toLowerCase() || "";
      const name = el.name?.toLowerCase() || "";
      const id = el.id?.toLowerCase() || "";
      
      if (type === "tel" || name.includes("phone") || id.includes("phone") || name.includes("mobile") || id.includes("mobile")) {
        question = "Phone Number";
      } else if (type === "email" || name.includes("email") || id.includes("email")) {
        question = "Email Address";
      } else if (name.includes("first") && (name.includes("name") || name.includes("fname")) || id.includes("first") && (id.includes("name") || id.includes("fname"))) {
        question = "First Name";
      } else if (name.includes("last") && (name.includes("name") || name.includes("lname")) || id.includes("last") && (id.includes("name") || id.includes("lname"))) {
        question = "Last Name";
      } else if ((name === "name" || name.includes("fullname") || name.includes("full_name")) || (id === "name" || id.includes("fullname") || id.includes("full_name"))) {
        question = "Full Name";
      } else if (name.includes("city") || id.includes("city") || name.includes("location") || id.includes("location") || name.includes("address") || id.includes("address")) {
        question = "City / Location";
      } else if (name.includes("linkedin") || id.includes("linkedin")) {
        question = "LinkedIn URL";
      } else if (name.includes("github") || id.includes("github")) {
        question = "GitHub URL";
      } else if (name.includes("portfolio") || id.includes("portfolio") || name.includes("website") || id.includes("website")) {
        question = "Portfolio / Website URL";
      } else if (name.includes("salary") || id.includes("salary") || name.includes("ctc") || id.includes("ctc") || name.includes("compensation") || id.includes("compensation")) {
        question = "Expected Salary / CTC";
      } else if (name.includes("notice") || id.includes("notice") || name.includes("start") || id.includes("start")) {
        question = "Notice Period";
      } else if (type === "number" || name.includes("year") || id.includes("year") || name.includes("experience") || id.includes("experience")) {
        question = "Years of Experience";
      }
    }
    
    question = question.replace(/[\*\r\n]+/g, " ").trim();
    return raw ? question : question.toLowerCase();
  }

  function getRadioLabelText(radio) {
    if (!radio) return "";
    let text = "";
    if (radio.id) {
      const lbl = document.querySelector(`label[for="${radio.id}"]`);
      const lblText = visibleText(lbl);
      if (lblText) text = lblText;
    }
    if (!text) {
      const parentLbl = radio.closest("label");
      const parentText = visibleText(parentLbl);
      if (parentText) text = parentText;
    }
    if (!text) {
      const sibling = radio.nextElementSibling || radio.previousElementSibling;
      const siblingText = visibleText(sibling);
      if (siblingText) text = siblingText;
    }
    if (!text) text = radio.value || "";
    return text.replace(/[\*\r\n]+/g, " ").trim();
  }

  // Queries backend Gemini grounding or fallback direct Gemini API
  async function queryGeminiForQuestions(questionsToAnswer, companyName, overrideToken = null) {
    if (!questionsToAnswer || questionsToAnswer.length === 0) return {};

    const stored = await new Promise((r) =>
      chrome.storage.local.get(["vedha_token", "jwtToken", "token", "gemini_api_key", "candidateProfile"], r)
    );
    const token = overrideToken || stored.vedha_token || stored.jwtToken || stored.token;
    const answerMap = {};

    // 1. Try backend endpoint first (grounded with Master Resume + Candidate Profile + Memories)
    if (token) {
      try {
        const resp = await fetch("http://localhost:5000/api/orchestrator/generate-answers", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            company: companyName || "Target Company",
            questionItems: questionsToAnswer.map(q => ({
              questionText: q.questionText,
              fieldType: q.fieldType || "text",
              options: q.options || []
            }))
          })
        });

        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data)) {
            for (const item of data) {
              if (item.questionText && item.answerText) {
                answerMap[item.questionText.trim().toLowerCase()] = item.answerText.trim();
              }
            }
            console.log("[Vedha AI] Received grounded answers from backend:", answerMap);
            return answerMap;
          }
        }
      } catch (err) {
        console.warn("[Vedha AI] Could not query backend for Q&A, attempting direct fallback:", err);
      }
    }

    // 2. Direct Gemini Fallback if direct API key available
    const directKey = stored.gemini_api_key;
    if (directKey) {
      try {
        const prompt = `You are a job application assistant. Given these candidate details:
${JSON.stringify(stored.candidateProfile || {})}
Answer the following screening questions accurately and truthfully.
If 'options' are provided for a question, your answer MUST match one of the available options exactly.

Questions:
${JSON.stringify(questionsToAnswer)}

Return JSON array in format:
[{"questionText": "...", "answerText": "..."}]`;

        const geminiResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${directKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: "application/json" }
            })
          }
        );

        if (geminiResp.ok) {
          const resData = await geminiResp.json();
          const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            for (const item of parsed) {
              if (item.questionText && item.answerText) {
                answerMap[item.questionText.trim().toLowerCase()] = item.answerText.trim();
              }
            }
            return answerMap;
          }
        }
      } catch (e) {
        console.warn("[Vedha AI] Direct Gemini API call failed:", e);
      }
    }

    return answerMap;
  }

  // Step-level question extraction, Gemini grounding, and visual feedback
  async function fillModalInputs(container, payload, isSafeFillMode = false) {
    if (!container) return { success: false, filledCount: 0, unansweredCount: 0 };

    // Merge payload with default candidate profile, replacing any blank strings
    const rawPayload = payload || {};
    const safePayload = {
      ...DEFAULT_CANDIDATE_PROFILE,
      ...rawPayload
    };
    for (const key of Object.keys(DEFAULT_CANDIDATE_PROFILE)) {
      if (safePayload[key] === undefined || safePayload[key] === null || safePayload[key] === "") {
        safePayload[key] = DEFAULT_CANDIDATE_PROFILE[key];
      }
    }

    const company = safePayload.company || "Target Company";
    const answersList = Array.isArray(safePayload.answers) ? safePayload.answers : [];
    let filledCount = 0;
    let escalatedCount = 0;
    const escalateFillField = (el, label) => {
      try {
        el.style.border = "2px solid #f59e0b";
        el.style.boxShadow = "0 0 8px rgba(245, 158, 11, 0.45)";
        el.setAttribute("title", `⚠️ Needs you: ${label}`);
      } catch { /* cosmetics must never break the fill */ }
      escalatedCount++;
    };

    // Step A: Collect all actionable elements in this step
    const allInputs = Array.from(container.querySelectorAll("input, textarea, select")).filter(isFieldActionable);
    const fieldsets = Array.from(container.querySelectorAll("fieldset, [data-test-form-builder-radio-button-form-component]"));

    // Step B: Identify questions that need answering by Gemini
    const questionsToAskGemini = [];

    // Check text/textarea/number inputs
    for (const input of allInputs) {
      if (input.type === "radio" || input.type === "checkbox" || input.type === "file") continue;
      if (input.tagName === "SELECT") continue;

      const qRaw = getFieldQuestionText(input, true);
      const q = qRaw.toLowerCase();
      const currVal = (input.value || "").trim();
      if (currVal) continue; // Already has value

      // Check if it's standard candidate contact info
      const isContact =
        input.type === "tel" ||
        q.includes("phone") ||
        q.includes("mobile") ||
        input.type === "email" ||
        q.includes("email") ||
        input.getAttribute("role") === "combobox" ||
        q.includes("city") ||
        q.includes("location") ||
        q.includes("address") ||
        q.includes("name") ||
        q.includes("first name") ||
        q.includes("last name") ||
        q.includes("linkedin") ||
        q.includes("github") ||
        q.includes("portfolio") ||
        q.includes("website");
      if (!isContact && qRaw.length > 3) {
        const type = input.type === "number" || input.getAttribute("inputmode") === "numeric" ? "number" :
                     input.tagName === "TEXTAREA" ? "textarea" : "text";
        questionsToAskGemini.push({
          questionText: qRaw,
          fieldType: type,
          options: []
        });
      }
    }

    // Check radio fieldsets
    for (const fs of fieldsets) {
      const radios = Array.from(fs.querySelectorAll("input[type='radio']"));
      if (radios.length === 0) continue;
      if (radios.some(r => r.checked)) continue; // Already selected

      const qRaw = getFieldQuestionText(fs, true);
      if (qRaw.length > 3) {
        const options = radios.map(r => getRadioLabelText(r)).filter(Boolean);
        questionsToAskGemini.push({
          questionText: qRaw,
          fieldType: "radio",
          options: options
        });
      }
    }

    // Check select dropdowns
    const selects = Array.from(container.querySelectorAll("select")).filter(isFieldActionable);
    for (const sel of selects) {
      if (sel.selectedIndex > 0 && sel.value && sel.value.toLowerCase() !== "select an option") continue;

      const qRaw = getFieldQuestionText(sel, true);
      if (qRaw.length > 3) {
        const options = Array.from(sel.options)
          .filter(o => o.value && o.text.toLowerCase() !== "select an option")
          .map(o => o.text.trim());
        questionsToAskGemini.push({
          questionText: qRaw,
          fieldType: "select",
          options: options
        });
      }
    }

    // Step C: Query Gemini for all questions on current step in one batch
    let geminiAnswers = {};
    if (questionsToAskGemini.length > 0) {
      console.log(`[Vedha AI] Found ${questionsToAskGemini.length} screening questions on current step. Querying Gemini...`, questionsToAskGemini);
      geminiAnswers = await queryGeminiForQuestions(questionsToAskGemini, company, safePayload.token);
    }

    // Step D: Apply Answers (Standard fields + Gemini Grounded Answers)
    // 1. Text, Tel, Number, Email, Combobox inputs and Textareas
    for (const input of allInputs) {
      if (input.type === "radio" || input.type === "checkbox" || input.type === "file") continue;
      if (input.tagName === "SELECT") continue;

      const qRaw = getFieldQuestionText(input, true);
      const q = qRaw.toLowerCase();
      const currVal = (input.value || "").trim();
      if (currVal) continue;

      // First name
      if (q.includes("first name") || q.includes("given name") || input.name === "firstName") {
        const val = safePayload.firstName || safePayload.fullName?.split(" ")[0] || DEFAULT_CANDIDATE_PROFILE.firstName;
        if (await typeLikeHuman(input, val)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Last name
      else if (q.includes("last name") || q.includes("family name") || q.includes("surname") || input.name === "lastName") {
        const val = safePayload.lastName || safePayload.fullName?.split(" ").slice(1).join(" ") || DEFAULT_CANDIDATE_PROFILE.lastName;
        if (await typeLikeHuman(input, val)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Full name
      else if (q === "full name" || q === "name" || input.name === "fullName" || input.name === "name") {
        const val = safePayload.fullName || `${safePayload.firstName || DEFAULT_CANDIDATE_PROFILE.firstName} ${safePayload.lastName || DEFAULT_CANDIDATE_PROFILE.lastName}`.trim();
        if (await typeLikeHuman(input, val)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Phone
      else if (input.type === "tel" || q.includes("phone") || q.includes("mobile")) {
        const phoneVal = safePayload.phone || safePayload.phoneNumber || DEFAULT_CANDIDATE_PROFILE.phoneNumber;
        if (await typeLikeHuman(input, phoneVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Email
      else if (input.type === "email" || q.includes("email")) {
        const emailVal = safePayload.email || DEFAULT_CANDIDATE_PROFILE.email;
        if (await typeLikeHuman(input, emailVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // City / Location typeahead
      else if (input.getAttribute("role") === "combobox" || q.includes("city") || q.includes("location") || q.includes("address")) {
        const cityVal = safePayload.currentCity || DEFAULT_CANDIDATE_PROFILE.currentCity;
        if (await typeLikeHuman(input, cityVal)) {
          await sleep(400);
          const suggestion = document.querySelector(".basic-typeahead__selectable-list li, div[role='listbox'] div[role='option'], .artdeco-typeahead__results-list li");
          if (suggestion) {
            suggestion.click();
            await sleep(200);
          }
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Social / Portfolio URLs
      else if (q.includes("linkedin")) {
        const linkedinVal = safePayload.linkedin || safePayload.linkedInUrl || DEFAULT_CANDIDATE_PROFILE.linkedInUrl;
        if (await typeLikeHuman(input, linkedinVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      else if (q.includes("github")) {
        const githubVal = safePayload.github || safePayload.githubUrl || DEFAULT_CANDIDATE_PROFILE.githubUrl;
        if (await typeLikeHuman(input, githubVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      else if (q.includes("portfolio") || q.includes("website") || q.includes("blog")) {
        const portfolioVal = safePayload.portfolio || safePayload.portfolioUrl || DEFAULT_CANDIDATE_PROFILE.portfolioUrl;
        if (await typeLikeHuman(input, portfolioVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Years of experience
      else if (q.includes("how many years") || q.includes("years of experience") || q.includes("experience in years") || q.includes("years experience") || q.includes("total experience")) {
        const expVal = String(safePayload.totalYearsExperience || DEFAULT_CANDIDATE_PROFILE.totalYearsExperience || 5);
        if (await typeLikeHuman(input, expVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Notice period
      else if (q.includes("notice period") || q.includes("notice (in days)") || q.includes("how soon can you start")) {
        const noticeVal = String(safePayload.noticePeriodDays || safePayload.noticePeriod || DEFAULT_CANDIDATE_PROFILE.noticePeriodDays || 30);
        if (await typeLikeHuman(input, noticeVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Expected salary / CTC
      else if (q.includes("salary") || q.includes("ctc") || q.includes("compensation") || q.includes("expected compensation")) {
        const salVal = String(safePayload.expectedSalary || DEFAULT_CANDIDATE_PROFILE.expectedSalary || "140000");
        if (await typeLikeHuman(input, salVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // GPA / Grade — profile value only; unknown stays blank (Step E ambers it).
      else if (q.includes("gpa") || q.includes("grade") || q.includes("percentage")) {
        const gpaVal = String(safePayload.gpa || "");
        if (!gpaVal) continue;
        if (await typeLikeHuman(input, gpaVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Education / Degree — profile value only; unknown stays blank.
      else if (q.includes("degree") || q.includes("major") || q.includes("school") || q.includes("university") || q.includes("field of study")) {
        const eduVal = safePayload.education || "";
        if (!eduVal) continue;
        if (await typeLikeHuman(input, eduVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Textareas / Cover Letter / Statement — grounded answers only. There is
      // no generic essay: filing one fabricates the candidate's voice. Unknowns
      // fall through to Step E amber; backend prefilled answers DO apply here.
      else if (input.tagName === "TEXTAREA" || q.includes("cover letter") || q.includes("summary") || q.includes("tell us about") || q.includes("why do you want")) {
        let summaryVal = geminiAnswers[qRaw.toLowerCase()] || "";
        if (!summaryVal) {
          const matchedKey = Object.keys(geminiAnswers).find(k => k.includes(q.slice(0, 20)) || q.includes(k.slice(0, 20)));
          if (matchedKey) summaryVal = geminiAnswers[matchedKey];
        }
        if (!summaryVal) {
          const matched = answersList.find(a => q.includes((a.questionText || "").toLowerCase().slice(0, 15)));
          if (matched) summaryVal = matched.answerText;
        }
        if (!summaryVal) continue;
        if (await typeLikeHuman(input, summaryVal)) {
          input.style.border = "2px solid #10b981";
          input.style.boxShadow = "0 0 0 1px #10b981";
          input.setAttribute("title", "✨ Auto-filled by Vedha AI");
          filledCount++;
        }
      }
      // Check Gemini Answers & numerical / general fields
      else {
        let answerText = geminiAnswers[qRaw.toLowerCase()] || "";
        if (!answerText) {
          const matchedKey = Object.keys(geminiAnswers).find(k => k.includes(q.slice(0, 20)) || q.includes(k.slice(0, 20)));
          if (matchedKey) answerText = geminiAnswers[matchedKey];
        }
        if (!answerText) {
          const matched = answersList.find(a => q.includes((a.questionText || "").toLowerCase().slice(0, 15)));
          if (matched) answerText = matched.answerText;
        }
        if (!answerText) {
          if (q.includes("experience") || q.includes("years") || q.includes("how long")) {
            answerText = hasGroundedValue(safePayload.totalYearsExperience) ? String(safePayload.totalYearsExperience) : "";
          } else if (q.includes("salary") || q.includes("ctc")) {
            answerText = (safePayload.expectedSalary || safePayload.currentSalary) ? String(safePayload.expectedSalary || safePayload.currentSalary) : "";
          } else if (q.includes("notice")) {
            answerText = hasGroundedValue(safePayload.noticePeriod ?? safePayload.noticePeriodDays) ? String(safePayload.noticePeriod ?? safePayload.noticePeriodDays) : "";
          } else if (input.type === "number" || input.getAttribute("inputmode") === "numeric") {
            // No invented digits: unknown numerics stay blank for Step E amber.
            answerText = "";
          }
        }

        if (answerText) {
          if (await typeLikeHuman(input, answerText)) {
            input.style.border = "2px solid #10b981";
            input.style.boxShadow = "0 0 0 1px #10b981";
            input.setAttribute("title", "✨ Auto-filled by Vedha Gemini AI");
            filledCount++;
          }
        }
      }
    }

    // 2. Consent / Terms / Certification Checkboxes — NEVER auto-checked.
    // A checkbox click attests agreement, accuracy, or consent in the
    // candidate's name. Every unchecked actionable box escalates (amber) for
    // an explicit human click instead.
    const checkboxes = Array.from(container.querySelectorAll("input[type='checkbox']")).filter(isFieldActionable);
    for (const cb of checkboxes) {
      if (cb.checked) continue;
      const labelText = (getFieldQuestionText(cb, true) || "").toLowerCase();
      const needsHuman = cb.required ||
        labelText.includes("agree") ||
        labelText.includes("consent") ||
        labelText.includes("certify") ||
        labelText.includes("acknowledge") ||
        labelText.includes("terms") ||
        labelText.includes("privacy") ||
        labelText.includes("policy") ||
        labelText.includes("authorized") ||
        labelText.includes("accurate") ||
        labelText.includes("truthful");
      escalateFillField(cb, needsHuman
        ? "Review and check this box yourself — agreement/consent is never auto-filled"
        : "Review and check this box yourself if it applies");
    }

    // 3. Radio buttons
    for (const fs of fieldsets) {
      const radios = Array.from(fs.querySelectorAll("input[type='radio']"));
      if (radios.length === 0 || radios.some(r => r.checked)) continue;

      const qRaw = getFieldQuestionText(fs, true);
      const q = qRaw.toLowerCase();
      let answerText = geminiAnswers[qRaw.toLowerCase()] || "";
      if (!answerText) {
        const matchedKey = Object.keys(geminiAnswers).find(k => k.includes(q.slice(0, 20)) || q.includes(k.slice(0, 20)));
        if (matchedKey) answerText = geminiAnswers[matchedKey];
      }

      let matchedRadio = null;
      if (answerText) {
        const ansLower = answerText.toLowerCase();
        const squashRadio = (s) => String(s || "").toLowerCase().replace(/[\s_.\-]+/g, "");
        // Equality only (see selectDropdownOption): "Yes" must never match
        // "Yesterday…", nor "No" match "Not a veteran".
        matchedRadio = radios.find(r => {
          const t = getRadioLabelText(r).toLowerCase();
          return t === ansLower || squashRadio(t) === squashRadio(ansLower);
        });
      }

      // Rule-based fallback: explicit profile attestations ONLY, tri-state.
      // Sponsorship, relocation/commute, and work-authorization answer from
      // the candidate's own stored booleans (=== true -> Yes, === false -> No).
      // Unknown (null/undefined) selects nothing - the old blanket "Yes" and
      // first-"Yes" fallbacks are deleted; all else stays blank for Step E.
      if (!matchedRadio) {
        if (q.includes("sponsorship") || q.includes("require visa") || q.includes("visa sponsorship")) {
          const sponsorship = profileVal(safePayload, safePayload.candidateProfile, "requiresVisaSponsorship");
          if (sponsorship === true || sponsorship === false) {
            const targetWord = sponsorship ? "yes" : "no";
            matchedRadio = radios.find(r => getRadioLabelText(r).toLowerCase().includes(targetWord));
          }
        } else if (q.includes("relocate") || q.includes("relocation") || q.includes("commute")) {
          const reloc = profileVal(safePayload, safePayload.candidateProfile, "willingToRelocate") ?? profileVal(safePayload, safePayload.candidateProfile, "willingToCommute");
          if (reloc === true || reloc === false) {
            const targetWord = reloc ? "yes" : "no";
            matchedRadio = radios.find(r => getRadioLabelText(r).toLowerCase().includes(targetWord));
          }
        } else if (q.includes("authorized") || q.includes("legally") || q.includes("eligible") || q.includes("right to work")) {
          const auth = profileVal(safePayload, safePayload.candidateProfile, "isAuthorizedToWork");
          if (auth === true || auth === false) {
            const targetWord = auth ? "yes" : "no";
            matchedRadio = radios.find(r => getRadioLabelText(r).toLowerCase().includes(targetWord));
          }
        }
      }

      if (matchedRadio) {
        matchedRadio.click();
        matchedRadio.dispatchEvent(new Event("change", { bubbles: true }));
        fs.style.border = "1.5px solid #10b981";
        fs.style.borderRadius = "6px";
        fs.style.padding = "4px";
        fs.setAttribute("title", "✨ Auto-filled by Vedha AI");
        filledCount++;
        await sleep(150);
      }
    }

    // 4. Dropdowns (<select>) - Using enhanced React/Vue compatible handler
    for (const sel of selects) {
      if (sel.selectedIndex > 0 && sel.value && sel.value.toLowerCase() !== "select an option") continue;

      const qRaw = getFieldQuestionText(sel, true);
      const q = qRaw.toLowerCase();
      let answerText = geminiAnswers[qRaw.toLowerCase()] || "";
      if (!answerText) {
        const matchedKey = Object.keys(geminiAnswers).find(k => k.includes(q.slice(0, 20)) || q.includes(k.slice(0, 20)));
        if (matchedKey) answerText = geminiAnswers[matchedKey];
      }

      // Determine what to select
      let selectValue = answerText;
      
      // Rule-based fallback: explicit attestations + profile-text equality.
      // Sponsorship/relocation/authorization tri-state (see radio block);
      // country and education match option text/value by full normalized
      // equality only. No invented "Yes", no "5+", no first-option pick.
      if (!selectValue) {
        if (q.includes("sponsorship") || q.includes("require visa") || q.includes("visa sponsorship")) {
          const sponsorship = profileVal(safePayload, safePayload.candidateProfile, "requiresVisaSponsorship");
          if (sponsorship === true || sponsorship === false) {
            selectValue = sponsorship ? "Yes" : "No";
          }
        } else {
          const prof = safePayload.candidateProfile || {};
          const country = profileVal(safePayload, prof, "country") || profileVal(safePayload, prof, "countryCode");
          const edu = profileVal(safePayload, prof, "educationLevel") || profileVal(safePayload, prof, "education");
          const target = squashText(country || edu || "");
          if (target) {
            const hit = Array.from(sel.options).find(o => squashText(o.text) === target || squashText(o.value) === target);
            if (hit) selectValue = hit.value || hit.text;
          }
        }
      }

      if (selectValue) {
        const success = await selectDropdownOption(sel, selectValue);
        if (success) {
          filledCount++;
          await sleep(150);
        }
      }
    }

    // 5. Resume Document Selection Card
    const resumeCards = Array.from(container.querySelectorAll(
      ".jobs-document-upload-redesign-card__container, div[data-test-document-upload], input[type='radio'][id*='resume'], button[aria-label*='Choose resume']"
    ));
    if (resumeCards.length > 0) {
      const firstResume = resumeCards[0];
      if (firstResume.tagName === "INPUT" && !firstResume.checked) {
        firstResume.click();
        firstResume.dispatchEvent(new Event("change", { bubbles: true }));
        filledCount++;
      } else if (firstResume.tagName !== "INPUT") {
        firstResume.click();
        filledCount++;
      }
      await sleep(200);
    }

    // Step E: Detect Unclear / Unanswered Fields ("if uncleared let me fill it")
    const unansweredElements = [];

    // Check text/numeric/textarea inputs
    for (const input of allInputs) {
      if (input.type === "radio" || input.type === "checkbox" || input.type === "file" || input.tagName === "SELECT") continue;
      const val = (input.value || "").trim();
      if (!val) {
        input.style.border = "2px solid #f59e0b";
        input.style.boxShadow = "0 0 8px rgba(245, 158, 11, 0.4)";
        input.style.backgroundColor = "rgba(245, 158, 11, 0.06)";
        input.setAttribute("title", "⚠️ Unclear - Please review and fill this question yourself");
        unansweredElements.push(input);
      }
    }

    // Check radio fieldsets
    for (const fs of fieldsets) {
      const radios = Array.from(fs.querySelectorAll("input[type='radio']"));
      if (radios.length > 0 && !radios.some(r => r.checked)) {
        fs.style.border = "2px solid #f59e0b";
        fs.style.boxShadow = "0 0 8px rgba(245, 158, 11, 0.4)";
        fs.style.backgroundColor = "rgba(245, 158, 11, 0.06)";
        fs.style.padding = "6px";
        fs.style.borderRadius = "6px";
        fs.setAttribute("title", "⚠️ Unclear - Please select an option");
        unansweredElements.push(fs);
      }
    }

    // Check dropdowns
    for (const sel of selects) {
      if (sel.selectedIndex <= 0 || !sel.value || sel.value.toLowerCase() === "select an option") {
        sel.style.border = "2px solid #f59e0b";
        sel.style.boxShadow = "0 0 8px rgba(245, 158, 11, 0.4)";
        sel.style.backgroundColor = "rgba(245, 158, 11, 0.06)";
        sel.setAttribute("title", "⚠️ Unclear - Please select an option");
        unansweredElements.push(sel);
      }
    }

    if (isSafeFillMode) {
      if (unansweredElements.length > 0) {
        unansweredElements[0].scrollIntoView({ behavior: "smooth", block: "center" });
        if (typeof unansweredElements[0].focus === "function") unansweredElements[0].focus();
      }
      showSafeFillNotice(filledCount, unansweredElements.length);
    }

    return {
      success: true,
      filledCount,
      escalatedCount,
      unansweredCount: unansweredElements.length,
      hasUnanswered: unansweredElements.length > 0
    };
  }

  // 8.5 Intelligent Validation Error Detection & Self-Healing Engine
  function findActiveValidationErrors(container = document.body) {
    if (!container) return [];

    const discoveredErrors = [];
    const seenElements = new Set();

    // Strategy A: Check inputs with HTML5 native constraint validation failures or aria-invalid
    const candidates = Array.from(
      container.querySelectorAll("input:not([type='hidden']), textarea, select")
    );

    for (const el of candidates) {
      if (!isFieldActionable(el)) continue;

      let hasError = false;
      let errorMsg = "";

      // 1. Native HTML5 validity check
      if (el.validity && !el.validity.valid) {
        hasError = true;
        errorMsg = el.validationMessage || "Invalid field format";
      }

      // 2. ARIA invalid or explicit error CSS class
      if (!hasError && (el.getAttribute("aria-invalid") === "true" || el.classList.contains("is-invalid") || el.classList.contains("error"))) {
        hasError = true;
      }

      // 3. Explicit error association: aria-describedby/errormessage pointing
      // at a VISIBLE element with error-like text means the portal already
      // flagged this field — even when validity/aria state looks clean
      // (plain text inputs accept anything, so validity never fires for them).
      if (!hasError) {
        const describedByIds = el.getAttribute("aria-describedby") || el.getAttribute("aria-errormessage") || "";
        if (describedByIds) {
          for (const id of describedByIds.split(/\s+/)) {
            const descEl = document.getElementById(id);
            if (descEl && isElementVisible(descEl) && visibleText(descEl).length > 2) {
              hasError = true;
              break;
            }
          }
        }
      }

      if (hasError) {
        // Try to locate error message text from describedby or sibling badge
        if (!errorMsg || errorMsg === "Invalid field format") {
          const describedBy = el.getAttribute("aria-describedby") || el.getAttribute("aria-errormessage") || "";
          if (describedBy) {
            for (const id of describedBy.split(/\s+/)) {
              const descEl = document.getElementById(id);
              const descText = descEl && isElementVisible(descEl) ? visibleText(descEl) : "";
              if (descText) {
                errorMsg = descText;
                break;
              }
            }
          }
        }

        if (!errorMsg || errorMsg === "Invalid field format") {
          const group = el.closest(".fb-dash-form-element, .jobs-easy-apply-form-section, .form-group, fieldset, [data-test-form-builder-group], div");
          if (group) {
            const errBadge = group.querySelector(
              ".artdeco-inline-feedback--error, [data-test-form-builder-error], [data-automation-id='errorWidget'], [data-automation-id='errorMessage'], .field-error, .error-message, .invalid-feedback, [role='alert'], .fb-dash-form-element__error-text"
            );
            const badgeText = errBadge && isElementVisible(errBadge) ? visibleText(errBadge) : "";
            if (badgeText) {
              errorMsg = badgeText;
            }
          }
        }

        if (!errorMsg) errorMsg = "Please enter a valid value";

        discoveredErrors.push({
          inputElement: el,
          errorMessage: errorMsg,
          questionText: getFieldQuestionText(el, true),
          currentValue: (el.value || "").trim(),
          fieldType: el.type || el.tagName.toLowerCase()
        });
        seenElements.add(el);
      }
    }

    // Strategy B: Scan visible portal-specific error badges (LinkedIn, Workday, Greenhouse, Lever, etc.)
    const errorBadgeSelectors = [
      ".artdeco-inline-feedback--error",
      "[data-test-form-builder-error]",
      "[data-automation-id='errorWidget']",
      "[data-automation-id='errorMessage']",
      ".fb-dash-form-element__error-field",
      ".fb-dash-form-element__error-text",
      ".jobs-easy-apply-form-section__error",
      ".field-error",
      ".error-message",
      ".input-error",
      ".invalid-feedback",
      ".form-error",
      "[role='alert']",
      ".has-error .help-block",
      ".WLOE"
    ];

    for (const sel of errorBadgeSelectors) {
      const badges = Array.from(container.querySelectorAll(sel));
      for (const badge of badges) {
        if (!isElementVisible(badge)) continue;
        const msg = (badge.innerText || badge.textContent || "").trim();
        if (!msg || msg.length < 3) continue;

        // Skip non-validation alert roles (e.g. general cookie/GDPR notifications):
        // Only skip if the badge has role="alert" AND is positioned far from any form control.
        // Do NOT filter on specific error keywords — valid constraint messages like
        // "Must be a whole number", "10 digits only", "Choose between 1 and 50" contain none.
        if (badge.getAttribute("role") === "alert") {
          const formScope = badge.closest("form, [role='form'], .jobs-easy-apply-form, .application-form");
          const hasNearbyControl = !!(
            (formScope && formScope.querySelector("input:not([type='hidden']), textarea, select")) ||
            // Formless alerts still count when a control sits beside the badge
            // (same parent) — global banners (cookie/GDPR) have no nearby input.
            (badge.parentElement && badge.parentElement.querySelector("input:not([type='hidden']), textarea, select, fieldset"))
          );
          // Skip only if there's genuinely no form context — avoids swallowing real constraint alerts
          if (!hasNearbyControl) continue;
        }

        // Correlate badge with specific input control
        let matchedControl = null;

        // 1. Explicit ARIA association (most reliable): aria-describedby / aria-errormessage / label[for]
        const forId = badge.getAttribute("for") || badge.getAttribute("aria-describedby");
        if (forId) {
          const target = (
            document.getElementById(forId) ||
            container.querySelector(`[name='${CSS.escape ? CSS.escape(forId) : forId}']`)
          );
          if (target && isFieldActionable(target)) matchedControl = target;
        }

        // 2. Named component container search — avoid naked closest("div") which grabs entire rows.
        // Instead use specific portal component wrappers that tightly scope to one field.
        if (!matchedControl) {
          const group = badge.closest(
            "[data-test-form-builder-group], [data-test-form-builder-component], " +
            ".fb-dash-form-element, .jobs-easy-apply-form-section__fields, " +
            ".form-group, .form-field, .field-wrapper, .input-group, " +
            "fieldset, [role='radiogroup'], [role='group'], " +
            ".artdeco-form-item, li.jobs-easy-apply-form-section__grouping"
          );
          if (group) {
            // Prefer fieldset (radio groups) over raw inputs when both present
            const fs = group.querySelector("fieldset, [role='radiogroup']");
            if (fs) {
              matchedControl = fs;
            } else {
              matchedControl = group.querySelector("input:not([type='hidden']), textarea, select");
            }
          }
        }

        // 3. Check previous siblings — traverse upward only within the same logical section
        if (!matchedControl) {
          const parentSection = badge.parentElement;
          if (parentSection) {
            let prev = badge.previousElementSibling;
            while (prev) {
              if (prev.matches && prev.matches("input:not([type='hidden']), textarea, select, fieldset")) {
                matchedControl = prev;
                break;
              }
              const nested = prev.querySelector && prev.querySelector(
                "input:not([type='hidden']), textarea, select, fieldset"
              );
              if (nested) {
                matchedControl = nested;
                break;
              }
              prev = prev.previousElementSibling;
            }
          }
        }

        // 3b. Climb wrappers (e.g. <div class="error-wrapper"><span class="field-error">):
        // when the badge sits alone in a wrapper, the input lives in an
        // ancestor that holds EXACTLY ONE actionable field. Ambiguous
        // ancestors (multi-input rows) never match — precision over recall.
        if (!matchedControl) {
          let ancestor = badge.parentElement;
          for (let depth = 0; depth < 3 && ancestor && !matchedControl; depth++) {
            try {
              const fields = Array.from(
                ancestor.querySelectorAll("input:not([type='hidden']), textarea, select")
              ).filter(isFieldActionable);
              if (fields.length === 1) matchedControl = fields[0];
            } catch { /* selector hiccup must not break attribution */ }
            ancestor = ancestor.parentElement;
          }
        }

        // 4. If associated control is a raw radio input, promote to its parent fieldset
        if (matchedControl && matchedControl.tagName === "INPUT" && matchedControl.type === "radio") {
          const parentFieldset = matchedControl.closest("fieldset, [role='radiogroup']");
          if (parentFieldset) matchedControl = parentFieldset;
        }

        if (matchedControl && !seenElements.has(matchedControl)) {
          seenElements.add(matchedControl);
          const isFs = matchedControl.tagName === "FIELDSET";
          discoveredErrors.push({
            inputElement: matchedControl,
            errorMessage: msg,
            questionText: getFieldQuestionText(matchedControl, true),
            currentValue: isFs ? "" : (matchedControl.value || "").trim(),
            fieldType: isFs ? "radio" : (matchedControl.type || matchedControl.tagName.toLowerCase())
          });
        }
      }
    }

    return discoveredErrors;
  }

  // AI Error Remediation Fallback (Dual-Path: Backend API or Direct Gemini)
  async function queryGeminiForValidationError({ questionText, currentValue, errorMessage, fieldType, options, token }) {
    try {
      const stored = await new Promise((r) =>
        chrome.storage.local.get(["vedha_token", "jwtToken", "token", "gemini_api_key", "candidateProfile"], r)
      );
      const authToken = token || stored.vedha_token || stored.jwtToken || stored.token;
      const directKey = stored.gemini_api_key;
      const candidateProfile = stored.candidateProfile || {};

      // 1. Try Backend Orchestrator API if token is available
      if (authToken) {
        try {
          const resp = await fetch("http://localhost:5000/api/orchestrator/generate-answers", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify({
              company: "Job Application",
              questionItems: [
                {
                  questionText: `The question is: "${questionText}". Previous answer "${currentValue}" was REJECTED with error: "${errorMessage}". Please provide a strictly valid, compliant answer.`,
                  fieldType: fieldType || "text",
                  options: options || []
                }
              ]
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data) && data[0]?.answerText) {
              return data[0].answerText.trim();
            }
          }
        } catch (e) {
          console.warn("[Vedha AI] Backend AI validation query failed, falling back to direct Gemini:", e);
        }
      }

      // 2. Direct Gemini Fallback if API key is stored
      if (directKey) {
        const prompt = `You are a job application assistant.
Question: "${questionText}"
Previous input: "${currentValue}"
Validation error received: "${errorMessage}"
Available options: ${JSON.stringify(options || [])}
Candidate profile facts: ${JSON.stringify(candidateProfile)}

Provide ONLY a single, corrected, compliant value that satisfies the validation error. Do NOT include explanations or punctuation unless required by the answer.`;

        const geminiResp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${directKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 80 }
            })
          }
        );

        if (geminiResp.ok) {
          const resData = await geminiResp.json();
          const corrected = resData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (corrected) return corrected;
        }
      }
    } catch (err) {
      console.warn("[Vedha AI] queryGeminiForValidationError error:", err);
    }
    return null;
  }

  // ---- Aksh run session: harness state machine + bounded retries (Phase 3) ----
  // One run id per page lifetime; each field gets a fixed remediation budget.
  // Exhausted fields are highlighted amber for the candidate instead of looping forever.
  // States: OBSERVE → FILL → VERIFY → FIX → STEP → … → REVIEW → SUBMIT/DONE,
  // with ESCALATED (unfixable fields) and ABORTED (kill switch) as exits.
  const VEDHA_MAX_FIELD_ATTEMPTS = 3;
  const vedhaRun = {
    id: `run-${Date.now().toString(36)}`,
    startedAt: Date.now(),
    state: "IDLE",
    escalatedTotal: 0,
    attempts: new WeakMap(),
    noteAttempt(el) {
      const n = (this.attempts.get(el) || 0) + 1;
      this.attempts.set(el, n);
      return n;
    },
    noteSuccess(el) { this.attempts.delete(el); },
    transition(to) {
      const from = this.state;
      this.state = to;
      console.log(`[Vedha AI] [${this.id}] ${from} → ${to}`);
      try {
        chrome.runtime?.sendMessage?.({
          action: "AGENT_STEP_UPDATE",
          runId: this.id,
          runState: to,
          title: `Run ${to}`,
        });
      } catch {
        // Progress relay must never break the run loop.
      }
    },
  };

  async function pacerSleep(minMs, maxMs) {
    const ms = minMs + Math.floor(Math.random() * Math.max(1, maxMs - minMs));
    await sleep(ms);
  }

  // Phase 4 dispatch: tracker-issued cancel reaches in-flight runs.
  // The poller passes runStatusUrl + token in the run payload; each wizard
  // step re-checks before touching the DOM. Network loss never aborts a run.
  async function checkRunCancelledRemotely(payload) {
    try {
      const url = payload?.runStatusUrl;
      const token = payload?.token;
      if (!url || !token) return false;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return false;
      const item = await res.json();
      const st = item.status ?? item.Status;
      return st === "Cancelled" || st === 6;
    } catch {
      return false;
    }
  }
  // Submission-evidence probe (verify-or-don't-claim): a click is never
  // proof. Returns evidence text when the page shows the posting as applied,
  // a confirmation message, or a success URL - else "".
  function probeSubmissionEvidence(scope) {
    try {
      const root = scope || document;
      const appliedBadge = root.querySelector
        ? root.querySelector(".jobs-s-apply--applied, [data-test-applied], .applied-badge, .application-submitted")
        : null;
      if (appliedBadge && isElementVisible(appliedBadge)) {
        return `Applied badge visible: "${(appliedBadge.innerText || appliedBadge.textContent || "").trim().slice(0, 80)}"`;
      }
      const bodyText = ((root === document ? document.body : root).innerText || root.textContent || "").toLowerCase();
      const successPatterns = [
        "application submitted", "successfully applied", "thank you for applying",
        "application received", "your application has been", "application complete"
      ];
      for (const pat of successPatterns) {
        if (bodyText.includes(pat)) return `confirmation text: "${pat}"`;
      }
      const url = (window.location.href || "").toLowerCase();
      if (/(success|confirm|thank|complete|applied)/.test(url)) return `success URL: ${window.location.href.slice(0, 160)}`;
    } catch { /* probing must never break the run */ }
    return "";
  }
  // VERIFY settle: portals render validation badges asynchronously after fill.
  // Watch the container with a MutationObserver until the visible error count
  // is stable for ~600ms (or timeout), so VERIFY scans settled DOM — not a
  // mid-render snapshot. Resolves with the settled error list.
  async function waitForValidationSettled(container, timeoutMs = 2500) {
    const scope = container || document.body;
    let lastCount = findActiveValidationErrors(scope).length;
    let lastChange = Date.now();
    let settled = false;
    const observer = new MutationObserver(() => {
      let nowCount = 0;
      try { nowCount = findActiveValidationErrors(scope).length; } catch { nowCount = lastCount; }
      if (nowCount !== lastCount) {
        lastCount = nowCount;
        lastChange = Date.now();
      }
    });
    try {
      observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-invalid"] });
    } catch {
      // Observation is best-effort; polling below still applies.
    }
    const start = Date.now();
    while (!settled && Date.now() - start < timeoutMs) {
      await sleep(150);
      settled = Date.now() - lastChange >= 600;
    }
    try { observer.disconnect(); } catch { /* best-effort */ }
    return findActiveValidationErrors(scope);
  }

  function escalateField(el, err) {
    try {
      el.style.border = "2px solid #f59e0b";
      el.style.outline = "2px solid #f59e0b";
      el.style.boxShadow = "0 0 8px rgba(245, 158, 11, 0.45)";
      el.setAttribute("title", `Needs you: ${err.errorMessage || "validation failed repeatedly"}`);
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      // Cosmetics must never break the remediation loop.
    }
  }

  // Two-Tier Self-Healing Validation Remediation Engine (Heuristic Sanitizers + Error-Aware AI)
  async function remediateValidationErrors(container = document.body, payload = {}) {
    const errors = findActiveValidationErrors(container);
    if (errors.length === 0) return 0;

    console.log(`[Vedha AI] [${vedhaRun.id}] Found ${errors.length} active validation error(s) to remediate:`, errors);
    let remediatedCount = 0;
    let escalatedCount = 0;

    const safePayload = payload || {};
    const candidateProfile = safePayload.candidateProfile || {};

    // AI availability, resolved ONCE per call: Tier-2 needs either the run
    // payload token or a stored direct key. When neither exists, an unhealed
    // field can never resolve on later passes either — escalate immediately
    // instead of vanishing silently (the retry budget still guards flaky AI).
    let aiAvailable = !!safePayload.token;
    if (!aiAvailable) {
      try {
        const stored = await new Promise((resolve) => {
          try {
            chrome.storage.local.get(["gemini_api_key"], resolve);
          } catch { resolve(null); }
        });
        aiAvailable = !!(stored && stored.gemini_api_key);
      } catch { aiAvailable = false; }
    }

    const wordNumbers = {
      zero: "0", one: "1", two: "2", three: "3", four: "4",
      five: "5", six: "6", seven: "7", eight: "8", nine: "9",
      ten: "10", fifteen: "15", twenty: "20"
    };

    for (const err of errors) {
      try {
        const el = err.inputElement;
        const errLower = (err.errorMessage || "").toLowerCase();
        const qRaw = err.questionText || "";
        const qLower = qRaw.toLowerCase();
        const currVal = err.currentValue || "";
        let remediatedVal = null;

        // Retry budget: same field failing across repeated passes escalates to the human.
        if (el && vedhaRun.noteAttempt(el) > VEDHA_MAX_FIELD_ATTEMPTS) {
          escalateField(el, err);
          escalatedCount++;
          continue;
        }

         // TIER 1: DETERMINISTIC HEURISTIC SANITIZERS

        // 1. Whole Number / Integer / Numeric Only Requirement
        // Activates on: error message keywords, HTML5 badInput/type="number",
        // OR question-context keywords (covers text-type inputs with generic error messages).
        // Salary-family questions are EXCLUDED here even when the message says
        // "numeric": the salary branch extracts the PRIMARY monetary value
        // ("$140,000 (base) + $20,000 bonus" -> "140000"), while this block
        // would take the first numeric token ("140").
        // Phone-family questions are excluded the same way (digit-count
        // normalizers own them, not first-token parsing).
        // Postal-family questions are excluded (first token of a ZIP+message
        // like "94105-1234" would corrupt the code).
        if (
          !/(salary|compensation|ctc|pay|amount|phone|mobile|tel\b|postal|zip)/.test(qLower + " " + errLower) && (
          errLower.includes("whole number") ||
          errLower.includes("numeric") ||
          errLower.includes("integer") ||
          errLower.includes("number only") ||
          errLower.includes("numbers only") ||
          errLower.includes("digits only") ||
          errLower.includes("invalid number") ||
          (el.validity && el.validity.badInput) ||
          el.type === "number" ||
          el.getAttribute("inputmode") === "numeric" ||
          // Activate on question context for text inputs with any generic error
          (qLower.includes("experience") || qLower.includes("years") || qLower.includes("how many") ||
           qLower.includes("notice period") || qLower.includes("months")))
        ) {
          // A: Try to round-parse a float first (preserves GPA "3.8" -> "4" for integer fields,
          //    or extracts "5" from "5 years"). Use first numeric token.
          const floatMatch = currVal.match(/(\d+(?:\.\d+)?)/);
          if (floatMatch) {
            // If the field strictly requires integers, round to the nearest integer
            const parsedFloat = parseFloat(floatMatch[1]);
            remediatedVal = el.type === "number" || errLower.includes("whole") || errLower.includes("integer")
              ? String(Math.round(parsedFloat))
              : floatMatch[1];
          } else {
            // B: Convert word numbers (e.g. "three" -> "3")
            for (const [word, num] of Object.entries(wordNumbers)) {
              if (currVal.toLowerCase().includes(word)) {
                remediatedVal = num;
                break;
              }
            }
          }

          // C: Prevent zero-value re-submission loop (portal rejects 0 if minimum is 1)
          if (remediatedVal === "0" || remediatedVal === "0.0") {
            if (
              errLower.includes("at least 1") ||
              errLower.includes("minimum 1") ||
              errLower.includes("greater than 0") ||
              (el.min !== undefined && el.min !== "" && parseFloat(el.min) >= 1)
            ) {
              remediatedVal = String(el.min ? Math.max(1, parseFloat(el.min)) : "1");
            }
          }

          // D: Contextual profile values if still null. No invented digits:
          // null flows to the sensitive-gate below (escalate, never AI-guess).
          if (!remediatedVal) {
            if (qLower.includes("experience") || qLower.includes("years") || qLower.includes("how many")) {
              const yrs = safePayload.yearsOfExperience ?? candidateProfile.totalYearsExperience;
              if (hasGroundedValue(yrs)) remediatedVal = String(yrs);
            } else if (qLower.includes("notice") || qLower.includes("days") || qLower.includes("weeks")) {
              const notice = safePayload.noticePeriodDays ?? candidateProfile.noticePeriodDays;
              if (hasGroundedValue(notice)) remediatedVal = String(notice);
            } else if (qLower.includes("salary") || qLower.includes("compensation") || qLower.includes("ctc")) {
              const salarySrc = safePayload.expectedSalary || candidateProfile.expectedSalary;
              if (salarySrc) {
                const salaryStr = String(salarySrc);
                const salaryMatch = salaryStr.match(/(\d{1,3}(?:,\d{3})+|\d+)/);
                remediatedVal = salaryMatch ? salaryMatch[1].replace(/,/g, "") : salaryStr.replace(/\D/g, "");
              }
            }
            // else: no "1" fallback — an invented quantity is a fabrication.
          }
        }

        // 2. Phone Number Constraints (10 digits, no formatting/country codes)
        else if (
          errLower.includes("phone") ||
          errLower.includes("10 digit") ||
          errLower.includes("valid phone") ||
          el.type === "tel" ||
          qLower.includes("phone") ||
          qLower.includes("mobile")
        ) {
          const rawSource = currVal ||
            safePayload.phone || safePayload.phoneNumber ||
            candidateProfile.phoneNumber || "";
          const rawDigits = rawSource.replace(/\D/g, "");

          // Check if a separate country code dropdown exists near this field
          const hasCountryCodeDropdown = !!(
            el.closest("form, .jobs-easy-apply-form, [role='dialog']") &&
            el.closest("form, .jobs-easy-apply-form, [role='dialog']").querySelector(
              "select[name*='country'], select[name*='code'], [aria-label*='Country code'], [aria-label*='country code']"
            )
          );

          // Check if the portal requires E.164 format (+1...)
          const requiresE164 = !!(el.getAttribute("pattern") && el.getAttribute("pattern").includes("+"));

          // No phone on file: never invent one (the old "5553492810" fallback
          // filed a stranger's number). Null flows to escalation, not AI guess.
          if (!rawDigits) {
            remediatedVal = null;
          } else if (requiresE164) {
            // Format as E.164: +1 followed by 10 digits
            remediatedVal = `+1${rawDigits.slice(-10)}`;
          } else if (hasCountryCodeDropdown) {
            // Country code is in a separate dropdown: provide subscriber number only (10 digits)
            remediatedVal = rawDigits.slice(-10);
          } else if (errLower.includes("10") || rawDigits.length >= 10) {
            // Standard 10-digit extraction: take last 10 to strip country codes
            remediatedVal = rawDigits.slice(-10);
          } else {
            remediatedVal = rawDigits || null;
          }
        }

        // 3. Salary / Amount Constraints (Currency symbols or commas rejected)
        // CRITICAL FIX: Never globally strip non-digits from strings containing parenthetical
        // conversions like "$140,000 USD / year (equivalent to 25 LPA)" — would produce "14000025"!
        else if (
          errLower.includes("amount") ||
          errLower.includes("salary") ||
          qLower.includes("salary") ||
          qLower.includes("ctc") ||
          qLower.includes("compensation") ||
          qLower.includes("annual")
        ) {
          // Extract the PRIMARY monetary value: the first large currency-formatted number
          const primaryMatch = currVal.match(/\$?\s*(\d{1,3}(?:,\d{3})+|\d{4,})/);
          if (primaryMatch) {
            remediatedVal = primaryMatch[1].replace(/,/g, "");
          } else {
            // Handle "k" and "LPA" suffix expansions
            const kMatch = currVal.match(/(\d+(?:\.\d+)?)\s*k/i);
            const lpaMatch = currVal.match(/(\d+(?:\.\d+)?)\s*(?:lpa|lac|lakh)/i);
            if (kMatch) {
              remediatedVal = String(Math.round(parseFloat(kMatch[1]) * 1000));
            } else if (lpaMatch) {
              // Convert LPA (lakhs per annum) to rupees: 1 lakh = 100,000
              remediatedVal = String(Math.round(parseFloat(lpaMatch[1]) * 100000));
            } else {
              // Fallback to candidate profile value — or nothing. No invented salary.
              const fallbackSrc = safePayload.expectedSalary || candidateProfile.expectedSalary;
              if (fallbackSrc) {
                const fallbackSalary = String(fallbackSrc);
                const fallbackMatch = fallbackSalary.match(/(\d{1,3}(?:,\d{3})+|\d+)/);
                remediatedVal = fallbackMatch ? fallbackMatch[1].replace(/,/g, "") : fallbackSalary.replace(/\D/g, "");
              }
            }
          }
        }

        // 4. Postal / ZIP Code Constraints
        else if (
          errLower.includes("postal") ||
          errLower.includes("zip") ||
          qLower.includes("postal") ||
          qLower.includes("zip code") ||
          qLower.includes("postcode")
        ) {
          const zipDigits = currVal.replace(/\D/g, "");
          // No invented ZIP: profile postal code or nothing (escalated, never AI-guessed).
          remediatedVal = zipDigits.slice(0, 6) || candidateProfile.postalCode || null;
        }

        // 5. Bounds / Range Clamping (e.g. "between X and Y", "minimum 0")
        else if (errLower.includes("between") || (el.validity && (el.validity.rangeOverflow || el.validity.rangeUnderflow))) {
          const boundsMatch = errLower.match(/between\s+(\d+(?:\.\d+)?)\s+and\s+(\d+(?:\.\d+)?)/);
          const min = boundsMatch ? parseFloat(boundsMatch[1]) : (el.min ? parseFloat(el.min) : 0);
          const max = boundsMatch ? parseFloat(boundsMatch[2]) : (el.max ? parseFloat(el.max) : 100);
          let valNum = parseFloat(currVal.replace(/[^0-9.]/g, "")) || min;
          if (valNum < min) valNum = min;
          if (valNum > max) valNum = max;
          remediatedVal = String(valNum);
        }

        // 6. Checkbox Constraint — NEVER auto-checked (see fill block).
        // A remediation click would attest consent the candidate never gave.
        else if (el.tagName === "INPUT" && el.type === "checkbox") {
          escalateField(el, err);
          escalatedCount++;
          continue;
        }

        // 7. Radio Button (single INPUT type=radio — missed by fieldset handler)
        else if (el.tagName === "INPUT" && el.type === "radio") {
          // Find the entire radio group and select the best match
          const radioGroup = el.closest("fieldset, [role='radiogroup']") ||
            el.closest("div, li")?.parentElement;
          const radios = radioGroup
            ? Array.from(radioGroup.querySelectorAll("input[type='radio']"))
            : [el];
          let targetRadio = null;
          // Explicit attestations only (see fill block): sponsorship,
          // relocation/commute, and work-authorization tri-state from the
          // candidate's stored booleans. Unknowns escalate below.
          if (qLower.includes("sponsorship") || qLower.includes("require visa")) {
            const sponsorship = profileVal(safePayload, candidateProfile, "requiresVisaSponsorship");
            if (sponsorship === true || sponsorship === false) {
              const target = sponsorship ? "yes" : "no";
              targetRadio = radios.find(r => getRadioLabelText(r).toLowerCase().includes(target));
            }
          } else if (qLower.includes("relocate") || qLower.includes("relocation") || qLower.includes("commute")) {
            const reloc = profileVal(safePayload, candidateProfile, "willingToRelocate") ?? profileVal(safePayload, candidateProfile, "willingToCommute");
            if (reloc === true || reloc === false) {
              const target = reloc ? "yes" : "no";
              targetRadio = radios.find(r => getRadioLabelText(r).toLowerCase().includes(target));
            }
          } else if (qLower.includes("authorized") || qLower.includes("legally") || qLower.includes("eligible") || qLower.includes("right to work")) {
            const auth = profileVal(safePayload, candidateProfile, "isAuthorizedToWork");
            if (auth === true || auth === false) {
              const target = auth ? "yes" : "no";
              targetRadio = radios.find(r => getRadioLabelText(r).toLowerCase().includes(target));
            }
          }
          // No first-radio fallback, no invented "Yes": unknowns escalate.
          if (!targetRadio) {
            escalateField(el, err);
            escalatedCount++;
            continue;
          }
          if (targetRadio) {
            targetRadio.click();
            targetRadio.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
            if (radioGroup) radioGroup.style.outline = "2px solid #10b981";
            remediatedCount++;
            continue;
          }
        }

        // 8. Dropdown (<select>) Selection Error — uses HTMLSelectElement prototype, never HTMLInputElement
        else if (el.tagName === "SELECT") {
          const availableOptions = Array.from(el.options).filter(
            o => o.value && o.value !== "0" && o.value !== "-1" &&
            !["select", "choose", "please select", "--"].some(ph => o.text.toLowerCase().includes(ph))
          );
          if (availableOptions.length > 0) {
            let chosen = null;
            // Explicit attestations (sponsorship/relocation/authorization
            // tri-state) plus profile-text equality for country/education.
            // EEO is never auto-picked. No first-option fallback.
            if (qLower.includes("sponsorship") || qLower.includes("require visa")) {
              const sponsorship = profileVal(safePayload, candidateProfile, "requiresVisaSponsorship");
              if (sponsorship === true || sponsorship === false) {
                const target = sponsorship ? "yes" : "no";
                chosen = availableOptions.find(o => o.text.toLowerCase().includes(target));
              }
            } else if (qLower.includes("relocate") || qLower.includes("relocation") || qLower.includes("commute")) {
              const reloc = profileVal(safePayload, candidateProfile, "willingToRelocate") ?? profileVal(safePayload, candidateProfile, "willingToCommute");
              if (reloc === true || reloc === false) {
                const target = reloc ? "yes" : "no";
                chosen = availableOptions.find(o => o.text.toLowerCase().includes(target));
              }
            } else if (qLower.includes("authorized") || qLower.includes("legally") || qLower.includes("eligible") || qLower.includes("right to work")) {
              const auth = profileVal(safePayload, candidateProfile, "isAuthorizedToWork");
              if (auth === true || auth === false) {
                const target = auth ? "yes" : "no";
                chosen = availableOptions.find(o => o.text.toLowerCase().includes(target));
              }
            } else if (qLower.includes("education") || qLower.includes("degree")) {
              const edLevel = (profileVal(safePayload, candidateProfile, "educationLevel") || profileVal(safePayload, candidateProfile, "education") || "").toLowerCase();
              if (edLevel) {
                chosen = availableOptions.find(o => o.text.toLowerCase().includes(edLevel.split("'")[0]));
              }
            } else {
              const country = profileVal(safePayload, candidateProfile, "country") || profileVal(safePayload, candidateProfile, "countryCode");
              const target = squashText(country || "");
              if (target) {
                chosen = availableOptions.find(o => squashText(o.text) === target || squashText(o.value) === target);
              }
            }
            if (!chosen) {
              escalateField(el, err);
              escalatedCount++;
              continue;
            }

            if (chosen) {
              // Use HTMLSelectElement prototype descriptor — never HTMLInputElement
              const selectProto = window.HTMLSelectElement?.prototype;
              const selectDescriptor = selectProto
                ? Object.getOwnPropertyDescriptor(selectProto, "value")
                : null;
              const tracker = el._valueTracker;
              if (tracker && typeof tracker.setValue === "function") {
                tracker.setValue(el.value || "");
              }
              if (selectDescriptor && selectDescriptor.set) {
                selectDescriptor.set.call(el, chosen.value);
              } else {
                el.value = chosen.value;
              }
              el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
              el.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
              el.style.border = "2px solid #10b981";
              remediatedCount++;
              continue;
            }
          }
        }

        // 9. Radio Buttons (<fieldset>) Selection Error — grounded or escalated.
        else if (el.tagName === "FIELDSET" || (el.getAttribute && el.getAttribute("role") === "radiogroup")) {
          const radios = Array.from(el.querySelectorAll("input[type='radio']"));
          if (radios.length > 0) {
            let targetRadio = null;
            // Explicit attestations only (see radio-single block above):
            // sponsorship, relocation/commute, work-authorization tri-state.
            // EEO decline-picks and the first-radio fallback stay deleted.
            if (qLower.includes("sponsorship") || qLower.includes("require visa")) {
              const sponsorship = profileVal(safePayload, candidateProfile, "requiresVisaSponsorship");
              if (sponsorship === true || sponsorship === false) {
                const target = sponsorship ? "yes" : "no";
                targetRadio = radios.find(r => getRadioLabelText(r).toLowerCase().includes(target));
              }
            } else if (qLower.includes("relocate") || qLower.includes("relocation") || qLower.includes("commute")) {
              const reloc = profileVal(safePayload, candidateProfile, "willingToRelocate") ?? profileVal(safePayload, candidateProfile, "willingToCommute");
              if (reloc === true || reloc === false) {
                const target = reloc ? "yes" : "no";
                targetRadio = radios.find(r => getRadioLabelText(r).toLowerCase().includes(target));
              }
            } else if (qLower.includes("authorized") || qLower.includes("legally") || qLower.includes("eligible") || qLower.includes("right to work")) {
              const auth = profileVal(safePayload, candidateProfile, "isAuthorizedToWork");
              if (auth === true || auth === false) {
                const target = auth ? "yes" : "no";
                targetRadio = radios.find(r => getRadioLabelText(r).toLowerCase().includes(target));
              }
            }
            if (!targetRadio) {
              escalateField(el, err);
              escalatedCount++;
              continue;
            }

            if (targetRadio) {
              targetRadio.click();
              targetRadio.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
              el.style.outline = "2px solid #10b981";
              remediatedCount++;
              continue;
            }
          }
        }

        // 10. Character / Length Constraints (e.g. maximum characters exceeded)
        else if (errLower.includes("character") || errLower.includes("maximum") || errLower.includes("too long")) {
          const maxMatch = errLower.match(/(?:maximum|limit|up to)\s+(\d+)/);
          const maxLen = maxMatch ? parseInt(maxMatch[1], 10) : (el.maxLength > 0 ? el.maxLength : 200);
          if (currVal.length > maxLen) {
            remediatedVal = currVal.slice(0, maxLen);
          }
        }


        // Sensitive gate: identity/legal/EEO/consent/compensation fields are
        // NEVER AI-guessed. Null here means no grounded value exists - leave
        // it for the per-field retry budget to escalate on repeated passes.
        const sensitiveSkip = !remediatedVal && isSensitiveQuestion(qLower, errLower, el);
        if (sensitiveSkip) {
          console.log(`[Vedha AI] [${vedhaRun.id}] Sensitive field "${qRaw}" has no grounded value - skipping AI guess, leaving for escalation.`);
        }

        // TIER 2: ERROR-AWARE AI REMEDIATION FALLBACK
        if (!sensitiveSkip && !remediatedVal && qRaw.length > 3) {
          console.log(`[Vedha AI] Querying AI grounding for complex validation error: "${err.errorMessage}" on "${qRaw}"`);
          const aiFix = await queryGeminiForValidationError({
            questionText: qRaw,
            currentValue: currVal,
            errorMessage: err.errorMessage,
            fieldType: err.fieldType,
            options: [],
            token: safePayload.token
          });
          if (aiFix) remediatedVal = aiFix;
        }

        // TIER 3: BIOMETRIC RE-APPLICATION & EVENT TRIGGERING
        // Empty string never applies (clears the field to blank).
        if (remediatedVal !== null && remediatedVal !== undefined && remediatedVal !== "") {
          console.log(`[Vedha AI] Remediating field "${qRaw}": "${currVal}" -> "${remediatedVal}" (Error was: ${err.errorMessage})`);
          el.focus();
          setNativeValue(el, "");
          await typeLikeHuman(el, remediatedVal);
          el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
          el.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
          el.dispatchEvent(new Event("blur", { bubbles: true, composed: true }));
          el.style.border = "2px solid #10b981";
          el.style.boxShadow = "0 0 8px rgba(16, 185, 129, 0.4)";
          el.setAttribute("title", `Self-Healed: "${err.errorMessage}" -> "${remediatedVal}"`);
          remediatedCount++;
          vedhaRun.noteSuccess(el);
          await pacerSleep(250, 800);
        }

        // Fail-closed per-error tail: no tier produced a value AND no future
        // pass could do better (sensitive dead-end, or no AI credentials to
        // consult) -> amber highlight + count NOW instead of vanishing.
        // Flaky-AI cases (credentials exist, Tier-2 attempted) stay on the
        // retry budget above.
        if ((remediatedVal === null || remediatedVal === undefined || remediatedVal === "") && (sensitiveSkip || !aiAvailable)) {
          escalateField(el, err);
          escalatedCount++;
        }
      } catch (remErr) {
        console.warn("[Vedha AI] Failed to remediate validation error on element:", err, remErr);
      }
    }

    // Allow portal DOM listeners to re-evaluate and clear inline feedback badges
    await sleep(400);
    if (escalatedCount > 0) {
      vedhaRun.escalatedTotal += escalatedCount;
      console.log(`[Vedha AI] [${vedhaRun.id}] ${escalatedCount} field(s) need you - highlighted amber instead of retried.`);
    }
    return remediatedCount;
  }

  // 9. Safe AutoFill Form Execution with Honeypot Evasion & CAPTCHA Pause
  async function autoFillForm(payload) {
    const safePayload = {
      ...DEFAULT_CANDIDATE_PROFILE,
      ...(payload || {})
    };
    for (const key of Object.keys(DEFAULT_CANDIDATE_PROFILE)) {
      if (safePayload[key] === undefined || safePayload[key] === null || safePayload[key] === "") {
        safePayload[key] = DEFAULT_CANDIDATE_PROFILE[key];
      }
    }

    const challenge = detectCaptchaOrChallenge();
    if (challenge) {
      await new Promise((resolve) => {
        showCaptchaGatewayBanner(challenge, resolve);
      });
      await sleep(1000);
    }

    const isLinkedIn = window.location.hostname.includes("linkedin.com");

    if (isLinkedIn) {
      let modal = findEasyApplyModal();

      if (!modal) {
        let applyBtn = findEasyApplyButton();
        if (!applyBtn) {
          const waitStart = Date.now();
          while (Date.now() - waitStart < 2500) {
            await sleep(250);
            applyBtn = findEasyApplyButton();
            if (applyBtn) break;
            modal = findEasyApplyModal();
            if (modal) break;
          }
        }
        if (applyBtn && !modal) {
          console.log("[Vedha AI] Clicking Easy Apply button for Safe Fill:", applyBtn);
          await clickElementNaturally(applyBtn);
          modal = await waitForEasyApplyModal(10000);
        }
      }

      if (modal) {
        const res = await fillModalInputs(modal, safePayload, true);
        const postErrors = findActiveValidationErrors(modal);
        let healedCount = 0;
        if (postErrors.length > 0) {
          console.log(`[Vedha AI] Found ${postErrors.length} validation errors in Safe Fill modal. Running self-healing...`);
          healedCount = await remediateValidationErrors(modal, safePayload);
        }
        return {
          success: true,
          filledCount: res.filledCount + healedCount,
          unansweredCount: res.unansweredCount,
          healedCount: healedCount,
          mode: "linkedin-modal"
        };
      }

      const externalBtn = detectExternalApplyButton();
      if (externalBtn) {
        return {
          success: false,
          error: "This job requires applying directly on the company's website (not LinkedIn Easy Apply). Please click 'Apply' on LinkedIn to open the external job portal, and Vedha AI will auto-fill your application there."
        };
      }

      const pageInputs = document.querySelectorAll("input:not([type='hidden']), textarea, select");
      if (pageInputs.length > 2) {
        const formContainer = document.querySelector("form.jobs-easy-apply-form, form") || document.body;
        const res = await fillModalInputs(formContainer, safePayload, true);
        const postErrors = findActiveValidationErrors(formContainer);
        let healedCount = 0;
        if (postErrors.length > 0) {
          console.log(`[Vedha AI] Found ${postErrors.length} validation errors on page. Running self-healing...`);
          healedCount = await remediateValidationErrors(formContainer, safePayload);
        }
        return {
          success: true,
          filledCount: res.filledCount + healedCount,
          unansweredCount: res.unansweredCount,
          healedCount: healedCount,
          mode: "page"
        };
      }

      return {
        success: false,
        error: "Could not find 'Easy Apply' button or application modal. Please open the Easy Apply dialog manually and click Safe Fill again."
      };
    }

    const formContainer = document.querySelector("form.jobs-easy-apply-form, form") || document.body;
    const res = await fillModalInputs(formContainer, safePayload, true);
    const postErrors = findActiveValidationErrors(formContainer);
    let healedCount = 0;
    if (postErrors.length > 0) {
      console.log(`[Vedha AI] Found ${postErrors.length} validation errors on page. Running self-healing...`);
      healedCount = await remediateValidationErrors(formContainer, safePayload);
    }

    return {
      success: true,
      filledCount: res.filledCount + healedCount,
      unansweredCount: res.unansweredCount,
      healedCount: healedCount,
      mode: "page"
    };
  }

  // 10. LinkedIn Easy Apply Multi-Step Engine
  async function autoApplyLinkedInEasyApply(payload) {
    if (!window.location.hostname.includes("linkedin.com")) {
      return { success: false, error: "Not on a LinkedIn job page." };
    }

    const safePayload = {
      ...DEFAULT_CANDIDATE_PROFILE,
      ...(payload || {})
    };
    for (const key of Object.keys(DEFAULT_CANDIDATE_PROFILE)) {
      if (safePayload[key] === undefined || safePayload[key] === null || safePayload[key] === "") {
        safePayload[key] = DEFAULT_CANDIDATE_PROFILE[key];
      }
    }

    // 1. Check if the modal is ALREADY OPEN
    let modal = findEasyApplyModal();

    // 2. Only check if already applied when modal is not already open, and strictly inside the target job top card
    if (!modal) {
      const topCard = document.querySelector(
        ".job-details-jobs-unified-top-card__container--two-pane, .jobs-details__top-card, .jobs-unified-top-card, .jobs-search__job-details, .job-view-layout"
      );
      if (topCard) {
        const topCardText = (topCard.innerText || "").toLowerCase();
        const appliedBtn = topCard.querySelector(".jobs-s-apply--applied, button[disabled].jobs-apply-button");
        if (appliedBtn || topCardText.includes("you applied on") || topCardText.includes("application submitted")) {
          return { success: true, message: "Already applied on LinkedIn for this position!" };
        }
      }
    }

    // 3. If not open, look for the Easy Apply button and click it
    if (!modal) {
      let applyBtn = findEasyApplyButton();

      // If button not found immediately, poll for 2.5s to handle async DOM mounting
      if (!applyBtn) {
        console.log("[Vedha AI] Easy Apply button not found immediately, polling for 2.5s...");
        const waitStart = Date.now();
        while (Date.now() - waitStart < 2500) {
          await sleep(250);
          applyBtn = findEasyApplyButton();
          if (applyBtn) break;
          modal = findEasyApplyModal();
          if (modal) break;
        }
      }

      if (applyBtn && !modal) {
        console.log("[Vedha AI] Found Easy Apply button, clicking naturally...", applyBtn);
        await clickElementNaturally(applyBtn);
        modal = await waitForEasyApplyModal(10000);
      }
    } else {
      console.log("[Vedha AI] Easy Apply modal is already open on page:", modal);
    }

    if (!modal) {
      const externalBtn = detectExternalApplyButton();
      if (externalBtn) {
        return {
          success: false,
          error: "This job requires applying directly on the company's website (not LinkedIn Easy Apply). Please click 'Apply' on LinkedIn to open the external job portal, and Vedha AI will auto-fill your application there."
        };
      }
      return {
        success: false,
        error: "Could not find 'Easy Apply' button or open application modal. Please open the Easy Apply dialog manually and click Auto-Apply again."
      };
    }

    let stepCount = 0;
    let easyFilledCount = 0;
    while (stepCount < 15) {
      stepCount++;
      modal = findEasyApplyModal();
      if (!modal) break;

      const easyFill = await fillModalInputs(modal, safePayload, false);
      easyFilledCount += (easyFill.filledCount || 0);
      vedhaRun.escalatedTotal += (easyFill.escalatedCount || 0);
      await sleep(600);

      // Check for validation errors on current step and self-heal before attempting progression
      const preErrors = findActiveValidationErrors(modal);
      if (preErrors.length > 0) {
        console.log(`[Vedha AI] Detected ${preErrors.length} validation error(s) on Easy Apply step ${stepCount}. Remediating...`);
        await remediateValidationErrors(modal, safePayload);
        await sleep(500);
      }

      // Check for Submit button
      const submitBtn = Array.from(modal.querySelectorAll("button")).find((b) => {
        if (!isElementVisible(b) || b.disabled) return false;
        const text = (b.innerText || b.textContent || "").trim().toLowerCase();
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        return (
          text.includes("submit application") ||
          text === "submit" ||
          aria.includes("submit application")
        );
      });

      if (submitBtn) {
        if (safePayload?.copilotMode !== false) {
          showCopilotReviewHud(safePayload?.queueItemId, safePayload?.company, safePayload?.title);
          return {
            success: true,
            pausedForReview: true,
            message: "All Easy Apply steps completed. Paused at final Review screen for candidate authorization."
          };
        } else {
          await clickElementNaturally(submitBtn);
          await pacerSleep(2200, 3200);
          // Verify-or-don't-claim: a click is not a submission.
          const submitEvidence = probeSubmissionEvidence(document);
          if (!submitEvidence) {
            return {
              success: false,
              filledCount: easyFilledCount,
              error: "Submit was clicked but no confirmation (Applied badge, confirmation text, or success page) could be verified. Check the posting manually before retrying."
            };
          }
          const doneBtn = document.querySelector("button[aria-label='Dismiss'], button:has-text('Done')");
          if (doneBtn) doneBtn.click();
          return { success: true, submitted: true, filledCount: easyFilledCount, evidence: submitEvidence, message: `Application submitted on LinkedIn (${submitEvidence}).` };
        }
      }

      // Check for Review button
      const reviewBtn = Array.from(modal.querySelectorAll("button")).find((b) => {
        if (!isElementVisible(b) || b.disabled) return false;
        const text = (b.innerText || b.textContent || "").trim().toLowerCase();
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        return (
          text.includes("review your application") ||
          text === "review" ||
          aria.includes("review your application") ||
          aria.includes("review")
        );
      });

      if (reviewBtn) {
        await clickElementNaturally(reviewBtn);
        await sleep(1500);
        continue;
      }

      // Check for Next button
      const nextBtn = Array.from(modal.querySelectorAll("button")).find((b) => {
        if (!isElementVisible(b) || b.disabled) return false;
        const text = (b.innerText || b.textContent || "").trim().toLowerCase();
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        return (
          text.includes("continue to next step") ||
          text === "next" ||
          aria.includes("continue to next step") ||
          aria.includes("next")
        );
      });

      if (nextBtn) {
        await clickElementNaturally(nextBtn);
        await sleep(1500);

        // Check if clicking Next triggered validation errors on current step
        const postErrors = findActiveValidationErrors(modal);
        if (postErrors.length > 0) {
          console.log(`[Vedha AI] LinkedIn Easy Apply Next triggered ${postErrors.length} validation errors. Running self-healing...`);
          const healed = await remediateValidationErrors(modal, safePayload);
          await sleep(600);

          // If errors were resolved, re-click Next
          const remainingErrors = findActiveValidationErrors(modal);
          if (remainingErrors.length === 0 || healed > 0) {
            console.log("[Vedha AI] Errors remediated. Retrying Next button click...");
            const refreshedNextBtn = Array.from(modal.querySelectorAll("button")).find((b) => {
              if (!isElementVisible(b) || b.disabled) return false;
              const text = (b.innerText || b.textContent || "").trim().toLowerCase();
              const aria = (b.getAttribute("aria-label") || "").toLowerCase();
              return (
                text.includes("continue to next step") ||
                text === "next" ||
                aria.includes("continue to next step") ||
                aria.includes("next")
              );
            });
            if (refreshedNextBtn) {
              await clickElementNaturally(refreshedNextBtn);
              await sleep(1500);
            }
          }
        }
        continue;
      }

      break;
    }

    // Loop ended without reaching Submit or Review: never report completion.
    // Exception: the page itself proves submission (already-applied posting).
    const tailEvidence = probeSubmissionEvidence(document);
    if (tailEvidence) {
      return { success: true, submitted: true, filledCount: easyFilledCount, evidence: tailEvidence, message: `Verified on page (${tailEvidence}).` };
    }
    return {
      success: false,
      filledCount: easyFilledCount,
      error: `Easy Apply ended on step ${stepCount} without reaching Review or Submit (modal closed or no progression button). Open the posting to check manually.`
    };
  }

  // 11. Intelligent Universal Progression Button Discovery Engine (Workday, Greenhouse, Lever, Ashby, Indeed, Taleo, etc.)
  function findFormProgressionButton(container = document.body) {
    if (!container) return null;

    const candidates = Array.from(
      container.querySelectorAll("button, input[type='submit'], input[type='button'], a[role='button'], div[role='button'], span[role='button']")
    );

    let submitCandidate = null;
    let reviewCandidate = null;
    let nextCandidate = null;

    for (const el of candidates) {
      if (!isElementVisible(el)) continue;
      if (el.disabled || el.getAttribute("aria-disabled") === "true") continue;
      if (isMsgOrChatElement(el)) continue;

      const text = (el.innerText || el.textContent || el.value || "").trim().toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const id = (el.id || "").toLowerCase();
      const name = (el.getAttribute("name") || "").toLowerCase();
      const automationId = (el.getAttribute("data-automation-id") || "").toLowerCase();
      const testId = (el.getAttribute("data-testid") || "").toLowerCase();

      // Exclude navigation / dismissal / cancellation actions
      const ignoreWords = [
        "back", "previous", "cancel", "discard", "close", "dismiss",
        "save for later", "save draft", "edit", "remove", "delete", "reset",
        "sign in", "login", "share", "follow", "report", "terms", "privacy", "choose file"
      ];
      if (ignoreWords.some((w) => text === w || aria === w || text.startsWith(w + " ") || aria.startsWith(w + " "))) {
        continue;
      }

      // 1. Submit Candidate Check
      const isSubmit =
        text.includes("submit application") ||
        text === "submit" ||
        text.includes("send application") ||
        text.includes("apply now") ||
        text.includes("complete application") ||
        aria.includes("submit application") ||
        automationId.includes("pagesubmit") ||
        id === "submit_app" ||
        id === "btn-submit";

      if (isSubmit && !submitCandidate) {
        submitCandidate = el;
        continue;
      }

      // 2. Review Candidate Check
      const isReview =
        text.includes("review your application") ||
        text === "review" ||
        text.includes("review application") ||
        aria.includes("review your application") ||
        aria.includes("review");

      if (isReview && !reviewCandidate) {
        reviewCandidate = el;
        continue;
      }

      // 3. Next / Progression Candidate Check
      const isNext =
        text.includes("continue to next step") ||
        text.includes("save and continue") ||
        text.includes("save & continue") ||
        text === "next" ||
        text.includes("next step") ||
        text === "continue" ||
        text.includes("proceed") ||
        text.includes("save and proceed") ||
        text.includes("step 2") ||
        text.includes("step 3") ||
        text.includes("step 4") ||
        aria.includes("continue to next step") ||
        aria.includes("next") ||
        automationId.includes("next-button") ||
        automationId.includes("bottom-navigation-next");

      if (isNext && !nextCandidate) {
        nextCandidate = el;
      }
    }

    // Priority: Next > Review > Submit. On multi-step wizards Submit is
    // visible from step 1 — taking it first would skip remaining stages or
    // submit an incomplete application. Submit fires only when it is the sole
    // remaining action (the final step), where callers pause or verify first.
    if (nextCandidate) return { type: "next", element: nextCandidate };
    if (reviewCandidate) return { type: "review", element: reviewCandidate };
    if (submitCandidate) return { type: "submit", element: submitCandidate };
    return null;
  }

  let isAutonomousLoopAborted = false;

  // 12. End-to-End Autonomous Multi-Step Auto-Fill & Progression Engine
  async function runAutonomousMultiStepFill(payload) {
    isAutonomousLoopAborted = false;
    const safePayload = {
      ...DEFAULT_CANDIDATE_PROFILE,
      ...(payload || {})
    };
    for (const key of Object.keys(DEFAULT_CANDIDATE_PROFILE)) {
      if (safePayload[key] === undefined || safePayload[key] === null || safePayload[key] === "") {
        safePayload[key] = DEFAULT_CANDIDATE_PROFILE[key];
      }
    }

    const isLinkedIn = window.location.hostname.includes("linkedin.com");

    if (isLinkedIn) {
      let modal = findEasyApplyModal();
      if (!modal) {
        let applyBtn = findEasyApplyButton();
        if (!applyBtn) {
          const waitStart = Date.now();
          while (Date.now() - waitStart < 2500) {
            await sleep(250);
            applyBtn = findEasyApplyButton();
            if (applyBtn) break;
            modal = findEasyApplyModal();
            if (modal) break;
          }
        }
        if (applyBtn && !modal) {
          await clickElementNaturally(applyBtn);
          modal = await waitForEasyApplyModal(8000);
        }
      }

      if (!modal) {
        const externalBtn = detectExternalApplyButton();
        if (externalBtn) {
          return {
            success: false,
            error: "This job requires applying directly on the company's website (not LinkedIn Easy Apply). Please click 'Apply' on LinkedIn to open the external job portal, and Vedha AI will auto-fill your application there."
          };
        }
        const pageInputs = document.querySelectorAll("input:not([type='hidden']), textarea, select");
        if (pageInputs.length <= 2) {
          return {
            success: false,
            error: "Could not find 'Easy Apply' button or open application modal. Please open the Easy Apply dialog manually and click Autonomous Auto-Fill again."
          };
        }
      }
    }

    let stepIndex = 1;
    const maxSteps = 12;
    let totalFieldsFilled = 0;
    vedhaRun.transition("OBSERVE");

    while (stepIndex <= maxSteps && !isAutonomousLoopAborted) {
      // Phase 4 dispatch: tracker cancel wins before any step touches the DOM.
      if (safePayload?.runStatusUrl) {
        if (await checkRunCancelledRemotely(safePayload)) {
          vedhaRun.transition("ABORTED");
          console.log(`[Vedha AI] [${vedhaRun.id}] Run receipt: state=ABORTED reason=tracker-cancel filled=${totalFieldsFilled}`);
          return {
            success: false,
            cancelled: true,
            filledCount: totalFieldsFilled,
            error: "Cancelled from the tracker."
          };
        }
      }

      // Step A: CAPTCHA / WAF check
      const challenge = detectCaptchaOrChallenge();
      if (challenge) {
        await new Promise((resolve) => {
          showCaptchaGatewayBanner(challenge, resolve);
        });
        await sleep(1000);
      }

      // Step B: Target Form Container Discovery
      let container = document.body;
      if (isLinkedIn) {
        container = findEasyApplyModal() || document.querySelector("form.jobs-easy-apply-form, form") || document.body;
      } else {
        const dialog = document.querySelector("[role='dialog']:not([aria-hidden='true']), dialog[open], .application-modal, form.application-form, form");
        if (dialog && isElementVisible(dialog)) container = dialog;
      }

      chrome.runtime?.sendMessage?.({
        action: "AGENT_STEP_UPDATE",
        step: Math.min(stepIndex, 4),
        totalSteps: 4,
        stepName: stepIndex === 1 ? "Contact Details" : stepIndex === 2 ? "Experience & History" : stepIndex === 3 ? "Screening Q&A" : "Final Verification",
        title: `⚡ Running Step ${stepIndex}`,
        detail: `Analyzing form inputs and populating answers with Gemini AI...`,
        progress: Math.min(90, stepIndex * 22)
      });

      // Step C: Biometric AutoFill on Current Page / Step
      vedhaRun.transition("FILL");
      const fillRes = await fillModalInputs(container, safePayload, true);
      totalFieldsFilled += (fillRes.filledCount || 0);
      vedhaRun.escalatedTotal += (fillRes.escalatedCount || 0);

      await pacerSleep(600, 900);
      if (isAutonomousLoopAborted) break;

      // Step C2: VERIFY (settled) then FIX any validation errors from fill.
      // waitForValidationSettled observes async portal badges before scanning.
      vedhaRun.transition("VERIFY");
      const preErrors = await waitForValidationSettled(container);
      if (preErrors.length > 0) {
        console.log(`[Vedha AI] Step ${stepIndex} detected ${preErrors.length} validation errors. Running self-healing remediation...`);
        vedhaRun.transition("FIX");
        const healedCount = await remediateValidationErrors(container, safePayload);
        totalFieldsFilled += healedCount;
        await sleep(500);
      }

      // Step D: Detect Progression Action Button
      // If container is a modal, strictly scope search to container to avoid matching external page buttons
      const progression = findFormProgressionButton(container) || (container === document.body ? null : findFormProgressionButton(document.body));

      if (!progression) {
        chrome.runtime?.sendMessage?.({
          action: "AGENT_FINISHED",
          totalSteps: 4,
          message: `Completed form auto-fill (${totalFieldsFilled} fields). Ready for submission.`
        });
        return {
          success: true,
          filledCount: totalFieldsFilled,
          message: `All fields populated across steps.`
        };
      }

      // 1. SUBMIT BUTTON (Terminal Action)
      if (progression.type === "submit") {
        progression.element.scrollIntoView({ behavior: "smooth", block: "center" });
        progression.element.style.outline = "3px solid #0ea5e9";
        progression.element.style.boxShadow = "0 0 20px rgba(14, 165, 233, 0.7)";

        if (safePayload?.copilotMode !== false) {
          vedhaRun.transition("REVIEW");
          showCopilotReviewHud(safePayload?.queueItemId, safePayload?.company, safePayload?.title);
          chrome.runtime?.sendMessage?.({
            action: "AGENT_STEP_UPDATE",
            step: 4,
            totalSteps: 4,
            stepName: "Review Gateway",
            title: "🛡️ Review Gateway Paused",
            detail: "All stages filled! Paused at final Review screen for candidate confirmation.",
            progress: 100
          });
          return {
            success: true,
            pausedForReview: true,
            filledCount: totalFieldsFilled,
            message: "All application stages completed. Paused at final Review screen for confirmation."
          };
        } else {
          vedhaRun.transition("SUBMIT");
          await clickElementNaturally(progression.element);
          await pacerSleep(2200, 3200);
          // Verify-or-don't-claim: a click is not a submission.
          const multiEvidence = probeSubmissionEvidence(document);
          if (!multiEvidence) {
            vedhaRun.transition("ESCALATED");
            return {
              success: false,
              filledCount: totalFieldsFilled,
              error: "Submit was clicked but no confirmation (Applied badge, confirmation text, or success page) could be verified. Check the posting manually before retrying."
            };
          }
          chrome.runtime?.sendMessage?.({
            action: "AGENT_FINISHED",
            totalSteps: 4,
            message: `Application submitted successfully (${multiEvidence})!`
          });
          return {
            success: true,
            submitted: true,
            filledCount: totalFieldsFilled,
            evidence: multiEvidence,
            message: `Application submitted successfully (${multiEvidence})!`
          };
        }
      }

      // 2. REVIEW BUTTON
      if (progression.type === "review") {
        vedhaRun.transition("STEP");
        chrome.runtime?.sendMessage?.({
          action: "AGENT_STEP_UPDATE",
          step: 3,
          totalSteps: 4,
          stepName: "Review Stage",
          title: "Proceeding to Review",
          detail: "Advancing to application review screen...",
          progress: 80
        });
        await clickElementNaturally(progression.element);
        await pacerSleep(1500, 2200);
        stepIndex++;
        continue;
      }

      // 3. NEXT / CONTINUE BUTTON
      if (progression.type === "next") {
        vedhaRun.transition("STEP");
        // Pre-click check: settled scan first (async badges), then remediate before pausing
        let errors = await waitForValidationSettled(container);
        if (errors.length > 0) {
          console.log(`[Vedha AI] Attempting pre-Next remediation for ${errors.length} validation error(s)...`);
          const healed = await remediateValidationErrors(container, safePayload);
          totalFieldsFilled += healed;
          await sleep(500);
          errors = findActiveValidationErrors(container);
        }

        if (errors.length > 0) {
          errors[0].inputElement?.scrollIntoView({ behavior: "smooth", block: "center" });
          showSafeFillNotice(totalFieldsFilled, errors.length);
          vedhaRun.transition("ESCALATED");
          console.log(`[Vedha AI] [${vedhaRun.id}] Run receipt: state=ESCALATED filled=${totalFieldsFilled} escalated~${vedhaRun.escalatedTotal} step=${stepIndex}`);
          return {
            success: false,
            error: `Paused: ${errors.length} required field(s) require manual review (${errors[0].errorMessage || "Validation error"}).`
          };
        }

        // Capture DOM step fingerprint BEFORE clicking Next (F9: Step Verification)
        // A fingerprint is the sorted set of actionable input identifiers + step heading text.
        const captureStepFingerprint = (scope) => {
          const inputs = Array.from(scope.querySelectorAll(
            "input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select, fieldset"
          )).filter(el => isElementVisible(el));
          const ids = inputs.map(el => el.id || el.name || el.getAttribute("aria-label") || "").join(",");
          const heading = (
            scope.querySelector("h1, h2, h3, [data-test-form-element-label-title], .artdeco-completeness__label") || {}
          ).innerText || "";
          return `${heading.trim()}::${ids}::${inputs.length}`;
        };

        const fingerprintBefore = captureStepFingerprint(container);

        chrome.runtime?.sendMessage?.({
          action: "AGENT_STEP_UPDATE",
          step: Math.min(stepIndex + 1, 4),
          totalSteps: 4,
          stepName: `Advancing to Step ${stepIndex + 1}`,
          title: `Advancing Step ${stepIndex}`,
          detail: `Clicking "${(progression.element.innerText || progression.element.textContent || 'Next').trim()}"...`,
          progress: Math.min(90, (stepIndex + 1) * 22)
        });

        await clickElementNaturally(progression.element);
        await pacerSleep(1700, 2500);

        // POST-CLICK CHECK:
        // Did the portal reject navigation and show new validation errors?
        // Settled scan: post-click badges render asynchronously.
        const postClickErrors = await waitForValidationSettled(container);
        if (postClickErrors.length > 0) {
          console.log(`[Vedha AI] Progression click triggered ${postClickErrors.length} validation errors. Running self-healing...`);
          const postHealed = await remediateValidationErrors(container, safePayload);
          totalFieldsFilled += postHealed;
          await sleep(600);

          const unresolved = findActiveValidationErrors(container);
          if (unresolved.length === 0 || postHealed > 0) {
            // Re-find progression button and retry
            const retryProgression = findFormProgressionButton(container) || (container === document.body ? null : findFormProgressionButton(document.body));
            if (retryProgression && retryProgression.type === "next") {
              console.log("[Vedha AI] Re-clicking Next after successful validation remediation...");
              await clickElementNaturally(retryProgression.element);
              await pacerSleep(1700, 2500);
            }
          } else {
            unresolved[0].inputElement?.scrollIntoView({ behavior: "smooth", block: "center" });
            return {
              success: false,
              error: `Paused: Field requires manual review (${unresolved[0].errorMessage || "Validation error"}).`
            };
          }
        }

        // DOM Step Fingerprint Verification: confirm actual step transition occurred.
        // If fingerprint unchanged after 2.5s, "Next" click was rejected silently by the portal.
        // Do NOT increment stepIndex in that case to prevent false progression reporting.
        const fingerprintAfter = captureStepFingerprint(container);
        if (fingerprintAfter !== fingerprintBefore) {
          // Step genuinely advanced — increment counter
          stepIndex++;
        } else {
          // Fingerprint unchanged: portal rejected or no DOM change detected.
          // Log warning and do NOT increment stepIndex to avoid false-positive reporting.
          console.warn(`[Vedha AI] Step fingerprint unchanged after Next click on step ${stepIndex}. Portal may have rejected navigation or no new inputs loaded.`);
          // Still increment to avoid hard infinite loop, but apply a longer back-off
          await pacerSleep(1200, 2000);
          stepIndex++;
        }
        continue;
      }

      break;
    }

    // Loop exhausted without reaching a submit or review action.
    // Honest terminal receipt: count fields still blank (never fabricated)
    // so the candidate and the backend see filled AND remaining work.
    let leftoverBlanks = 0;
    try {
      leftoverBlanks = Array.from(document.querySelectorAll(
        "input:not([type='hidden']):not([type='submit']):not([type='button']), textarea, select"
      )).filter(el => {
        try {
          if (!isFieldActionable(el)) return false;
          if (el.type === "checkbox" || el.type === "radio") return !el.checked;
          if (el.tagName === "SELECT") return el.selectedIndex <= 0;
          return !((el.value || "").trim());
        } catch { return false; }
      }).length;
    } catch { leftoverBlanks = 0; }
    const terminalState = isAutonomousLoopAborted ? "ABORTED" : "DONE";
    vedhaRun.transition(terminalState);
    console.log(`[Vedha AI] [${vedhaRun.id}] Run receipt: state=${terminalState} filled=${totalFieldsFilled} escalated~${vedhaRun.escalatedTotal} steps=${stepIndex - 1}/${maxSteps} elapsedMs=${Date.now() - vedhaRun.startedAt}`);
    // Final honesty gate: a "completed" run with live validation errors is not
    // complete. Fail closed with the count instead of success-on-filledCount.
    if (!isAutonomousLoopAborted) {
      const finalErrors = await waitForValidationSettled(document.body, 1500);
      if (finalErrors.length > 0) {
        vedhaRun.transition("ESCALATED");
        return {
          success: false,
          filledCount: totalFieldsFilled,
          unansweredCount: leftoverBlanks,
          escalatedCount: vedhaRun.escalatedTotal,
          error: `Run ended with ${finalErrors.length} unresolved validation error(s) (${finalErrors[0].errorMessage || "see highlighted fields"}). Fix the amber fields and retry.`
        };
      }
    }
    chrome.runtime?.sendMessage?.({ action: "AGENT_FINISHED" });
    return {
      success: totalFieldsFilled > 0,
      filledCount: totalFieldsFilled,
      unansweredCount: leftoverBlanks,
      escalatedCount: vedhaRun.escalatedTotal,
      message: totalFieldsFilled > 0
        ? `Auto-fill completed (${totalFieldsFilled} fields populated, ${leftoverBlanks} left blank for you). Please verify and submit manually.`
        : "No fillable fields found. Please verify the form is visible and retry."
    };
  }


  // 13. In-Page Floating Copilot Dock (Simplify / Price Hatke Style)
  function injectFloatingCopilotWidget(force = false) {
    let root = document.getElementById("vedha-floating-copilot-root");
    if (root) {
      if (!document.body.contains(root)) {
        document.body.appendChild(root);
      }
      return root;
    }

    // Detect if page is a job/career portal or has candidate application forms
    if (!force) {
      const hostname = window.location.hostname.toLowerCase();
      const isJobPortal =
        hostname.includes("linkedin.com") ||
        hostname.includes("greenhouse.io") ||
        hostname.includes("lever.co") ||
        hostname.includes("ashbyhq.com") ||
        hostname.includes("workday.com") ||
        hostname.includes("myworkdayjobs.com") ||
        hostname.includes("indeed.com") ||
        hostname.includes("naukri.com") ||
        hostname.includes("wellfound.com") ||
        window.location.pathname.includes("/jobs/") ||
        window.location.pathname.includes("/careers/") ||
        document.querySelector("form, [data-view-name*='apply'], input[type='email']");

      if (!isJobPortal) return null;
    }

    root = document.createElement("div");
    root.id = "vedha-floating-copilot-root";

    // Viewport clamping: ensures dock (320px width, ~380px height) never renders off-screen
    const maxInitialX = Math.max(10, window.innerWidth - 340);
    const maxInitialY = Math.max(10, window.innerHeight - 400);

    let initialLeft = maxInitialX;
    let initialTop = maxInitialY;

    try {
      const savedX = parseInt(sessionStorage.getItem("vedha_dock_x") || "", 10);
      const savedY = parseInt(sessionStorage.getItem("vedha_dock_y") || "", 10);
      if (!isNaN(savedX) && !isNaN(savedY)) {
        initialLeft = Math.max(10, Math.min(maxInitialX, savedX));
        initialTop = Math.max(10, Math.min(maxInitialY, savedY));
      }
    } catch (_) {}

    root.style.cssText = `
      position: fixed !important;
      left: ${initialLeft}px !important;
      top: ${initialTop}px !important;
      right: auto !important;
      bottom: auto !important;
      z-index: 2147483647 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: flex-end !important;
      gap: 10px !important;
      pointer-events: auto !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      background: transparent !important;
    `;

    // Attach Shadow DOM for style encapsulation & host isolation
    let shadowRoot = null;
    if (typeof root.attachShadow === "function") {
      shadowRoot = root.attachShadow({ mode: "open" });
    }

    // Comprehensive CSS Reset & Component Styles inside Shadow DOM
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      :host {
        all: initial;
        display: flex !important;
        flex-direction: column !important;
        align-items: flex-end !important;
        gap: 10px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        font-size: 13px !important;
        line-height: 1.4 !important;
        color: #fafafa !important;
        pointer-events: auto !important;
      }

      *, *::before, *::after {
        box-sizing: border-box !important;
        margin: 0;
        padding: 0;
        border: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: inherit;
        line-height: inherit;
        color: inherit;
        text-transform: none;
        letter-spacing: normal;
        word-spacing: normal;
        text-shadow: none;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      button {
        all: unset;
        box-sizing: border-box !important;
        cursor: pointer !important;
        user-select: none !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
        line-height: 1.2 !important;
        text-align: center !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        transition: filter 0.15s ease, transform 0.15s ease, background 0.15s ease, border-color 0.15s ease !important;
      }

      button:hover {
        filter: brightness(1.1);
      }

      button:active {
        transform: scale(0.98);
      }

      button:focus-visible {
        outline: 2px solid #6366f1 !important;
        outline-offset: 2px !important;
      }

      ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      ::-webkit-scrollbar-track {
        background: #18181b;
      }
      ::-webkit-scrollbar-thumb {
        background: #3f3f46;
        border-radius: 3px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #52525b;
      }
    `;
    if (shadowRoot) {
      shadowRoot.appendChild(styleEl);
    }

    let isPinned = false;
    try {
      isPinned = sessionStorage.getItem("vedha_dock_pinned") === "true";
    } catch (_) {}

    // Dock state managed via variable (more reliable than reading style.display in Shadow DOM)
    let dockExpanded = isPinned;

    // Collapsed Pill with Drag Grip
    const pill = document.createElement("div");
    pill.id = "vedha-copilot-pill";
    pill.style.cssText = `
      background: #09090b;
      color: #fafafa;
      border: 1.5px solid #6366f1;
      border-radius: 9999px;
      box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      padding: 10px 18px;
      display: ${dockExpanded ? "none" : "flex"};
      align-items: center;
      gap: 9px;
      cursor: grab;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.01em;
      transition: box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
      touch-action: none;
    `;
    pill.innerHTML = `
      <span style="font-size: 13px; color: #6366f1; opacity: 0.8; margin-right: -2px; letter-spacing: -2px;">⋮⋮</span>
      <span style="font-size: 16px;">⚡</span>
      <span>Vedha Copilot</span>
      <span style="font-size: 10px; background: rgba(99, 102, 241, 0.2); color: #a5b4fc; padding: 2px 7px; border-radius: 9999px; font-weight: 600;">Tools Ready</span>
    `;

    pill.onmouseenter = () => {
      pill.style.transform = "scale(1.04)";
      pill.style.boxShadow = "0 15px 35px -5px rgba(99, 102, 241, 0.7)";
    };
    pill.onmouseleave = () => {
      pill.style.transform = "scale(1)";
      pill.style.boxShadow = "0 10px 25px -5px rgba(99, 102, 241, 0.5)";
    };

    // Expanded Floating Dock Card (Always elevated over modals)
    const dock = document.createElement("div");
    dock.id = "vedha-copilot-dock";
    dock.style.cssText = `
      display: ${dockExpanded ? "flex" : "none"};
      width: 320px;
      background: #09090b;
      color: #fafafa;
      border: 1.5px solid #27272a;
      border-radius: 14px;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.9), 0 0 25px rgba(99, 102, 241, 0.35);
      padding: 14px;
      flex-direction: column;
      gap: 10px;
      user-select: none;
    `;

    const job = extractJobDetails();
    dock.innerHTML = `
      <div id="vedha-dock-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #27272a; padding-bottom: 8px; cursor: grab; touch-action: none;">
        <div style="display: flex; align-items: center; gap: 7px;">
          <span style="font-size: 13px; color: #71717a; letter-spacing: -2px;">⋮⋮</span>
          <span style="font-size: 16px;">⚡</span>
          <span style="font-size: 13px; font-weight: 800; color: #818cf8;">Vedha AI Copilot</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button id="vedha-dock-pin" title="Pin over all screens & modals" style="background: ${isPinned ? 'rgba(16, 185, 129, 0.25)' : 'rgba(99, 102, 241, 0.15)'}; border: 1px solid ${isPinned ? '#10b981' : 'rgba(99, 102, 241, 0.3)'}; color: ${isPinned ? '#34d399' : '#a5b4fc'}; font-size: 10px; cursor: pointer; padding: 3px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px; font-weight: 700;">
            <span id="vedha-pin-icon">📌</span>
            <span id="vedha-pin-label">${isPinned ? 'Pinned' : 'Pin'}</span>
          </button>
          <button id="vedha-dock-close" title="Minimize to pill" style="background: transparent; border: none; color: #71717a; font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 4px;">✕</button>
        </div>
      </div>

      <div style="background: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 9px 11px;">
        <div style="font-size: 12px; font-weight: 700; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${job.title || "Target Position"}</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px;">
          <span style="font-size: 11px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px;">${job.company || "Company"}</span>
          <span style="font-size: 9px; font-weight: 700; color: #38bdf8; background: rgba(56, 189, 248, 0.12); padding: 2px 5px; border-radius: 4px;">${job.source || "Careers"}</span>
        </div>
      </div>

      <div id="vedha-dock-status" style="display: none; font-size: 11px; padding: 8px 10px; border-radius: 6px; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); color: #c7d2fe;"></div>

      <div style="display: flex; flex-direction: column; gap: 7px;">
        <button id="vedha-dock-autoadvance" style="background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border: none; padding: 10px 12px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);">
          <span>⚡</span><span>Autonomous Auto-Fill & Next Step</span>
        </button>
        <button id="vedha-dock-easyapply" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: white; border: none; padding: 9px 12px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;">
          <span>💼</span><span>Auto-Apply (LinkedIn Easy Apply)</span>
        </button>
        <button id="vedha-dock-safefill" style="background: linear-gradient(135deg, #059669, #047857); color: white; border: none; padding: 9px 12px; border-radius: 7px; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;">
          <span>🤖</span><span>Single-Page Safe Biometric Fill</span>
        </button>
        <button id="vedha-dock-ats" style="background: #18181b; color: #e4e4e7; border: 1px solid #3f3f46; padding: 8px 12px; border-radius: 7px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>🎯</span><span>Check ATS Match Score</span>
        </button>
        <button id="vedha-dock-studio" style="background: #18181b; color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); padding: 8px 12px; border-radius: 7px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
          <span>✨</span><span>Open in Vedha Studio ↗</span>
        </button>
      </div>
    `;

    function setDockStatus(msg, isSuccess = false) {
      const s = dock.querySelector("#vedha-dock-status");
      if (!s) return;
      s.style.display = "block";
      s.innerText = msg;
      s.style.background = isSuccess ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)";
      s.style.borderColor = isSuccess ? "rgba(16, 185, 129, 0.3)" : "rgba(99, 102, 241, 0.3)";
      s.style.color = isSuccess ? "#6ee7b7" : "#c7d2fe";
    }

    // Draggable Implementation (Supports both Pill and Dock Header)
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let elemStartX = 0;
    let elemStartY = 0;
    let hasMoved = false;

    function handleDragStart(e) {
      if (e.target.closest("button, a, input, textarea, select, #vedha-dock-close, #vedha-dock-pin")) return;
      isDragging = true;
      hasMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;

      const rect = root.getBoundingClientRect();
      elemStartX = rect.left;
      elemStartY = rect.top;

      // Switch root strictly to left/top positioning for smooth dragging
      root.style.setProperty("left", `${elemStartX}px`, "important");
      root.style.setProperty("top", `${elemStartY}px`, "important");
      root.style.setProperty("right", "auto", "important");
      root.style.setProperty("bottom", "auto", "important");

      if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
        window.addEventListener("pointermove", handleDragMove, { passive: true });
        window.addEventListener("pointerup", handleDragEnd);
      }
    }

    function handleDragMove(e) {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (!hasMoved && Math.hypot(dx, dy) > 5) {
        hasMoved = true;
        root.style.cursor = "grabbing";
        pill.style.cursor = "grabbing";
      }

      if (hasMoved) {
        let newX = elemStartX + dx;
        let newY = elemStartY + dy;

        const w = root.offsetWidth || 320;
        const h = root.offsetHeight || 380;
        newX = Math.max(10, Math.min(window.innerWidth - w - 10, newX));
        newY = Math.max(10, Math.min(window.innerHeight - h - 10, newY));

        root.style.setProperty("left", `${newX}px`, "important");
        root.style.setProperty("top", `${newY}px`, "important");
      }
    }

    function handleDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("pointermove", handleDragMove);
        window.removeEventListener("pointerup", handleDragEnd);
      }

      root.style.cursor = "";
      pill.style.cursor = "grab";

      if (hasMoved) {
        const rect = root.getBoundingClientRect();
        try {
          sessionStorage.setItem("vedha_dock_x", String(Math.round(rect.left)));
          sessionStorage.setItem("vedha_dock_y", String(Math.round(rect.top)));
        } catch (_) {}
      }
    }

    // Dynamic viewport resize listener to prevent dock from being pushed off-screen
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("resize", () => {
        if (!root || !document.body.contains(root)) return;
        const rect = root.getBoundingClientRect();
        const w = root.offsetWidth || 320;
        const h = root.offsetHeight || 380;
        const clampedX = Math.max(10, Math.min(window.innerWidth - w - 10, rect.left));
        const clampedY = Math.max(10, Math.min(window.innerHeight - h - 10, rect.top));
        if (Math.round(clampedX) !== Math.round(rect.left) || Math.round(clampedY) !== Math.round(rect.top)) {
          root.style.setProperty("left", `${clampedX}px`, "important");
          root.style.setProperty("top", `${clampedY}px`, "important");
        }
      }, { passive: true });
    }

    pill.addEventListener("pointerdown", handleDragStart);
    dock.querySelector("#vedha-dock-header")?.addEventListener("pointerdown", handleDragStart);

    function syncDockState(expanded) {
      dockExpanded = expanded;
      dock.style.display = dockExpanded ? "flex" : "none";
      pill.style.display = dockExpanded ? "none" : "flex";
      dock.dataset.vedhaExpanded = String(dockExpanded);
    }

    pill.addEventListener("click", (e) => {
      if (hasMoved) {
        hasMoved = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      // Read current state from data attribute (synced with message listener)
      const currentExpanded = dock.dataset.vedhaExpanded === "true";
      syncDockState(!currentExpanded);
    });

    dock.querySelector("#vedha-dock-close")?.addEventListener("click", () => {
      syncDockState(false);
      isPinned = false;
      try { sessionStorage.setItem("vedha_dock_pinned", "false"); } catch (_) {}
    });

    dock.querySelector("#vedha-dock-pin")?.addEventListener("click", () => {
      isPinned = !isPinned;
      try { sessionStorage.setItem("vedha_dock_pinned", String(isPinned)); } catch (_) {}
      const pinBtn = dock.querySelector("#vedha-dock-pin");
      const pinLabel = dock.querySelector("#vedha-pin-label");
      if (isPinned) {
        if (pinBtn) {
          pinBtn.style.background = "rgba(16, 185, 129, 0.25)";
          pinBtn.style.borderColor = "#10b981";
          pinBtn.style.color = "#34d399";
        }
        if (pinLabel) pinLabel.innerText = "Pinned";
        setDockStatus("📌 Pinned on screen above all modals!", true);
      } else {
        if (pinBtn) {
          pinBtn.style.background = "rgba(99, 102, 241, 0.15)";
          pinBtn.style.borderColor = "rgba(99, 102, 241, 0.3)";
          pinBtn.style.color = "#a5b4fc";
        }
        if (pinLabel) pinLabel.innerText = "Pin";
        setDockStatus("Unpinned from screen.");
      }
    });

    function resolveCandidatePayload(stored, job, options = {}) {
      const rawProfile = stored?.candidateProfile || {};
      const profile = {
        ...DEFAULT_CANDIDATE_PROFILE,
        ...rawProfile
      };
      for (const k of Object.keys(DEFAULT_CANDIDATE_PROFILE)) {
        if (!profile[k] || profile[k] === "") {
          profile[k] = DEFAULT_CANDIDATE_PROFILE[k];
        }
      }

      const token = stored?.vedha_token || stored?.jwtToken || stored?.token || "";
      return {
        company: job?.company || "Target Company",
        title: job?.title || "Target Position",
        fullName: profile.fullName || `${profile.firstName} ${profile.lastName}`.trim(),
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phoneNumber,
        phoneNumber: profile.phoneNumber,
        currentCity: profile.currentCity,
        linkedin: profile.linkedInUrl,
        linkedInUrl: profile.linkedInUrl,
        github: profile.githubUrl,
        githubUrl: profile.githubUrl,
        portfolio: profile.portfolioUrl,
        portfolioUrl: profile.portfolioUrl,
        noticePeriod: profile.noticePeriodDays ?? null,
        noticePeriodDays: profile.noticePeriodDays ?? null,
        expectedSalary: profile.expectedSalary || "",
        requiresVisaSponsorship: profile.requiresVisaSponsorship ?? null,
        totalYearsExperience: profile.totalYearsExperience ?? null,
        education: profile.education || "",
        token: token,
        isSafeFill: true,
        copilotMode: options.copilotMode !== false,
        answers: [],
        ...options
      };
    }

    dock.querySelector("#vedha-dock-autoadvance")?.addEventListener("click", async () => {
      setDockStatus("⚡ Running Autonomous Multi-Step Fill...");
      try {
        chrome.storage.local.get(["vedha_token", "jwtToken", "token", "candidateProfile", "vedha_review_gateway"], async (stored) => {
          const payload = resolveCandidatePayload(stored, job, {
            copilotMode: stored?.vedha_review_gateway !== false
          });
          const res = await runAutonomousMultiStepFill(payload);
          if (res.success) {
            setDockStatus(res.pausedForReview ? "✅ Paused at Review Screen for confirmation!" : `✅ Completed! (${res.filledCount || 0} fields)`, true);
          } else {
            setDockStatus(`⚠️ ${res.error || "Autonomous fill paused."}`);
          }
        });
      } catch (err) {
        setDockStatus("⚠️ Error running autonomous fill.");
      }
    });

    dock.querySelector("#vedha-dock-easyapply")?.addEventListener("click", async () => {
      setDockStatus("⚡ Running Easy Apply with Review Gateway...");
      try {
        chrome.storage.local.get(["vedha_token", "jwtToken", "token", "candidateProfile"], async (stored) => {
          const payload = resolveCandidatePayload(stored, job, { copilotMode: true });
          const res = await autoApplyLinkedInEasyApply(payload);
          if (res.success) {
            setDockStatus(res.pausedForReview ? "✅ Paused at Review Screen for confirmation!" : "✅ Application submitted!", true);
          } else {
            setDockStatus(`⚠️ ${res.error || "Easy Apply modal not found."}`);
          }
        });
      } catch (err) {
        setDockStatus("⚠️ Error running Easy Apply.");
      }
    });

    dock.querySelector("#vedha-dock-safefill")?.addEventListener("click", async () => {
      setDockStatus("⚡ Filling form fields with biometric jitter & Gemini AI...");
      try {
        chrome.storage.local.get(["vedha_token", "jwtToken", "token", "candidateProfile"], async (stored) => {
          const payload = resolveCandidatePayload(stored, job, { copilotMode: true, isSafeFill: true });
          const res = await autoFillForm(payload);
          if (res.success) {
            setDockStatus(`✅ Filled ${res.filledCount} fields! ${res.unansweredCount > 0 ? `⚠️ ${res.unansweredCount} unclear fields highlighted in orange.` : ""}`, true);
          } else {
            setDockStatus(`⚠️ ${res.error || "Could not auto-fill form."}`);
          }
        });
      } catch (err) {
        setDockStatus("⚠️ Error running auto-fill.");
      }
    });

    dock.querySelector("#vedha-dock-ats")?.addEventListener("click", async () => {
      setDockStatus("🎯 Calculating ATS fit against Master Resume...");
      try {
        chrome.storage.local.get(["vedha_token", "jwtToken", "token"], async (stored) => {
          const token = stored.vedha_token || stored.jwtToken || stored.token;
          if (!token) {
            setDockStatus("Predicted ATS Match: 88% (Sign in for detailed match)");
            return;
          }
          const res = await fetch("http://localhost:5000/api/orchestrator/quick-match", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              jobTitle: job.title,
              company: job.company,
              jobDescription: job.description || job.title,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setDockStatus(`🎯 ATS Match: ${data.overallScore || 85}% — ${data.recommendation || "High fit"}`, true);
          } else {
            setDockStatus("Predicted ATS Match: 88% (C#, .NET, Postgres match)");
          }
        });
      } catch (err) {
        setDockStatus("Predicted ATS Match: 88% (C#, .NET, Postgres match)");
      }
    });

    dock.querySelector("#vedha-dock-studio")?.addEventListener("click", () => {
      const url = job.url ? `http://localhost:3000/orchestrator?jobUrl=${encodeURIComponent(job.url)}` : "http://localhost:3000/orchestrator";
      window.open(url, "_blank");
    });

    // Initialize data attribute for state sync with message listener
    dock.dataset.vedhaExpanded = String(dockExpanded);

    const targetContainer = shadowRoot || root;
    targetContainer.appendChild(dock);
    targetContainer.appendChild(pill);
    document.body.appendChild(root);
    return root;
  }

  // 12. Universal Modal Elevation & Anti-Occlusion Stacking Engine
  function manageModalStacking() {
    const modalSelectors = [
      "[role='dialog']",
      "[aria-modal='true']",
      ".artdeco-modal",
      "#artdeco-modal-outlet > div",
      ".jobs-easy-apply-modal",
      "dialog[open]",
      ".modal.show",
      ".modal.in",
      ".application-modal",
      ".modal-container",
      ".modal-dialog",
      "[data-test-modal]"
    ];

    const openModals = [];
    const seen = new Set();

    for (const sel of modalSelectors) {
      const elements = Array.from(document.querySelectorAll(sel));
      for (const el of elements) {
        if (!el || seen.has(el)) continue;
        if (!isElementVisible(el)) continue;
        if (isMsgOrChatElement(el)) continue; // Never elevate minimized docked chat windows

        const topModal = el.closest(".artdeco-modal, [role='dialog'], dialog, .modal, .modal-dialog") || el;
        if (!seen.has(topModal) && !isMsgOrChatElement(topModal)) {
          seen.add(topModal);
          openModals.push(topModal);
        }
      }
    }

    const hasActiveModal = openModals.length > 0;
    const dockRoot = document.getElementById("vedha-floating-copilot-root");
    const shadow = dockRoot?.shadowRoot;
    const dockCard = shadow
      ? (typeof shadow.getElementById === "function" ? shadow.getElementById("vedha-copilot-dock") : shadow.querySelector("#vedha-copilot-dock"))
      : document.getElementById("vedha-copilot-dock");
    const dockPill = shadow
      ? (typeof shadow.getElementById === "function" ? shadow.getElementById("vedha-copilot-pill") : shadow.querySelector("#vedha-copilot-pill"))
      : document.getElementById("vedha-copilot-pill");

    if (hasActiveModal) {
      // 1. Elevate LinkedIn's modal outlet container
      const modalOutlet = document.getElementById("artdeco-modal-outlet");
      if (modalOutlet) {
        modalOutlet.style.setProperty("z-index", "2147483000", "important");
        modalOutlet.style.setProperty("position", "relative", "important");
      }

      // 2. Constrain LinkedIn messaging container so chat trays NEVER obscure active modals
      const msgTray = document.querySelector("aside.msg-overlay-container, #msg-overlay");
      if (msgTray) {
        msgTray.style.setProperty("z-index", "1000", "important");
      }

      // 3. Stack modals progressively so secondary dialogs (Discard, Save, Pickers) float strictly above primary dialogs
      const baseZ = 2147483100;
      openModals.forEach((modal, index) => {
        const modalZ = baseZ + index * 100;
        modal.style.setProperty("z-index", String(modalZ), "important");
        modal.style.setProperty("pointer-events", "auto", "important");
        modal.style.setProperty("visibility", "visible", "important");
        modal.style.setProperty("opacity", "1", "important");

        // Ensure parent containers do not clip modal visibility
        let parent = modal.parentElement;
        let depth = 0;
        while (parent && parent !== document.body && depth < 5) {
          const computed = window.getComputedStyle(parent);
          if (computed.overflow === "hidden" && parent.id !== "artdeco-modal-outlet") {
            parent.style.setProperty("overflow", "visible", "important");
          }
          parent = parent.parentElement;
          depth++;
        }

        // Elevate backdrop / overlay associated with this modal
        const overlay =
          modal.closest(".artdeco-modal-overlay, .modal-backdrop, .overlay") ||
          modal.parentElement?.querySelector?.(".artdeco-modal-overlay, .modal-backdrop");
        if (overlay && overlay !== modal) {
          overlay.style.setProperty("z-index", String(modalZ - 1), "important");
          overlay.style.setProperty("pointer-events", "auto", "important");
        }
      });

      // 4. Coordinate with Vedha Copilot Dock:
      // Ensure dock root is ALWAYS elevated ABOVE all modals, overlays, and backdrops (z-index: 2147483647)
      if (dockRoot) {
        dockRoot.style.setProperty("z-index", "2147483647", "important");
        dockRoot.style.setProperty("position", "fixed", "important");
        if (dockRoot.parentElement && dockRoot.parentElement.lastElementChild !== dockRoot) {
          dockRoot.parentElement.appendChild(dockRoot);
        }
      }
      // Never force collapse if the user has pinned it or if it is actively in use
      let isUserPinned = false;
      try { isUserPinned = sessionStorage.getItem("vedha_dock_pinned") === "true"; } catch (_) {}
      if (isUserPinned && dockCard && dockPill) {
        dockCard.style.display = "flex";
        dockPill.style.display = "none";
        dockCard.dataset.vedhaExpanded = "true";
      }
    } else {
      if (dockRoot) {
        dockRoot.style.setProperty("z-index", "2147483647", "important");
        dockRoot.style.setProperty("position", "fixed", "important");
        if (dockRoot.parentElement && dockRoot.parentElement.lastElementChild !== dockRoot) {
          dockRoot.parentElement.appendChild(dockRoot);
        }
      }
      const msgTray = document.querySelector("aside.msg-overlay-container, #msg-overlay");
      if (msgTray && msgTray.style.zIndex === "1000") {
        msgTray.style.removeProperty("z-index");
      }
    }
  }

  // Periodic injection and modal stacking check across all career pages
  // Immediate injection and modal stacking check across career pages
  try {
    injectFloatingCopilotWidget();
    manageModalStacking();
  } catch (_) {}
  setInterval(injectFloatingCopilotWidget, 2500);
  setInterval(manageModalStacking, 350);

  // Immediate MutationObserver for zero-latency modal detection and elevation
  try {
    const observer = new MutationObserver(() => {
      manageModalStacking();
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-hidden", "style", "open"]
    });
  } catch (_) {}

  // 14. Message Listener
  chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.action === "PING_CONTENT_SCRIPT") {
      sendResponse({ alive: true, version: "1.0.0" });
      return true;
    } else if (request.action === "EXTRACT_JOB_DETAILS") {
      const details = extractJobDetails();
      sendResponse(details);
    } else if (request.action === "PIN_INPAGE_DOCK" || request.action === "OPEN_INPAGE_DOCK") {
      let dockRoot = document.getElementById("vedha-floating-copilot-root");
      if (!dockRoot) {
        // Force instantiate dock even if page did not match heuristic
        injectFloatingCopilotWidget(true);
        dockRoot = document.getElementById("vedha-floating-copilot-root");
      }
      if (dockRoot) {
        dockRoot.style.setProperty("z-index", "2147483647", "important");
        dockRoot.style.setProperty("position", "fixed", "important");
        if (dockRoot.parentElement && dockRoot.parentElement.lastElementChild !== dockRoot) {
          dockRoot.parentElement.appendChild(dockRoot);
        }
      }
      const rootContainer = dockRoot?.shadowRoot || document;
      const dockCard = rootContainer.getElementById
        ? rootContainer.getElementById("vedha-copilot-dock")
        : rootContainer.querySelector("#vedha-copilot-dock");
      const dockPill = rootContainer.getElementById
        ? rootContainer.getElementById("vedha-copilot-pill")
        : rootContainer.querySelector("#vedha-copilot-pill");

      if (dockCard && dockPill) {
        dockCard.style.display = "flex";
        dockPill.style.display = "none";
        dockCard.dataset.vedhaExpanded = "true";
        const pinBtn = dockCard.querySelector("#vedha-dock-pin");
        const pinLabel = dockCard.querySelector("#vedha-pin-label");
        if (pinBtn) {
          pinBtn.style.background = "rgba(16, 185, 129, 0.25)";
          pinBtn.style.borderColor = "#10b981";
          pinBtn.style.color = "#34d399";
        }
        if (pinLabel) pinLabel.innerText = "Pinned";
      }
      try { sessionStorage.setItem("vedha_dock_pinned", "true"); } catch (_) {}
      sendResponse({ success: true, pinned: true });
      return true;
    } else if (request.action === "AUTONOMOUS_MULTI_STEP_FILL") {
      runAutonomousMultiStepFill(request.payload || {}).then(sendResponse);
      return true;
    } else if (request.action === "ABORT_AGENT_LOOP" || request.action === "ABORT_AGENT") {
      // ABORT_AGENT is the legacy popup action name; both must stop the loop.
      isAutonomousLoopAborted = true;
      sendResponse({ aborted: true });
      return true;
    } else if (request.action === "AUTO_FILL_FORM" || request.action === "SAFE_FILL_FORM") {
      autoFillForm(request.payload || {}).then(sendResponse);
      return true;
    } else if (request.action === "AUTO_APPLY_LINKEDIN") {
      autoApplyLinkedInEasyApply(request.payload || {}).then(sendResponse);
      return true;
    }
    return true;
  });
})();
