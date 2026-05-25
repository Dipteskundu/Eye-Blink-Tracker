// public/offscreen.js
// Runs inside the hidden Offscreen Document.
// Responsibilities:
//   1. Access the webcam via getUserMedia
//   2. Load MediaPipe Face Landmarker
//   3. Run EAR-based blink detection loop
//   4. Send BLINK_EVENT / DETECTION_ERROR / SESSION_COMPLETE to the service worker

// ─── MEDIAPIPE CDN IMPORT ─────────────────────────────────────────────────────
// Using the CDN bundle avoids bundling a large WASM file into the extension
import {
  FaceLandmarker,
  FilesetResolver,
} from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js';

// ─── EYE LANDMARK INDICES (MediaPipe 478-point model) ────────────────────────
// These are the 6 landmarks used to compute EAR for each eye
// Order: [outer_corner, upper1, upper2, inner_corner, lower2, lower1]
const RIGHT_EYE_IDX = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_IDX  = [362, 385, 387, 263, 373, 380];

// ─── DETECTION PARAMETERS ────────────────────────────────────────────────────
const EAR_THRESHOLD       = 0.20;  // EAR below this = eye is closing/closed
const BLINK_CONSEC_FRAMES = 2;     // Minimum consecutive closed frames = 1 blink
const TARGET_FPS          = 15;    // Max detection frame rate (reduces CPU load)
const NO_FACE_GRACE_MS    = 5000;  // Wait 5s before showing "cannot detect" error
const FRAME_INTERVAL_MS   = 1000 / TARGET_FPS;

// ─── STATE ────────────────────────────────────────────────────────────────────
let landmarker       = null;
let mediaStream      = null;
let animFrameId      = null;
let detecting        = false;
let blinkCount       = 0;
let earBelowCount    = 0;       // Consecutive frames where EAR < threshold
let sessionDuration  = 60;      // Seconds — set by BEGIN_DETECTION message
let sessionStartMs   = null;
let lastFrameMs      = 0;
let noFaceFirstMs    = null;    // Timestamp when face first went missing
let errorSent        = false;   // Prevent sending the same error repeatedly

// ─── MATH HELPERS ─────────────────────────────────────────────────────────────

function euclidean(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Compute Eye Aspect Ratio for one eye given 6 landmark points.
 * EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 * A lower EAR means the eye is more closed.
 */
function computeEAR(landmarks, indices) {
  const [p1, p2, p3, p4, p5, p6] = indices.map(i => landmarks[i]);
  const numerator   = euclidean(p2, p6) + euclidean(p3, p5);
  const denominator = 2.0 * euclidean(p1, p4);
  if (denominator === 0) return 1.0; // Eye fully open (fallback)
  return numerator / denominator;
}

// ─── SCORE COMPUTATION ────────────────────────────────────────────────────────

function computeScore(blinksPerMinute) {
  if (blinksPerMinute >= 15) return 10;
  if (blinksPerMinute >= 13) return 9;
  if (blinksPerMinute >= 11) return 8;
  if (blinksPerMinute >= 9)  return 7;
  if (blinksPerMinute >= 7)  return 6;
  if (blinksPerMinute >= 5)  return 5;
  if (blinksPerMinute >= 4)  return 4;
  if (blinksPerMinute >= 3)  return 3;
  if (blinksPerMinute >= 2)  return 2;
  return 1;
}

// ─── INITIALISE MEDIAPIPE ─────────────────────────────────────────────────────

async function initLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
  );

  landmarker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU',  // Falls back to CPU automatically if GPU unavailable
    },
    runningMode: 'VIDEO',
    numFaces: 1,                          // Only track one face — saves resources
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: false,         // Not needed — reduces computation
    outputFacialTransformationMatrixes: false,
  });
}

// ─── START WEBCAM ─────────────────────────────────────────────────────────────

async function startCamera() {
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width:     { ideal: 320 },
        height:    { ideal: 240 },
        frameRate: { ideal: TARGET_FPS, max: 20 },
        facingMode: 'user',
      },
      audio: false,
    });

    const video = document.getElementById('video');
    video.srcObject = mediaStream;

    // Wait for video metadata to load before detection
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });

    await video.play();
    return true;

  } catch (err) {
    sendError(
      err.name === 'NotAllowedError'
        ? 'Camera permission was denied. Please click the camera icon in Chrome\'s address bar and allow access, then restart the session.'
        : `Camera error: ${err.message}. Please check that your webcam is connected and not in use by another application.`
    );
    return false;
  }
}

// ─── DETECTION LOOP ───────────────────────────────────────────────────────────

function detectLoop(nowMs) {
  if (!detecting) return;

  animFrameId = requestAnimationFrame(detectLoop);

  // Throttle to TARGET_FPS
  if (nowMs - lastFrameMs < FRAME_INTERVAL_MS) return;
  lastFrameMs = nowMs;

  const video = document.getElementById('video');

  // Check session timeout
  const elapsedSec = (Date.now() - sessionStartMs) / 1000;
  if (elapsedSec >= sessionDuration) {
    finishSession();
    return;
  }

  // Run MediaPipe inference
  let results;
  try {
    results = landmarker.detectForVideo(video, nowMs);
  } catch (_) {
    return; // Skip frame on transient error
  }

  // ── FACE DETECTION CHECK ──────────────────────────────────────────────────
  if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
    // No face in frame — start the grace period timer
    if (noFaceFirstMs === null) {
      noFaceFirstMs = Date.now();
    } else if (Date.now() - noFaceFirstMs > NO_FACE_GRACE_MS && !errorSent) {
      sendError(
        'Cannot detect your eyes. Please ensure:\n' +
        '• Your face is fully visible to the camera\n' +
        '• The room is well lit (no strong backlight)\n' +
        '• You are 50–80 cm from the camera\n' +
        '• You are not wearing sunglasses or heavy-framed glasses\n' +
        '• You are looking at the screen normally (not at an extreme angle)'
      );
    }
    return;
  }

  // Face detected — reset no-face timer and error flag
  noFaceFirstMs = null;
  errorSent = false;

  // ── EAR BLINK DETECTION ───────────────────────────────────────────────────
  const lm = results.faceLandmarks[0];

  const earRight = computeEAR(lm, RIGHT_EYE_IDX);
  const earLeft  = computeEAR(lm, LEFT_EYE_IDX);
  const ear      = (earRight + earLeft) / 2.0;

  if (ear < EAR_THRESHOLD) {
    // Eye is closing or closed
    earBelowCount++;
  } else {
    // Eye is open
    if (earBelowCount >= BLINK_CONSEC_FRAMES) {
      // Eye was closed for enough frames → count as one blink
      blinkCount++;
      chrome.runtime.sendMessage({ type: 'BLINK_EVENT' });
    }
    earBelowCount = 0;
  }
}

// ─── SESSION FINISH ───────────────────────────────────────────────────────────

function finishSession() {
  detecting = false;

  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  // Stop the camera immediately to free resources
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  const minutes         = sessionDuration / 60;
  const blinksPerMinute = blinkCount / minutes;
  const score           = computeScore(blinksPerMinute);

  chrome.runtime.sendMessage({
    type: 'SESSION_COMPLETE',
    result: {
      totalBlinks:     blinkCount,
      blinksPerMinute: Math.round(blinksPerMinute * 10) / 10, // 1 decimal place
      score,
      duration:        sessionDuration,
    },
  });
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function sendError(message) {
  errorSent = true;
  chrome.runtime.sendMessage({ type: 'DETECTION_ERROR', error: message });
}

// ─── ENTRY POINT — Listen for BEGIN_DETECTION from service worker ─────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'BEGIN_DETECTION') return;

  // Reset all state for a fresh session
  sessionDuration  = msg.duration || 60;
  sessionStartMs   = Date.now();
  blinkCount       = 0;
  earBelowCount    = 0;
  noFaceFirstMs    = null;
  errorSent        = false;
  detecting        = true;
  lastFrameMs      = 0;

  // Initialise model then start camera then start detection loop
  initLandmarker()
    .then(() => startCamera())
    .then(cameraOk => {
      if (cameraOk) {
        requestAnimationFrame(detectLoop);
      }
    })
    .catch(err => {
      sendError(`Initialisation failed: ${err.message}`);
    });
});
