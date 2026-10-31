"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import type { Caderno3DItem } from "./types";
import {
  BOOK_PALETTES,
  createSpineTexture,
  createFrontCoverTexture,
  createPageEdgesTexture,
} from "./bookTextureGenerator";

interface Book3DSceneProps {
  cadernos: Caderno3DItem[];
  selectedCaderno: Caderno3DItem | null;
  onSelectCaderno: (caderno: Caderno3DItem) => void;
  onHoverCaderno: (caderno: Caderno3DItem | null, mousePos?: { x: number; y: number }) => void;
}

interface BookMeshObject {
  group: THREE.Group;
  caderno: Caderno3DItem;
  coverPivot: THREE.Group;
  baseY: number;
  basePos: THREE.Vector3;
  baseRot: THREE.Euler;
  targetScale: number;
  currentScale: number;
  targetRotY: number;
  isOpening: boolean;
  openProgress: number; // 0 (fechado) a 1 (totalmente aberto)
}

export default function Book3DScene({
  cadernos,
  selectedCaderno,
  onSelectCaderno,
  onHoverCaderno,
}: Book3DSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const booksRef = useRef<BookMeshObject[]>([]);
  const hoveredBookRef = useRef<BookMeshObject | null>(null);
  const mouseNormRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const animFrameRef = useRef<number | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

  // Detecta preferência por redução de movimento
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Inicialização Three.js Scene, Camera, Lights, Particles
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Cena
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0c10, 0.045);
    sceneRef.current = scene;

    // Câmera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 7.8);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // ── Iluminação da Biblioteca Acolhedora ─────────────────────────────────
    // Luz ambiente morna (luz de abajur/estudo)
    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.2);
    scene.add(ambientLight);

    // Luz Direcional Principal (Spot quente vindo do alto à esquerda)
    const dirLight = new THREE.DirectionalLight(0xffecc0, 2.4);
    dirLight.position.set(4, 7, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Luz de preenchimento azul suave (contraste sutil do fundo)
    const rimLight = new THREE.DirectionalLight(0x406085, 1.1);
    rimLight.position.set(-6, 3, -4);
    scene.add(rimLight);

    // Luz dinâmica pontual que segue sutilmente o cursor
    const mousePointLight = new THREE.PointLight(0xffdf99, 1.5, 8);
    mousePointLight.position.set(0, 0, 5);
    scene.add(mousePointLight);

    // ── Partículas Douradas Flutuantes (Poeira de Luz Mágica) ───────────────
    const particleCount = 140;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 16;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 10;
      particleSpeeds[i] = 0.2 + Math.random() * 0.4;
    }

    particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));

    // Textura circular suave para partícula
    const pCanvas = document.createElement("canvas");
    pCanvas.width = 32;
    pCanvas.height = 32;
    const pCtx = pCanvas.getContext("2d");
    if (pCtx) {
      const grad = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, "rgba(255, 230, 160, 1)");
      grad.addColorStop(0.4, "rgba(230, 180, 80, 0.6)");
      grad.addColorStop(1, "rgba(200, 150, 50, 0)");
      pCtx.fillStyle = grad;
      pCtx.beginPath();
      pCtx.arc(16, 16, 16, 0, Math.PI * 2);
      pCtx.fill();
    }
    const particleTex = new THREE.CanvasTexture(pCanvas);

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.12,
      map: particleTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.75,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // ── Redimensionamento de Janela ─────────────────────────────────────────
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // ── Mouse Move para Raycasting e Iluminação Interativa ──────────────────
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouseNormRef.current = { x, y };

      // Move a luz suave para perto do cursor
      mousePointLight.position.x = x * 4;
      mousePointLight.position.y = y * 2.5;

      // Executa raycasting
      raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), camera);
      const interactiveMeshes: THREE.Object3D[] = [];
      booksRef.current.forEach((b) => {
        b.group.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as any)._bookRef = b;
            interactiveMeshes.push(child);
          }
        });
      });

      const intersects = raycasterRef.current.intersectObjects(interactiveMeshes, false);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const hitBook: BookMeshObject = (hit.object as any)._bookRef;
        if (hitBook && hitBook !== hoveredBookRef.current) {
          if (hoveredBookRef.current) {
            hoveredBookRef.current.targetScale = 1;
          }
          hoveredBookRef.current = hitBook;
          hitBook.targetScale = 1.09;
          container.style.cursor = "pointer";
          onHoverCaderno(hitBook.caderno, { x: e.clientX, y: e.clientY });
        }
      } else {
        if (hoveredBookRef.current) {
          hoveredBookRef.current.targetScale = 1;
          hoveredBookRef.current = null;
          container.style.cursor = "default";
          onHoverCaderno(null);
        }
      }
    };

    // ── Clique para Selecionar Livro ────────────────────────────────────────
    const handleClick = () => {
      if (hoveredBookRef.current) {
        const book = hoveredBookRef.current;
        book.isOpening = true;
        onSelectCaderno(book.caderno);
      }
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("click", handleClick);

    // ── Loop de Animação ────────────────────────────────────────────────────
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      const elapsedTime = clockRef.current.getElapsedTime();

      // Anima partículas douradas subindo devagar
      const pPositions = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pPositions[i * 3 + 1] += particleSpeeds[i] * delta * 0.4;
        pPositions[i * 3] += Math.sin(elapsedTime * 0.3 + i) * 0.003;
        if (pPositions[i * 3 + 1] > 4.5) {
          pPositions[i * 3 + 1] = -4.5;
        }
      }
      particleGeometry.attributes.position.needsUpdate = true;

      // Animação de cada livro
      booksRef.current.forEach((b) => {
        const isHovered = hoveredBookRef.current === b;

        // Se o livro está sendo aberto pelo clique
        if (b.isOpening) {
          b.openProgress = Math.min(1, b.openProgress + delta * 2.2);

          // Aproxima do centro da câmera
          b.group.position.lerp(new THREE.Vector3(0, 0, 3.2), delta * 4);
          b.group.rotation.x = THREE.MathUtils.lerp(b.group.rotation.x, 0.1, delta * 4);
          b.group.rotation.y = THREE.MathUtils.lerp(b.group.rotation.y, -0.2, delta * 4);
          b.group.rotation.z = THREE.MathUtils.lerp(b.group.rotation.z, 0, delta * 4);

          // Roda a capa frontal (abertura de 140 graus)
          const targetCoverAngle = -Math.PI * 0.75;
          b.coverPivot.rotation.y = THREE.MathUtils.lerp(
            b.coverPivot.rotation.y,
            targetCoverAngle,
            delta * 3.5
          );
        } else {
          // Flutuação contínua suave e orgânica
          const motionFactor = prefersReducedMotion.current ? 0.15 : 1;
          const floatTime = elapsedTime * b.caderno.floatSpeed + b.caderno.floatOffset;

          // Movimento vertical (senóide suave)
          const targetY =
            b.baseY +
            Math.sin(floatTime) * b.caderno.floatAmplitude * motionFactor +
            (isHovered ? 0.2 : 0);

          b.group.position.y = THREE.MathUtils.lerp(b.group.position.y, targetY, delta * 3.5);

          // Inclinações e oscilações de rotação naturais
          const rotOscillationX = Math.cos(floatTime * 0.8) * 0.04 * motionFactor;
          const rotOscillationZ = Math.sin(floatTime * 0.6) * 0.03 * motionFactor;

          // Se estiver com hover, inclina na direção do cursor do mouse
          if (isHovered) {
            const tiltTargetX = b.baseRot.x - mouseNormRef.current.y * 0.25;
            const tiltTargetY = b.baseRot.y + mouseNormRef.current.x * 0.35;
            b.group.rotation.x = THREE.MathUtils.lerp(b.group.rotation.x, tiltTargetX, delta * 5);
            b.group.rotation.y = THREE.MathUtils.lerp(b.group.rotation.y, tiltTargetY, delta * 5);
          } else {
            b.group.rotation.x = THREE.MathUtils.lerp(
              b.group.rotation.x,
              b.baseRot.x + rotOscillationX,
              delta * 2.5
            );
            b.group.rotation.y = THREE.MathUtils.lerp(
              b.group.rotation.y,
              b.baseRot.y + Math.sin(floatTime * 0.5) * 0.05 * motionFactor,
              delta * 2.5
            );
          }

          b.group.rotation.z = THREE.MathUtils.lerp(
            b.group.rotation.z,
            b.baseRot.z + rotOscillationZ,
            delta * 2.5
          );

          // Escala suave
          b.currentScale = THREE.MathUtils.lerp(b.currentScale, b.targetScale, delta * 6);
          b.group.scale.set(b.currentScale, b.currentScale, b.currentScale);

          // Mantém a capa fechada quando em repouso
          b.coverPivot.rotation.y = THREE.MathUtils.lerp(b.coverPivot.rotation.y, 0, delta * 5);
        }
      });

      // Suave movimento de câmera de acordo com o mouse (efeito parallax de profundidade)
      if (camera && !prefersReducedMotion.current) {
        camera.position.x = THREE.MathUtils.lerp(
          camera.position.x,
          mouseNormRef.current.x * 0.45,
          delta * 2
        );
        camera.position.y = THREE.MathUtils.lerp(
          camera.position.y,
          0.5 + mouseNormRef.current.y * 0.25,
          delta * 2
        );
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };

    animate();

    // ── Limpeza ao Desmontar ────────────────────────────────────────────────
    return () => {
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("click", handleClick);

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

      // Dispose de geometrias e materiais
      booksRef.current.forEach((b) => {
        b.group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            mesh.geometry.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else if (mesh.material) {
              mesh.material.dispose();
            }
          }
        });
      });

      particleGeometry.dispose();
      particleMaterial.dispose();
      particleTex.dispose();

      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (rendererRef.current.domElement && container.contains(rendererRef.current.domElement)) {
          container.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [onHoverCaderno, onSelectCaderno]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Montagem e Atualização dos Livros Tridimensionais
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove livros antigos da cena
    booksRef.current.forEach((b) => {
      scene.remove(b.group);
      b.group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material?.dispose();
          }
        }
      });
    });
    booksRef.current = [];

    const pageEdgesTexture = createPageEdgesTexture();

    // Cria cada livro físico na cena
    cadernos.forEach((caderno, index) => {
      const palette = BOOK_PALETTES[index % BOOK_PALETTES.length];
      const qCount = caderno.questoes.length;

      // Dimensões proporcionais
      const bookWidth = 1.35;
      const bookHeight = 1.95;
      // Espessura proporcional às questões (mínimo 0.22, máximo 0.65)
      const bookThickness = Math.min(0.65, Math.max(0.22, qCount * 0.007 + 0.18));
      const coverThickness = 0.035;

      const bookGroup = new THREE.Group();
      bookGroup.position.set(...caderno.position);
      bookGroup.rotation.set(...caderno.rotation);

      // Texturas dinâmicas em alta resolução
      const spineTexture = createSpineTexture(caderno.nome, caderno.materia, palette, qCount);
      const frontCoverTexture = createFrontCoverTexture(caderno.nome, caderno.materia, palette, qCount);

      // ── 1. Contracapa Traseira (Back Cover) ─────────────────────────────────
      const backCoverGeo = new THREE.BoxGeometry(bookWidth, bookHeight, coverThickness);
      const backCoverMat = new THREE.MeshStandardMaterial({
        color: palette.bg,
        roughness: 0.65,
        metalness: 0.12,
      });
      const backCoverMesh = new THREE.Mesh(backCoverGeo, backCoverMat);
      backCoverMesh.position.set(0, 0, -bookThickness / 2 + coverThickness / 2);
      backCoverMesh.castShadow = true;
      backCoverMesh.receiveShadow = true;
      bookGroup.add(backCoverMesh);

      // ── 2. Miolo de Páginas de Papel (Paper Core) ───────────────────────────
      const pagesWidth = bookWidth - 0.07;
      const pagesHeight = bookHeight - 0.08;
      const pagesThickness = bookThickness - coverThickness * 2;

      const pagesGeo = new THREE.BoxGeometry(pagesWidth, pagesHeight, pagesThickness);
      const pagesEdgeMat = new THREE.MeshStandardMaterial({
        map: pageEdgesTexture,
        roughness: 0.9,
        color: 0xf5f0de,
      });
      const pagesPlainMat = new THREE.MeshStandardMaterial({
        color: 0xede4cd,
        roughness: 0.95,
      });

      // Mapeamento de materiais para cada face do miolo
      // [right, left, top, bottom, front, back]
      const pagesMaterials = [
        pagesEdgeMat, // right (borda visível externa)
        pagesPlainMat, // left (junto à lombada)
        pagesEdgeMat, // top
        pagesEdgeMat, // bottom
        pagesPlainMat, // front
        pagesPlainMat, // back
      ];

      const pagesMesh = new THREE.Mesh(pagesGeo, pagesMaterials);
      // Desloca um pouco para a direita para dar margem à lombada
      pagesMesh.position.set(0.035, 0, 0);
      pagesMesh.castShadow = true;
      pagesMesh.receiveShadow = true;
      bookGroup.add(pagesMesh);

      // ── 3. Lombada Curva (Spine) ───────────────────────────────────────────
      const spineRadius = bookThickness / 2;
      const spineGeo = new THREE.CylinderGeometry(
        spineRadius,
        spineRadius,
        bookHeight,
        18,
        1,
        false,
        Math.PI * 0.5,
        Math.PI
      );
      const spineMat = new THREE.MeshStandardMaterial({
        map: spineTexture,
        roughness: 0.5,
        metalness: 0.25,
      });
      const spineMesh = new THREE.Mesh(spineGeo, spineMat);
      // Posiciona na lateral esquerda do livro
      spineMesh.position.set(-bookWidth / 2, 0, 0);
      spineMesh.rotation.z = 0;
      spineMesh.castShadow = true;
      spineMesh.receiveShadow = true;
      bookGroup.add(spineMesh);

      // ── 4. Capa Frontal Articulada (Front Cover Pivot) ─────────────────────
      // Criamos um pivot no eixo da lombada (x = -bookWidth / 2) para permitir abrir o livro em 3D
      const coverPivot = new THREE.Group();
      coverPivot.position.set(-bookWidth / 2, 0, bookThickness / 2);

      const frontCoverGeo = new THREE.BoxGeometry(bookWidth, bookHeight, coverThickness);
      // Materiais da capa frontal: [right, left, top, bottom, front, back]
      const coverFrontMat = new THREE.MeshStandardMaterial({
        map: frontCoverTexture,
        roughness: 0.45,
        metalness: 0.28,
      });
      const coverInsideMat = new THREE.MeshStandardMaterial({
        color: 0x221a15,
        roughness: 0.8,
      });

      const frontCoverMaterials = [
        backCoverMat, // right
        backCoverMat, // left
        backCoverMat, // top
        backCoverMat, // bottom
        coverFrontMat, // front (capa externa com arte e ouro)
        coverInsideMat, // back (interior da capa)
      ];

      const frontCoverMesh = new THREE.Mesh(frontCoverGeo, frontCoverMaterials);
      // Desloca para que a dobradiça fique na borda esquerda
      frontCoverMesh.position.set(bookWidth / 2, 0, coverThickness / 2);
      frontCoverMesh.castShadow = true;
      frontCoverMesh.receiveShadow = true;
      coverPivot.add(frontCoverMesh);

      bookGroup.add(coverPivot);

      scene.add(bookGroup);

      booksRef.current.push({
        group: bookGroup,
        caderno,
        coverPivot,
        baseY: caderno.position[1],
        basePos: new THREE.Vector3(...caderno.position),
        baseRot: new THREE.Euler(...caderno.rotation),
        targetScale: 1,
        currentScale: 1,
        targetRotY: caderno.rotation[1],
        isOpening: false,
        openProgress: 0,
      });
    });
  }, [cadernos]);

  // Se o caderno selecionado mudar para null (usuário fechou o livro), reseta o livro 3D
  useEffect(() => {
    if (!selectedCaderno) {
      booksRef.current.forEach((b) => {
        b.isOpening = false;
        b.openProgress = 0;
        b.targetScale = 1;
        b.group.position.copy(b.basePos);
        b.group.rotation.copy(b.baseRot);
        b.coverPivot.rotation.y = 0;
      });
    }
  }, [selectedCaderno]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden"
      style={{ touchAction: "none" }}
    />
  );
}
