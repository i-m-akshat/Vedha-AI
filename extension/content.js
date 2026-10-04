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

  // Set value through React/Ember native property descriptor so synthetic events fire
  function setNativeValue(element, value) {
    if (!element) return;
    const isTextarea = element.tagName === "TEXTAREA";
    const prototype = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }
    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    element.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  // 5. Humanized Biometric Keystroke Jitter & Typo Simulation
  async function typeLikeHuman(el, text) {
    if (!el || text === undefined || text === null) return false;
    const strText = String(text);

    el.scrollIntoView({ behavior: "smooth", block: "center" });
    await simulatePointerInteraction(el);
    el.focus();
    await sleep(randomBetween(50, 100));

    // Clear existing
    setNativeValue(el, "");
    el.dispatchEvent(new Event("focus", { bubbles: true, composed: true }));

    for (let i = 0; i < strText.length; i++) {
      const char = strText[i];
      el.value += char;
      el.dispatchEvent(new KeyboardEvent("keydown", { key: char, bubbles: true }));
      el.dispatchEvent(new InputEvent("input", { data: char, bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", { key: char, bubbles: true }));
      await sleep(randomBetween(15, 35));
    }

    // Ensure final value is registered through React/Ember synthetic setter
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

  // 8. LinkedIn Easy Apply Multi-Step Engine & Review Gateway HUD
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

  function isFieldActionable(el) {
    if (!el) return false;
    if (el.type === "hidden") return false;
    if (el.disabled || el.readOnly) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  }

  function getFieldQuestionText(el) {
    if (!el) return "";
    const container = el.closest(
      ".fb-dash-form-element, [data-test-form-builder-single-line-text-form-component], [data-test-form-builder-radio-button-form-component], [data-test-text-entity-list-form-component], .jobs-easy-apply-form-section__grouping, div[class*='form-element'], fieldset"
    );
    if (container) {
      const header = container.querySelector(
        "label, legend, span.fb-dash-form-element__label, .t-14.t-bold, span[aria-hidden='true'], [data-test-form-builder-radio-button-form-component__title]"
      );
      if (header && header.innerText.trim()) return header.innerText.trim().toLowerCase();
    }
    if (el.id) {
      const lbl = document.querySelector(`label[for="${el.id}"]`);
      if (lbl && lbl.innerText.trim()) return lbl.innerText.trim().toLowerCase();
    }
    const parentLbl = el.closest("label");
    if (parentLbl && parentLbl.innerText.trim()) return parentLbl.innerText.trim().toLowerCase();
    return (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("name") || "").toLowerCase();
  }

  async function fillModalInputs(modal, payload) {
    if (!modal) return;
    const safePayload = payload || {};
    const answersList = Array.isArray(safePayload.answers) ? safePayload.answers : [];

    // 1. Text, Tel, Number, Email, Combobox inputs and Textareas
    const allInputs = Array.from(modal.querySelectorAll("input, textarea, select")).filter(isFieldActionable);

    for (const input of allInputs) {
      if (input.type === "radio" || input.type === "checkbox" || input.type === "file") continue;
      if (input.tagName === "SELECT") continue;

      const q = getFieldQuestionText(input);
      const currVal = (input.value || "").trim();

      // Phone
      if (input.type === "tel" || q.includes("phone") || q.includes("mobile")) {
        const phoneVal = safePayload.phone || safePayload.phoneNumber || "9876543210";
        if (!currVal) {
          await typeLikeHuman(input, phoneVal);
        }
      }
      // Email
      else if (input.type === "email" || q.includes("email")) {
        if (!currVal && safePayload.email) {
          await typeLikeHuman(input, safePayload.email);
        }
      }
      // City / Location typeahead
      else if (input.getAttribute("role") === "combobox" || q.includes("city") || q.includes("location") || q.includes("address")) {
        const cityVal = safePayload.currentCity || "Bangalore";
        if (!currVal) {
          await typeLikeHuman(input, cityVal);
          await sleep(400);
          const suggestion = document.querySelector(".basic-typeahead__selectable-list li, div[role='listbox'] div[role='option'], .artdeco-typeahead__results-list li");
          if (suggestion) {
            suggestion.click();
            await sleep(200);
          }
        }
      }
      // Numeric years of experience
      else if (input.type === "number" || input.getAttribute("inputmode") === "numeric" || q.includes("year") || q.includes("experience")) {
        if (!currVal) {
          let numVal = "4";
          const matched = answersList.find(a => q.includes((a.questionText || "").toLowerCase().slice(0, 15)));
          if (matched) {
            const digits = (matched.answerText || "").match(/\d+/);
            if (digits) numVal = digits[0];
          }
          await typeLikeHuman(input, numVal);
        }
      }
      // Standard Text input or Textarea
      else {
        if (!currVal) {
          let textVal = "";
          const matched = answersList.find(a => q.includes((a.questionText || "").toLowerCase().slice(0, 15)));
          if (matched && matched.answerText) {
            textVal = matched.answerText;
          } else if (q.includes("salary") || q.includes("ctc")) {
            textVal = safePayload.expectedSalary || safePayload.currentSalary || "1800000";
          } else if (q.includes("notice")) {
            textVal = String(safePayload.noticePeriod || safePayload.noticePeriodDays || 30);
          } else if (q.includes("gpa") || q.includes("percentage")) {
            textVal = "8.5";
          }
          if (textVal) {
            await typeLikeHuman(input, textVal);
          }
        }
      }
    }

    // 2. Radio buttons (Yes / No / Single-Choice)
    const fieldsets = Array.from(modal.querySelectorAll("fieldset, [data-test-form-builder-radio-button-form-component]"));
    for (const fs of fieldsets) {
      const q = getFieldQuestionText(fs);
      const radios = Array.from(fs.querySelectorAll("input[type='radio']"));
      if (radios.length === 0) continue;

      const isAnyChecked = radios.some(r => r.checked);
      if (isAnyChecked) continue;

      let wantYes = true;
      if (q.includes("sponsorship") || q.includes("require visa") || q.includes("visa sponsorship")) {
        wantYes = safePayload.requiresVisaSponsorship === true;
      } else if (q.includes("authorized") || q.includes("legally") || q.includes("eligible")) {
        wantYes = true;
      } else if (q.includes("commute") || q.includes("relocate") || q.includes("background check") || q.includes("drug test")) {
        wantYes = true;
      } else if (q.includes("completed") || q.includes("degree") || q.includes("bachelor")) {
        wantYes = true;
      } else {
        const matched = answersList.find(a => q.includes((a.questionText || "").toLowerCase().slice(0, 15)));
        if (matched) {
          wantYes = !matched.answerText.toLowerCase().includes("no");
        }
      }

      const targetWord = wantYes ? "yes" : "no";
      const matchedRadio = radios.find(r => {
        const lbl = fs.querySelector(`label[for="${r.id}"]`) || r.closest("label");
        const t = (lbl?.innerText || r.value || "").toLowerCase();
        return t.includes(targetWord);
      }) || (wantYes ? radios[0] : radios[radios.length - 1]);

      if (matchedRadio) {
        matchedRadio.click();
        matchedRadio.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(150);
      }
    }

    // 3. Dropdowns (<select>)
    const selects = Array.from(modal.querySelectorAll("select")).filter(isFieldActionable);
    for (const sel of selects) {
      if (sel.selectedIndex > 0 && sel.value && sel.value !== "Select an option") continue;

      const q = getFieldQuestionText(sel);
      let wantYes = true;
      if (q.includes("sponsorship") || q.includes("require visa")) {
        wantYes = safePayload.requiresVisaSponsorship === true;
      }

      const targetWord = wantYes ? "yes" : "no";
      let chosenOpt = Array.from(sel.options).find(o => o.text.toLowerCase().includes(targetWord));
      if (!chosenOpt && sel.options.length > 1) {
        chosenOpt = sel.options[1];
      }

      if (chosenOpt) {
        sel.value = chosenOpt.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        await sleep(150);
      }
    }

    // 4. Resume Document Selection Card
    const resumeCards = Array.from(modal.querySelectorAll(
      ".jobs-document-upload-redesign-card__container, div[data-test-document-upload], input[type='radio'][id*='resume'], button[aria-label*='Choose resume']"
    ));
    if (resumeCards.length > 0) {
      const firstResume = resumeCards[0];
      if (firstResume.tagName === "INPUT" && !firstResume.checked) {
        firstResume.click();
      } else if (firstResume.tagName !== "INPUT") {
        firstResume.click();
      }
      await sleep(200);
    }
  }

  async function autoApplyLinkedInEasyApply(payload) {
    if (!window.location.hostname.includes("linkedin.com")) {
      return { success: false, error: "Not on a LinkedIn job page." };
    }

    // Check if already applied
    const appliedBadge = document.querySelector(".jobs-s-apply--applied, .artdeco-inline-feedback--success");
    if (appliedBadge || document.body.innerText.includes("You applied on") || document.body.innerText.includes("Application submitted")) {
      return { success: true, message: "Already applied on LinkedIn for this position!" };
    }

    // Find Easy Apply button
    let applyBtn = document.querySelector(
      "button.jobs-apply-button, button[aria-label*='Easy Apply'], button[data-job-id] span.jobs-apply-button__text"
    );
    if (!applyBtn) {
      const anyApply = Array.from(document.querySelectorAll("button")).find(b => b.innerText.trim().toLowerCase().includes("easy apply"));
      if (anyApply) applyBtn = anyApply;
    }

    // Check if modal is already open
    let modal = document.querySelector(".jobs-easy-apply-modal, div[data-test-modal-id='easy-apply-modal'], .artdeco-modal, div[role='dialog']");

    if (!modal && applyBtn) {
      const actualButton = applyBtn.closest("button") || applyBtn;
      actualButton.click();
      await sleep(2000);
      modal = document.querySelector(".jobs-easy-apply-modal, div[data-test-modal-id='easy-apply-modal'], .artdeco-modal, div[role='dialog']");
    }

    if (!modal) {
      return {
        success: false,
        error: "Could not find 'Easy Apply' button or open application modal."
      };
    }

    // Multi-step modal loop
    let stepCount = 0;
    while (stepCount < 12) {
      stepCount++;
      modal = document.querySelector(".jobs-easy-apply-modal, div[data-test-modal-id='easy-apply-modal'], .artdeco-modal, div[role='dialog']");
      if (!modal) break;

      // Fill inputs in active step
      await fillModalInputs(modal, payload);
      await sleep(800);

      // Check if Submit button reached
      const submitBtn = Array.from(modal.querySelectorAll("button")).find(b => {
        const text = (b.innerText || "").toLowerCase();
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        return text.includes("submit application") || aria.includes("submit application");
      });

      if (submitBtn) {
        if (payload?.copilotMode !== false) {
          // Copilot Review Gateway: Stop before submit and present on-screen review banner
          showCopilotReviewHud(payload?.queueItemId, payload?.company, payload?.title);
          return {
            success: true,
            pausedForReview: true,
            message: "All Easy Apply steps completed. Paused at final Review screen for candidate authorization."
          };
        } else {
          // Auto-submit
          submitBtn.click();
          await sleep(2500);
          const doneBtn = document.querySelector("button[aria-label='Dismiss'], button:has-text('Done')");
          if (doneBtn) doneBtn.click();
          return { success: true, submitted: true, message: "Application submitted successfully on LinkedIn!" };
        }
      }

      // Check for Review button
      const reviewBtn = Array.from(modal.querySelectorAll("button")).find(b => {
        const text = (b.innerText || "").toLowerCase();
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        return text.includes("review") || aria.includes("review your application");
      });
      if (reviewBtn) {
        reviewBtn.click();
        await sleep(1500);
        continue;
      }

      // Check for Next button
      const nextBtn = Array.from(modal.querySelectorAll("button")).find(b => {
        const text = (b.innerText || "").toLowerCase();
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        return text.includes("next") || aria.includes("continue to next step");
      });
      if (nextBtn) {
        nextBtn.click();
        await sleep(1500);
        continue;
      }

      break;
    }

    return { success: true, message: "Completed LinkedIn Easy Apply processing." };
  }

  // 8. In-Page 1-Click Floating Auto-Apply Pill for LinkedIn
  async function triggerLinkedInAutoApplyFromPill() {
    const pill = document.getElementById("vedha-floating-apply-pill");
    if (pill) {
      pill.innerHTML = `<span>⏳</span><span>Auto-Filling Easy Apply...</span>`;
      pill.style.pointerEvents = "none";
    }

    try {
      chrome.storage.local.get(["candidateProfile", "vedha_token", "jwtToken", "token"], async (stored) => {
        const token = stored.vedha_token || stored.jwtToken || stored.token;
        let profile = stored.candidateProfile;
        let queueItems = [];
        let masterResume = null;

        if (token) {
          try {
            const [profileRes, queueRes, resumeRes] = await Promise.all([
              !profile ? fetch("http://localhost:5000/api/candidateprofile", { headers: { Authorization: `Bearer ${token}` } }) : null,
              fetch("http://localhost:5000/api/orchestrator/queue", { headers: { Authorization: `Bearer ${token}` } }),
              fetch("http://localhost:5000/api/masterresume", { headers: { Authorization: `Bearer ${token}` } })
            ]);
            if (profileRes?.ok) profile = await profileRes.json();
            if (queueRes?.ok) queueItems = await queueRes.json();
            if (resumeRes?.ok) masterResume = await resumeRes.json();
          } catch (e) {}
        }

        const currentUrl = window.location.href.toLowerCase();
        const matchedItem = (queueItems || []).find(q =>
          q.jobUrl && (currentUrl.includes(q.jobUrl.toLowerCase().slice(0, 30)) || q.jobUrl.toLowerCase().includes(currentUrl.slice(0, 30)))
        );

        const payload = {
          queueItemId: matchedItem?.id,
          company: matchedItem?.targetCompany || "Target Company",
          title: matchedItem?.targetRole || "Target Position",
          phone: profile?.phoneNumber || "",
          email: masterResume?.schema?.personalInfo?.email || profile?.email || "",
          requiresVisaSponsorship: profile?.requiresVisaSponsorship || false,
          answers: matchedItem?.prefilledAnswers || [],
          copilotMode: true
        };

        const res = await autoApplyLinkedInEasyApply(payload);
        if (pill) {
          if (res.success) {
            pill.innerHTML = `<span>✅</span><span>${res.pausedForReview ? "Review Screen Ready!" : "Applied!"}</span>`;
            pill.style.background = "#059669";
          } else {
            pill.innerHTML = `<span>⚠️</span><span>${res.error || "Easy Apply not found"}</span>`;
            pill.style.background = "#d97706";
          }
          setTimeout(() => {
            if (pill) {
              pill.style.pointerEvents = "auto";
              pill.innerHTML = `<span>⚡</span><span>Vedha 1-Click Auto-Apply</span>`;
              pill.style.background = "#0f172a";
            }
          }, 4000);
        }
      });
    } catch (err) {
      if (pill) {
        pill.innerHTML = `<span>⚠️</span><span>Error auto-applying</span>`;
        pill.style.pointerEvents = "auto";
      }
    }
  }

  function injectLinkedInFloatingPill() {
    if (!window.location.hostname.includes("linkedin.com")) return;
    if (document.getElementById("vedha-floating-apply-pill")) return;

    // Only inject on job pages
    if (!window.location.pathname.includes("/jobs/")) return;

    const pill = document.createElement("div");
    pill.id = "vedha-floating-apply-pill";
    pill.style.cssText = `
      position: fixed;
      bottom: 28px;
      right: 28px;
      z-index: 999999;
      background: #0f172a;
      color: #f8fafc;
      border: 1.5px solid #3b82f6;
      border-radius: 9999px;
      box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      padding: 11px 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.01em;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    pill.innerHTML = `
      <span style="font-size: 16px;">⚡</span>
      <span>Vedha 1-Click Auto-Apply</span>
    `;

    pill.onmouseenter = () => {
      pill.style.transform = "scale(1.05)";
      pill.style.boxShadow = "0 15px 35px -5px rgba(59, 130, 246, 0.7)";
    };
    pill.onmouseleave = () => {
      pill.style.transform = "scale(1)";
      pill.style.boxShadow = "0 10px 25px -5px rgba(59, 130, 246, 0.5)";
    };

    pill.addEventListener("click", triggerLinkedInAutoApplyFromPill);
    document.body.appendChild(pill);
  }

  // Periodic check to inject when navigating single-page apps (like LinkedIn)
  if (window.location.hostname.includes("linkedin.com")) {
    setInterval(injectLinkedInFloatingPill, 2000);
  }

  // 9. Message Listener
  chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.action === "EXTRACT_JOB_DETAILS") {
      const details = extractJobDetails();
      sendResponse(details);
    } else if (request.action === "AUTO_FILL_FORM") {
      autoFillForm(request.payload || {}).then(sendResponse);
      return true; // async response
    } else if (request.action === "AUTO_APPLY_LINKEDIN") {
      autoApplyLinkedInEasyApply(request.payload || {}).then(sendResponse);
      return true; // async response
    }
    return true;
  });
})();
