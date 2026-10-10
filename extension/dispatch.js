/**
 * Vedha AI — Phase 4 Extension Dispatch Poller (MV3 alarms pull model).
 *
 * The backend cannot reach the browser, so the extension polls for its user's
 * dispatched runs, atomically claims one, executes it in a posting tab through
 * the existing harness, and posts receipts. One live run per device; the
 * backend lease (10 min) plus heartbeat receipts cover worker restarts.
 *
 * Loaded as an ES module by background.js (manifest declares type: module).
 * All chrome access is guarded so the module also parses under Node checks.
 */

const VEDHA_API_BASE = "http://localhost:5000"; // matches existing extension convention (content/popup hardcode)
const POLL_ALARM = "vedha-dispatch-poll";
const POLL_MINUTES = 1;
const TOKEN_KEYS = ["jwtToken", "vedha_token", "token"];

function getChrome() {
  if (typeof chrome !== "undefined") return chrome;
  if (typeof globalThis !== "undefined" && globalThis.chrome) return globalThis.chrome;
  return null;
}

async function getToken() {
  const cr = getChrome();
  if (!cr?.storage?.local) return null;
  try {
    const stored = await cr.storage.local.get(TOKEN_KEYS);
    return stored.jwtToken || stored.vedha_token || stored.token || null;
  } catch {
    return null;
  }
}

async function apiFetch(token, path, options = {}) {
  const res = await fetch(`${VEDHA_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    const err = new Error("unauthorized");
    err.unauthorized = true;
    throw err;
  }
  return res;
}

async function getSessionClaim() {
  const cr = getChrome();
  try {
    const s = await cr.storage.session.get(["vedhaActiveClaim"]);
    return s.vedhaActiveClaim || null;
  } catch {
    return null;
  }
}

async function setSessionClaim(claim) {
  const cr = getChrome();
  try {
    if (claim) await cr.storage.session.set({ vedhaActiveClaim: claim });
    else await cr.storage.session.remove(["vedhaActiveClaim"]);
  } catch { /* best-effort */ }
}

async function setBadge(count) {
  const cr = getChrome();
  try {
    await cr?.action?.setBadgeText?.({ text: count > 0 ? String(count) : "" });
    if (count > 0) await cr?.action?.setBadgeBackgroundColor?.({ color: "#0ea5e9" });
  } catch { /* best-effort */ }
}

async function postReceipt(token, runId, body) {
  const res = await apiFetch(token, `/api/orchestrator/extension/runs/${runId}/receipt`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }
  return { status: res.status, payload };
}

function sendToTab(tabId, message) {
  const cr = getChrome();
  return new Promise((resolve) => {
    try {
      cr.tabs.sendMessage(tabId, message, (response) => {
        if (cr?.runtime?.lastError) {
          resolve({ error: cr.runtime.lastError.message });
        } else {
          resolve({ response });
        }
      });
    } catch (err) {
      resolve({ error: err?.message || String(err) });
    }
  });
}

async function ensureContentScript(tabId) {
  const cr = getChrome();
  try {
    await cr.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    await new Promise((r) => setTimeout(r, 400));
  } catch { /* injection may fail on restricted pages; caller handles */ }
}

async function findOrOpenTab(jobUrl) {
  const cr = getChrome();
  try {
    const tabs = await cr.tabs.query({});
    const match = (tabs || []).find((t) => t.url && (t.url === jobUrl || (jobUrl && t.url.split("?")[0] === jobUrl.split("?")[0])));
    if (match?.id) {
      await cr.tabs.update(match.id, { active: true });
      return match.id;
    }
    const created = await cr.tabs.create({ url: jobUrl, active: true });
    // Give the posting page a moment to load before the harness runs.
    await new Promise((r) => setTimeout(r, 2500));
    return created?.id || null;
  } catch {
    return null;
  }
}

function mapTerminalReceipt(result) {
  if (!result || typeof result !== "object") return { state: "failed", message: "No result from page harness." };
  const evidence = result.evidence || "";
  const withEvidence = (msg) => (evidence ? `${msg} Evidence: ${evidence}` : msg);
  if (result.submitted) return { state: "submitted", filledCount: result.filledCount || 0, message: withEvidence(result.message || "Submitted from browser.") };
  if (result.pausedForReview) return { state: "paused", filledCount: result.filledCount || 0, message: withEvidence(result.message || "Paused at review screen.") };
  if (result.cancelled) return { state: "cancelled", filledCount: result.filledCount || 0, message: result.error || "Cancelled from tracker." };
  if (result.success) {
    const left = result.unansweredCount || 0;
    const esc = result.escalatedCount || 0;
    return {
      state: "paused",
      filledCount: result.filledCount || 0,
      escalatedCount: esc,
      message: (result.message || `Filled ${result.filledCount || 0} fields; ${left} left blank, ${esc} escalated — awaiting manual submit.`),
    };
  }
  return { state: "failed", filledCount: result.filledCount || 0, message: result.error || "Run failed in page harness." };
}

async function executeRun(token, pkg) {
  const cr = getChrome();
  const runId = pkg.runId || pkg.RunId;
  const claimToken = pkg.claimToken || pkg.ClaimToken;
  // Backend serializes PascalCase DTOs; accept both casings defensively.
  const jobUrl = pkg.jobUrl || pkg.JobUrl;
  const norm = (v, d = "") => (v === undefined || v === null ? d : v);

  // Pre-flight: a cancel issued between dispatch and claim must not execute.
  try {
    const statusRes = await apiFetch(token, `/api/orchestrator/queue/${runId}`);
    if (statusRes.ok) {
      const item = await statusRes.json();
      const st = item.status ?? item.Status;
      if (st === "Cancelled" || st === 6) {
        await postReceipt(token, runId, { claimToken, state: "cancelled", message: "Cancelled before claim execution." });
        return;
      }
    }
  } catch (err) {
    if (err?.unauthorized) return; // wait for login; claim lease covers the gap
  }

  const tabId = await findOrOpenTab(jobUrl);
  if (!tabId) {
    await postReceipt(token, runId, { claimToken, state: "failed", message: "Could not open or find the posting tab." });
    return;
  }

  await setSessionClaim({ runId, claimToken, tabId });
  await setBadge(1);
  await postReceipt(token, runId, { claimToken, state: "started", message: "Extension claimed the run; harness starting." }).catch(() => null);

  const payload = {
    queueItemId: runId,
    claimToken,
    company: norm(pkg.targetCompany ?? pkg.TargetCompany),
    title: norm(pkg.targetRole ?? pkg.TargetRole),
    coverLetter: norm(pkg.coverLetterText ?? pkg.CoverLetterText),
    prefilledAnswers: pkg.prefilledAnswers ?? pkg.PrefilledAnswers ?? [],
    copilotMode: true,
    token,
    runStatusUrl: `${VEDHA_API_BASE}/api/orchestrator/queue/${runId}`,
    candidateProfile: undefined, // content falls back to cached profile
  };

  let outcome = await sendToTab(tabId, { action: "AUTONOMOUS_MULTI_STEP_FILL", payload });
  if (outcome.error) {
    await ensureContentScript(tabId);
    outcome = await sendToTab(tabId, { action: "AUTONOMOUS_MULTI_STEP_FILL", payload });
  }

  let receipt;
  if (outcome.error) {
    receipt = { state: "failed", message: `Harness unreachable in posting tab: ${outcome.error}` };
  } else {
    receipt = mapTerminalReceipt(outcome.response);
    receipt.claimToken = claimToken;
  }
  receipt.claimToken = claimToken;
  try {
    await postReceipt(token, runId, receipt);
  } catch { /* terminal receipt retries on next heartbeat; lease bounds the loss */ }

  await setSessionClaim(null);
  await setBadge(0);
}

let pollInFlight = false;

async function pollOnce() {
  if (pollInFlight) return;
  const cr = getChrome();
  if (!cr?.alarms) return;
  pollInFlight = true;
  try {
    const existing = await getSessionClaim();
    if (existing) return; // one live run per device; receipts drive it to terminal
    const token = await getToken();
    if (!token) return; // logged out: wait silently, never clear anything
    let res;
    try {
      res = await apiFetch(token, "/api/orchestrator/extension/runs/next");
    } catch (err) {
      if (!err?.unauthorized) console.debug("[Vedha Dispatch] poll skipped:", err?.message || err);
      return;
    }
    if (res.status === 204) return;
    if (!res.ok) return;
    let pkg = null;
    try { pkg = await res.json(); } catch { pkg = null; }
    if (!pkg || (!pkg.runId && !pkg.RunId)) return;
    await executeRun(token, pkg);
  } finally {
    pollInFlight = false;
  }
}

function forwardStepReceipts() {
  const cr = getChrome();
  if (!cr?.runtime?.onMessage) return;
  cr.runtime.onMessage.addListener((message) => {
    // Only forward genuine step updates for the live claim. Run-state-only
    // transition pings carry no stepName and are intentionally skipped.
    if (!message || message.action !== "AGENT_STEP_UPDATE" || !message.stepName) return false;
    (async () => {
      const claim = await getSessionClaim();
      if (!claim) return;
      const token = await getToken();
      if (!token) return;
      try {
        await postReceipt(token, claim.runId, {
          claimToken: claim.claimToken,
          state: "step",
          message: `${message.stepName}: ${message.detail || message.title || ""}`.slice(0, 300),
        });
      } catch { /* heartbeat loss is bounded by the lease */ }
    })();
    return false;
  });
}

/** Resume-watcher: a worker restart mid-run resumes receipt duty or clears a dead claim. */
async function resumeInterruptedClaim() {
  const claim = await getSessionClaim();
  if (!claim) return;
  const token = await getToken();
  if (!token) return;
  try {
    const { status } = await postReceipt(token, claim.runId, {
      claimToken: claim.claimToken,
      state: "step",
      message: "Extension worker restarted; resuming run watch.",
    });
    if (status === 409 || status === 404) {
      await setSessionClaim(null);
      await setBadge(0);
    }
  } catch { /* lease bounds the loss */ }
}

export function startDispatchPoller() {
  const cr = getChrome();
  if (!cr?.alarms) return false;
  try {
    cr.alarms.create(POLL_ALARM, { periodInMinutes: POLL_MINUTES });
    cr.alarms.onAlarm.addListener((alarm) => {
      if (alarm?.name === POLL_ALARM) pollOnce();
    });
    forwardStepReceipts();
    resumeInterruptedClaim();
    pollOnce();
    console.log("[Vedha Dispatch] poller started (60s pull).");
    return true;
  } catch (err) {
    console.warn("[Vedha Dispatch] poller failed to start:", err?.message || err);
    return false;
  }
}
