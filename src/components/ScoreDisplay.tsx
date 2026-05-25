import React from 'react';

interface ScoreDisplayProps {
  score: number;
  isDarkMode?: boolean;
}

interface ScoreMeta {
  label: string;
  color: string;
  bg: string;
  border: string;
}

const SCORE_META: Record<number, ScoreMeta> = {
  10: { label: 'Excellent',     color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  9:  { label: 'Excellent',     color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
  8:  { label: 'Very Good',     color: 'text-emerald-600',bg: 'bg-emerald-50',border: 'border-emerald-200' },
  7:  { label: 'Good',          color: 'text-teal-600',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  6:  { label: 'Average',       color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  5:  { label: 'Below Average', color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200' },
  4:  { label: 'Moderate Risk', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  3:  { label: 'Low',           color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200' },
  2:  { label: 'Very Low',      color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
  1:  { label: 'Critical',      color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-300' },
};

const SCORE_META_DARK: Record<number, ScoreMeta> = {
  10: { label: 'Excellent',     color: 'text-green-400',  bg: 'bg-green-950/30 font-medium', border: 'border-green-900/50' },
  9:  { label: 'Excellent',     color: 'text-green-400',  bg: 'bg-green-950/30 font-medium', border: 'border-green-900/50' },
  8:  { label: 'Very Good',     color: 'text-emerald-400',bg: 'bg-emerald-950/30 font-medium',border: 'border-emerald-900/50' },
  7:  { label: 'Good',          color: 'text-teal-400',   bg: 'bg-teal-950/30 font-medium',   border: 'border-teal-900/50' },
  6:  { label: 'Average',       color: 'text-yellow-400', bg: 'bg-yellow-950/30 font-medium', border: 'border-yellow-900/50' },
  5:  { label: 'Below Average', color: 'text-orange-400', bg: 'bg-orange-950/30 font-medium', border: 'border-orange-900/50' },
  4:  { label: 'Moderate Risk', color: 'text-orange-400', bg: 'bg-orange-950/30 font-medium', border: 'border-orange-900/50' },
  3:  { label: 'Low',           color: 'text-red-400',    bg: 'bg-red-950/30 font-medium',    border: 'border-red-900/50' },
  2:  { label: 'Very Low',      color: 'text-red-400',    bg: 'bg-red-950/30 font-medium',    border: 'border-red-900/50' },
  1:  { label: 'Critical',      color: 'text-red-400',    bg: 'bg-red-950/30 font-medium',    border: 'border-red-900/50' },
};

const SCORE_EMOJI: Record<number, string> = {
  10: '🟢', 9: '🟢', 8: '🟢', 7: '🟡', 6: '🟡',
  5: '🟠', 4: '🟠', 3: '🔴', 2: '🔴', 1: '🚨',
};

export default function ScoreDisplay({ score, isDarkMode = false }: ScoreDisplayProps) {
  const meta  = isDarkMode ? (SCORE_META_DARK[score] || SCORE_META_DARK[1]) : (SCORE_META[score] || SCORE_META[1]);
  const emoji = SCORE_EMOJI[score] || '🚨';

  return (
    <div id="score-display-card" className={`rounded-xl border ${meta.border} ${meta.bg} p-4 mb-3 text-center transition-colors duration-200`}>
      <div className={`text-xs mb-1 uppercase tracking-wide font-semibold ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
        Blink Health Score
      </div>
      <div className={`text-6xl font-black ${meta.color} leading-none`}>
        {score}
        <span className={`text-xl font-normal ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>/10</span>
      </div>
      <div className={`text-sm font-bold mt-1 ${meta.color}`}>
        {emoji} {meta.label}
      </div>
    </div>
  );
}
