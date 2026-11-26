'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import FlashcardsView from '@/components/flashcards/FlashcardsView';

export default function FlashcardsPage() {
  return (
    <div className="min-h-screen bg-[#0b0d12] text-slate-100">
      <header className="sticky top-0 z-40 h-14 border-b border-white/[0.06] bg-[#0e1015] px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/banco"
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400 hover:text-white transition-colors shrink-0"
            aria-label="Voltar ao Banco"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-sm sm:text-base font-medium text-white truncate">
            Flashcards 3D
          </h1>
        </div>
      </header>
      <main className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6">
        <FlashcardsView />
      </main>
    </div>
  );
}
