"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, XCircle, X, Info } from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */

type DialogType = "confirm" | "success" | "error" | "info";

interface DialogState {
  open: boolean;
  type: DialogType;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/* ─── Global state (singleton, no context needed) ───────── */

let _setState: ((s: DialogState) => void) | null = null;

const defaultState: DialogState = {
  open: false,
  type: "confirm",
  title: "",
  message: "",
};

export function initDialog(setter: (s: DialogState) => void) {
  _setState = setter;
}

/** Drop-in replacement for window.confirm — returns a Promise<boolean> */
export function showConfirm(
  message: string,
  title = "Confirmação",
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar"
): Promise<boolean> {
  return new Promise((resolve) => {
    _setState?.({
      open: true,
      type: "confirm",
      title,
      message,
      confirmLabel,
      cancelLabel,
      onConfirm: () => { _setState?.({ ...defaultState, open: false }); resolve(true); },
      onCancel:  () => { _setState?.({ ...defaultState, open: false }); resolve(false); },
    });
  });
}

/** Drop-in replacement for window.alert */
export function showAlert(
  message: string,
  type: "success" | "error" | "info" = "info",
  title?: string
): Promise<void> {
  const autoTitle = title ?? (type === "success" ? "Sucesso" : type === "error" ? "Erro" : "Aviso");
  return new Promise((resolve) => {
    _setState?.({
      open: true,
      type,
      title: autoTitle,
      message,
      confirmLabel: "OK",
      onConfirm: () => { _setState?.({ ...defaultState, open: false }); resolve(); },
    });
  });
}

/* ─── Icon map ───────────────────────────────────────────── */

const icons: Record<DialogType, { icon: React.ElementType; color: string; glow: string; ring: string }> = {
  confirm: { icon: AlertTriangle, color: "text-amber-400",    glow: "bg-amber-400/10",   ring: "border-amber-400/20" },
  success: { icon: CheckCircle2,  color: "text-emerald-400",  glow: "bg-emerald-400/10", ring: "border-emerald-400/20" },
  error:   { icon: XCircle,       color: "text-red-400",      glow: "bg-red-400/10",     ring: "border-red-400/20" },
  info:    { icon: Info,          color: "text-blue-400",     glow: "bg-blue-400/10",    ring: "border-blue-400/20" },
};

const confirmBtn: Record<DialogType, string> = {
  confirm: "bg-red-600 hover:bg-red-500 shadow-red-900/30",
  success: "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/30",
  error:   "bg-red-600 hover:bg-red-500 shadow-red-900/30",
  info:    "bg-blue-600 hover:bg-blue-500 shadow-blue-900/30",
};

/* ─── Component ──────────────────────────────────────────── */

interface Props {
  state: DialogState;
}

export function DialogOverlay({ state }: Props) {
  // Guard: if dialog is closed or type is invalid, render nothing
  const meta = icons[state.type] ?? icons["info"];
  const Icon = meta.icon;

  return (
    <AnimatePresence>
      {state.open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6">
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={state.onCancel ?? state.onConfirm}
            className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.35 }}
            className="relative w-full max-w-md bg-[#0B1220] border border-white/10 rounded-[28px] p-8 shadow-2xl"
          >
            {/* Top accent bar */}
            <div className={`absolute top-0 left-0 right-0 h-[2px] rounded-t-[28px] bg-gradient-to-r from-transparent ${
              state.type === "success" ? "via-emerald-500" : 
              state.type === "error"   ? "via-red-500" : 
              state.type === "confirm" ? "via-amber-500" : "via-blue-500"
            } to-transparent`} />

            {/* Close button (only for non-blocking dialogs) */}
            {state.onCancel && (
              <button
                onClick={state.onCancel}
                className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl ${meta.glow} border ${meta.ring} flex items-center justify-center mb-6`}>
              <Icon className={`w-7 h-7 ${meta.color}`} />
            </div>

            {/* Text */}
            <h3 className="text-xl font-bold text-white tracking-tight mb-2">{state.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed mb-8">{state.message}</p>

            {/* Buttons */}
            <div className="flex gap-3 justify-end">
              {state.onCancel && (
                <button
                  onClick={state.onCancel}
                  className="px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                >
                  {state.cancelLabel ?? "Cancelar"}
                </button>
              )}
              <button
                onClick={state.onConfirm}
                className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95 ${confirmBtn[state.type]}`}
              >
                {state.confirmLabel ?? "OK"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
