import * as THREE from "three";

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export function createWoodTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 512, 512);
  grad.addColorStop(0, "#4e2614");
  grad.addColorStop(0.5, "#5c2e19");
  grad.addColorStop(1, "#442010");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle plank bands & organic wood grain lines
  for (let y = 0; y < 512; y += 2) {
    const wave = Math.sin(y * 0.05) * 8 + Math.cos(y * 0.17) * 3;
    const alpha = 0.04 + (Math.sin(y * 0.23) + 1) * 0.03;
    ctx.strokeStyle = y % 128 < 2 ? "rgba(25, 10, 4, 0.45)" : `rgba(28, 11, 4, ${alpha.toFixed(3)})`;
    ctx.lineWidth = y % 128 < 2 ? 2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + wave, 340, y - wave, 512, y + wave * 0.4);
    ctx.stroke();
  }

  // Warm highlights
  for (let i = 0; i < 45; i++) {
    const y = (i * 11.7) % 512;
    ctx.strokeStyle = "rgba(145, 82, 42, 0.07)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + Math.sin(i) * 4);
    ctx.stroke();
  }

  return finalizeColorTexture(canvas, maxAnisotropy, 2, 1.5);
}

export function createLeatherCoverTexture(
  maxAnisotropy: number,
  title = "MEU CADERNO",
  subtitle = "NOTION QUESTIONS"
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, 512, 640);
  bg.addColorStop(0, "#31122a");
  bg.addColorStop(0.5, "#3b1733");
  bg.addColorStop(1, "#240d20");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 640);

  // Subtle leather pebble grain
  for (let i = 0; i < 2400; i++) {
    const x = (i * 73.13) % 512;
    const y = (i * 137.7) % 640;
    ctx.fillStyle = i % 2 === 0 ? "rgba(255,210,235,0.025)" : "rgba(10,2,8,0.08)";
    ctx.fillRect(x, y, 2, 2);
  }

  // Outer gold foil border
  ctx.strokeStyle = "rgba(232, 190, 108, 0.72)";
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 26, 460, 588);

  ctx.strokeStyle = "rgba(232, 190, 108, 0.32)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, 440, 568);

  // Gold crescent moon emblem in upper center
  ctx.save();
  ctx.translate(256, 235);
  ctx.fillStyle = "#eac275";
  ctx.beginPath();
  ctx.arc(0, 0, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#36142e";
  ctx.beginPath();
  ctx.arc(16, -8, 36, 0, Math.PI * 2);
  ctx.fill();

  // Tiny accent star beside the moon
  ctx.fillStyle = "#f5d796";
  ctx.beginPath();
  ctx.arc(-32, -26, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(38, 28, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Embossed gold typography
  ctx.fillStyle = "#ecd092";
  ctx.textAlign = "center";
  ctx.font = "600 28px Georgia, serif";
  ctx.fillText(title, 256, 360);

  ctx.fillStyle = "rgba(236, 208, 146, 0.78)";
  ctx.font = "500 14px sans-serif";
  ctx.fillText(subtitle, 256, 396);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createPaperTexture(maxAnisotropy: number, dark = false): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 640;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = dark ? "#140e1a" : "#f6efe2";
  ctx.fillRect(0, 0, 512, 640);

  ctx.strokeStyle = dark ? "rgba(232, 190, 108, 0.14)" : "rgba(120, 90, 60, 0.12)";
  ctx.lineWidth = 1;
  for (let y = 64; y < 600; y += 28) {
    ctx.beginPath();
    ctx.moveTo(32, y);
    ctx.lineTo(480, y);
    ctx.stroke();
  }

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createStickyNoteTexture(
  maxAnisotropy: number,
  bgColor: string,
  title: string,
  metric: string,
  sub: string
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle top tape strip
  ctx.fillStyle = "rgba(0,0,0,0.06)";
  ctx.fillRect(0, 0, 256, 28);

  ctx.fillStyle = "#2b2118";
  ctx.textAlign = "center";
  ctx.font = "600 26px sans-serif";
  ctx.fillText(title, 128, 92);

  ctx.font = "700 48px sans-serif";
  ctx.fillText(metric, 128, 162);

  ctx.fillStyle = "#5c4a38";
  ctx.font = "500 20px sans-serif";
  ctx.fillText(sub, 128, 214);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createCalendarTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#fbf7f0";
  ctx.fillRect(0, 0, 256, 256);

  ctx.fillStyle = "#4c2638";
  ctx.fillRect(0, 0, 256, 54);

  ctx.fillStyle = "#f9e9c8";
  ctx.textAlign = "center";
  ctx.font = "700 22px sans-serif";
  ctx.fillText("ESTUDOS", 128, 36);

  ctx.fillStyle = "#332924";
  ctx.font = "600 18px monospace";
  const rows = [
    "D  S  T  Q  Q  S  S",
    "1  2  3  4  5  6  7",
    "8  9 10 11 12 13 14",
    "15 16 17 18 19 20 21",
    "22 23 24 25 26 27 28",
  ];
  rows.forEach((line, idx) => {
    ctx.fillText(line, 128, 96 + idx * 32);
  });

  // Highlight today's date
  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(38, 218, 16, 0, Math.PI * 2);
  ctx.stroke();

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createPostcardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  // White postcard border
  ctx.fillStyle = "#f5efe6";
  ctx.fillRect(0, 0, 384, 256);

  const sky = ctx.createLinearGradient(16, 16, 16, 240);
  sky.addColorStop(0, "#121a3a");
  sky.addColorStop(0.6, "#2c3468");
  sky.addColorStop(1, "#57558b");
  ctx.fillStyle = sky;
  ctx.fillRect(14, 14, 356, 228);

  // Soft starry clouds & crescent
  ctx.fillStyle = "rgba(255, 244, 214, 0.9)";
  ctx.beginPath();
  ctx.arc(286, 78, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#222954";
  ctx.beginPath();
  ctx.arc(294, 72, 18, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 36; i++) {
    const x = 24 + ((i * 59) % 330);
    const y = 26 + ((i * 41) % 140);
    ctx.fillStyle = i % 3 === 0 ? "rgba(255,248,210,0.8)" : "rgba(210,225,255,0.55)";
    ctx.beginPath();
    ctx.arc(x, y, i % 4 === 0 ? 2.5 : 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,245,230,0.85)";
  ctx.font = "italic 16px Georgia, serif";
  ctx.fillText("Foco & Constância", 28, 220);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createNightSkyTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#050919");
  grad.addColorStop(0.55, "#0d1633");
  grad.addColorStop(1, "#1e2749");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Soft distant bokeh lights
  for (let i = 0; i < 24; i++) {
    const x = (i * 89) % 512;
    const y = 280 + ((i * 53) % 210);
    const r = 10 + (i % 5) * 6;
    const rad = ctx.createRadialGradient(x, y, 0, x, y, r);
    rad.addColorStop(0, i % 2 === 0 ? "rgba(255, 210, 145, 0.32)" : "rgba(155, 195, 255, 0.24)");
    rad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crisp night stars
  for (let i = 0; i < 80; i++) {
    const x = (i * 67 + 19) % 512;
    const y = (i * 43 + 11) % 340;
    ctx.fillStyle = i % 5 === 0 ? "rgba(255, 238, 190, 0.9)" : "rgba(220, 232, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(x, y, i % 7 === 0 ? 2 : 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createCurtainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#c96c79";
  ctx.fillRect(0, 0, 256, 512);

  // Vertical fabric folds
  for (let x = 0; x < 256; x += 32) {
    const fold = ctx.createLinearGradient(x, 0, x + 32, 0);
    fold.addColorStop(0, "rgba(75, 25, 35, 0.25)");
    fold.addColorStop(0.5, "rgba(255, 225, 230, 0.14)");
    fold.addColorStop(1, "rgba(75, 25, 35, 0.25)");
    ctx.fillStyle = fold;
    ctx.fillRect(x, 0, 32, 512);
  }

  // Cute crescent & star pattern
  ctx.fillStyle = "rgba(255, 235, 220, 0.35)";
  for (let i = 0; i < 28; i++) {
    const x = 18 + ((i * 53) % 220);
    const y = 24 + ((i * 71) % 464);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createPackLabelTexture(
  maxAnisotropy: number,
  bgColor: string,
  title: string,
  countText: string
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 128);

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, 240, 112);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "700 22px sans-serif";
  ctx.fillText(title.slice(0, 16), 128, 56);

  ctx.fillStyle = "rgba(255,240,210,0.9)";
  ctx.font = "600 18px monospace";
  ctx.fillText(countText, 128, 94);

  return finalizeColorTexture(canvas, maxAnisotropy);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
  grad.addColorStop(0, "rgba(8, 3, 2, 0.62)");
  grad.addColorStop(0.55, "rgba(8, 3, 2, 0.25)");
  grad.addColorStop(1, "rgba(8, 3, 2, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
