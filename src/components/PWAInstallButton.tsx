"use client";

import { useState } from "react";
import { Download, Smartphone, Share, PlusSquare, MoreVertical, ExternalLink, X, CheckCircle2 } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, isInsideIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (accepted) return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        title="Baixar e instalar o aplicativo no celular ou computador"
        className="flex items-center gap-1.5 px-2.5 sm:px-3 min-h-[36px] py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-normal tracking-wide transition-colors shrink-0"
      >
        <Download size={13} className="shrink-0" />
        <span className="hidden md:inline">Baixar App</span>
        <span className="md:hidden">App</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setShowGuideModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0b101d] p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                  <Smartphone size={17} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">Instalar Aplicativo SimuladosBB</h3>
                  <p className="text-[11px] text-slate-400">
                    Acesse direto da tela inicial, em tela cheia e sem barra do navegador.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                aria-label="Fechar"
              >
                <X size={15} />
              </button>
            </div>

            {isInsideIframe && (
              <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 space-y-2">
                <p className="text-xs text-blue-200 leading-relaxed">
                  Você está visualizando o site dentro de uma janela incorporada. Para instalar o aplicativo diretamente pelo navegador, abra em uma aba própria:
                </p>
                <a
                  href="/banco"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-normal transition-colors"
                >
                  <ExternalLink size={12} />
                  Abrir aplicativo em nova aba
                </a>
              </div>
            )}

            <div className="space-y-2.5 text-xs text-slate-300">
              {isIOS ? (
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-2">
                  <div className="font-medium text-white">No iPhone / iPad (Safari):</div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <Share size={14} className="text-blue-400 shrink-0" />
                    <span>1. Toque no botão <strong>Compartilhar</strong> na barra do Safari.</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300">
                    <PlusSquare size={14} className="text-emerald-400 shrink-0" />
                    <span>2. Role e toque em <strong>Adicionar à Tela de Início</strong>.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-2">
                    <div className="font-medium text-white">Android (Chrome / Edge):</div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <MoreVertical size={14} className="text-emerald-400 shrink-0" />
                      <span>Toque no menu <strong>⋮</strong> do navegador e selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-2">
                    <div className="font-medium text-white">iPhone / iPad (Safari):</div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <Share size={14} className="text-blue-400 shrink-0" />
                      <span>Toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-2">
                    <div className="font-medium text-white">Computador (Chrome / Edge):</div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      <span>Clique no ícone <strong>Instalar SimuladosBB</strong> no canto direito da barra de endereço.</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-normal transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
