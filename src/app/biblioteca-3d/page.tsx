"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  Loader2,
  Filter,
  CheckCircle2,
  HelpCircle,
  Eye,
  Layers,
  Flame,
  Award,
  Compass,
} from "lucide-react";
import { supabase, supabasePublic } from "../../lib/supabase";
import type { BancoQuestion } from "../../components/banco/QuestionsTable";
import type { QuestionStats } from "../../components/banco/CadernosTab";
import Book3DScene from "../../components/biblioteca/Book3DScene";
import OpenBookReader from "../../components/biblioteca/OpenBookReader";
import type { Caderno3DItem, Caso3DGroup } from "../../components/biblioteca/types";
import { BOOK_PALETTES } from "../../components/biblioteca/bookTextureGenerator";

export default function Biblioteca3DPage() {
  const router = useRouter();

  // Estados principais
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<BancoQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<string, QuestionStats>>({});
  const [duvidas, setDuvidas] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Filtros
  const [selectedMateria, setSelectedMateria] = useState<string>("todas");

  // Interação 3D
  const [hoveredCaderno, setHoveredCaderno] = useState<Caderno3DItem | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedCaderno, setSelectedCaderno] = useState<Caderno3DItem | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Autenticação e Verificação de Admin
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user ?? null);
      if (user?.id) {
        fetchUserAnswers(user.id);
        fetchDuvidas(user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        fetchUserAnswers(session.user.id);
        fetchDuvidas(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Carregamento de Questões e Organização
  // ─────────────────────────────────────────────────────────────────────────────
  const fetchQuestionsAndNodes = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Busca questões
      const { data: qData, error: qErr } = await supabasePublic
        .from("questoes")
        .select("*")
        .order("id", { ascending: true });

      if (qErr) throw qErr;

      const normalized: BancoQuestion[] = (qData || []).map((row: any) => ({
        id: row.id,
        materia: row.Materia || row.Disciplina || row.materia || row.disciplina || "Geral",
        tema: row.tema || row.Tema || row.Tópico || row.Assunto || undefined,
        title: row.Enunciado || row.enunciado || row.texto || row.title || "",
        dificuldade: row.dificuldade || row.Dificuldade || undefined,
        prova: row.PROVA || row.prova || undefined,
        dat: row.created_at || row.dat || undefined,
        referencia: row.referencia || undefined,
        "Alternativa A": row["Alternativa A"] || row.alternativa_a || undefined,
        "Alternativa B": row["Alternativa B"] || row.alternativa_b || undefined,
        "Alternativa C": row["Alternativa C"] || row.alternativa_c || undefined,
        "Alternativa D": row["Alternativa D"] || row.alternativa_d || undefined,
        "Alternativa E": row["Alternativa E"] || row.alternativa_e || undefined,
        "Texto de apoio": row["Texto de apoio"] || row.texto_apoio || undefined,
        perguntaProblema:
          row["Pergunta problema"] !== undefined
            ? row["Pergunta problema"]
            : row.pergunta_problema || row.perguntaProblema || undefined,
        respostaCorreta:
          row.respostaCorreta || row.resposta_correta || row.Gabarito || row.gabarito || undefined,
        Gabarito: row.Gabarito || row.gabarito || undefined,
        explicacao:
          row["Comentário"] ||
          row.Comentário ||
          row.comentario ||
          row.Comentario ||
          row.explicacao ||
          row.Explicacao ||
          undefined,
        created_at: row.created_at || undefined,
        imagemEnunciado: row.Imagem_Enunciado || row.imagemEnunciado || undefined,
        Ano: row.Ano ? Number(row.Ano) : undefined,
        ID_Qconcursos: row.ID_Qconcursos || undefined,
        link: row.link || undefined,
        organizacao_id: row.organizacao_id || undefined,
        Duvida: typeof row.Duvida === "boolean" ? row.Duvida : undefined,
      }));

      setQuestions(normalized);
    } catch (err: any) {
      console.error("Erro ao carregar dados da biblioteca:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserAnswers = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("historico_respostas")
        .select("questao_id, resposta_usuario, correto, data, horario, status")
        .eq("User", userId);

      if (error) throw error;

      const map: Record<string, QuestionStats> = {};
      (data || []).forEach((row: any) => {
        const qid = String(row.questao_id);
        const isCorreto =
          row.correto === true || row.correto === "true" || row.status === "acertou";
        if (!map[qid]) {
          map[qid] = {
            lastAnswer: row.resposta_usuario || "",
            isCorrect: isCorreto,
            totalAttempts: 1,
            errorCount: isCorreto ? 0 : 1,
            correctCount: isCorreto ? 1 : 0,
            timestamp: Date.now(),
          };
        } else {
          map[qid].totalAttempts++;
          if (isCorreto) map[qid].correctCount++;
          else map[qid].errorCount++;
          map[qid].isCorrect = isCorreto;
          map[qid].lastAnswer = row.resposta_usuario || map[qid].lastAnswer;
        }
      });
      setUserAnswers(map);
    } catch (err) {
      console.error("Erro ao carregar histórico de respostas:", err);
    }
  }, []);

  const fetchDuvidas = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase.from("duvidas").select("questao_id").eq("user_id", userId);
      if (data) {
        setDuvidas(new Set(data.map((d: any) => String(d.questao_id))));
      }
    } catch (err) {
      console.warn("Aviso ao buscar dúvidas:", err);
    }
  }, []);

  useEffect(() => {
    fetchQuestionsAndNodes();
  }, [fetchQuestionsAndNodes]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Estruturação dos Cadernos no Espaço 3D
  // ─────────────────────────────────────────────────────────────────────────────
  const { cadernos3D, materiasList } = useMemo(() => {
    // Agrupa questões por matéria e tema/caso
    const gruposMateria: Record<string, Record<string, BancoQuestion[]>> = {};

    questions.forEach((q) => {
      const mat = (q.materia || "Geral").trim();
      const cad = (q.tema || "Caderno Geral").trim();

      if (!gruposMateria[mat]) {
        gruposMateria[mat] = {};
      }
      if (!gruposMateria[mat][cad]) {
        gruposMateria[mat][cad] = [];
      }
      gruposMateria[mat][cad].push(q);
    });

    const matKeys = Object.keys(gruposMateria).sort((a, b) => a.localeCompare(b, "pt-BR"));
    const list: Caderno3DItem[] = [];

    let bookGlobalIndex = 0;

    matKeys.forEach((mat) => {
      const cadMap = gruposMateria[mat];
      const cadNames = Object.keys(cadMap).sort((a, b) => a.localeCompare(b, "pt-BR"));

      cadNames.forEach((cadName) => {
        const questList = cadMap[cadName];
        if (questList.length === 0) return;

        // Cria casos baseados em referência ou subdivisão
        const casoGroup: Caso3DGroup = {
          id: `caso-${mat}-${cadName}`,
          nome: cadName,
          questoes: questList,
        };

        const palette = BOOK_PALETTES[bookGlobalIndex % BOOK_PALETTES.length];
        const qCount = questList.length;

        // Distribuição orgânica 3D em semicírculo/arco ao redor da câmera
        // Raio do arco ~ 5.5 a 7.5 unidades
        const totalEstimate = 18; // estimado de livros visíveis por lote
        const angleStep = 0.38;
        const baseAngle = (bookGlobalIndex - totalEstimate / 2) * angleStep;

        const radius = 5.6 + (bookGlobalIndex % 3) * 0.7;
        const posX = Math.sin(baseAngle) * radius;
        const posZ = -Math.cos(baseAngle) * radius + 5.2 - (bookGlobalIndex % 2) * 0.9;
        const posY = ((bookGlobalIndex % 3) - 1) * 1.35 + Math.sin(bookGlobalIndex * 1.4) * 0.3;

        // Rotação voltada suavemente para a câmera
        const rotY = -baseAngle + (Math.random() - 0.5) * 0.15;
        const rotX = (Math.random() - 0.5) * 0.1;
        const rotZ = (Math.random() - 0.5) * 0.08;

        const cadernoItem: Caderno3DItem = {
          id: `caderno-${mat}-${cadName}`,
          nome: cadName,
          materia: mat,
          casos: [casoGroup],
          questoes: questList,
          coverColor: palette.bg,
          accentColor: palette.accent,
          goldTone: palette.goldTone,
          thickness: Math.min(0.65, Math.max(0.22, qCount * 0.007 + 0.18)),
          position: [posX, posY, posZ],
          rotation: [rotX, rotY, rotZ],
          floatSpeed: 0.6 + (bookGlobalIndex % 5) * 0.15,
          floatOffset: (bookGlobalIndex * 1.7) % (Math.PI * 2),
          floatAmplitude: 0.16 + (bookGlobalIndex % 3) * 0.05,
          rotationSpeed: 0.2 + (bookGlobalIndex % 4) * 0.1,
        };

        list.push(cadernoItem);
        bookGlobalIndex++;
      });
    });

    return { cadernos3D: list, materiasList: matKeys };
  }, [questions]);

  // Filtra cadernos pela matéria selecionada
  const filteredCadernos = useMemo(() => {
    if (selectedMateria === "todas") return cadernos3D;
    return cadernos3D.filter((c) => c.materia.toLowerCase() === selectedMateria.toLowerCase());
  }, [cadernos3D, selectedMateria]);

  // Resposta de questão
  const handleAnswerQuestion = async (
    questionId: string | number,
    answer: string,
    isCorrect: boolean
  ) => {
    const qidStr = String(questionId);
    setUserAnswers((prev) => {
      const old = prev[qidStr];
      return {
        ...prev,
        [qidStr]: {
          lastAnswer: answer,
          isCorrect,
          totalAttempts: (old?.totalAttempts || 0) + 1,
          errorCount: isCorrect ? old?.errorCount || 0 : (old?.errorCount || 0) + 1,
          correctCount: isCorrect ? (old?.correctCount || 0) + 1 : old?.correctCount || 0,
          timestamp: Date.now(),
        },
      };
    });

    if (user?.id) {
      try {
        const now = new Date();
        const dateStr = now.toISOString().split("T")[0];
        const timeStr = now.toTimeString().split(" ")[0];

        await supabase.from("historico_respostas").insert({
          questao_id: Number(questionId) || questionId,
          resposta_usuario: answer,
          correto: isCorrect,
          data: dateStr,
          horario: timeStr,
          User: user.id,
          status: isCorrect ? "acertou" : "errou",
        });
      } catch (err) {
        console.error("Erro ao salvar histórico:", err);
      }
    }
  };

  // Toggle de dúvida
  const handleToggleDuvida = async (questionId: string | number) => {
    const qidStr = String(questionId);
    const isDuv = duvidas.has(qidStr);

    setDuvidas((prev) => {
      const next = new Set(prev);
      if (isDuv) next.delete(qidStr);
      else next.add(qidStr);
      return next;
    });

    if (user?.id) {
      try {
        if (isDuv) {
          await supabase
            .from("duvidas")
            .delete()
            .eq("user_id", user.id)
            .eq("questao_id", Number(questionId) || questionId);
        } else {
          await supabase.from("duvidas").insert({
            user_id: user.id,
            questao_id: Number(questionId) || questionId,
          });
        }
      } catch (err) {
        console.error("Erro ao alternar dúvida:", err);
      }
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#080a0f] text-white font-sans select-none">
      {/* ── AMBIÊNCIA DE FUNDO: SALA DE ESTUDOS HISTÓRICA / BIBLIOTECA NOBRE ──── */}
      <div
        className="absolute inset-0 pointer-events-none -z-20 opacity-40 bg-cover bg-center"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 40%, rgba(30, 25, 20, 0.4) 0%, rgba(5, 7, 10, 0.98) 100%)",
        }}
      />

      {/* ── BARRA SUPERIOR ELEGANTE DA BIBLIOTECA ───────────────────────────── */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 md:px-8 py-3.5 bg-gradient-to-b from-black/80 via-black/40 to-transparent backdrop-blur-xs border-b border-amber-950/20">
        <div className="flex items-center gap-3">
          {/* Voltar ao Banco */}
          <button
            onClick={() => router.push("/banco")}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-stone-900/80 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700/60 shadow transition-all text-xs"
          >
            <ArrowLeft size={14} />
            <span>Voltar ao Banco</span>
          </button>

          <div className="h-4 w-[1px] bg-stone-700/50 hidden sm:block" />

          {/* Título & Identidade */}
          <div className="flex items-center gap-2.5">
            <span className="text-amber-400 text-lg">🏛️</span>
            <div>
              <h1 className="font-serif text-sm md:text-base font-bold tracking-wide text-amber-100 flex items-center gap-2">
                <span>Biblioteca 3D de Cadernos</span>
                <span className="text-[10px] font-sans font-normal uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Interativa
                </span>
              </h1>
              <p className="text-[11px] text-stone-400 font-serif hidden md:block">
                Passe o cursor sobre os livros ou clique para abrir e folhear as questões
              </p>
            </div>
          </div>
        </div>

        {/* Filtro de Matéria */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-900/80 border border-stone-700/60 text-xs">
            <Filter size={13} className="text-amber-400" />
            <select
              value={selectedMateria}
              onChange={(e) => setSelectedMateria(e.target.value)}
              className="bg-transparent text-stone-200 text-xs focus:outline-none cursor-pointer pr-2"
            >
              <option value="todas" className="bg-stone-900 text-white">
                Todas as Matérias ({cadernos3D.length} cadernos)
              </option>
              {materiasList.map((m) => (
                <option key={m} value={m} className="bg-stone-900 text-white">
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* ── CENA 3D THREE.JS COM LIVROS FLUTUANTES ──────────────────────────── */}
      {loading ? (
        <div className="w-full h-full flex flex-col items-center justify-center gap-3">
          <Loader2 size={32} className="animate-spin text-amber-400" />
          <p className="font-serif text-sm text-stone-400">
            Organizando os livros na biblioteca tridimensional...
          </p>
        </div>
      ) : (
        <Book3DScene
          cadernos={filteredCadernos}
          selectedCaderno={selectedCaderno}
          onSelectCaderno={(cad) => setSelectedCaderno(cad)}
          onHoverCaderno={(cad, pos) => {
            setHoveredCaderno(cad);
            if (pos) setHoverPos(pos);
          }}
        />
      )}

      {/* ── TOOLTIP HUD 3D DINÂMICO AO PASSAR O MOUSE NO LIVRO ─────────────── */}
      <AnimatePresence>
        {hoveredCaderno && !selectedCaderno && hoverPos && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="fixed pointer-events-none z-40 p-3.5 rounded-xl bg-stone-900/95 backdrop-blur-md border border-amber-500/30 shadow-[0_15px_35px_rgba(0,0,0,0.8)] text-white w-64"
            style={{
              left: Math.min(window.innerWidth - 270, hoverPos.x + 18),
              top: Math.min(window.innerHeight - 170, hoverPos.y - 40),
            }}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-serif text-amber-400 uppercase tracking-wider mb-1">
              <span>✦</span>
              <span>{hoveredCaderno.materia}</span>
            </div>

            <h3 className="font-serif font-bold text-sm text-stone-100 leading-snug mb-2">
              {hoveredCaderno.nome}
            </h3>

            <div className="grid grid-cols-2 gap-2 text-xs font-serif pt-2 border-t border-stone-800 text-stone-400">
              <div>
                <span className="block text-[10px] text-stone-500 uppercase">Questões</span>
                <span className="font-mono text-amber-300 font-bold">
                  {hoveredCaderno.questoes.length}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-stone-500 uppercase">Ação</span>
                <span className="text-[11px] text-stone-300 flex items-center gap-1">
                  <span>Clique p/ abrir</span>
                  <span className="text-amber-400">→</span>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEITOR DE LIVRO ABERTO 3D (QUANDO UM LIVRO É CLICADO) ──────────── */}
      <AnimatePresence>
        {selectedCaderno && (
          <OpenBookReader
            caderno={selectedCaderno}
            userAnswers={userAnswers}
            duvidas={duvidas}
            onClose={() => setSelectedCaderno(null)}
            onAnswer={handleAnswerQuestion}
            onToggleDuvida={handleToggleDuvida}
            isAdmin={isAdmin}
          />
        )}
      </AnimatePresence>

      {/* ── RODAPÉ SUTIL COM DICAS DE NAVEGAÇÃO ─────────────────────────────── */}
      <footer className="absolute bottom-3 inset-x-4 z-20 flex items-center justify-between text-[11px] text-stone-400 pointer-events-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="text-amber-400 font-bold">●</span>
            <span>{filteredCadernos.length} cadernos flutuando</span>
          </span>
          <span className="hidden sm:inline text-stone-600">|</span>
          <span className="hidden sm:inline">
            Clique em qualquer livro para aproximar e folhear as páginas
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-serif italic text-stone-400">EstudosApp 3D Library</span>
        </div>
      </footer>
    </div>
  );
}
