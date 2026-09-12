document.addEventListener('DOMContentLoaded', async () => {
  const loadingEl = document.getElementById('loading');
  const contentEl = document.getElementById('content');
  const titleEl = document.getElementById('jobTitle');
  const companyEl = document.getElementById('jobCompany');
  const sourceEl = document.getElementById('jobSource');
  const sendBtn = document.getElementById('sendBtn');

  let extractedData = null;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      loadingEl.innerText = 'No active browser tab found.';
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_JOB_DETAILS' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        // Fallback: use tab title and URL
        extractedData = {
          title: tab.title || 'Target Job',
          company: 'Target Company',
          url: tab.url,
          source: 'Browser Tab'
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
});
