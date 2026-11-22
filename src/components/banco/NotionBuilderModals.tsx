"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Loader2,
  Check,
  Image as ImageIcon,
  Upload,
  FolderPlus,
  FolderInput,
  CornerDownRight,
  FileText,
  Sparkles,
  Link2,
  Trash2,
} from "lucide-react";
import {
  BuilderCategoryKey,
  CasoTreeNode,
  cleanBlockId,
  createCasoOrSubcaso,
  fetchCadernoCasoTree,
  moveQuestaoToCaso,
  saveQuestaoToCaso,
  uploadNotionImageFile,
} from "../../lib/notionLocalBuilder";

const MODAL_CATEGORIES: Array<{
  key: BuilderCategoryKey;
  label: string;
  emoji: string;
  color: string;
}> = [
  { key: "faceis", label: "Fáceis", emoji: "🟢", color: "#16a34a" },
  { key: "media", label: "Média", emoji: "🟠", color: "#ea580c" },
  { key: "atencao", label: "Atenção", emoji: "🔵", color: "#2563eb" },
  { key: "lacuna", label: "Lacuna", emoji: "⛳", color: "#65a30d" },
  { key: "dificil", label: "Difícil", emoji: "🔴", color: "#dc2626" },
  { key: "ultrahard", label: "Ultrahard", emoji: "🟣", color: "#9333ea" },
  { key: "bonus", label: "Bônus", emoji: "🎉", color: "#d97706" },
  { key: "dominada", label: "Dominada", emoji: "🏆", color: "#0f766e" },
  { key: "treinar", label: "Treinar", emoji: "🧠", color: "#0891b2" },
  { key: "revisar", label: "Revisar", emoji: "🔁", color: "#d97706" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Zona reutilizável de upload / Ctrl+V / URL de imagens
// ─────────────────────────────────────────────────────────────────────────────
function ImageAttachmentZone({
  label,
  urls,
  onChange,
  prefix,
  accentColor = "indigo",
}: {
  label: string;
  urls: string[];
  onChange: (next: string[]) => void;
  prefix: string;
  accentColor?: "indigo" | "emerald";
}) {
  const [uploading, setUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setUploading(true);
    setErr(null);
    try {
      const uploaded: string[] = [];
      for (const file of imageFiles) {
        const url = await uploadNotionImageFile(file, prefix);
        uploaded.push(url);
      }
      onChange([...urls, ...uploaded]);
    } catch (e: any) {
      setErr(e?.message || "Falha ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      await handleFiles(files);
    }
  };

  const handleAddUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onChange([...urls, trimmed]);
    setUrlInput("");
  };

  const borderAccent =
    accentColor === "emerald"
      ? "border-emerald-500/30 hover:border-emerald-400/50 focus-within:border-emerald-400/60"
      : "border-indigo-500/30 hover:border-indigo-400/50 focus-within:border-indigo-400/60";

  return (
    <div className="flex flex-col gap-2" onPaste={handlePaste}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <ImageIcon size={11} className={accentColor === "emerald" ? "text-emerald-400" : "text-indigo-400"} />
          {label}
        </span>
        {urls.length > 0 && (
          <span className="text-[10px] text-slate-500 tabular-nums">
            {urls.length} {urls.length === 1 ? "imagem" : "imagens"}
          </span>
        )}
      </div>

      {/* Drop / Paste / Click Zone */}
      <div
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer?.files?.length) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-1.5 px-3 py-3 rounded-xl border border-dashed cursor-pointer transition-all outline-none ${borderAccent} ${
          dragOver ? "bg-indigo-500/15" : "bg-[#0a0f1d] hover:bg-white/[0.02]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              void handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />
        {uploading ? (
          <div className="flex items-center gap-2 text-xs text-indigo-300 py-1">
            <Loader2 size={14} className="animate-spin" />
            <span>Enviando imagem para o Supabase...</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
              <Upload size={13} className={accentColor === "emerald" ? "text-emerald-400" : "text-indigo-400"} />
              <span>Clique para enviar, arraste ou cole um print (<kbd className="px-1 py-0.5 rounded bg-white/10 text-[10px] font-mono">Ctrl+V</kbd>)</span>
            </div>
            <span className="text-[10px] text-slate-500">PNG, JPG, WebP — armazenada permanentemente</span>
          </>
        )}
      </div>

      {/* Campo de URL alternativa */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Link2 size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            placeholder="Ou cole a URL da imagem (https://...)"
            className="w-full pl-7 pr-2.5 py-1.5 bg-[#0a0f1d] border border-white/[0.08] rounded-lg text-[11px] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 font-mono"
          />
        </div>
        <button
          type="button"
          onClick={handleAddUrl}
          disabled={!urlInput.trim()}
          className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] disabled:opacity-40 text-[10px] font-bold text-slate-300 border border-white/[0.08] transition-all shrink-0"
        >
          + URL
        </button>
      </div>

      {err && <p className="text-[11px] text-rose-400">{err}</p>}

      {/* Previews */}
      {urls.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
          {urls.map((u, idx) => (
            <div
              key={`${u}-${idx}`}
              className="relative group rounded-xl overflow-hidden border border-white/[0.08] bg-[#080d18] aspect-video flex items-center justify-center"
            >
              <img src={u} alt={`Preview ${idx + 1}`} className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => onChange(urls.filter((_, i) => i !== idx))}
                title="Remover imagem"
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/80 hover:bg-rose-600 text-white flex items-center justify-center border border-white/20 transition-all"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Modal Criar Caso / Subcaso
// ─────────────────────────────────────────────────────────────────────────────
export function CreateCasoModal({
  isOpen,
  onClose,
  rootBlockId,
  parentBlockId,
  parentNome,
  isSubcaso = false,
  existingCasos,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  rootBlockId: string;
  parentBlockId: string;
  parentNome: string;
  isSubcaso?: boolean;
  existingCasos?: { id: string; nome: string }[];
  onCreated: (created: { id: string; nome: string }) => void;
}) {
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNome("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setError("Digite um nome.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await createCasoOrSubcaso({
        rootBlockId,
        parentBlockId,
        nome: nome.trim(),
        isRootCaso: !isSubcaso,
        existingCasos,
      });
      onCreated({ id: res.id, nome: res.nome });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao criar.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-[#0d1220] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <FolderPlus size={15} className="text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white">
                {isSubcaso ? "Novo Subcaso" : "Novo Caso"}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Dentro de: <span className="text-indigo-300 font-medium">{parentNome}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-white/[0.05]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              {isSubcaso ? "Nome do Subcaso *" : "Nome do Caso *"}
            </label>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder={
                isSubcaso
                  ? "Ex: Subcaso 1 - Casos especiais"
                  : "Ex: Caso 5 - Taxa proporcional"
              }
              className="px-3.5 py-2.5 bg-[#080d18] border border-white/[0.1] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/60"
            />
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/[0.06] bg-white/[0.01]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? "Salvando..." : isSubcaso ? "Criar Subcaso" : "Criar Caso"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Modal Criar / Editar Questão (com Caso, Subcaso, Imagens, Texto e Resposta)
// ─────────────────────────────────────────────────────────────────────────────
export interface QuestaoInitialEdit {
  id: string;
  rootBlockId: string;
  casoId: string;
  casoNome: string;
  numero: string;
  topic: string;
  categoryKey: BuilderCategoryKey;
  enunciadoTexto?: string;
  imageUrls: string[];
  resposta?: string;
  respostaImageUrls: string[];
}

export function QuestaoBuilderModal({
  isOpen,
  onClose,
  blocks,
  defaultRootBlockId,
  defaultCasoId,
  editingQuestao,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  blocks: { id: string; block_id: string; nome: string; materia?: string }[];
  defaultRootBlockId?: string;
  defaultCasoId?: string;
  editingQuestao?: QuestaoInitialEdit | null;
  onSaved: (res: { id: string; rootBlockId: string; targetCasoId: string }) => void;
}) {
  const [selectedRootId, setSelectedRootId] = useState<string>("");
  const [tree, setTree] = useState<CasoTreeNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);

  const [selectedCasoId, setSelectedCasoId] = useState<string>("");
  const [selectedSubcasoId, setSelectedSubcasoId] = useState<string>("");

  // Criação inline de Caso / Subcaso dentro do modal
  const [creatingCaso, setCreatingCaso] = useState(false);
  const [novoCasoNome, setNovoCasoNome] = useState("");
  const [savingCaso, setSavingCaso] = useState(false);

  const [creatingSubcaso, setCreatingSubcaso] = useState(false);
  const [novoSubcasoNome, setNovoSubcasoNome] = useState("");
  const [savingSubcaso, setSavingSubcaso] = useState(false);

  // Campos da questão
  const [numero, setNumero] = useState("1");
  const [topico, setTopico] = useState("");
  const [categoria, setCategoria] = useState<BuilderCategoryKey>("faceis");
  const [enunciadoTexto, setEnunciadoTexto] = useState("");
  const [imagensUrls, setImagensUrls] = useState<string[]>([]);
  const [gabaritoTexto, setGabaritoTexto] = useState("");
  const [gabaritoImagensUrls, setGabaritoImagensUrls] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTree = useCallback(async (rootId: string, preferredTargetId?: string) => {
    if (!rootId) {
      setTree([]);
      return;
    }
    setLoadingTree(true);
    try {
      const nodes = await fetchCadernoCasoTree(rootId);
      setTree(nodes);

      // Encontra se preferredTargetId é um Caso raiz ou um Subcaso
      if (preferredTargetId) {
        const targetClean = cleanBlockId(preferredTargetId);
        let matchedCaso = "";
        let matchedSub = "";

        for (const c of nodes) {
          if (cleanBlockId(c.id) === targetClean) {
            matchedCaso = c.id;
            break;
          }
          const findSub = (subs: CasoTreeNode[]): string | null => {
            for (const s of subs) {
              if (cleanBlockId(s.id) === targetClean) return s.id;
              const deeper = findSub(s.subcasos);
              if (deeper) return deeper;
            }
            return null;
          };
          const foundSub = findSub(c.subcasos);
          if (foundSub) {
            matchedCaso = c.id;
            matchedSub = foundSub;
            break;
          }
        }

        if (matchedCaso) {
          setSelectedCasoId(matchedCaso);
          setSelectedSubcasoId(matchedSub);
          return;
        }
      }

      if (nodes.length > 0) {
        setSelectedCasoId((prev) =>
          nodes.some((n) => cleanBlockId(n.id) === cleanBlockId(prev)) ? prev : nodes[0].id
        );
      } else {
        setSelectedCasoId("");
      }
      setSelectedSubcasoId("");
    } finally {
      setLoadingTree(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setCreatingCaso(false);
    setCreatingSubcaso(false);

    if (editingQuestao) {
      setSelectedRootId(editingQuestao.rootBlockId);
      setNumero(editingQuestao.numero || "1");
      setTopico(editingQuestao.topic || "");
      setCategoria(editingQuestao.categoryKey || "faceis");
      setEnunciadoTexto(editingQuestao.enunciadoTexto || "");
      setImagensUrls(editingQuestao.imageUrls || []);
      setGabaritoTexto(editingQuestao.resposta || "");
      setGabaritoImagensUrls(editingQuestao.respostaImageUrls || []);
      void loadTree(editingQuestao.rootBlockId, editingQuestao.casoId);
    } else {
      const initialRoot =
        defaultRootBlockId || blocks[0]?.block_id || "";
      setSelectedRootId(initialRoot);
      setNumero("1");
      setTopico("");
      setCategoria("faceis");
      setEnunciadoTexto("");
      setImagensUrls([]);
      setGabaritoTexto("");
      setGabaritoImagensUrls([]);
      if (initialRoot) {
        void loadTree(initialRoot, defaultCasoId);
      }
    }
  }, [isOpen, editingQuestao, defaultRootBlockId, defaultCasoId, blocks, loadTree]);

  const selectedCasoNode = tree.find(
    (c) => cleanBlockId(c.id) === cleanBlockId(selectedCasoId)
  );

  // Achata subcasos do caso selecionado (suportando múltiplos níveis)
  const flatSubcasos: Array<{ id: string; nome: string; depth: number }> = [];
  if (selectedCasoNode) {
    const collectSubs = (nodes: CasoTreeNode[], d: number) => {
      for (const n of nodes) {
        flatSubcasos.push({ id: n.id, nome: n.nome, depth: d });
        collectSubs(n.subcasos, d + 1);
      }
    };
    collectSubs(selectedCasoNode.subcasos, 1);
  }

  const handleInlineCreateCaso = async () => {
    if (!selectedRootId || !novoCasoNome.trim()) return;
    setSavingCaso(true);
    setError(null);
    try {
      const created = await createCasoOrSubcaso({
        rootBlockId: selectedRootId,
        parentBlockId: selectedRootId,
        nome: novoCasoNome.trim(),
        isRootCaso: true,
        existingCasos: tree.map((c) => ({ id: c.id, nome: c.nome })),
      });
      setNovoCasoNome("");
      setCreatingCaso(false);
      await loadTree(selectedRootId, created.id);
    } catch (e: any) {
      setError(e?.message || "Erro ao criar caso.");
    } finally {
      setSavingCaso(false);
    }
  };

  const handleInlineCreateSubcaso = async () => {
    if (!selectedRootId || !selectedCasoId || !novoSubcasoNome.trim()) return;
    setSavingSubcaso(true);
    setError(null);
    try {
      const parentForSub = selectedSubcasoId || selectedCasoId;
      const created = await createCasoOrSubcaso({
        rootBlockId: selectedRootId,
        parentBlockId: parentForSub,
        nome: novoSubcasoNome.trim(),
        isRootCaso: false,
      });
      setNovoSubcasoNome("");
      setCreatingSubcaso(false);
      await loadTree(selectedRootId, created.id);
    } catch (e: any) {
      setError(e?.message || "Erro ao criar subcaso.");
    } finally {
      setSavingSubcaso(false);
    }
  };

  const handleQuickGabarito = (val: string) => {
    const prefix = val.length === 1 ? `Letra ${val}` : val;
    setGabaritoTexto((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return prefix;
      const cleaned = trimmed.replace(/^(Letra [A-E]|Certo|Errado)\s*(\n+)?/i, "").trim();
      return cleaned ? `${prefix}\n\n${cleaned}` : prefix;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRootId) {
      setError("Selecione um caderno.");
      return;
    }
    if (!selectedCasoId) {
      setError("Crie ou selecione um Caso antes de salvar a questão.");
      return;
    }
    if (
      !enunciadoTexto.trim() &&
      imagensUrls.length === 0 &&
      !topico.trim() &&
      !gabaritoTexto.trim() &&
      gabaritoImagensUrls.length === 0
    ) {
      setError("Adicione uma imagem, um texto de enunciado ou uma resposta para salvar.");
      return;
    }

    const subNode = flatSubcasos.find(
      (s) => cleanBlockId(s.id) === cleanBlockId(selectedSubcasoId)
    );
    const targetCasoId = subNode ? subNode.id : selectedCasoId;
    const targetCasoNome = subNode
      ? `${selectedCasoNode?.nome || "Caso"} › ${subNode.nome}`
      : selectedCasoNode?.nome || "Geral";

    setSaving(true);
    setError(null);
    try {
      const res = await saveQuestaoToCaso({
        id: editingQuestao?.id,
        rootBlockId: selectedRootId,
        targetCasoId,
        targetCasoNome,
        oldCasoId: editingQuestao?.casoId,
        numero: numero.trim() || "1",
        topico: topico.trim(),
        categoria,
        enunciadoTexto,
        imagensUrls,
        gabaritoTexto,
        gabaritoImagensUrls,
      });
      onSaved({ id: res.id, rootBlockId: selectedRootId, targetCasoId });
      onClose();
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar questão.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl max-h-[92vh] bg-[#0d1220] border border-white/[0.12] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <FileText size={15} className="text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white tracking-tight">
                {editingQuestao ? "Editar Questão" : "Nova Questão no Caderno"}
              </h3>
              <p className="text-[11px] text-slate-400">
                Escolha Caso/Subcaso, anexe imagem ou escreva a pergunta e coloque a resposta.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 p-1.5 rounded-lg hover:bg-white/[0.05]"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar flex flex-col gap-5">
          {/* Bloco 1: Onde salvar (Caderno -> Caso -> Subcaso) */}
          <div className="p-4 rounded-2xl bg-[#101627] border border-white/[0.07] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
                1. Onde guardar (Caderno / Caso / Subcaso)
              </span>
              {loadingTree && <Loader2 size={12} className="animate-spin text-indigo-400" />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Caderno */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Caderno
                </label>
                <select
                  value={selectedRootId}
                  onChange={(e) => {
                    const nextRoot = e.target.value;
                    setSelectedRootId(nextRoot);
                    setSelectedCasoId("");
                    setSelectedSubcasoId("");
                    void loadTree(nextRoot);
                  }}
                  className="px-2.5 py-2 bg-[#080d18] border border-white/[0.1] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50"
                >
                  {blocks.map((b) => (
                    <option key={b.id} value={b.block_id}>
                      {b.nome} {b.materia ? `(${b.materia})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Caso */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Caso *
                  </label>
                  <button
                    type="button"
                    onClick={() => setCreatingCaso((v) => !v)}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                  >
                    <Plus size={10} /> Novo Caso
                  </button>
                </div>
                <select
                  value={selectedCasoId}
                  onChange={(e) => {
                    setSelectedCasoId(e.target.value);
                    setSelectedSubcasoId("");
                  }}
                  className="px-2.5 py-2 bg-[#080d18] border border-white/[0.1] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50"
                >
                  {tree.length === 0 ? (
                    <option value="">Nenhum caso ainda</option>
                  ) : (
                    tree.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))
                  )}
                </select>
                {creatingCaso && (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      value={novoCasoNome}
                      onChange={(e) => setNovoCasoNome(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleInlineCreateCaso();
                        }
                      }}
                      placeholder="Nome do novo caso..."
                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#080d18] border border-indigo-500/40 rounded-lg text-[11px] text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleInlineCreateCaso}
                      disabled={savingCaso || !novoCasoNome.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-bold"
                    >
                      {savingCaso ? "..." : "Criar"}
                    </button>
                  </div>
                )}
              </div>

              {/* Subcaso (opcional) */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Subcaso (opcional)
                  </label>
                  {selectedCasoId && (
                    <button
                      type="button"
                      onClick={() => setCreatingSubcaso((v) => !v)}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
                    >
                      <Plus size={10} /> Novo Subcaso
                    </button>
                  )}
                </div>
                <select
                  value={selectedSubcasoId}
                  disabled={!selectedCasoId}
                  onChange={(e) => setSelectedSubcasoId(e.target.value)}
                  className="px-2.5 py-2 bg-[#080d18] border border-white/[0.1] rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500/50 disabled:opacity-40"
                >
                  <option value="">Direto no Caso (sem subcaso)</option>
                  {flatSubcasos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {"↳ ".repeat(s.depth)}
                      {s.nome}
                    </option>
                  ))}
                </select>
                {creatingSubcaso && selectedCasoId && (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      value={novoSubcasoNome}
                      onChange={(e) => setNovoSubcasoNome(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleInlineCreateSubcaso();
                        }
                      }}
                      placeholder="Nome do novo subcaso..."
                      className="flex-1 min-w-0 px-2.5 py-1.5 bg-[#080d18] border border-indigo-500/40 rounded-lg text-[11px] text-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleInlineCreateSubcaso}
                      disabled={savingSubcaso || !novoSubcasoNome.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-bold"
                    >
                      {savingSubcaso ? "..." : "Criar"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bloco 2: Número, Tópico e Classificação */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Número
                </label>
                <input
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ex: 1"
                  className="px-3 py-2 bg-[#080d18] border border-white/[0.1] rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/50 tabular-nums"
                />
              </div>
              <div className="flex flex-col gap-1 sm:col-span-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Tópico / Título curto (opcional)
                </label>
                <input
                  value={topico}
                  onChange={(e) => setTopico(e.target.value)}
                  placeholder="Ex: Banca CESGRANRIO — Juros simples"
                  className="px-3 py-2 bg-[#080d18] border border-white/[0.1] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Classificação / Dificuldade
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {MODAL_CATEGORIES.map((cat) => {
                  const active = categoria === cat.key;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategoria(cat.key)}
                      style={{
                        borderColor: active ? cat.color : "rgba(255,255,255,0.08)",
                        backgroundColor: active ? `${cat.color}25` : "#080d18",
                        color: active ? "#ffffff" : "#94a3b8",
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all active:scale-95"
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bloco 3: Pergunta (Texto + Imagens) */}
          <div className="p-4 rounded-2xl bg-[#101627] border border-white/[0.07] flex flex-col gap-3">
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">
              2. Pergunta (Escreva e/ou anexe imagem)
            </span>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Texto da Pergunta (opcional)
              </label>
              <textarea
                value={enunciadoTexto}
                onChange={(e) => setEnunciadoTexto(e.target.value)}
                rows={4}
                placeholder="Digite o enunciado da questão, alternativas A–E ou anotações..."
                className="w-full px-3 py-2.5 bg-[#080d18] border border-white/[0.1] rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 leading-relaxed resize-y"
              />
            </div>

            <ImageAttachmentZone
              label="Imagem(ns) da Pergunta (opcional)"
              urls={imagensUrls}
              onChange={setImagensUrls}
              prefix="pergunta"
              accentColor="indigo"
            />
          </div>

          {/* Bloco 4: Resposta / Gabarito */}
          <div className="p-4 rounded-2xl bg-[#0e1722] border border-emerald-500/20 flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={11} /> 3. Resposta e Gabarito
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {["A", "B", "C", "D", "E", "Certo", "Errado"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleQuickGabarito(opt)}
                    className="px-2 py-0.5 rounded-md bg-white/[0.04] hover:bg-emerald-500/20 border border-white/[0.08] hover:border-emerald-500/40 text-[10px] font-bold text-slate-300 hover:text-emerald-300 transition-all"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Resposta / Comentário escrito (opcional)
              </label>
              <textarea
                value={gabaritoTexto}
                onChange={(e) => setGabaritoTexto(e.target.value)}
                rows={3}
                placeholder="Ex: Letra B — Fórmula J = C · i · t..."
                className="w-full px-3 py-2.5 bg-[#080d18] border border-white/[0.1] rounded-xl text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500/50 leading-relaxed resize-y"
              />
            </div>

            <ImageAttachmentZone
              label="Imagem(ns) da Resposta / Resolução (opcional)"
              urls={gabaritoImagensUrls}
              onChange={setGabaritoImagensUrls}
              prefix="resposta"
              accentColor="emerald"
            />
          </div>

          {error && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-950/50 border border-rose-500/30 text-xs text-rose-300">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-white/[0.08] bg-white/[0.01] shrink-0">
          <span className="text-[10px] text-slate-500 hidden sm:inline">
            Dica: você pode colar prints direto com Ctrl+V nas áreas de imagem.
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {saving ? "Salvando..." : editingQuestao ? "Salvar Alterações" : "Criar Questão"}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Modal Jogar / Mover Questão para Caso ou Subcaso
// ─────────────────────────────────────────────────────────────────────────────
export function MoveQuestaoModal({
  isOpen,
  onClose,
  rootBlockId,
  fromCasoId,
  questao,
  onMoved,
}: {
  isOpen: boolean;
  onClose: () => void;
  rootBlockId: string;
  fromCasoId: string;
  questao: {
    id: string;
    numero: string;
    topic: string;
    categoryKey: BuilderCategoryKey;
    enunciadoTexto?: string;
    imageUrls: string[];
    resposta?: string;
    respostaImageUrls: string[];
  } | null;
  onMoved: () => void;
}) {
  const [tree, setTree] = useState<CasoTreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [targetName, setTargetName] = useState("");
  const [newSubName, setNewSubName] = useState("");
  const [subParentId, setSubParentId] = useState("");
  const [creatingSub, setCreatingSub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!rootBlockId) return;
    setLoading(true);
    try {
      const nodes = await fetchCadernoCasoTree(rootBlockId);
      setTree(nodes);
    } finally {
      setLoading(false);
    }
  }, [rootBlockId]);

  useEffect(() => {
    if (isOpen) {
      setTargetId(fromCasoId);
      setTargetName("");
      setNewSubName("");
      setSubParentId("");
      setError(null);
      void load();
    }
  }, [isOpen, fromCasoId, load]);

  if (!isOpen || !questao || typeof document === "undefined") return null;

  const flatList: Array<{ id: string; nome: string; fullPath: string; depth: number }> = [];
  const walkFlat = (nodes: CasoTreeNode[], depth: number, prefix: string) => {
    for (const n of nodes) {
      const fullPath = prefix ? `${prefix} › ${n.nome}` : n.nome;
      flatList.push({ id: n.id, nome: n.nome, fullPath, depth });
      walkFlat(n.subcasos, depth + 1, fullPath);
    }
  };
  walkFlat(tree, 0, "");

  const handleCreateSubAndSelect = async () => {
    const parentId = subParentId || targetId || tree[0]?.id;
    if (!parentId || !newSubName.trim()) return;
    setCreatingSub(true);
    setError(null);
    try {
      const created = await createCasoOrSubcaso({
        rootBlockId,
        parentBlockId: parentId,
        nome: newSubName.trim(),
        isRootCaso: false,
      });
      const parentEntry = flatList.find((x) => cleanBlockId(x.id) === cleanBlockId(parentId));
      setTargetId(created.id);
      setTargetName(parentEntry ? `${parentEntry.fullPath} › ${created.nome}` : created.nome);
      setNewSubName("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Erro ao criar subcaso.");
    } finally {
      setCreatingSub(false);
    }
  };

  const handleConfirmMove = async () => {
    if (!targetId || cleanBlockId(targetId) === cleanBlockId(fromCasoId)) {
      onClose();
      return;
    }
    const chosen = flatList.find((x) => cleanBlockId(x.id) === cleanBlockId(targetId));
    setSaving(true);
    setError(null);
    try {
      await moveQuestaoToCaso({
        rootBlockId,
        questao,
        fromCasoId,
        toCasoId: targetId,
        toCasoNome: chosen?.fullPath || targetName || "Subcaso",
      });
      onMoved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Erro ao mover questão.");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-[#0d1220] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <FolderInput size={15} className="text-indigo-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white">Jogar Questão em Caso / Subcaso</h3>
              <p className="text-[11px] text-slate-400 truncate">
                Questão {questao.numero} {questao.topic ? `— ${questao.topic}` : ""}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 p-1 rounded-lg">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-xs text-slate-400">
              <Loader2 size={14} className="animate-spin text-indigo-400" /> Carregando casos e subcasos...
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Selecione o destino (Caso ou Subcaso)
              </span>
              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto pr-1">
                {flatList.map((item) => {
                  const isCurrent = cleanBlockId(item.id) === cleanBlockId(fromCasoId);
                  const isSelected = cleanBlockId(item.id) === cleanBlockId(targetId);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setTargetId(item.id);
                        setTargetName(item.fullPath);
                        setSubParentId(item.id);
                      }}
                      style={{ paddingLeft: `${12 + item.depth * 18}px` }}
                      className={`flex items-center justify-between gap-2 pr-3 py-2 rounded-xl border text-left text-xs transition-all ${
                        isSelected
                          ? "bg-indigo-600/20 border-indigo-500/50 text-white font-semibold"
                          : "bg-white/[0.02] border-white/[0.06] text-slate-300 hover:bg-white/[0.05]"
                      }`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0 truncate">
                        {item.depth > 0 && (
                          <CornerDownRight size={12} className="text-indigo-400 shrink-0" />
                        )}
                        <span className="truncate">{item.nome}</span>
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] uppercase font-bold text-slate-500 shrink-0">
                          Atual
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Criar Subcaso rápido */}
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07] flex flex-col gap-2">
            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
              Ou criar um novo Subcaso dentro do item selecionado:
            </span>
            <div className="flex items-center gap-2">
              <input
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleCreateSubAndSelect();
                  }
                }}
                placeholder="Nome do novo subcaso..."
                className="flex-1 px-3 py-1.5 bg-[#080d18] border border-white/[0.1] rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50"
              />
              <button
                type="button"
                onClick={handleCreateSubAndSelect}
                disabled={creatingSub || !newSubName.trim()}
                className="px-3 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-40 text-white text-[11px] font-bold flex items-center gap-1 shrink-0"
              >
                {creatingSub ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                Criar Subcaso
              </button>
            </div>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/[0.06] bg-white/[0.01]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmMove}
            disabled={saving || !targetId || cleanBlockId(targetId) === cleanBlockId(fromCasoId)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {saving ? "Movendo..." : "Mover Questão"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
