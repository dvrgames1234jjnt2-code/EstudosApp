"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribeOnline(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export function OfflineIndicator() {
  const isOnline = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, () => true);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[110] flex items-center gap-2 px-3.5 py-2 rounded-full bg-amber-950/95 border border-amber-500/40 text-amber-200 text-xs shadow-lg backdrop-blur-sm">
      <WifiOff size={13} className="text-amber-400 shrink-0" />
      <span>Você está offline. Alguns dados exigem conexão.</span>
    </div>
  );
}
