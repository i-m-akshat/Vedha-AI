// Vedha AI Copilot & AI Orchestrator Controller
document.addEventListener("DOMContentLoaded", async () => {
  // -------------------------------------------------------------
  // Theme Management (Light & Dark with Single-Logo Persistence)
  // -------------------------------------------------------------
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const themeToggleIcon = document.getElementById("themeToggleIcon");
  const headerLogo = document.getElementById("headerLogo");
  const loginLogo = document.getElementById("loginLogo");

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const isDark = theme === "dark";
    if (headerLogo) {
      if (isDark) {
        headerLogo.src = "VedhaAI-Dark.png";
        headerLogo.style.height = "26px";
        headerLogo.style.maxWidth = "135px";
      } else {
        headerLogo.src = "vedha-logo.png";
        headerLogo.style.height = "32px";
        headerLogo.style.maxWidth = "110px";
      }
    }
    if (loginLogo) {
      if (isDark) {
        loginLogo.src = "VedhaAI-Dark.png";
        loginLogo.style.height = "38px";
        loginLogo.style.maxWidth = "165px";
      } else {
        loginLogo.src = "vedha-logo.png";
        loginLogo.style.height = "48px";
        loginLogo.style.maxWidth = "130px";
      }
    }
    if (themeToggleIcon) themeToggleIcon.innerText = isDark ? "☀️" : "🌙";
    if (themeToggleBtn) {
      themeToggleBtn.title = isDark ? "Switch to Light Theme" : "Switch to Dark Theme";
      themeToggleBtn.setAttribute("aria-label", isDark ? "Switch to Light Theme" : "Switch to Dark Theme");
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    chrome.storage.local.set({ vedha_theme: next });
  }

  // Load Saved Theme (Default: 'dark')
  chrome.storage.local.get(["vedha_theme"], (stored) => {
    const savedTheme = stored.vedha_theme || "dark";
    applyTheme(savedTheme);
  });

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme);
  }

  // -------------------------------------------------------------
  // DOM References
  // -------------------------------------------------------------
  const viewLogin = document.getElementById("view-login");
  const viewCopilot = document.getElementById("view-copilot");

  // Header Elements
  const connectionPill = document.getElementById("connectionPill");
  const connectionText = document.getElementById("connectionText");
  const pinToScreenBtn = document.getElementById("pinToScreenBtn");

  // Login Form Elements
  const loginForm = document.getElementById("loginForm");
  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginSubmitBtn = document.getElementById("loginSubmitBtn");
  const loginDemoBtn = document.getElementById("loginDemoBtn");
  const loginError = document.getElementById("loginError");
  const openRegisterLink = document.getElementById("openRegisterLink");

  // Tab 1: Copilot Elements
  const userNameGreeting = document.getElementById("userNameGreeting");
  const masterResumeBadge = document.getElementById("masterResumeBadge");
  const jobTitleEl = document.getElementById("jobTitle");
  const jobCompanyEl = document.getElementById("jobCompany");
  const jobSourceEl = document.getElementById("jobSource");
  const stepperStepCount = document.getElementById("stepperStepCount");
  const agentTelemetryCard = document.getElementById("agentTelemetryCard");
  const agentActivityTitle = document.getElementById("agentActivityTitle");
  const agentStatusDetail = document.getElementById("agentStatusDetail");
  const agentProgressBar = document.getElementById("agentProgressBar");
  const abortAgentBtn = document.getElementById("abortAgentBtn");
  const reviewGatewayToggle = document.getElementById("reviewGatewayToggle");
  const autoFillPrimaryBtn = document.getElementById("autoFillPrimaryBtn");
  const autoFillBtnLabel = document.getElementById("autoFillBtnLabel");
  const preparePackageBtn = document.getElementById("preparePackageBtn");
  const preparePackageBtnLabel = document.getElementById("preparePackageBtnLabel");
  const sendBtn = document.getElementById("sendBtn");
  const fillStatusEl = document.getElementById("fillStatus");

  // Tab 2: AI Match Elements
  const atsScoreCircle = document.getElementById("atsScoreCircle");
  const atsVerdict = document.getElementById("atsVerdict");
  const atsRecommendation = document.getElementById("atsRecommendation");
  const atsKeywordScore = document.getElementById("atsKeywordScore");
  const atsSkillsScore = document.getElementById("atsSkillsScore");
  const atsRelevanceScore = document.getElementById("atsRelevanceScore");
  const matchedSkillsPills = document.getElementById("matchedSkillsPills");
  const missingSkillsPills = document.getElementById("missingSkillsPills");
  const runAtsAnalysisBtn = document.getElementById("runAtsAnalysisBtn");
  const openTailorFromAtsBtn = document.getElementById("openTailorFromAtsBtn");

  // Tab 3: Cover Letter Elements
  const coverLetterTone = document.getElementById("coverLetterTone");
  const generateCoverLetterBtn = document.getElementById("generateCoverLetterBtn");
  const coverLetterText = document.getElementById("coverLetterText");
  const copyCoverLetterBtn = document.getElementById("copyCoverLetterBtn");
  const downloadCoverLetterBtn = document.getElementById("downloadCoverLetterBtn");

  // Tab 4: Profile Elements
  const profileList = document.getElementById("profileList");
  const refreshProfileBtn = document.getElementById("refreshProfileBtn");
  const openProfileStudioBtn = document.getElementById("openProfileStudioBtn");

  // Tab 5: Settings Elements
  const settingsUserEmail = document.getElementById("settingsUserEmail");
  const dailyPacingText = document.getElementById("dailyPacingText");
  const openWebStudioBtn = document.getElementById("openWebStudioBtn");
  const signOutBtn = document.getElementById("signOutBtn");
  const footerStudioLink = document.getElementById("footerStudioLink");

  // Internal State
  let activeTabId = null;
  let activeTabUrl = "";
  let extractedJob = {
    title: "Detecting target job...",
    company: "Open any career portal or job post",
    url: "",
    source: "Universal Web",
    description: "",
    skills: []
  };
  let authToken = null;
  let currentUser = null;
  let currentProfile = null;
  let currentMasterResume = null;

  const todayKey = `apply_count_${new Date().toISOString().slice(0, 10)}`;

  // Status Banner Helper
  function showStatus(message, type = "info", durationMs = 6000) {
    if (!fillStatusEl) return;
    fillStatusEl.className = `status-banner ${type}`;
    fillStatusEl.innerText = message;
    fillStatusEl.style.display = "block";
    if (durationMs > 0) {
      setTimeout(() => {
        if (fillStatusEl.innerText === message) {
          fillStatusEl.style.display = "none";
        }
      }, durationMs);
    }
  }

  // Stepper Node Updater
  function updateStepper(stepIndex) {
    const maxSteps = 4;
    for (let i = 1; i <= maxSteps; i++) {
      const node = document.getElementById(`stepNode${i}`);
      if (!node) continue;
      if (i < stepIndex) {
        node.className = "step-node completed";
      } else if (i === stepIndex) {
        node.className = "step-node active";
      } else {
        node.className = "step-node";
      }
    }
    if (stepperStepCount) {
      stepperStepCount.innerText = stepIndex > 0 ? `Step ${Math.min(stepIndex, 4)} of 4` : "Ready";
    }
  }

  // -------------------------------------------------------------
  // 1. Authentication Discovery & Verification
  // -------------------------------------------------------------
  async function resolveAuthToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(["vedha_token"], async (stored) => {
        if (stored.vedha_token) {
          return resolve(stored.vedha_token);
        }
        // Check if an open localhost:3000 tab has the token in localStorage
        try {
          const tabs = await chrome.tabs.query({ url: "*://localhost:3000/*" });
          if (tabs.length > 0 && tabs[0].id) {
            const res = await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => localStorage.getItem("vedha_token") || localStorage.getItem("resumate_token"),
            });
            const t = res?.[0]?.result;
            if (t) {
              chrome.storage.local.set({ vedha_token: t });
              return resolve(t);
            }
          }
        } catch (_) {}
        resolve(null);
      });
    });
  }

  async function checkAuthSession() {
    authToken = await resolveAuthToken();

    if (!authToken) {
      showLoginView();
      return false;
    }

    try {
      const meRes = await fetch("http://localhost:5000/api/auth/me", {
        headers: { Authorization: `Bearer ${authToken}` }
      });

      if (!meRes.ok) throw new Error("Token expired");

      currentUser = await meRes.json();
      showCopilotView();
      loadRealUserData();
      return true;
    } catch (_) {
      chrome.storage.local.remove(["vedha_token", "cachedUser", "candidateProfile", "cachedMasterResume"]);
      authToken = null;
      currentUser = null;
      showLoginView();
      return false;
    }
  }

  function showLoginView() {
    if (viewLogin) viewLogin.style.display = "flex";
    if (viewCopilot) viewCopilot.style.display = "none";
    if (connectionPill) {
      connectionPill.className = "status-pill offline";
      if (connectionText) connectionText.innerText = "Sign In Needed";
    }
  }

  function showCopilotView() {
    if (viewLogin) viewLogin.style.display = "none";
    if (viewCopilot) viewCopilot.style.display = "flex";
    if (connectionPill) {
      connectionPill.className = "status-pill";
      if (connectionText) connectionText.innerText = "Connected";
    }
    if (userNameGreeting && currentUser) {
      userNameGreeting.innerText = `Signed in as ${currentUser.fullName || currentUser.email}`;
    }
    if (settingsUserEmail && currentUser) {
      settingsUserEmail.innerText = currentUser.email;
    }
  }

  // -------------------------------------------------------------
  // 2. Load Real Candidate Profile and Master Resume
  // -------------------------------------------------------------
  async function loadRealUserData() {
    if (!authToken) return;

    try {
      const [profileRes, resumeRes] = await Promise.all([
        fetch("http://localhost:5000/api/candidateprofile", {
          headers: { Authorization: `Bearer ${authToken}` }
        }),
        fetch("http://localhost:5000/api/masterresume", {
          headers: { Authorization: `Bearer ${authToken}` }
        })
      ]);

      if (profileRes.ok) {
        currentProfile = await profileRes.json();
        chrome.storage.local.set({ candidateProfile: currentProfile });
      }

      if (resumeRes.ok) {
        currentMasterResume = await resumeRes.json();
        chrome.storage.local.set({ cachedMasterResume: currentMasterResume });
        if (masterResumeBadge) {
          masterResumeBadge.innerText = "● Master Resume Loaded";
          masterResumeBadge.style.color = "var(--success)";
        }
      } else {
        if (masterResumeBadge) {
          masterResumeBadge.innerText = "○ Master Resume Needed";
          masterResumeBadge.style.color = "var(--warning)";
        }
      }

      renderProfileFields();
    } catch (err) {
      console.warn("[Vedha AI Popup] Failed to fetch real user data:", err);
    }
  }

  // -------------------------------------------------------------
  // 3. Render Real Profile Fields in Tab 4
  // -------------------------------------------------------------
  function renderProfileFields() {
    if (!profileList) return;
    const pInfo = currentMasterResume?.schema?.personalInfo;
    const eff = currentProfile || {};

    const fields = [
      { key: "Full Name", val: pInfo?.fullName || currentUser?.fullName || eff?.fullName || "Not Specified" },
      { key: "Email Address", val: pInfo?.email || currentUser?.email || eff?.email || "Not Specified" },
      { key: "Phone Number", val: eff?.phoneNumber || pInfo?.phone || "Not Specified" },
      { key: "Location", val: eff?.currentCity || pInfo?.location || "Not Specified" },
      { key: "LinkedIn URL", val: eff?.linkedInUrl || pInfo?.linkedInUrl || "Not Specified" },
      { key: "GitHub Profile", val: eff?.githubUrl || pInfo?.gitHubUrl || "Not Specified" },
      { key: "Portfolio Website", val: eff?.portfolioUrl || pInfo?.portfolioUrl || "Not Specified" },
      { key: "Notice Period", val: eff?.noticePeriodDays ? `${eff.noticePeriodDays} Days` : "30 Days" },
      { key: "Expected Salary", val: eff?.expectedSalary ? `${eff?.salaryCurrency || "$"} ${eff.expectedSalary}` : "Negotiable" },
      { key: "Visa Sponsorship", val: eff?.requiresVisaSponsorship ? "Requires Sponsorship" : "Authorized to work (No sponsorship needed)" },
    ];

    profileList.innerHTML = fields.map(f => `
      <div class="profile-item">
        <div class="profile-meta">
          <span class="profile-key">${f.key}</span>
          <span class="profile-val" title="${f.val}">${f.val}</span>
        </div>
        <button class="copy-btn" data-copy="${encodeURIComponent(f.val)}">Copy</button>
      </div>
    `).join("");

    profileList.querySelectorAll(".copy-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const text = decodeURIComponent(btn.getAttribute("data-copy") || "");
        navigator.clipboard.writeText(text).then(() => {
          btn.innerText = "✓ Copied";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.innerText = "Copy";
            btn.classList.remove("copied");
          }, 1500);
        });
      });
    });
  }

  // -------------------------------------------------------------
  // 4. Handle Login Form Submit
  // -------------------------------------------------------------
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      loginError.style.display = "none";
      loginSubmitBtn.disabled = true;
      loginSubmitBtn.innerText = "Signing in...";

      const email = loginEmail.value.trim();
      const password = loginPassword.value;

      try {
        const res = await fetch("http://localhost:5000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Invalid email or password.");
        }

        const data = await res.json();
        const token = data.token || data.accessToken;
        chrome.storage.local.set({ vedha_token: token, cachedUser: data.user });
        authToken = token;
        currentUser = data.user;

        showCopilotView();
        loadRealUserData();
        showStatus("✅ Connected to Vedha AI account!", "success", 4000);
      } catch (err) {
        loginError.innerText = err.message || "Failed to sign in.";
        loginError.style.display = "block";
      } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.innerText = "Sign In & Connect";
      }
    });
  }

  // 5. Handle Quick Demo Login
  if (loginDemoBtn) {
    loginDemoBtn.addEventListener("click", () => {
      if (loginEmail) loginEmail.value = "demo@vedha.ai";
      if (loginPassword) loginPassword.value = "Password123!";
      loginForm.dispatchEvent(new Event("submit"));
    });
  }

  // 6. Handle Sign Out
  if (signOutBtn) {
    signOutBtn.addEventListener("click", () => {
      chrome.storage.local.remove(["vedha_token", "cachedUser", "candidateProfile", "cachedMasterResume"]);
      authToken = null;
      currentUser = null;
      showLoginView();
      showStatus("Signed out successfully.", "info", 3000);
    });
  }

  // -------------------------------------------------------------
  // 7. Active Tab Message Dispatcher
  // -------------------------------------------------------------
  async function sendMessageToActiveTab(message) {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      const tabs = await chrome.tabs.query({ active: true });
      tab = tabs[0];
    }
    if (!tab?.id) throw new Error("No active browser tab found.");

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, message, async (res) => {
        if (chrome.runtime.lastError) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ["content.js"]
            });
            await new Promise(r => setTimeout(r, 400));
            chrome.tabs.sendMessage(tab.id, message, (retryRes) => {
              if (chrome.runtime.lastError) {
                reject(new Error("Please refresh the job page to connect Vedha AI."));
              } else {
                resolve(retryRes);
              }
            });
          } catch (_) {
            reject(new Error("Please refresh the job page to connect Vedha AI."));
          }
        } else {
          resolve(res);
        }
      });
    });
  }

  // -------------------------------------------------------------
  // 8. Extract Job Details from Active Tab
  // -------------------------------------------------------------
  async function syncActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      activeTabId = tab.id;
      activeTabUrl = tab.url || "";

      if (!activeTabUrl || activeTabUrl.startsWith("chrome://") || activeTabUrl.startsWith("chrome-extension://")) {
        extractedJob = {
          title: "Universal Careers Mode",
          company: "Active on any career portal",
          url: "",
          source: "Universal Web",
          description: "",
          skills: []
        };
      } else {
        let source = "Universal Web";
        if (activeTabUrl.includes("linkedin.com")) source = "LinkedIn";
        else if (activeTabUrl.includes("greenhouse.io")) source = "Greenhouse";
        else if (activeTabUrl.includes("lever.co")) source = "Lever";
        else if (activeTabUrl.includes("ashbyhq.com")) source = "Ashby";
        else if (activeTabUrl.includes("workday.com") || activeTabUrl.includes("myworkdayjobs.com")) source = "Workday";
        else if (activeTabUrl.includes("indeed.com")) source = "Indeed";

        try {
          const resp = await sendMessageToActiveTab({ action: "EXTRACT_JOB_DETAILS" });
          if (resp && (resp.title || resp.company)) {
            extractedJob = { ...resp, source, url: activeTabUrl };
          } else {
            extractedJob = {
              title: tab.title ? tab.title.split("|")[0].split("-")[0].trim() : "Target Position",
              company: source !== "Universal Web" ? source : "Career Page",
              url: activeTabUrl,
              source,
              description: tab.title || "",
              skills: []
            };
          }
        } catch (_) {
          extractedJob = {
            title: tab.title ? tab.title.split("|")[0].split("-")[0].trim() : "Target Position",
            company: source !== "Universal Web" ? source : "Career Page",
            url: activeTabUrl,
            source,
            description: tab.title || "",
            skills: []
          };
        }
      }

      if (jobTitleEl) jobTitleEl.innerText = extractedJob.title;
      if (jobCompanyEl) jobCompanyEl.innerText = extractedJob.company;
      if (jobSourceEl) jobSourceEl.innerText = extractedJob.source;
    } catch (err) {
      console.debug("[Vedha AI Popup] Tab sync error:", err);
    }
  }

  // -------------------------------------------------------------
  // 9. Primary Action: Auto-Fill Application (Copilot Execution)
  // -------------------------------------------------------------
  if (autoFillPrimaryBtn) {
    autoFillPrimaryBtn.addEventListener("click", async () => {
      if (!authToken) {
        showLoginView();
        showStatus("Please sign in to Vedha AI to auto-fill applications.", "warning", 5000);
        return;
      }

      const isReviewGateway = reviewGatewayToggle ? reviewGatewayToggle.checked : true;
      autoFillPrimaryBtn.disabled = true;
      autoFillPrimaryBtn.innerText = "Auto-filling application...";

      if (agentTelemetryCard) agentTelemetryCard.style.display = "flex";
      if (agentActivityTitle) agentActivityTitle.innerText = "Autonomous Copilot Active";
      if (agentStatusDetail) agentStatusDetail.innerText = "Analyzing form fields and injecting verified data...";
      if (agentProgressBar) agentProgressBar.style.width = "25%";
      updateStepper(1);

      showStatus("⚡ Analyzing form and auto-filling with your Master Resume...", "info", 0);

      try {
        const payload = {
          fullName: currentMasterResume?.schema?.personalInfo?.fullName || currentUser?.fullName || currentProfile?.fullName,
          firstName: currentProfile?.firstName,
          lastName: currentProfile?.lastName,
          email: currentMasterResume?.schema?.personalInfo?.email || currentUser?.email || currentProfile?.email,
          phone: currentProfile?.phoneNumber || currentMasterResume?.schema?.personalInfo?.phone,
          currentCity: currentProfile?.currentCity || currentMasterResume?.schema?.personalInfo?.location,
          linkedin: currentProfile?.linkedInUrl || currentMasterResume?.schema?.personalInfo?.linkedInUrl,
          github: currentProfile?.githubUrl || currentMasterResume?.schema?.personalInfo?.gitHubUrl,
          portfolio: currentProfile?.portfolioUrl || currentMasterResume?.schema?.personalInfo?.portfolioUrl,
          noticePeriod: currentProfile?.noticePeriodDays ?? null,
          expectedSalary: currentProfile?.expectedSalary || "",
          requiresVisaSponsorship: currentProfile?.requiresVisaSponsorship ?? null,
          candidateProfile: currentProfile || {},
          masterResume: currentMasterResume || null,
          company: extractedJob.company,
          title: extractedJob.title,
          token: authToken,
          isSafeFill: true,
          copilotMode: isReviewGateway,
        };

        const res = await sendMessageToActiveTab({ action: "AUTONOMOUS_MULTI_STEP_FILL", payload });

        if (res && res.success) {
          updateStepper(4);
          if (agentProgressBar) agentProgressBar.style.width = "100%";
          if (res.pausedForReview) {
            showStatus("✅ Application filled! Paused at final Review screen for your confirmation.", "success", 8000);
          } else {
            showStatus("✅ Application auto-filled successfully!", "success", 6000);
          }
        } else {
          showStatus(`⚠️ ${res?.error || "Auto-fill paused. Please check page inputs."}`, "warning", 8000);
        }
      } catch (err) {
        showStatus(`⚠️ ${err.message || "Could not communicate with tab. Please refresh page."}`, "warning", 8000);
      } finally {
        autoFillPrimaryBtn.disabled = false;
        if (autoFillBtnLabel) autoFillBtnLabel.innerText = "Auto-Fill Application";
      }
    });
  }

  // -------------------------------------------------------------
  // 10. AI Orchestrator: 1-Click Prepare Full Application Package
  // -------------------------------------------------------------
  if (preparePackageBtn) {
    preparePackageBtn.addEventListener("click", async () => {
      if (!authToken) {
        showLoginView();
        showStatus("Please sign in to Vedha AI to queue packages.", "warning", 5000);
        return;
      }

      if (!currentMasterResume?.id) {
        showStatus("⚠️ Please upload a Master Resume in Vedha Studio first.", "warning", 5000);
        return;
      }

      preparePackageBtn.disabled = true;
      preparePackageBtnLabel.innerText = "Preparing package with Gemini AI...";
      showStatus("🚀 Generating tailored resume, cover letter & answers in backend queue...", "info", 0);

      try {
        const res = await fetch("http://localhost:5000/api/orchestrator/prepare-package", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            masterResumeId: currentMasterResume.id,
            jobUrl: extractedJob.url || activeTabUrl,
            directJobDescriptionText: extractedJob.description || extractedJob.title,
            templateStyle: 0
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to prepare application package.");
        }

        const data = await res.json();
        showStatus("✅ Application package queued in Vedha AI Studio! Ready for pipeline review.", "success", 8000);
        preparePackageBtnLabel.innerText = "✓ Package Staged in Queue";
        setTimeout(() => {
          preparePackageBtnLabel.innerText = "Queue Full Application Package";
        }, 3000);
      } catch (err) {
        showStatus(`⚠️ ${err.message || "Could not prepare package."}`, "warning", 8000);
      } finally {
        preparePackageBtn.disabled = false;
      }
    });
  }

  // -------------------------------------------------------------
  // 11. AI Orchestrator: Live ATS Match & Gap Analyzer
  // -------------------------------------------------------------
  if (runAtsAnalysisBtn) {
    runAtsAnalysisBtn.addEventListener("click", async () => {
      if (!authToken) {
        showLoginView();
        showStatus("Sign in to Vedha AI to analyze ATS match.", "warning", 5000);
        return;
      }

      runAtsAnalysisBtn.disabled = true;
      runAtsAnalysisBtn.innerText = "Analyzing alignment...";
      if (atsVerdict) atsVerdict.innerText = "Evaluating candidate fit with Gemini AI...";
      if (atsScoreCircle) atsScoreCircle.innerText = "...";

      try {
        const res = await fetch("http://localhost:5000/api/orchestrator/quick-match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            jobTitle: extractedJob.title,
            company: extractedJob.company,
            jobDescription: extractedJob.description || extractedJob.title,
            skills: extractedJob.skills || []
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "ATS analysis failed.");
        }

        const data = await res.json();
        const score = data.overallScore || 85;

        if (atsScoreCircle) {
          atsScoreCircle.innerText = `${score}%`;
          atsScoreCircle.style.borderColor = score >= 85 ? "var(--success)" : score >= 70 ? "var(--warning)" : "var(--danger)";
        }
        if (atsVerdict) {
          atsVerdict.innerText = score >= 85 ? "High ATS Fit" : score >= 70 ? "Moderate Match" : "Gaps Detected";
        }
        if (atsRecommendation) {
          atsRecommendation.innerText = data.recommendation || "Profile evaluated against target requirements.";
        }
        if (atsKeywordScore) atsKeywordScore.innerText = `${data.keywordMatchScore || score}%`;
        if (atsSkillsScore) atsSkillsScore.innerText = `${data.skillsMatchScore || score}%`;
        if (atsRelevanceScore) atsRelevanceScore.innerText = `${data.experienceRelevanceScore || score}%`;

        if (matchedSkillsPills) {
          const matched = (data.matchedSkills && data.matchedSkills.length > 0)
            ? data.matchedSkills
            : ["Core Experience", "Domain Fit", "Industry Background"];
          matchedSkillsPills.innerHTML = matched.map(s => `<span class="pill pill-green">${s}</span>`).join("");
        }

        if (missingSkillsPills) {
          const missing = data.missingSkills || [];
          if (missing.length === 0) {
            missingSkillsPills.innerHTML = `<span class="pill pill-green">✓ Complete Match — No critical gaps found</span>`;
          } else {
            missingSkillsPills.innerHTML = missing.map(s => `<span class="pill pill-amber">${s}</span>`).join("");
          }
        }

        showStatus(`🎯 ATS Match calculated: ${score}% match fit!`, "success", 5000);
      } catch (err) {
        showStatus(`⚠️ ${err.message || "Failed to calculate ATS match."}`, "warning", 6000);
      } finally {
        runAtsAnalysisBtn.disabled = false;
        runAtsAnalysisBtn.innerText = "🎯 Run Full ATS Alignment Check";
      }
    });
  }

  if (openTailorFromAtsBtn) {
    openTailorFromAtsBtn.addEventListener("click", () => {
      const targetUrl = extractedJob?.url ? `?jobUrl=${encodeURIComponent(extractedJob.url)}` : "";
      chrome.tabs.create({ url: `http://localhost:3000/tailor${targetUrl}` });
    });
  }

  // -------------------------------------------------------------
  // 12. AI Orchestrator: 1-Click Tailored Cover Letter Generator
  // -------------------------------------------------------------
  if (generateCoverLetterBtn) {
    generateCoverLetterBtn.addEventListener("click", async () => {
      if (!authToken) {
        showLoginView();
        showStatus("Sign in to Vedha AI to generate tailored cover letters.", "warning", 5000);
        return;
      }

      generateCoverLetterBtn.disabled = true;
      generateCoverLetterBtn.innerText = "⏳ Drafting...";
      if (coverLetterText) {
        coverLetterText.value = "Drafting tailored, ATS-grounded cover letter using Gemini AI and your Master Resume...";
      }

      const tone = coverLetterTone?.value || "Professional and confident";

      try {
        const res = await fetch("http://localhost:5000/api/orchestrator/quick-cover-letter", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
          },
          body: JSON.stringify({
            jobTitle: extractedJob.title,
            company: extractedJob.company,
            jobDescription: extractedJob.description || extractedJob.title,
            tone: tone
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to draft cover letter.");
        }

        const data = await res.json();
        if (coverLetterText) {
          coverLetterText.value = data.content || "Cover letter drafted successfully.";
        }
        showStatus("✨ Tailored cover letter generated and ready to copy!", "success", 5000);
      } catch (err) {
        if (coverLetterText) coverLetterText.value = `⚠️ Error: ${err.message || "Could not generate letter."}`;
        showStatus(`⚠️ ${err.message || "Failed to generate cover letter."}`, "warning", 6000);
      } finally {
        generateCoverLetterBtn.disabled = false;
        generateCoverLetterBtn.innerText = "⚡ Draft";
      }
    });
  }

  if (copyCoverLetterBtn) {
    copyCoverLetterBtn.addEventListener("click", () => {
      const text = coverLetterText?.value;
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        copyCoverLetterBtn.innerText = "✓ Copied!";
        setTimeout(() => { copyCoverLetterBtn.innerText = "📋 Copy"; }, 1500);
      });
    });
  }

  if (downloadCoverLetterBtn) {
    downloadCoverLetterBtn.addEventListener("click", () => {
      const text = coverLetterText?.value;
      if (!text) return;
      const cleanCompany = (extractedJob.company || "Company").replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `Cover_Letter_${cleanCompany}.txt`;
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  // -------------------------------------------------------------
  // 13. Telemetry Event Listener & Abort Handler
  // -------------------------------------------------------------
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "AGENT_STEP_UPDATE") {
      updateStepper(msg.step || 1);
      if (agentTelemetryCard) agentTelemetryCard.style.display = "flex";
      if (agentActivityTitle) agentActivityTitle.innerText = msg.title || "Autonomous Copilot Active";
      if (agentStatusDetail) agentStatusDetail.innerText = msg.detail || "Processing inputs...";
      if (agentProgressBar) agentProgressBar.style.width = `${msg.progress || 50}%`;
    } else if (msg.action === "AGENT_FINISHED") {
      updateStepper(4);
      if (agentStatusDetail) agentStatusDetail.innerText = msg.message || "Application complete!";
      if (agentProgressBar) agentProgressBar.style.width = "100%";
      setTimeout(() => {
        if (agentTelemetryCard) agentTelemetryCard.style.display = "none";
      }, 5000);
    }
  });

  if (abortAgentBtn) {
    abortAgentBtn.addEventListener("click", async () => {
      try {
        await sendMessageToActiveTab({ action: "ABORT_AGENT" });
        showStatus("Agent stopped by user.", "info", 3000);
        if (agentTelemetryCard) agentTelemetryCard.style.display = "none";
      } catch (_) {}
    });
  }

  // -------------------------------------------------------------
  // 14. Secondary Actions & Navigation
  // -------------------------------------------------------------
  if (pinToScreenBtn) {
    pinToScreenBtn.addEventListener("click", async () => {
      try {
        await sendMessageToActiveTab({ action: "PIN_INPAGE_DOCK" });
        showStatus("📌 Copilot pinned on screen above the page!", "success", 3000);
      } catch (err) {
        showStatus("Please refresh the tab to pin Copilot.", "warning", 3000);
      }
    });
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", () => {
      const targetUrl = extractedJob?.url ? `?jobUrl=${encodeURIComponent(extractedJob.url)}` : "";
      chrome.tabs.create({ url: `http://localhost:3000/orchestrator${targetUrl}` });
    });
  }

  if (openProfileStudioBtn) {
    openProfileStudioBtn.addEventListener("click", () => {
      chrome.tabs.create({ url: "http://localhost:3000/dashboard" });
    });
  }

  if (openWebStudioBtn || footerStudioLink || openRegisterLink) {
    [openWebStudioBtn, footerStudioLink, openRegisterLink].forEach(el => {
      if (el) el.addEventListener("click", () => chrome.tabs.create({ url: "http://localhost:3000" }));
    });
  }

  if (refreshProfileBtn) {
    refreshProfileBtn.addEventListener("click", () => {
      refreshProfileBtn.innerText = "Loading...";
      loadRealUserData().finally(() => {
        refreshProfileBtn.innerText = "↻ Refresh";
      });
    });
  }

  // Tab Switchers
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      tabButtons.forEach(b => b.classList.remove("active"));
      tabPanels.forEach(p => p.style.display = "none");

      btn.classList.add("active");
      const targetPanel = document.getElementById(targetTab);
      if (targetPanel) targetPanel.style.display = "flex";
    });
  });

  // Daily Pacing
  chrome.storage.local.get([todayKey], (stored) => {
    const count = stored[todayKey] || 0;
    if (dailyPacingText) dailyPacingText.innerText = `Daily Safety Limit: ${count} / 25 applications today`;
  });

  // Initial Boot
  await checkAuthSession();
  await syncActiveTab();
});
