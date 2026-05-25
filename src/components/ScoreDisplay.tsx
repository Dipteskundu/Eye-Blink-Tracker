import React from 'react';

interface ScoreDisplayProps {
  score: number;
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

const SCORE_EMOJI: Record<number, string> = {
  10: '🟢', 9: '🟢', 8: '🟢', 7: '🟡', 6: '🟡',
  5: '🟠', 4: '🟠', 3: '🔴', 2: '🔴', 1: '🚨',
};

export default function ScoreDisplay({ score }: ScoreDisplayProps) {
  const meta  = SCORE_META[score] || SCORE_META[1];
  const emoji = SCORE_EMOJI[score] || '🚨';

  return (
    <div id="score-display-card" className={`rounded-xl border ${meta.border} ${meta.bg} p-4 mb-3 text-center`}>
      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide font-semibold">
        Blink Health Score
      </div>
      <div className={`text-6xl font-black ${meta.color} leading-none`}>
        {score}
        <span className="text-xl text-gray-400 font-normal">/10</span>
      </div>
      <div className={`text-sm font-bold mt-1 ${meta.color}`}>
        {emoji} {meta.label}
      </div>
    </div>
  );
}
