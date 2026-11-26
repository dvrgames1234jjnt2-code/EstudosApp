'use client';

import React, { memo, useCallback } from 'react';

export interface Flashcard3DProps {
  /** Conteúdo da pergunta (face frontal) */
  front: React.ReactNode;
  /** Conteúdo da resposta (face traseira) */
  back: React.ReactNode;
  /** Estado de rotação: false = frente (pergunta), true = verso (resposta) */
  flipped: boolean;
  /** Callback acionado ao clicar ou tocar no cartão */
  onFlip?: (nextFlipped: boolean) => void;
  /** Rótulo discreto superior na frente (opcional) */
  frontLabel?: string;
  /** Rótulo discreto superior no verso (opcional) */
  backLabel?: string;
  /** Dica discreta inferior na frente (opcional) */
  hint?: string;
  /** Desativa interação temporariamente */
  disabled?: boolean;
  /** Classes adicionais para dimensionamento externo */
  className?: string;
  /** Descrição acessível personalizada */
  ariaLabel?: string;
}

const Flashcard3D = memo(function Flashcard3D({
  front,
  back,
  flipped,
  onFlip,
  frontLabel,
  backLabel,
  hint = 'Toque para virar',
  disabled = false,
  className = '',
  ariaLabel,
}: Flashcard3DProps) {
  const handleToggle = useCallback(() => {
    if (disabled) return;
    onFlip?.(!flipped);
  }, [disabled, flipped, onFlip]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onFlip?.(!flipped);
      }
    },
    [disabled, flipped, onFlip]
  );

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={flipped}
      aria-disabled={disabled}
      aria-label={
        ariaLabel ||
        (flipped
          ? 'Flashcard mostrando resposta. Toque para voltar à pergunta.'
          : 'Flashcard mostrando pergunta. Toque para ver a resposta.')
      }
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={`group relative w-full select-none outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 rounded-2xl sm:rounded-3xl ${
        disabled ? 'cursor-default opacity-80' : 'cursor-pointer'
      } ${className}`}
      style={{
        perspective: '1400px',
        WebkitPerspective: '1400px',
        touchAction: 'manipulation',
      }}
    >
      {/* Container 3D rotativo */}
      <div
        className="flashcard-3d-inner relative w-full h-full min-h-[280px] sm:min-h-[340px]"
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
          transition: 'transform 500ms cubic-bezier(0.22, 1, 0.36, 1)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          willChange: 'transform',
        }}
      >
        {/* ── FACE FRONTAL (PERGUNTA) ── */}
        <div
          aria-hidden={flipped}
          className={`absolute inset-0 rounded-2xl sm:rounded-3xl bg-[#161920] border border-white/[0.08] flex flex-col justify-between p-6 sm:p-10 overflow-hidden transition-colors duration-200 group-hover:border-white/[0.13] ${
            flipped ? 'pointer-events-none' : 'pointer-events-auto'
          }`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(0deg) translateZ(1px)',
            boxShadow:
              '0 22px 48px -18px rgba(0, 0, 0, 0.85), 0 4px 14px -4px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            backgroundImage:
              'radial-gradient(120% 75% at 50% 0%, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0) 65%)',
          }}
        >
          {/* Rótulo superior discreto */}
          <div className="shrink-0 min-h-[18px] flex items-center justify-center">
            {frontLabel ? (
              <span className="text-[11px] font-normal tracking-[0.16em] uppercase text-slate-400/80 text-center truncate max-w-full">
                {frontLabel}
              </span>
            ) : null}
          </div>

          {/* Pergunta centralizada com scroll seguro em telas pequenas */}
          <div
            className="flex-1 min-h-0 flex items-center justify-center overflow-y-auto custom-scrollbar py-4 px-1"
            onWheel={(e) => e.stopPropagation()}
          >
            {typeof front === 'string' ? (
              <p className="text-lg sm:text-2xl md:text-[26px] font-light leading-relaxed tracking-[0.005em] text-slate-100 text-center max-w-xl break-words whitespace-pre-wrap">
                {front}
              </p>
            ) : (
              <div className="w-full text-center text-slate-100">{front}</div>
            )}
          </div>

          {/* Dica discreta inferior */}
          <div className="shrink-0 min-h-[18px] flex items-center justify-center">
            {hint ? (
              <span className="text-[11px] font-light tracking-wide text-slate-500/80">
                {hint}
              </span>
            ) : null}
          </div>
        </div>

        {/* ── FACE TRASEIRA (RESPOSTA) ── */}
        <div
          aria-hidden={!flipped}
          className={`absolute inset-0 rounded-2xl sm:rounded-3xl bg-[#13161c] border border-white/[0.11] flex flex-col justify-between p-6 sm:p-10 overflow-hidden transition-colors duration-200 group-hover:border-white/[0.16] ${
            flipped ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg) translateZ(1px)',
            boxShadow:
              '0 22px 48px -18px rgba(0, 0, 0, 0.88), 0 4px 14px -4px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
            backgroundImage:
              'radial-gradient(120% 75% at 50% 0%, rgba(148, 163, 184, 0.05) 0%, rgba(148, 163, 184, 0) 65%)',
          }}
        >
          {/* Rótulo superior discreto */}
          <div className="shrink-0 min-h-[18px] flex items-center justify-center">
            {backLabel ? (
              <span className="text-[11px] font-normal tracking-[0.16em] uppercase text-slate-400/80 text-center truncate max-w-full">
                {backLabel}
              </span>
            ) : null}
          </div>

          {/* Resposta centralizada com scroll seguro em textos longos */}
          <div
            className="flex-1 min-h-0 flex items-center justify-center overflow-y-auto custom-scrollbar py-4 px-1"
            onWheel={(e) => e.stopPropagation()}
          >
            {typeof back === 'string' ? (
              <p className="text-lg sm:text-2xl md:text-[26px] font-light leading-relaxed tracking-[0.005em] text-slate-100 text-center max-w-xl break-words whitespace-pre-wrap">
                {back}
              </p>
            ) : (
              <div className="w-full text-center text-slate-100">{back}</div>
            )}
          </div>

          {/* Dica discreta inferior */}
          <div className="shrink-0 min-h-[18px] flex items-center justify-center">
            <span className="text-[11px] font-light tracking-wide text-slate-500/75">
              Toque para voltar à pergunta
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Flashcard3D;
