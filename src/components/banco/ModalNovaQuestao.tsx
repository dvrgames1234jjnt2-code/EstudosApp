"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  Loader2,
  FolderTree,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { safeInsertQuestao } from "../../lib/questoesMutation";
import type { OrgNodeDB } from "./CadernosTab";

interface ModalNovaQuestaoProps {
  isOpen: boolean;
  onClose: () => void;
  orgNodes: OrgNodeDB[];
  defaultProva?: string;
  defaultBanca?: string;
  defaultDisciplina?: string;
  defaultOrdem?: number;
  onCreated: () => void;
}

export function ModalNovaQuestao({
  isOpen,
  onClose,
  orgNodes,
  defaultProva = "",
  defaultBanca = "",
  defaultDisciplina = "",
  defaultOrdem,
  onCreated,
}: ModalNovaQuestaoProps) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [enunciado, setEnunciado] = useState("");
  const [perguntaProblema, setPerguntaProblema] = useState("");
  const [textoApoio, setTextoApoio] = useState("");
  const [showTextoApoio, setShowTextoApoio] = useState(false);
  const [link, setLink] = useState("");
  const [idq, setIdq] = useState("");
  const [idg, setIdg] = useState("");
  const [idtec, setIdtec] = useState("");
  const [ordem, setOrdem] = useState(defaultOrdem !== undefined ? String(defaultOrdem) : "");
  const [materia, setMateria] = useState(defaultDisciplina);
  const [tema, setTema] = useState("");
  const [prova, setProva] = useState(defaultProva);
  const [ano, setAno] = useState("");
  const [banca, setBanca] = useState(defaultBanca);
  const [dificuldade, setDificuldade] = useState("");
  const [status, setStatus] = useState("Ativa");
  const [gabarito, setGabarito] = useState("");
  const [altA, setAltA] = useState("");
  const [altB, setAltB] = useState("");
  const [altC, setAltC] = useState("");
  const [altD, setAltD] = useState("");
  const [altE, setAltE] = useState("");
  const [comentario, setComentario] = useState("");
  const [organizacaoId, setOrganizacaoId] = useState("");

  if (!isOpen) return null;

  const handleCriar = async () => {
    setSalvando(true);
    setErro(null);

    try {
      const cleanGabarito = gabarito.trim().toUpperCase();
      if (cleanGabarito && !["A", "B", "C", "D", "E"].includes(cleanGabarito)) {
        throw new Error("Gabarito inválido. Use A, B, C, D ou E.");
      }

      if (!enunciado.trim() && !perguntaProblema.trim()) {
        throw new Error("Informe pelo menos o Enunciado ou a Pergunta Problema.");
      }

      const parsedOrdem =
        ordem.trim() !== "" && !Number.isNaN(Number(ordem.trim()))
          ? Number(ordem.trim())
          : null;
      const cleanIdq = idq.trim() || null;
      const cleanIdg = idg.trim() || null;
      const cleanIdtec = idtec.trim() || null;
      const cleanAno = ano.trim() || null;
      const cleanMateria = materia.trim() || "Geral";

      const insertPayload: Record<string, string | number | null> = {
        Enunciado: enunciado.trim() || null,
        "Pergunta problema": perguntaProblema.trim() || null,
        "Texto de apoio": textoApoio.trim() || null,
        link: link.trim() || null,
        ID_Qconcursos: cleanIdq,
        Idq: cleanIdq,
        Idg: cleanIdg,
        Idtec: cleanIdtec,
        Ordem: parsedOrdem,
        Materia: cleanMateria,
        Disciplina: cleanMateria,
        tema: tema.trim() || null,
        PROVA: prova.trim() || null,
        Ano: cleanAno,
        Banca: banca.trim() || null,
        Dificuldade: dificuldade.trim() || null,
        Status: status.trim() || "Ativa",
        Gabarito: cleanGabarito || null,
        "Alternativa A": altA.trim() || null,
        "Alternativa B": altB.trim() || null,
        "Alternativa C": altC.trim() || null,
        "Alternativa D": altD.trim() || null,
        "Alternativa E": altE.trim() || null,
        "Comentário": comentario.trim() || null,
        organizacao_id: organizacaoId || null,
      };

      const insertErr = await safeInsertQuestao(insertPayload);
      if (insertErr) {
        throw new Error(insertErr);
      }

      onCreated();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar questão.";
      setErro(message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[105] flex items-center justify-center p-2.5 sm:p-5 bg-black/80">
      <div className="relative w-full max-w-3xl max-h-[94vh] flex flex-col bg-[#0d1220] border border-white/[0.08] rounded-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
          <h3 className="text-sm font-normal text-slate-100">Nova Questão</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-5 space-y-4">
          {erro && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle size={15} className="shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Pasta / Hierarquia de Organização */}
          <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <label className="text-[11px] font-normal text-slate-300 flex items-center gap-1.5">
              <FolderTree size={12} className="text-blue-400" />
              Caso / Pasta de Destino (organizacao_nos)
            </label>
            <select
              value={organizacaoId}
              onChange={(e) => setOrganizacaoId(e.target.value)}
              className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="">— Sem pasta associada (Geral) —</option>
              {orgNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.nome} {node.tipo ? `(${node.tipo})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Disciplina, Ordem, Dificuldade, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Disciplina / Matéria
              </label>
              <input
                type="text"
                value={materia}
                onChange={(e) => setMateria(e.target.value)}
                placeholder="Ex: Conhecimentos Bancários"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">Ordem</label>
              <input
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
                placeholder="Ex: 1"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 tabular-nums focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Dificuldade
              </label>
              <select
                value={dificuldade}
                onChange={(e) => setDificuldade(e.target.value)}
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="">— Nenhuma —</option>
                <option value="Fácil">Fácil</option>
                <option value="Média">Média</option>
                <option value="Difícil">Difícil</option>
                <option value="Ultrahard">Ultrahard</option>
                <option value="Atenção">Atenção</option>
                <option value="Lacuna">Lacuna</option>
                <option value="Bônus">Bônus</option>
              </select>
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="Ativa">Ativa</option>
                <option value="Arquivada">Arquivada</option>
                <option value="Anulada">Anulada</option>
                <option value="Inativa">Inativa</option>
              </select>
            </div>
          </div>

          {/* IDs por Plataforma */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10.5px] font-normal text-amber-300/90 block mb-1">
                Idq (Qconcursos)
              </label>
              <input
                type="text"
                value={idq}
                onChange={(e) => setIdq(e.target.value)}
                placeholder="Ex: Q2408218"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-500/50"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-cyan-300/90 block mb-1">
                Idg (Gran)
              </label>
              <input
                type="text"
                value={idg}
                onChange={(e) => setIdg(e.target.value)}
                placeholder="Ex: G123456"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-violet-300/90 block mb-1">
                Idtec (TEC)
              </label>
              <input
                type="text"
                value={idtec}
                onChange={(e) => setIdtec(e.target.value)}
                placeholder="Ex: 2345678"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          {/* Prova, Banca, Ano */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Prova / Simulado
              </label>
              <input
                type="text"
                value={prova}
                onChange={(e) => setProva(e.target.value)}
                placeholder="Ex: BB 2023 Prova A"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">Banca</label>
              <input
                type="text"
                list="nova-questao-bancas"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="Ex: CESGRANRIO, FGV..."
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
              <datalist id="nova-questao-bancas">
                <option value="CESGRANRIO" />
                <option value="FGV" />
                <option value="CEBRASPE" />
                <option value="FCC" />
                <option value="VUNESP" />
                <option value="CLAUDE" />
                <option value="GPT" />
                <option value="GEMINI FLASH" />
              </datalist>
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Ano / Data
              </label>
              <input
                type="text"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                placeholder="Ex: 2024"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Tópico / Subtema
              </label>
              <input
                type="text"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex: Sistema Financeiro Nacional"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Link da Questão
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2.5 text-slate-500 hover:text-blue-400 transition-colors"
                    title="Abrir link"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Texto de Apoio */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-normal text-slate-400">
                Texto de Apoio (Opcional)
              </label>
              <button
                type="button"
                onClick={() => setShowTextoApoio((p) => !p)}
                className="text-[10px] text-blue-400 hover:text-blue-300"
              >
                {showTextoApoio ? "Ocultar" : "Exibir campo"}
              </button>
            </div>
            {showTextoApoio && (
              <textarea
                value={textoApoio}
                onChange={(e) => setTextoApoio(e.target.value)}
                rows={3}
                placeholder="Cole o texto de apoio da prova aqui..."
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
              />
            )}
          </div>

          {/* Enunciado */}
          <div>
            <label className="text-[10.5px] font-normal text-slate-300 block mb-1">
              Enunciado / Contexto
            </label>
            <textarea
              value={enunciado}
              onChange={(e) => setEnunciado(e.target.value)}
              rows={3}
              placeholder="Digite o contexto/enunciado da questão..."
              className="w-full bg-[#111623] border border-white/[0.08] rounded-lg p-2.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Pergunta problema */}
          <div>
            <label className="text-[10.5px] font-normal text-blue-300/90 block mb-1">
              Pergunta Problema (Opcional)
            </label>
            <textarea
              value={perguntaProblema}
              onChange={(e) => setPerguntaProblema(e.target.value)}
              rows={2}
              placeholder="Ex: Assinale a alternativa correta:"
              className="w-full bg-[#111623] border border-blue-500/30 rounded-lg p-2.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Alternativas e Gabarito */}
          <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.015] border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-normal text-slate-300">Alternativas</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-normal">Gabarito:</span>
                <select
                  value={gabarito}
                  onChange={(e) => setGabarito(e.target.value)}
                  className="bg-[#111623] border border-emerald-500/40 text-emerald-300 rounded px-2 py-0.5 text-xs font-normal focus:outline-none"
                >
                  <option value="">—</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </select>
              </div>
            </div>

            {[
              { letra: "A", val: altA, set: setAltA },
              { letra: "B", val: altB, set: setAltB },
              { letra: "C", val: altC, set: setAltC },
              { letra: "D", val: altD, set: setAltD },
              { letra: "E", val: altE, set: setAltE },
            ].map(({ letra, val, set }) => {
              const isCorreta = gabarito.toUpperCase() === letra;
              return (
                <div key={letra} className="flex items-center gap-2">
                  <span
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-normal shrink-0 transition-colors ${
                      isCorreta
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-white/[0.04] text-slate-400 border border-white/[0.08]"
                    }`}
                  >
                    {letra}
                  </span>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => set(e.target.value)}
                    placeholder={`Alternativa ${letra}...`}
                    className={`flex-1 bg-[#111623] border rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none transition-colors ${
                      isCorreta
                        ? "border-emerald-500/30"
                        : "border-white/[0.06] focus:border-blue-500"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Comentário */}
          <div>
            <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
              Comentário / Resolução
            </label>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={3}
              placeholder="Explicação detalhada da questão..."
              className="w-full bg-[#111623] border border-white/[0.08] rounded-lg p-2.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-white/[0.06] bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="px-3.5 py-1.5 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.05] text-xs transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleCriar}
            disabled={salvando}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-normal transition-colors disabled:opacity-50"
          >
            {salvando ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Criando...</span>
              </>
            ) : (
              <>
                <Plus size={13} />
                <span>Criar Questão</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
