"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Loader2,
  FolderTree,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  FileText,
  Tag,
  BookOpen,
  Calendar,
  Award,
  HelpCircle,
  ChevronDown
} from "lucide-react";
import { supabase, supabasePublic } from "../../lib/supabase";
import type { BancoQuestion } from "./QuestionsTable";
import type { OrgNodeDB } from "./CadernosTab";

interface ModalEditarQuestaoProps {
  isOpen: boolean;
  onClose: () => void;
  questao: BancoQuestion | null;
  orgNodes: OrgNodeDB[];
  onSuccess: (updated: BancoQuestion) => void;
}

export function ModalEditarQuestao({
  isOpen,
  onClose,
  questao,
  orgNodes,
  onSuccess,
}: ModalEditarQuestaoProps) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Form states
  const [enunciado, setEnunciado] = useState("");
  const [perguntaProblema, setPerguntaProblema] = useState("");
  const [textoApoio, setTextoApoio] = useState("");
  const [link, setLink] = useState("");
  const [idQconcursos, setIdQconcursos] = useState("");
  const [materia, setMateria] = useState("");
  const [tema, setTema] = useState("");
  const [prova, setProva] = useState("");
  const [ano, setAno] = useState<string>("");
  const [banca, setBanca] = useState("");
  const [dificuldade, setDificuldade] = useState("");
  const [gabarito, setGabarito] = useState("");
  const [altA, setAltA] = useState("");
  const [altB, setAltB] = useState("");
  const [altC, setAltC] = useState("");
  const [altD, setAltD] = useState("");
  const [altE, setAltE] = useState("");
  const [comentario, setComentario] = useState("");
  const [organizacaoId, setOrganizacaoId] = useState("");
  const [showTextoApoio, setShowTextoApoio] = useState(false);

  useEffect(() => {
    if (questao && isOpen) {
      setEnunciado(questao.title || "");
      setPerguntaProblema(questao.perguntaProblema || "");
      setTextoApoio(questao["Texto de apoio"] || "");
      setShowTextoApoio(Boolean(questao["Texto de apoio"]));
      setLink(questao.link || "");
      setIdQconcursos((questao as any).ID_Qconcursos || "");
      setMateria(questao.materia || "");
      setTema(questao.tema || "");
      setProva(questao.prova || "");
      setAno((questao as any).Ano ? String((questao as any).Ano) : "");
      setBanca((questao as any).Banca || (questao as any).banca || "");
      setDificuldade(questao.dificuldade || "");
      setGabarito(questao.Gabarito || questao.respostaCorreta || "");
      setAltA(questao["Alternativa A"] || "");
      setAltB(questao["Alternativa B"] || "");
      setAltC(questao["Alternativa C"] || "");
      setAltD(questao["Alternativa D"] || "");
      setAltE(questao["Alternativa E"] || "");
      setComentario(questao.comentario || (questao as any)["Comentário"] || questao.explicacao || "");
      setOrganizacaoId((questao as any).organizacao_id || "");
      setErro(null);
    }
  }, [questao, isOpen]);

  if (!isOpen || !questao) return null;

  const handleSalvar = async () => {
    setSalvando(true);
    setErro(null);

    try {
      const cleanGabarito = gabarito.trim().toUpperCase();
      if (cleanGabarito && !["A", "B", "C", "D", "E"].includes(cleanGabarito)) {
        throw new Error("Gabarito inválido. Use A, B, C, D ou E.");
      }

      const updatePayload: Record<string, any> = {
        Enunciado: enunciado,
        "Pergunta problema": perguntaProblema,
        "Texto de apoio": textoApoio || null,
        link: link.trim() || null,
        ID_Qconcursos: idQconcursos.trim() || null,
        Materia: materia.trim() || null,
        tema: tema.trim() || null,
        PROVA: prova.trim() || null,
        Ano: ano.trim() ? Number(ano) : null,
        Banca: banca.trim() || null,
        Dificuldade: dificuldade.trim() || null,
        Gabarito: cleanGabarito || null,
        "Alternativa A": altA || null,
        "Alternativa B": altB || null,
        "Alternativa C": altC || null,
        "Alternativa D": altD || null,
        "Alternativa E": altE || null,
        "Comentário": comentario || null,
        organizacao_id: organizacaoId || null,
      };

      // Tenta salvar via supabase com sessão, fallback supabasePublic
      let updateRes = await supabase
        .from("questoes")
        .update(updatePayload)
        .eq("id", questao.id);

      if (updateRes.error) {
        updateRes = await supabasePublic
          .from("questoes")
          .update(updatePayload)
          .eq("id", questao.id);
      }

      if (updateRes.error) {
        throw new Error(updateRes.error.message);
      }

      const updatedObj: BancoQuestion = {
        ...questao,
        title: enunciado,
        perguntaProblema: perguntaProblema || undefined,
        "Texto de apoio": textoApoio || undefined,
        link: link.trim() || undefined,
        ID_Qconcursos: idQconcursos.trim() || undefined,
        materia: materia.trim() || questao.materia,
        tema: tema.trim() || undefined,
        prova: prova.trim() || undefined,
        Ano: ano.trim() ? Number(ano) : undefined,
        dificuldade: dificuldade.trim() || undefined,
        Gabarito: cleanGabarito || undefined,
        respostaCorreta: cleanGabarito || undefined,
        "Alternativa A": altA || undefined,
        "Alternativa B": altB || undefined,
        "Alternativa C": altC || undefined,
        "Alternativa D": altD || undefined,
        "Alternativa E": altE || undefined,
        comentario: comentario || undefined,
        "Comentário": comentario || undefined,
        organizacao_id: organizacaoId || undefined,
      };

      onSuccess(updatedObj);
      onClose();
    } catch (err: any) {
      console.error("Erro ao salvar questão:", err);
      setErro(err.message || "Erro desconhecido ao salvar.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#0d1220] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200 truncate">
              Editar Questão #{questao.id}
            </h3>
            {idQconcursos && (
              <span className="text-[10px] font-mono font-medium text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                {idQconcursos}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          
          {erro && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle size={15} className="shrink-0" />
              <span>{erro}</span>
            </div>
          )}

          {/* Seção 1: Pasta / Hierarquia de Organização */}
          <div className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
              <FolderTree size={12} className="text-indigo-400" />
              Caso / Pasta de Destino (organizacao_nos)
            </label>
            <select
              value={organizacaoId}
              onChange={(e) => setOrganizacaoId(e.target.value)}
              className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">— Sem pasta associada (Geral) —</option>
              {orgNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.nome} {node.tipo ? `(${node.tipo})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Seção 2: Metadados Básicos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10.5px] font-medium text-slate-400 block mb-1">Matéria</label>
              <input
                type="text"
                value={materia}
                onChange={(e) => setMateria(e.target.value)}
                placeholder="Ex: Conhecimentos Bancários"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-medium text-slate-400 block mb-1">Tópico / Caderno</label>
              <input
                type="text"
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                placeholder="Ex: Sistema Financeiro Nacional"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-medium text-slate-400 block mb-1">Dificuldade</label>
              <select
                value={dificuldade}
                onChange={(e) => setDificuldade(e.target.value)}
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="">— Nenhuma —</option>
                <option value="Fácil">Fácil</option>
                <option value="Média">Média</option>
                <option value="Difícil">Difícil</option>
              </select>
            </div>
          </div>

          {/* Seção 3: Link & ID_Qconcursos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="text-[10.5px] font-medium text-slate-400 block mb-1">
                Link da Questão (URL completa)
              </label>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://www.qconcursos.com/..."
                  className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-2.5 text-slate-500 hover:text-indigo-400 transition-colors"
                    title="Testar link"
                  >
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
            <div>
              <label className="text-[10.5px] font-medium text-slate-400 block mb-1">ID Qconcursos</label>
              <input
                type="text"
                value={idQconcursos}
                onChange={(e) => setIdQconcursos(e.target.value)}
                placeholder="Ex: Q2408218"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Seção 4: Prova, Ano, Banca */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10.5px] font-medium text-slate-400 block mb-1">Prova</label>
              <input
                type="text"
                value={prova}
                onChange={(e) => setProva(e.target.value)}
                placeholder="Ex: Banco do Brasil"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-medium text-slate-400 block mb-1">Banca</label>
              <input
                type="text"
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="Ex: CESGRANRIO"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-medium text-slate-400 block mb-1">Ano</label>
              <input
                type="number"
                value={ano}
                onChange={(e) => setAno(e.target.value)}
                placeholder="2024"
                className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Seção 5: Texto de Apoio (Opcional / Colapsável) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10.5px] font-medium text-slate-400">Texto de Apoio (Opcional)</label>
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

          {/* Seção 6: Enunciado */}
          <div>
            <label className="text-[10.5px] font-medium text-slate-300 block mb-1">
              Enunciado Principal
            </label>
            <textarea
              value={enunciado}
              onChange={(e) => setEnunciado(e.target.value)}
              rows={4}
              placeholder="Digite o enunciado da questão..."
              className="w-full bg-[#111623] border border-white/[0.08] rounded-lg p-2.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Seção 7: Pergunta problema */}
          <div>
            <label className="text-[10.5px] font-medium text-indigo-300/90 block mb-1">
              Pergunta Problema (Comando direto da questão)
            </label>
            <textarea
              value={perguntaProblema}
              onChange={(e) => setPerguntaProblema(e.target.value)}
              rows={2}
              placeholder="Ex: Fazem parte do subsistema normativo e operacional, respectivamente:"
              className="w-full bg-[#111623] border border-indigo-500/30 rounded-lg p-2.5 text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Seção 8: Alternativas e Gabarito */}
          <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.015] border border-white/[0.04]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-slate-300">Alternativas</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-medium">Gabarito:</span>
                <select
                  value={gabarito}
                  onChange={(e) => setGabarito(e.target.value)}
                  className="bg-[#111623] border border-emerald-500/40 text-emerald-300 rounded px-2 py-0.5 text-xs font-bold focus:outline-none"
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
                    className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
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
                      isCorreta ? "border-emerald-500/30" : "border-white/[0.06] focus:border-indigo-500"
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Seção 9: Comentário / Resolução */}
          <div>
            <label className="text-[10.5px] font-medium text-slate-400 block mb-1">
              Comentário do Professor / Gabarito Comentado
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
        <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.06] bg-white/[0.02]">
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
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
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
