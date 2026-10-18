"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calculator,
  X,
  GraduationCap,
  Minus,
  GripHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Carrega o canvas de desenho de forma estrita no lado do cliente
const DrawCanvas = dynamic(() => import("./DrawComponent"), {
  ssr: false,
  loading: () => (
    <div style={{ position: "fixed", inset: 0, top: "3.5rem", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#020617" }}>
      <p style={{ color: "#475569", fontSize: "11px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.3em" }}>
        Carregando Área de Desenho...
      </p>
    </div>
  ),
});

/* ─── Calculadora Profissional Hook ─────────────────────────── */
type CalcOp = "+" | "-" | "×" | "÷" | null;

function useCalculator() {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<string | null>(null);
  const [op, setOp] = useState<CalcOp>(null);
  const [waitingNext, setWaitingNext] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [expression, setExpression] = useState("");

  const pushHistory = (expr: string, result: string) => {
    setHistory((h) => [`${expr} = ${result}`, ...h].slice(0, 6));
  };

  const inputDigit = (d: string) => {
    if (waitingNext) { setDisplay(d); setWaitingNext(false); }
    else { setDisplay(display === "0" ? d : display + d); }
  };

  const inputDecimal = () => {
    if (waitingNext) { setDisplay("0."); setWaitingNext(false); return; }
    if (!display.includes(".")) setDisplay(display + ".");
  };

  const compute = (a: number, b: number, operation: CalcOp): number => {
    switch (operation) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b !== 0 ? a / b : NaN;
      default: return b;
    }
  };

  const fmt = (n: number): string => {
    if (isNaN(n) || !isFinite(n)) return "Erro";
    const s = String(n);
    if (s.length > 12) return parseFloat(n.toPrecision(10)).toString();
    return s;
  };

  const inputOp = (nextOp: CalcOp) => {
    const curr = parseFloat(display);
    if (prev !== null && !waitingNext) {
      const result = compute(parseFloat(prev), curr, op);
      const expr = `${prev} ${op} ${display}`;
      pushHistory(expr, fmt(result));
      setDisplay(fmt(result));
      setPrev(fmt(result));
      setExpression(`${fmt(result)} ${nextOp}`);
    } else {
      setPrev(display);
      setExpression(`${display} ${nextOp}`);
    }
    setWaitingNext(true);
    setOp(nextOp);
  };

  const equals = () => {
    if (op === null || prev === null) return;
    const curr = parseFloat(display);
    const result = compute(parseFloat(prev), curr, op);
    const expr = `${prev} ${op} ${display}`;
    pushHistory(expr, fmt(result));
    setExpression(`${expr} =`);
    setDisplay(fmt(result));
    setPrev(null); setOp(null); setWaitingNext(true);
  };

  const formatDisplay = (val: string): string => {
    if (val === "Erro" || val === "") return val;
    const negative = val.startsWith("-");
    const abs = negative ? val.slice(1) : val;
    const dotIndex = abs.indexOf(".");
    const intPart = dotIndex >= 0 ? abs.slice(0, dotIndex) : abs;
    const decPart = dotIndex >= 0 ? abs.slice(dotIndex) : "";
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (negative ? "-" : "") + formattedInt + decPart;
  };

  const clear = () => { setDisplay("0"); setPrev(null); setOp(null); setWaitingNext(false); setExpression(""); };
  const clearEntry = () => setDisplay("0");
  const toggleSign = () => setDisplay(String(parseFloat(display) * -1));
  const percent = () => setDisplay(String(parseFloat(display) / 100));
  const backspace = () => {
    if (display.length <= 1 || (display.length === 2 && display.startsWith("-"))) setDisplay("0");
    else setDisplay(display.slice(0, -1));
  };
  const sqrt = () => {
    const r = Math.sqrt(parseFloat(display));
    setExpression(`√(${display})`);
    setDisplay(fmt(r));
    setWaitingNext(true);
  };
  const square = () => {
    const n = parseFloat(display);
    setExpression(`(${display})²`);
    setDisplay(fmt(n * n));
    setWaitingNext(true);
  };
  const reciprocal = () => {
    const n = parseFloat(display);
    setExpression(`1/(${display})`);
    setDisplay(n === 0 ? "Erro" : fmt(1 / n));
    setWaitingNext(true);
  };

  return {
    display, expression, op, history,
    formatDisplay,
    inputDigit, inputDecimal, inputOp, equals,
    clear, clearEntry, toggleSign, percent, backspace,
    sqrt, square, reciprocal,
  };
}

function CalcBtn({
  label, onClick, wide = false,
  variant = "default",
}: {
  label: string; onClick: () => void; wide?: boolean;
  variant?: "default" | "op" | "equals" | "clear" | "func";
}) {
  const base = "flex items-center justify-center rounded-xl font-bold text-sm select-none transition-all duration-100 active:scale-95 cursor-pointer h-12";
  const variants: Record<string, string> = {
    default: "bg-[#1a2035] border border-white/[0.06] text-slate-200 hover:bg-[#1e2840] hover:border-white/10",
    op: "bg-blue-600/20 border border-blue-500/30 text-blue-400 hover:bg-blue-600/30",
    equals: "bg-blue-600 border border-blue-500 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/40",
    clear: "bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30",
    func: "bg-white/[0.04] border border-white/[0.06] text-slate-400 hover:bg-white/[0.08] text-xs",
  };
  return (
    <button className={`${base} ${variants[variant]} ${wide ? "col-span-2" : ""}`} onClick={onClick} onPointerDown={(e) => e.stopPropagation()}>
      {label}
    </button>
  );
}

function FloatingCalculator({ onClose }: { onClose: () => void }) {
  const c = useCalculator();
  const [minimized, setMinimized] = useState(false);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0}
      onPointerDown={(e) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      style={{ position: "fixed", right: 24, bottom: 24, zIndex: 9999, touchAction: "none" }}
      className="w-72 bg-[#0B1220]/95 border border-white/10 rounded-[28px] shadow-2xl shadow-black/60 overflow-hidden backdrop-blur-xl"
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 cursor-grab active:cursor-grabbing select-none" style={{ touchAction: "none" }}>
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-600" />
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.25em]">Calculadora</span>
        </div>
        <div className="flex items-center gap-1">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setMinimized(!minimized)} className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white"><Minus className="w-3 h-3" /></button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onClose} className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white"><X className="w-3 h-3" /></button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!minimized && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
            {c.history.length > 0 && (
              <div className="px-4 max-h-12 overflow-hidden">
                {c.history.slice(0, 2).map((h, i) => <p key={i} className="text-[10px] text-slate-700 font-mono text-right truncate">{h}</p>)}
              </div>
            )}
            <div className="px-4 py-2 text-right">
              {c.expression && <p className="text-[10px] text-blue-500/60 font-mono mb-0.5 truncate">{c.expression}</p>}
              <div className="text-white font-mono font-light truncate leading-none" style={{ fontSize: c.formatDisplay(c.display).length > 10 ? "1.75rem" : "2.25rem" }}>
                {c.formatDisplay(c.display)}
              </div>
            </div>

            <div className="mx-4 h-px bg-white/[0.05] mb-3" />

            <div className="px-3 pb-4 grid grid-cols-4 gap-1.5">
              <CalcBtn label="x²" onClick={c.square} variant="func" />
              <CalcBtn label="√x" onClick={c.sqrt} variant="func" />
              <CalcBtn label="1/x" onClick={c.reciprocal} variant="func" />
              <CalcBtn label="⌫" onClick={c.backspace} variant="clear" />
              <CalcBtn label="AC" onClick={c.clear} variant="clear" />
              <CalcBtn label="CE" onClick={c.clearEntry} variant="func" />
              <CalcBtn label="±" onClick={c.toggleSign} variant="func" />
              <CalcBtn label="÷" onClick={() => c.inputOp("÷")} variant="op" />
              <CalcBtn label="7" onClick={() => c.inputDigit("7")} />
              <CalcBtn label="8" onClick={() => c.inputDigit("8")} />
              <CalcBtn label="9" onClick={() => c.inputDigit("9")} />
              <CalcBtn label="×" onClick={() => c.inputOp("×")} variant="op" />
              <CalcBtn label="4" onClick={() => c.inputDigit("4")} />
              <CalcBtn label="5" onClick={() => c.inputDigit("5")} />
              <CalcBtn label="6" onClick={() => c.inputDigit("6")} />
              <CalcBtn label="−" onClick={() => c.inputOp("-")} variant="op" />
              <CalcBtn label="1" onClick={() => c.inputDigit("1")} />
              <CalcBtn label="2" onClick={() => c.inputDigit("2")} />
              <CalcBtn label="3" onClick={() => c.inputDigit("3")} />
              <CalcBtn label="+" onClick={() => c.inputOp("+")} variant="op" />
              <CalcBtn label="%" onClick={c.percent} variant="func" />
              <CalcBtn label="0" onClick={() => c.inputDigit("0")} />
              <CalcBtn label="." onClick={c.inputDecimal} />
              <CalcBtn label="=" onClick={c.equals} variant="equals" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Main Page ─── */
export default function DrawPage() {
  const router = useRouter();
  const [showCalc, setShowCalc] = useState(false);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#020617] overflow-hidden" suppressHydrationWarning>
      {/* Top bar */}
      <div className="h-14 flex items-center justify-between px-4 sm:px-6 shrink-0 bg-[#0B1220]/95 backdrop-blur-md border-b border-white/[0.06] z-50" suppressHydrationWarning>
        <div className="flex items-center gap-3" suppressHydrationWarning>
          <button onClick={() => { window.location.href = '/'; }} className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-slate-500 hover:text-white transition-all" suppressHydrationWarning><ArrowLeft className="w-4 h-4" suppressHydrationWarning /></button>
          <div className="flex items-center gap-2" suppressHydrationWarning>
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20" suppressHydrationWarning><GraduationCap className="text-white w-3.5 h-3.5" suppressHydrationWarning /></div>
            <span className="text-sm font-bold text-white tracking-tight" suppressHydrationWarning>My <span className="text-blue-500" suppressHydrationWarning>Study.</span></span>
          </div>
        </div>

        <button onClick={() => setShowCalc((v) => !v)} className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 border rounded-xl transition-all group ${showCalc ? "bg-blue-600/30 border-blue-500/60 text-blue-300" : "bg-blue-600/10 border-blue-500/25 text-blue-400 hover:bg-blue-600/20"}`} title="Calculadora" suppressHydrationWarning>
          <Calculator className="w-4 h-4 group-hover:scale-110 transition-transform" suppressHydrationWarning />
          <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block" suppressHydrationWarning>Calculadora</span>
        </button>
      </div>

      {/* Dynamic Canvas Container */}
      <DrawCanvas />

      {/* Floating Calculator overlays DrawCanvas */}
      <AnimatePresence>
        {showCalc && <FloatingCalculator onClose={() => setShowCalc(false)} />}
      </AnimatePresence>
    </div>
  );
}
