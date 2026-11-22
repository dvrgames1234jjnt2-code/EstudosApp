"use client";

import { useState, useCallback } from "react";
import { RefreshCw, CheckCircle2, XCircle, Loader2, Database, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

export interface NotionIdChangeAlert {
  id: string;
  tipo: "id_alterado" | "bloco_removido" | "caderno_nao_encontrado" | "historico_orfao";
  cadernoId?: string;
  cadernoNome?: string;
  antigoId: string;
  novoId?: string;
  numero?: string;
  topico?: string;
  casoNome?: string;
  detectedAt: string;
  mensagem: string;
}

interface SyncBancoModalProps {
  blocos: { id: string; block_id: string; nome: string; materia?: string }[];
  onClose: () => void;
}

export function SyncBancoModal({ blocos, onClose }: SyncBancoModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [idChanges, setIdChanges] = useState<NotionIdChangeAlert[]>([]);
  const [total, setTotal] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [progressPct, setProgressPct] = useState(0);
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
    const selectedBlocos = blocos.filter(b => selectedIds.has(b.block_id));
    if (selectedBlocos.length === 0) return;

    setSyncing(true);
    setDone(false);
    setError(null);
    setLogs([]);
    setIdChanges([]);
    setTotal(0);
    setProgressPct(0);

    let totalSynced = 0;
    const accumulatedLogs: string[] = [];
    const accumulatedChanges: NotionIdChangeAlert[] = [];
    let failedCount = 0;

    try {
      for (let i = 0; i < selectedBlocos.length; i++) {
        const bloco = selectedBlocos[i];
        setProgressText(`Sincronizando ${i + 1} de ${selectedBlocos.length}: ${bloco.nome}`);
        setProgressPct(Math.round((i / selectedBlocos.length) * 100));

        try {
          const res = await fetch("/api/notion/sync-banco", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blocoIds: [bloco.block_id] }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            failedCount++;
            accumulatedLogs.push(`❌ ${bloco.nome}: ${data.error || "Erro na sincronização"}`);
          } else {
            totalSynced += data.total ?? 0;
            const filteredLogs = (data.logs ?? []).filter((l: string, idx: number) =>
              i === 0 || (!l.startsWith("ℹ️") && idx < (data.logs ?? []).length - 1)
            );
            accumulatedLogs.push(...filteredLogs);
            if (Array.isArray(data.idChanges) && data.idChanges.length > 0) {
              accumulatedChanges.push(...(data.idChanges as NotionIdChangeAlert[]));
            }
          }
        } catch (err: unknown) {
          failedCount++;
          const msg = err instanceof Error ? err.message : "Falha de rede";
          accumulatedLogs.push(`❌ ${bloco.nome}: ${msg}`);
        }

        setLogs([...accumulatedLogs]);
        setIdChanges([...accumulatedChanges]);
        setTotal(totalSynced);
      }

      if (accumulatedChanges.length > 0 && typeof window !== "undefined") {
        try {
          const rawPrev = localStorage.getItem("notion_id_change_alerts");
          const prevList: NotionIdChangeAlert[] = rawPrev ? JSON.parse(rawPrev) : [];
          const mergedMap = new Map<string, NotionIdChangeAlert>();
          for (const item of prevList) mergedMap.set(item.id, item);
          for (const item of accumulatedChanges) mergedMap.set(item.id, item);
          localStorage.setItem("notion_id_change_alerts", JSON.stringify([...mergedMap.values()]));
          window.dispatchEvent(new Event("notion-id-alerts-updated"));
        } catch {
          // ignore storage errors
        }
      }

      setProgressPct(100);
      if (failedCount === selectedBlocos.length) {
        setError("Não foi possível sincronizar os cadernos selecionados.");
        setShowLogs(true);
      } else {
        setDone(true);
        setShowLogs(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha na requisição.");
    } finally {
      setSyncing(false);
    }
  }, [blocos, selectedIds]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget && !syncing) onClose(); }}
    >
      <div className="relative w-full max-w-xl mx-4 bg-[#0d1220] border border-white/[0.10] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08]">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Database size={15} className="text-indigo-400" />
          </div>
          <div className="flex flex-col min-w-0">
            <h2 className="text-sm font-black text-white tracking-tight">Sincronizar Banco com Supabase</h2>
            <p className="text-[11px] text-slate-400">
              Consolida questões, caches e imagens permanentes no Supabase para carregamento instantâneo.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={syncing}
            className="ml-auto text-slate-500 hover:text-slate-300 disabled:opacity-40 transition-colors"
          >
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
            <div className="flex flex-col items-center justify-center gap-4 py-6">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-indigo-600/20" />
                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin" />
                <Database size={18} className="absolute inset-0 m-auto text-indigo-400" />
              </div>
              <div className="flex flex-col items-center gap-1.5 w-full max-w-sm">
                <p className="text-xs font-bold text-white text-center">{progressText || "Sincronizando..."}</p>
                <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums">{progressPct}%</span>
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
                  <span className="text-emerald-400 font-bold">{total} registro(s)</span> atualizado(s) no Supabase.
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

          {/* Avisos de modificação de ID de bloco no Notion */}
          {idChanges.length > 0 && (
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-amber-950/35 border border-amber-500/35">
              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold">
                <AlertTriangle size={14} className="shrink-0 text-amber-400" />
                <span>Aviso: {idChanges.length} bloco(s) com ID modificado ou removido no Notion</span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                {idChanges.map(item => (
                  <div key={item.id} className="text-[10.5px] text-amber-100/90 bg-black/30 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
                    <div className="font-semibold text-amber-200">
                      {item.cadernoNome}
                      {item.casoNome ? ` • ${item.casoNome}` : ""}
                      {item.numero ? ` • Q${item.numero}` : ""}
                      {item.topico ? ` (${item.topico})` : ""}
                    </div>
                    <div className="text-amber-300/80 font-mono text-[10px] mt-0.5 break-all">
                      {item.mensagem}
                    </div>
                  </div>
                ))}
              </div>
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
              <button
                onClick={onClose}
                disabled={syncing}
                className="px-4 py-1.5 rounded-xl text-[11px] font-black text-slate-500 hover:text-slate-300 disabled:opacity-40 transition-colors"
              >
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
