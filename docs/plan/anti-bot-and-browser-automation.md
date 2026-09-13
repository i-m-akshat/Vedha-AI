# Implementation Plan: Anti-Bot WAF Evasion, Cloudflare Turnstile Gateway & Playwright Browser Automation

## Objectives
1. Implement real-time Cloudflare Turnstile, reCAPTCHA, and hCaptcha detection in `extension/content.js`.
2. Implement on-screen non-intrusive CAPTCHA pause banner with visual element highlighting and resume listener.
3. Enhance mouse interaction with synthetic Bezier-curved pointer movements (`pointerover`, `mouseover`, `pointermove`, `pointerdown`, `click`).
4. Implement per-domain rolling hourly application limits in `extension/popup.js` (LinkedIn <= 5/hr, Workday <= 8/hr).
5. Update `infra/Dockerfile.backend` with essential headless browser and rendering runtime dependencies (`libnss3`, `libatk-bridge2.0-0`, `libx11-xcb1`, `libdrm2`, `libgbm1`, `libasound2`, fonts).
6. Build and verify test suites.

---

## Files to Create & Modify

| File | Action | Purpose |
| :--- | :--- | :--- |
| `docs/specs/anti-bot-and-browser-automation.md` | Created | Feature specification |
| `docs/plan/anti-bot-and-browser-automation.md` | Created | Implementation plan |
| `extension/content.js` | Modify | Add Turnstile/CAPTCHA detection, human verification gateway banner, pointer simulation, honeypot filters |
| `extension/popup.js` | Modify | Add per-domain hourly pacing and cooldown display |
| `infra/Dockerfile.backend` | Modify | Add browser rendering & font dependencies |

---

## Testing Strategy
1. **Unit Tests**: Verify all existing C# unit tests continue to pass (21/21).
2. **Build Verification**: Verify `dotnet build` of all projects succeeds with 0 errors, 0 warnings.
3. **Extension Syntax Check**: Verify `extension/content.js` and `extension/popup.js` have valid ES syntax and correct Chrome API usage.

---

## Rollback Strategy
All changes are non-destructive and backward compatible. The extension and Dockerfile can be reverted with git checkout if needed.

---

## Changelog

| Date & Timestamp | Changes Made | Rationale ("Why") | Impacted Components |
| :--- | :--- | :--- | :--- |
| **2026-09-14 01:48:30 UTC** | Initialized implementation plan for Anti-Bot WAF Evasion & Playwright Browser Automation | Mitigate risks of candidate account bans, CAPTCHA blocks, and WAF challenges on ATS portals | `extension/`, `infra/` |
