import * as THREE from "three";

// Paletas clássicas de encadernação nobre para biblioteca histórica / acadêmica
export const BOOK_PALETTES = [
  {
    name: "Verde Biblioteca",
    bg: "#162f26",
    accent: "#244d3e",
    border: "#d4af37",
    textColor: "#f4eccd",
    goldTone: "#e5c07b",
  },
  {
    name: "Azul Marinho Real",
    bg: "#132338",
    accent: "#1c3554",
    border: "#d4af37",
    textColor: "#f4eccd",
    goldTone: "#e5c07b",
  },
  {
    name: "Bordô Imperial",
    bg: "#3b161f",
    accent: "#5a222f",
    border: "#e6c364",
    textColor: "#fcf8eb",
    goldTone: "#e6c364",
  },
  {
    name: "Couro Havana",
    bg: "#2b1c14",
    accent: "#422c20",
    border: "#cca152",
    textColor: "#f8f1de",
    goldTone: "#cca152",
  },
  {
    name: "Carvão Noturno",
    bg: "#1a1f26",
    accent: "#272f3a",
    border: "#c5a059",
    textColor: "#f0ede4",
    goldTone: "#c5a059",
  },
  {
    name: "Verde Oliva Antigo",
    bg: "#202a1b",
    accent: "#32422a",
    border: "#cca64e",
    textColor: "#f8f5eb",
    goldTone: "#cca64e",
  },
];

// Cache global de texturas para performance extrema (evita recriar canvas no render)
const textureCache = new Map<string, THREE.CanvasTexture>();
let sharedPageEdgesTexture: THREE.CanvasTexture | null = null;

/** Gera uma textura detalhada de lombada de livro com douração e tipografia nobre */
export function createSpineTexture(
  title: string,
  materia: string,
  palette: typeof BOOK_PALETTES[0],
  questionCount: number
): THREE.CanvasTexture {
  const cacheKey = `spine_${title}_${materia}_${palette.name}_${questionCount}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    textureCache.set(cacheKey, fallback);
    return fallback;
  }

  // Fundo com leve gradiente de couro
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, "#080c10");
  grad.addColorStop(0.2, palette.bg);
  grad.addColorStop(0.5, palette.accent);
  grad.addColorStop(0.8, palette.bg);
  grad.addColorStop(1, "#080c10");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Filetes dourados superiores (relevo de encadernador)
  drawGoldRibbon(ctx, 35, canvas.width, palette.goldTone);
  drawGoldRibbon(ctx, 60, canvas.width, palette.goldTone);

  // Filetes dourados inferiores
  drawGoldRibbon(ctx, canvas.height - 70, canvas.width, palette.goldTone);
  drawGoldRibbon(ctx, canvas.height - 45, canvas.width, palette.goldTone);

  // Monograma / Emblema nobre no topo
  ctx.save();
  ctx.translate(canvas.width / 2, 95);
  drawSpineEmblem(ctx, palette.goldTone);
  ctx.restore();

  // Matéria no topo
  ctx.save();
  ctx.font = "italic 600 13px Georgia, serif";
  ctx.fillStyle = palette.goldTone;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 3;
  ctx.fillText(materia.toUpperCase().slice(0, 18), canvas.width / 2, 130);
  ctx.restore();

  // Título na vertical (de cima para baixo na lombada)
  ctx.save();
  ctx.translate(canvas.width / 2, 280);
  ctx.rotate(Math.PI / 2);
  ctx.font = "bold 18px Georgia, serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 4;

  let displayTitle = title;
  if (displayTitle.length > 26) {
    displayTitle = displayTitle.slice(0, 24) + "…";
  }
  ctx.fillText(displayTitle, 0, 0);
  ctx.restore();

  // Selo de volume / quantidade de questões no rodapé da lombada
  ctx.save();
  ctx.font = "600 12px Georgia, serif";
  ctx.fillStyle = palette.goldTone;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${questionCount} QUESTÕES`, canvas.width / 2, canvas.height - 100);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache.set(cacheKey, texture);
  return texture;
}

/** Desenha um filete de douração ornamental */
function drawGoldRibbon(ctx: CanvasRenderingContext2D, y: number, width: number, gold: string) {
  ctx.save();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 2;

  ctx.beginPath();
  ctx.moveTo(8, y);
  ctx.lineTo(width - 8, y);
  ctx.stroke();

  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(14, y - 4);
  ctx.lineTo(width - 14, y - 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(14, y + 4);
  ctx.lineTo(width - 14, y + 4);
  ctx.stroke();
  ctx.restore();
}

/** Desenha um emblema clássico de estudos no centro */
function drawSpineEmblem(ctx: CanvasRenderingContext2D, gold: string) {
  ctx.strokeStyle = gold;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = gold;
  ctx.font = "10px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("✦", 0, 0);
}

/** Gera a textura da capa frontal do livro */
export function createFrontCoverTexture(
  title: string,
  materia: string,
  palette: typeof BOOK_PALETTES[0],
  questionCount: number
): THREE.CanvasTexture {
  const cacheKey = `cover_${title}_${materia}_${palette.name}_${questionCount}`;
  if (textureCache.has(cacheKey)) {
    return textureCache.get(cacheKey)!;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    textureCache.set(cacheKey, fallback);
    return fallback;
  }

  // Fundo couro nobre com vinheta
  const bgGrad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 50,
    canvas.width / 2, canvas.height / 2, 300
  );
  bgGrad.addColorStop(0, palette.accent);
  bgGrad.addColorStop(0.7, palette.bg);
  bgGrad.addColorStop(1, "#0a0d12");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Moldura dourada externa ornamental
  ctx.strokeStyle = palette.goldTone;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Moldura dourada interna fina
  ctx.lineWidth = 1;
  ctx.strokeRect(28, 28, canvas.width - 56, canvas.height - 56);

  // Cantoneiras clássicas
  drawCornerOrnament(ctx, 23, 23, palette.goldTone, 0);
  drawCornerOrnament(ctx, canvas.width - 23, 23, palette.goldTone, Math.PI / 2);
  drawCornerOrnament(ctx, canvas.width - 23, canvas.height - 23, palette.goldTone, Math.PI);
  drawCornerOrnament(ctx, 23, canvas.height - 23, palette.goldTone, (Math.PI * 3) / 2);

  // Cabeçalho da capa: MATÉRIA
  ctx.save();
  ctx.font = "600 13px Georgia, serif";
  ctx.fillStyle = palette.goldTone;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(materia.toUpperCase(), canvas.width / 2, 85);

  // Linha sutil separadora
  ctx.strokeStyle = palette.goldTone;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 60, 102);
  ctx.lineTo(canvas.width / 2 + 60, 102);
  ctx.stroke();

  // Emblema central dourado
  drawGrandMedallion(ctx, canvas.width / 2, 185, palette.goldTone);

  // Título do Caderno
  ctx.font = "bold 21px Georgia, serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 5;

  const words = title.split(" ");
  let line1 = "";
  let line2 = "";
  words.forEach((w) => {
    if ((line1 + " " + w).length <= 16) {
      line1 += (line1 ? " " : "") + w;
    } else {
      line2 += (line2 ? " " : "") + w;
    }
  });

  if (line2) {
    ctx.fillText(line1, canvas.width / 2, 290);
    ctx.fillText(line2, canvas.width / 2, 320);
  } else {
    ctx.fillText(line1, canvas.width / 2, 305);
  }

  // Rodapé: "CADERNO DE QUESTÕES" & quantidade
  ctx.font = "italic 13px Georgia, serif";
  ctx.fillStyle = palette.goldTone;
  ctx.fillText("CADERNO DE QUESTÕES", canvas.width / 2, 395);

  ctx.font = "bold 15px Georgia, serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`✦ ${questionCount} QUESTÕES ✦`, canvas.width / 2, 425);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  textureCache.set(cacheKey, texture);
  return texture;
}

/** Desenha cantoneira ornamental */
function drawCornerOrnament(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(0, 0);
  ctx.lineTo(14, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(4, 4, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Desenha medalhão dourado imperial */
function drawGrandMedallion(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = "22px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🏛️", 0, -1);
  ctx.restore();
}

/** Gera a textura das bordas de páginas (folhas empilhadas no miolo) - Reutilizada globalmente */
export function createPageEdgesTexture(): THREE.CanvasTexture {
  if (sharedPageEdgesTexture) {
    return sharedPageEdgesTexture;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    sharedPageEdgesTexture = new THREE.CanvasTexture(canvas);
    return sharedPageEdgesTexture;
  }

  // Fundo papel marfim suave
  ctx.fillStyle = "#ede5cf";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Linhas horizontais simulando folhas
  ctx.fillStyle = "rgba(90, 70, 45, 0.12)";
  for (let y = 0; y < canvas.height; y += 3) {
    ctx.fillRect(0, y, canvas.width, 1);
  }

  // Leve sombreamento de envelhecimento nas bordas
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, "rgba(70, 50, 30, 0.3)");
  grad.addColorStop(0.2, "rgba(70, 50, 30, 0)");
  grad.addColorStop(0.8, "rgba(70, 50, 30, 0)");
  grad.addColorStop(1, "rgba(70, 50, 30, 0.3)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  sharedPageEdgesTexture = texture;
  return texture;
}
