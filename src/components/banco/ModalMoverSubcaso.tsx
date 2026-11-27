"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Folder,
  FolderInput,
  Search,
  Loader2,
  Check,
  ArrowRight,
  AlertCircle,
  Info,
} from "lucide-react";
import type { BancoQuestion } from "./QuestionsTable";
import type { MateriaGroup } from "./CadernosTab";

export interface SubcasoToMove {
  id: string;
  nome: string;
  cadernoId: string;
  cadernoNome: string;
  questoes: BancoQuestion[];
}

interface ModalMoverSubcasoProps {
  isOpen: boolean;
  onClose: () => void;
  subcaso: SubcasoToMove | null;
  materias: MateriaGroup[];
  onConfirmMove: (
    subcaso: SubcasoToMove,
    targetCadernoId: string,
    targetCadernoNome: string
  ) => Promise<void>;
}

export function ModalMoverSubcaso({
  isOpen,
  onClose,
  subcaso,
  materias,
  onConfirmMove,
}: ModalMoverSubcasoProps) {
  if (!isOpen || !subcaso) return null;

  return (
    <ModalMoverSubcasoContent
      key={subcaso.id}
      onClose={onClose}
      subcaso={subcaso}
      materias={materias}
      onConfirmMove={onConfirmMove}
    />
  );
}

function ModalMoverSubcasoContent({
  onClose,
  subcaso,
  materias,
  onConfirmMove,
}: {
  onClose: () => void;
  subcaso: SubcasoToMove;
  materias: MateriaGroup[];
  onConfirmMove: (
    subcaso: SubcasoToMove,
    targetCadernoId: string,
    targetCadernoNome: string
  ) => Promise<void>;
}) {
  const [selectedCadernoId, setSelectedCadernoId] = useState<string>("");
  const [selectedCadernoNome, setSelectedCadernoNome] = useState<string>("");
  const [search, setSearch] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const filteredMaterias = useMemo(() => {
    const q = search.trim().toLowerCase();
    return materias
      .map((mat) => {
        const matchMat = q && mat.nome.toLowerCase().includes(q);
        const cadernos = q && !matchMat
          ? mat.cadernos.filter((c) => c.nome.toLowerCase().includes(q))
          : mat.cadernos;
        return { ...mat, cadernos };
      })
      .filter((mat) => mat.cadernos.length > 0);
  }, [materias, search]);

  const isDirectCadernoQuestions = subcaso.id === subcaso.cadernoId;

  const handleConfirm = async () => {
    if (!selectedCadernoId) {
      setErro("Selecione o caderno de destino.");
      return;
    }
    if (selectedCadernoId === subcaso.cadernoId) {
      setErro("Selecione um caderno diferente do atual.");
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await onConfirmMove(subcaso, selectedCadernoId, selectedCadernoNome);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao mover subcaso.";
      setErro(msg);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg flex flex-col bg-[#0d1220] border border-white/[0.10] rounded-2xl overflow-hidden shadow-2xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.07] bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
              <FolderInput size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-normal text-slate-100 truncate">
                Mover Subcaso para outro Caderno
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Subcaso: <span className="text-slate-200">{subcaso.nome}</span> · {subcaso.questoes.length} quest.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Origem + Info */}
        <div className="px-4 pt-3 pb-2 space-y-2 border-b border-white/[0.05] bg-[#090d18]/60 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="text-slate-500 shrink-0">Caderno atual:</span>
            <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-slate-300 truncate">
              {subcaso.cadernoNome}
            </span>
          </div>

          {isDirectCadernoQuestions && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-200/90">
              <Info size={13} className="text-indigo-400 shrink-0 mt-0.5" />
              <span>
                Este caderno não possui subpastas separadas. As {subcaso.questoes.length} questões serão movidas como um novo subcaso no caderno de destino.
              </span>
            </div>
          )}

          {/* Search */}
          <div className="relative flex items-center pt-1">
            <Search size={13} className="absolute left-3 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar caderno ou matéria de destino..."
              className="w-full bg-[#111623] border border-white/[0.09] rounded-xl pl-8 pr-8 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 font-normal"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 text-slate-500 hover:text-slate-300"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {erro && (
          <div className="mx-4 mt-2.5 flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs shrink-0">
            <AlertCircle size={14} className="shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Lista de Cadernos agrupados por Matéria */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 min-h-[220px]">
          {filteredMaterias.length === 0 ? (
            <div className="py-10 text-center text-slate-500 text-xs">
              Nenhum caderno encontrado para &ldquo;{search}&rdquo;.
            </div>
          ) : (
            filteredMaterias.map((mat) => (
              <div key={mat.id} className="space-y-1">
                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400">
                  <span>{mat.icone}</span>
                  <span className="truncate font-normal">{mat.nome}</span>
                </div>
                <div className="space-y-1">
                  {mat.cadernos.map((cad) => {
                    const isCurrent = cad.id === subcaso.cadernoId;
                    const isSelected = selectedCadernoId === cad.id;
                    return (
                      <button
                        key={cad.id}
                        type="button"
                        disabled={isCurrent || salvando}
                        onClick={() => {
                          setSelectedCadernoId(cad.id);
                          setSelectedCadernoNome(cad.nome);
                          setErro(null);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 sm:py-2 rounded-xl text-left text-xs transition-colors border ${
                          isCurrent
                            ? "bg-white/[0.015] border-white/[0.04] text-slate-500 cursor-not-allowed opacity-60"
                            : isSelected
                            ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-100"
                            : "bg-[#111625]/70 hover:bg-white/[0.05] border-white/[0.05] text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Folder
                            size={13}
                            className={
                              isCurrent
                                ? "text-slate-600 shrink-0"
                                : isSelected
                                ? "text-indigo-400 shrink-0"
                                : "text-amber-400/75 shrink-0"
                            }
                          />
                          <span className="truncate font-normal">{cad.nome}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-500 tabular-nums">
                            {cad.casos.length} sub. · {cad.questoes.length} q.
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400 border border-white/[0.07]">
                              Atual
                            </span>
                          )}
                          {isSelected && <Check size={14} className="text-indigo-400 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-white/[0.07] bg-white/[0.02] shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="px-3.5 py-2 sm:py-1.5 rounded-xl border border-white/[0.09] text-slate-400 hover:text-white text-xs transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={salvando || !selectedCadernoId}
            className="flex items-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-40"
          >
            {salvando ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Movendo...</span>
              </>
            ) : (
              <>
                <span>Mover Subcaso</span>
                <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
