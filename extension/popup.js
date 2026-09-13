document.addEventListener("DOMContentLoaded", async () => {
  const loadingEl = document.getElementById("loading");
  const contentEl = document.getElementById("content");
  const titleEl = document.getElementById("jobTitle");
  const companyEl = document.getElementById("jobCompany");
  const sourceEl = document.getElementById("jobSource");
  const sendBtn = document.getElementById("sendBtn");
  const autoFillBtn = document.getElementById("autoFillBtn");
  const fillStatusEl = document.getElementById("fillStatus");
  const quotaBadge = document.getElementById("dailyQuotaBadge");

  let extractedData = null;
  let activeTabId = null;

  // Initialize Daily Application Pacing
  const todayKey = `apply_count_${new Date().toISOString().slice(0, 10)}`;
  chrome.storage.local.get([todayKey], (stored) => {
    const count = stored[todayKey] || 0;
    if (quotaBadge) quotaBadge.innerText = `🛡️ Safe: ${count}/25 today`;
  });

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) {
      loadingEl.innerText = "No active browser tab found.";
      return;
    }
    activeTabId = tab.id;

    chrome.tabs.sendMessage(
      tab.id,
      { action: "EXTRACT_JOB_DETAILS" },
      (response) => {
        if (chrome.runtime.lastError || !response) {
          extractedData = {
            title: tab.title || "Target Position",
            company: "Target Company",
            url: tab.url,
            source: "Company Careers Portal",
          };
        } else {
          extractedData = response;
        }

        titleEl.innerText = extractedData.title;
        companyEl.innerText = extractedData.company;
        sourceEl.innerText = `Detected Source: ${extractedData.source || "Web"}`;

        loadingEl.style.display = "none";
        contentEl.style.display = "block";
      },
    );
  } catch (err) {
    loadingEl.innerText = "Unable to extract job data from this tab.";
  }

  sendBtn.addEventListener("click", async () => {
    if (!extractedData?.url) return;

    sendBtn.innerText = "⏳ Staging in Vedha AI...";

    chrome.storage.local.get(
      ["jwtToken", "vedha_token", "token"],
      async (stored) => {
        const token = stored.jwtToken || stored.vedha_token || stored.token;
        const baseUrl = "http://localhost:5000";

        if (token) {
          try {
            const res = await fetch(
              `${baseUrl}/api/orchestrator/prepare-package`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  jobUrl: extractedData.url,
                  directJobDescriptionText: extractedData.description || null,
                }),
              },
            );

            if (res.ok) {
              sendBtn.innerText = "✅ Staged in Vedha AI!";
              chrome.tabs.create({ url: "http://localhost:3000/orchestrator" });
              return;
            }
            const errorBody = await res.json().catch(() => null);
            sendBtn.innerText = `⚠️ ${errorBody?.error || `Backend returned ${res.status}.`}`;
          } catch (e) {
            sendBtn.innerText =
              "⚠️ Backend unavailable; opening orchestrator for retry.";
          }
        }

        // Fallback: Open the orchestrator so the user can retry with the active session.
        const appUrl = `http://localhost:3000/orchestrator?jobUrl=${encodeURIComponent(extractedData.url)}`;
        chrome.tabs.create({ url: appUrl });
        if (!token)
          sendBtn.innerText =
            "⚠️ Opened orchestrator; sign in to stage the job.";
      },
    );
  });

  autoFillBtn.addEventListener("click", async () => {
    if (!activeTabId) return;

    fillStatusEl.style.display = "block";
    fillStatusEl.innerText =
      "⚡ Initializing biometric keystroke simulation...";

    chrome.storage.local.get(
      ["candidateProfile", "jwtToken", "vedha_token", "token", todayKey],
      async (stored) => {
        let profile = stored.candidateProfile;
        const token = stored.jwtToken || stored.vedha_token || stored.token;
        let currentCount = stored[todayKey] || 0;

        if (currentCount >= 25) {
          fillStatusEl.innerText =
            "⚠️ Daily safety ceiling reached (25/25). Pausing to prevent account flags.";
          return;
        }

        // Per-Domain Hourly Pacing (e.g. LinkedIn <= 5/hr, Workday <= 8/hr)
        let domainHost = "web";
        try {
          if (extractedData?.url)
            domainHost = new URL(extractedData.url).hostname
              .toLowerCase()
              .replace("www.", "");
        } catch (e) {}

        const hourSlot = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const domainHourlyKey = `domain_${domainHost}_${hourSlot}`;
        const isLinkedIn = domainHost.includes("linkedin.com");
        const isWorkday =
          domainHost.includes("workday.com") ||
          domainHost.includes("myworkdayjobs.com");
        const domainHourlyLimit = isLinkedIn ? 5 : isWorkday ? 8 : 12;

        const domainStored = await new Promise((r) =>
          chrome.storage.local.get([domainHourlyKey], r),
        );
        const domainCount = domainStored[domainHourlyKey] || 0;

        if (domainCount >= domainHourlyLimit) {
          fillStatusEl.innerText = `⚠️ Hourly pacing active for ${domainHost} (${domainCount}/${domainHourlyLimit}/hr). Please wait for cooldown to protect your account.`;
          return;
        }

        let user = null;
        let masterResume = null;

        if (token) {
          try {
            const [profileRes, userRes, resumeRes] = await Promise.all([
              !profile
                ? fetch("http://localhost:5000/api/candidateprofile", {
                    headers: { Authorization: `Bearer ${token}` },
                  })
                : Promise.resolve(null),
              fetch("http://localhost:5000/api/auth/me", {
                headers: { Authorization: `Bearer ${token}` },
              }),
              fetch("http://localhost:5000/api/masterresume", {
                headers: { Authorization: `Bearer ${token}` },
              }),
            ]);

            if (profileRes && profileRes.ok) profile = await profileRes.json();
            if (userRes && userRes.ok) user = await userRes.json();
            if (resumeRes && resumeRes.ok)
              masterResume = await resumeRes.json();
          } catch (e) {}
        }

        const pInfo = masterResume?.schema?.personalInfo;
        const payload = {
          fullName:
            pInfo?.fullName || user?.fullName || profile?.fullName || "",
          email: pInfo?.email || user?.email || profile?.email || "",
          phone: profile?.phoneNumber || pInfo?.phone || "",
          currentCity: profile?.currentCity || pInfo?.location || "",
          linkedin: profile?.linkedInUrl || pInfo?.linkedInUrl || "",
          github: profile?.githubUrl || pInfo?.gitHubUrl || "",
          portfolio: profile?.portfolioUrl || pInfo?.portfolioUrl || "",
          noticePeriod: profile?.noticePeriodDays || 30,
          expectedSalary: profile?.expectedSalary || "",
          answers: [],
        };

        chrome.tabs.sendMessage(
          activeTabId,
          { action: "AUTO_FILL_FORM", payload },
          (res) => {
            if (chrome.runtime.lastError || !res) {
              fillStatusEl.innerText = "⚠️ Could not reach page form elements.";
            } else {
              currentCount++;
              const newDomainCount = domainCount + 1;
              chrome.storage.local.set({
                [todayKey]: currentCount,
                [domainHourlyKey]: newDomainCount,
              });
              if (quotaBadge)
                quotaBadge.innerText = `🛡️ Safe: ${currentCount}/25 today | ${domainHost}: ${newDomainCount}/${domainHourlyLimit}/hr`;
              fillStatusEl.innerText = `✅ Pre-filled ${res.filledCount} fields with biometric jitter. Please review before submit!`;
            }
          },
        );
      },
    );
  });
});
