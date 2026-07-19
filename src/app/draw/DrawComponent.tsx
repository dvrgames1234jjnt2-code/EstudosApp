"use client";

import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";

export default function DrawComponent() {
  return (
    <div style={{ position: "fixed", inset: 0, top: "3.5rem", width: "100vw", height: "calc(100vh - 3.5rem)" }}>
      <Tldraw inferDarkMode autoFocus />
    </div>
  );
}
