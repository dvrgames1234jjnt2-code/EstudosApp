"use client";

import React, { useState, useEffect } from "react";
import { X, Pencil, Loader2, Save } from "lucide-react";
import { supabase, supabasePublic } from "../../lib/supabase";

interface ModalRenomearPastaProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string;
  currentNome: string;
  onSuccess: (nodeId: string, newNome: string) => void;
}

export function ModalRenomearPasta({
  isOpen,
  onClose,
  nodeId,
  currentNome,
  onSuccess,
}: ModalRenomearPastaProps) {
  const [nome, setNome] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNome(currentNome);
      setErro(null);
    }
  }, [isOpen, currentNome]);

  if (!isOpen) return null;

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || nome.trim() === currentNome) {
      onClose();
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const cleanNome = nome.trim();

      // Se for um nó do banco de dados (UUID)
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nodeId)) {
        let res = await supabase
          .from("organizacao_nos")
          .update({ nome: cleanNome })
          .eq("id", nodeId);

        if (res.error) {
          res = await supabasePublic
            .from("organizacao_nos")
            .update({ nome: cleanNome })
            .eq("id", nodeId);
        }

        if (res.error) {
          throw new Error(res.error.message);
        }
      }

      onSuccess(nodeId, cleanNome);
      onClose();
    } catch (e: any) {
      console.error("Erro ao renomear pasta:", e);
      setErro(e.message || "Erro ao renomear pasta.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#0d1220] border border-white/[0.08] rounded-2xl shadow-2xl p-5 flex flex-col gap-4">
        
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Pencil size={13} />
            </span>
            <h3 className="text-xs font-semibold text-slate-200">Renomear Caso / Pasta</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-white rounded hover:bg-white/[0.05]"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSalvar} className="space-y-3">
          {erro && (
            <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
              {erro}
            </p>
          )}

          <div>
            <label className="text-[10.5px] font-medium text-slate-400 block mb-1">
              Novo nome
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite o nome..."
              autoFocus
              className="w-full bg-[#111623] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 font-light"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-3 py-1.5 rounded-lg border border-white/[0.08] text-slate-400 hover:text-white text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || !nome.trim()}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-md transition-all disabled:opacity-40"
            >
              {salvando ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              <span>Salvar</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
