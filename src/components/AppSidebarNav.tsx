"use client";

import { useEffect } from "react";
import {
  GraduationCap,
  Layers,
  ClipboardList,
  BarChart3,
  BookMarked,
  X,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";

interface AppSidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  activeTab?: string;
  onSelectTab?: (tabId: string) => void;
  questionsCount?: number;
  provasCount?: number;
  hasSelectedQuestion?: boolean;
  hasResolverQueue?: boolean;
  isAdmin?: boolean;
}

export function AppSidebarNav({
  isOpen,
  onClose,
  onMouseEnter,
  onMouseLeave,
  activeTab = "simulados",
  onSelectTab,
  questionsCount,
  provasCount,
  hasSelectedQuestion = false,
  hasResolverQueue = false,
  isAdmin = false,
}: AppSidebarNavProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const navItems = [
    {
      id: "resolver",
      label: "Questão Ativa",
      description: "Modo focado de resolução",
      icon: Layers,
      badge: hasSelectedQuestion ? "Em foco" : null,
      color: "from-indigo-600 to-purple-600",
      textColor: "text-indigo-400",
      disabled: !hasSelectedQuestion,
    },
    {
      id: "simulados",
      label: "Simulados",
      description: "Provas e testes cronometrados",
      icon: ClipboardList,
      count: provasCount,
      color: "from-emerald-600 to-teal-600",
      textColor: "text-emerald-400",
      disabled: false,
    },
    {
      id: "desempenho",
      label: "Desempenho",
      description: "Estatísticas de acertos e erros",
      icon: BarChart3,
      badge: hasResolverQueue ? "Disponível" : null,
      color: "from-amber-600 to-orange-600",
      textColor: "text-amber-400",
      disabled: !hasResolverQueue,
    },
    ...(isAdmin ? [
      {
        id: "notion",
        label: "Notion Question",
        description: "Integração Notion e Cadernos",
        icon: BookMarked,
        color: "from-purple-600 to-violet-600",
        textColor: "text-purple-400",
        disabled: false,
      },
      {
        id: "admin",
        label: "Painel Admin",
        description: "Questões, tipos e regras de simulados",
        icon: SlidersHorizontal,
        color: "from-blue-600 to-cyan-600",
        textColor: "text-blue-400",
        disabled: false,
      },
    ] : []),

  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Fundo Escuro */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[90] bg-black/70"
      />

      {/* Drawer Lateral */}
      <aside
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className="fixed left-0 top-0 bottom-0 z-[100] w-[min(85vw,21rem)] bg-[#070b19] border-r border-white/10 shadow-lg flex flex-col justify-between overflow-hidden"
      >
        {/* Header da Sidebar */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-normal text-white tracking-tight leading-none flex items-center gap-1.5">
                Navegação <span className="text-blue-400">Banco</span>
              </h2>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                Estação de Treinamento
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            title="Fechar Menu (Esc)"
          >
            <X size={15} />
          </button>
        </div>

            {/* Conteúdo com Scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <div className="px-2 py-1 flex items-center justify-between">
                <span className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">
                  Menu de Navegação
                </span>
              </div>

              <div className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      disabled={item.disabled}
                      onClick={() => {
                        if (item.disabled) return;
                        if (onSelectTab) onSelectTab(item.id);
                        onClose();
                      }}
                      className={`w-full group relative flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSelected
                          ? "bg-blue-600/15 border-blue-500/40"
                          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/15"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${item.color}`}
                      >
                        <Icon className="w-4 h-4 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-xs font-normal truncate transition-colors ${
                              isSelected ? "text-white" : "text-slate-200 group-hover:text-white"
                            }`}
                          >
                            {item.label}
                          </span>
                          {item.count !== undefined && (
                            <span className="px-2 py-0.5 text-[9px] font-normal bg-white/10 rounded-md text-slate-300 shrink-0">
                              {item.count}
                            </span>
                          )}
                          {item.badge && (
                            <span className="text-[8px] font-normal px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider shrink-0">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">
                          {item.description}
                        </p>
                      </div>

                      <ChevronRight
                        size={14}
                        className={`shrink-0 ${
                          isSelected ? "text-blue-400 opacity-100" : "text-slate-600 opacity-0 group-hover:opacity-100"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rodapé da Sidebar */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-medium">
                💡 Passe o mouse no logo para abrir
              </span>
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                v2.0
              </span>
            </div>
      </aside>
    </>
  );
}
