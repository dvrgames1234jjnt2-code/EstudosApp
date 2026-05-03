"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Pencil, Eraser, Highlighter, Trash2 } from "lucide-react";

/* ─── Types ──────────────────────────────────── */
type Tool = "pen" | "marker" | "eraser" | "laser";

interface Point { x: number; y: number; }
interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  opacity: number;
  points: Point[];
}

/* ─── Tool config ────────────────────────────── */
const TOOLS: { id: Tool; label: string; icon: React.ElementType; width: number; opacity: number }[] = [
  { id: "pen",     label: "Caneta", icon: Pencil,      width: 2,  opacity: 1    },
  { id: "marker",  label: "Marca-texto", icon: Highlighter, width: 14, opacity: 0.4 },
  { id: "eraser",  label: "Borracha", icon: Eraser,      width: 24, opacity: 1    },
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
    ctx.globalAlpha = s.opacity;
    ctx.strokeStyle = s.tool === "eraser" ? "rgba(0,0,0,0)" : s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (s.tool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.globalAlpha = 1;
    } else if (s.tool === "laser") {
      ctx.globalCompositeOperation = "source-over";
      ctx.shadowBlur = 10;
      ctx.shadowColor = s.color;
      ctx.strokeStyle = s.color;
    } else {
      ctx.globalCompositeOperation = "source-over";
    }

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
      const id = Math.random().toString(36).substr(2, 9);
      
      setAllStrokes((prev) => ({
        ...prev,
        [questionKey]: [...(prev[questionKey] || []), stroke]
      }));

      // If it's a laser, remove it after 2 seconds
      if (stroke.tool === "laser") {
        setTimeout(() => {
          setAllStrokes(prev => ({
            ...prev,
            [questionKey]: (prev[questionKey] || []).filter(s => s !== stroke)
          }));
        }, 2000);
      }
    }
    currentStroke.current = null;
  };

  const clearAll = () => setAllStrokes(prev => ({ ...prev, [questionKey]: [] }));

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
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
      <div className="pointer-events-auto absolute top-0 right-0 flex items-center gap-1.5 p-2 bg-[#0B1220]/80 backdrop-blur-md border border-white/[0.06] rounded-2xl">
        {/* Tools */}
        {[
          ...TOOLS,
          { id: "laser" as Tool, label: "Laser", icon: Highlighter, width: 4, opacity: 1 }
        ].map((t) => {
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
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                isActive
                  ? t.id === "laser" ? "bg-red-500 text-white shadow-lg shadow-red-900/40" : "bg-blue-600 text-white shadow-lg shadow-blue-900/40"
                  : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <Icon className={`w-4 h-4 ${t.id === "laser" ? "rotate-45" : ""}`} />
            </button>
          );
        })}

        {/* Divider */}
        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Colors — only shown when pen, marker or laser active */}
        {active && tool !== "eraser" && (
          <>
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                title={c}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  color === c ? "border-white scale-125" : "border-transparent scale-100 hover:scale-110"
                }`}
                style={{ background: c }}
              />
            ))}
            <div className="w-px h-5 bg-white/10 mx-1" />
          </>
        )}

        {/* Clear */}
        <button
          title="Limpar tudo"
          onClick={clearAll}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
