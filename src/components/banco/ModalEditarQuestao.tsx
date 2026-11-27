"use client";

import React, { useMemo, useState } from "react";
import {
  X,
  Save,
  Loader2,
  FolderTree,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import {
  safeUpdateQuestoesByIds,
  type QuestaoWritePayload,
} from "../../lib/questoesMutation";
import {
  getQuestionIds,
  normalizeDifficultyLabel,
} from "../../lib/questionService";
import type { BancoQuestion } from "./QuestionsTable";
import type { OrgNodeDB } from "./CadernosTab";

interface ModalEditarQuestaoProps {
  isOpen: boolean;
  onClose: () => void;
  questao: BancoQuestion | null;
  orgNodes: OrgNodeDB[];
  onSuccess: (updated: BancoQuestion) => void;
}

function buildOrgNodeOptions(orgNodes: OrgNodeDB[]) {
  const byId = new Map<string, OrgNodeDB>();
  for (const node of orgNodes) {
    byId.set(node.id, node);
  }

  return orgNodes
    .map((node) => {
      const parts: string[] = [node.nome];
      let currParent = node.parent_id;
      let guard = 0;
      while (currParent && byId.has(currParent) && guard < 8) {
        const parent = byId.get(currParent)!;
        parts.unshift(parent.nome);
        currParent = parent.parent_id;
        guard += 1;
      }
      const pathLabel = parts.join(" / ");
      return {
        id: node.id,
        label: node.tipo ? `${pathLabel} (${node.tipo})` : pathLabel,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

function ModalEditarQuestaoInner({
  onClose,
  questao,
  orgNodes,
  onSuccess,
}: {
  onClose: () => void;
  questao: BancoQuestion;
  orgNodes: OrgNodeDB[];
  onSuccess: (updated: BancoQuestion) => void;
}) {
  const initialIds = getQuestionIds(questao);
  const initialOrdem = questao.Ordem ?? questao.ordem;

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [enunciado, setEnunciado] = useState(questao.title || "");
  const [perguntaProblema, setPerguntaProblema] = useState(
    questao.perguntaProblema || ""
  );
  const [textoApoio, setTextoApoio] = useState(questao["Texto de apoio"] || "");
  const [showTextoApoio, setShowTextoApoio] = useState(
    Boolean(questao["Texto de apoio"])
  );
  const [imagemEnunciado, setImagemEnunciado] = useState(
    questao.imagemEnunciado || ""
  );
  const [link, setLink] = useState(questao.link || "");
  const [idq, setIdq] = useState(initialIds.idq);
  const [idg, setIdg] = useState(initialIds.idg);
  const [idtec, setIdtec] = useState(initialIds.idtec);
  const [ordem, setOrdem] = useState(
    initialOrdem !== undefined && initialOrdem !== null ? String(initialOrdem) : ""
  );
  const [materia, setMateria] = useState(
    questao.Disciplina || questao.materia || ""
  );
  const [prova, setProva] = useState(questao.prova || "");
  const [ano, setAno] = useState(
    questao.Ano !== undefined && questao.Ano !== null ? String(questao.Ano) : ""
  );
  const [banca, setBanca] = useState(questao.Banca || questao.banca || "");
  const [dificuldade, setDificuldade] = useState(
    normalizeDifficultyLabel(questao.dificuldade) || ""
  );
  const [status, setStatus] = useState(questao.status || "Ativa");
  const [gabarito, setGabarito] = useState(
    questao.Gabarito || questao.respostaCorreta || ""
  );
  const [altA, setAltA] = useState(questao["Alternativa A"] || "");
  const [altB, setAltB] = useState(questao["Alternativa B"] || "");
  const [altC, setAltC] = useState(questao["Alternativa C"] || "");
  const [altD, setAltD] = useState(questao["Alternativa D"] || "");
  const [altE, setAltE] = useState(questao["Alternativa E"] || "");
  const [comentario, setComentario] = useState(
    questao.comentario || questao["Comentário"] || questao.explicacao || ""
  );
  const [organizacaoId, setOrganizacaoId] = useState(
    questao.organizacao_id || ""
  );

  const orgOptions = useMemo(() => buildOrgNodeOptions(orgNodes), [orgNodes]);

  const handleSalvar = async () => {
    setSalvando(true);
    setErro(null);

    try {
      const cleanGabarito = gabarito.trim().toUpperCase();
      if (cleanGabarito && !["A", "B", "C", "D", "E"].includes(cleanGabarito)) {
        throw new Error("Gabarito inválido. Use A, B, C, D ou E.");
      }

      const trimmedOrdem = ordem.trim();
      if (trimmedOrdem !== "" && Number.isNaN(Number(trimmedOrdem))) {
        throw new Error("Ordem deve ser um número válido.");
      }
      const parsedOrdem = trimmedOrdem !== "" ? Number(trimmedOrdem) : null;

      const cleanIdq = idq.trim() || null;
      const cleanIdg = idg.trim() || null;
      const cleanIdtec = idtec.trim() || null;
      const cleanAno = ano.trim() || null;
      const cleanMateria = materia.trim() || null;
      const cleanBanca = banca.trim() || null;
      const cleanProva = prova.trim() || null;
      const cleanStatus = status.trim() || "Ativa";
      const cleanImg = imagemEnunciado.trim() || null;

      const updatePayload: QuestaoWritePayload = {
        Enunciado: enunciado,
        "Pergunta problema": perguntaProblema.trim() || null,
        "Texto de apoio": textoApoio.trim() || null,
        Imagem_Enunciado: cleanImg,
        link: link.trim() || null,
        ID_Qconcursos: cleanIdq,
        Idq: cleanIdq,
        Idg: cleanIdg,
        Idtec: cleanIdtec,
        Ordem: parsedOrdem,
        Materia: cleanMateria,
        Disciplina: cleanMateria,
        PROVA: cleanProva,
        Ano: cleanAno,
        Banca: cleanBanca,
        banca: cleanBanca,
        Dificuldade: dificuldade.trim() || null,
        Status: cleanStatus,
        Gabarito: cleanGabarito || null,
        "Alternativa A": altA || null,
        "Alternativa B": altB || null,
        "Alternativa C": altC || null,
        "Alternativa D": altD || null,
        "Alternativa E": altE || null,
        "Comentário": comentario || null,
        organizacao_id: organizacaoId || null,
      };

      const updateError = await safeUpdateQuestoesByIds(
        [questao.id],
        updatePayload
      );
      if (updateError) {
        throw new Error(updateError);
      }

      const updatedObj: BancoQuestion = {
        ...questao,
        title: enunciado,
        perguntaProblema: perguntaProblema.trim() || undefined,
        "Texto de apoio": textoApoio.trim() || undefined,
        imagemEnunciado: cleanImg || undefined,
        link: link.trim() || undefined,
        ID_Qconcursos: cleanIdq || undefined,
        Idq: cleanIdq || undefined,
        idq: cleanIdq || undefined,
        Idg: cleanIdg || undefined,
        idg: cleanIdg || undefined,
        Idtec: cleanIdtec || undefined,
        idtec: cleanIdtec || undefined,
        Ordem: parsedOrdem,
        ordem: parsedOrdem,
        materia: cleanMateria || "Geral",
        disciplina: cleanMateria || "Geral",
        Disciplina: cleanMateria || "Geral",
        prova: cleanProva || undefined,
        Ano: cleanAno || undefined,
        Banca: cleanBanca || undefined,
        banca: cleanBanca || undefined,
        dificuldade: dificuldade.trim() || undefined,
        status: cleanStatus,
        Gabarito: cleanGabarito || undefined,
        respostaCorreta: cleanGabarito || undefined,
        "Alternativa A": altA || undefined,
        "Alternativa B": altB || undefined,
        "Alternativa C": altC || undefined,
        "Alternativa D": altD || undefined,
        "Alternativa E": altE || undefined,
        comentario: comentario || undefined,
        "Comentário": comentario || undefined,
        explicacao: comentario || undefined,
        organizacao_id: organizacaoId || undefined,
      };

      onSuccess(updatedObj);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro desconhecido ao salvar.";
      setErro(message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-5 bg-black/80">
      <div className="relative w-full max-w-3xl max-h-[94vh] flex flex-col bg-[#0d1220] border border-white/[0.08] rounded-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
            <h3 className="text-sm font-normal text-slate-200 truncate">
              Editar Questão #{questao.id}
            </h3>
            {idq && (
              <span className="text-[10px] font-mono font-normal text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                QC: {idq}
              </span>
            )}
            {idg && (
              <span className="text-[10px] font-mono font-normal text-cyan-400/90 bg-cyan-400/10 border border-cyan-400/20 px-2 py-0.5 rounded">
                Gran: {idg}
              </span>
            )}
            {idtec && (
              <span className="text-[10px] font-mono font-normal text-violet-400/90 bg-violet-400/10 border border-violet-400/20 px-2 py-0.5 rounded">
                TEC: {idtec}
              </span>
            )}
          </div>

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
              <FolderTree size={12} className="text-indigo-400" />
              Caso / Pasta de Destino (organizacao_nos)
            </label>
            <select
              value={organizacaoId}
              onChange={(e) => setOrganizacaoId(e.target.value)}
              className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">— Sem pasta associada (Geral) —</option>
              {orgOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
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
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Ordem
              </label>
              <input
                type="number"
                value={ordem}
                onChange={(e) => setOrdem(e.target.value)}
                placeholder="Ex: 1"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 tabular-nums focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Dificuldade
              </label>
              <select
                value={dificuldade}
                onChange={(e) => setDificuldade(e.target.value)}
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="Ativa">Ativa</option>
                <option value="Arquivada">Arquivada</option>
                <option value="Anulada">Anulada</option>
                <option value="Inativa">Inativa</option>
              </select>
            </div>
          </div>

          {/* IDs por Plataforma: Idq, Idg, Idtec */}
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

          {/* Prova, Banca, Ano (Data) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Prova (Órgão abreviado)
              </label>
              <input
                type="text"
                value={prova}
                onChange={(e) => setProva(e.target.value)}
                placeholder="Ex: BB, CEF, BNB..."
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Banca (ou IA)
              </label>
              <input
                type="text"
                list="bancas-sugestoes"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="Ex: CESGRANRIO, CLAUDE, GPT..."
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <datalist id="bancas-sugestoes">
                <option value="CESGRANRIO" />
                <option value="FGV" />
                <option value="CEBRASPE" />
                <option value="FCC" />
                <option value="VUNESP" />
                <option value="CLAUDE" />
                <option value="GPT" />
                <option value="GEMINI FLASH" />
                <option value="MANUS" />
                <option value="HYDROGEN" />
              </datalist>
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Ano / Data Aplicação
              </label>
              <input
                type="text"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                placeholder="Ex: 23/04/2023 ou 2024"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2.5 text-slate-500 hover:text-indigo-400 transition-colors"
                    title="Abrir link"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className="text-[10.5px] font-normal text-slate-400 block mb-1">
                Imagem do Enunciado (URL opcional)
              </label>
              <input
                type="text"
                value={imagemEnunciado}
                onChange={(e) => setImagemEnunciado(e.target.value)}
                placeholder="https://..."
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
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
                onClick={() => setShowTextoApoio(!showTextoApoio)}
                className="text-[10px] text-indigo-400 hover:text-indigo-300"
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
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            )}
          </div>

          {/* Enunciado */}
          <div>
            <label className="text-[10.5px] font-normal text-slate-300 block mb-1">
              Enunciado / Contexto (Opcional)
            </label>
            <textarea
              value={enunciado}
              onChange={(e) => setEnunciado(e.target.value)}
              rows={3}
              placeholder="Digite o contexto/enunciado da questão..."
              className="w-full bg-[#111623] border border-white/[0.08] rounded-lg p-2.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Pergunta problema */}
          <div>
            <label className="text-[10.5px] font-normal text-indigo-300/90 block mb-1">
              Pergunta Problema (O que de fato pergunta)
            </label>
            <textarea
              value={perguntaProblema}
              onChange={(e) => setPerguntaProblema(e.target.value)}
              rows={2}
              placeholder="Ex: Fazem parte do subsistema normativo e operacional, respectivamente:"
              className="w-full bg-[#111623] border border-indigo-500/30 rounded-lg p-2.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Alternativas e Gabarito */}
          <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.015] border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-normal text-slate-300">
                Alternativas
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-normal">
                  Gabarito:
                </span>
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
                        : "border-white/[0.06] focus:border-indigo-500"
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
              className="w-full bg-[#111623] border border-white/[0.08] rounded-lg p-2.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
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
            onClick={() => void handleSalvar()}
            disabled={salvando}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-normal transition-colors disabled:opacity-50"
          >
            {salvando ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <Save size={13} />
                <span>Salvar Alterações</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ModalEditarQuestao({
  isOpen,
  onClose,
  questao,
  orgNodes,
  onSuccess,
}: ModalEditarQuestaoProps) {
  if (!isOpen || !questao) return null;

  return (
    <ModalEditarQuestaoInner
      key={String(questao.id)}
      onClose={onClose}
      questao={questao}
      orgNodes={orgNodes}
      onSuccess={onSuccess}
    />
  );
}
