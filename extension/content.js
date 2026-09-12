// Vedha AI Content Scraper & Auto-Fill Copilot Script
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

  function setInputValue(el, value) {
    if (!el || value === undefined || value === null) return;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function autoFillForm(payload) {
    let filledCount = 0;
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'));

    inputs.forEach(input => {
      const name = (input.getAttribute('name') || '').toLowerCase();
      const id = (input.getAttribute('id') || '').toLowerCase();
      const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
      
      // Find associated label text if any
      let labelText = '';
      if (input.id) {
        const lbl = document.querySelector(`label[for="${input.id}"]`);
        if (lbl) labelText = lbl.innerText.toLowerCase();
      }
      if (!labelText) {
        const parentLabel = input.closest('label');
        if (parentLabel) labelText = parentLabel.innerText.toLowerCase();
      }

      const descriptor = `${name} ${id} ${placeholder} ${ariaLabel} ${labelText}`.trim();

      // First Name
      if (descriptor.includes('first name') || descriptor.includes('given name') || name === 'fname' || id === 'first_name') {
        setInputValue(input, payload.firstName || payload.fullName?.split(' ')[0] || '');
        filledCount++;
      }
      // Last Name
      else if (descriptor.includes('last name') || descriptor.includes('family name') || descriptor.includes('surname') || name === 'lname' || id === 'last_name') {
        const parts = (payload.fullName || '').split(' ');
        setInputValue(input, payload.lastName || (parts.length > 1 ? parts.slice(1).join(' ') : ''));
        filledCount++;
      }
      // Full Name
      else if (descriptor.includes('full name') || descriptor.includes('name') && !descriptor.includes('company') && !descriptor.includes('file')) {
        setInputValue(input, payload.fullName || '');
        filledCount++;
      }
      // Email
      else if (input.type === 'email' || descriptor.includes('email') || descriptor.includes('e-mail')) {
        setInputValue(input, payload.email || '');
        filledCount++;
      }
      // Phone
      else if (input.type === 'tel' || descriptor.includes('phone') || descriptor.includes('mobile') || descriptor.includes('contact number')) {
        setInputValue(input, payload.phone || '');
        filledCount++;
      }
      // Location / City
      else if (descriptor.includes('city') || descriptor.includes('location') || descriptor.includes('address')) {
        setInputValue(input, payload.currentCity || '');
        filledCount++;
      }
      // LinkedIn
      else if (descriptor.includes('linkedin')) {
        setInputValue(input, payload.linkedin || '');
        filledCount++;
      }
      // GitHub
      else if (descriptor.includes('github')) {
        setInputValue(input, payload.github || '');
        filledCount++;
      }
      // Portfolio / Website
      else if (descriptor.includes('portfolio') || descriptor.includes('website') || descriptor.includes('personal url')) {
        setInputValue(input, payload.portfolio || '');
        filledCount++;
      }
      // Notice Period
      else if (descriptor.includes('notice period') || descriptor.includes('start date')) {
        const val = payload.noticePeriod ? `${payload.noticePeriod} days` : 'Immediate';
        setInputValue(input, val);
        filledCount++;
      }
      // Salary / CTC
      else if (descriptor.includes('salary') || descriptor.includes('compensation') || descriptor.includes('ctc')) {
        setInputValue(input, payload.expectedSalary || '');
        filledCount++;
      }
      // Custom Screening Answers matching
      else if (payload.answers && payload.answers.length > 0) {
        for (const ans of payload.answers) {
          if (ans.questionText && descriptor.includes(ans.questionText.toLowerCase().slice(0, 20))) {
            setInputValue(input, ans.answerText);
            filledCount++;
            break;
          }
        }
      }
    });

    return { success: true, filledCount };
  }

  // Listen for message requests from popup
  chrome.runtime?.onMessage?.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_JOB_DETAILS') {
      const details = extractJobDetails();
      sendResponse(details);
    } else if (request.action === 'AUTO_FILL_FORM') {
      const result = autoFillForm(request.payload || {});
      sendResponse(result);
    }
    return true;
  });
})();
