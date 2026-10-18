'use client';

import React, { useState } from 'react';
import {
  Printer, X, CheckCircle2, Columns2, Square,
  Layers, FileText, Loader2, Sparkles, BookOpen
} from 'lucide-react';

export interface PrintableNotionQuestion {
  id: string;
  numero: string;
  topic: string;
  caseLabel: string;
  categoryKey?: string;
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
    imageDensity: 'compacto' | 'medio' | 'original';
    gabaritoMode: 'completo' | 'tabela' | 'nenhum';
  }
): string {
  const isTwoCols = options.columns === '2';

  // Alturas máximas por densidade:
  // Compacto: ~200px para caber de 4 a 6 questões por coluna (até 12 por folha!)
  const imgMaxHeight =
    options.imageDensity === 'compacto' ? '205px' :
    options.imageDensity === 'medio' ? '270px' : 'none';

  const today = new Date().toLocaleDateString('pt-BR');

  // Questões HTML
  const questionsHtml = questions.map((q, idx) => {
    const qNum = String(idx + 1).padStart(2, '0');
    const origNum = q.numero && q.numero !== String(idx + 1) ? ` (Q.${q.numero})` : '';

    const imgs = (q.imageUrls || []).filter(u => u && u.trim() !== '');
    const imgsHtml = imgs.length > 0
      ? imgs.map((u, i) => `
          <div class="q-img-wrap">
            <img src="${u.trim()}" alt="Q.${qNum} Img ${i + 1}" class="q-img" />
          </div>
        `).join('')
      : `<div class="q-no-img">[Sem imagem cadastrada]</div>`;

    return `
      <div class="print-question">
        <div class="q-head">
          <div class="q-left">
            <span class="q-badge">Q.${qNum}</span>
            <span class="q-orig">${origNum}</span>
            <span class="q-caso">${cleanPrintText(q.caseLabel || 'Geral')}</span>
          </div>
          ${q.topic ? `<span class="q-topic">${cleanPrintText(q.topic)}</span>` : ''}
        </div>
        ${imgsHtml}
      </div>
    `;
  }).join('');

  // Gabarito HTML no final
  let gabaritoHtml = '';
  if (options.gabaritoMode !== 'nenhum' && questions.length > 0) {
    // Tabela rápida
    const cellsHtml = questions.map((q, idx) => {
      const qNum = String(idx + 1).padStart(2, '0');
      const letter = extractGabaritoLetter(q.respostaText);
      return `
        <div class="g-cell">
          <div class="g-num">Q.${qNum}</div>
          <div class="g-resp">${letter}</div>
        </div>
      `;
    }).join('');

    // Resoluções detalhadas (se existirem comentários ou imagens de resolução)
    let resolucoesHtml = '';
    if (options.gabaritoMode === 'completo') {
      const questionsWithResolucao = questions.filter(
        q => (q.respostaImageUrls && q.respostaImageUrls.length > 0) || (q.respostaText && q.respostaText.trim().length > 3)
      );

      if (questionsWithResolucao.length > 0) {
        resolucoesHtml = `
          <div class="resolucoes-section">
            <h3 class="resolucoes-title">RESOLUÇÕES E COMENTÁRIOS DETALHADOS</h3>
            <div class="resolucoes-columns">
              ${questionsWithResolucao.map((q) => {
                const qNum = String(questions.indexOf(q) + 1).padStart(2, '0');
                const rImgs = (q.respostaImageUrls || []).filter(u => u && u.trim() !== '');

                return `
                  <div class="resolucao-item">
                    <div class="resolucao-item-head">
                      <strong>Questão ${qNum}</strong>
                      ${q.caseLabel ? `<span>• ${cleanPrintText(q.caseLabel)}</span>` : ''}
                      ${q.topic ? `<span>— ${cleanPrintText(q.topic)}</span>` : ''}
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
      <div class="gabarito-page">
        <div class="gabarito-header">
          <div class="gabarito-title-row">
            <h2>FOLHA DE GABARITO & RESPOSTAS</h2>
            <span class="badge-total">TOTAL: ${questions.length} QUESTÕES</span>
          </div>
          <p class="gabarito-sub">Gabarito correspondente às questões deste simulado / caderno de estudos:</p>
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
      font-size: 11px;
      color: #111827;
      background: #ffffff;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }

    .page {
      max-width: 900px;
      margin: 0 auto;
      padding: 16px 20px;
    }

    /* ── Cabeçalho Principal ── */
    .header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .header-top {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 4px;
    }
    .header h1 {
      font-size: 15px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #0f172a;
    }
    .header .badge {
      font-family: monospace;
      font-size: 10px;
      font-weight: 800;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 2px 7px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .header .subtitle {
      font-size: 10px;
      color: #475569;
      margin-bottom: 8px;
    }
    .header-fields {
      display: grid;
      grid-template-columns: 2fr 1fr 1.2fr;
      gap: 10px;
      border-top: 1px solid #e2e8f0;
      padding-top: 7px;
      font-size: 10px;
      font-weight: 600;
      color: #334155;
    }

    /* ── Container de Questões (Alta Densidade) ── */
    .questions-container {
      ${isTwoCols ? `
        column-count: 2;
        column-gap: 14px;
        column-rule: 1px solid #e2e8f0;
        width: 100%;
      ` : `
        display: flex;
        flex-direction: column;
        gap: 12px;
      `}
    }

    /* ── Cada Questão Individual ── */
    .print-question {
      break-inside: avoid;
      page-break-inside: avoid;
      display: inline-block;
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #cbd5e1;
      vertical-align: top;
    }

    .q-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 4px;
      line-height: 1.2;
    }
    .q-left {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
      flex-wrap: wrap;
    }
    .q-badge {
      font-size: 10.5px;
      font-weight: 800;
      color: #0f172a;
      background: #f1f5f9;
      border: 1px solid #94a3b8;
      padding: 1px 5px;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }
    .q-orig {
      font-size: 9px;
      color: #64748b;
      font-weight: 600;
    }
    .q-caso {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 1px 5px;
      border-radius: 3px;
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .q-topic {
      font-size: 9px;
      font-weight: 600;
      color: #475569;
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 130px;
    }

    .q-img-wrap {
      text-align: center;
      margin-top: 4px;
    }
    .q-img {
      display: block;
      max-width: 100%;
      max-height: ${imgMaxHeight};
      width: auto;
      height: auto;
      margin: 0 auto;
      object-fit: contain;
      border-radius: 3px;
      border: 1px solid #e2e8f0;
      background: #ffffff !important;
      filter: none !important;
      -webkit-filter: none !important;
    }
    .q-no-img {
      font-size: 9.5px;
      color: #94a3b8;
      font-style: italic;
      padding: 6px 0;
    }

    /* ── Gabarito no Final (Quebra de Página Obrigatória) ── */
    .gabarito-page {
      page-break-before: always;
      break-before: page;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 2px solid #0f172a;
    }
    .gabarito-header {
      margin-bottom: 12px;
    }
    .gabarito-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .gabarito-title-row h2 {
      font-size: 14px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0f172a;
    }
    .badge-total {
      font-size: 10px;
      font-weight: 800;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 2px 7px;
      border-radius: 4px;
      font-family: monospace;
    }
    .gabarito-sub {
      font-size: 10px;
      color: #64748b;
    }

    /* ── Grid Compacto de Respostas ── */
    .gabarito-grid {
      display: grid;
      grid-template-columns: repeat(10, 1fr);
      gap: 5px;
      margin-bottom: 20px;
    }
    @media (max-width: 600px) {
      .gabarito-grid { grid-template-columns: repeat(5, 1fr); }
    }
    .g-cell {
      border: 1px solid #94a3b8;
      border-radius: 4px;
      padding: 3px 2px;
      text-align: center;
      background: #f8fafc;
    }
    .g-num {
      font-size: 8px;
      font-weight: 700;
      color: #64748b;
    }
    .g-resp {
      font-size: 13px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 1px;
    }

    /* ── Resoluções Detalhadas ── */
    .resolucoes-section {
      margin-top: 20px;
      border-top: 1.5px solid #cbd5e1;
      padding-top: 12px;
    }
    .resolucoes-title {
      font-size: 11px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #334155;
      margin-bottom: 10px;
    }
    .resolucoes-columns {
      column-count: 2;
      column-gap: 14px;
      column-rule: 1px solid #e2e8f0;
    }
    .resolucao-item {
      break-inside: avoid;
      page-break-inside: avoid;
      display: inline-block;
      width: 100%;
      box-sizing: border-box;
      margin-bottom: 10px;
      padding: 6px 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 5px;
      font-size: 10px;
    }
    .resolucao-item-head {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-bottom: 4px;
      color: #0f172a;
      font-size: 10px;
      flex-wrap: wrap;
    }
    .resolucao-text {
      color: #334155;
      margin-bottom: 4px;
      line-height: 1.4;
      white-space: pre-line;
    }
    .resolucao-img {
      display: block;
      max-width: 100%;
      max-height: 190px;
      width: auto;
      height: auto;
      margin: 4px auto 0 auto;
      object-fit: contain;
      border-radius: 3px;
      border: 1px solid #cbd5e1;
      background: #ffffff !important;
      filter: none !important;
    }

    /* ── Regras de Impressão (Papel A4) ── */
    @media print {
      @page {
        size: A4 portrait;
        margin: 8mm 10mm 10mm 10mm;
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
      .gabarito-page {
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
        <h1>${title}</h1>
        <span class="badge">TOTAL: ${questions.length} QUESTÕES</span>
      </div>
      <p class="subtitle">${subTitle || 'Caderno de Estudos — Estação de Treinamento'}</p>
      <div class="header-fields">
        <div><strong>Aluno(a):</strong> ____________________________________</div>
        <div><strong>Data:</strong> ${today}</div>
        <div><strong>Nota / Acertos:</strong> ________ / ${questions.length}</div>
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
  const [imageDensity, setImageDensity] = useState<'compacto' | 'medio' | 'original'>('compacto');
  const [gabaritoMode, setGabaritoMode] = useState<'completo' | 'tabela' | 'nenhum'>('completo');

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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-3xl mx-3 sm:mx-4 bg-[#0d1220] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-200">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/[0.08] bg-[#111627] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Printer size={16} className="text-indigo-400" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wider truncate">
                  Imprimir: {title}
                </h2>
                {!isLoading && questions.length > 0 && (
                  <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full shrink-0 font-mono">
                    {questions.length} Q
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {subTitle || 'Gera folha econômica com máximo de questões por folha e gabarito no final'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-white hover:bg-white/[0.06] transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Barra de Configurações de Impressão ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-5 bg-[#0a0f1d] border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-4 flex-wrap">

            {/* Layout de Colunas */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Layout:</span>
              <div className="flex items-center gap-1 bg-[#101526] p-0.5 rounded-lg border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setColumns('2')}
                  title="2 Colunas (Economiza até 60% de papel, mais questões por folha)"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                    columns === '2'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Columns2 size={12} />
                  <span>2 Colunas</span>
                  <span className="text-[8.5px] bg-white/20 px-1 rounded uppercase tracking-wider">Máx</span>
                </button>
                <button
                  type="button"
                  onClick={() => setColumns('1')}
                  title="1 Coluna tradicional"
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                    columns === '1'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Square size={11} />
                  <span>1 Coluna</span>
                </button>
              </div>
            </div>

            {/* Densidade das Imagens */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tamanho:</span>
              <div className="flex items-center gap-1 bg-[#101526] p-0.5 rounded-lg border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setImageDensity('compacto')}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                    imageDensity === 'compacto' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Compacto
                </button>
                <button
                  type="button"
                  onClick={() => setImageDensity('medio')}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                    imageDensity === 'medio' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Médio
                </button>
              </div>
            </div>

            {/* Gabarito no final */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gabarito:</span>
              <div className="flex items-center gap-1 bg-[#101526] p-0.5 rounded-lg border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setGabaritoMode('completo')}
                  title="Tabela de respostas + Resoluções completas na última folha"
                  className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                    gabaritoMode === 'completo' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Completo
                </button>
                <button
                  type="button"
                  onClick={() => setGabaritoMode('tabela')}
                  title="Apenas a grade compacta de letras na última folha"
                  className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                    gabaritoMode === 'tabela' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Tabela
                </button>
                <button
                  type="button"
                  onClick={() => setGabaritoMode('nenhum')}
                  className={`px-2 py-1 rounded-md text-[10.5px] font-bold transition-all ${
                    gabaritoMode === 'nenhum' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sem
                </button>
              </div>
            </div>

          </div>

          {/* Botão de Ação Direta */}
          <button
            onClick={handlePrint}
            disabled={isLoading || questions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg shadow-indigo-600/30 ml-auto"
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
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">
                  {gabaritoMode !== 'nenhum' ? 'Gabarito posicionado na última folha' : 'Sem folha de gabarito'}
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
                      className="bg-[#111627] border border-white/[0.06] rounded-xl p-3 flex flex-col gap-2 relative group hover:border-white/[0.12] transition-all"
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
            Dica: No diálogo de impressão do navegador, marque <em>"Gráficos de segundo plano"</em> para preservar linhas e badges.
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              disabled={isLoading || questions.length === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-indigo-600/20"
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
