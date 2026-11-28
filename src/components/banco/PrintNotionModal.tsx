'use client';

import React, { useState } from 'react';
import {
  Printer, X, Columns2, Square,
  Loader2, Sparkles, BookOpen
} from 'lucide-react';

export interface PrintableNotionQuestion {
  id: string;
  numero: string;
  topic: string;
  caseLabel: string;
  categoryKey?: string;
  enunciadoTexto?: string;
  imageUrls: string[];
  respostaText?: string;
  respostaImageUrls: string[];
}

interface PrintNotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subTitle?: string;
  questions: PrintableNotionQuestion[];
  isLoading?: boolean;
  loadingProgress?: string;
}

// ── Limpa texto e matemática para exibição impressa ─────────────────────────
function cleanPrintText(text: string): string {
  if (!text) return '';
  let str = text.replace(/\\n/g, '\n');
  str = str.replace(/\$\$([\s\S]*?)\$\$/g, '$1');
  str = str.replace(/\$([\s\S]*?)\$/g, '$1');
  str = str.replace(/\\frac\s*\{([\s\S]*?)\}\s*\{([\s\S]*?)\}/g, '($1 / $2)');
  str = str.replace(/\\sqrt\[(.*?)\]\s*\{([\s\S]*?)\}/g, '$1√($2)');
  str = str.replace(/\\sqrt\s*\{([\s\S]*?)\}/g, '√($1)');
  str = str.replace(/\\times|\\cdotp|\\cdot/g, '·');
  str = str.replace(/\\div/g, '÷');
  str = str.replace(/\\pm/g, '±');
  str = str.replace(/\\approx/g, '≈');
  str = str.replace(/\\neq/g, '≠');
  str = str.replace(/\\leq|\\le/g, '≤');
  str = str.replace(/\\geq|\\ge/g, '≥');
  str = str.replace(/\\pi/g, 'π');
  str = str.replace(/\^2\b/g, '²');
  str = str.replace(/\^3\b/g, '³');
  str = str.replace(/\\text\{([\s\S]*?)\}/g, '$1');
  str = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  str = str.replace(/\n/g, '<br>');
  return str;
}

// ── Extrai letra de resposta (A, B, C, D, E) do texto de gabarito ───────────
export function extractGabaritoLetter(text?: string): string {
  if (!text) return '–';
  const clean = text.trim();
  const m = clean.match(/(?:gabarito|resposta|alternativa|letra|opção|opcao)?\s*[:\-–]?\s*([A-E])(?![a-z0-9])/i);
  if (m && m[1]) return m[1].toUpperCase();

  // Casos de Certo / Errado ou texto curto
  if (/^(certo|correto|c)\b/i.test(clean)) return 'C';
  if (/^(errado|incorreto|e)\b/i.test(clean)) return 'E';
  if (clean.length <= 12) return clean;
  return clean.slice(0, 10) + '…';
}

// ── Gera o HTML completo de impressão otimizado para máxima densidade ───────
export function buildNotionPrintHTML(
  questions: PrintableNotionQuestion[],
  title: string,
  subTitle: string,
  options: {
    columns: '2' | '1';
    imageDensity: 'ultra' | 'compacto' | 'medio' | 'original';
    gabaritoMode: 'completo' | 'tabela' | 'nenhum';
    gabaritoNewPage?: boolean;
  }
): string {
  const isTwoCols = options.columns === '2';

  const imgMaxHeight =
    options.imageDensity === 'ultra' ? '155px' :
    options.imageDensity === 'compacto' ? '200px' :
    options.imageDensity === 'medio' ? '265px' : 'none';

  const textFontSize = options.imageDensity === 'ultra' ? '9px' : '10px';
  const itemGap = options.imageDensity === 'ultra' ? '4.5px' : '7px';
  const pageMargin = options.imageDensity === 'ultra' ? '6mm 7.5mm 7mm 7.5mm' : '8mm 10mm 9mm 10mm';

  const today = new Date().toLocaleDateString('pt-BR');

  // Questões HTML
  const questionsHtml = questions.map((q, idx) => {
    const qNum = String(idx + 1).padStart(2, '0');
    const origNum = q.numero && q.numero !== String(idx + 1) ? `Q.${q.numero}` : '';

    const imgs = (q.imageUrls || []).filter(u => u && u.trim() !== '');
    const textHtml = q.enunciadoTexto?.trim()
      ? `<div class="q-text">${cleanPrintText(q.enunciadoTexto)}</div>`
      : '';
    const imgsHtml = imgs.length > 0
      ? imgs.map((u, i) => `
          <div class="q-img-wrap">
            <img src="${u.trim()}" alt="Q.${qNum} Img ${i + 1}" class="q-img" />
          </div>
        `).join('')
      : (textHtml ? '' : `<div class="q-no-img">[Sem imagem cadastrada]</div>`);

    const metaParts = [
      origNum,
      q.caseLabel || 'Geral',
      q.topic || '',
    ].filter(Boolean).map(p => cleanPrintText(p));

    return `
      <article class="print-question">
        <div class="q-head">
          <span class="q-num">${qNum}.</span>
          <span class="q-meta">${metaParts.join(' · ')}</span>
        </div>
        ${textHtml}
        ${imgsHtml}
      </article>
    `;
  }).join('');

  // Gabarito HTML no final
  let gabaritoHtml = '';
  if (options.gabaritoMode !== 'nenhum' && questions.length > 0) {
    const cellsHtml = questions.map((q, idx) => {
      const qNum = String(idx + 1).padStart(2, '0');
      const letter = extractGabaritoLetter(q.respostaText);
      return `
        <div class="g-cell">
          <span class="g-num">${qNum}</span>
          <span class="g-resp">${letter}</span>
        </div>
      `;
    }).join('');

    let resolucoesHtml = '';
    if (options.gabaritoMode === 'completo') {
      const questionsWithResolucao = questions.filter(
        q => (q.respostaImageUrls && q.respostaImageUrls.length > 0) || (q.respostaText && q.respostaText.trim().length > 3)
      );

      if (questionsWithResolucao.length > 0) {
        resolucoesHtml = `
          <div class="resolucoes-section">
            <h3 class="resolucoes-title">Resoluções e Comentários</h3>
            <div class="resolucoes-columns">
              ${questionsWithResolucao.map((q) => {
                const qNum = String(questions.indexOf(q) + 1).padStart(2, '0');
                const rImgs = (q.respostaImageUrls || []).filter(u => u && u.trim() !== '');
                const meta = [q.caseLabel, q.topic].filter(Boolean).map(cleanPrintText).join(' · ');

                return `
                  <div class="resolucao-item">
                    <div class="resolucao-item-head">
                      <strong>${qNum}.</strong>
                      ${meta ? `<span>${meta}</span>` : ''}
                    </div>
                    ${q.respostaText ? `<div class="resolucao-text">${cleanPrintText(q.respostaText)}</div>` : ''}
                    ${rImgs.map(u => `<img src="${u.trim()}" class="resolucao-img" />`).join('')}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
    }

    gabaritoHtml = `
      <div class="gabarito-page${options.gabaritoNewPage ? ' gabarito-break' : ''}">
        <div class="gabarito-header">
          <h2>Gabarito Oficial</h2>
          <span class="badge-total">${questions.length} questões</span>
        </div>

        <div class="gabarito-grid">
          ${cellsHtml}
        </div>

        ${resolucoesHtml}
      </div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Impressão</title>
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: ${textFontSize};
      color: #0f172a;
      background: #ffffff;
      line-height: 1.3;
      -webkit-font-smoothing: antialiased;
    }

    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 12px 16px;
    }

    /* ── Cabeçalho fino e minimalista ── */
    .header {
      border-bottom: 1px solid #0f172a;
      padding-bottom: 4px;
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
      margin-top: 3px;
      padding-top: 3px;
      font-size: 8px;
      color: #475569;
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
    .field-line {
      flex: 1;
      border-bottom: 0.5pt solid #cbd5e1;
      height: 8px;
      display: inline-block;
    }

    /* ── Container de Questões ── */
    .questions-container {
      ${isTwoCols ? `
        column-count: 2;
        column-gap: 10px;
        column-rule: 0.5pt solid #e2e8f0;
        width: 100%;
      ` : `
        display: flex;
        flex-direction: column;
      `}
    }

    /* ── Cada Questão ── */
    .print-question {
      break-inside: avoid;
      page-break-inside: avoid;
      display: block;
      width: 100%;
      margin-bottom: ${itemGap};
      padding-bottom: ${itemGap};
      border-bottom: 0.5pt solid #e2e8f0;
    }

    .q-head {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-bottom: 2px;
      line-height: 1.2;
      min-width: 0;
    }
    .q-num {
      font-size: ${textFontSize};
      font-weight: 700;
      color: #0f172a;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }
    .q-meta {
      font-size: 7.5px;
      color: #64748b;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      min-width: 0;
    }
    .q-text {
      font-size: ${textFontSize};
      line-height: 1.3;
      margin: 2px 0;
      color: #0f172a;
    }

    .q-img-wrap {
      text-align: center;
      margin-top: 2px;
    }
    .q-img {
      display: block;
      max-width: 100%;
      max-height: ${imgMaxHeight};
      width: auto;
      height: auto;
      margin: 0 auto;
      object-fit: contain;
      background: #ffffff !important;
      filter: none !important;
      -webkit-filter: none !important;
    }
    .q-no-img {
      font-size: 8px;
      color: #94a3b8;
      font-style: italic;
      padding: 2px 0;
    }

    /* ── Gabarito Compacto ── */
    .gabarito-page {
      margin-top: 8px;
      padding-top: 5px;
      border-top: 1px solid #0f172a;
    }
    .gabarito-break {
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
    .gabarito-header h2 {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f172a;
    }
    .badge-total {
      font-size: 8px;
      color: #64748b;
      font-variant-numeric: tabular-nums;
    }

    .gabarito-grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 2px;
      margin-bottom: 6px;
    }
    @media (max-width: 600px) {
      .gabarito-grid { grid-template-columns: repeat(6, 1fr); }
    }
    .g-cell {
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
    .g-num {
      font-size: 7px;
      color: #64748b;
    }
    .g-resp {
      font-size: 8.5px;
      font-weight: 700;
      color: #0f172a;
    }

    /* ── Resoluções Detalhadas ── */
    .resolucoes-section {
      margin-top: 6px;
      border-top: 0.5pt solid #e2e8f0;
      padding-top: 5px;
    }
    .resolucoes-title {
      font-size: 8.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #334155;
      margin-bottom: 4px;
    }
    .resolucoes-columns {
      column-count: 2;
      column-gap: 10px;
      column-rule: 0.5pt solid #e2e8f0;
    }
    .resolucao-item {
      break-inside: avoid;
      page-break-inside: avoid;
      display: block;
      width: 100%;
      margin-bottom: 4px;
      padding-bottom: 4px;
      border-bottom: 0.5pt solid #e2e8f0;
      font-size: 8.2px;
    }
    .resolucao-item-head {
      display: flex;
      align-items: baseline;
      gap: 4px;
      margin-bottom: 2px;
      color: #0f172a;
      font-size: 8.2px;
      flex-wrap: wrap;
    }
    .resolucao-item-head span {
      color: #64748b;
      font-size: 7.5px;
    }
    .resolucao-text {
      color: #334155;
      line-height: 1.28;
      white-space: pre-line;
    }
    .resolucao-img {
      display: block;
      max-width: 100%;
      max-height: 145px;
      width: auto;
      height: auto;
      margin: 3px auto 0;
      object-fit: contain;
      background: #ffffff !important;
      filter: none !important;
    }

    /* ── Regras de Impressão (Papel A4) ── */
    @media print {
      @page {
        size: A4 portrait;
        margin: ${pageMargin};
      }
      body {
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page {
        max-width: 100%;
        padding: 0;
        margin: 0;
      }
      .print-question {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
      .gabarito-break {
        break-before: page !important;
        page-break-before: always !important;
      }
      .resolucao-item {
        break-inside: avoid !important;
        page-break-inside: avoid !important;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-top">
        <div class="header-title-wrap">
          <h1>${cleanPrintText(title)}</h1>
          ${subTitle ? `<span class="subtitle">· ${cleanPrintText(subTitle)}</span>` : ''}
        </div>
        <span class="count-meta">${questions.length} ${questions.length === 1 ? 'questão' : 'questões'}</span>
      </div>
      <div class="header-fields">
        <div class="header-field header-field-grow"><span>Nome:</span><span class="field-line"></span></div>
        <div class="header-field"><span>Data:</span><span>${today}</span></div>
        <div class="header-field"><span>Acertos:</span><span>____ / ${questions.length}</span></div>
      </div>
    </div>

    <div class="questions-container">
      ${questionsHtml}
    </div>

    ${gabaritoHtml}
  </div>

  <script>
    // Aguarda o carregamento de todas as imagens para abrir a impressão sem falhas
    window.addEventListener('load', async function() {
      try {
        var imgs = Array.from(document.querySelectorAll('img'));
        await Promise.all(imgs.map(function(img) {
          if (img.complete) return Promise.resolve();
          return new Promise(function(resolve) {
            img.onload = img.onerror = resolve;
          });
        }));
      } catch (e) {}

      setTimeout(function() {
        window.focus();
        window.print();
      }, 350);
    });
  </script>
</body>
</html>`;
}

export function PrintNotionModal({
  isOpen,
  onClose,
  title,
  subTitle,
  questions,
  isLoading = false,
  loadingProgress,
}: PrintNotionModalProps) {
  const [columns, setColumns] = useState<'2' | '1'>('2');
  const [imageDensity, setImageDensity] = useState<'ultra' | 'compacto' | 'medio' | 'original'>('ultra');
  const [gabaritoMode, setGabaritoMode] = useState<'completo' | 'tabela' | 'nenhum'>('tabela');
  const [gabaritoNewPage, setGabaritoNewPage] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (questions.length === 0) {
      alert('Nenhuma questão disponível para imprimir.');
      return;
    }

    const html = buildNotionPrintHTML(questions, title, subTitle || '', {
      columns,
      imageDensity,
      gabaritoMode,
      gabaritoNewPage,
    });

    const win = window.open('', '_blank', 'width=950,height=750');
    if (!win) {
      alert('Por favor, permita pop-ups para realizar a impressão. Verifique o bloqueador do navegador.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-3xl mx-3 sm:mx-4 bg-[#0d1220] border border-white/[0.12] rounded-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-200">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.08] bg-[#111627] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Printer size={16} className="text-indigo-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white truncate">
                  Imprimir: {title}
                </h2>
                {!isLoading && questions.length > 0 && (
                  <span className="text-[11px] font-mono text-indigo-300 shrink-0 tabular-nums">
                    · {questions.length} Q
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {subTitle || 'Diagramação fina e compacta — máximo de questões por folha'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Barra de Configurações de Impressão ── */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 sm:px-5 bg-[#0a0f1d] border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 flex-wrap">

            {/* Layout de Colunas */}
            <div className="flex items-center gap-1 bg-[#101526] p-0.5 rounded-lg border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setColumns('2')}
                title="2 Colunas (mais questões por folha)"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-normal transition-colors ${
                  columns === '2'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Columns2 size={12} />
                <span>2 Colunas</span>
              </button>
              <button
                type="button"
                onClick={() => setColumns('1')}
                title="1 Coluna tradicional"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-normal transition-colors ${
                  columns === '1'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Square size={11} />
                <span>1 Coluna</span>
              </button>
            </div>

            {/* Densidade */}
            <div className="flex items-center gap-1 bg-[#101526] p-0.5 rounded-lg border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setImageDensity('ultra')}
                className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                  imageDensity === 'ultra' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Máx/Folha
              </button>
              <button
                type="button"
                onClick={() => setImageDensity('compacto')}
                className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                  imageDensity === 'compacto' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Compacto
              </button>
              <button
                type="button"
                onClick={() => setImageDensity('medio')}
                className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                  imageDensity === 'medio' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Médio
              </button>
            </div>

            {/* Gabarito no final */}
            <div className="flex items-center gap-1 bg-[#101526] p-0.5 rounded-lg border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setGabaritoMode('tabela')}
                title="Grade compacta de respostas"
                className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                  gabaritoMode === 'tabela' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Gabarito
              </button>
              <button
                type="button"
                onClick={() => setGabaritoMode('completo')}
                title="Grade de respostas + Resoluções comentadas"
                className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                  gabaritoMode === 'completo' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                + Resoluções
              </button>
              <button
                type="button"
                onClick={() => setGabaritoMode('nenhum')}
                className={`px-2 py-1 rounded-md text-[11px] font-normal transition-colors ${
                  gabaritoMode === 'nenhum' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sem
              </button>
            </div>

            {gabaritoMode !== 'nenhum' && (
              <button
                type="button"
                onClick={() => setGabaritoNewPage(v => !v)}
                className={`px-2 py-1 rounded-lg border text-[11px] font-normal transition-colors ${
                  gabaritoNewPage
                    ? 'bg-white/[0.08] border-white/[0.15] text-slate-200'
                    : 'bg-[#101526] border-white/[0.08] text-slate-400 hover:text-slate-200'
                }`}
                title="Alternar entre imprimir gabarito na mesma folha ou em página separada"
              >
                {gabaritoNewPage ? 'Gab. separado' : 'Gab. junto'}
              </button>
            )}

          </div>

          {/* Botão de Ação Direta */}
          <button
            onClick={handlePrint}
            disabled={isLoading || questions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors ml-auto"
          >
            <Printer size={14} />
            <span>Imprimir / PDF</span>
          </button>
        </div>

        {/* ── Corpo / Preview ── */}
        <div className="p-4 sm:p-5 overflow-y-auto max-h-[60vh] flex flex-col gap-3 custom-scrollbar">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              <p className="text-xs text-indigo-300 font-bold tracking-wide">
                {loadingProgress || 'Carregando questões do Notion...'}
              </p>
              <p className="text-[11px] text-slate-500">
                Otimizando diagramação e verificando gabaritos.
              </p>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
              <BookOpen size={32} className="text-slate-700" />
              <p className="text-xs font-bold text-slate-400">Nenhuma questão encontrada para este caderno/caso.</p>
              <p className="text-[11px] text-slate-600 max-w-sm">
                Certifique-se de que os blocos e imagens estão cadastrados ou sincronize o banco para carregamento automático.
              </p>
            </div>
          ) : (
            <>
              {/* Resumo da Diagramação */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-white/[0.03] border border-white/[0.06] px-3.5 py-2 rounded-xl flex-wrap gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles size={12} className="text-amber-400" />
                  Diagramação pronta: <strong>{questions.length} questões</strong> em <strong>{columns === '2' ? '2 Colunas' : '1 Coluna'}</strong>.
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-medium">
                  {gabaritoMode === 'nenhum'
                    ? 'Sem folha de gabarito'
                    : gabaritoNewPage
                    ? 'Gabarito em folha separada'
                    : 'Gabarito compacto ao final'}
                </span>
              </div>

              {/* Preview das Questões */}
              <div className={`grid gap-2.5 ${columns === '2' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                {questions.map((q, idx) => {
                  const letter = extractGabaritoLetter(q.respostaText);
                  const firstImg = q.imageUrls && q.imageUrls.length > 0 ? q.imageUrls[0] : null;

                  return (
                    <div
                      key={q.id || idx}
                      className="bg-[#111627] border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2 relative group hover:border-white/[0.12] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-1.5 py-0.5 rounded">
                            Q.{String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="text-[10.5px] font-bold text-slate-300 truncate">
                            {q.caseLabel}
                          </span>
                        </div>
                        {letter !== '–' && (
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0">
                            Gab: {letter}
                          </span>
                        )}
                      </div>

                      {q.topic && (
                        <p className="text-[10px] text-slate-400 truncate">{q.topic}</p>
                      )}

                      {firstImg ? (
                        <div className="h-28 bg-[#080d1a] border border-white/[0.04] rounded-lg overflow-hidden flex items-center justify-center p-1">
                          <img
                            src={firstImg}
                            alt={`Preview Q.${idx + 1}`}
                            className="max-h-full max-w-full object-contain filter-none"
                          />
                        </div>
                      ) : (
                        <div className="h-16 bg-[#080d1a] border border-white/[0.04] rounded-lg flex items-center justify-center text-[10px] text-slate-600 italic">
                          Sem imagem
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-white/[0.08] bg-[#111627] shrink-0">
          <span className="text-[10.5px] text-slate-400">
            Dica: No diálogo de impressão do navegador, marque <em>&ldquo;Gráficos de segundo plano&rdquo;</em> para preservar linhas divisórias.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              disabled={isLoading || questions.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
            >
              <Printer size={13} />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
