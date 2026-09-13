# Feature Specification: Anti-Bot WAF Evasion, Cloudflare Turnstile Gateway & Playwright Browser Automation

## Overview & Business Goal
Modern Applicant Tracking Systems (ATS) and job application portals (Workday, Greenhouse, Lever, Ashby, LinkedIn Easy Apply) increasingly deploy sophisticated Web Application Firewalls (WAFs) and bot mitigation platforms, notably **Cloudflare Turnstile**, **DataDome**, **PerimeterX**, and **Google reCAPTCHA v2/v3**.
Naive automated bots attempting blind HTTP POSTs or headless browser scripts trigger immediate IP reputation flags, shadowbans, or account suspensions.

The purpose of this feature is to engineer an enterprise-grade, **two-tier automation architecture**:
1. **Desktop Extension Copilot (Tier 1 - Primary & Safest)**: Runs within the candidate's authentic authenticated browser session with full Cloudflare Turnstile detection, non-intrusive human-in-the-loop CAPTCHA gating, biometric mouse trajectory simulation, honeypot evasion, and per-domain application pacing.
2. **Containerized Playwright Automation Worker (Tier 2 - Backend Execution)**: Container configuration and structured execution engine in the backend for automated package execution with Headed and Copilot review gateways.

---

## User Stories
- **As a candidate applying to Workday/Greenhouse**, I want Cloudflare Turnstile or CAPTCHAs to be automatically detected and paused with an on-screen prompt, so that I can click the verification box without having my application session blocked.
- **As a candidate applying on LinkedIn**, I want realistic mouse movement and keystroke cadence to be simulated, so that my LinkedIn account remains safe from automated bot detection flags.
- **As a candidate**, I want the extension to enforce intelligent domain-level pacing (e.g., max 5 applies per hour on LinkedIn), so that I never trigger automated spam filters.
- **As a candidate**, I want the automation to stop at the final review screen and never blindly submit without my final click, so that I maintain 100% ownership over what is sent to employers.

---

## Architecture & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Vedha AI Platform                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [Target Job Portal] (e.g. Greenhouse / Workday / LinkedIn)            │
│       ▲                                                                │
│       │ Real Authenticated DOM Session                                 │
│       │                                                                │
│  ┌────┴─────────────────────────────────────────────────────────────┐  │
│  │ Chrome Extension Copilot (extension/content.js)                  │  │
│  │  - Cloudflare Turnstile / CAPTCHA Detector & Highlight Gateway   │  │
│  │  - Bezier / Jittered Pointer Event Simulator                     │  │
│  │  - Honeypot Trap Filter (off-screen, zero-opacity, hidden labels)│  │
│  │  - Biometric Keystroke Jitter (Gaussian latency + typo repair)   │  │
│  │  - Per-Domain Rate Limiter (LinkedIn <= 5/hr, Workday <= 8/hr)   │  │
│  │  - Review Gateway: Auto-scrolls to top, prompts candidate submit │  │
│  └────┬─────────────────────────────────────────────────────────────┘  │
│       ▲                                                                │
│       │ Fetches Pre-Filled Data & Grounded Answers                     │
│       │                                                                │
│  ┌────┴─────────────────────────────────────────────────────────────┐  │
│  │ Vedha AI Backend API                                             │  │
│  │  - Orchestrator Queue & Execution Logs                           │  │
│  │  - Semantic DOM Field Extraction & AI Grounding                  │  │
│  │  - infra/Dockerfile.backend with Chromium & Font rendering libs  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Functional Requirements

### 1. Cloudflare Turnstile & CAPTCHA Human Verification Gateway
- **Detection Targets**:
  - Cloudflare Turnstile: `iframe[src*="challenges.cloudflare.com"]`, `div.cf-turnstile`, `#cf-turnstile`, `iframe[title*="Cloudflare"]`
  - Google reCAPTCHA: `.g-recaptcha`, `iframe[src*="recaptcha"]`, `textarea[name="g-recaptcha-response"]`
  - hCaptcha: `.h-captcha`, `iframe[src*="hcaptcha"]`
  - Generic WAF challenges: `#challenge-running`, `.ray-id`
- **Behavior**:
  - Immediately pause form autofill execution.
  - Inject floating banner: `"🛡️ Human Verification Gateway: Cloudflare Turnstile / CAPTCHA detected. Please complete the verification box on screen to proceed."`
  - Add visual pulsing border (`#3b82f6` glowing outline) around the CAPTCHA container.
  - Automatically resume autofill as soon as token response is generated or user clicks "I've Verified - Resume".

### 2. Biometric Pointer & Mouse Trajectory Simulation
- Prior to typing or clicking any interactive field:
  - Generate micro-pointer events (`pointerover`, `mouseover`, `pointermove`, `pointerdown`, `mousedown`, `focus`).
  - Introduce human hesitation delay (120ms - 350ms) between field transitions.

### 3. Honeypot & Bot-Trap Evasion
- Filter out invisible inputs that bots typically fall into:
  - Off-screen positioned elements (`left < -500px`, `top < -500px`).
  - Zero-opacity (`opacity: 0`), zero-dimension (`width === 0 || height === 0`), or `visibility: hidden`.
  - Common honeypot field names (`website`, `honeypot`, `trap`, `url_check`, `email_confirm_hidden`) when not explicitly labeled for user input.

### 4. Per-Domain Pacing & Cooldown Enforcement
- Track application submissions per domain in `chrome.storage.local`:
  - `linkedin.com`: Max 5 per rolling 60 minutes, minimum 45s between applications.
  - `workday.com` / `myworkdayjobs.com`: Max 8 per rolling 60 minutes.
  - All other company domains: Max 10 per rolling 60 minutes.
  - Global daily safe ceiling: Max 25 applications per day.
- Display domain cooldown status badge in the extension popup.

### 5. Backend Containerized Automation Support
- Update `infra/Dockerfile.backend` to include necessary system libraries for headless browser rendering (`libnss3`, `libatk-bridge2.0-0`, `libx11-xcb1`, `libdrm2`, `libgbm1`, `libasound2`, fonts).

---

## Changelog

| Date & Timestamp | Changes Made | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- |
| **2026-09-14 01:48:00 UTC** | Initialized specification for Anti-Bot WAF Evasion, Cloudflare Turnstile Human Gateway, and Containerized Playwright Automation | Mitigate risks of candidate account bans, CAPTCHA blocks, and WAF challenges on ATS portals | `extension/content.js`, `extension/popup.js`, `infra/Dockerfile.backend`, `backend/src/ResumeTailor.Infrastructure/` |
