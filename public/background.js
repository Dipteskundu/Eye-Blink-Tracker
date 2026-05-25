// public/background.js
// Service Worker — orchestrates sessions, manages offscreen document lifecycle

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const OFFSCREEN_URL = 'offscreen.html';

// ─── MESSAGE ROUTER ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {

    case 'START_SESSION':
      startSession(msg.duration)
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true; // keep message channel open for async response

    case 'STOP_SESSION':
      stopSession()
        .then(() => sendResponse({ ok: true }))
        .catch(err => sendResponse({ ok: false, error: err.message }));
      return true;

    case 'BLINK_EVENT':
      // Increment blink counter in storage
      chrome.storage.local.get(['blinkCount'], (data) => {
        const newCount = (data.blinkCount || 0) + 1;
        chrome.storage.local.set({ blinkCount: newCount });
      });
      break;

    case 'SESSION_COMPLETE':
      // Store final result and tear down the offscreen document
      chrome.storage.local.set({
        sessionResult: msg.result,
        sessionActive: false,
      });
      destroyOffscreen();
      break;

    case 'DETECTION_ERROR':
      // Store error so popup can display it
      chrome.storage.local.set({ detectionError: msg.error });
      break;

    default:
      break;
  }
});

// ─── SESSION LIFECYCLE ────────────────────────────────────────────────────────

async function startSession(duration) {
  // Reset storage state for a fresh session
  await chrome.storage.local.set({
    blinkCount: 0,
    sessionActive: true,
    sessionDuration: duration,
    detectionError: null,
    sessionResult: null,
    sessionStartTime: Date.now(),
  });

  // Ensure the offscreen document exists
  await ensureOffscreen();

  // Tell the offscreen document to begin detecting
  // Small delay ensures the offscreen document's message listener is ready
  await wait(300);
  chrome.runtime.sendMessage({ type: 'BEGIN_DETECTION', duration });
}

async function stopSession() {
  await chrome.storage.local.set({ sessionActive: false });
  await destroyOffscreen();
}

async function ensureOffscreen() {
  // chrome.offscreen.hasDocument() may throw in some Chrome versions — handle gracefully
  let hasDoc = false;
  try {
    hasDoc = await chrome.offscreen.hasDocument();
  } catch (_) {
    hasDoc = false;
  }

  if (!hasDoc) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL(OFFSCREEN_URL),
      reasons: ['USER_MEDIA'],
      justification: 'Webcam access required for eye blink detection using MediaPipe Face Landmarker.',
    });
  }
}

async function destroyOffscreen() {
  let hasDoc = false;
  try {
    hasDoc = await chrome.offscreen.hasDocument();
  } catch (_) {
    hasDoc = false;
  }

  if (hasDoc) {
    try {
      await chrome.offscreen.closeDocument();
    } catch (_) {
      // Already closed — safe to ignore
    }
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── STARTUP CLEANUP ──────────────────────────────────────────────────────────
// On extension startup, clear any stale session state from a previous browser session
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({
    sessionActive: false,
    blinkCount: 0,
    sessionResult: null,
    detectionError: null,
  });
});
