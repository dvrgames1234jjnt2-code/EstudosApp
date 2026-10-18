"use client";

import { useState, useCallback } from "react";
import { RefreshCw, CheckCircle2, XCircle, Loader2, Database, ChevronDown, ChevronUp } from "lucide-react";

interface SyncBancoModalProps {
  blocos: { id: string; block_id: string; nome: string; materia?: string }[];
  onClose: () => void;
}

export function SyncBancoModal({ blocos, onClose }: SyncBancoModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(blocos.map(b => b.block_id)));
  const [showLogs, setShowLogs] = useState(false);

  const toggleBloco = (blockId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  };

  const handleSync = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setSyncing(true);
    setDone(false);
    setError(null);
    setLogs([]);
    setTotal(0);

    try {
      const res = await fetch("/api/notion/sync-banco", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocoIds: [...selectedIds] }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Erro desconhecido na sincronização.");
      } else {
        setLogs(data.logs ?? []);
        setTotal(data.total ?? 0);
        setDone(true);
        setShowLogs(true);
      }
    } catch (e: any) {
      setError(e.message ?? "Falha na requisição.");
    } finally {
      setSyncing(false);
    }
  }, [selectedIds]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-xl mx-4 bg-[#0d1220] border border-white/[0.10] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08]">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Database size={15} className="text-indigo-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-black text-white tracking-tight">Sincronizar Banco com Notion</h2>
            <p className="text-[11px] text-slate-400">
              Espelha suas questões e imagens diretamente no Supabase para carregamento instantâneo.
            </p>
          </div>
          <button onClick={onClose} className="ml-auto text-slate-500 hover:text-slate-300 transition-colors">
            <XCircle size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5 overflow-y-auto max-h-[70vh]">
          
          {/* Seleção de cadernos */}
          {!syncing && !done && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  Selecione os cadernos a sincronizar
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedIds(new Set(blocos.map(b => b.block_id)))}
                    className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition-colors"
                  >
                    Todos
                  </button>
                  <span className="text-slate-600">·</span>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-[10px] text-slate-500 hover:text-slate-400 font-bold transition-colors"
                  >
                    Nenhum
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
                {blocos.map(b => (
                  <label
                    key={b.block_id}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all select-none ${
                      selectedIds.has(b.block_id)
                        ? "bg-indigo-600/10 border-indigo-500/30 text-white"
                        : "bg-white/[0.02] border-white/[0.06] text-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(b.block_id)}
                      onChange={() => toggleBloco(b.block_id)}
                      className="w-3.5 h-3.5 accent-indigo-500 shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[12px] font-medium truncate">{b.nome}</span>
                      {b.materia && (
                        <span className="text-[10px] text-indigo-400/70 font-bold truncate">{b.materia}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Em progresso */}
          {syncing && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-600/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin" />
                <Database size={20} className="absolute inset-0 m-auto text-indigo-400" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm font-black text-white">Sincronizando com o Supabase...</p>
                <p className="text-[11px] text-slate-400 text-center max-w-xs">
                  Baixando imagens do Notion e salvando no Supabase Storage.<br />
                  Isso pode levar alguns minutos dependendo do número de questões.
                </p>
              </div>
            </div>
          )}

          {/* Concluído */}
          {done && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <CheckCircle2 size={22} className="text-emerald-400" />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <p className="text-sm font-black text-white">Sincronização concluída!</p>
                <p className="text-[11px] text-slate-400">
                  <span className="text-emerald-400 font-bold">{total} questões</span> salvas no Supabase com imagens permanentes.
                </p>
              </div>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30">
              <XCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-rose-300">{error}</p>
            </div>
          )}

          {/* Logs colapsáveis */}
          {logs.length > 0 && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setShowLogs(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 hover:text-slate-300 uppercase tracking-wider transition-colors self-start"
              >
                {showLogs ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {showLogs ? "Ocultar" : "Ver"} log detalhado ({logs.length} linhas)
              </button>
              {showLogs && (
                <div className="bg-[#080d18] border border-white/[0.06] rounded-xl p-3 max-h-48 overflow-y-auto">
                  {logs.map((line, i) => (
                    <p key={i} className="text-[10px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-t border-white/[0.06] bg-white/[0.01]">
          {!done ? (
            <>
              <button onClick={onClose} className="px-4 py-1.5 rounded-xl text-[11px] font-black text-slate-500 hover:text-slate-300 transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleSync}
                disabled={syncing || selectedIds.size === 0}
                className="ml-auto flex items-center gap-2 px-5 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                {syncing ? "Sincronizando..." : `Sincronizar ${selectedIds.size} caderno(s)`}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="ml-auto flex items-center gap-2 px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
            >
              <CheckCircle2 size={12} /> Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
