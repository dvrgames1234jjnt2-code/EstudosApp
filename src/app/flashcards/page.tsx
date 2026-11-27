'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import FlashcardsView from '@/components/flashcards/FlashcardsView';

export default function FlashcardsPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;

    const checkAdminForEmail = async (email?: string) => {
      if (!email) {
        if (active) {
          setIsAdmin(false);
          setChecking(false);
        }
        return;
      }
      try {
        const { data } = await supabase
          .from('notion_blocks_admins')
          .select('email')
          .ilike('email', email)
          .maybeSingle();
        if (active) {
          setIsAdmin(!!data);
          setChecking(false);
        }
      } catch {
        if (active) {
          setIsAdmin(false);
          setChecking(false);
        }
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => checkAdminForEmail(session?.user?.email))
      .catch(() => {
        if (active) {
          setIsAdmin(false);
          setChecking(false);
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void checkAdminForEmail(session?.user?.email);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

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
        {checking ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-xs">Verificando acesso...</span>
          </div>
        ) : !isAdmin ? (
          <div className="max-w-md mx-auto my-16 p-6 rounded-2xl bg-[#11141c] border border-white/[0.08] text-center space-y-4">
            <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-slate-400">
              <Lock className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-medium text-white">Acesso restrito ao administrador</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Os Flashcards 3D estão disponíveis apenas para contas administradoras no momento.
              </p>
            </div>
            <Link
              href="/banco"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Voltar ao Banco
            </Link>
          </div>
        ) : (
          <FlashcardsView />
        )}
      </main>
    </div>
  );
}
