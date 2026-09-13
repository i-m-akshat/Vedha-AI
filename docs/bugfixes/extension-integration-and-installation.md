# Extension Integration and Installation

## Root Cause

The extension read authentication from `chrome.storage.local`, while the frontend stored it in `localStorage`. The popup also referenced an extraction property that the content script did not return, and its unauthenticated fallback opened a URL that the orchestrator page did not consume.

## Fix

- Synchronize the frontend token into extension storage when the local frontend is open.
- Send the extracted `description` field to the backend.
- Route the fallback to the orchestrator page and populate its job URL input.
- Include the account name in the candidate profile response for name autofill.
- Document unpacked Chrome extension installation and local service prerequisites.

## Verification

- `npm run build` from `frontend/` passes.
- `node --check extension\\content.js` passes.
- `node --check extension\\popup.js` passes.

## Changelog

- 2026-09-14: Repaired extension authentication, job handoff, profile name mapping, and installation documentation. This restores the intended authenticated capture and autofill flow while preserving manual review before submission.
