// ResuMate AI Content Scraper Script
(function () {
  function extractJobDetails() {
    const host = window.location.hostname.toLowerCase();
    let title = '';
    let company = '';
    let description = '';
    let source = 'CompanyCareers';

    if (host.includes('linkedin.com')) {
      source = 'LinkedIn';
      title = document.querySelector('.top-card-layout__title, h1.topcard__title, .job-details-jobs-unified-top-card__job-title')?.innerText?.trim() || '';
      company = document.querySelector('.topcard__flavor, .topcard__flavor--black-link, .job-details-jobs-unified-top-card__company-name')?.innerText?.trim() || '';
      description = document.querySelector('.show-more-less-html__markup, .description__text, .jobs-description__content')?.innerText?.trim() || '';
    } else if (host.includes('greenhouse.io')) {
      source = 'Greenhouse';
      title = document.querySelector('.app-title, h1.job-title, .job-title')?.innerText?.trim() || '';
      company = document.querySelector('.company-name')?.innerText?.trim() || '';
      description = document.querySelector('#content, .content, #main')?.innerText?.trim() || '';
    } else if (host.includes('lever.co')) {
      source = 'Lever';
      title = document.querySelector('.posting-headline h2, h2')?.innerText?.trim() || '';
      company = document.querySelector('.main-header .title')?.innerText?.trim() || '';
      description = document.querySelector('.content, .posting-sections')?.innerText?.trim() || '';
    } else if (host.includes('ashbyhq.com')) {
      source = 'Ashby';
      title = document.querySelector("h1, [data-qa='job-title']")?.innerText?.trim() || '';
      company = document.querySelector("[data-qa='company-name']")?.innerText?.trim() || '';
      description = document.querySelector("main, [data-qa='job-description']")?.innerText?.trim() || '';
    } else if (host.includes('indeed.com')) {
      source = 'Indeed';
      title = document.querySelector('h1.jobsearch-JobInfoHeader-title')?.innerText?.trim() || '';
      company = document.querySelector("[data-company-name='true']")?.innerText?.trim() || '';
      description = document.querySelector('#jobDescriptionText')?.innerText?.trim() || '';
    } else {
      title = document.querySelector('h1')?.innerText?.trim() || document.title;
      description = document.querySelector('main, article, #job-description, .job-description')?.innerText?.trim() || document.body.innerText;
    }

    return {
      title: title || document.title,
      company: company || 'Company',
      description: description,
      url: window.location.href,
      source: source,
      capturedAt: new Date().toISOString()
    };
  }

  // Listen for message requests from popup
  chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_JOB_DETAILS') {
      const details = extractJobDetails();
      sendResponse(details);
    }
  });
})();
