import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Silence verbose TensorFlow / XNNPACK WASM module output in the console
if (typeof window !== 'undefined') {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  const shouldSuppress = (args: any[]) => {
    if (args.length > 0 && typeof args[0] === 'string') {
      const msg = args[0];
      return (
        msg.includes('XNNPACK') ||
        msg.includes('TensorFlow Lite') ||
        msg.includes('delegate for CPU')
      );
    }
    return false;
  };

  console.log = function (...args) {
    if (shouldSuppress(args)) return;
    originalLog.apply(console, args);
  };

  console.info = function (...args) {
    if (shouldSuppress(args)) return;
    originalInfo.apply(console, args);
  };

  console.warn = function (...args) {
    if (shouldSuppress(args)) return;
    originalWarn.apply(console, args);
  };

  console.error = function (...args) {
    if (shouldSuppress(args)) return;
    originalError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
