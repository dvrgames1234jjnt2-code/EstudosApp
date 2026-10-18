"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Pencil, Eraser, Highlighter, Trash2, Zap } from "lucide-react";

/* ─── Types ──────────────────────────────────── */
type Tool = "pen" | "marker" | "eraser" | "laser";

interface Point { x: number; y: number; }
interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
  timestamp?: number;
}

/* ─── Tool config ────────────────────────────── */
const TOOLS: { id: Tool; label: string; icon: React.ElementType; width: number; opacity: number }[] = [
  { id: "pen",     label: "Caneta", icon: Pencil,      width: 2,  opacity: 1    },
  { id: "marker",  label: "Marca-texto", icon: Highlighter, width: 14, opacity: 0.4 },
  { id: "eraser",  label: "Borracha", icon: Eraser,      width: 24, opacity: 1    },
  { id: "laser",   label: "Laser", icon: Zap,      width: 4,  opacity: 1    },
];

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ffffff"];

/* ─── Component ──────────────────────────────── */
interface Props {
  /** Key to reset canvas when question changes */
  questionKey: number | string;
}

export function DrawOverlay({ questionKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#ef4444");
  const [allStrokes, setAllStrokes] = useState<Record<string, Stroke[]>>({});
  const strokes = allStrokes[questionKey] || [];
  
  const [active, setActive] = useState(false);
  const drawing = useRef(false);
  const currentStroke = useRef<Stroke | null>(null);

  // Redraw canvas whenever strokes or question changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((s) => renderStroke(ctx, s));
  }, [strokes]);

  // Resize canvas to fill parent
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const { width, height } = parent.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      // Re-render after resize
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      strokes.forEach((s) => renderStroke(ctx, s));
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [strokes]);

  function renderStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
    if (s.points.length < 2) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (s.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        const prev = s.points[i - 1];
        const curr = s.points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.stroke();
    } else if (s.tool === "laser") {
      ctx.globalCompositeOperation = "source-over";
      
      const currentOpacity = s.opacity ?? 1;

      // 1. Camada de Brilho Intenso (Glow)
      ctx.shadowBlur = 20 * currentOpacity;
      ctx.shadowColor = s.color;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * 2.5; // Mais largo para mais brilho
      ctx.globalAlpha = 0.8 * currentOpacity; // Mais opaco no início
      
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        const prev = s.points[i - 1];
        const curr = s.points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.stroke();

      // 2. Camada de Núcleo (Core - Fino e Branco)
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = s.width * 0.3; // Mais fino para parecer mais intenso
      ctx.globalAlpha = 1 * currentOpacity;
      
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        const prev = s.points[i - 1];
        const curr = s.points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.stroke();
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = s.opacity ?? 1;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        const prev = s.points[i - 1];
        const curr = s.points[i];
        const mx = (prev.x + curr.x) / 2;
        const my = (prev.y + curr.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
      }
      ctx.stroke();
    }
    
    ctx.restore();
  }

  const getPos = (e: React.PointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const cfg = TOOLS.find((t) => t.id === tool)!;

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    drawing.current = true;
    const pos = getPos(e);
    currentStroke.current = {
      tool,
      color,
      width: cfg.width,
      opacity: cfg.opacity,
      points: [pos],
      timestamp: tool === "laser" ? Date.now() : undefined
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!active || !drawing.current || !currentStroke.current) return;
    e.preventDefault();
    const pos = getPos(e);
    currentStroke.current.points.push(pos);

    // Live preview
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((s) => renderStroke(ctx, s));
    renderStroke(ctx, currentStroke.current);
  };

  const onPointerUp = () => {
    if (!drawing.current || !currentStroke.current) return;
    drawing.current = false;
    
    if (currentStroke.current.points.length > 1) {
      const stroke = { ...currentStroke.current };
      
      // Imediatamente limpa o preview para evitar ghosting
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        strokes.forEach((s) => renderStroke(ctx, s));
      }

      setAllStrokes((prev) => ({
        ...prev,
        [questionKey]: [...(prev[questionKey] || []), stroke]
      }));
    }
    currentStroke.current = null;
  };

  // Timer para efeito de "desfazer" do laser (fade-out gradual)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      
      setAllStrokes(prev => {
        const currentList = prev[questionKey] || [];
        if (!currentList.some(s => s.tool === 'laser')) return prev;
        
        const newList = currentList.map(s => {
          if (s.tool === 'laser') {
            const age = now - (s.timestamp || 0);
            if (age > 500) {
              const factor = Math.max(0, 1 - (age - 500) / 1000);
              return { ...s, opacity: factor };
            }
          }
          return s;
        }).filter(s => {
          if (s.tool === 'laser') return (s.opacity ?? 1) > 0.05;
          return true;
        });

        return { ...prev, [questionKey]: newList };
      });
    }, 50);
    return () => clearInterval(timer);
  }, [questionKey]);

  const clearAll = () => setAllStrokes(prev => ({ ...prev, [questionKey]: [] }));

  return (
    <div className="absolute inset-0 pointer-events-none z-[80]">
      {/* Canvas — only pointer-events when active */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full ${active ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />

      {/* Toolbar — always interactive */}
      <div className="pointer-events-auto fixed lg:absolute bottom-6 left-1/2 -translate-x-1/2 lg:translate-x-0 lg:bottom-auto lg:top-0 lg:right-0 flex items-center gap-1.5 p-2 bg-[#0B1220]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl z-[70] max-w-[95vw] overflow-x-auto no-scrollbar">
        {/* Tools */}
        <div className="flex items-center gap-1.5 shrink-0">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const isActive = active && tool === t.id;
            return (
              <button
                key={t.id}
                title={t.label}
                onClick={() => {
                  if (active && tool === t.id) {
                    setActive(false);
                  } else {
                    setTool(t.id);
                    setActive(true);
                    if (t.id === "laser") setColor("#ef4444"); // Default red for laser
                  }
                }}
                className={`w-9 h-9 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? t.id === "laser" ? "bg-red-500 text-white shadow-lg shadow-red-900/40" : "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className={`w-4 h-4 ${t.id === "laser" ? "rotate-45" : ""}`} />
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />

        {/* Colors — only shown when pen, marker or laser active */}
        {active && tool !== "eraser" && (
          <div className="flex items-center gap-2 shrink-0 px-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={c}
                className={`w-5 h-5 sm:w-4 sm:h-4 rounded-full border-2 transition-all ${
                  color === c ? "border-white scale-125 shadow-lg shadow-white/20" : "border-transparent scale-100 hover:scale-110"
                }`}
                style={{ background: c }}
              />
            ))}
            <div className="w-px h-5 bg-white/10 mx-1 shrink-0" />
          </div>
        )}

        {/* Clear */}
        <button
          title="Limpar tudo"
          onClick={clearAll}
          className="w-9 h-9 sm:w-8 sm:h-8 shrink-0 rounded-xl flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </button>
      </div>
    </div>
  );
}
