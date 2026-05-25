import React from 'react';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
  isDarkMode?: boolean;
}

export default function ErrorMessage({ message, onDismiss, isDarkMode = false }: ErrorMessageProps) {
  return (
    <div id="error-message-box" className={`border rounded-lg p-3 mb-3 transition-colors duration-200 ${
      isDarkMode 
        ? 'bg-amber-950/20 border-amber-900/50' 
        : 'bg-amber-50 border-amber-300'
    }`}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className={`font-bold text-xs mb-1 ${isDarkMode ? 'text-amber-450' : 'text-amber-800'}`}>⚠️ Detection Issue</p>
          <p className={`text-xs whitespace-pre-line ${isDarkMode ? 'text-amber-300/95' : 'text-amber-700'}`}>{message}</p>
        </div>
        {onDismiss && (
          <button
            id="error-dismiss-btn"
            onClick={onDismiss}
            className={`flex-shrink-0 text-lg leading-none cursor-pointer transition-colors ${
              isDarkMode ? 'text-amber-500 hover:text-amber-450' : 'text-amber-400 hover:text-amber-600'
            }`}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
