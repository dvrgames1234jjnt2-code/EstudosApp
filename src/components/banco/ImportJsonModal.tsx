"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  FileJson,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Copy,
  Check,
  FileText
} from "lucide-react";
import { supabasePublic } from "@/lib/supabase";

interface ImportJsonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportJsonModal({ isOpen, onClose, onSuccess }: ImportJsonModalProps) {
  const [jsonText, setJsonText] = useState("");
  const [overrideProva, setOverrideProva] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Exemplo de Prompt para a IA gerar no formato correto
  const samplePrompt = `Gere uma lista de questões no formato JSON rigoroso.
Cada objeto deve conter a seguinte estrutura:

[
  {
    "PROVA": "Nome da Prova ou Simulado",
    "Ordem": 1,
    "Banca": "Nome da Banca",
    "Disciplina": "Nome da Disciplina",
    "Materia": "Nome da Matéria",
    "Tópico": "Nome do Tópico",
    "Assunto": "Nome do Assunto",
    "Dificuldade": "Média",
    "Status": "Ativa",
    "Texto de apoio": "Texto longo de apoio ou leitura se houver (opcional)",
    "Enunciado": "O texto que apresenta o contexto da questão...",
    "Pergunta problema": "O que de fato a questão pede para responder",
    "Imagem_Enunciado": "",
    "Alternativa A": "Texto da alternativa A",
    "Alternativa B": "Texto da alternativa B",
    "Alternativa C": "Texto da alternativa C",
    "Alternativa D": "Texto da alternativa D",
    "Alternativa E": "Texto da alternativa E",
    "Gabarito": "A",
    "Comentário": "Explicação detalhada da resolução"
  }
]`;

  const copyPrompt = () => {
    navigator.clipboard.writeText(samplePrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleTextChange = (val: string) => {
    setJsonText(val);
    setErrorMsg("");
    setSuccessCount(null);

    if (!val.trim()) {
      setParsedQuestions([]);
      return;
    }

    try {
      const data = JSON.parse(val);
      const list = Array.isArray(data) ? data : [data];
      
      const normalized = list.map((item, index) => {
        return {
          PROVA: item.PROVA || item.prova || "Simulado Importado",
          Ordem: Number(item.Ordem || item.ordem || index + 1),
          Banca: item.Banca || item.banca || "Geral",
          Disciplina: item.Disciplina || item.disciplina || item.Materia || item.materia || "Geral",
          Materia: item.Materia || item.materia || item.Disciplina || item.disciplina || "Geral",
          Tópico: item.Tópico || item.topico || item.Topico || item.Assunto || item.assunto || "Geral",
          Assunto: item.Assunto || item.assunto || item.Tópico || item.topico || "Geral",
          Dificuldade: item.Dificuldade || item.dificuldade || "Média",
          Status: item.Status || item.status || "Ativa",
          "Texto de apoio": item["Texto de apoio"] || item.texto_apoio || item.TextoDeApoio || null,
          Enunciado: item.Enunciado || item.enunciado || item.texto || "",
          "Pergunta problema": item["Pergunta problema"] || item.pergunta_problema || item.PerguntaProblema || item.Pergunta || item.pergunta || "",
          Imagem_Enunciado: item.Imagem_Enunciado || item.imagem_enunciado || null,
          "Alternativa A": item["Alternativa A"] || item.alternativa_a || item.AlternativaA || "",
          "Alternativa B": item["Alternativa B"] || item.alternativa_b || item.AlternativaB || "",
          "Alternativa C": item["Alternativa C"] || item.alternativa_c || item.AlternativaC || "",
          "Alternativa D": item["Alternativa D"] || item.alternativa_d || item.AlternativaD || "",
          "Alternativa E": item["Alternativa E"] || item.alternativa_e || item.AlternativaE || "",
          Gabarito: (item.Gabarito || item.gabarito || item.respostaCorreta || "A").toUpperCase().trim(),
          Comentário: item.Comentário || item.comentario || item.explicacao || null,
        };
      });

      setParsedQuestions(normalized);
    } catch (err: any) {
      setErrorMsg("JSON inválido: " + err.message);
      setParsedQuestions([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        handleTextChange(content);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedQuestions.length === 0) return;
    setIsImporting(true);
    setErrorMsg("");
    setProgress({ current: 0, total: parsedQuestions.length });

    try {
      // 1. Obter maior ID atual da tabela no Supabase para garantir sequencialidade do bigint
      const { data: maxData, error: maxError } = await supabasePublic
        .from("questoes")
        .select("id")
        .order("id", { ascending: false })
        .limit(1);

      if (maxError) {
        console.warn("Aviso ao buscar MAX(id):", maxError.message);
      }

      let currentMaxId = 0;
      if (maxData && maxData.length > 0 && maxData[0].id) {
        currentMaxId = Number(maxData[0].id);
      }

      // 2. Preparar objetos a inserir com IDs sequenciais
      const rowsToInsert = parsedQuestions.map((q, idx) => {
        const nextId = currentMaxId + idx + 1;
        const row = {
          id: nextId,
          PROVA: overrideProva.trim() || q.PROVA,
          Ordem: q.Ordem,
          Banca: q.Banca,
          Disciplina: q.Disciplina,
          Materia: q.Materia,
          Tópico: q.Tópico,
          Assunto: q.Assunto,
          Dificuldade: q.Dificuldade,
          Status: q.Status,
          "Texto de apoio": q["Texto de apoio"],
          Enunciado: q.Enunciado,
          "Pergunta problema": q["Pergunta problema"],
          Imagem_Enunciado: q.Imagem_Enunciado,
          "Alternativa A": q["Alternativa A"],
          "Alternativa B": q["Alternativa B"],
          "Alternativa C": q["Alternativa C"],
          "Alternativa D": q["Alternativa D"],
          "Alternativa E": q["Alternativa E"],
          Gabarito: q.Gabarito,
          Comentário: q.Comentário,
        };
        return row;
      });

      // 3. Inserção em lotes (chunks) de 20 para evitar estouro de payload
      const chunkSize = 20;
      let insertedTotal = 0;

      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        const { error: insertError } = await supabasePublic
          .from("questoes")
          .insert(chunk);

        if (insertError) {
          throw new Error(`Erro ao inserir lote (${i + 1}-${i + chunk.length}): ${insertError.message}`);
        }

        insertedTotal += chunk.length;
        setProgress({ current: insertedTotal, total: rowsToInsert.length });
      }

      setSuccessCount(insertedTotal);
      setJsonText("");
      setParsedQuestions([]);
      onSuccess();
    } catch (e: any) {
      setErrorMsg(e.message || "Erro durante a importação.");
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-4xl bg-[#0F172A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-8"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <FileJson size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Importar Questões via JSON
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    Admin
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Cole o JSON gerado por IA para cadastrar em lote no Banco de Questões
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Top Prompt Copy Banner */}
            <div className="bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/20 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-blue-200">Precisa do modelo de prompt para a IA?</h4>
                  <p className="text-[11px] text-slate-400">
                    Copie a estrutura recomendada com todas as colunas da tabela de questões.
                  </p>
                </div>
              </div>
              <button
                onClick={copyPrompt}
                className="shrink-0 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 rounded-lg text-xs font-bold text-blue-200 flex items-center gap-1.5 transition-all"
              >
                {copiedPrompt ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copiedPrompt ? "Copiado!" : "Copiar Prompt para IA"}
              </button>
            </div>

            {/* Input Options & Override Prova */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Sobrescrever nome da Prova / Simulado (opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Simulado 01 - Matemática Financeira 2026"
                  value={overrideProva}
                  onChange={(e) => setOverrideProva(e.target.value)}
                  className="w-full px-3 py-2 bg-white/[0.04] border border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ou selecione arquivo JSON do computador
                </label>
                <label className="w-full px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-xs text-slate-300 cursor-pointer flex items-center justify-center gap-2 transition-all">
                  <Upload size={14} className="text-blue-400" />
                  <span>Escolher arquivo .json</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* JSON Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Cole o código JSON abaixo:
                </label>
                {parsedQuestions.length > 0 && (
                  <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={12} /> {parsedQuestions.length} {parsedQuestions.length === 1 ? "questão válida" : "questões válidas"}
                  </span>
                )}
              </div>
              <textarea
                rows={8}
                value={jsonText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder='[\n  {\n    "PROVA": "Simulado 01",\n    "Ordem": 1,\n    "Disciplina": "Português",\n    "Materia": "Português",\n    "Enunciado": "...",\n    "Pergunta problema": "...",\n    "Alternativa A": "...",\n    "Alternativa B": "...",\n    "Gabarito": "A"\n  }\n]'
                className="w-full p-3 bg-[#090D16] border border-white/10 rounded-xl text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 custom-scrollbar"
              />
            </div>

            {/* Error feedback */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Success feedback */}
            {successCount !== null && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-3">
                <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
                <div>
                  <p className="font-bold text-sm">Sucesso na importação!</p>
                  <p>{successCount} questões foram inseridas no banco com IDs sequenciais gerados automaticamente.</p>
                </div>
              </div>
            )}

            {/* Preview Section */}
            {parsedQuestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={14} className="text-blue-400" /> Previa do Lote (primeiras questões):
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                  {parsedQuestions.slice(0, 3).map((q, idx) => (
                    <div key={idx} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                        <span className="text-blue-400 font-bold">
                          {overrideProva.trim() || q.PROVA} (Ordem {q.Ordem})
                        </span>
                        <span className="bg-white/5 px-2 py-0.5 rounded text-slate-300">
                          {q.Materia} • {q.Banca}
                        </span>
                      </div>
                      <p className="text-slate-200 font-semibold line-clamp-2">
                        {q.Enunciado || q["Pergunta problema"] || "Sem enunciado"}
                      </p>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-white/5">
                        <span>A: {q["Alternativa A"]?.slice(0, 30)}...</span>
                        <span className="font-bold text-emerald-400">Gabarito: {q.Gabarito}</span>
                      </div>
                    </div>
                  ))}
                  {parsedQuestions.length > 3 && (
                    <p className="text-[11px] text-slate-500 italic text-center py-1">
                      + mais {parsedQuestions.length - 3} questões na lista...
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
            <div className="text-xs text-slate-400">
              {progress ? (
                <span className="flex items-center gap-2 text-blue-400 font-bold">
                  <Loader2 size={14} className="animate-spin" />
                  Importando {progress.current} de {progress.total}...
                </span>
              ) : (
                <span>{parsedQuestions.length} questões prontas para importar</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                disabled={isImporting}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={parsedQuestions.length === 0 || isImporting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Upload size={14} />
                )}
                Confirmar Importação ({parsedQuestions.length})
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
