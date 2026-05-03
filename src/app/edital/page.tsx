"use client";

import { useState } from "react";
import { FileText, ArrowLeft, BookOpen, Calendar, MapPin, Award, BookMarked, Download, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import editalData from "../../data/edital.json";

export default function EditalPage() {
  const [activeSection, setActiveSection] = useState("resumo");

  const menuItems = [
    { id: "resumo", label: "Resumo e Vagas", icon: Award },
    { id: "conteudo", label: "Conteúdo Programático", icon: BookOpen },
    { id: "documento", label: "Edital Completo (PDF)", icon: FileText },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#020617]">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#020617]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-white/10"></div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                <FileText className="text-indigo-400 w-5 h-5" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-white">Edital Banco do Brasil</h1>
                <p className="text-xs text-slate-400">Edital {editalData.edital}</p>
              </div>
            </div>
          </div>
          
          <a 
            href="/edital.pdf" 
            download
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-sm transition-colors border border-white/10"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Baixar PDF</span>
          </a>
        </div>
      </header>

      <div className="flex flex-1 max-w-7xl mx-auto w-full px-6 py-8 gap-8">
        {/* Sidebar Menu */}
        <aside className="hidden lg:flex flex-col w-64 shrink-0 gap-2">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">
            Navegação do Edital
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : "text-slate-500"}`} />
                {item.label}
              </button>
            );
          })}
          
          <div className="mt-8 p-5 rounded-2xl bg-gradient-to-b from-indigo-500/10 to-transparent border border-indigo-500/20">
            <h3 className="text-sm font-bold text-white mb-2">Simulado Baseado neste Edital</h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Temos um simulado completo com questões focadas nos tópicos deste edital.
            </p>
            <Link 
              href="/"
              className="block text-center px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-bold transition-colors"
            >
              Fazer Simulado
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#0F172A] rounded-3xl border border-white/5 overflow-hidden shadow-2xl relative">
          
          {activeSection === "documento" && (
            <div className="flex-1 w-full h-[calc(100vh-12rem)] relative">
              <iframe 
                src="/edital.pdf" 
                className="w-full h-full border-none rounded-b-3xl"
                title="Edital Banco do Brasil"
              />
            </div>
          )}

          {activeSection === "resumo" && (
            <div className="p-8 lg:p-12 overflow-y-auto">
              <h2 className="text-3xl font-bold text-white mb-8">Resumo do Edital</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <div className="bg-[#020617]/50 p-6 rounded-2xl border border-white/5">
                  <p className="text-sm text-slate-400 mb-1">Cargo</p>
                  <p className="text-lg font-semibold text-white">{editalData.cargo}</p>
                  <p className="text-sm text-indigo-400 mt-2">{editalData.nomes_relacionamento.join(" e ")}</p>
                </div>
                
                <div className="bg-[#020617]/50 p-6 rounded-2xl border border-white/5">
                  <p className="text-sm text-slate-400 mb-1">Remuneração Inicial</p>
                  <p className="text-lg font-semibold text-emerald-400">{editalData.remuneracao_inicial}</p>
                  <p className="text-sm text-slate-500 mt-2">{editalData.jornada_trabalho}</p>
                </div>
              </div>

              <h3 className="text-xl font-semibold text-white mb-6">Vantagens e Benefícios</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {editalData.vantagens.map((vantagem, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300 text-sm leading-relaxed">{vantagem}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "conteudo" && (
            <div className="p-8 lg:p-12 overflow-y-auto">
              <h2 className="text-3xl font-bold text-white mb-2">Conteúdo Programático</h2>
              <p className="text-slate-400 mb-10">Tópicos extraídos diretamente do edital para o seu estudo.</p>
              
              <h3 className="text-xl font-bold text-indigo-400 mb-6 flex items-center gap-3">
                <BookOpen className="w-6 h-6" /> Conhecimentos Básicos
              </h3>
              
              <div className="grid grid-cols-1 gap-6 mb-12">
                {editalData.conteudo_programatico.conhecimentos_basicos.map((disciplina, index) => (
                  <div key={index} className="bg-[#020617]/50 p-6 rounded-2xl border border-white/5">
                    <h4 className="text-lg font-semibold text-white mb-4">{disciplina.materia}</h4>
                    <div className="flex flex-wrap gap-2">
                      {disciplina.topicos.map((topico, i) => (
                        <span key={i} className="px-3 py-1.5 bg-white/5 text-slate-300 text-sm rounded-lg border border-white/5">
                          {topico}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
