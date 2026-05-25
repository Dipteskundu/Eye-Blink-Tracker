import React from 'react';
import { SessionResult } from '../types';

interface SummaryPanelProps {
  result: SessionResult;
  isDarkMode?: boolean;
}

const TIPS: Record<string, string[]> = {
  excellent: [
    'Great blink rate — your eyes are well lubricated.',
    'Keep taking 20-20-20 breaks (every 20 min, look 20 ft away for 20 sec).',
    'Stay hydrated — it supports tear film quality.',
  ],
  good: [
    'Good blink rate. Minor improvements are possible.',
    'Try consciously blinking every few minutes.',
    'Reduce screen glare with an anti-glare filter.',
  ],
  moderate: [
    'Your blink rate is below the healthy range.',
    'Follow the 20-20-20 rule consistently.',
    'Use preservative-free lubricating eye drops.',
    'Reduce screen brightness and enable night mode.',
  ],
  low: [
    'Your blink rate is significantly low.',
    'Take a 5-minute break every 30 minutes.',
    'Use lubricating eye drops every 1–2 hours.',
    'Adjust your monitor to eye level to reduce strain.',
    'Consider using a blue-light filter or glasses.',
  ],
  critical: [
    'Your blink rate is critically low. This may cause serious eye dryness.',
    'See an eye care specialist as soon as possible.',
    'Limit screen time until you have been evaluated.',
    'Use lubricating eye drops every 30–60 minutes.',
  ],
};

function getCategory(score: number): string {
  if (score >= 9) return 'excellent';
  if (score >= 7) return 'good';
  if (score >= 5) return 'moderate';
  if (score >= 3) return 'low';
  return 'critical';
}

export default function SummaryPanel({ result, isDarkMode = false }: SummaryPanelProps) {
  const { totalBlinks, blinksPerMinute, score, duration } = result;
  const category   = getCategory(score);
  const tips       = TIPS[category] || TIPS.critical;
  const needsDoctor = score <= 2;
  const durationLabel = duration >= 300 ? '5 min' : '1 min';

  return (
    <div id="summary-panel" className="text-sm">
      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { id: 'stat-total-blinks', label: 'Total Blinks', value: totalBlinks },
          { id: 'stat-rate-bpm', label: 'Per Minute', value: blinksPerMinute.toFixed(1) },
          { id: 'stat-duration', label: 'Duration', value: durationLabel },
        ].map(({ id, label, value }) => (
          <div id={id} key={label} className={`rounded-lg p-2 text-center border transition-colors duration-200 ${
            isDarkMode 
              ? 'bg-slate-950 border-slate-800' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className={`font-bold text-base transition-colors duration-200 ${isDarkMode ? 'text-slate-100' : 'text-gray-800'}`}>{value}</div>
            <div className={`text-xs transition-colors duration-200 ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>{label}</div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <p className={`font-semibold text-xs uppercase tracking-wide mb-2 ${isDarkMode ? 'text-slate-400' : 'text-gray-700'}`}>
        Recommendations
      </p>
      <ul className="space-y-1 mb-3">
        {tips.map((tip, i) => (
          <li key={i} className={`flex gap-2 text-xs transition-colors duration-200 ${isDarkMode ? 'text-slate-300' : 'text-gray-600'}`}>
            <span className={`${isDarkMode ? 'text-blue-450' : 'text-blue-400'} mt-0.5 flex-shrink-0`}>•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>

      {/* Doctor alert — only shown when score <= 2 */}
      {needsDoctor && (
        <div id="doctor-warning-alert" className={`border-2 rounded-xl p-3 text-center transition-colors duration-200 ${
          isDarkMode 
            ? 'bg-red-950/20 border-red-900/50' 
            : 'bg-red-50 border-red-400'
        }`}>
          <div className={`font-bold text-sm mb-1 ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>
            ⚠️ Please Contact a Doctor
          </div>
          <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-red-300/95' : 'text-red-600'}`}>
            Your blink rate is critically low. This can cause severe dry eye and corneal damage.
            Please consult an ophthalmologist or optometrist as soon as possible.
          </p>
        </div>
      )}
    </div>
  );
}
