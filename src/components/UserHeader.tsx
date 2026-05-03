"use client";

import { useState } from "react";
import { User, LogOut, Edit2, Check, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

interface UserHeaderProps {
  user: any;
  onLogout: () => void;
}

export function UserHeader({ user, onLogout }: UserHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(user?.user_metadata?.display_name || user?.user_metadata?.full_name || "");
  const [loading, setLoading] = useState(false);

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      data: { display_name: newName }
    });
    if (!error) {
      setIsEditing(false);
      window.location.reload(); // Recarrega para atualizar o estado global
    }
    setLoading(false);
  };

  const displayName = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split('@')[0];

  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3 px-4 py-2 bg-[#0F172A] border border-white/[0.05] rounded-2xl shadow-xl">
        <div className="w-8 h-8 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center">
          <User className="w-4 h-4 text-blue-500" />
        </div>
        
        {isEditing ? (
          <div className="flex items-center gap-2">
            <input 
              autoFocus 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUpdateName()}
              className="bg-transparent border-b border-blue-500 text-slate-200 outline-none text-xs py-1 w-32"
            />
            <button onClick={handleUpdateName} disabled={loading} className="text-emerald-500 hover:text-emerald-400">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
            <span className="text-[11px] font-bold text-slate-300 capitalize">{displayName}</span>
            <Edit2 className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-all" />
          </div>
        )}
      </div>

      <button 
        onClick={onLogout}
        className="p-3 bg-[#0F172A] border border-white/[0.05] rounded-2xl text-slate-500 hover:text-red-400 hover:border-red-400/20 transition-all shadow-xl"
        title="Sair"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
