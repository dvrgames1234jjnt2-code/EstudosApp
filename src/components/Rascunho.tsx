"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PenLine, X, Minimize2, Maximize2 } from "lucide-react";
import "tldraw/tldraw.css";

let TldrawComponent: any = null;

export function Rascunho() {
  const [open, setOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [Tldraw, setTldraw] = useState<any>(null);

  useEffect(() => {
    if (open && !Tldraw) {
      import("tldraw").then((mod) => {
        // Tenta pegar o export default ou o export nomeado Tldraw
        const Component = mod.Tldraw || mod.default;
        if (Component) {
          setTldraw(() => Component);
        }
      }).catch(err => {
        console.error("Erro ao carregar Tldraw:", err);
      });
    }
  }, [open, Tldraw]);

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Rascunho"
        className={`fixed bottom-6 right-6 z-[200] w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 ${
          open
            ? "bg-blue-600 text-white shadow-blue-900/40"
            : "bg-[#0F172A] border border-white/10 text-slate-400 hover:text-blue-400 hover:border-blue-500/30"
        }`}
      >
        {open ? <X className="w-5 h-5" /> : <PenLine className="w-5 h-5" />}
      </button>

      {/* Rascunho panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="rascunho"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", bounce: 0.18, duration: 0.4 }}
            className={`fixed z-[199] shadow-2xl overflow-hidden border-l border-white/10 flex flex-col top-0 right-0 h-full transition-all duration-300 ${
              open ? "translate-x-0" : "translate-x-full"
            } ${
              maximized
                ? "w-full"
                : "w-[450px] sm:w-[600px]"
            }`}
            style={{ background: "#1a1a1a" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 bg-[#111827] border-b border-white/[0.06] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 border border-blue-500/20 flex items-center justify-center">
                  <PenLine className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rascunho</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMaximized((v) => !v)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
                  title={maximized ? "Minimizar" : "Maximizar"}
                >
                  {maximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Canvas */}
            <div className="flex-1 relative overflow-hidden">
              {Tldraw ? (
                <Tldraw
                  hideUi={false}
                  inferDarkMode
                  className="absolute inset-0"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                    <span className="text-[10px] text-slate-600 uppercase tracking-widest font-black">Carregando canvas...</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
