"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Loader2,
  BookMarked, RefreshCw, X, Check, Play, Eye, EyeOff,
  Triangle,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

const CATEGORIES = [
  { key: "bonus",     label: "Bônus",     emojis: ["🎉","🥳","🎊"],        icon: "🎉",  color: "#f59e0b", textColor: "#fbbf24", dot: false },
  { key: "faceis",    label: "Fáceis",    emojis: ["🟢","✅","💚","🍀"],   icon: null,  color: "#22c55e", textColor: "#4ade80", dot: true  },
  { key: "atencao",   label: "Atenção",   emojis: ["🔵","💙","🌀","🫐"],   icon: null,  color: "#3b82f6", textColor: "#60a5fa", dot: true  },
  { key: "lacuna",    label: "Lacuna",    emojis: ["🌱","🌿","🪴"],         icon: "🌱",  color: "#84cc16", textColor: "#a3e635", dot: false },
  { key: "media",     label: "Média",     emojis: ["🟡","💛","⭐","🌟","🟠","🧡"],   icon: null,  color: "#f97316", textColor: "#fb923c", dot: true  },
  { key: "dificil",   label: "Difícil",   emojis: ["🔴","❤️","💔","🔥"],   icon: null,  color: "#ef4444", textColor: "#f87171", dot: true  },
  { key: "ultrahard", label: "Ultrahard", emojis: ["🟣","💜","👾","🫀"],   icon: null,  color: "#a855f7", textColor: "#c084fc", dot: true  },
] as const;

type CategoryKey = typeof CATEGORIES[number]["key"];

const CATEGORY_ORDER: Record<CategoryKey, number> = {
  bonus: 1,
  faceis: 2,
  media: 3,
  atencao: 4,
  lacuna: 5,
  dificil: 6,
  ultrahard: 7,
};

interface NotionBlockRow {
  id: string; block_id: string; nome: string; descricao?: string; created_at: string;
}

interface RichText {
  plain_text: string;
  href?: string | null;
}

interface NotionAPIBlock {
  id: string; type: string; has_children: boolean;
  icon?: { type: "emoji" | "external" | "file"; emoji?: string };
  toggle?: { rich_text: RichText[] };
  paragraph?: { rich_text: RichText[] };
  image?: { type: "external" | "file"; external?: { url: string }; file?: { url: string } };
  [key: string]: any;
}

interface Questao {
  id: string;
  numero: string;
  topic: string;
  categoryKey: CategoryKey;
  imageUrls: string[];
  resposta?: string;
  respostaImageUrls: string[];
}

interface Caso {
  id: string;
  nome: string;
  questoes: Questao[];
}

function richText(rt: RichText[] = []) { return rt.map(r => r.plain_text).join(""); }
function imgUrl(b: NotionAPIBlock) {
  const img = b.image;
  if (!img) return undefined;
  return img.type === "external" ? img.external?.url : img.file?.url;
}

const ALL_EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1FFFF}\u{FE00}-\u{FEFF}][\uFE0F\u20E3]?/gu;

function parseQuestaoTitle(text: string): { emojis: string[]; numero: string; topic: string } {
  const t = text.trim();
  const emojis = [...t.matchAll(ALL_EMOJI_RE)].map(m => m[0]);
  const stripped = t.replace(ALL_EMOJI_RE, "").trim();
  const numM = stripped.match(/(\d+)/);
  const numero = numM ? numM[1] : "";
  const topic = numM ? stripped.slice(stripped.indexOf(numM[1]) + numM[1].length).trim() : stripped;
  return { emojis, numero, topic };
}

function detectCategory(emojis: string[]): CategoryKey | null {
  for (const emoji of emojis) {
    for (const cat of CATEGORIES) {
      if ((cat.emojis as readonly string[]).some(e => e === emoji || emoji.includes(e) || e.includes(emoji))) {
        return cat.key;
      }
    }
  }
  return null;
}

// Cache de respostas e in-flight deduplication — cada bloco é buscado só uma vez
const childrenCache = new Map<string, NotionAPIBlock[]>();
const childrenInFlight = new Map<string, Promise<NotionAPIBlock[]>>();

async function fetchChildren(blockId: string): Promise<NotionAPIBlock[]> {
  const clean = blockId.replace(/-/g, "");
  if (childrenCache.has(clean)) return childrenCache.get(clean)!;
  if (childrenInFlight.has(clean)) return childrenInFlight.get(clean)!;

  const req = fetch(`/api/notion/blocks/${clean}/children?page_size=100`)
    .then(async res => {
      if (!res.ok) throw new Error(`Notion ${res.status}`);
      const data: NotionAPIBlock[] = (await res.json()).results ?? [];
      childrenCache.set(clean, data);
      childrenInFlight.delete(clean);
      return data;
    })
    .catch(e => {
      childrenInFlight.delete(clean);
      throw e;
    });

  childrenInFlight.set(clean, req);
  return req;
}

function QuestaoRow({ questao, user }: { questao: Questao; user: any }) {
  const [open, setOpen] = useState(false);
  const [showResp, setShowResp] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [respostaImageUrls, setRespostaImageUrls] = useState<string[]>([]);
  const [respostaText, setRespostaText] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<'acerto' | 'erro' | null>(null);

  const handleRecordAnswer = async (isCorrect: boolean) => {
    if (!user) return;
    setRecording(true);
    setRecorded(null);
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8);

    try {
      const { error } = await supabase.from("historico_respostas").insert({
        questao_id: questao.id,
        resposta_usuario: isCorrect ? "Acerto" : "Erro",
        correto: isCorrect ? "Sim" : "Não",
        data: date,
        horario: time,
        status: isCorrect ? "Acertei" : "Errei",
        User: user.id,
      });
      if (error) throw error;
      setRecorded(isCorrect ? 'acerto' : 'erro');
      setTimeout(() => setRecorded(null), 3000);
    } catch (e: any) {
      console.error(e);
      alert("Erro ao salvar resposta: " + e.message);
    } finally {
      setRecording(false);
    }
  };

  const emojiMap: Record<CategoryKey, string> = {
    bonus: "🎉",
    faceis: "🟢",
    atencao: "🔵",
    lacuna: "🌱",
    media: "🟠",
    dificil: "🔴",
    ultrahard: "🟣",
  };

  const catEmoji = emojiMap[questao.categoryKey] || "🟢";
  const categoryInfo = CATEGORIES.find(c => c.key === questao.categoryKey);
  const catLabel = categoryInfo?.label || "Geral";
  const catColor = categoryInfo?.textColor || "#94a3b8";

  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (open && !loaded && !loading) {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          console.log(`[QuestaoRow DEBUG] Buscando filhos da questao ${questao.numero} (ID: ${questao.id})`);
          const children = await fetchChildren(questao.id);
          console.log(`[QuestaoRow DEBUG] Filhos recebidos para questao ${questao.numero}:`, children);

          const imgs: string[] = [];
          const rImgs: string[] = [];
          let textResp: string | undefined;

          for (const child of children) {
            if (child.type === "image") {
              const url = imgUrl(child);
              console.log(`[QuestaoRow DEBUG] Bloco de imagem detectado na questao ${questao.numero}:`, child, "URL:", url);
              if (url) imgs.push(url);
            } else if (child.type === "toggle") {
              const tText = richText(child.toggle?.rich_text ?? []).toLowerCase();
              if (tText.includes("resposta") && child.has_children) {
                console.log(`[QuestaoRow DEBUG] Toggle de resposta encontrado na questao ${questao.numero} (ID: ${child.id})`);
                const rChildren = await fetchChildren(child.id);
                console.log(`[QuestaoRow DEBUG] Filhos do toggle de resposta da questao ${questao.numero}:`, rChildren);
                const texts: string[] = [];
                for (const rc of rChildren) {
                  if (rc.type === "image") {
                    const url = imgUrl(rc);
                    console.log(`[QuestaoRow DEBUG] Bloco de imagem na resposta da questao ${questao.numero}:`, rc, "URL:", url);
                    if (url) rImgs.push(url);
                  } else {
                    const t = richText(rc.paragraph?.rich_text ?? rc.bulleted_list_item?.rich_text ?? rc.numbered_list_item?.rich_text ?? []);
                    if (t) texts.push(t);
                  }
                }
                textResp = texts.join("\n") || undefined;
              }
            }
          }
          if (active) {
            console.log(`[QuestaoRow DEBUG] Definindo dados da questao ${questao.numero}. Imagens:`, imgs, "Imagens Resposta:", rImgs);
            setImageUrls(imgs);
            setRespostaImageUrls(rImgs);
            setRespostaText(textResp);
            setLoaded(true);
          }
        } catch (e) {
          console.error("Erro ao carregar detalhes da questão:", e);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }
  }, [open, questao.id, loaded]);

  return (
    <div className="flex flex-col py-1">
      <div className="flex items-center gap-3 py-1 px-2 hover:bg-white/[0.03] transition-all rounded-md">
        <button
          onClick={() => { setOpen(v => !v); setShowResp(false); }}
          className="text-slate-500 hover:text-slate-300 transition-all w-4 h-4 flex items-center justify-center shrink-0"
        >
          {loading ? (
            <Loader2 size={10} className="animate-spin text-slate-500" />
          ) : (
            <span className="text-[10px] select-none">{open ? "▼" : "▶"}</span>
          )}
        </button>

        <span className="text-[12px] font-black text-slate-300 w-10 shrink-0 tabular-nums">{questao.numero}</span>

        <span className="text-sm shrink-0 select-none">{catEmoji}</span>

        <span
          className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] shrink-0"
          style={{ color: catColor }}
        >
          {catLabel}
        </span>

        {questao.topic && (
          <span className="text-[12px] text-slate-500 truncate ml-1">
            — {questao.topic}
          </span>
        )}
      </div>

      {open && (
        <div className="ml-6 pl-4 border-l border-white/[0.05] my-2 flex flex-col gap-3">
          {loading ? (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 italic py-2">
              <Loader2 size={12} className="animate-spin" />
              Carregando detalhes...
            </div>
          ) : (
            <>
              {imageUrls.length > 0 ? (
                imageUrls.map((url, i) => (
                  <img key={i} src={url} alt={`Q${questao.numero} img${i + 1}`} className="w-full max-w-2xl rounded-xl border border-white/[0.06] object-contain bg-white" />
                ))
              ) : (
                <p className="text-[11px] text-slate-700 italic">Sem imagem</p>
              )}

              <button
                onClick={() => setShowResp(v => !v)}
                className="flex items-center gap-2 self-start px-2.5 py-1 rounded-md border border-white/[0.07] bg-white/[0.03] text-slate-500 hover:text-emerald-400 hover:border-emerald-500/30 text-[10px] font-bold transition-all"
              >
                {showResp ? <EyeOff size={10} /> : <Eye size={10} />}
                {showResp ? "Ocultar Resposta" : "Ver Resposta"}
              </button>

              {showResp && (
                <div className="border border-emerald-500/20 rounded-xl p-4 bg-emerald-500/[0.03] flex flex-col gap-3">
                  {respostaImageUrls.map((url, i) => (
                    <img key={i} src={url} alt={`Resposta img${i + 1}`} className="w-full max-w-2xl rounded-xl border border-white/[0.06] object-contain bg-white" />
                  ))}
                  {respostaText ? (
                    <p className="text-[12px] text-slate-300 whitespace-pre-wrap leading-relaxed">{respostaText}</p>
                  ) : respostaImageUrls.length === 0 ? (
                    <p className="text-[11px] text-slate-600 italic">Sem resposta registrada.</p>
                  ) : null}

                  {user && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-emerald-500/10 shrink-0">
                      <span className="text-[10px] text-slate-500 font-bold mr-auto">Registrar tentativa:</span>
                      <button
                        onClick={() => handleRecordAnswer(true)}
                        disabled={recording}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95"
                      >
                        <Check size={11} /> Acertei
                      </button>
                      <button
                        onClick={() => handleRecordAnswer(false)}
                        disabled={recording}
                        className="flex items-center gap-1.5 px-3 py-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400 text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-50 active:scale-95"
                      >
                        <X size={11} /> Errei
                      </button>
                      {recorded && (
                        <span className={`text-[10px] font-black uppercase tracking-wider ml-1 animate-pulse ${recorded === 'acerto' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {recorded === 'acerto' ? 'Salvo! 🎉' : 'Salvo! ❌'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CasoCard({ caso, depth = 0, user }: { caso: Caso; depth?: number; user: any }) {
  const [open, setOpen] = useState(false);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [subcasos, setSubcasos] = useState<Caso[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && !loaded && !loading) {
      let active = true;
      (async () => {
        setLoading(true);
        try {
          const children = await fetchChildren(caso.id);
          const tempQuestoes: Questao[] = [];
          const tempSubcasos: Caso[] = [];

          for (const child of children) {
            if (child.type !== "toggle") continue;

            const rawTitle = richText(child.toggle?.rich_text ?? []);
            const { emojis: textEmojis, numero, topic } = parseQuestaoTitle(rawTitle);
            const iconEmoji = child.icon?.type === "emoji" && child.icon.emoji ? [child.icon.emoji] : [];
            const emojis = [...iconEmoji, ...textEmojis];
            const categoryKey = detectCategory(emojis);

            if (categoryKey) {
              // É uma questão com emoji de categoria
              tempQuestoes.push({ id: child.id, numero, topic, categoryKey, imageUrls: [], respostaImageUrls: [] });
            } else {
              // É um sub-caso (toggle sem emoji de categoria)
              tempSubcasos.push({ id: child.id, nome: rawTitle || "Sem nome", questoes: [] });
            }
          }

          if (active) {
            // Ordena as questões por nível de dificuldade (crescente)
            // Se empatar, ordena pelo número da questão
            tempQuestoes.sort((a, b) => {
              const valA = CATEGORY_ORDER[a.categoryKey] ?? 99;
              const valB = CATEGORY_ORDER[b.categoryKey] ?? 99;
              if (valA !== valB) return valA - valB;
              return parseInt(a.numero || "0", 10) - parseInt(b.numero || "0", 10);
            });

            setQuestoes(tempQuestoes);
            setSubcasos(tempSubcasos);
            setLoaded(true);

            // Prefetch em background para cada questão
            for (const q of tempQuestoes) {
              fetchChildren(q.id).then(children => {
                for (const child of children) {
                  if (child.type === "toggle") {
                    const tText = richText(child.toggle?.rich_text ?? []).toLowerCase();
                    if (tText.includes("resposta") && child.has_children) {
                      fetchChildren(child.id).catch(() => {});
                    }
                  }
                }
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.error("Erro ao carregar caso:", e);
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => { active = false; };
    }
  }, [open, caso.id, loaded]);

  const hasContent = questoes.length > 0 || subcasos.length > 0;
  const total = loaded ? (questoes.length + subcasos.length) || undefined : undefined;

  // Indentação progressiva por nível
  const indent = depth > 0 ? "pl-4 border-l border-white/[0.04] ml-3" : "";

  return (
    <div className={`flex flex-col gap-0.5 ${indent}`}>
      <div className="flex items-center justify-between py-1 px-2 hover:bg-white/[0.02] rounded-lg group">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 text-left flex-1"
        >
          <span className="text-[10px] text-slate-500 w-4 h-4 flex items-center justify-center shrink-0 select-none">
            {loading ? (
              <Loader2 size={10} className="animate-spin text-slate-500" />
            ) : (
              open ? "▼" : "▶"
            )}
          </span>
          <span className={`font-bold text-slate-300 group-hover:text-white transition-colors ${depth === 0 ? "text-[13px]" : "text-[12px]"}`}>
            {caso.nome}
          </span>
        </button>
        {total !== undefined && (
          <span className="text-[10px] font-bold text-slate-500 bg-white/[0.04] px-2 py-0.5 rounded-md tabular-nums shrink-0">
            {total}
          </span>
        )}
      </div>

      {open && (
        <div className="flex flex-col gap-0.5 pl-4 border-l border-white/[0.05] ml-4 my-0.5">
          {loading && !loaded ? (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 italic py-2">
              <Loader2 size={12} className="animate-spin" />
              Carregando...
            </div>
          ) : !hasContent ? (
            <div className="text-[11px] text-slate-600 italic py-1 px-2">Sem questões com emoji reconhecido.</div>
          ) : (
            <>
              {/* Sub-casos recursivos */}
              {subcasos.map(sub => (
                <CasoCard key={sub.id} caso={sub} depth={depth + 1} user={user} />
              ))}

              {/* Questões deste nível */}
              {questoes.map((q, idx) => (
                <div key={q.id} className={idx < questoes.length - 1 ? "border-b border-white/[0.06] pb-1 mb-1" : ""}>
                  <QuestaoRow questao={q} user={user} />
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BlockViewer({ block, user }: { block: NotionBlockRow; user: any }) {
  const [casos, setCasos] = useState<Caso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError("");
      try {
        const rootChildren = await fetchChildren(block.block_id);
        const built: Caso[] = [];

        for (const casoBlock of rootChildren) {
          const casoNome =
            richText(casoBlock.toggle?.rich_text) ||
            richText(casoBlock.heading_1?.rich_text) ||
            richText(casoBlock.heading_2?.rich_text) ||
            richText(casoBlock.heading_3?.rich_text) ||
            richText(casoBlock.paragraph?.rich_text) ||
            casoBlock.child_page?.title || "Sem nome";

          built.push({ id: casoBlock.id, nome: casoNome, questoes: [] });
        }

        if (!cancelled) setCasos(built);

        // Prefetch em background: busca os filhos de cada caso sem bloquear a UI
        // O cache garante que quando o usuário clicar já estará pronto
        for (const c of built) {
          fetchChildren(c.id).catch(() => {}); // fire-and-forget, erros ignorados
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [block.block_id]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      <p className="text-[10px] text-slate-700 font-black uppercase tracking-widest animate-pulse">Carregando casos...</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center py-10 gap-2">
      <p className="text-[11px] text-red-400">{error}</p>
      <p className="text-[10px] text-slate-600">Verifique se a integração Notion tem acesso a este bloco.</p>
    </div>
  );

  if (casos.length === 0) return <p className="text-[11px] text-slate-600 italic text-center py-10">Nenhum caso encontrado.</p>;

  return (
    <div className="flex flex-col gap-2 pl-4 border-l border-white/[0.03] ml-4 mt-1">
      {casos.map(caso => <CasoCard key={caso.id} caso={caso} user={user} />)}
    </div>
  );
}

function NotionBlockRowItem({
  block,
  user,
  onDelete
}: {
  block: NotionBlockRow;
  user: any;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [blockIcon, setBlockIcon] = useState<string>("📝");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const clean = block.block_id.replace(/-/g, "");
        const res = await fetch(`/api/notion/blocks/${clean}`);
        if (res.ok) {
          const data = await res.json();
          if (active && data.icon?.type === "emoji" && data.icon.emoji) {
            setBlockIcon(data.icon.emoji);
          }
        }
      } catch (e) {
        console.error("Erro ao carregar ícone do Notion:", e);
      }
    })();
    return () => { active = false; };
  }, [block.block_id]);

  return (
    <div className="py-1">
      <div className="flex items-center justify-between group">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-3 text-left py-1.5 px-2 hover:bg-white/[0.02] rounded-lg transition-all flex-1"
        >
          <span className="text-[10px] text-slate-500 w-4 h-4 flex items-center justify-center shrink-0 select-none">
            {open ? "▼" : "▶"}
          </span>
          <span className="text-base shrink-0 select-none">{blockIcon}</span>
          <span className="text-[14px] font-bold text-slate-200 group-hover:text-white transition-colors">
            {block.nome}
          </span>
          {block.descricao && (
            <span className="text-[11px] text-slate-500 truncate">— {block.descricao}</span>
          )}
        </button>

        {user && (
          <button
            onClick={() => onDelete(block.id)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 mr-2 shrink-0"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {open && (
        <div className="pl-6 border-l border-white/[0.03] ml-5 mt-1 mb-2">
          <BlockViewer block={block} user={user} />
        </div>
      )}
    </div>
  );
}

export default function NotionQuestionTab({ user }: { user: any }) {
  const [blocks, setBlocks] = useState<NotionBlockRow[]>([]);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [formId, setFormId] = useState(""); const [formNome, setFormNome] = useState(""); const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false); const [saveErr, setSaveErr] = useState("");

  const fetchBlocks = useCallback(async () => {
    setLoadingBlocks(true);
    try {
      const { data, error } = await supabase.from("notion_blocks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setBlocks(data ?? []);
    } catch (e: any) { console.error(e.message); }
    finally { setLoadingBlocks(false); }
  }, []);

  useEffect(() => { fetchBlocks(); }, []);

  const handleSave = async () => {
    if (!formId.trim() || !formNome.trim()) { setSaveErr("Preencha o ID e o nome."); return; }
    setSaving(true); setSaveErr("");
    try {
      const raw = formId.trim().replace(/-/g, "");
      const notionId = raw.length === 32
        ? `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`
        : formId.trim();
      const { error } = await supabase.from("notion_blocks").insert({ block_id: notionId, nome: formNome.trim(), descricao: formDesc.trim() || null });
      if (error) throw error;
      setFormId(""); setFormNome(""); setFormDesc(""); setShowForm(false);
      await fetchBlocks();
    } catch (e: any) { setSaveErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover?")) return;
    await supabase.from("notion_blocks").delete().eq("id", id);
    await fetchBlocks();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <BookMarked size={15} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white">Notion Question</h2>
            <p className="text-[10px] text-slate-600 font-bold">Questões agrupadas por emoji</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchBlocks} className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/[0.06] text-slate-600 hover:text-blue-400 transition-all">
            <RefreshCw size={13} className={loadingBlocks ? "animate-spin" : ""} />
          </button>
          {user && (
            <button onClick={() => setShowForm(v => !v)} className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95">
              <Plus size={12} /> Novo Bloco
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="border border-indigo-500/20 rounded-2xl bg-indigo-500/[0.03] p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-indigo-300 uppercase tracking-widest">Cadastrar Bloco Notion</p>
            <button onClick={() => setShowForm(false)} className="text-slate-600 hover:text-slate-400"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ID do Bloco *</label>
              <input value={formId} onChange={e => setFormId(e.target.value)} placeholder="abc12345-..." className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40 transition-all font-mono" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nome *</label>
              <input value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Ex: Caderno Azul" className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40 transition-all" />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Descrição (opcional)</label>
              <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Ex: Matemática — BB 2024" className="px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl text-[12px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-indigo-500/40 transition-all" />
            </div>
          </div>
          {saveErr && <p className="text-[11px] text-red-400 font-bold">{saveErr}</p>}
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="px-4 py-1.5 rounded-xl text-[11px] font-black text-slate-500 hover:text-slate-300 transition-all">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Salvar
            </button>
          </div>
        </div>
      )}

      {loadingBlocks ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 text-indigo-500 animate-spin" /></div>
      ) : blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <BookMarked size={32} className="text-slate-800" />
          <p className="text-[12px] font-black text-slate-600 uppercase tracking-widest">Nenhum bloco cadastrado</p>
          <p className="text-[11px] text-slate-700 max-w-xs">Clique em "Novo Bloco" para cadastrar o ID de um bloco do Notion.</p>
        </div>
      ) : (
        <div className="flex flex-col border border-white/[0.06] rounded-xl bg-white/[0.01] p-2 divide-y divide-white/[0.05]">
          {blocks.map(block => (
            <NotionBlockRowItem
              key={block.id}
              block={block}
              user={user}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
