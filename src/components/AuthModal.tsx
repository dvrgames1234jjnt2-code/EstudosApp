"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Mail, Loader2, Check } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (email: string, password?: string, mode?: 'password' | 'otp', isSignUp?: boolean) => Promise<any>;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMode, setAuthMode] = useState<'password' | 'otp'>('password');
  const [authStep, setAuthStep] = useState<'input' | 'success'>('input');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await onAuthSuccess(authEmail, authPassword, authMode, isSignUp);
      
      if (result?.error) {
        setError(result.error.message);
        setLoading(false);
        return;
      }

      // Se for cadastro, mostramos a tela de verificação
      if (isSignUp || authMode === 'otp') {
        setAuthStep('success');
      } else {
        // Se for login por senha, fechamos direto
        onClose();
        window.location.reload(); // Atualiza para garantir que o estado do usuário seja pego
      }
    } catch (err: any) {
      setError("Erro ao autenticar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-[#020617]/95 backdrop-blur-xl"/>
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-sm bg-[#0F172A] border border-white/10 rounded-[32px] p-10 shadow-2xl flex flex-col">
            <button onClick={onClose} className="absolute right-6 top-6 text-slate-600 hover:text-white"><X className="w-5 h-5"/></button>
            
            <AnimatePresence mode="wait">
              {authStep === 'success' ? (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex flex-col items-center justify-center text-center py-6">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20"><Mail className="w-8 h-8 text-emerald-500" /></div>
                  <h3 className="text-xl font-bold text-white mb-2">{authMode === 'otp' ? 'Código Enviado' : 'Verifique seu E-mail'}</h3>
                  <p className="text-xs text-slate-400 mb-8 leading-relaxed">Enviamos um link para:<br/><span className="text-blue-400 font-bold">{authEmail}</span></p>
                  <button onClick={onClose} className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">Entendi</button>
                </motion.div>
              ) : (
                <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="text-center mb-8">
                    <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-600/20"><Lock className="w-5 h-5 text-blue-500" /></div>
                    <h3 className="text-lg font-bold text-white tracking-tight">{isSignUp ? 'Nova Identidade' : 'Acesso Restrito'}</h3>
                  </div>

                  <div className="flex p-1 bg-white/[0.02] border border-white/5 rounded-xl mb-6">
                    <button onClick={() => setAuthMode('password')} className={`flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${authMode==='password' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Senha</button>
                    <button onClick={() => { setAuthMode('otp'); setIsSignUp(false); }} className={`flex-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-widest rounded-lg transition-all ${authMode==='otp' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}>Código</button>
                  </div>

                  {error && <p className="text-xs text-red-500 font-bold mb-4 text-center">{error}</p>}

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">E-mail</label>
                      <input type="email" placeholder="nome@exemplo.com" required value={authEmail} onChange={(e)=>setAuthEmail(e.target.value)} className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-3.5 px-4 text-sm outline-none focus:border-blue-600/50 transition-all"/>
                    </div>
                    {authMode === 'password' || isSignUp ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest ml-1">Senha</label>
                        <input type="password" placeholder="••••••••" required value={authPassword} onChange={(e)=>setAuthPassword(e.target.value)} className="w-full bg-white/[0.02] border border-white/10 rounded-xl py-3.5 px-4 text-sm outline-none focus:border-blue-600/50 transition-all"/>
                      </div>
                    ) : null}
                    <button type="submit" disabled={loading} className="w-full py-4 bg-gradient-to-r from-blue-700 to-blue-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-900/30 active:scale-[0.98] flex items-center justify-center mt-4">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isSignUp ? 'Finalizar Cadastro' : 'Entrar Agora')}
                    </button>
                    {authMode === 'password' && (
                      <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="w-full text-[10px] font-black text-slate-600 uppercase tracking-widest mt-4 hover:text-slate-400 transition-colors">
                        {isSignUp ? 'Já tenho uma conta' : 'Criar nova conta'}
                      </button>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
