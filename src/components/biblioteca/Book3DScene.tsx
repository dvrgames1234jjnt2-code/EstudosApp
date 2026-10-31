"use client";

import React, { useEffect, useRef, useCallback } from "react";
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
  state: "floating" | "approaching" | "opening_cover" | "opened" | "closing_cover" | "returning";
  animProgress: number;
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

  // Refs estáveis para evitar re-criação do loop
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const booksRef = useRef<BookMeshObject[]>([]);
  const hoveredBookRef = useRef<BookMeshObject | null>(null);
  const activeBookRef = useRef<BookMeshObject | null>(null);
  const mouseNormRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(performance.now());
  const lastTimeRef = useRef<number>(performance.now());
  const mousePointLightRef = useRef<THREE.PointLight | null>(null);
  const prefersReducedMotion = useRef(false);

  // Callbacks em refs para não forçar re-init do Three.js
  const onSelectRef = useRef(onSelectCaderno);
  const onOpenedRef = useRef(onBookFullyOpened);
  const onHoverRef = useRef(onHoverCaderno);
  useEffect(() => { onSelectRef.current = onSelectCaderno; }, [onSelectCaderno]);
  useEffect(() => { onOpenedRef.current = onBookFullyOpened; }, [onBookFullyOpened]);
  useEffect(() => { onHoverRef.current = onHoverCaderno; }, [onHoverCaderno]);

  // ─── INICIALIZAÇÃO THREE.JS — roda UMA VEZ ───────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Garantir que o container tem dimensões antes de criar o renderer
    const getSize = () => ({
      w: container.clientWidth || window.innerWidth,
      h: container.clientHeight || window.innerHeight,
    });

    prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const { w, h } = getSize();

    // Cena
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07090e, 0.035);
    sceneRef.current = scene;

    // Câmera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0.5, 7.8);
    cameraRef.current = camera;

    // Renderer — com fallback de contexto perdido
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "default", // "high-performance" pode causar problemas em iGPU
      });
    } catch (e) {
      console.warn("[Biblioteca3D] WebGL não disponível:", e);
      return;
    }

    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    // Recuperação de contexto perdido (crash de GPU)
    renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    });
    renderer.domElement.addEventListener("webglcontextrestored", () => {
      animate();
    });

    // Iluminação
    scene.add(new THREE.AmbientLight(0xffeedd, 1.4));

    const dirLight = new THREE.DirectionalLight(0xffecc0, 2.2);
    dirLight.position.set(4, 7, 6);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(512, 512);
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x406085, 1.0);
    rimLight.position.set(-6, 3, -4);
    scene.add(rimLight);

    const mouseLight = new THREE.PointLight(0xffdf99, 1.5, 9);
    mouseLight.position.set(0, 0, 5);
    scene.add(mouseLight);
    mousePointLightRef.current = mouseLight;

    // Partículas de poeira — reduzido para 80 (era 130)
    const PARTICLE_COUNT = 80;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PARTICLE_COUNT * 3);
    const pSpd = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pPos[i * 3]     = (Math.random() - 0.5) * 16;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 10;
      pSpd[i] = 0.2 + Math.random() * 0.35;
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));

    const pCanvas = document.createElement("canvas");
    pCanvas.width = pCanvas.height = 32;
    const pCtx = pCanvas.getContext("2d");
    if (pCtx) {
      const g = pCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "rgba(255,230,160,1)");
      g.addColorStop(0.4, "rgba(230,180,80,0.5)");
      g.addColorStop(1, "rgba(200,150,50,0)");
      pCtx.fillStyle = g;
      pCtx.beginPath();
      pCtx.arc(16, 16, 16, 0, Math.PI * 2);
      pCtx.fill();
    }
    const pTex = new THREE.CanvasTexture(pCanvas);
    const pMat = new THREE.PointsMaterial({
      size: 0.11,
      map: pTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.65,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // Resize
    const handleResize = () => {
      const { w: nw, h: nh } = getSize();
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener("resize", handleResize);

    // Mouse
    const handleMouseMove = (e: MouseEvent) => {
      if (activeBookRef.current) return;
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouseNormRef.current = { x, y };

      if (mousePointLightRef.current) {
        mousePointLightRef.current.position.x = x * 4;
        mousePointLightRef.current.position.y = y * 2.5;
      }

      raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), camera);
      const meshes: THREE.Object3D[] = [];
      booksRef.current.forEach((b) => {
        if (b.state === "floating") {
          b.group.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              (child as any)._bookRef = b;
              meshes.push(child);
            }
          });
        }
      });

      const hits = raycasterRef.current.intersectObjects(meshes, false);
      if (hits.length > 0) {
        const hitBook: BookMeshObject = (hits[0].object as any)._bookRef;
        if (hitBook && hitBook !== hoveredBookRef.current) {
          if (hoveredBookRef.current) hoveredBookRef.current.targetScale = 1;
          hoveredBookRef.current = hitBook;
          hitBook.targetScale = 1.09;
          container.style.cursor = "pointer";
          onHoverRef.current(hitBook.caderno, { x: e.clientX, y: e.clientY });
        }
      } else {
        if (hoveredBookRef.current) {
          hoveredBookRef.current.targetScale = 1;
          hoveredBookRef.current = null;
          container.style.cursor = "default";
          onHoverRef.current(null);
        }
      }
    };

    const handleClick = () => {
      if (hoveredBookRef.current && !activeBookRef.current) {
        const book = hoveredBookRef.current;
        activeBookRef.current = book;
        hoveredBookRef.current = null;
        container.style.cursor = "default";
        onHoverRef.current(null);
        book.state = "approaching";
        book.animProgress = 0;
        onSelectRef.current(book.caderno);
      }
    };

    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("click", handleClick);

    // ── LOOP DE ANIMAÇÃO ─────────────────────────────────────────────────────
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);

      const now = performance.now();
      const delta = Math.min((now - lastTimeRef.current) / 1000, 0.05); // cap em 50ms
      const elapsed = (now - startTimeRef.current) / 1000;
      lastTimeRef.current = now;

      // Partículas
      const pos = pGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        pos[i * 3 + 1] += pSpd[i] * delta * 0.4;
        pos[i * 3]     += Math.sin(elapsed * 0.3 + i) * 0.003;
        if (pos[i * 3 + 1] > 4.5) pos[i * 3 + 1] = -4.5;
      }
      pGeo.attributes.position.needsUpdate = true;

      booksRef.current.forEach((b) => {
        const isHovered = hoveredBookRef.current === b;

        if (b.state === "approaching") {
          b.animProgress = Math.min(1, b.animProgress + delta * 1.6);
          const t = b.animProgress;
          const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

          b.group.position.lerpVectors(b.basePos, new THREE.Vector3(0, -0.05, 3.8), ease);
          b.group.rotation.x = THREE.MathUtils.lerp(b.baseRot.x, 0.08, ease);
          b.group.rotation.y = THREE.MathUtils.lerp(b.baseRot.y, -0.05, ease);
          b.group.rotation.z = THREE.MathUtils.lerp(b.baseRot.z, 0, ease);

          b.currentScale = THREE.MathUtils.lerp(1, 1.35, ease);
          b.group.scale.setScalar(b.currentScale);

          if (b.animProgress >= 0.75) {
            b.state = "opening_cover";
          }

        } else if (b.state === "opening_cover") {
          b.coverPivot.rotation.y = THREE.MathUtils.lerp(
            b.coverPivot.rotation.y,
            -Math.PI * 0.96,
            delta * 4.5
          );
          b.group.position.lerp(new THREE.Vector3(0, -0.05, 3.8), delta * 4);

          if (b.coverPivot.rotation.y <= -Math.PI * 0.82) {
            b.state = "opened";
            onOpenedRef.current(b.caderno);
          }

        } else if (b.state === "opened") {
          b.coverPivot.rotation.y = -Math.PI * 0.96;
          b.group.position.set(0, -0.05, 3.8);

        } else if (b.state === "closing_cover") {
          b.coverPivot.rotation.y = THREE.MathUtils.lerp(b.coverPivot.rotation.y, 0, delta * 6);
          if (Math.abs(b.coverPivot.rotation.y) < 0.05) {
            b.coverPivot.rotation.y = 0;
            b.state = "returning";
            b.animProgress = 0;
          }

        } else if (b.state === "returning") {
          b.animProgress = Math.min(1, b.animProgress + delta * 1.8);
          const ease = 1 - Math.pow(1 - b.animProgress, 3);

          b.group.position.lerp(b.basePos, ease);
          b.group.rotation.x = THREE.MathUtils.lerp(b.group.rotation.x, b.baseRot.x, ease);
          b.group.rotation.y = THREE.MathUtils.lerp(b.group.rotation.y, b.baseRot.y, ease);
          b.group.rotation.z = THREE.MathUtils.lerp(b.group.rotation.z, b.baseRot.z, ease);
          b.currentScale = THREE.MathUtils.lerp(b.currentScale, 1, ease);
          b.group.scale.setScalar(b.currentScale);

          if (b.animProgress >= 0.98) {
            b.state = "floating";
            b.animProgress = 0;
            activeBookRef.current = null;
          }

        } else {
          // FLUTUAÇÃO
          const motionFactor = prefersReducedMotion.current ? 0.15 : 1;
          const ft = elapsed * b.caderno.floatSpeed + b.caderno.floatOffset;

          if (activeBookRef.current && activeBookRef.current !== b) {
            // Outros livros recuam enquanto um está aberto
            b.group.scale.lerp(new THREE.Vector3(0.72, 0.72, 0.72), delta * 2.5);
            b.group.position.z = THREE.MathUtils.lerp(b.group.position.z, b.basePos.z - 2.2, delta * 1.5);
          } else {
            const targetY =
              b.baseY +
              Math.sin(ft) * b.caderno.floatAmplitude * motionFactor +
              (isHovered ? 0.18 : 0);

            b.group.position.y = THREE.MathUtils.lerp(b.group.position.y, targetY, delta * 3.5);
            b.group.position.z = THREE.MathUtils.lerp(b.group.position.z, b.basePos.z, delta * 3);

            if (isHovered) {
              b.group.rotation.x = THREE.MathUtils.lerp(
                b.group.rotation.x,
                b.baseRot.x - mouseNormRef.current.y * 0.22,
                delta * 5
              );
              b.group.rotation.y = THREE.MathUtils.lerp(
                b.group.rotation.y,
                b.baseRot.y + mouseNormRef.current.x * 0.32,
                delta * 5
              );
            } else {
              b.group.rotation.x = THREE.MathUtils.lerp(
                b.group.rotation.x,
                b.baseRot.x + Math.cos(ft * 0.8) * 0.04 * motionFactor,
                delta * 2.5
              );
              b.group.rotation.y = THREE.MathUtils.lerp(
                b.group.rotation.y,
                b.baseRot.y + Math.sin(ft * 0.5) * 0.05 * motionFactor,
                delta * 2.5
              );
            }

            b.group.rotation.z = THREE.MathUtils.lerp(
              b.group.rotation.z,
              b.baseRot.z + Math.sin(ft * 0.6) * 0.03 * motionFactor,
              delta * 2.5
            );

            b.currentScale = THREE.MathUtils.lerp(b.currentScale, b.targetScale, delta * 6);
            b.group.scale.setScalar(b.currentScale);
          }

          b.coverPivot.rotation.y = THREE.MathUtils.lerp(b.coverPivot.rotation.y, 0, delta * 5);
        }
      });

      // Câmera suave
      if (!prefersReducedMotion.current && !activeBookRef.current) {
        camera.position.x = THREE.MathUtils.lerp(camera.position.x, mouseNormRef.current.x * 0.4, delta * 2);
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.5 + mouseNormRef.current.y * 0.22, delta * 2);
        camera.lookAt(0, 0, 0);
      } else if (activeBookRef.current) {
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

      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

      booksRef.current.forEach((b) => {
        b.group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => m?.dispose());
          }
        });
      });
      booksRef.current = [];

      pGeo.dispose();
      pMat.dispose();
      pTex.dispose();

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // sem dependências — callbacks via ref

  // ─── MONTAGEM DOS LIVROS — roda quando cadernos mudam ────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove livros anteriores
    booksRef.current.forEach((b) => {
      scene.remove(b.group);
      b.group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => m?.dispose());
        }
      });
    });
    booksRef.current = [];
    hoveredBookRef.current = null;
    activeBookRef.current = null;

    const pageEdgesTex = createPageEdgesTexture();

    cadernos.forEach((caderno, index) => {
      const palette = BOOK_PALETTES[index % BOOK_PALETTES.length];
      const qCount = caderno.questoes.length;

      const BW = 1.35;
      const BH = 1.95;
      const BT = Math.min(0.65, Math.max(0.22, qCount * 0.007 + 0.18));
      const CT = 0.035;

      const group = new THREE.Group();
      group.position.set(...caderno.position);
      group.rotation.set(...caderno.rotation);

      const spineTex  = createSpineTexture(caderno.nome, caderno.materia, palette, qCount);
      const frontTex  = createFrontCoverTexture(caderno.nome, caderno.materia, palette, qCount);

      // Contracapa
      const backMat = new THREE.MeshStandardMaterial({ color: palette.bg, roughness: 0.65, metalness: 0.12 });
      const backMesh = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, CT), backMat);
      backMesh.position.set(0, 0, -BT / 2 + CT / 2);
      backMesh.castShadow = true;
      group.add(backMesh);

      // Miolo de páginas
      const edgeMat  = new THREE.MeshStandardMaterial({ map: pageEdgesTex, roughness: 0.9, color: 0xf5f0de });
      const plainMat = new THREE.MeshStandardMaterial({ color: 0xede4cd, roughness: 0.95 });
      const pagesMesh = new THREE.Mesh(
        new THREE.BoxGeometry(BW - 0.07, BH - 0.08, BT - CT * 2),
        [edgeMat, plainMat, edgeMat, edgeMat, plainMat, plainMat]
      );
      pagesMesh.position.set(0.035, 0, 0);
      pagesMesh.castShadow = true;
      group.add(pagesMesh);

      // Lombada
      const spineMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(BT / 2, BT / 2, BH, 16, 1, false, Math.PI * 0.5, Math.PI),
        new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.5, metalness: 0.2 })
      );
      spineMesh.position.set(-BW / 2, 0, 0);
      spineMesh.castShadow = true;
      group.add(spineMesh);

      // Capa frontal articulada
      const coverPivot = new THREE.Group();
      coverPivot.position.set(-BW / 2, 0, BT / 2);

      const frontMesh = new THREE.Mesh(
        new THREE.BoxGeometry(BW, BH, CT),
        [backMat, backMat, backMat, backMat,
          new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.45, metalness: 0.25 }),
          new THREE.MeshStandardMaterial({ color: 0x221a15, roughness: 0.8 })]
      );
      frontMesh.position.set(BW / 2, 0, CT / 2);
      frontMesh.castShadow = true;
      coverPivot.add(frontMesh);
      group.add(coverPivot);

      scene.add(group);

      booksRef.current.push({
        group,
        caderno,
        coverPivot,
        baseY: caderno.position[1],
        basePos: new THREE.Vector3(...caderno.position),
        baseRot: new THREE.Euler(...caderno.rotation),
        targetScale: 1,
        currentScale: 1,
        state: "floating",
        animProgress: 0,
      });
    });
  }, [cadernos]);

  // ─── FECHAR LIVRO quando leitor fecha ────────────────────────────────────────
  useEffect(() => {
    if (!selectedCaderno && activeBookRef.current) {
      activeBookRef.current.state = "closing_cover";
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
