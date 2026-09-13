// Vedha AI Content Scraper & Biometric Anti-Ban Auto-Fill Copilot Script
// Equipped with Cloudflare Turnstile Detection, CAPTCHA Human Verification Gateway, and Biometric Mouse Trajectory Simulation
(function () {
  // Keep the authenticated web app session available to the extension popup.
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
  }

  syncWebAppToken();

  // 1. Enhanced Honeypot & Bot-Trap Detector
  function isElementVisible(el) {
    if (!el) return false;
    if (el.offsetParent === null && el.tagName !== "BODY") return false;

    const style = window.getComputedStyle(el);
    if (
      style.visibility === "hidden" ||
      style.display === "none" ||
      style.opacity === "0"
    )
      return false;

    // Detect CSS off-screen positioning traps (e.g. left: -9999px, text-indent: -9999px)
    const rect = el.getBoundingClientRect();
    if (
      rect.left < -100 ||
      rect.top < -100 ||
      rect.width === 0 ||
      rect.height === 0
    )
      return false;

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
    if (honeypotKeywords.some((k) => name.includes(k) || id.includes(k)))
      return false;

    if (
      el.getAttribute("aria-hidden") === "true" ||
      el.getAttribute("tabindex") === "-1"
    ) {
      if (rect.width <= 1 || rect.height <= 1) return false;
    }

    return rect.width > 0 && rect.height > 0;
  }

  // 2. Cloudflare Turnstile, reCAPTCHA & WAF Challenge Detector
  function detectCaptchaOrChallenge() {
    // Cloudflare Turnstile
    const cfTurnstile = document.querySelector(
      'iframe[src*="challenges.cloudflare.com"], .cf-turnstile, #cf-turnstile, iframe[title*="Cloudflare"], div[id*="cf-turnstile"]',
    );
    if (cfTurnstile)
      return { type: "Cloudflare Turnstile", element: cfTurnstile };

    // Google reCAPTCHA
    const recaptcha = document.querySelector(
      '.g-recaptcha, iframe[src*="recaptcha"], textarea[name="g-recaptcha-response"]',
    );
    if (recaptcha) return { type: "Google reCAPTCHA", element: recaptcha };

    // hCaptcha
    const hcaptcha = document.querySelector(
      '.h-captcha, iframe[src*="hcaptcha"]',
    );
    if (hcaptcha) return { type: "hCaptcha", element: hcaptcha };

    // Generic WAF challenge banner
    const challenge = document.querySelector(
      "#challenge-running, .ray-id, #captcha-container",
    );
    if (challenge)
      return { type: "WAF Security Challenge", element: challenge };

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

    // Highlight the CAPTCHA element with pulsing border
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

  // 5. Humanized Biometric Keystroke Jitter & Typo Simulation
  async function typeLikeHuman(el, text) {
    if (!el || !text) return false;

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await simulatePointerInteraction(el);
    el.focus();
    await sleep(randomBetween(100, 220));

    el.value = "";
    el.dispatchEvent(new Event("focus", { bubbles: true }));

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Occasional realistic typo simulation (1 in 50 characters)
      if (
        text.length > 8 &&
        i > 2 &&
        i < text.length - 2 &&
        Math.random() < 0.02
      ) {
        const typoChar = String.fromCharCode(char.charCodeAt(0) + 1);
        el.value += typoChar;
        el.dispatchEvent(
          new InputEvent("input", { data: typoChar, bubbles: true }),
        );
        await sleep(randomBetween(80, 160));
        // Backspace
        el.value = el.value.slice(0, -1);
        el.dispatchEvent(
          new InputEvent("input", {
            data: "",
            inputType: "deleteContentBackward",
            bubbles: true,
          }),
        );
        await sleep(randomBetween(90, 180));
      }

      el.value += char;
      el.dispatchEvent(
        new KeyboardEvent("keydown", { key: char, bubbles: true }),
      );
      el.dispatchEvent(new InputEvent("input", { data: char, bubbles: true }));
      el.dispatchEvent(
        new KeyboardEvent("keyup", { key: char, bubbles: true }),
      );

      // Natural Gaussian keystroke delay (40ms to 90ms)
      await sleep(randomBetween(40, 90));
    }

    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    await sleep(randomBetween(120, 260));
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

  // 7. Safe AutoFill Form Execution with Honeypot Evasion & CAPTCHA Pause
  async function autoFillForm(payload) {
    // 1. First check if a CAPTCHA or Turnstile challenge is active on page
    const challenge = detectCaptchaOrChallenge();
    if (challenge) {
      await new Promise((resolve) => {
        showCaptchaGatewayBanner(challenge, resolve);
      });
      await sleep(1000);
    }

    let filledCount = 0;
    const allInputs = Array.from(
      document.querySelectorAll("input, textarea, select"),
    );
    // Filter out honeypots and invisible traps
    const inputs = allInputs.filter(isElementVisible);

    for (const input of inputs) {
      const name = (input.getAttribute("name") || "").toLowerCase();
      const id = (input.getAttribute("id") || "").toLowerCase();
      const placeholder = (
        input.getAttribute("placeholder") || ""
      ).toLowerCase();
      const ariaLabel = (input.getAttribute("aria-label") || "").toLowerCase();

      let labelText = "";
      if (input.id) {
        const lbl = document.querySelector(`label[for="${input.id}"]`);
        if (lbl) labelText = lbl.innerText.toLowerCase();
      }
      if (!labelText) {
        const parentLabel = input.closest("label");
        if (parentLabel) labelText = parentLabel.innerText.toLowerCase();
      }

      const descriptor =
        `${name} ${id} ${placeholder} ${ariaLabel} ${labelText}`.trim();

      // Skip non-interactive types
      if (
        input.type === "hidden" ||
        input.type === "submit" ||
        input.type === "button" ||
        input.type === "reset"
      )
        continue;

      // Dropdown / Select element support
      if (input.tagName === "SELECT") {
        const select = input;
        let chosenValue = null;

        if (
          descriptor.includes("work authorization") ||
          descriptor.includes("authorized to work")
        ) {
          chosenValue = Array.from(select.options).find(
            (o) =>
              o.text.toLowerCase().includes("yes") ||
              o.text.toLowerCase().includes("authorized"),
          )?.value;
        } else if (
          descriptor.includes("sponsorship") ||
          descriptor.includes("require visa")
        ) {
          chosenValue = Array.from(select.options).find((o) =>
            o.text.toLowerCase().includes("no"),
          )?.value;
        } else if (descriptor.includes("relocate")) {
          chosenValue = Array.from(select.options).find((o) =>
            o.text.toLowerCase().includes("yes"),
          )?.value;
        }

        if (chosenValue) {
          select.value = chosenValue;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          filledCount++;
          await sleep(randomBetween(100, 200));
        }
        continue;
      }

      // Text and standard input fields
      if (
        descriptor.includes("first name") ||
        descriptor.includes("given name") ||
        name === "fname" ||
        id === "first_name"
      ) {
        if (
          await typeLikeHuman(
            input,
            payload.firstName || payload.fullName?.split(" ")[0] || "",
          )
        )
          filledCount++;
      } else if (
        descriptor.includes("last name") ||
        descriptor.includes("family name") ||
        descriptor.includes("surname") ||
        name === "lname" ||
        id === "last_name"
      ) {
        const parts = (payload.fullName || "").split(" ");
        if (
          await typeLikeHuman(
            input,
            payload.lastName ||
              (parts.length > 1 ? parts.slice(1).join(" ") : ""),
          )
        )
          filledCount++;
      } else if (
        descriptor.includes("full name") ||
        (descriptor.includes("name") &&
          !descriptor.includes("company") &&
          !descriptor.includes("file"))
      ) {
        if (await typeLikeHuman(input, payload.fullName || "")) filledCount++;
      } else if (input.type === "email" || descriptor.includes("email")) {
        if (await typeLikeHuman(input, payload.email || "")) filledCount++;
      } else if (
        input.type === "tel" ||
        descriptor.includes("phone") ||
        descriptor.includes("mobile")
      ) {
        if (await typeLikeHuman(input, payload.phone || "")) filledCount++;
      } else if (
        descriptor.includes("city") ||
        descriptor.includes("location") ||
        descriptor.includes("address")
      ) {
        if (await typeLikeHuman(input, payload.currentCity || ""))
          filledCount++;
      } else if (descriptor.includes("linkedin")) {
        if (await typeLikeHuman(input, payload.linkedin || "")) filledCount++;
      } else if (descriptor.includes("github")) {
        if (await typeLikeHuman(input, payload.github || "")) filledCount++;
      } else if (
        descriptor.includes("portfolio") ||
        descriptor.includes("website")
      ) {
        if (await typeLikeHuman(input, payload.portfolio || "")) filledCount++;
      } else if (
        descriptor.includes("notice period") ||
        descriptor.includes("start date")
      ) {
        const val = payload.noticePeriod
          ? `${payload.noticePeriod} days`
          : "Immediate";
        await typeLikeHuman(input, val);
        filledCount++;
      } else if (
        descriptor.includes("salary") ||
        descriptor.includes("compensation") ||
        descriptor.includes("ctc")
      ) {
        if (await typeLikeHuman(input, payload.expectedSalary || ""))
          filledCount++;
      }
    }

    // Scroll to top smoothly for candidate review
    window.scrollTo({ top: 0, behavior: "smooth" });

    return { success: true, filledCount };
  }

  // 8. Message Listener
  chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT_JOB_DETAILS") {
      const details = extractJobDetails();
      sendResponse(details);
    } else if (request.action === "AUTO_FILL_FORM") {
      autoFillForm(request.payload || {}).then(sendResponse);
      return true; // async response
    }
    return true;
  });
})();
