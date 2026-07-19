"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Loader2, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (email: string, password?: string, mode?: 'password' | 'otp', isSignUp?: boolean) => Promise<any>;
}

/** Senha fixa para todos os usuários — nunca exposta na UI */
function emailToPassword(_email: string): string {
  return "123";
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [email,   setEmail]   = useState("");
  const [step,    setStep]    = useState<"input" | "loading" | "done">("input");
  const [error,   setError]   = useState("");
  const [welcome, setWelcome] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setStep("loading");
    setError("");

    const password = emailToPassword(trimmed);

    try {
      // 1. Tenta login com senha gerada
      const signIn = await onAuthSuccess(trimmed, password, "password", false);

      if (!signIn?.error) {
        setWelcome(trimmed.split("@")[0]);
        setStep("done");
        setTimeout(() => { handleClose(); window.location.reload(); }, 1100);
        return;
      }

      // 2. Usuário não existe → cria conta silenciosamente
      const signUp = await onAuthSuccess(trimmed, password, "password", true);

      if (signUp?.error) {
        setError("Não foi possível entrar. Verifique o e-mail e tente novamente.");
        setStep("input");
        return;
      }

      // 3. Login após cadastro
      const signIn2 = await onAuthSuccess(trimmed, password, "password", false);
      if (signIn2?.error) {
        setError("Conta criada! Tente entrar novamente.");
        setStep("input");
        return;
      }

      setWelcome(trimmed.split("@")[0]);
      setStep("done");
      setTimeout(() => { handleClose(); window.location.reload(); }, 1100);

    } catch {
      setError("Erro inesperado. Tente novamente.");
      setStep("input");
    }
  };

  const handleClose = () => {
    setEmail("");
    setStep("input");
    setError("");
    setWelcome("");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={step === "loading" ? undefined : handleClose}
            className="absolute inset-0 bg-[#020617]/95 backdrop-blur-xl"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 24 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="relative w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-[32px] p-10 shadow-2xl shadow-black/60 overflow-hidden"
          >
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

            {step !== "loading" && (
              <button onClick={handleClose} className="absolute right-6 top-6 text-slate-600 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            )}

            <AnimatePresence mode="wait">

              {/* ── DONE ── */}
              {step === "done" && (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center text-center py-6 gap-4"
                >
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12, delay: 0.05 }}
                    className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20"
                  >
                    <CheckCircle2 className="w-9 h-9 text-emerald-400" />
                  </motion.div>
                  <div>
                    <p className="text-base font-black text-white capitalize">Olá, {welcome}!</p>
                    <p className="text-xs text-slate-500 mt-1">Entrando...</p>
                  </div>
                </motion.div>
              )}

              {/* ── LOADING ── */}
              {step === "loading" && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex flex-col items-center text-center py-10 gap-5"
                >
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-2 border-blue-500/20 flex items-center justify-center">
                      <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
                    </div>
                    <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white mb-1">Verificando...</p>
                    <p className="text-xs text-slate-500 truncate max-w-[220px]">{email}</p>
                  </div>
                </motion.div>
              )}

              {/* ── INPUT ── */}
              {step === "input" && (
                <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-blue-500/20 relative">
                      <Mail className="w-6 h-6 text-blue-400" />
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <Sparkles className="w-2.5 h-2.5 text-white" />
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-white tracking-tight">Acesso Rápido</h3>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Digite seu e-mail e entre sem senha
                    </p>
                  </div>

                  {error && (
                    <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-rose-400 font-bold mb-4 text-center bg-rose-500/10 border border-rose-500/20 rounded-xl py-2.5 px-3"
                    >
                      {error}
                    </motion.p>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        E-mail
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                        <input
                          type="email"
                          placeholder="nome@exemplo.com"
                          required
                          autoFocus
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full bg-white/[0.03] border border-white/10 rounded-2xl py-4 pl-11 pr-4 text-sm text-white placeholder:text-slate-700 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!email.trim()}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-900/30 active:scale-[0.98] flex items-center justify-center gap-2.5 transition-all disabled:opacity-40 disabled:pointer-events-none mt-2"
                    >
                      <ArrowRight className="w-4 h-4" /> Entrar
                    </button>
                  </form>

                  <p className="text-[10px] text-slate-700 text-center mt-6 leading-relaxed">
                    Sem senha, sem link. Seu progresso fica vinculado ao e-mail.
                  </p>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
