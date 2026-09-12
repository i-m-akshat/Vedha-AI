document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('content');
  const titleEl = document.getElementById('jobTitle');
  const companyEl = document.getElementById('jobCompany');
  const sourceEl = document.getElementById('jobSource');
  const sendBtn = document.getElementById('sendBtn');
  const autoFillBtn = document.getElementById('autoFillBtn');
  const fillStatusEl = document.getElementById('fillStatus');

  let extractedData = null;
  let activeTabId = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      loadingEl.innerText = 'No active browser tab found.';
      return;
    }
    activeTabId = tab.id;

    chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_JOB_DETAILS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Fallback: use tab title and URL
        extractedData = {
          title: tab.title || 'Target Job',
          company: 'Target Company',
          url: tab.url,
          source: 'Company Careers Portal'
        };
      } else {
        extractedData = response;
      }

      titleEl.innerText = extractedData.title;
      companyEl.innerText = extractedData.company;
      sourceEl.innerText = `Detected Source: ${extractedData.source || 'Web'}`;

      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    });
  } catch (err) {
    loadingEl.innerText = 'Unable to extract job data from this tab.';
  }

  sendBtn.addEventListener('click', () => {
    if (extractedData?.url) {
      const appUrl = `http://localhost:3000/?jobUrl=${encodeURIComponent(extractedData.url)}`;
      chrome.tabs.create({ url: appUrl });
    }
  });

  autoFillBtn.addEventListener('click', async () => {
    if (!activeTabId) return;

    fillStatusEl.style.display = 'block';
    fillStatusEl.innerText = 'Fetching verified candidate profile...';

    // Retrieve candidate profile from local storage or API
    chrome.storage.local.get(['candidateProfile', 'jwtToken'], async (stored) => {
      let profile = stored.candidateProfile;

      if (!profile && stored.jwtToken) {
        try {
          const res = await fetch('http://localhost:5000/api/candidateprofile', {
            headers: { 'Authorization': `Bearer ${stored.jwtToken}` }
          });
          if (res.ok) profile = await res.json();
        } catch (e) {}
      }

      // Default payload if not logged in
      const payload = {
        fullName: profile?.fullName || '',
        email: profile?.email || '',
        phone: profile?.phoneNumber || '',
        currentCity: profile?.currentCity || '',
        linkedin: profile?.linkedInUrl || '',
        github: profile?.githubUrl || '',
        portfolio: profile?.portfolioUrl || '',
        noticePeriod: profile?.noticePeriodDays || 30,
        expectedSalary: profile?.expectedSalary || '',
        answers: []
      };

      chrome.tabs.sendMessage(activeTabId, { action: 'AUTO_FILL_FORM', payload }, (res) => {
        if (chrome.runtime.lastError || !res) {
          fillStatusEl.innerText = '⚠️ Could not reach page form fields.';
        } else {
          fillStatusEl.innerText = `✅ Auto-filled ${res.filledCount} fields on this page!`;
        }
      });
    });
  });
});
