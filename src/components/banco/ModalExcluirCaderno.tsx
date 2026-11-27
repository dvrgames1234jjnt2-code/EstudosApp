"use client";

import React, { useState } from "react";
import {
  X,
  Trash2,
  AlertTriangle,
  Loader2,
  Unlink,
  AlertCircle,
} from "lucide-react";
import type { BancoQuestion } from "./QuestionsTable";

export interface DeleteTargetNode {
  kind: "caderno" | "subcaso" | "pasta" | "disciplina";
  id: string;
  nome: string;
  materia?: string;
  cadernosCount?: number;
  subcasosCount?: number;
  questoes: BancoQuestion[];
}

interface ModalExcluirCadernoProps {
  isOpen: boolean;
  onClose: () => void;
  target: DeleteTargetNode | null;
  onConfirmDelete: (
    target: DeleteTargetNode,
    deleteQuestions: boolean
  ) => Promise<void>;
}

export function ModalExcluirCaderno({
  isOpen,
  onClose,
  target,
  onConfirmDelete,
}: ModalExcluirCadernoProps) {
  if (!isOpen || !target) return null;

  return (
    <ModalExcluirCadernoContent
      key={target.id}
      onClose={onClose}
      target={target}
      onConfirmDelete={onConfirmDelete}
    />
  );
}

function ModalExcluirCadernoContent({
  onClose,
  target,
  onConfirmDelete,
}: {
  onClose: () => void;
  target: DeleteTargetNode;
  onConfirmDelete: (
    target: DeleteTargetNode,
    deleteQuestions: boolean
  ) => Promise<void>;
}) {
  const isVirtual =
    target.id.startsWith("cad_virt_") ||
    target.id.startsWith("caso_virt_") ||
    target.id.startsWith("root_virt_");

  const [deleteQuestions, setDeleteQuestions] = useState(isVirtual);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const qCount = target.questoes.length;
  const kindLabel =
    target.kind === "disciplina"
      ? "disciplina"
      : target.kind === "caderno"
      ? "caderno"
      : target.kind === "subcaso"
      ? "subcaso"
      : "pasta";
  const KindTitle =
    target.kind === "disciplina"
      ? "Excluir Disciplina"
      : target.kind === "caderno"
      ? "Excluir Caderno"
      : target.kind === "subcaso"
      ? "Excluir Subcaso"
      : "Excluir Pasta";

  const handleConfirm = async () => {
    setExcluindo(true);
    setErro(null);
    try {
      await onConfirmDelete(target, qCount > 0 ? deleteQuestions : false);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : `Erro ao excluir ${kindLabel}.`;
      setErro(msg);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[115] flex items-center justify-center p-3 sm:p-5 bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md flex flex-col bg-[#0d1220] border border-rose-500/30 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.07] bg-rose-500/[0.04]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle size={16} />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-normal text-white truncate">
                {KindTitle}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {target.materia ? `${target.materia} · ` : ""}
                {target.nome}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={excluindo}
            className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors shrink-0"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <div className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.07] space-y-1">
            <p className="text-xs text-slate-200 break-words">
              {target.nome}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              {typeof target.cadernosCount === "number" && target.cadernosCount > 0 && (
                <span>{target.cadernosCount} caderno(s)</span>
              )}
              {typeof target.subcasosCount === "number" && target.subcasosCount > 0 && (
                <span>{target.subcasosCount} subcaso(s)</span>
              )}
              <span>{qCount} questão(ões) vinculada(s)</span>
            </div>
          </div>

          {qCount > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-400">
                O que fazer com as {qCount} questão(ões) deste {kindLabel}?
              </p>

              {!isVirtual && (
                <button
                  type="button"
                  onClick={() => setDeleteQuestions(false)}
                  className={`w-full flex items-start gap-2.5 p-3 rounded-xl border text-left transition-colors ${
                    !deleteQuestions
                      ? "bg-indigo-500/12 border-indigo-500/45 text-slate-100"
                      : "bg-white/[0.02] border-white/[0.07] text-slate-400 hover:bg-white/[0.04]"
                  }`}
                >
                  <Unlink
                    size={15}
                    className={`shrink-0 mt-0.5 ${
                      !deleteQuestions ? "text-indigo-400" : "text-slate-500"
                    }`}
                  />
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium">
                      Excluir apenas o {kindLabel} (manter questões no banco)
                    </p>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Remove o {kindLabel} e suas subpastas, mas preserva todas as {qCount} questões no Banco de Questões.
                    </p>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => setDeleteQuestions(true)}
                className={`w-full flex items-start gap-2.5 p-3 rounded-xl border text-left transition-colors ${
                  deleteQuestions
                    ? "bg-rose-500/15 border-rose-500/50 text-rose-100"
                    : "bg-white/[0.02] border-white/[0.07] text-slate-400 hover:bg-white/[0.04]"
                }`}
              >
                <Trash2
                  size={15}
                  className={`shrink-0 mt-0.5 ${
                    deleteQuestions ? "text-rose-400" : "text-slate-500"
                  }`}
                />
                <div className="space-y-0.5">
                  <p className="text-xs font-medium">
                    Excluir {kindLabel} e apagar {qCount} questão(ões)
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {isVirtual
                      ? "Este agrupamento é gerado pelas questões sem pasta. Para removê-lo, as questões vinculadas serão excluídas permanentemente."
                      : "Ação irreversível: apaga o caderno, subcasos e todas as questões associadas do banco de dados."}
                  </p>
                </div>
              </button>
            </div>
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed">
              Este {kindLabel} não possui questões vinculadas. Deseja excluí-lo da organização?
            </p>
          )}

          {erro && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle size={14} className="shrink-0" />
              <span>{erro}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-white/[0.07] bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            disabled={excluindo}
            className="px-3.5 py-2 sm:py-1.5 rounded-xl border border-white/[0.09] text-slate-400 hover:text-white text-xs transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={excluindo}
            className="flex items-center gap-1.5 px-4 py-2 sm:py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
          >
            {excluindo ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Excluindo...</span>
              </>
            ) : (
              <>
                <Trash2 size={13} />
                <span>Confirmar Exclusão</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
