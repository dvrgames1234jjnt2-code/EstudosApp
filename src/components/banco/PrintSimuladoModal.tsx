'use client';

import React, { useState } from 'react';
import { Printer, X, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { BancoQuestion } from './QuestionsTable';

interface PrintSimuladoModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: BancoQuestion[];
  title?: string;
  subTitle?: string;
}

// ── Formatador de Matemática & Texto para Impressão ─────────────────────────
function cleanPrintText(text: string): string {
  if (!text) return '';
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
  str = str.replace(/\^1\b/g, '¹');
  str = str.replace(/\^0\b/g, '⁰');
  str = str.replace(/\^x\b/g, 'ˣ');
  str = str.replace(/\^\+([0-9]+)/g, '⁺$1');
  str = str.replace(/\^-([0-9]+)/g, '⁻$1');
  str = str.replace(/\^\{([\s\S]*?)\}/g, '⁽$1⁾');
  const subs: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'n': 'ₙ' };
  str = str.replace(/_([0-9n])/g, (_, m) => subs[m] || `_${m}`);
  str = str.replace(/\\text\{([\s\S]*?)\}/g, '$1');
  str = str.replace(/\\mathrm\{([\s\S]*?)\}/g, '$1');
  str = str.replace(/\\mathbf\{([\s\S]*?)\}/g, '$1');
  // Escapa HTML
  str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Preserva quebras de linha
  str = str.replace(/\n/g, '<br>');
  return str;
}

// ── Gera o HTML completo da prova para impressão em nova aba ────────────────
function buildPrintHTML(
  questions: BancoQuestion[],
  title: string,
  subTitle: string,
  includeAnswers: boolean,
  includeComments: boolean,
): string {
  const LETTERS = ['A', 'B', 'C', 'D', 'E'];

  const questionRows = questions.map((q, idx) => {
    const alts = {
      A: q['Alternativa A'],
      B: q['Alternativa B'],
      C: q['Alternativa C'],
      D: q['Alternativa D'],
      E: q['Alternativa E'],
    };
    const hasAlts = Object.values(alts).some(Boolean);
    const gabarito = q.respostaCorreta || q.Gabarito || '';

    const altsHtml = hasAlts
      ? `<div class="alts">${LETTERS.filter(l => alts[l as keyof typeof alts]).map(l => `
          <div class="alt-row">
            <span class="alt-letter">${l}</span>
            <span class="alt-text">${cleanPrintText(alts[l as keyof typeof alts] || '')}</span>
          </div>`).join('')}</div>`
      : '';

    const textoApoioHtml = q['Texto de apoio']
      ? `<div class="apoio"><strong>Texto de apoio:</strong><br>${cleanPrintText(q['Texto de apoio'])}</div>`
      : '';

    const perguntaHtml = q.perguntaProblema
      ? `<div class="pergunta">${cleanPrintText(q.perguntaProblema)}</div>`
      : '';

    const comentarioHtml = includeComments && (q.explicacao || q.comentario)
      ? `<div class="comentario"><strong>Comentário:</strong><br>${cleanPrintText(q.explicacao || q.comentario || '')}</div>`
      : '';

    return `
      <div class="questao">
        <div class="questao-header">
          <span class="questao-num">Questão ${String(idx + 1).padStart(2, '0')}</span>
          <span class="questao-meta">${cleanPrintText(q.materia || '')}${q.prova ? ` • ${cleanPrintText(q.prova)}` : ''}</span>
        </div>
        ${textoApoioHtml}
        <div class="enunciado">${cleanPrintText(q.title)}</div>
        ${perguntaHtml}
        ${altsHtml}
        ${comentarioHtml}
      </div>`;
  }).join('');

  const gabaritoHtml = includeAnswers
    ? `<div class="gabarito-section">
        <h2 class="gabarito-title">FOLHA DE GABARITO / RESPOSTAS</h2>
        <p class="gabarito-sub">Gabarito oficial correspondente às questões deste simulado:</p>
        <div class="gabarito-grid">
          ${questions.map((q, idx) => `
            <div class="gabarito-cell">
              <div class="gabarito-num">Q.${String(idx + 1).padStart(2, '0')}</div>
              <div class="gabarito-resp">${q.respostaCorreta || q.Gabarito || '–'}</div>
            </div>`).join('')}
        </div>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 13px;
      color: #1a1a1a;
      background: white;
      line-height: 1.7;
    }

    .page {
      max-width: 820px;
      margin: 0 auto;
      padding: 40px 50px;
    }

    /* ── Cabeçalho ── */
    .header {
      border-bottom: 2.5px solid #1a1a1a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .header h1 {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 18px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #111;
    }
    .header .badge {
      font-family: monospace;
      font-size: 11px;
      font-weight: bold;
      border: 1.5px solid #333;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .header .subtitle {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #555;
      margin-bottom: 12px;
    }
    .header-fields {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      border-top: 1px solid #ccc;
      padding-top: 12px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 600;
      color: #333;
    }

    /* ── Questões ── */
    .questao {
      margin-bottom: 28px;
      padding-bottom: 24px;
      border-bottom: 1px solid #ddd;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .questao:last-child { border-bottom: none; }

    .questao-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .questao-num {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      font-weight: 900;
      color: #111;
    }
    .questao-meta {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 700;
      color: #666;
    }

    .apoio {
      margin-bottom: 12px;
      padding: 10px 14px;
      background: #f5f5f5;
      border-left: 4px solid #999;
      font-style: italic;
      font-size: 12px;
      color: #555;
      border-radius: 0 4px 4px 0;
    }

    .enunciado {
      color: #111;
      font-weight: 500;
      margin-bottom: 10px;
      line-height: 1.75;
    }

    .pergunta {
      font-weight: 700;
      color: #111;
      margin-bottom: 10px;
    }

    /* ── Alternativas ── */
    .alts {
      margin: 12px 0;
      padding-left: 8px;
    }
    .alt-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 7px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      color: #222;
    }
    .alt-letter {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1.5px solid #444;
      border-radius: 50%;
      font-weight: 900;
      font-size: 11px;
    }
    .alt-text {
      padding-top: 2px;
      line-height: 1.6;
    }

    /* ── Comentário ── */
    .comentario {
      margin-top: 12px;
      padding: 10px 14px;
      background: #f0f0f0;
      border: 1px solid #ccc;
      border-radius: 6px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #444;
    }

    /* ── Gabarito ── */
    .gabarito-section {
      margin-top: 40px;
      padding-top: 24px;
      border-top: 2.5px solid #1a1a1a;
      page-break-before: always;
      break-before: page;
    }
    .gabarito-title {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .gabarito-sub {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      color: #666;
      margin-bottom: 16px;
    }
    .gabarito-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 6px;
    }
    .gabarito-cell {
      border: 1.5px solid #aaa;
      border-radius: 6px;
      padding: 6px 4px;
      text-align: center;
      background: #fafafa;
    }
    .gabarito-num {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9px;
      font-weight: 700;
      color: #777;
    }
    .gabarito-resp {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 14px;
      font-weight: 900;
      color: #111;
      margin-top: 2px;
    }

    /* ── Print Media ── */
    @media print {
      body { background: white !important; }
      .page { padding: 20px 30px; max-width: 100%; }
      .questao { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-top">
        <h1>${title}</h1>
        <span class="badge">TOTAL: ${questions.length} QUESTÕES</span>
      </div>
      <p class="subtitle">${subTitle}</p>
      <div class="header-fields">
        <div><strong>Nome:</strong> ____________________________</div>
        <div><strong>Data:</strong> ____/____/________</div>
        <div><strong>Nota / Acertos:</strong> ________ / ${questions.length}</div>
      </div>
    </div>

    <div class="questoes">
      ${questionRows}
    </div>

    ${gabaritoHtml}
  </div>

  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;
}

export function PrintSimuladoModal({
  isOpen,
  onClose,
  questions,
  title = 'SIMULADO DE QUESTÕES',
  subTitle = 'Estação de Treinamento — EstudosApp',
}: PrintSimuladoModalProps) {
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [includeComments, setIncludeComments] = useState(false);

  if (!isOpen) return null;

  const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

  const handlePrint = () => {
    const html = buildPrintHTML(questions, title, subTitle, includeAnswers, includeComments);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Permita pop-ups para usar a impressão. Verifique o bloqueador de pop-ups do seu navegador.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950/90 backdrop-blur-md overflow-hidden text-slate-900">

      {/* ── Topbar de Controles ── */}
      <div className="bg-[#0f172a] border-b border-slate-800 p-4 flex items-center justify-between gap-4 shrink-0 shadow-2xl text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <Printer size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider">Imprimir Simulado / Gerar PDF</h2>
            <p className="text-[10px] text-slate-400 font-medium">
              {questions.length} {questions.length === 1 ? 'questão selecionada' : 'questões selecionadas'} • Abre em nova aba pronta para imprimir
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Gabarito */}
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

          {/* Comentários */}
          <button
            onClick={() => setIncludeComments(!includeComments)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              includeComments
                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {includeComments ? <Eye size={14} /> : <EyeOff size={14} />}
            {includeComments ? 'Com Comentários' : 'Sem Comentários'}
          </button>

          {/* Botão principal */}
          <button
            onClick={handlePrint}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 active:scale-95 uppercase tracking-wider"
          >
            <Printer size={15} /> Abrir & Imprimir / PDF
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

      {/* ── Preview Visual da Prova ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-900">
        <div className="max-w-4xl mx-auto bg-white text-slate-900 p-8 sm:p-12 rounded-2xl shadow-2xl font-serif text-sm leading-relaxed">

          {/* Cabeçalho */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-xl font-bold uppercase tracking-wide font-sans">{title}</h1>
              <span className="text-xs font-mono font-bold border border-slate-900 px-2 py-0.5 rounded">
                TOTAL: {questions.length} QUESTÕES
              </span>
            </div>
            <p className="text-xs text-slate-600 font-sans mb-4">{subTitle}</p>
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-300 font-sans text-xs">
              <div><strong>Nome:</strong> ____________________________</div>
              <div><strong>Data:</strong> ____/____/________</div>
              <div><strong>Nota / Acertos:</strong> ________ / {questions.length}</div>
            </div>
          </div>

          {/* Questões */}
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const alternativas: Record<string, string | undefined> = {
                A: q['Alternativa A'],
                B: q['Alternativa B'],
                C: q['Alternativa C'],
                D: q['Alternativa D'],
                E: q['Alternativa E'],
              };
              const hasAlternativas = LETTERS.some(l => alternativas[l]);

              return (
                <div key={q.id || idx} className="pb-6 border-b border-slate-200 last:border-0">
                  <div className="flex items-baseline justify-between mb-2 font-sans">
                    <span className="font-bold text-base text-slate-900">
                      Questão {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">
                      {q.materia}{q.prova ? ` • ${q.prova}` : ''}
                    </span>
                  </div>

                  {q['Texto de apoio'] && (
                    <div className="mb-3 p-3 bg-slate-50 border-l-4 border-slate-400 text-xs italic text-slate-700 font-sans">
                      <strong className="block text-[10px] uppercase font-bold text-slate-500 not-italic mb-1">Texto de apoio:</strong>
                      {q['Texto de apoio']}
                    </div>
                  )}

                  <div className="text-slate-900 mb-3 font-medium whitespace-pre-line">{q.title}</div>

                  {q.perguntaProblema && (
                    <div className="text-slate-900 font-bold mb-3">{q.perguntaProblema}</div>
                  )}

                  {hasAlternativas && (
                    <div className="space-y-2 my-3 font-sans text-xs pl-2">
                      {LETTERS.filter(l => alternativas[l]).map(letter => (
                        <div key={letter} className="flex items-start gap-2.5">
                          <span className="shrink-0 font-bold border border-slate-700 rounded-full w-5 h-5 flex items-center justify-center text-[11px]">
                            {letter}
                          </span>
                          <span className="pt-0.5 text-slate-800">{alternativas[letter]}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {includeComments && (q.explicacao || q.comentario) && (
                    <div className="mt-3 p-3 bg-slate-100 border border-slate-300 rounded-lg text-xs font-sans text-slate-700">
                      <strong className="block text-[10px] uppercase font-bold text-slate-600 mb-1">Comentário:</strong>
                      {q.explicacao || q.comentario}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Gabarito */}
          {includeAnswers && (
            <div className="mt-10 pt-6 border-t-2 border-slate-900 font-sans">
              <h2 className="text-base font-bold uppercase tracking-wider mb-2">FOLHA DE GABARITO / RESPOSTAS</h2>
              <p className="text-xs text-slate-600 mb-4">Gabarito oficial correspondente às questões deste simulado:</p>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 text-center text-xs">
                {questions.map((q, idx) => (
                  <div key={q.id || idx} className="border border-slate-400 p-2 rounded bg-slate-50">
                    <div className="text-[10px] font-bold text-slate-500">Q.{String(idx + 1).padStart(2, '0')}</div>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {q.respostaCorreta || q.Gabarito || '–'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
