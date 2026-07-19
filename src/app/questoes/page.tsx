"use client";

import { useState } from "react";
import { ArrowLeft, Sparkles, Loader2, CheckCircle, AlertCircle, FileText } from "lucide-react";
import Link from "next/link";

interface GeneratedQuestion {
  enunciado: string;
  options: string[];
  correctAnswer: string;
  correct_analysis: string;
  exam_tip: string;
  topico: string;
}

export default function QuestoesPage() {
  const [content, setContent] = useState("");
  const [materia, setMateria] = useState("");
  const [topico, setTopico] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);

  const generateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("O conteúdo base para a questão é obrigatório.");
      return;
    }

    setIsLoading(true);
    setError("");
    setQuestion(null);
    setSelectedOption(null);
    setIsAnswered(false);

    try {
      const response = await fetch("https://ais-pre-otowvmltpyzmq2wnwhf5gf-381636402323.us-east1.run.app/api/external/generate-question", {
        method: "POST",
        credentials: "include", // Importante para enviar os cookies da sessão do Google
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "concurseiro_secret_key_2024"
        },
        body: JSON.stringify({
          content,
          materia,
          topico
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(errorData.error || `Erro na API externa (Status ${response.status})`);
      }

      const data = await response.json();
      setQuestion(data);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido ao gerar questão.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAnswer = (option: string) => {
    if (isAnswered) return;
    setSelectedOption(option);
  };

  const handleConfirmAnswer = () => {
    if (!selectedOption) return;
    setIsAnswered(true);
  };

  const isCorrect = isAnswered && question && selectedOption === question.correctAnswer;
  const isWrong = isAnswered && question && selectedOption !== question.correctAnswer;

  return (
    <div className="flex flex-col min-h-screen bg-[#020617] text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#020617]/90 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="h-6 w-px bg-white/10"></div>
            <h1 className="font-bold text-lg text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Gerador de Questões com IA
            </h1>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1400px] mx-auto w-full px-4 py-6 gap-6 relative items-start flex-col lg:flex-row">
        
        {/* Left Column - Form */}
        <aside className="w-full lg:w-96 shrink-0 flex flex-col gap-4">
          <div className="bg-[#0F172A] rounded-2xl border border-white/10 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-6">Criar Nova Questão</h3>
            
            <form onSubmit={generateQuestion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Conteúdo Base *</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Cole aqui o texto, artigo ou resumo sobre o qual a IA deve criar a questão..."
                  className="w-full bg-[#020617] border border-white/10 rounded-xl p-4 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 min-h-[200px] resize-y"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Matéria (Opcional)</label>
                <input
                  type="text"
                  value={materia}
                  onChange={(e) => setMateria(e.target.value)}
                  placeholder="Ex: Conhecimentos Bancários"
                  className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Tópico (Opcional)</label>
                <input
                  type="text"
                  value={topico}
                  onChange={(e) => setTopico(e.target.value)}
                  placeholder="Ex: Sistema Financeiro Nacional"
                  className="w-full bg-[#020617] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button 
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Gerando Questão...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Gerar Questão
                  </>
                )}
              </button>
            </form>
          </div>
        </aside>

        {/* Right Column - Question View */}
        <main className="flex-1 w-full bg-[#0F172A] border border-white/5 rounded-2xl shadow-2xl text-slate-200 overflow-hidden min-h-[500px] flex flex-col">
          {!question && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/5 flex items-center justify-center border border-white/5 mb-4">
                <FileText className="w-8 h-8 text-indigo-400/50" />
              </div>
              <h2 className="text-xl font-bold text-white">Nenhuma questão gerada</h2>
              <p className="max-w-md text-sm">Preencha o formulário ao lado com um conteúdo base e deixe a IA formular uma questão inédita no padrão Cesgranrio para você.</p>
            </div>
          )}

          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
              <p className="font-medium animate-pulse">A IA está analisando o texto e criando alternativas...</p>
            </div>
          )}

          {question && !isLoading && (
            <div className="p-8 md:p-12 space-y-8 flex-1 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <span className="px-3 py-1 rounded-md bg-indigo-500/10 text-indigo-400 text-xs font-bold border border-indigo-500/20">
                  QUESTÃO INÉDITA (IA)
                </span>
                {question.topico && (
                  <span className="px-3 py-1 rounded-md bg-white/5 text-slate-400 text-xs font-medium border border-white/5">
                    {question.topico}
                  </span>
                )}
              </div>

              <div className="space-y-6">
                <p className="text-slate-200 text-lg leading-relaxed font-medium whitespace-pre-wrap">
                  {question.enunciado}
                </p>
                
                <div className="space-y-3 mt-8">
                  {question.options.map((opt, idx) => {
                    const isSelected = selectedOption === opt;
                    const isActualCorrect = isAnswered && question.correctAnswer === opt;
                    
                    let optionClass = "border-white/10 hover:border-indigo-500/30 hover:bg-white/5";
                    if (isSelected) optionClass = "border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/50";
                    
                    if (isAnswered) {
                      if (isActualCorrect) optionClass = "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/50";
                      else if (isSelected && !isActualCorrect) optionClass = "border-red-500/30 bg-red-500/10 text-red-400";
                      else optionClass = "border-white/5 opacity-40";
                    }

                    // Extract the letter for styling (assuming format "A) Text...")
                    const match = opt.match(/^([A-E])\)\s(.*)/);
                    const letter = match ? match[1] : String.fromCharCode(65 + idx);
                    const text = match ? match[2] : opt;

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectAnswer(opt)}
                        disabled={isAnswered}
                        className={`w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${optionClass}`}
                      >
                        <span className={`flex-shrink-0 w-8 h-8 rounded-full border text-sm flex items-center justify-center font-bold ${isSelected ? 'bg-indigo-500 text-white border-indigo-500' : 'border-slate-600 text-slate-400'} ${isAnswered && isActualCorrect ? 'bg-emerald-500 text-white border-emerald-500' : ''} ${isAnswered && isSelected && !isActualCorrect ? 'bg-red-500/20 text-red-400 border-red-500/50' : ''}`}>
                          {letter}
                        </span>
                        <span className={`text-base leading-relaxed mt-1 ${isSelected ? 'text-indigo-200' : 'text-slate-300'} ${isAnswered && isActualCorrect ? 'text-emerald-200' : ''} ${isAnswered && isSelected && !isActualCorrect ? 'text-red-300' : ''}`}>{text}</span>
                      </button>
                    );
                  })}
                </div>

                {!isAnswered && selectedOption && (
                  <button 
                    onClick={handleConfirmAnswer}
                    className="mt-6 w-full md:w-auto px-8 py-3 rounded-xl bg-white text-[#020617] font-bold text-sm hover:bg-slate-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  >
                    Confirmar Resposta
                  </button>
                )}

                {isAnswered && (
                  <div className="mt-8 space-y-4 animate-fade-in">
                    <div className={`p-6 rounded-xl border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                      <div className="flex items-center gap-2 font-bold mb-3 text-lg">
                        {isCorrect ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                        {isCorrect ? "Você acertou!" : "Você errou."}
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        <strong className="text-white block mb-1">Análise:</strong>
                        {question.correct_analysis}
                      </p>
                    </div>

                    {question.exam_tip && (
                      <div className="p-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                        <div className="flex items-center gap-2 font-bold mb-2 text-indigo-400">
                          <Sparkles className="w-4 h-4" />
                          Dica de Concurso
                        </div>
                        <p className="text-sm text-indigo-200/80 leading-relaxed">
                          {question.exam_tip}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
