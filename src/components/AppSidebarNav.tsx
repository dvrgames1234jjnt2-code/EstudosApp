"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  Layers,
  ClipboardList,
  BarChart3,
  BookMarked,
  Timer,
  X,
  ChevronRight,
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
  activeTab = "banco",
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
      id: "banco",
      label: "Banco de Questões",
      description: "Navegue por todas as questões",
      icon: BookOpen,
      count: questionsCount,
      color: "from-blue-600 to-indigo-600",
      textColor: "text-blue-400",
      disabled: false,
    },
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
    {
      id: "notion",
      label: "Notion Question",
      description: "Integração Notion e Cadernos",
      icon: BookMarked,
      color: "from-purple-600 to-violet-600",
      textColor: "text-purple-400",
      disabled: false,
    },
    ...(isAdmin
      ? [
          {
            id: "cronometro",
            label: "Cronômetro",
            description: "Painel de tempo (Admin)",
            icon: Timer,
            color: "from-rose-600 to-pink-600",
            textColor: "text-rose-400",
            disabled: false,
          },
        ]
      : []),
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Fundo Escuro com Blur Soft */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer Lateral */}
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32 }}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className="fixed left-0 top-0 bottom-0 z-[100] w-80 sm:w-84 bg-[#070b19]/95 backdrop-blur-2xl border-r border-white/10 shadow-[25px_0_60px_rgba(0,0,0,0.85)] flex flex-col justify-between overflow-hidden"
          >
            {/* Header da Sidebar */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white tracking-tight leading-none flex items-center gap-1.5">
                    Navegação <span className="text-blue-400">Banco</span>
                  </h2>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Estação de Treinamento
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                title="Fechar Menu (Esc)"
              >
                <X size={15} />
              </button>
            </div>

            {/* Conteúdo com Scroll */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              <div className="px-2 py-1 flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
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
                      className={`w-full group relative flex items-center gap-3 p-3 rounded-2xl border text-left transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSelected
                          ? "bg-blue-600/15 border-blue-500/40 shadow-lg shadow-blue-500/10"
                          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/15"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${item.color} shadow-md transition-transform group-hover:scale-105`}
                      >
                        <Icon className="w-4 h-4 text-white" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`text-xs font-black truncate transition-colors ${
                              isSelected ? "text-white" : "text-slate-200 group-hover:text-white"
                            }`}
                          >
                            {item.label}
                          </span>
                          {item.count !== undefined && (
                            <span className="px-2 py-0.5 text-[9px] font-black bg-white/10 rounded-md text-slate-300 shrink-0">
                              {item.count}
                            </span>
                          )}
                          {item.badge && (
                            <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider shrink-0">
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
                        className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${
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
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
