'use client';

import React, { useState } from 'react';
import { Printer, X, FileText, CheckCircle, Eye, EyeOff, LayoutGrid } from 'lucide-react';
import { BancoQuestion } from './QuestionsTable';

interface PrintSimuladoModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: BancoQuestion[];
  title?: string;
  subTitle?: string;
}

// ── Formatador simples de Matemática & Texto para Impressão ─────────────────
function cleanPrintText(text: string): string {
  if (!text) return "";
  let str = text.replace(/\\n/g, '\n');
  str = str.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  str = str.replace(/\$([\s\S]*?)\$/g, '$1');
  str = str.replace(/\\frac\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/g, '($1 / $2)');
  str = str.replace(/\\sqrt\[(.*?)\]\s*\{([\s\S]*?)\}/g, '$1√($2)');
  str = str.replace(/\\sqrt\s*\{([\s\S]*?)\}/g, '√($1)');
  str = str.replace(/\\cdotp|\\cdot|\\times/g, '·');
  str = str.replace(/\\div/g, '÷');
  str = str.replace(/\\pm/g, '±');
  str = str.replace(/\\approx/g, '≈');
  str = str.replace(/\\neq/g, '≠');
  str = str.replace(/\\leq|\\le/g, '≤');
  str = str.replace(/\\geq|\\ge/g, '≥');
  str = str.replace(/\\infty/g, '∞');
  str = str.replace(/\\pi/g, 'π');
  str = str.replace(/\^2\b/g, '²');
  str = str.replace(/\^3\b/g, '³');
  str = str.replace(/\^n\b/g, 'ⁿ');
  const subs: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'n': 'ₙ' };
  str = str.replace(/_([0-9n])/g, (_, match) => subs[match] || `_${match}`);
  str = str.replace(/\\text\{([\s\S]*?)\}/g, '$1');
  return str;
}

export function PrintSimuladoModal({
  isOpen,
  onClose,
  questions,
  title = "SIMULADO DE QUESTÕES",
  subTitle = "Estação de Treinamento — EstudosApp",
}: PrintSimuladoModalProps) {
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includeComments, setIncludeComments] = useState(false);
  const [layoutColumns, setLayoutColumns] = useState<'1' | '2'>('1');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950/90 backdrop-blur-md overflow-hidden text-slate-900">
      
      {/* ── Topbar de Controles (Escondido na Impressão) ── */}
      <div className="print:hidden bg-[#0f172a] border-b border-slate-800 p-4 flex items-center justify-between gap-4 shrink-0 shadow-2xl text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <Printer size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider">Imprimir Simulado / Gerar PDF</h2>
            <p className="text-[10px] text-slate-400 font-medium">
              {questions.length} {questions.length === 1 ? 'questão selecionada' : 'questões selecionadas'}
            </p>
          </div>
        </div>

        {/* Opções de Impressão */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Alternar Gabarito */}
          <button
            onClick={() => setIncludeAnswers(!includeAnswers)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              includeAnswers
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            <CheckCircle size={14} />
            {includeAnswers ? 'Gabarito Incluído' : 'Sem Gabarito'}
          </button>

          {/* Alternar Comentários */}
          <button
            onClick={() => setIncludeComments(!includeComments)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              includeComments
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {includeComments ? <Eye size={14} /> : <EyeOff size={14} />}
            {includeComments ? 'Comentários Ativos' : 'Sem Comentários'}
          </button>

          {/* Botão Imprimir */}
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 active:scale-95 uppercase tracking-wider"
          >
            <Printer size={15} /> Imprimir / PDF
          </button>

          {/* Fechar */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Documento Impresso / Visualização ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-900 print:bg-white print:p-0 print:overflow-visible">
        <div id="printable-simulado" className="max-w-4xl mx-auto bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-2xl print:shadow-none print:p-0 print:rounded-none print:max-w-none font-serif text-sm leading-relaxed">
          
          {/* Cabeçalho da Prova */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-bold uppercase tracking-wide font-sans">{title}</h1>
              <span className="text-xs font-mono font-bold border border-slate-900 px-2 py-0.5 rounded">
                TOTAL: {questions.length} QUESTÕES
              </span>
            </div>
            <p className="text-xs text-slate-600 font-sans mb-4">{subTitle}</p>
            
            {/* Campo para dados do Aluno */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-300 font-sans text-xs">
              <div><strong>Nome:</strong> ____________________________</div>
              <div><strong>Data:</strong> ____/____/________</div>
              <div><strong>Nota / Acertos:</strong> ________ / {questions.length}</div>
            </div>
          </div>

          {/* Lista de Questões */}
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const alternativas: Record<string, string | undefined> = {
                A: q["Alternativa A"],
                B: q["Alternativa B"],
                C: q["Alternativa C"],
                D: q["Alternativa D"],
                E: q["Alternativa E"],
              };
              const hasAlternativas = LETTERS.some(l => alternativas[l]);
              const gabarito = q.respostaCorreta || q.Gabarito;

              return (
                <div key={q.id || idx} className="break-inside-avoid pb-6 border-b border-slate-200 last:border-0">
                  
                  {/* Número & Matéria/Simulado */}
                  <div className="flex items-baseline justify-between mb-2 font-sans">
                    <span className="font-bold text-base text-slate-900">
                      Questão {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      {q.materia} {q.prova ? `• ${q.prova}` : ''}
                    </span>
                  </div>

                  {/* Texto de apoio */}
                  {q["Texto de apoio"] && (
                    <div className="mb-3 p-3 bg-slate-50 border-l-4 border-slate-400 text-xs italic text-slate-700 font-sans">
                      <strong className="block text-[10px] uppercase font-bold text-slate-500 not-italic mb-1">Texto de apoio:</strong>
                      {cleanPrintText(q["Texto de apoio"])}
                    </div>
                  )}

                  {/* Enunciado */}
                  <div className="text-slate-900 mb-3 font-medium whitespace-pre-line">
                    {cleanPrintText(q.title)}
                  </div>

                  {/* Pergunta problema */}
                  {q.perguntaProblema && (
                    <div className="text-slate-900 font-bold mb-3">
                      {cleanPrintText(q.perguntaProblema)}
                    </div>
                  )}

                  {/* Alternativas */}
                  {hasAlternativas && (
                    <div className="space-y-2 my-3 font-sans text-xs pl-2">
                      {LETTERS.filter(l => alternativas[l]).map(letter => (
                        <div key={letter} className="flex items-start gap-2.5">
                          <span className="shrink-0 font-bold border border-slate-700 rounded-full w-5 h-5 flex items-center justify-center text-[11px]">
                            {letter}
                          </span>
                          <span className="pt-0.5 text-slate-800">
                            {cleanPrintText(alternativas[letter] || '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Comentário (opcional) */}
                  {includeComments && (q.explicacao || q.comentario) && (
                    <div className="mt-3 p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs font-sans text-slate-700">
                      <strong className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Comentário / Explicação:</strong>
                      {cleanPrintText(q.explicacao || q.comentario || '')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Gabarito & Folha de Respostas no Final ── */}
          {includeAnswers && (
            <div className="mt-10 pt-6 border-t-2 border-slate-900 break-before-page font-sans">
              <h2 className="text-base font-bold uppercase tracking-wider mb-2">FOLHA DE GABARITO / RESPOSTAS</h2>
              <p className="text-xs text-slate-600 mb-4">Gabarito oficial correspondente às questões deste simulado:</p>

              {/* Grid de Respostas */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 text-center text-xs">
                {questions.map((q, idx) => (
                  <div key={q.id || idx} className="border border-slate-400 p-2 rounded bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-500">Q.{String(idx + 1).padStart(2, '0')}</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {q.respostaCorreta || q.Gabarito || '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Estilo CSS para Impressão ── */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          /* Esconde tudo exceto o simulado montado */
          body > *:not(#__next) {
            display: none !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          #printable-simulado {
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}
