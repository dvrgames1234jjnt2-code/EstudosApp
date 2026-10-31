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
  onBookFullyOpened: (caderno: Caderno3DItem) => void;
  onHoverCaderno: (caderno: Caderno3DItem | null, mousePos?: { x: number; y: number }) => void;
  isReaderOpen: boolean;
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
  state: "floating" | "approaching" | "opening_cover" | "opened" | "closing_cover" | "returning";
  animProgress: number; // 0 a 1
}

export default function Book3DScene({
  cadernos,
  selectedCaderno,
  onSelectCaderno,
  onBookFullyOpened,
  onHoverCaderno,
  isReaderOpen,
}: Book3DSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const booksRef = useRef<BookMeshObject[]>([]);
  const hoveredBookRef = useRef<BookMeshObject | null>(null);
  const activeBookRef = useRef<BookMeshObject | null>(null);
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
  // Inicialização Three.js
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07090e, 0.04);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0.5, 7.8);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Iluminação
    const ambientLight = new THREE.AmbientLight(0xffeedd, 1.3);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffecc0, 2.5);
    dirLight.position.set(4, 7, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x406085, 1.2);
    rimLight.position.set(-6, 3, -4);
    scene.add(rimLight);

    const mousePointLight = new THREE.PointLight(0xffdf99, 1.8, 8);
    mousePointLight.position.set(0, 0, 5);
    scene.add(mousePointLight);

    // Partículas de poeira dourada
    const particleCount = 130;
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

    // Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // Mouse Move & Raycaster
    const handleMouseMove = (e: MouseEvent) => {
      if (activeBookRef.current) return;

      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouseNormRef.current = { x, y };

      mousePointLight.position.x = x * 4;
      mousePointLight.position.y = y * 2.5;

      raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), camera);
      const interactiveMeshes: THREE.Object3D[] = [];
      booksRef.current.forEach((b) => {
        if (b.state === "floating") {
          b.group.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              (child as any)._bookRef = b;
              interactiveMeshes.push(child);
            }
          });
        }
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

    // Clique no livro: inicia a aproximação cinematográfica
    const handleClick = () => {
      if (hoveredBookRef.current && !activeBookRef.current) {
        const book = hoveredBookRef.current;
        activeBookRef.current = book;
        hoveredBookRef.current = null;
        container.style.cursor = "default";
        onHoverCaderno(null);

        book.state = "approaching";
        book.animProgress = 0;
        onSelectCaderno(book.caderno);
      }
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("click", handleClick);

    // Loop de Animação Principal
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      const elapsedTime = clockRef.current.getElapsedTime();

      // Partículas
      const pPositions = particleGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        pPositions[i * 3 + 1] += particleSpeeds[i] * delta * 0.4;
        pPositions[i * 3] += Math.sin(elapsedTime * 0.3 + i) * 0.003;
        if (pPositions[i * 3 + 1] > 4.5) {
          pPositions[i * 3 + 1] = -4.5;
        }
      }
      particleGeometry.attributes.position.needsUpdate = true;

      booksRef.current.forEach((b) => {
        const isHovered = hoveredBookRef.current === b;
        const isActive = activeBookRef.current === b;

        // ── 1. ESTADO: APROXIMAÇÃO AO CENTRO ─────────────────────────────────
        if (b.state === "approaching") {
          b.animProgress = Math.min(1, b.animProgress + delta * 1.6);
          const t = b.animProgress;
          const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

          const targetPos = new THREE.Vector3(0, -0.05, 3.8);
          b.group.position.lerpVectors(b.basePos, targetPos, ease);

          const targetRot = new THREE.Euler(0.08, -0.05, 0);
          b.group.rotation.x = THREE.MathUtils.lerp(b.baseRot.x, targetRot.x, ease);
          b.group.rotation.y = THREE.MathUtils.lerp(b.baseRot.y, targetRot.y, ease);
          b.group.rotation.z = THREE.MathUtils.lerp(b.baseRot.z, targetRot.z, ease);

          const targetScale = 1.35;
          b.currentScale = THREE.MathUtils.lerp(1, targetScale, ease);
          b.group.scale.set(b.currentScale, b.currentScale, b.currentScale);

          if (b.animProgress >= 0.75) {
            b.state = "opening_cover";
          }
        }

        // ── 2. ESTADO: ABERTURA TRIDIMENSIONAL DA CAPA ───────────────────────
        else if (b.state === "opening_cover") {
          b.animProgress = Math.min(1, b.animProgress + delta * 2.2);

          const targetCoverAngle = -Math.PI * 0.96;
          b.coverPivot.rotation.y = THREE.MathUtils.lerp(
            b.coverPivot.rotation.y,
            targetCoverAngle,
            delta * 4.5
          );

          b.group.position.lerp(new THREE.Vector3(0, -0.05, 3.8), delta * 4);

          if (b.coverPivot.rotation.y <= -Math.PI * 0.82) {
            b.state = "opened";
            onBookFullyOpened(b.caderno);
          }
        }

        // ── 3. ESTADO: LIVRO ABERTO EM LEITURA ────────────────────────────────
        else if (b.state === "opened") {
          b.coverPivot.rotation.y = -Math.PI * 0.96;
          b.group.position.set(0, -0.05, 3.8);
        }

        // ── 4. ESTADO: FECHAMENTO DA CAPA ─────────────────────────────────────
        else if (b.state === "closing_cover") {
          b.coverPivot.rotation.y = THREE.MathUtils.lerp(b.coverPivot.rotation.y, 0, delta * 6);

          if (Math.abs(b.coverPivot.rotation.y) < 0.05) {
            b.coverPivot.rotation.y = 0;
            b.state = "returning";
            b.animProgress = 0;
          }
        }

        // ── 5. ESTADO: RETORNO À POSIÇÃO FLUTUANTE ───────────────────────────
        else if (b.state === "returning") {
          b.animProgress = Math.min(1, b.animProgress + delta * 1.8);
          const ease = 1 - Math.pow(1 - b.animProgress, 3);

          b.group.position.lerp(b.basePos, ease);
          b.group.rotation.x = THREE.MathUtils.lerp(b.group.rotation.x, b.baseRot.x, ease);
          b.group.rotation.y = THREE.MathUtils.lerp(b.group.rotation.y, b.baseRot.y, ease);
          b.group.rotation.z = THREE.MathUtils.lerp(b.group.rotation.z, b.baseRot.z, ease);

          b.currentScale = THREE.MathUtils.lerp(b.currentScale, 1, ease);
          b.group.scale.set(b.currentScale, b.currentScale, b.currentScale);

          if (b.animProgress >= 0.98) {
            b.state = "floating";
            b.animProgress = 0;
            activeBookRef.current = null;
          }
        }

        // ── 6. ESTADO: FLUTUAÇÃO ORGÂNICA NORMAL ──────────────────────────────
        else {
          const motionFactor = prefersReducedMotion.current ? 0.15 : 1;
          const floatTime = elapsedTime * b.caderno.floatSpeed + b.caderno.floatOffset;

          if (activeBookRef.current && !isActive) {
            b.group.scale.lerp(new THREE.Vector3(0.7, 0.7, 0.7), delta * 3);
            b.group.position.z = THREE.MathUtils.lerp(b.group.position.z, b.basePos.z - 2.5, delta * 2);
          } else {
            const targetY =
              b.baseY +
              Math.sin(floatTime) * b.caderno.floatAmplitude * motionFactor +
              (isHovered ? 0.2 : 0);

            b.group.position.y = THREE.MathUtils.lerp(b.group.position.y, targetY, delta * 3.5);
            b.group.position.z = THREE.MathUtils.lerp(b.group.position.z, b.basePos.z, delta * 3);

            const rotOscillationX = Math.cos(floatTime * 0.8) * 0.04 * motionFactor;
            const rotOscillationZ = Math.sin(floatTime * 0.6) * 0.03 * motionFactor;

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

            b.currentScale = THREE.MathUtils.lerp(b.currentScale, b.targetScale, delta * 6);
            b.group.scale.set(b.currentScale, b.currentScale, b.currentScale);
          }

          b.coverPivot.rotation.y = THREE.MathUtils.lerp(b.coverPivot.rotation.y, 0, delta * 5);
        }
      });

      // Câmera
      if (camera && !prefersReducedMotion.current && !activeBookRef.current) {
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
      } else if (camera && activeBookRef.current) {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, 0, delta * 3);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.45, delta * 3);
        camera.lookAt(0, 0, 3.8);
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener("resize", handleResize);
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("click", handleClick);

      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }

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
  }, [onHoverCaderno, onSelectCaderno, onBookFullyOpened]);

  // Montagem dos livros na cena
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

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

    cadernos.forEach((caderno, index) => {
      const palette = BOOK_PALETTES[index % BOOK_PALETTES.length];
      const qCount = caderno.questoes.length;

      const bookWidth = 1.35;
      const bookHeight = 1.95;
      const bookThickness = Math.min(0.65, Math.max(0.22, qCount * 0.007 + 0.18));
      const coverThickness = 0.035;

      const bookGroup = new THREE.Group();
      bookGroup.position.set(...caderno.position);
      bookGroup.rotation.set(...caderno.rotation);

      const spineTexture = createSpineTexture(caderno.nome, caderno.materia, palette, qCount);
      const frontCoverTexture = createFrontCoverTexture(
        caderno.nome,
        caderno.materia,
        palette,
        qCount
      );

      // Contracapa Traseira
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

      // Miolo de Páginas de Papel
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

      const pagesMaterials = [
        pagesEdgeMat,
        pagesPlainMat,
        pagesEdgeMat,
        pagesEdgeMat,
        pagesPlainMat,
        pagesPlainMat,
      ];

      const pagesMesh = new THREE.Mesh(pagesGeo, pagesMaterials);
      pagesMesh.position.set(0.035, 0, 0);
      pagesMesh.castShadow = true;
      pagesMesh.receiveShadow = true;
      bookGroup.add(pagesMesh);

      // Lombada Curva
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
      spineMesh.position.set(-bookWidth / 2, 0, 0);
      spineMesh.castShadow = true;
      spineMesh.receiveShadow = true;
      bookGroup.add(spineMesh);

      // Capa Frontal Articulada
      const coverPivot = new THREE.Group();
      coverPivot.position.set(-bookWidth / 2, 0, bookThickness / 2);

      const frontCoverGeo = new THREE.BoxGeometry(bookWidth, bookHeight, coverThickness);
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
        backCoverMat,
        backCoverMat,
        backCoverMat,
        backCoverMat,
        coverFrontMat,
        coverInsideMat,
      ];

      const frontCoverMesh = new THREE.Mesh(frontCoverGeo, frontCoverMaterials);
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
        state: "floating",
        animProgress: 0,
      });
    });
  }, [cadernos]);

  // Se o leitor for fechado, fecha a capa e retorna para a biblioteca
  useEffect(() => {
    if (!selectedCaderno && activeBookRef.current) {
      const active = activeBookRef.current;
      active.state = "closing_cover";
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
