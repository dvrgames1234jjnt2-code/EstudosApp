'use client';

import React, { useState } from 'react';
import { Printer, X, CheckCircle, Eye, EyeOff, Columns2, Square } from 'lucide-react';
import { BancoQuestion } from './QuestionsTable';
import { isQuestaoAnulada } from '../../lib/questionService';

interface PrintSimuladoModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: BancoQuestion[];
  title?: string;
  subTitle?: string;
}

type PrintColumns = '2' | '1';
type PrintDensity = 'ultra' | 'compacto' | 'confortavel';
type GabaritoPlacement = 'mesma_folha' | 'nova_folha' | 'sem';

// ── Sanitização segura & limpeza de LaTeX para impressão ────────────────────
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
  str = str.replace(/\\Delta/g, 'Δ');
  str = str.replace(/\\theta/g, 'θ');
  str = str.replace(/\\alpha/g, 'α');
  str = str.replace(/\\beta/g, 'β');
  str = str.replace(/\\rightarrow|\\Rightarrow/g, '→');
  str = str.replace(/\\leftarrow|\\Leftarrow/g, '←');
  str = str.replace(/\\in/g, '∈');
  str = str.replace(/\\notin/g, '∉');
  str = str.replace(/\\subset/g, '⊂');
  str = str.replace(/\\cap|\\inter/g, '∩');
  str = str.replace(/\\cup|\\union/g, '∪');
  str = str.replace(/\\sim/g, '~');
  str = str.replace(/\^2\b/g, '²');
  str = str.replace(/\^3\b/g, '³');
  str = str.replace(/\^n\b/g, 'ⁿ');
  str = str.replace(/\^1\b/g, '¹');
  str = str.replace(/\^0\b/g, '⁰');
  str = str.replace(/\^x\b/g, 'ˣ');
  str = str.replace(/\^\+([0-9]+)/g, '⁺$1');
  str = str.replace(/\^-([0-9]+)/g, '⁻$1');
  str = str.replace(/\^\{([\s\S]*?)\}/g, '⁽$1⁾');
  const subs: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', 'n': 'ₙ', 'x': 'ₓ',
  };
  str = str.replace(/_([0-9nx])/g, (_, m) => subs[m] || `_${m}`);
  str = str.replace(/\\text\{([\s\S]*?)\}/g, '$1');
  str = str.replace(/\\mathrm\{([\s\S]*?)\}/g, '$1');
  str = str.replace(/\\mathbf\{([\s\S]*?)\}/g, '$1');

  const hasSafeHtml = /<(?:br|p|div|span|b|strong|i|em|u|sub|sup|ul|ol|li|table|thead|tbody|tr|td|th|img)\b[^>]*>/i.test(str);
  if (hasSafeHtml) {
    str = str
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\n/g, '<br>');
    return str.trim();
  }

  str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  str = str.replace(/\n+/g, '<br>');
  return str.trim();
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripTagsLength(text: string): number {
  return String(text || '').replace(/<[^>]*>/g, '').trim().length;
}

// ── Gera o HTML compacto, fino e clean da prova para impressão ───────────────
function buildPrintHTML(
  questions: BancoQuestion[],
  title: string,
  subTitle: string,
  options: {
    columns: PrintColumns;
    density: PrintDensity;
    gabaritoPlacement: GabaritoPlacement;
    includeComments: boolean;
  }
): string {
  const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;
  const isTwoCols = options.columns === '2';

  const densityTokens =
    options.density === 'ultra'
      ? {
          pageMargin: '6mm 7.5mm 7mm 7.5mm',
          fontSize: '8.7px',
          lineHeight: '1.26',
          qGap: '4.5px',
          qPad: '4.5px',
          altFont: '8.4px',
          altGap: '1px',
          metaFont: '7.2px',
          apoioFont: '7.9px',
          colGap: '10px',
          imgMaxH: '115px',
        }
      : options.density === 'compacto'
      ? {
          pageMargin: '7.5mm 9mm 8.5mm 9mm',
          fontSize: '9.5px',
          lineHeight: '1.32',
          qGap: '6.5px',
          qPad: '6.5px',
          altFont: '9px',
          altGap: '1.5px',
          metaFont: '7.8px',
          apoioFont: '8.5px',
          colGap: '12px',
          imgMaxH: '140px',
        }
      : {
          pageMargin: '10mm 12mm 11mm 12mm',
          fontSize: '10.6px',
          lineHeight: '1.42',
          qGap: '9px',
          qPad: '9px',
          altFont: '10px',
          altGap: '2.5px',
          metaFont: '8.3px',
          apoioFont: '9.3px',
          colGap: '16px',
          imgMaxH: '180px',
        };

  const today = new Date().toLocaleDateString('pt-BR');

  const questionRows = questions
    .map((q, idx) => {
      const alts: Record<(typeof LETTERS)[number], string | undefined> = {
        A: q['Alternativa A'],
        B: q['Alternativa B'],
        C: q['Alternativa C'],
        D: q['Alternativa D'],
        E: q['Alternativa E'],
      };
      const filledLetters = LETTERS.filter((l) => Boolean(alts[l] && alts[l]!.trim() !== ''));
      const isAnulada = isQuestaoAnulada(q);

      // Alternativas curtas (ex: números, datas, 1-2 palavras) vão em linha para economizar espaço vertical
      const allShortAlts =
        filledLetters.length > 0 &&
        filledLetters.every((l) => {
          const val = alts[l] || '';
          return !val.includes('\n') && !/<img|<table|<br/i.test(val) && stripTagsLength(val) <= 18;
        });

      const altsHtml =
        filledLetters.length > 0
          ? `<div class="alts ${allShortAlts ? 'alts-inline' : ''}">${filledLetters
              .map(
                (l) => `
                <div class="alt-row">
                  <span class="alt-letter">${l})</span>
                  <span class="alt-text">${cleanPrintText(alts[l] || '')}</span>
                </div>`
              )
              .join('')}</div>`
          : '';

      const textoApoioHtml = q['Texto de apoio']?.trim()
        ? `<div class="apoio"><span class="apoio-label">Texto de apoio:</span> ${cleanPrintText(q['Texto de apoio'])}</div>`
        : '';

      const perguntaHtml =
        q.perguntaProblema?.trim() && q.perguntaProblema.trim() !== q.title?.trim()
          ? `<div class="pergunta">${cleanPrintText(q.perguntaProblema)}</div>`
          : '';

      const comentarioHtml =
        options.includeComments && (q.explicacao || q.comentario)
          ? `<div class="comentario"><strong>Comentário:</strong> ${cleanPrintText(q.explicacao || q.comentario || '')}</div>`
          : '';

      const ordemVal = q.Ordem ?? q.ordem;
      const metaParts = [
        q.materia,
        q.Banca || q.banca,
        q.Ano,
        ordemVal !== undefined && ordemVal !== null && String(ordemVal).trim() !== '' ? `#${ordemVal}` : '',
      ]
        .filter(Boolean)
        .map((p) => escapeHtml(String(p)));

      return `
        <article class="questao${isAnulada ? ' questao-anulada' : ''}">
          <div class="questao-header">
            <div class="questao-title-group">
              <span class="questao-num">${String(idx + 1).padStart(2, '0')}.</span>
              ${metaParts.length > 0 ? `<span class="questao-meta">${metaParts.join(' · ')}</span>` : ''}
            </div>
            ${isAnulada ? '<span class="questao-anulada-tag">Anulada</span>' : ''}
          </div>
          ${textoApoioHtml}
          ${q.title?.trim() ? `<div class="enunciado">${cleanPrintText(q.title)}</div>` : ''}
          ${perguntaHtml}
          ${altsHtml}
          ${comentarioHtml}
        </article>`;
    })
    .join('');

  const gabaritoHtml =
    options.gabaritoPlacement !== 'sem'
      ? `<section class="gabarito-section ${options.gabaritoPlacement === 'nova_folha' ? 'gabarito-page-break' : ''}">
          <div class="gabarito-header">
            <span class="gabarito-title">Gabarito Oficial</span>
            <span class="gabarito-sub">${questions.length} questões</span>
          </div>
          <div class="gabarito-grid">
            ${questions
              .map((q, idx) => {
                const anulada = isQuestaoAnulada(q);
                const resp = anulada ? 'AN' : q.respostaCorreta || q.Gabarito || '–';
                return `
                  <div class="gabarito-cell${anulada ? ' gabarito-anulada' : ''}">
                    <span class="gabarito-num">${String(idx + 1).padStart(2, '0')}</span>
                    <span class="gabarito-resp">${escapeHtml(resp)}</span>
                  </div>`;
              })
              .join('')}
          </div>
        </section>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: ${densityTokens.fontSize};
      color: #0f172a;
      background: #ffffff;
      line-height: ${densityTokens.lineHeight};
      -webkit-font-smoothing: antialiased;
    }

    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 14px 18px;
    }

    /* ── Cabeçalho fino e compacto ── */
    .header {
      border-bottom: 1px solid #0f172a;
      padding-bottom: 5px;
      margin-bottom: 7px;
    }
    .header-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
    }
    .header-title-wrap {
      display: flex;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
      flex-wrap: wrap;
    }
    .header h1 {
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.015em;
      color: #0f172a;
    }
    .header .subtitle {
      font-size: 8.5px;
      color: #64748b;
    }
    .header .count-meta {
      font-size: 8.5px;
      font-weight: 600;
      color: #334155;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .header-fields {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-top: 0.5pt solid #e2e8f0;
      margin-top: 4px;
      padding-top: 3px;
      font-size: 8px;
      color: #475569;
    }
    .header-fields .field-line {
      flex: 1;
      border-bottom: 0.5pt solid #cbd5e1;
      height: 9px;
      display: inline-block;
      min-width: 60px;
      vertical-align: bottom;
    }
    .header-field {
      display: flex;
      align-items: baseline;
      gap: 4px;
      white-space: nowrap;
    }
    .header-field-grow {
      flex: 1;
      min-width: 120px;
    }

    /* ── Fluxo de Questões ── */
    .questoes {
      ${
        isTwoCols
          ? `
        column-count: 2;
        column-gap: ${densityTokens.colGap};
        column-rule: 0.5pt solid #e2e8f0;
      `
          : `
        display: flex;
        flex-direction: column;
      `
      }
    }

    .questao {
      margin-bottom: ${densityTokens.qGap};
      padding-bottom: ${densityTokens.qPad};
      border-bottom: 0.5pt solid #e2e8f0;
      break-inside: avoid;
      page-break-inside: avoid;
      display: block;
    }
    .questao-anulada {
      opacity: 0.78;
    }

    .questao-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 2px;
    }
    .questao-title-group {
      display: flex;
      align-items: baseline;
      gap: 5px;
      min-width: 0;
      flex-wrap: wrap;
    }
    .questao-num {
      font-size: ${densityTokens.fontSize};
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }
    .questao-meta {
      font-size: ${densityTokens.metaFont};
      color: #64748b;
      font-weight: 400;
    }
    .questao-anulada-tag {
      font-size: 7px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #92400e;
      border: 0.5pt solid #f59e0b;
      padding: 0 3.5px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .apoio {
      margin: 2px 0 3px;
      padding: 2px 5px;
      border-left: 1px solid #cbd5e1;
      background: #f8fafc;
      font-style: italic;
      font-size: ${densityTokens.apoioFont};
      line-height: 1.24;
      color: #475569;
    }
    .apoio-label {
      font-style: normal;
      font-weight: 600;
      color: #334155;
    }

    .enunciado {
      color: #0f172a;
      font-weight: 400;
      margin-bottom: 2.5px;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .enunciado img, .apoio img, .alt-text img {
      display: block;
      max-width: 100%;
      max-height: ${densityTokens.imgMaxH};
      width: auto;
      height: auto;
      margin: 3px auto;
      object-fit: contain;
    }
    .enunciado table, .apoio table {
      width: 100%;
      border-collapse: collapse;
      margin: 3px 0;
      font-size: 0.9em;
    }
    .enunciado td, .enunciado th, .apoio td, .apoio th {
      border: 0.5pt solid #cbd5e1;
      padding: 1.5px 3px;
    }

    .pergunta {
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 2.5px;
    }

    /* ── Alternativas limpas e compactas ── */
    .alts {
      margin-top: 2px;
      display: flex;
      flex-direction: column;
      gap: ${densityTokens.altGap};
    }
    .alts-inline {
      flex-direction: row;
      flex-wrap: wrap;
      gap: 2px 10px;
    }
    .alt-row {
      display: flex;
      align-items: baseline;
      gap: 3.5px;
      font-size: ${densityTokens.altFont};
      line-height: ${densityTokens.lineHeight};
      color: #1e293b;
    }
    .alt-letter {
      flex-shrink: 0;
      font-weight: 700;
      font-size: ${densityTokens.altFont};
      color: #0f172a;
      min-width: 12px;
    }
    .alt-text {
      min-width: 0;
      word-break: break-word;
      overflow-wrap: anywhere;
    }

    /* ── Comentário discreto ── */
    .comentario {
      margin-top: 3px;
      padding: 2.5px 5px;
      border-left: 1px solid #94a3b8;
      background: #f8fafc;
      font-size: ${densityTokens.apoioFont};
      line-height: 1.25;
      color: #475569;
    }

    /* ── Gabarito compacto ── */
    .gabarito-section {
      margin-top: 8px;
      padding-top: 5px;
      border-top: 1px solid #0f172a;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .gabarito-page-break {
      page-break-before: always;
      break-before: page;
      margin-top: 0;
    }
    .gabarito-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .gabarito-title {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f172a;
    }
    .gabarito-sub {
      font-size: 8px;
      color: #64748b;
    }
    .gabarito-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 2px;
    }
    .gabarito-cell {
      border: 0.5pt solid #cbd5e1;
      border-radius: 2px;
      padding: 1.5px 2px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 2px;
      background: #ffffff;
      font-variant-numeric: tabular-nums;
    }
    .gabarito-anulada {
      background: #fffbeb;
      border-color: #fcd34d;
    }
    .gabarito-num {
      font-size: 7px;
      color: #64748b;
    }
    .gabarito-resp {
      font-size: 8.5px;
      font-weight: 700;
      color: #0f172a;
    }

    /* ── Regras de Impressão A4 ── */
    @media print {
      @page {
        size: A4 portrait;
        margin: ${densityTokens.pageMargin};
      }
      body {
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        padding: 0;
        max-width: 100%;
      }
      .questao {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .gabarito-page-break {
        break-before: page !important;
        page-break-before: always !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div class="header-top">
        <div class="header-title-wrap">
          <h1>${escapeHtml(title)}</h1>
          ${subTitle ? `<span class="subtitle">· ${escapeHtml(subTitle)}</span>` : ''}
        </div>
        <span class="count-meta">${questions.length} ${questions.length === 1 ? 'questão' : 'questões'}</span>
      </div>
      <div class="header-fields">
        <div class="header-field header-field-grow">
          <span>Nome:</span>
          <span class="field-line"></span>
        </div>
        <div class="header-field">
          <span>Data:</span>
          <span>${today}</span>
        </div>
        <div class="header-field">
          <span>Acertos:</span>
          <span>____ / ${questions.length}</span>
        </div>
      </div>
    </header>

    <div class="questoes">
      ${questionRows}
    </div>

    ${gabaritoHtml}
  </div>

  <script>
    window.addEventListener('load', async function () {
      try {
        var imgs = Array.from(document.querySelectorAll('img'));
        await Promise.all(imgs.map(function (img) {
          if (img.complete) return Promise.resolve();
          return new Promise(function (resolve) {
            img.onload = img.onerror = resolve;
          });
        }));
      } catch (e) {}
      setTimeout(function () {
        window.focus();
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;
}

export function PrintSimuladoModal({
  isOpen,
  onClose,
  questions,
  title = 'SIMULADO DE QUESTÕES',
  subTitle = 'Estação de Treinamento',
}: PrintSimuladoModalProps) {
  const [columns, setColumns] = useState<PrintColumns>('2');
  const [density, setDensity] = useState<PrintDensity>('ultra');
  const [gabaritoPlacement, setGabaritoPlacement] = useState<GabaritoPlacement>('mesma_folha');
  const [includeComments, setIncludeComments] = useState(false);

  if (!isOpen) return null;

  const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

  const handlePrint = () => {
    if (questions.length === 0) return;
    const html = buildPrintHTML(questions, title, subTitle, {
      columns,
      density,
      gabaritoPlacement,
      includeComments,
    });
    const win = window.open('', '_blank', 'width=960,height=740');
    if (!win) {
      alert('Permita pop-ups para usar a impressão. Verifique o bloqueador de pop-ups do seu navegador.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  const previewTextCls =
    density === 'ultra'
      ? 'text-[10.5px] leading-[1.32]'
      : density === 'compacto'
      ? 'text-[11.5px] leading-[1.38]'
      : 'text-[12.5px] leading-[1.48]';

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-slate-950/95 overflow-hidden text-slate-900">
      {/* ── Topbar de Controles ── */}
      <div className="bg-[#0d1220] border-b border-white/[0.08] px-3 sm:px-5 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Printer size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-medium tracking-wide text-white truncate">
                Imprimir Simulado / PDF
              </h2>
              <p className="text-[11px] text-slate-400 tabular-nums truncate">
                {questions.length} {questions.length === 1 ? 'questão' : 'questões'} · Diagramação compacta A4
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="lg:hidden w-9 h-9 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white flex items-center justify-center transition-colors shrink-0"
            aria-label="Fechar impressão"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Colunas */}
          <div className="flex items-center gap-1 bg-[#141a2b] p-0.5 rounded-lg border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setColumns('2')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-normal flex items-center gap-1 transition-colors ${
                columns === '2' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="2 colunas para caber o máximo por folha"
            >
              <Columns2 size={12} />
              <span>2 Colunas</span>
            </button>
            <button
              type="button"
              onClick={() => setColumns('1')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-normal flex items-center gap-1 transition-colors ${
                columns === '1' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Square size={11} />
              <span>1 Coluna</span>
            </button>
          </div>

          {/* Densidade */}
          <div className="flex items-center gap-1 bg-[#141a2b] p-0.5 rounded-lg border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setDensity('ultra')}
              className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                density === 'ultra' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Máximo de questões por folha"
            >
              Máx/Folha
            </button>
            <button
              type="button"
              onClick={() => setDensity('compacto')}
              className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                density === 'compacto' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Compacto
            </button>
            <button
              type="button"
              onClick={() => setDensity('confortavel')}
              className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                density === 'confortavel' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Médio
            </button>
          </div>

          {/* Gabarito */}
          <div className="flex items-center gap-1 bg-[#141a2b] p-0.5 rounded-lg border border-white/[0.08]">
            <button
              type="button"
              onClick={() => setGabaritoPlacement('mesma_folha')}
              className={`px-2 py-1 rounded-md text-[11px] font-normal flex items-center gap-1 transition-colors ${
                gabaritoPlacement === 'mesma_folha'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Inclui o gabarito logo abaixo sem forçar página extra"
            >
              <CheckCircle size={11} />
              <span>Gab. junto</span>
            </button>
            <button
              type="button"
              onClick={() => setGabaritoPlacement('nova_folha')}
              className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                gabaritoPlacement === 'nova_folha'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Coloca o gabarito em uma folha separada no final"
            >
              Gab. separado
            </button>
            <button
              type="button"
              onClick={() => setGabaritoPlacement('sem')}
              className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                gabaritoPlacement === 'sem' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sem
            </button>
          </div>

          {/* Comentários */}
          <button
            type="button"
            onClick={() => setIncludeComments(!includeComments)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-normal transition-colors flex items-center gap-1.5 border ${
              includeComments
                ? 'bg-indigo-500/15 border-indigo-500/35 text-indigo-300'
                : 'bg-[#141a2b] border-white/[0.08] text-slate-400 hover:text-slate-200'
            }`}
          >
            {includeComments ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>{includeComments ? 'Com comentários' : 'Sem comentários'}</span>
          </button>

          {/* Imprimir */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={questions.length === 0}
            className="ml-auto sm:ml-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Printer size={14} />
            <span>Imprimir / PDF</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="hidden lg:flex w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white items-center justify-center transition-colors"
            aria-label="Fechar impressão"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* ── Preview Visual Clean da Folha A4 ── */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-900">
        <div className="max-w-4xl mx-auto bg-white text-slate-900 p-4 sm:p-6 rounded-lg border border-slate-200 font-sans">
          {/* Cabeçalho compacto */}
          <div className="border-b border-slate-900 pb-2 mb-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
                <h1 className="text-xs sm:text-sm font-semibold tracking-tight text-slate-900">{title}</h1>
                {subTitle && <span className="text-[11px] text-slate-500">· {subTitle}</span>}
              </div>
              <span className="text-[11px] font-medium text-slate-600 tabular-nums shrink-0">
                {questions.length} {questions.length === 1 ? 'questão' : 'questões'}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1.5 mt-1.5 border-t border-slate-200 text-[10px] text-slate-600">
              <div className="flex-1 min-w-[140px]">
                Nome: <span className="inline-block w-32 border-b border-slate-300 align-bottom" />
              </div>
              <div>Data: ____/____/______</div>
              <div className="tabular-nums">Acertos: ____ / {questions.length}</div>
            </div>
          </div>

          {/* Questões em 2 ou 1 coluna */}
          <div
            className={
              columns === '2'
                ? 'columns-1 md:columns-2 gap-4 [column-rule:1px_solid_#e2e8f0]'
                : 'flex flex-col'
            }
          >
            {questions.map((q, idx) => {
              const alternativas: Record<string, string | undefined> = {
                A: q['Alternativa A'],
                B: q['Alternativa B'],
                C: q['Alternativa C'],
                D: q['Alternativa D'],
                E: q['Alternativa E'],
              };
              const filled = LETTERS.filter((l) => Boolean(alternativas[l] && alternativas[l]!.trim() !== ''));
              const isAnulada = isQuestaoAnulada(q);
              const ordemVal = q.Ordem ?? q.ordem;
              const metaParts = [
                q.materia,
                q.Banca || q.banca,
                q.Ano,
                ordemVal !== undefined && ordemVal !== null && String(ordemVal).trim() !== '' ? `#${ordemVal}` : '',
              ].filter(Boolean);

              const shortInline =
                filled.length > 0 &&
                filled.every((l) => {
                  const v = alternativas[l] || '';
                  return !v.includes('\n') && stripTagsLength(v) <= 18;
                });

              return (
                <article
                  key={q.id || idx}
                  className={`break-inside-avoid border-b border-slate-200/90 pb-2 mb-2 ${
                    isAnulada ? 'opacity-75' : ''
                  } ${previewTextCls}`}
                >
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap">
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {String(idx + 1).padStart(2, '0')}.
                      </span>
                      {metaParts.length > 0 && (
                        <span className="text-[9.5px] text-slate-500">{metaParts.join(' · ')}</span>
                      )}
                    </div>
                    {isAnulada && (
                      <span className="text-[9px] font-medium uppercase tracking-wider text-amber-800 border border-amber-400 px-1 rounded-sm shrink-0">
                        Anulada
                      </span>
                    )}
                  </div>

                  {q['Texto de apoio']?.trim() && (
                    <div className="my-1 px-2 py-1 border-l border-slate-300 bg-slate-50 text-[10px] italic text-slate-600 leading-snug">
                      <span className="not-italic font-semibold text-slate-700">Texto de apoio: </span>
                      {q['Texto de apoio']}
                    </div>
                  )}

                  {q.title?.trim() && (
                    <div className="text-slate-900 mb-1 whitespace-pre-line break-words">{q.title}</div>
                  )}

                  {q.perguntaProblema?.trim() && q.perguntaProblema.trim() !== q.title?.trim() && (
                    <div className="text-slate-900 font-medium mb-1 break-words">{q.perguntaProblema}</div>
                  )}

                  {filled.length > 0 && (
                    <div
                      className={`mt-1 ${
                        shortInline ? 'flex flex-wrap gap-x-3 gap-y-0.5' : 'flex flex-col gap-0.5'
                      }`}
                    >
                      {filled.map((letter) => (
                        <div key={letter} className="flex items-baseline gap-1 text-slate-800">
                          <span className="font-semibold text-slate-900 shrink-0">{letter})</span>
                          <span className="break-words">{alternativas[letter]}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {includeComments && (q.explicacao || q.comentario) && (
                    <div className="mt-1 px-2 py-1 border-l border-slate-400 bg-slate-50 text-[10px] text-slate-600 leading-snug">
                      <strong className="text-slate-700">Comentário: </strong>
                      {q.explicacao || q.comentario}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Gabarito */}
          {gabaritoPlacement !== 'sem' && (
            <div className="mt-3 pt-2 border-t border-slate-900">
              <div className="flex items-baseline justify-between mb-1.5">
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-900">
                  Gabarito Oficial
                </h2>
                <span className="text-[10px] text-slate-500 tabular-nums">
                  {gabaritoPlacement === 'nova_folha' ? 'Será impresso em folha separada' : 'Compacto na mesma folha'}
                </span>
              </div>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                {questions.map((q, idx) => {
                  const anulada = isQuestaoAnulada(q);
                  const resp = anulada ? 'AN' : q.respostaCorreta || q.Gabarito || '–';
                  return (
                    <div
                      key={q.id || idx}
                      className={`border px-1.5 py-0.5 rounded-sm flex items-center justify-between text-[10px] tabular-nums ${
                        anulada ? 'border-amber-300 bg-amber-50' : 'border-slate-300 bg-white'
                      }`}
                    >
                      <span className="text-slate-500 text-[9px]">{String(idx + 1).padStart(2, '0')}</span>
                      <span className="font-bold text-slate-900">{resp}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
