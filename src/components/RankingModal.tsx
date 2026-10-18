"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, X, Medal, Target, Loader2, Crown, Star, ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "../lib/supabase";
import simuladoData from "../data/simulado.json";

interface RankingModalProps {
  isOpen: boolean;
  onClose: () => void;
  simuladoId: string;
  simuladoTitle: string;
}

export function RankingModal({ isOpen, onClose, simuladoId, simuladoTitle }: RankingModalProps) {
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States for detailed view of user errors
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userAnswers, setUserAnswers] = useState<any>(null); // null = not loaded, {} = no answers / restricted, Record = populated
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchRanking();
      fetchSimuladoQuestions();
      setSelectedUser(null);
      setUserAnswers(null);
    }
  }, [isOpen, simuladoId]);

  const fetchRanking = async () => {
    setLoading(true);
    let finalData: any[] = [];
    
    // Tenta primeiro selecionar com as respostas incluídas diretamente
    let { data, error } = await supabase
      .from('ranking_melhores_notas')
      .select(`
        points,
        score,
        total_questions,
        created_at,
        user_id,
        user_name,
        answers
      `)
      .eq('simulado_id', simuladoId)
      .order('points', { ascending: false })
      .limit(50);

    // Se falhar (por exemplo, a coluna 'answers' não existe na view de ranking)
    if (error) {
      console.warn("Tentando carregar ranking sem a coluna 'answers'...", error);
      const res = await supabase
        .from('ranking_melhores_notas')
        .select(`
          points,
          score,
          total_questions,
          created_at,
          user_id,
          user_name
        `)
        .eq('simulado_id', simuladoId)
        .order('points', { ascending: false })
        .limit(50);
      
      if (res.data) {
        finalData = res.data;
      }
    } else if (data) {
      finalData = data;
    }

    setRanking(finalData);
    setLoading(false);
  };

  const fetchSimuladoQuestions = async () => {
    // 1. Fallback de dados locais
    if (simuladoId === "simulado-completo-2026" || simuladoId === "BB-2025-01") {
      if (simuladoData && simuladoData.disciplinas) {
        const qs = simuladoData.disciplinas.flatMap((disc: any) => 
          (disc.questoes || []).map((q: any) => ({ ...q, disciplina: disc.nome || "Geral" }))
        );
        setQuestions(qs);
        return;
      }
    }

    // 2. Busca do Banco
    try {
      const { data, error } = await supabase.from('simulados').select('data_json').eq('id', simuladoId).maybeSingle();
      if (data && data.data_json) {
        const normalizeQuestion = (q: any, defaultDisc = "Geral") => {
          let alternativas = q.alternativas || {};
          let respostaCorreta = q.respostaCorreta || q.resposta_correta;
          let texto = q.texto || q.enunciado;
          if (Array.isArray(alternativas)) {
            const altObj: any = {};
            alternativas.forEach((a: any) => {
              if (a.letra && a.texto) altObj[a.letra] = a.texto;
            });
            if (Object.keys(altObj).length > 0) alternativas = altObj;
          }
          return {
            ...q,
            texto,
            alternativas,
            respostaCorreta,
            disciplina: q.disciplina || defaultDisc
          };
        };

        const fromDisciplinas = (obj: any) => {
          if (obj?.disciplinas && Array.isArray(obj.disciplinas)) {
            return obj.disciplinas.flatMap((disc: any) => 
              (disc.questoes || []).map((q: any) => normalizeQuestion(q, disc.nome))
            );
          }
          return null;
        };

        const fromDirect = (obj: any) => {
          if (obj?.questoes && Array.isArray(obj.questoes)) {
            return obj.questoes.map((q: any) => normalizeQuestion(q));
          }
          return null;
        };

        const root = data.data_json;
        let results = fromDisciplinas(root) || fromDirect(root);
        if (!results && root.data_json) {
          results = fromDisciplinas(root.data_json) || fromDirect(root.data_json);
        }
        if (!results && Array.isArray(root)) {
          results = root.map((q: any) => normalizeQuestion(q));
        }
        setQuestions(results || []);
      }
    } catch (err) {
      console.error("Erro ao carregar questões do simulado no ranking:", err);
    }
  };

  const handleUserClick = async (row: any) => {
    setSelectedUser({ id: row.user_id, name: row.user_name });
    
    // Se o ranking já carregou as respostas na listagem, usa direto
    if (row.answers && Object.keys(row.answers).length > 0) {
      setUserAnswers(row.answers);
      return;
    }

    setLoadingDetails(true);
    try {
      const { data, error } = await supabase
        .from('resultados')
        .select('answers')
        .eq('user_id', row.user_id)
        .eq('simulado_id', simuladoId)
        .order('points', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && data.answers && Object.keys(data.answers).length > 0) {
        setUserAnswers(data.answers);
      } else {
        setUserAnswers({});
      }
    } catch (err) {
      console.error("Erro ao buscar detalhes da tentativa:", err);
      setUserAnswers({});
    }
    setLoadingDetails(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          {/* Backdrop com desfoque pesado */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose} 
            className="absolute inset-0 bg-[#020617]/90 backdrop-blur-2xl"
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 30 }} 
            className="relative w-full max-w-xl bg-[#0B1224]/80 border border-white/5 rounded-3xl sm:rounded-[48px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col max-h-[85vh] backdrop-blur-3xl"
          >
            {/* Gradiente de Topo Dinâmico */}
            <div className="absolute top-0 left-0 w-full h-[200px] bg-gradient-to-b from-blue-600/10 to-transparent pointer-events-none" />
            
            <header className="relative p-6 sm:p-10 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4 sm:gap-5">
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-xl sm:rounded-2xl flex items-center justify-center border border-yellow-500/10 shadow-inner">
                  <Trophy className="w-5 h-5 sm:w-7 sm:h-7 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-2xl font-black text-white tracking-tighter uppercase italic">
                    {selectedUser ? "Questões Erradas" : "Ranking Global"}
                  </h3>
                  <p className="text-[10px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 line-clamp-1 max-w-[150px] sm:max-w-[250px]">
                    {selectedUser ? selectedUser.name : simuladoTitle}
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>
            </header>

            {selectedUser ? (
              /* DETALHES DE ERROS DO CANDIDATO */
              <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-6 sm:pb-10 custom-scrollbar relative">
                <div className="flex items-center gap-3 mb-6">
                  <button 
                    onClick={() => { setSelectedUser(null); setUserAnswers(null); }} 
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors py-2 bg-white/5 px-4 rounded-xl border border-white/5 hover:bg-white/10"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Ranking
                  </button>
                </div>

                {loadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-6">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                    <p className="text-xs font-black text-blue-500/60 uppercase tracking-[0.4em] animate-pulse">Carregando Erros...</p>
                  </div>
                ) : (() => {
                  // Se userAnswers for vazio ou nulo (RLS bloqueou ou dados vazios)
                  if (!userAnswers || Object.keys(userAnswers).length === 0) {
                    return (
                      <div className="text-center py-16 space-y-6">
                        <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.05] rounded-full flex items-center justify-center mx-auto">
                          <AlertCircle className="w-10 h-10 text-slate-600" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-black text-slate-400 uppercase tracking-[0.2em]">Respostas Ocultas</p>
                          <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
                            Por questões de privacidade ou segurança do banco de dados (RLS), o gabarito detalhado deste candidato não pode ser exposto publicamente.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  const wrongQuestions = questions.filter((q, idx) => {
                    const userAns = userAnswers[idx] !== undefined ? userAnswers[idx] : userAnswers[String(idx)];
                    return userAns !== q.respostaCorreta;
                  });

                  if (wrongQuestions.length === 0) {
                    return (
                      <div className="text-center py-16 space-y-6">
                        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                          <Crown className="w-10 h-10 text-emerald-500 fill-emerald-500/10 animate-bounce" />
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-black text-emerald-400 uppercase tracking-[0.2em]">Candidato Gabaritou!</p>
                          <p className="text-xs text-slate-400 font-medium">Nenhum erro registrado neste simulado. Desempenho excelente!</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-6">
                      <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center gap-3 text-red-400">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <p className="text-xs font-bold uppercase tracking-wider">
                          Este candidato errou {wrongQuestions.length} questões. Veja abaixo:
                        </p>
                      </div>

                      <div className="space-y-4">
                        {wrongQuestions.map((q: any) => {
                          const idx = questions.indexOf(q);
                          const userAns = userAnswers[idx] !== undefined ? userAnswers[idx] : userAnswers[String(idx)];
                          return (
                            <div key={idx} className="rounded-2xl border border-white/[0.05] bg-[#020617]/60 overflow-hidden">
                              <div className="flex items-center justify-between px-5 py-3 bg-white/[0.02] border-b border-white/[0.03]">
                                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                  Questão {idx + 1}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                                  {q.disciplina}
                                </span>
                              </div>
                              <div className="p-5 space-y-4">
                                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{q.texto || q.enunciado}</p>
                                <div className="space-y-2">
                                  {Object.entries(q.alternativas).map(([letter, text]: any) => {
                                    const isUserChoice = userAns === letter;
                                    const isCorrect = q.respostaCorreta === letter;
                                    
                                    let style = "bg-white/[0.01] border-white/[0.03] text-slate-500";
                                    if (isCorrect) style = "bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
                                    if (isUserChoice) style = "bg-red-500/10 border-red-500/20 text-red-300 font-semibold";

                                    return (
                                      <div key={letter} className={`flex items-start gap-3 p-3 rounded-xl border text-xs transition-all ${style}`}>
                                        <span className="font-black text-xs opacity-60 shrink-0 mt-0.5">{letter})</span>
                                        <span className="leading-snug">{text}</span>
                                        {isCorrect && (
                                          <span className="ml-auto shrink-0 text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                            Gabarito
                                          </span>
                                        )}
                                        {isUserChoice && (
                                          <span className="ml-auto shrink-0 text-[8px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20">
                                            Marcada
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* LISTA GERAL DO RANKING */
              <div className="flex-1 overflow-y-auto px-6 sm:px-10 pb-6 sm:pb-10 custom-scrollbar relative">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-6">
                    <div className="relative">
                      <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                      <div className="absolute inset-0 bg-blue-500/20 blur-xl animate-pulse" />
                    </div>
                    <p className="text-xs font-black text-blue-500/60 uppercase tracking-[0.4em] animate-pulse">Processando Inteligência...</p>
                  </div>
                ) : ranking.length > 0 ? (
                  <div className="space-y-4">
                    {ranking.map((row, i) => {
                      const isFirst = i === 0;
                      const isSecond = i === 1;
                      const isThird = i === 2;
                      const isTop3 = i < 3;

                      return (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          onClick={() => handleUserClick(row)}
                          className={`group relative flex items-center justify-between p-5 rounded-[28px] transition-all border cursor-pointer hover:scale-[1.01] ${
                            isFirst ? 'bg-gradient-to-r from-yellow-500/[0.08] to-transparent border-yellow-500/20 ring-1 ring-yellow-500/10' : 
                            isSecond ? 'bg-gradient-to-r from-slate-400/[0.05] to-transparent border-slate-400/20' :
                            isThird ? 'bg-gradient-to-r from-orange-600/[0.05] to-transparent border-orange-600/20' :
                            'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="flex items-center gap-5">
                            {/* Rank Badge */}
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-transform group-hover:scale-110 ${
                              isFirst ? 'bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]' : 
                              isSecond ? 'bg-slate-400 text-black shadow-[0_0_20px_rgba(148,163,184,0.2)]' : 
                              isThird ? 'bg-orange-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.2)]' : 
                              'bg-white/5 text-slate-500 border border-white/5'
                            }`}>
                              {isFirst ? <Crown className="w-5 h-5" /> : i + 1}
                            </div>

                            <div>
                              <div className="flex items-center gap-2.5">
                                <span className={`text-base font-bold tracking-tight ${isFirst ? 'text-white' : isTop3 ? 'text-slate-200' : 'text-slate-400'}`}>
                                  {row.user_name}
                                </span>
                                {isFirst && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 animate-pulse" />}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                  <span className={`text-[10px] font-black uppercase tracking-widest ${isFirst ? 'text-yellow-500/60' : 'text-slate-600'}`}>
                                    Aproveitamento: {Math.round((row.score/row.total_questions)*100)}%
                                  </span>
                                  <div className="w-1 h-1 rounded-full bg-slate-800" />
                                  <span className="text-[10px] font-black text-slate-700 hover:text-blue-400 uppercase tracking-widest transition-colors">Ver Erros</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right pr-2">
                            <div className={`text-2xl font-black tracking-tighter ${
                              isFirst ? 'text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 
                              isSecond ? 'text-slate-300' :
                              isThird ? 'text-orange-500' :
                              'text-blue-500/80'
                            }`}>
                              {row.points.toFixed(1)}
                            </div>
                            <div className="text-[10px] font-black text-slate-700 uppercase tracking-widest mt-0.5">Pontos</div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-24 space-y-6">
                    <div className="w-20 h-20 bg-white/[0.02] border border-white/[0.05] rounded-full flex items-center justify-center mx-auto">
                      <Target className="w-10 h-10 text-slate-800" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-black text-slate-600 uppercase tracking-[0.2em]">Pódio Inativo</p>
                      <p className="text-xs text-slate-800 font-bold uppercase tracking-widest">Aguardando as primeiras execuções de elite.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <footer className="relative p-8 bg-black/20 border-t border-white/[0.05] flex items-center justify-center gap-4 shrink-0">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.03]" />
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em] whitespace-nowrap">Elite Banker Intelligence</p>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.03]" />
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
