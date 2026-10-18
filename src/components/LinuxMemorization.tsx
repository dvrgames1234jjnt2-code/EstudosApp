"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Folder, 
  Terminal, 
  ShieldAlert, 
  ChevronRight, 
  Trophy, 
  Timer, 
  Zap,
  ArrowRight,
  RotateCcw,
  LayoutGrid
} from 'lucide-react';

const GAME_DATA = {
  diretorios: [
    { q: "Representa arquivos de dispositivos de hardware e periféricos (discos, impressoras, etc).", a: "/dev", options: ["/etc", "/bin", "/dev", "/usr"] },
    { q: "Arquivos de configuração do sistema e dos serviços instalados.", a: "/etc", options: ["/var", "/etc", "/sbin", "/root"] },
    { q: "Diretórios pessoais dos usuários (arquivos e configs individuais).", a: "/home", options: ["/usr", "/tmp", "/home", "/var"] },
    { q: "Binários essenciais para administração do sistema (geralmente para root).", a: "/sbin", options: ["/bin", "/sbin", "/lib", "/opt"] },
    { q: "Diretório raiz, ponto inicial de todo o sistema de arquivos.", a: "/", options: ["/root", "/home", "/", "/boot"] },
    { q: "Armazena dados variáveis gerados por serviços (logs, caches).", a: "/var", options: ["/tmp", "/var", "/dev", "/etc"] },
    { q: "Arquivos temporários criados por programas ou usuários.", a: "/tmp", options: ["/var", "/tmp", "/dev", "/bin"] },
    { q: "Programas e bibliotecas compartilhados entre usuários.", a: "/usr", options: ["/usr", "/opt", "/root", "/sbin"] }
  ],
  comandos: [
    { q: "Qual comando gerencia tarefas agendadas periodicamente?", a: "cron", options: ["at", "cron", "jobs", "batch"] },
    { q: "Qual comando faz requisições a URLs e transfere dados?", a: "curl", options: ["wget", "curl", "ssh", "ping"] },
    { q: "Qual comando lista os processos em background da sessão atual?", a: "jobs", options: ["ps", "top", "jobs", "bg"] },
    { q: "Comando para criar um diretório novo.", a: "mkdir", options: ["rmdir", "mkdir", "cd", "touch"] },
    { q: "Como ver os processos em execução no momento?", a: "ps", options: ["kill", "top", "ps", "jobs"] },
    { q: "Qual comando pesquisa texto dentro de arquivos?", a: "grep", options: ["find", "grep", "locate", "cat"] },
    { q: "Comando para alterar permissões de arquivos.", a: "chmod", options: ["chown", "chmod", "umask", "setfacl"] },
    { q: "Testar a conectividade com outro host na rede.", a: "ping", options: ["ifconfig", "netstat", "ping", "ssh"] }
  ],
  seguranca: [
    { q: "Flag de mount que impede a execução de binários no volume.", a: "noexec", options: ["nodev", "nosuid", "noexec", "ro"] },
    { q: "O que o bit SUID faz em um arquivo executável?", a: "Roda com permissões do dono", options: ["Roda com permissões do dono", "Roda com permissões do grupo", "Impede execução", "Criptografa o arquivo"] },
    { q: "Qual flag de montagem impede a criação de arquivos de dispositivo?", a: "nodev", options: ["noexec", "nodev", "nosuid", "sync"] },
    { q: "O bit SGID em diretórios faz com que novos arquivos:", a: "Herdem o grupo do diretório", options: ["Herdem o grupo do diretório", "Herdem o dono do diretório", "Sejam somente leitura", "Sejam ocultos"] }
  ]
};

export function LinuxMemorization() {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'finished'>('start');
  const [currentMode, setCurrentMode] = useState<keyof typeof GAME_DATA | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [questions, setQuestions] = useState<any[]>([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastResult, setLastResult] = useState<{ correct: boolean, answer: string } | null>(null);
  const [time, setTime] = useState(0);

  useEffect(() => {
    let timer: any;
    if (gameState === 'playing') {
      timer = setInterval(() => setTime(t => t + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [gameState]);

  const startGame = (mode: keyof typeof GAME_DATA) => {
    const shuffled = [...GAME_DATA[mode]].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentMode(mode);
    setGameState('playing');
    setCurrentQuestionIndex(0);
    setScore(0);
    setStreak(0);
    setTime(0);
  };

  const handleAnswer = (selected: string) => {
    if (showFeedback) return;

    const correct = questions[currentQuestionIndex].a;
    const isCorrect = selected === correct;

    setLastResult({ correct: isCorrect, answer: correct });
    setShowFeedback(true);

    if (isCorrect) {
      setScore(s => s + 100 + (streak * 20));
      setStreak(s => s + 1);
    } else {
      setStreak(0);
    }
  };

  const nextQuestion = () => {
    setShowFeedback(false);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(i => i + 1);
    } else {
      setGameState('finished');
    }
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (gameState === 'start') {
    return (
      <div className="space-y-12 py-12">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-light text-white tracking-tighter">
            Laboratório de <span className="font-black text-blue-500 italic">Memorização</span>
          </h2>
          <p className="text-slate-500 text-xs uppercase font-bold tracking-[0.3em]">Treinamento de elite para diretórios e comandos Linux</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { id: 'diretorios', title: 'Diretórios', icon: <Folder className="w-6 h-6" />, color: 'from-blue-600 to-indigo-600', desc: 'Domine a hierarquia /etc, /var, /dev e mais.' },
            { id: 'comandos', title: 'Comandos', icon: <Terminal className="w-6 h-6" />, color: 'from-emerald-600 to-teal-600', desc: 'Agendamento, rede e manipulação de arquivos.' },
            { id: 'seguranca', title: 'Segurança', icon: <ShieldAlert className="w-6 h-6" />, color: 'from-rose-600 to-pink-600', desc: 'Flags de mount, SUID, SGID e permissões.' }
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => startGame(mode.id as any)}
              className="group relative p-8 rounded-[32px] bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all text-left overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${mode.color} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${mode.color} flex items-center justify-center text-white mb-6 shadow-lg shadow-black/20`}>
                {mode.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{mode.title}</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-6">{mode.desc}</p>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500">
                Iniciar Protocolo <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (gameState === 'playing') {
    const q = questions[currentQuestionIndex];
    const progress = (currentQuestionIndex / questions.length) * 100;

    return (
      <div className="max-w-3xl mx-auto py-12 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Score: {score}</span>
            </div>
            <div className="px-4 py-2 bg-emerald-600/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
              <Zap className="w-3 h-3 text-emerald-500" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Streak: {streak}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Timer className="w-4 h-4" />
            <span className="text-sm font-mono">{formatTime(time)}</span>
          </div>
        </div>

        <div className="relative h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            className="absolute top-0 left-0 h-full bg-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-10 rounded-[40px] bg-white/[0.02] border border-white/5 space-y-10 relative overflow-hidden">
          <div className="space-y-4">
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">Desafio {currentQuestionIndex + 1}/{questions.length}</div>
            <h3 className="text-2xl sm:text-3xl font-light text-white leading-tight">{q.q}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {q.options.map((opt: string) => (
              <button
                key={opt}
                disabled={showFeedback}
                onClick={() => handleAnswer(opt)}
                className={`p-6 rounded-2xl border text-left font-mono transition-all
                  ${showFeedback 
                    ? opt === q.a 
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                      : 'bg-white/[0.01] border-white/5 text-slate-600'
                    : 'bg-white/[0.03] border-white/5 text-slate-300 hover:bg-white/[0.06] hover:border-white/10 hover:scale-[1.02]'
                  }
                `}
              >
                {opt}
              </button>
            ))}
          </div>

          <AnimatePresence>
            {showFeedback && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-6"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${lastResult?.correct ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                    {lastResult?.correct ? <Trophy className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${lastResult?.correct ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {lastResult?.correct ? 'Excelente, Agente!' : 'Sincronização Falhou'}
                    </p>
                    <p className="text-xs text-slate-500">A resposta correta era <span className="text-white font-mono">{lastResult?.answer}</span></p>
                  </div>
                </div>
                <button
                  onClick={nextQuestion}
                  className="w-full sm:w-auto px-8 py-4 bg-white text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:scale-105 transition-all"
                >
                  Próximo Desafio
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  if (gameState === 'finished') {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center space-y-12">
        <div className="relative inline-block">
          <div className="w-32 h-32 bg-blue-600 rounded-[40px] rotate-12 flex items-center justify-center mx-auto shadow-2xl shadow-blue-900/40">
            <Trophy className="w-16 h-16 text-white -rotate-12" />
          </div>
          <div className="absolute -top-4 -right-4 w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white border-4 border-[#020617] font-bold">
            100%
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-5xl font-black text-white tracking-tighter">Treinamento <span className="text-blue-500">Concluído.</span></h2>
          <p className="text-slate-500 uppercase text-[10px] font-black tracking-[0.5em]">Base de dados memorizada com sucesso</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
            <div className="text-2xl font-black text-white">{score}</div>
            <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Pontuação</div>
          </div>
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
            <div className="text-2xl font-black text-white">{formatTime(time)}</div>
            <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Tempo Total</div>
          </div>
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/5">
            <div className="text-2xl font-black text-white">{streak}</div>
            <div className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Melhor Combo</div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={() => setGameState('start')}
            className="w-full sm:w-auto px-10 py-5 bg-blue-600 text-white font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-blue-500 transition-all flex items-center justify-center gap-3"
          >
            <RotateCcw className="w-4 h-4" /> Reiniciar Módulo
          </button>
          <button 
            className="w-full sm:w-auto px-10 py-5 bg-white/[0.03] border border-white/5 text-slate-400 font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-white/10 transition-all"
            onClick={() => window.location.reload()}
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  return null;
}
