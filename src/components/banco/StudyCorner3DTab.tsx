"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { BookOpen, ChevronDown, ChevronUp, Compass, LampDesk, Loader2, Sparkles } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { buildStudyDeskScene, StudyDeskController } from "./study-corner/deskSceneBuilder";
import {
  BinderHudAndSheet,
  BinderLeftSurface,
  BinderRightSurface,
  useBinderStudyState,
} from "./study-corner/BinderOverlay";
import {
  CameraPreset,
  StudyCornerBlock,
  StudyCornerQuestion,
  UserAnswerStat,
} from "./study-corner/types";

interface StudyCorner3DTabProps {
  user: { id: string; email?: string | null } | null;
  onRequireAuth?: () => void;
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  { pos: THREE.Vector3; target: THREE.Vector3 }
> = {
  desk: {
    pos: new THREE.Vector3(0, 2.55, 3.72),
    target: new THREE.Vector3(0, 0.44, -0.18),
  },
  binder: {
    pos: new THREE.Vector3(0.01, 3.65, 1.12),
    target: new THREE.Vector3(0.01, 0.14, 0.62),
  },
  window: {
    pos: new THREE.Vector3(0.32, 2.15, 1.95),
    target: new THREE.Vector3(0, 1.45, -2.35),
  },
};

function getBinderCameraPose(aspect: number, zoomedIn: boolean) {
  const halfFovRad = THREE.MathUtils.degToRad(44 / 2);
  const tanHalf = Math.tan(halfFovRad);
  const distH = 2.86 / 2 / tanHalf;
  const distW = 4.38 / 2 / (tanHalf * Math.max(0.65, aspect));
  const dist = Math.max(distH, distW) * (zoomedIn ? 0.82 : 1.0);
  return {
    pos: new THREE.Vector3(0.01, 0.16 + dist * 0.99, 0.62 + dist * 0.14),
    target: new THREE.Vector3(0.01, 0.14, 0.62),
  };
}

const _pointerVec = new THREE.Vector2();
const EMPTY_RESULTS_MAP = new Map<string, UserAnswerStat>();
const EMPTY_DUVIDAS_SET = new Set<string>();

export default function StudyCorner3DTab({ user, onRequireAuth }: StudyCorner3DTabProps) {
  const userId = user?.id ?? null;
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const deskControllerRef = useRef<StudyDeskController | null>(null);
  const cameraTransitionRef = useRef<{
    active: boolean;
    pos: THREE.Vector3;
    target: THREE.Vector3;
  }>({
    active: false,
    pos: CAMERA_PRESETS.desk.pos.clone(),
    target: CAMERA_PRESETS.desk.target.clone(),
  });

  const [blocks, setBlocks] = useState<StudyCornerBlock[]>([]);
  const [questions, setQuestions] = useState<StudyCornerQuestion[]>([]);
  const [progressState, setProgressState] = useState<{
    ownerId: string | null;
    resultadosMap: Map<string, UserAnswerStat>;
    duvidasIds: Set<string>;
  }>({
    ownerId: null,
    resultadosMap: EMPTY_RESULTS_MAP,
    duvidasIds: EMPTY_DUVIDAS_SET,
  });
  const [loadingData, setLoadingData] = useState(true);

  const [binderOpen, setBinderOpen] = useState(false);
  const [binderZoomedIn, setBinderZoomedIn] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>("desk");
  const [lampOn, setLampOn] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [hoveringBinder, setHoveringBinder] = useState(false);
  const [webglLost, setWebglLost] = useState(false);
  const [webglUnsupported, setWebglUnsupported] = useState(false);

  const leftSurfaceRef = useRef<HTMLDivElement | null>(null);
  const rightSurfaceRef = useRef<HTMLDivElement | null>(null);
  const surfaceInteractiveRef = useRef(false);
  const binderZoomedInRef = useRef(binderZoomedIn);

  const binderOpenRef = useRef(binderOpen);
  useEffect(() => {
    binderOpenRef.current = binderOpen;
  }, [binderOpen]);
  useEffect(() => {
    binderZoomedInRef.current = binderZoomedIn;
  }, [binderZoomedIn]);

  // ── Load Supabase Data (Notion Blocks + Cached Questions + User History) ──
  useEffect(() => {
    let cancelled = false;
    const fetchStudyData = async () => {
      try {
        const blocksPromise = supabase
          .from("notion_blocks")
          .select("id, block_id, nome, descricao, materia, ordem")
          .order("ordem", { ascending: true, nullsFirst: false });

        const questionsPromise = (async () => {
          const allRows: StudyCornerQuestion[] = [];
          let from = 0;
          const pageSize = 1000;
          while (true) {
            const { data, error } = await supabase
              .from("notion_questoes_banco")
              .select(
                "id, bloco_raiz_id, caso_id, caso_nome, numero, topico, categoria, enunciado_texto, imagens_urls, gabarito_texto, gabarito_imagens_urls"
              )
              .range(from, from + pageSize - 1);
            if (error || !data || data.length === 0) break;
            for (const row of data as Array<Record<string, unknown>>) {
              allRows.push({
                id: String(row.id ?? ""),
                bloco_raiz_id: String(row.bloco_raiz_id ?? ""),
                caso_id: row.caso_id ? String(row.caso_id) : null,
                caso_nome: String(row.caso_nome ?? "Geral"),
                numero: String(row.numero ?? ""),
                topico: String(row.topico ?? ""),
                categoria: String(row.categoria ?? "media"),
                enunciado_texto: row.enunciado_texto ? String(row.enunciado_texto) : null,
                imagens_urls: Array.isArray(row.imagens_urls) ? (row.imagens_urls as string[]) : [],
                gabarito_texto: row.gabarito_texto ? String(row.gabarito_texto) : null,
                gabarito_imagens_urls: Array.isArray(row.gabarito_imagens_urls)
                  ? (row.gabarito_imagens_urls as string[])
                  : [],
              });
            }
            if (data.length < pageSize) break;
            from += pageSize;
          }
          return allRows;
        })();

        const [blocksRes, allQuestions] = await Promise.all([blocksPromise, questionsPromise]);
        if (cancelled) return;
        setBlocks((blocksRes.data as StudyCornerBlock[]) ?? []);
        setQuestions(allQuestions);
      } catch (err) {
        console.error("Erro ao carregar dados do Cantinho 3D:", err);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    };
    void fetchStudyData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const fetchUserProgress = async () => {
      try {
        const [respRes, duvRes] = await Promise.all([
          supabase
            .from("notion_respostas")
            .select("questao_id, correto, status, data, horario")
            .eq("user_id", userId),
          supabase
            .from("notion_duvidas")
            .select("questao_id")
            .eq("user_id", userId),
        ]);
        if (cancelled) return;

        const grouped = new Map<string, Array<{ ok: boolean; ts: number }>>();
        for (const r of (respRes.data ?? []) as Array<Record<string, unknown>>) {
          const qid = String(r.questao_id ?? "");
          const ok = r.correto === "Sim" || r.status === "Acertei";
          const dStr = r.data ? `${r.data}T${r.horario || "00:00:00"}` : "";
          const ts = dStr ? new Date(dStr).getTime() : 0;
          const arr = grouped.get(qid) ?? [];
          arr.push({ ok, ts });
          grouped.set(qid, arr);
        }

        const nextMap = new Map<string, UserAnswerStat>();
        for (const [qid, list] of grouped.entries()) {
          list.sort((a, b) => a.ts - b.ts);
          const last = list[list.length - 1];
          nextMap.set(qid, {
            ultimo: last?.ok ? "acerto" : "erro",
            totalAcertos: list.filter((x) => x.ok).length,
            totalErros: list.filter((x) => !x.ok).length,
          });
        }

        const nextDuvidas = new Set(
          ((duvRes.data ?? []) as Array<{ questao_id: string }>).map((d) => String(d.questao_id))
        );

        setProgressState({
          ownerId: userId,
          resultadosMap: nextMap,
          duvidasIds: nextDuvidas,
        });
      } catch (err) {
        console.error("Erro ao carregar progresso no Cantinho 3D:", err);
      }
    };
    void fetchUserProgress();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activeResultadosMap =
    userId && progressState.ownerId === userId ? progressState.resultadosMap : EMPTY_RESULTS_MAP;
  const activeDuvidasIds =
    userId && progressState.ownerId === userId ? progressState.duvidasIds : EMPTY_DUVIDAS_SET;

  const metrics = useMemo(() => {
    let acertos = 0;
    for (const stat of activeResultadosMap.values()) {
      if (stat.ultimo === "acerto") acertos++;
    }
    const subjectMap = new Map<string, number>();
    for (const b of blocks) {
      const m = (b.materia || "Geral").replace(/^[^\p{L}\p{N}]+/u, "").trim() || "Geral";
      subjectMap.set(m, (subjectMap.get(m) ?? 0) + 1);
    }
    return {
      totalCadernos: blocks.length,
      totalQuestoes: questions.length,
      totalAcertos: acertos,
      subjectSummaries: Array.from(subjectMap.entries()).map(([name, count]) => ({ name, count })),
    };
  }, [blocks, questions, activeResultadosMap]);

  const metricsRef = useRef(metrics);

  useEffect(() => {
    metricsRef.current = metrics;
    deskControllerRef.current?.updateMetrics(metrics);
  }, [metrics]);

  const openBinderView = useCallback(() => {
    const container = canvasMountRef.current;
    const aspect =
      container && container.clientHeight > 0
        ? container.clientWidth / container.clientHeight
        : 16 / 9;
    const pose = getBinderCameraPose(aspect, binderZoomedInRef.current);
    setBinderOpen(true);
    setCameraPreset("binder");
    deskControllerRef.current?.setBinderOpen(true);
    cameraTransitionRef.current = {
      active: true,
      pos: pose.pos,
      target: pose.target,
    };
  }, []);

  const toggleBinderZoom = useCallback(() => {
    setBinderZoomedIn((prev) => {
      const next = !prev;
      const container = canvasMountRef.current;
      const aspect =
        container && container.clientHeight > 0
          ? container.clientWidth / container.clientHeight
          : 16 / 9;
      const pose = getBinderCameraPose(aspect, next);
      cameraTransitionRef.current = {
        active: true,
        pos: pose.pos,
        target: pose.target,
      };
      return next;
    });
  }, []);

  const closeBinderToDesk = useCallback(() => {
    setBinderOpen(false);
    setBinderZoomedIn(false);
    setCameraPreset("desk");
    deskControllerRef.current?.setBinderOpen(false);
    cameraTransitionRef.current = {
      active: true,
      pos: CAMERA_PRESETS.desk.pos.clone(),
      target: CAMERA_PRESETS.desk.target.clone(),
    };
  }, []);

  const selectPreset = useCallback(
    (preset: CameraPreset) => {
      if (preset === "binder") {
        openBinderView();
        return;
      }
      setBinderOpen(false);
      setCameraPreset(preset);
      deskControllerRef.current?.setBinderOpen(false);
      cameraTransitionRef.current = {
        active: true,
        pos: CAMERA_PRESETS[preset].pos.clone(),
        target: CAMERA_PRESETS[preset].target.clone(),
      };
    },
    [openBinderView]
  );

  const toggleLamp = useCallback(() => {
    const ctrl = deskControllerRef.current;
    if (!ctrl) return;
    const next = !ctrl.getLampOn();
    ctrl.setLampOn(next);
    setLampOn(next);
  }, []);

  // ── Mount Three.js Scene Once ──────────────────────────────────────────────
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const probe = document.createElement("canvas");
        const gl = probe.getContext("webgl2");
        if (!gl) return true;
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setWebglUnsupported(true));
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 1280, container.clientHeight || 720);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "1";
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const handleContextRestored = () => {
      setWebglLost(false);
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);

    const scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    let viewW = container.clientWidth || 1280;
    let viewH = container.clientHeight || 720;
    const camera = new THREE.PerspectiveCamera(44, viewW / viewH, 0.1, 60);
    camera.position.copy(CAMERA_PRESETS.desk.pos);

    // Locked camera: OrbitControls is used only to hold the smooth lookAt target
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(CAMERA_PRESETS.desk.target);
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableDamping = false;
    controls.update();

    const deskCtrl = buildStudyDeskScene(
      scene,
      renderer.capabilities.getMaxAnisotropy(),
      isSoftwareGl,
      metricsRef.current
    );
    deskControllerRef.current = deskCtrl;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting on binder & lamp
    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };
    let lastMoveCheck = 0;

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _pointerVec.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      _pointerVec.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const onPointerMove = (ev: PointerEvent) => {
      if (binderOpenRef.current) {
        if (hoveringBinder) setHoveringBinder(false);
        deskCtrl.setHoverBinder(false);
        renderer.domElement.style.cursor = "default";
        return;
      }
      const now = performance.now();
      if (now - lastMoveCheck < 45) return;
      lastMoveCheck = now;

      updatePointer(ev);
      raycaster.setFromCamera(_pointerVec, camera);
      const hitBinder = raycaster.intersectObjects(deskCtrl.binderHitTargets, false).length > 0;
      const hitLamp = raycaster.intersectObjects(deskCtrl.lampHitTargets, false).length > 0;
      deskCtrl.setHoverBinder(hitBinder);
      setHoveringBinder(hitBinder);
      renderer.domElement.style.cursor = hitBinder || hitLamp ? "pointer" : "default";
    };

    const onPointerUp = (ev: PointerEvent) => {
      if (binderOpenRef.current) return;
      const dist = Math.hypot(ev.clientX - pointerDownPos.x, ev.clientY - pointerDownPos.y);
      if (dist > 7) return; // Was dragging camera orbit, not a click

      updatePointer(ev);
      raycaster.setFromCamera(_pointerVec, camera);

      if (raycaster.intersectObjects(deskCtrl.binderHitTargets, false).length > 0) {
        openBinderView();
        return;
      }
      if (raycaster.intersectObjects(deskCtrl.lampHitTargets, false).length > 0) {
        const next = !deskCtrl.getLampOn();
        deskCtrl.setLampOn(next);
        setLampOn(next);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      viewW = container.clientWidth || 1280;
      viewH = container.clientHeight || 720;
      camera.aspect = viewW / viewH;
      camera.updateProjectionMatrix();
      renderer.setSize(viewW, viewH);
      if (binderOpenRef.current) {
        const pose = getBinderCameraPose(viewW / viewH, binderZoomedInRef.current);
        cameraTransitionRef.current = { active: true, pos: pose.pos, target: pose.target };
      }
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation loop with software WebGL afterDraw pacing
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    const afterDraw = (cb: () => void) => {
      try {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.ALREADY_SIGNALED;
          if (state === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } catch {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (disposed) return;
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (cameraTransitionRef.current.active) {
        const dt = Math.min(delta, 0.08);
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          cameraTransitionRef.current.pos.x,
          6.5,
          dt
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          cameraTransitionRef.current.pos.y,
          6.5,
          dt
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          cameraTransitionRef.current.pos.z,
          6.5,
          dt
        );
        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          cameraTransitionRef.current.target.x,
          6.5,
          dt
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          cameraTransitionRef.current.target.y,
          6.5,
          dt
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          cameraTransitionRef.current.target.z,
          6.5,
          dt
        );

        const posErr = camera.position.distanceTo(cameraTransitionRef.current.pos);
        const tgtErr = controls.target.distanceTo(cameraTransitionRef.current.target);
        if (posErr < 0.015 && tgtErr < 0.015) {
          camera.position.copy(cameraTransitionRef.current.pos);
          controls.target.copy(cameraTransitionRef.current.target);
          cameraTransitionRef.current.active = false;
        }
      }

      deskCtrl.update(delta, elapsed);
      controls.update();
      renderer.render(scene, camera);
      deskCtrl.syncSurfaceOverlay(
        camera,
        viewW,
        viewH,
        leftSurfaceRef.current,
        rightSurfaceRef.current,
        surfaceInteractiveRef.current
      );

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      deskCtrl.syncSurfaceOverlay(
        camera,
        viewW,
        viewH,
        leftSurfaceRef.current,
        rightSurfaceRef.current,
        surfaceInteractiveRef.current
      );
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      deskCtrl.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      deskControllerRef.current = null;
    };
    // Intentionally mounted once for stable WebGL context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist Answers & Dúvidas to Supabase ─────────────────────────────────
  const handleRecordAnswer = useCallback(
    async (questaoId: string, isCorrect: boolean) => {
      if (!userId) {
        onRequireAuth?.();
        return;
      }
      const now = new Date();
      const date = now.toISOString().slice(0, 10);
      const time = now.toTimeString().slice(0, 8);

      const { error } = await supabase.from("notion_respostas").insert({
        questao_id: questaoId,
        resposta_usuario: isCorrect ? "Acerto" : "Erro",
        correto: isCorrect ? "Sim" : "Não",
        data: date,
        horario: time,
        status: isCorrect ? "Acertei" : "Errei",
        user_id: userId,
      });
      if (error) {
        console.error("Erro ao salvar resposta:", error.message);
        return;
      }

      setProgressState((prev) => {
        const baseMap = prev.ownerId === userId ? prev.resultadosMap : EMPTY_RESULTS_MAP;
        const baseDuv = prev.ownerId === userId ? prev.duvidasIds : EMPTY_DUVIDAS_SET;
        const nextMap = new Map(baseMap);
        const curr = nextMap.get(questaoId);
        nextMap.set(questaoId, {
          ultimo: isCorrect ? "acerto" : "erro",
          totalAcertos: (curr?.totalAcertos ?? 0) + (isCorrect ? 1 : 0),
          totalErros: (curr?.totalErros ?? 0) + (isCorrect ? 0 : 1),
        });
        return {
          ownerId: userId,
          resultadosMap: nextMap,
          duvidasIds: baseDuv,
        };
      });
    },
    [userId, onRequireAuth]
  );

  const handleToggleDuvida = useCallback(
    async (questaoId: string, marcar: boolean) => {
      if (!userId) {
        onRequireAuth?.();
        return;
      }
      setProgressState((prev) => {
        const baseMap = prev.ownerId === userId ? prev.resultadosMap : EMPTY_RESULTS_MAP;
        const baseDuv = prev.ownerId === userId ? prev.duvidasIds : EMPTY_DUVIDAS_SET;
        const nextDuv = new Set(baseDuv);
        if (marcar) nextDuv.add(questaoId);
        else nextDuv.delete(questaoId);
        return {
          ownerId: userId,
          resultadosMap: baseMap,
          duvidasIds: nextDuv,
        };
      });
      try {
        if (marcar) {
          await supabase.from("notion_duvidas").insert({ user_id: userId, questao_id: questaoId });
        } else {
          await supabase
            .from("notion_duvidas")
            .delete()
            .eq("user_id", userId)
            .eq("questao_id", questaoId);
        }
      } catch (err) {
        console.error("Erro ao atualizar dúvida:", err);
      }
    },
    [userId, onRequireAuth]
  );

  const binderState = useBinderStudyState({
    blocks,
    questions,
    resultadosMap: activeResultadosMap,
    duvidasIds: activeDuvidasIds,
    onRecordAnswer: handleRecordAnswer,
    isAuthenticated: !!userId,
    onRequireAuth: () => onRequireAuth?.(),
  });

  useEffect(() => {
    surfaceInteractiveRef.current = binderOpen && !binderState.activeBlockId;
  }, [binderOpen, binderState.activeBlockId]);

  const handleCloseToDesk = useCallback(() => {
    binderState.closeSheet();
    closeBinderToDesk();
  }, [binderState, closeBinderToDesk]);

  return (
    <div className="relative w-full h-[calc(100vh-148px)] min-h-[580px] rounded-2xl overflow-hidden border border-white/[0.08] bg-[#0b0d17] shadow-2xl">
      {/* Isolated WebGL Mount Container */}
      <div ref={canvasMountRef} className="relative w-full h-full" />

      {/* 3D-Projected SurfaceGui Pages attached directly onto Left & Right 3D Binder Pages */}
      <div className="absolute inset-0 z-[5] pointer-events-none overflow-hidden">
        <div
          ref={leftSurfaceRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "480px",
            height: "622px",
            transformOrigin: "0 0",
            opacity: 0,
            visibility: "hidden",
            pointerEvents: "none",
          }}
        >
          <BinderLeftSurface state={binderState} />
        </div>
        <div
          ref={rightSurfaceRef}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "480px",
            height: "622px",
            transformOrigin: "0 0",
            opacity: 0,
            visibility: "hidden",
            pointerEvents: "none",
          }}
        >
          <BinderRightSurface
            state={binderState}
            resultadosMap={activeResultadosMap}
            duvidasIds={activeDuvidasIds}
          />
        </div>
      </div>

      {/* Fallback when WebGL unavailable or lost */}
      {(webglUnsupported || webglLost) && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#120d16] p-6 text-center gap-3">
          <BookOpen size={30} className="text-[#e3be76]" />
          <p className="text-sm font-medium text-[#f5e7cf]">
            {webglLost
              ? "O contexto gráfico 3D foi suspenso temporariamente."
              : "Seu navegador não suportou WebGL 3D."}
          </p>
        </div>
      )}

      {/* Minimal Top-Left Title Badge on Desk View (unobtrusive) */}
      {!binderOpen && (
        <div className="absolute top-4 left-4 z-10 pointer-events-none flex flex-col gap-1">
          <div className="px-3.5 py-2 rounded-xl bg-[#140e18]/90 border border-[#d4af6a]/25 text-[#f7ecd7] shadow-lg">
            <div className="text-xs font-semibold tracking-tight">Cantinho de Estudos 3D</div>
            <div className="text-[11px] text-[#cbb38e] tabular-nums">
              {loadingData
                ? "Sincronizando cadernos..."
                : `${metrics.totalCadernos} cadernos · ${metrics.totalQuestoes} questões`}
            </div>
          </div>
          {hoveringBinder && (
            <div className="px-3 py-1 rounded-lg bg-[#e3be76] text-[#1f121e] text-[11px] font-semibold shadow-md w-fit">
              Clique para abrir o Caderno
            </div>
          )}
        </div>
      )}

      {/* Minimal Desk HUD over 3D SurfaceGui Binder + Case Study Sheet ("Folha") */}
      {binderOpen && (
        <BinderHudAndSheet
          state={binderState}
          resultadosMap={activeResultadosMap}
          duvidasIds={activeDuvidasIds}
          onCloseToDesk={handleCloseToDesk}
          onToggleDuvida={handleToggleDuvida}
          isAuthenticated={!!userId}
          onRequireAuth={() => onRequireAuth?.()}
          zoomedIn={binderZoomedIn}
          onToggleZoom={toggleBinderZoom}
        />
      )}

      {/* Collapsible Bottom Control Dock (Desk View Only — Zero Viewport Occlusion) */}
      {!binderOpen && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center max-w-[94vw]">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="mb-1.5 px-3 py-1 rounded-full bg-[#16101b]/95 border border-[#d4af6a]/25 text-[11px] text-[#e6cf9f] hover:text-white flex items-center gap-1.5 shadow cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            <span>{dockCollapsed ? "Mostrar controles" : "Ocultar controles"}</span>
          </button>

          {!dockCollapsed && (
            <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-2xl bg-[#16101b]/95 border border-[#d4af6a]/30 shadow-2xl flex-wrap justify-center">
              <button
                type="button"
                onClick={openBinderView}
                disabled={loadingData}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#e3be76] hover:bg-[#edd091] text-[#1f121e] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60"
              >
                {loadingData ? <Loader2 size={13} className="animate-spin" /> : <BookOpen size={13} />}
                <span>Abrir Caderno</span>
              </button>

              <div className="h-5 w-px bg-white/10 hidden sm:block" />

              <button
                type="button"
                onClick={() => selectPreset("desk")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  cameraPreset === "desk"
                    ? "bg-white/15 text-[#fff2da]"
                    : "text-[#cbb597] hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <Compass size={13} />
                <span>Mesa</span>
              </button>

              <button
                type="button"
                onClick={() => selectPreset("window")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  cameraPreset === "window"
                    ? "bg-white/15 text-[#fff2da]"
                    : "text-[#cbb597] hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <Sparkles size={13} />
                <span>Janela</span>
              </button>

              <button
                type="button"
                onClick={toggleLamp}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  lampOn
                    ? "bg-amber-500/20 text-amber-200 border border-amber-400/35"
                    : "text-[#cbb597] hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <LampDesk size={13} />
                <span>{lampOn ? "Luminária acesa" : "Luminária apagada"}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
