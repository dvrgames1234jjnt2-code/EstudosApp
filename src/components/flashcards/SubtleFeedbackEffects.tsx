'use client';

import React, { useEffect, useState } from 'react';

export interface FeedbackEvent {
  timestamp: number;
  label: string;
}

export default function SubtleFeedbackEffects({ event }: { event: FeedbackEvent | null }) {
  const [activeEvent, setActiveEvent] = useState<FeedbackEvent | null>(null);

  useEffect(() => {
    if (event?.timestamp) {
      setActiveEvent(event);
      const timer = setTimeout(() => setActiveEvent(null), 700);
      return () => clearTimeout(timer);
    }
  }, [event]);

  if (!activeEvent) return null;

  const lbl = (activeEvent.label || '').toLowerCase();

  let badgeClass = 'border-slate-500/30 bg-slate-900/90 text-slate-200';
  let gameText = '';

  if (lbl.includes('err') || lbl.includes('branc') || lbl.includes('esqueci')) {
    badgeClass = 'border-red-500/40 bg-red-950/90 text-red-300';
    gameText = 'FOCO!';
  } else if (lbl.includes('auto')) {
    badgeClass = 'border-emerald-500/40 bg-emerald-950/90 text-emerald-300';
    gameText = 'SENSACIONAL!';
  } else if (lbl.includes('rápido') || lbl.includes('rapido')) {
    badgeClass = 'border-blue-500/40 bg-blue-950/90 text-blue-300';
    gameText = 'EXCELENTE!';
  } else if (lbl.includes('pensei')) {
    badgeClass = 'border-amber-500/40 bg-amber-950/90 text-amber-300';
    gameText = 'BOA!';
  }

  if (!gameText) return null;

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[120] pointer-events-none">
      <div className={`px-4 py-1.5 rounded-xl border text-xs font-black tracking-widest uppercase ${badgeClass}`}>
        {gameText}
      </div>
    </div>
  );
}
