import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sun, Moon } from 'lucide-react';
import ScoreDisplay from './components/ScoreDisplay';
import SummaryPanel from './components/SummaryPanel';
import ErrorMessage from './components/ErrorMessage';
import { SessionResult, SessionStatus } from './types';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Duration options: 1 Minute (60s) or 5 Minutes (300s)
const DURATION_OPTIONS = [
  { label: '1 Minute',  value: 60  },
  { label: '5 Minutes', value: 300 },
];

// EAR parameters for local Web Sandbox tracking (hoisted to prevent React re-render triggers)
const RIGHT_EYE_IDX = [33, 160, 158, 133, 153, 144];
const LEFT_EYE_IDX  = [362, 385, 387, 263, 373, 380];
const EAR_THRESHOLD = 0.20;
const BLINK_CONSEC_FRAMES = 2;
const TARGET_FPS = 15;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export default function App() {
  const [status, setStatus]         = useState<SessionStatus>('idle');
  const [duration, setDuration]     = useState<number>(60);
  const [result, setResult]         = useState<SessionResult | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [elapsed, setElapsed]       = useState<number>(0);
  const [blinkCount, setBlinkCount] = useState<number>(0);
  const [loading, setLoading]       = useState<boolean>(false);
  const [isExtension, setIsExtension] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eye-blink-tracker-theme');
      if (saved) return saved === 'dark';
    }
    return false;
  });

  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      localStorage.setItem('eye-blink-tracker-theme', next ? 'dark' : 'light');
      if (typeof window !== 'undefined' && (window as any).chrome?.storage?.local) {
        (window as any).chrome.storage.local.set({ theme: next ? 'dark' : 'light' });
      }
      return next;
    });
  }, []);

  // Sync theme with extension storage on load
  useEffect(() => {
    if (isExtension && (window as any).chrome?.storage?.local) {
      (window as any).chrome.storage.local.get(['theme'], (data: any) => {
        if (data.theme) {
          setIsDarkMode(data.theme === 'dark');
        }
      });
    }
  }, [isExtension]);

  // References for Web Sandbox Mode
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const trackerIntervalRef = useRef<any>(null);
  const landmarkerRef = useRef<any>(null);

  // ── DETECTION STATE DETECT ENVIRONMENT ──────────────────────────────────────
  useEffect(() => {
    const hasChromeExtension = typeof window !== 'undefined' && 
                             !!(window as any).chrome && 
                             !!(window as any).chrome.runtime && 
                             !!(window as any).chrome.runtime.id;
    setIsExtension(hasChromeExtension);
  }, []);

  // ── POLL CHROME STORAGE (EXTENSION MODE ONLY) ────────────────────────────────
  useEffect(() => {
    if (!isExtension || status !== 'running') return;

    const interval = setInterval(() => {
      (window as any).chrome.storage.local.get(
        ['blinkCount', 'sessionResult', 'detectionError', 'sessionStartTime', 'sessionDuration'],
        (data: any) => {
          if (data.blinkCount !== undefined) {
            setBlinkCount(data.blinkCount);
          }
          if (data.detectionError) {
            setError(data.detectionError);
          }
          if (data.sessionResult) {
            setResult(data.sessionResult);
            setStatus('done');
            setLoading(false);
          }
          if (data.sessionStartTime) {
            const elapsedSec = Math.floor((Date.now() - data.sessionStartTime) / 1000);
            setElapsed(Math.min(elapsedSec, data.sessionDuration || duration));
          }
        }
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [status, duration, isExtension]);

  // ── LOCAL WEB SANDBOX IN-BROWSER RECONCILIATION ──────────────────────────────
  const destroyLocalTracker = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (trackerIntervalRef.current) {
      clearInterval(trackerIntervalRef.current);
      trackerIntervalRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Euclidean distance helper
  const localEuclidean = (a: any, b: any) => {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  };

  // EAR calculation helper
  const localComputeEAR = (landmarks: any[], indices: number[]) => {
    const [p1, p2, p3, p4, p5, p6] = indices.map(i => landmarks[i]);
    if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 1.0;
    const numerator = localEuclidean(p2, p6) + localEuclidean(p3, p5);
    const denominator = 2.0 * localEuclidean(p1, p4);
    if (denominator === 0) return 1.0;
    return numerator / denominator;
  };

  // Score computation
  const localComputeScore = (blinksPerMinute: number) => {
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
  };

  // Run local tracking loop
  const runLocalTracker = useCallback(async (selectedDuration: number) => {
    setLoading(true);
    setError(null);
    setBlinkCount(0);
    setElapsed(0);

    try {
      // 1. Initialize loaded FilesetResolver
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
      );

      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });

      // 2. Start webcam stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: TARGET_FPS, max: 20 },
          facingMode: 'user',
        },
        audio: false,
      });
      
      localStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            // Once webcam is running, complete the loading phase
            setLoading(false);
          });
        };
      }

      // Detection state variables
      let localBlinks = 0;
      let consecutiveBelow = 0;
      let lastFrameMs = 0;
      let noFaceFirstMs: number | null = null;
      let errorSent = false;
      const startTime = Date.now();

      // Timer updates every 1s
      trackerIntervalRef.current = setInterval(() => {
        const secondsSpent = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(prev => {
          const nextSec = Math.min(secondsSpent, selectedDuration);
          if (nextSec >= selectedDuration) {
            // Terminate session
            destroyLocalTracker();
            setStatus('done');
            
            const minutes = selectedDuration / 60;
            const bpm = localBlinks / minutes;
            const finalScore = localComputeScore(bpm);

            setResult({
              totalBlinks: localBlinks,
              blinksPerMinute: Math.round(bpm * 10) / 10,
              score: finalScore,
              duration: selectedDuration,
            });
          }
          return nextSec;
        });
      }, 1000);

      // Main landmarker frame loop
      const frameLoop = (nowMs: number) => {
        if (!localStreamRef.current) return;

        animFrameIdRef.current = requestAnimationFrame(frameLoop);

        // Frame rate capping
        if (nowMs - lastFrameMs < FRAME_INTERVAL_MS) return;
        lastFrameMs = nowMs;

        const video = videoRef.current;
        if (!video || video.paused || video.ended) return;

        let results;
        try {
          results = landmarkerRef.current.detectForVideo(video, nowMs);
        } catch (e) {
          return; // Skip on transient failures
        }

        if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
          if (noFaceFirstMs === null) {
            noFaceFirstMs = Date.now();
          } else if (Date.now() - noFaceFirstMs > 5000 && !errorSent) {
            errorSent = true;
            setError(
              'Cannot detect your eyes. Please ensure:\n' +
              '• Your face is fully visible to the camera\n' +
              '• The room is well lit (no strong backlight)\n' +
              '• You are 50–80 cm from the camera\n' +
              '• No sunglasses or extreme viewing angle'
            );
          }
          return;
        }

        // Face found, reset counters
        noFaceFirstMs = null;
        errorSent = false;

        const lm = results.faceLandmarks[0];
        const earRight = localComputeEAR(lm, RIGHT_EYE_IDX);
        const earLeft  = localComputeEAR(lm, LEFT_EYE_IDX);
        const ear      = (earRight + earLeft) / 2.0;

        if (ear < EAR_THRESHOLD) {
          consecutiveBelow++;
        } else {
          if (consecutiveBelow >= BLINK_CONSEC_FRAMES) {
            localBlinks++;
            setBlinkCount(localBlinks);
          }
          consecutiveBelow = 0;
        }
      };

      animFrameIdRef.current = requestAnimationFrame(frameLoop);

    } catch (err: any) {
      console.error('Local face tracker initiation error:', err);
      setLoading(false);
      setStatus('idle');
      destroyLocalTracker();

      let errMsg = 'unknown error';
      if (err instanceof Error) {
        errMsg = err.message;
      } else if (typeof err === 'object' && err !== null) {
        errMsg = err.message || err.name || JSON.stringify(err);
      } else if (err) {
        errMsg = String(err);
      }

      if (err?.name === 'NotAllowedError' || errMsg.includes('Permission denied') || errMsg.includes('NotAllowedError')) {
        setError("Camera permission denied. Allow camera access in the top of your URL browser bar and restart standard tracking.");
      } else {
        setError(`Failed to initialize web face tracker: ${errMsg}. Ensure camera connected and internet available to retrieve models.`);
      }
    }
  }, [destroyLocalTracker]);

  const startSession = useCallback(() => {
    setError(null);
    setResult(null);
    setElapsed(0);
    setBlinkCount(0);
    setStatus('running');

    if (isExtension) {
      setLoading(true);
      (window as any).chrome.runtime.sendMessage(
        { type: 'START_SESSION', duration },
        (response: any) => {
          if ((window as any).chrome.runtime.lastError || !response?.ok) {
            setError('Failed to contact background service worker extension. Refresh and retry.');
            setStatus('idle');
            setLoading(false);
          } else {
            // Standard warm-up timer for offscreen model
            setTimeout(() => setLoading(false), 4000);
          }
        }
      );
    } else {
      // Local browser tracking
      runLocalTracker(duration);
    }
  }, [duration, isExtension, runLocalTracker]);

  const stopSession = useCallback(() => {
    setStatus('idle');
    setLoading(false);
    setError(null);
    
    if (isExtension) {
      (window as any).chrome.runtime.sendMessage({ type: 'STOP_SESSION' });
    } else {
      destroyLocalTracker();
    }
  }, [isExtension, destroyLocalTracker]);

  const resetToIdle = useCallback(() => {
    setStatus('idle');
    setResult(null);
    setError(null);
    setElapsed(0);
    setBlinkCount(0);
  }, []);

  // Ensure webcam tracks are killed if user navigates away or unmounts
  useEffect(() => {
    return () => {
      destroyLocalTracker();
    };
  }, [destroyLocalTracker]);

  // Visual dynamic progress percentage
  const progressPct = duration > 0 ? Math.min((elapsed / duration) * 100, 100) : 0;

  return (
    <div id="app-container" className={`w-80 ${isDarkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-gray-100 text-gray-800'} font-sans overflow-hidden border rounded-lg shadow-xl transition-colors duration-200`}>
      {/* Hidden local video elements used for browser-sandbox analysis */}
      {!isExtension && status === 'running' && (
        <div style={{ display: 'none' }}>
          <video ref={videoRef} width="320" height="240" autoPlay muted playsInline />
          <canvas ref={canvasRef} width="320" height="240" />
        </div>
      )}

      {/* Header banner with Theme Toggle */}
      <div id="header-banner" className={`${isDarkMode ? 'bg-slate-950 border-b border-slate-800' : 'bg-blue-800'} px-4 py-3 flex items-center justify-between transition-colors duration-200`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl" id="logo-icon">👁</span>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Eye Blink Tracker</h1>
            <p className={`${isDarkMode ? 'text-slate-400' : 'text-blue-100/80'} text-[10px] uppercase font-semibold`}>
              {isExtension ? 'Chrome Extension Active' : 'Web Sandboxed Preview'}
            </p>
          </div>
        </div>
        <button
          id="theme-toggle"
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            isDarkMode 
              ? 'bg-slate-800 text-yellow-400 border-slate-700 hover:bg-slate-700' 
              : 'bg-blue-700 text-white border-blue-600 hover:bg-blue-900/50'
          }`}
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="p-4">
        {/* Error Notification banner */}
        {error && <ErrorMessage message={error} onDismiss={() => setError(null)} isDarkMode={isDarkMode} />}

        {/* ── IDLE SETUP PANEL ── */}
        {status === 'idle' && (
          <div>
            {/* Setup instructions checklist */}
            <div id="checklist-setup" className={`border rounded-lg p-3 mb-4 transition-colors duration-200 ${
              isDarkMode 
                ? 'bg-slate-950 border-slate-800 text-slate-300' 
                : 'bg-blue-50 border-blue-100 text-blue-800'
            }`}>
              <p className={`font-semibold text-xs mb-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-800'}`}>
                ✅ Pre-Session Health Checklist:
              </p>
              <ul className={`text-[11px] space-y-1 ${isDarkMode ? 'text-slate-400' : 'text-blue-700'}`}>
                <li>• Position your face in full frame view</li>
                <li>• Use bright front lighting (no backlights)</li>
                <li>• Sit approx 50–80 cm from the camera</li>
                <li>• Avoid wearing dark circular sunglasses</li>
                <li>• Grant camera permissions when prompted</li>
              </ul>
            </div>

            {/* Set tracking duration */}
            <label className={`block text-xs font-semibold uppercase tracking-wide mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
              Select Session Duration
            </label>
            <div className="flex gap-2 mb-4">
              {DURATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  id={`duration-${opt.value}`}
                  onClick={() => setDuration(opt.value)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    duration === opt.value
                      ? isDarkMode
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-blue-700 text-white border-blue-700 shadow-sm'
                      : isDarkMode
                        ? 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* CTA action button */}
            <button
              id="start-tracking-btn"
              onClick={startSession}
              className={`w-full text-white py-3 rounded-lg font-bold text-sm transition-colors cursor-pointer shadow-md active:scale-[0.98] ${
                isDarkMode 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              Start Tracking
            </button>
          </div>
        )}

        {/* ── RUNNING STATE COUNTER ── */}
        {status === 'running' && (
          <div>
            {loading ? (
              <div id="loading-spinner" className="text-center py-6">
                <div className="text-3xl animate-spin mb-2">⏳</div>
                <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>Initializing trackers & loading models…</p>
                <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>First load initializes the MediaPipe model via CDN (approx 3-5 seconds)</p>
              </div>
            ) : (
              <>
                {/* Visual numbers overlay */}
                <div id="count-radial-view" className="text-center mb-4">
                  <div className={`text-5xl font-black leading-none antialiased ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>{blinkCount}</div>
                  <div className={`uppercase text-[10px] tracking-widest font-semibold mt-1 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>blinks counted</div>
                </div>

                {/* Progress outline */}
                <div id="progress-capsule" className={`rounded-full h-2 mb-1.5 overflow-hidden ${isDarkMode ? 'bg-slate-800' : 'bg-gray-100'}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-1010 ${isDarkMode ? 'bg-blue-400' : 'bg-blue-500'}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <div className={`flex justify-between text-[11px] font-semibold mb-4 ${isDarkMode ? 'text-slate-400' : 'text-gray-400'}`}>
                  <span>{elapsed}s elapsed</span>
                  <span>{duration}s total</span>
                </div>
              </>
            )}

            <p className={`text-[11px] text-center mb-4 leading-normal ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
              {isExtension 
                ? 'Tracking is isolated in the background and continues even if you close this popup.'
                : 'Interactive Sandbox: keep this browser tab focused for precise calculations.'}
            </p>

            <button
              id="stop-tracking-btn"
              onClick={stopSession}
              className={`w-full border py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isDarkMode 
                  ? 'border-red-900/50 text-red-400 hover:bg-red-950/30' 
                  : 'border-red-200 text-red-600 hover:bg-red-50/50'
              }`}
            >
              Cancel Session
            </button>
          </div>
        )}

        {/* ── DONE VIEW METRICS ── */}
        {status === 'done' && result && (
          <div>
            <ScoreDisplay score={result.score} isDarkMode={isDarkMode} />
            <SummaryPanel result={result} isDarkMode={isDarkMode} />
            <button
              id="retrack-btn"
              onClick={resetToIdle}
              className={`w-full mt-4 text-white py-3 rounded-lg font-bold text-sm transition-colors cursor-pointer shadow-sm ${
                isDarkMode 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              Track Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
