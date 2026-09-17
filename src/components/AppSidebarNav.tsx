"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap,
  BookOpen,
  Layers,
  ClipboardList,
  BarChart3,
  BookMarked,
  Timer,
  Sparkles,
  Palette,
  FileText,
  Gamepad2,
  X,
  ChevronRight,
  ArrowRight,
  LayoutGrid
} from "lucide-react";

interface AppSidebarNavProps {
  isOpen: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  activeTab?: string;
  onSelectTab?: (tabId: any) => void;
}

const APPS = [
  {
    id: "banco",
    path: "/banco",
    name: "Banco de Questões",
    tagline: "Estação de Treinamento",
    description: "Banco completo, provas, Notion e métricas",
    icon: GraduationCap,
    color: "from-blue-600 to-indigo-600",
    textColor: "text-blue-400",
    badge: "Principal",
  },
  {
    id: "questoes",
    path: "/questoes",
    name: "Resolução de Questões",
    tagline: "Filtros Avançados",
    description: "Filtre por matéria, banca, ano e resolva",
    icon: BookOpen,
    color: "from-indigo-600 to-purple-600",
    textColor: "text-indigo-400",
  },
  {
    id: "simulado",
    path: "/simulado",
    name: "Simulados BB",
    tagline: "Provas Reais & Tempo",
    description: "Simulados com cronômetro e gabarito",
    icon: ClipboardList,
    color: "from-emerald-600 to-teal-600",
    textColor: "text-emerald-400",
  },
  {
    id: "edital",
    path: "/edital",
    name: "Edital Verticalizado",
    tagline: "Guia do Concurso",
    description: "Conteúdo programático e edital do BB",
    icon: FileText,
    color: "from-amber-600 to-orange-600",
    textColor: "text-amber-400",
  },
  {
    id: "fixacao",
    path: "/fixacao",
    name: "Jogo de Fixação",
    tagline: "Memorização Ativa",
    description: "Flashcards e cards de retenção",
    icon: Gamepad2,
    color: "from-rose-600 to-pink-600",
    textColor: "text-rose-400",
  },
  {
    id: "gerador",
    path: "/gerador",
    name: "Gerador com IA",
    tagline: "Inteligência Artificial",
    description: "Criação de questões e conexão Notion",
    icon: Sparkles,
    color: "from-purple-600 to-violet-600",
    textColor: "text-purple-400",
  },
  {
    id: "draw",
    path: "/draw",
    name: "Lousa & Rascunho",
    tagline: "Quadro Virtual",
    description: "Área para rascunhar cálculos e desenho",
    icon: Palette,
    color: "from-cyan-600 to-blue-600",
    textColor: "text-cyan-400",
  },
];

const BANCO_TABS = [
  { id: "banco", icon: BookOpen, label: "Banco de Questões" },
  { id: "resolver", icon: Layers, label: "Questão Ativa" },
  { id: "simulados", icon: ClipboardList, label: "Simulados" },
  { id: "desempenho", icon: BarChart3, label: "Desempenho" },
  { id: "notion", icon: BookMarked, label: "Notion Question" },
  { id: "cronometro", icon: Timer, label: "Cronômetro" },
];

export function AppSidebarNav({
  isOpen,
  onClose,
  onMouseEnter,
  onMouseLeave,
  activeTab,
  onSelectTab,
}: AppSidebarNavProps) {
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
                    Simulados<span className="text-blue-400">BB</span>
                  </h2>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Menu de Aplicativos
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
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
              {/* Seção 1: Módulos da Plataforma */}
              <div className="space-y-2">
                <div className="px-2 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <LayoutGrid size={11} className="text-blue-400" /> Módulos & Apps
                  </span>
                </div>

                <div className="space-y-1.5">
                  {APPS.map((app) => {
                    const Icon = app.icon;
                    const isActive = pathname === app.path;

                    return (
                      <Link
                        key={app.id}
                        href={app.path}
                        onClick={onClose}
                        className={`group relative flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200 ${
                          isActive
                            ? "bg-blue-600/15 border-blue-500/40 shadow-lg shadow-blue-500/10"
                            : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/15"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${app.color} shadow-md transition-transform group-hover:scale-105`}
                        >
                          <Icon className="w-4 h-4 text-white" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-black truncate transition-colors ${
                                isActive ? "text-white" : "text-slate-200 group-hover:text-white"
                              }`}
                            >
                              {app.name}
                            </span>
                            {app.badge && (
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider shrink-0">
                                {app.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5 font-normal">
                            {app.description}
                          </p>
                        </div>

                        <ChevronRight
                          size={13}
                          className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${
                            isActive ? "text-blue-400 opacity-100" : "text-slate-600 opacity-0 group-hover:opacity-100"
                          }`}
                        />
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Seção 2: Abas do Banco de Questões (Exibido apenas quando em /banco) */}
              {pathname === "/banco" && onSelectTab && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="px-2 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Layers size={11} className="text-indigo-400" /> Abas do Banco
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {BANCO_TABS.map((tab) => {
                      const Icon = tab.icon;
                      const isSelected = activeTab === tab.id;

                      return (
                        <button
                          key={tab.id}
                          onClick={() => {
                            onSelectTab(tab.id);
                            onClose();
                          }}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-[11px] font-bold transition-all ${
                            isSelected
                              ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300 shadow-sm"
                              : "bg-white/[0.02] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-white/[0.05]"
                          }`}
                        >
                          <Icon size={13} className={isSelected ? "text-indigo-400" : "text-slate-500"} />
                          <span className="truncate">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
