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

/** Gera uma textura detalhada de lombada de livro com douração e tipografia nobre */
export function createSpineTexture(
  title: string,
  materia: string,
  palette: typeof BOOK_PALETTES[0],
  questionCount: number
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
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

  // Textura sutil de granulação de couro
  ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
  for (let i = 0; i < 4000; i++) {
    const rx = Math.random() * canvas.width;
    const ry = Math.random() * canvas.height;
    ctx.fillRect(rx, ry, 1.5, 1.5);
  }

  // Filetes dourados superiores (relevo de encadernador)
  drawGoldRibbon(ctx, 60, canvas.width, palette.goldTone);
  drawGoldRibbon(ctx, 110, canvas.width, palette.goldTone);

  // Filetes dourados inferiores
  drawGoldRibbon(ctx, canvas.height - 130, canvas.width, palette.goldTone);
  drawGoldRibbon(ctx, canvas.height - 80, canvas.width, palette.goldTone);

  // Monograma / Emblema nobre no topo
  ctx.save();
  ctx.translate(canvas.width / 2, 170);
  drawSpineEmblem(ctx, palette.goldTone);
  ctx.restore();

  // Matéria no topo
  ctx.save();
  ctx.font = "italic 600 24px 'Cinzel', 'Playfair Display', Georgia, serif";
  ctx.fillStyle = palette.goldTone;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
  ctx.shadowBlur = 4;
  ctx.fillText(materia.toUpperCase().slice(0, 20), canvas.width / 2, 230);
  ctx.restore();

  // Título na vertical (de cima para baixo na lombada)
  ctx.save();
  ctx.translate(canvas.width / 2, 560);
  ctx.rotate(Math.PI / 2);
  ctx.font = "bold 34px 'Cinzel', 'Playfair Display', Georgia, serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 6;

  // Limita tamanho do título para caber na lombada
  let displayTitle = title;
  if (displayTitle.length > 28) {
    displayTitle = displayTitle.slice(0, 26) + "…";
  }
  ctx.fillText(displayTitle, 0, 0);
  ctx.restore();

  // Selo de volume / quantidade de questões no rodapé da lombada
  ctx.save();
  ctx.font = "600 22px Georgia, serif";
  ctx.fillStyle = palette.goldTone;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`${questionCount} QUESTÕES`, canvas.width / 2, canvas.height - 180);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** Desenha um filete de douração ornamental */
function drawGoldRibbon(ctx: CanvasRenderingContext2D, y: number, width: number, gold: string) {
  ctx.save();
  ctx.strokeStyle = gold;
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 3;

  ctx.beginPath();
  ctx.moveTo(15, y);
  ctx.lineTo(width - 15, y);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(25, y - 6);
  ctx.lineTo(width - 25, y - 6);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(25, y + 6);
  ctx.lineTo(width - 25, y + 6);
  ctx.stroke();
  ctx.restore();
}

/** Desenha um emblema clássico de estudos no centro */
function drawSpineEmblem(ctx: CanvasRenderingContext2D, gold: string) {
  ctx.strokeStyle = gold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 20, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = gold;
  ctx.font = "16px serif";
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
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // Fundo couro nobre com vinheta
  const bgGrad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, 100,
    canvas.width / 2, canvas.height / 2, 600
  );
  bgGrad.addColorStop(0, palette.accent);
  bgGrad.addColorStop(0.7, palette.bg);
  bgGrad.addColorStop(1, "#0a0d12");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Micro ruído de couro
  ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
  for (let i = 0; i < 8000; i++) {
    const rx = Math.random() * canvas.width;
    const ry = Math.random() * canvas.height;
    ctx.fillRect(rx, ry, 2, 2);
  }

  // Moldura dourada externa ornamental
  ctx.strokeStyle = palette.goldTone;
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

  // Moldura dourada interna fina
  ctx.lineWidth = 1.5;
  ctx.strokeRect(55, 55, canvas.width - 110, canvas.height - 110);

  // Cantoneiras clássicas
  drawCornerOrnament(ctx, 45, 45, palette.goldTone, 0);
  drawCornerOrnament(ctx, canvas.width - 45, 45, palette.goldTone, Math.PI / 2);
  drawCornerOrnament(ctx, canvas.width - 45, canvas.height - 45, palette.goldTone, Math.PI);
  drawCornerOrnament(ctx, 45, canvas.height - 45, palette.goldTone, (Math.PI * 3) / 2);

  // Cabeçalho da capa: MATÉRIA
  ctx.save();
  ctx.font = "600 24px 'Cinzel', Georgia, serif";
  ctx.fillStyle = palette.goldTone;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "6px";
  ctx.fillText(materia.toUpperCase(), canvas.width / 2, 180);

  // Linha sutil separadora
  ctx.strokeStyle = palette.goldTone;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2 - 120, 215);
  ctx.lineTo(canvas.width / 2 + 120, 215);
  ctx.stroke();

  // Emblema central dourado
  drawGrandMedallion(ctx, canvas.width / 2, 380, palette.goldTone);

  // Título do Caderno
  ctx.font = "bold 44px 'Cinzel', 'Playfair Display', Georgia, serif";
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
  ctx.shadowBlur = 8;

  // Quebra de linha do título
  const words = title.split(" ");
  let line1 = "";
  let line2 = "";
  words.forEach((w) => {
    if ((line1 + " " + w).length <= 18) {
      line1 += (line1 ? " " : "") + w;
    } else {
      line2 += (line2 ? " " : "") + w;
    }
  });

  if (line2) {
    ctx.fillText(line1, canvas.width / 2, 590);
    ctx.fillText(line2, canvas.width / 2, 650);
  } else {
    ctx.fillText(line1, canvas.width / 2, 620);
  }

  // Rodapé: "CADERNO DE QUESTÕES" & quantidade
  ctx.font = "italic 26px Georgia, serif";
  ctx.fillStyle = palette.goldTone;
  ctx.fillText("CADERNO DE QUESTÕES", canvas.width / 2, 780);

  ctx.font = "bold 32px 'Cinzel', Georgia, serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`✦ ${questionCount} QUESTÕES ✦`, canvas.width / 2, 840);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/** Desenha cantoneira ornamental */
function drawCornerOrnament(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 25);
  ctx.lineTo(0, 0);
  ctx.lineTo(25, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(8, 8, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/** Desenha medalhão dourado imperial */
function drawGrandMedallion(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 60, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = "40px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("🏛️", 0, -2);
  ctx.restore();
}

/** Gera a textura das bordas de páginas (folhas empilhadas no miolo) */
export function createPageEdgesTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return new THREE.CanvasTexture(canvas);
  }

  // Fundo papel marfim suave
  ctx.fillStyle = "#ede5cf";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Linhas horizontais ultrafinas simulando as milhares de folhas
  for (let y = 0; y < canvas.height; y += 2) {
    const darkness = Math.random() * 0.15;
    ctx.fillStyle = `rgba(100, 80, 50, ${darkness})`;
    ctx.fillRect(0, y, canvas.width, 1);
  }

  // Leve sombreamento de envelhecimento nas bordas
  const grad = ctx.createLinearGradient(0, 0, canvas.width, 0);
  grad.addColorStop(0, "rgba(70, 50, 30, 0.35)");
  grad.addColorStop(0.2, "rgba(70, 50, 30, 0)");
  grad.addColorStop(0.8, "rgba(70, 50, 30, 0)");
  grad.addColorStop(1, "rgba(70, 50, 30, 0.35)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
