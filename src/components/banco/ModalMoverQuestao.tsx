"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  FolderTree,
  Folder,
  Search,
  Loader2,
  Check,
  ArrowRight,
  AlertCircle
} from "lucide-react";
import { supabase, supabasePublic } from "../../lib/supabase";
import type { OrgNodeDB } from "./CadernosTab";

interface ModalMoverQuestaoProps {
  isOpen: boolean;
  onClose: () => void;
  questaoIds: (string | number)[];
  questaoLabel?: string;
  orgNodes: OrgNodeDB[];
  onSuccess: (targetNodeId: string, targetNodeName: string) => void;
}

export function ModalMoverQuestao({
  isOpen,
  onClose,
  questaoIds,
  questaoLabel,
  orgNodes,
  onSuccess,
}: ModalMoverQuestaoProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const filteredNodes = useMemo(() => {
    if (!search.trim()) return orgNodes;
    const q = search.toLowerCase();
    return orgNodes.filter(n => n.nome.toLowerCase().includes(q) || (n.tipo && n.tipo.toLowerCase().includes(q)));
  }, [orgNodes, search]);

  if (!isOpen || questaoIds.length === 0) return null;

  const handleMover = async () => {
    if (!selectedNodeId) {
      setErro("Selecione um caso ou pasta de destino.");
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const ids = questaoIds.map(id => Number(id) || id);

      let res = await supabase
        .from("questoes")
        .update({ organizacao_id: selectedNodeId })
        .in("id", ids);

      if (res.error) {
        res = await supabasePublic
          .from("questoes")
          .update({ organizacao_id: selectedNodeId })
          .in("id", ids);
      }

      if (res.error) {
        throw new Error(res.error.message);
      }

      const targetNode = orgNodes.find(n => n.id === selectedNodeId);
      onSuccess(selectedNodeId, targetNode?.nome || "Caso");
      onClose();
    } catch (e: any) {
      console.error("Erro ao mover questão:", e);
      setErro(e.message || "Falha ao mover a questão de pasta.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md flex flex-col bg-[#0d1220] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <h3 className="text-xs font-semibold text-slate-200 truncate">
              Mover {questaoIds.length > 1 ? `${questaoIds.length} questões` : questaoLabel || "Questão"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-white rounded hover:bg-white/[0.05]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-white/[0.04]">
          <div className="relative flex items-center">
            <Search size={12} className="absolute left-2.5 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar pasta ou caso..."
              className="w-full bg-[#111623] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-light"
            />
          </div>
        </div>

        {erro && (
          <div className="mx-3 mt-2 flex items-center gap-2 p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            <AlertCircle size={13} className="shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Folder List */}
        <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {filteredNodes.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs font-light">
              Nenhuma pasta encontrada.
            </div>
          ) : (
            filteredNodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition-all ${
                    isSelected
                      ? "bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 font-medium"
                      : "hover:bg-white/[0.04] text-slate-300 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Folder size={13} className={isSelected ? "text-indigo-400" : "text-amber-400/80"} />
                    <span className="truncate">{node.nome}</span>
                    {node.tipo && (
                      <span className="text-[9px] text-slate-500 font-mono uppercase bg-white/[0.04] px-1.5 py-0.2 rounded">
                        {node.tipo}
                      </span>
                    )}
                  </div>
                  {isSelected && <Check size={13} className="text-indigo-400 shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white text-xs transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleMover}
            disabled={salvando || !selectedNodeId}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md transition-all disabled:opacity-40"
          >
            {salvando ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                <span>Movendo...</span>
              </>
            ) : (
              <>
                <span>Mover para esta Pasta</span>
                <ArrowRight size={12} />
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
