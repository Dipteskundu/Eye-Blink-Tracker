import React from 'react';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
}

export default function ErrorMessage({ message, onDismiss }: ErrorMessageProps) {
  return (
    <div id="error-message-box" className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-3">
      <div className="flex justify-between items-start gap-2">
        <div>
          <p className="text-amber-800 font-bold text-xs mb-1">⚠️ Detection Issue</p>
          <p className="text-amber-700 text-xs whitespace-pre-line">{message}</p>
        </div>
        {onDismiss && (
          <button
            id="error-dismiss-btn"
            onClick={onDismiss}
            className="text-amber-400 hover:text-amber-600 flex-shrink-0 text-lg leading-none cursor-pointer"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
