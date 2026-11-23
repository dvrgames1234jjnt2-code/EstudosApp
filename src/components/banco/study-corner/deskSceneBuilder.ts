import * as THREE from "three";
import {
  createWoodTexture,
  createLeatherCoverTexture,
  createPaperTexture,
  createStickyNoteTexture,
  createCalendarTexture,
  createPostcardTexture,
  createNightSkyTexture,
  createCurtainTexture,
  createPackLabelTexture,
  createContactShadowTexture,
} from "./deskTextures";

export interface StudyDeskMetrics {
  totalCadernos: number;
  totalQuestoes: number;
  totalAcertos: number;
  subjectSummaries: Array<{ name: string; count: number }>;
}

export interface StudyDeskController {
  binderHitTargets: THREE.Object3D[];
  lampHitTargets: THREE.Object3D[];
  trophyHitTargets: THREE.Object3D[];
  setBinderOpen: (open: boolean) => void;
  setLampOn: (on: boolean) => void;
  getLampOn: () => boolean;
  updateMetrics: (nextMetrics: StudyDeskMetrics) => void;
  update: (delta: number, elapsed: number) => boolean;
  syncSurfaceOverlay: (
    camera: THREE.Camera,
    viewportW: number,
    viewportH: number,
    leftEl: HTMLElement | null,
    rightEl: HTMLElement | null,
    interactive: boolean
  ) => void;
  setHoverBinder: (hovered: boolean) => void;
  dispose: () => void;
}

const SURFACE_HTML_W = 480;
const SURFACE_HTML_H = 622;
const _projVec = new THREE.Vector3();

function computeQuadMatrix3d(
  quad: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3],
  worldMatrix: THREE.Matrix4,
  camera: THREE.Camera,
  viewW: number,
  viewH: number
): string | null {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 4; i++) {
    _projVec.copy(quad[i]).applyMatrix4(worldMatrix).project(camera);
    if (_projVec.z > 1 || _projVec.z < -1) return null;
    pts.push({
      x: (_projVec.x * 0.5 + 0.5) * viewW,
      y: (-_projVec.y * 0.5 + 0.5) * viewH,
    });
  }

  const [p0, p1, p2, p3] = pts;
  const dx1 = p1.x - p3.x;
  const dy1 = p1.y - p3.y;
  const dx2 = p2.x - p3.x;
  const dy2 = p2.y - p3.y;
  const sx = p0.x - p1.x - p2.x + p3.x;
  const sy = p0.y - p1.y - p2.y + p3.y;

  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-2) return null;

  const g = (sx * dy2 - dx2 * sy) / det;
  const h = (dx1 * sy - sx * dy1) / det;
  if (g + h + 1 <= 0.05) return null;

  const a = p1.x * (g + 1) - p0.x;
  const b = p2.x * (h + 1) - p0.x;
  const c = p0.x;
  const d = p1.y * (g + 1) - p0.y;
  const e = p2.y * (h + 1) - p0.y;
  const f = p0.y;

  const invW = 1 / SURFACE_HTML_W;
  const invH = 1 / SURFACE_HTML_H;

  return `matrix3d(${(a * invW).toFixed(6)},${(d * invW).toFixed(6)},0,${(g * invW).toFixed(8)},${(b * invH).toFixed(6)},${(e * invH).toFixed(6)},0,${(h * invH).toFixed(8)},0,0,1,0,${c.toFixed(2)},${f.toFixed(2)},0,1)`;
}

export function buildStudyDeskScene(
  scene: THREE.Scene,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
  metrics: StudyDeskMetrics
): StudyDeskController {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const contactShadowTex = track(createContactShadowTexture());
  const addContactShadow = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, d: number, opacity = 0.42) => {
    const geo = track(new THREE.PlaneGeometry(w, d));
    const mat = track(
      new THREE.MeshBasicMaterial({
        map: contactShadowTex,
        transparent: true,
        depthWrite: false,
        opacity,
      })
    );
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // ── Room & Lighting ───────────────────────────────────────────────────────
  scene.background = new THREE.Color(0x0b0d17);
  scene.fog = new THREE.FogExp2(0x0b0d17, 0.045);

  const hemiLight = new THREE.HemisphereLight(0xa5bdfc, 0x3b1f14, 0.72);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffe1be, 1.35);
  keyLight.position.set(-3.2, 6.5, 4.2);
  if (!isSoftwareGl) {
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 20;
    keyLight.shadow.camera.left = -6.5;
    keyLight.shadow.camera.right = 6.5;
    keyLight.shadow.camera.top = 5.5;
    keyLight.shadow.camera.bottom = -5.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
  }
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x7aa2ff, 0.65);
  rimLight.position.set(2.5, 4.0, -5.5);
  scene.add(rimLight);

  const lampPointLight = new THREE.PointLight(0xffca82, 4.2, 8.5, 1.6);
  lampPointLight.position.set(-2.95, 1.15, -1.0);
  scene.add(lampPointLight);

  // ── 1. Wooden Study Desk (Multi-part Group) ───────────────────────────────
  const deskGroup = new THREE.Group();
  const woodTex = track(createWoodTexture(maxAnisotropy));
  const woodMat = track(new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.48, metalness: 0.04 }));
  const darkWoodMat = track(new THREE.MeshStandardMaterial({ color: 0x2b130a, roughness: 0.62, metalness: 0.05 }));

  const tableTop = new THREE.Mesh(track(new THREE.BoxGeometry(12.6, 0.24, 5.8)), woodMat);
  tableTop.position.set(0, -0.12, 0.15);
  tableTop.receiveShadow = !isSoftwareGl;
  deskGroup.add(tableTop);

  // Beveled front edge trim
  const frontTrim = new THREE.Mesh(track(new THREE.BoxGeometry(12.64, 0.08, 0.12)), darkWoodMat);
  frontTrim.position.set(0, -0.22, 3.02);
  deskGroup.add(frontTrim);

  // Under-desk apron & drawer fronts
  const apron = new THREE.Mesh(track(new THREE.BoxGeometry(11.8, 0.6, 4.9)), darkWoodMat);
  apron.position.set(0, -0.54, 0.05);
  deskGroup.add(apron);

  // Side bookshelf silhouette on far left (like Image 2)
  const shelfFrame = new THREE.Mesh(track(new THREE.BoxGeometry(0.9, 6.2, 1.9)), darkWoodMat);
  shelfFrame.position.set(-5.9, 2.2, -1.4);
  shelfFrame.rotation.y = 0.22;
  deskGroup.add(shelfFrame);
  for (let sy = 0.6; sy <= 3.6; sy += 1.0) {
    const plank = new THREE.Mesh(track(new THREE.BoxGeometry(0.95, 0.08, 1.85)), woodMat);
    plank.position.set(-5.88, sy, -1.4);
    plank.rotation.y = 0.22;
    deskGroup.add(plank);
  }
  scene.add(deskGroup);

  // ── 2. Back Wall, Window, Night Sky, Curtains & Fairy Lights ──────────────
  const roomGroup = new THREE.Group();
  const wallMat = track(new THREE.MeshStandardMaterial({ color: 0x6b472b, roughness: 0.88, metalness: 0.0 }));
  const sillWoodMat = track(new THREE.MeshStandardMaterial({ color: 0xba966d, roughness: 0.56, metalness: 0.02 }));
  const creamTrimMat = track(new THREE.MeshStandardMaterial({ color: 0xe9dec8, roughness: 0.6, metalness: 0.02 }));

  // Left & Right wall panels flanking the window
  const leftWall = new THREE.Mesh(track(new THREE.BoxGeometry(4.2, 6.4, 0.3)), wallMat);
  leftWall.position.set(-4.3, 3.0, -2.75);
  roomGroup.add(leftWall);

  const rightWall = new THREE.Mesh(track(new THREE.BoxGeometry(4.2, 6.4, 0.3)), wallMat);
  rightWall.position.set(4.3, 3.0, -2.75);
  roomGroup.add(rightWall);

  const lowerWall = new THREE.Mesh(track(new THREE.BoxGeometry(5.6, 0.9, 0.3)), wallMat);
  lowerWall.position.set(0, 0.35, -2.75);
  roomGroup.add(lowerWall);

  const upperWall = new THREE.Mesh(track(new THREE.BoxGeometry(5.6, 1.5, 0.3)), wallMat);
  upperWall.position.set(0, 5.45, -2.75);
  roomGroup.add(upperWall);

  // Night Sky outside window
  const skyTex = track(createNightSkyTexture(maxAnisotropy));
  const skyPlane = new THREE.Mesh(
    track(new THREE.PlaneGeometry(5.4, 4.2)),
    track(new THREE.MeshBasicMaterial({ map: skyTex }))
  );
  skyPlane.position.set(0, 2.75, -3.15);
  roomGroup.add(skyPlane);

  // Window frame & mullions
  const centerMullion = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 4.0, 0.16)), creamTrimMat);
  centerMullion.position.set(0, 2.75, -2.72);
  roomGroup.add(centerMullion);

  const topFrame = new THREE.Mesh(track(new THREE.BoxGeometry(5.0, 0.16, 0.22)), creamTrimMat);
  topFrame.position.set(0, 4.72, -2.7);
  roomGroup.add(topFrame);

  // Wooden Windowsill
  const windowsill = new THREE.Mesh(track(new THREE.BoxGeometry(5.3, 0.14, 0.85)), sillWoodMat);
  windowsill.position.set(0, 0.78, -2.35);
  windowsill.receiveShadow = !isSoftwareGl;
  roomGroup.add(windowsill);

  // Window glass tint
  const windowGlass = new THREE.Mesh(
    track(new THREE.PlaneGeometry(4.8, 3.9)),
    track(
      new THREE.MeshPhysicalMaterial({
        color: 0xb7ceff,
        transparent: true,
        opacity: isSoftwareGl ? 0.14 : 0.18,
        roughness: 0.1,
        metalness: 0.05,
        depthWrite: false,
      })
    )
  );
  windowGlass.position.set(0, 2.75, -2.78);
  roomGroup.add(windowGlass);

  // Curtains (left & right)
  const curtainTex = track(createCurtainTexture(maxAnisotropy));
  const curtainMat = track(
    new THREE.MeshStandardMaterial({ map: curtainTex, roughness: 0.85, metalness: 0.0 })
  );
  const leftCurtain = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.58, 4.2, 16, 1, false, 0, Math.PI)), curtainMat);
  leftCurtain.position.set(-2.35, 2.85, -2.5);
  leftCurtain.scale.set(1.2, 1, 0.45);
  roomGroup.add(leftCurtain);

  const rightCurtain = new THREE.Mesh(track(new THREE.CylinderGeometry(0.45, 0.58, 4.2, 16, 1, false, 0, Math.PI)), curtainMat);
  rightCurtain.position.set(2.35, 2.85, -2.5);
  rightCurtain.scale.set(1.2, 1, 0.45);
  roomGroup.add(rightCurtain);

  // Curtain rod
  const brassMat = track(new THREE.MeshStandardMaterial({ color: 0xd9ad62, roughness: 0.25, metalness: 0.85 }));
  const curtainRod = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.035, 6.4, 12)), brassMat);
  curtainRod.rotation.z = Math.PI / 2;
  curtainRod.position.set(0, 4.92, -2.45);
  roomGroup.add(curtainRod);

  // String Fairy Lights across the window (CatmullRomCurve3 + InstancedMesh)
  const stringCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-2.35, 3.85, -2.45),
    new THREE.Vector3(-1.2, 3.35, -2.42),
    new THREE.Vector3(0, 3.18, -2.4),
    new THREE.Vector3(1.2, 3.35, -2.42),
    new THREE.Vector3(2.35, 3.85, -2.45),
  ]);
  const wireMesh = new THREE.Mesh(
    track(new THREE.TubeGeometry(stringCurve, 36, 0.014, 6, false)),
    track(new THREE.MeshStandardMaterial({ color: 0x22262f, roughness: 0.7 }))
  );
  roomGroup.add(wireMesh);

  const bulbCount = 24;
  const bulbGeo = track(new THREE.SphereGeometry(0.038, 12, 12));
  const bulbMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xfff1c9,
      emissive: 0xffc66b,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    })
  );
  const bulbInstanced = new THREE.InstancedMesh(bulbGeo, bulbMat, bulbCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < bulbCount; i++) {
    const t = i / (bulbCount - 1);
    const pt = stringCurve.getPoint(t);
    dummy.position.set(pt.x, pt.y - 0.04, pt.z);
    dummy.scale.setScalar(i % 2 === 0 ? 1.0 : 0.82);
    dummy.updateMatrix();
    bulbInstanced.setMatrixAt(i, dummy.matrix);
  }
  bulbInstanced.instanceMatrix.needsUpdate = true;
  bulbInstanced.computeBoundingSphere();
  roomGroup.add(bulbInstanced);

  // Sticky notes with real study metrics on the wall below windowsill
  const stickyMats: Array<{
    mat: THREE.MeshStandardMaterial;
    bg: string;
    title: string;
    sub: string;
  }> = [];
  const stickySpecs = [
    { x: -0.92, bg: "#f9e79f", title: "Cadernos", metric: String(metrics.totalCadernos), sub: "ativos" },
    { x: 0.0, bg: "#f7c9d4", title: "Questões", metric: String(metrics.totalQuestoes), sub: "no banco" },
    { x: 0.92, bg: "#b8e6c1", title: "Acertos", metric: String(metrics.totalAcertos), sub: "registrados" },
  ];
  stickySpecs.forEach((s, idx) => {
    const tex = track(createStickyNoteTexture(maxAnisotropy, s.bg, s.title, s.metric, s.sub));
    const mat = track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 }));
    stickyMats.push({ mat, bg: s.bg, title: s.title, sub: s.sub });
    const note = new THREE.Mesh(track(new THREE.PlaneGeometry(0.56, 0.56)), mat);
    note.position.set(s.x, 0.42, -2.58);
    note.rotation.z = (idx - 1) * 0.04;
    roomGroup.add(note);
  });

  // Plush Cat sitting on windowsill (multi-part Group)
  const catGroup = new THREE.Group();
  const catFurMat = track(new THREE.MeshStandardMaterial({ color: 0xc2b2a4, roughness: 0.9, metalness: 0 }));
  const catDarkMat = track(new THREE.MeshStandardMaterial({ color: 0x3b2d26, roughness: 0.7 }));
  const cookieMat = track(new THREE.MeshStandardMaterial({ color: 0xd19456, roughness: 0.78 }));

  const catBody = new THREE.Mesh(track(new THREE.SphereGeometry(0.26, 20, 18)), catFurMat);
  catBody.scale.set(1.0, 1.15, 0.88);
  catBody.position.y = 0.27;
  catGroup.add(catBody);

  const earGeo = track(new THREE.ConeGeometry(0.075, 0.13, 12));
  const leftEar = new THREE.Mesh(earGeo, catFurMat);
  leftEar.position.set(-0.14, 0.55, 0.02);
  leftEar.rotation.z = 0.28;
  catGroup.add(leftEar);

  const rightEar = new THREE.Mesh(earGeo, catFurMat);
  rightEar.position.set(0.14, 0.55, 0.02);
  rightEar.rotation.z = -0.28;
  catGroup.add(rightEar);

  const eyeGeo = track(new THREE.SphereGeometry(0.022, 10, 10));
  const leftEye = new THREE.Mesh(eyeGeo, catDarkMat);
  leftEye.position.set(-0.08, 0.37, 0.21);
  catGroup.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, catDarkMat);
  rightEye.position.set(0.08, 0.37, 0.21);
  catGroup.add(rightEye);

  const cookie = new THREE.Mesh(track(new THREE.CylinderGeometry(0.075, 0.075, 0.024, 16)), cookieMat);
  cookie.rotation.x = Math.PI / 2;
  cookie.position.set(0, 0.22, 0.24);
  catGroup.add(cookie);

  catGroup.position.set(-1.12, 0.85, -2.28);
  addContactShadow(roomGroup, -1.12, 0.86, -2.28, 0.65, 0.55, 0.35);
  roomGroup.add(catGroup);

  // Candle in glass jar on windowsill
  const candleGroup = new THREE.Group();
  const wax = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.11, 0.11, 0.18, 20)),
    track(new THREE.MeshStandardMaterial({ color: 0xf7f1e1, roughness: 0.7 }))
  );
  wax.position.y = 0.1;
  candleGroup.add(wax);

  const candleGlass = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.125, 0.125, 0.24, 20, 1, true)),
    track(
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.34,
        roughness: 0.08,
        depthWrite: false,
      })
    )
  );
  candleGlass.position.y = 0.12;
  candleGroup.add(candleGlass);

  const flameMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffe49c,
      emissive: 0xffa833,
      emissiveIntensity: 3.0,
      roughness: 0.2,
    })
  );
  const flame = new THREE.Mesh(track(new THREE.ConeGeometry(0.024, 0.07, 10)), flameMat);
  flame.position.y = 0.22;
  candleGroup.add(flame);

  const candleLid = new THREE.Mesh(track(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 20)), woodMat);
  candleLid.rotation.z = Math.PI / 2 - 0.18;
  candleLid.position.set(0.22, 0.13, 0.02);
  candleGroup.add(candleLid);

  candleGroup.position.set(1.55, 0.85, -2.26);
  roomGroup.add(candleGroup);

  // Mini acrylic card stands on windowsill
  const acrylicMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xe6f0ff,
      transparent: true,
      opacity: 0.28,
      roughness: 0.08,
      depthWrite: false,
    })
  );
  for (let i = 0; i < 3; i++) {
    const stand = new THREE.Group();
    const base = new THREE.Mesh(track(new THREE.BoxGeometry(0.26, 0.03, 0.14)), sillWoodMat);
    base.position.y = 0.015;
    stand.add(base);
    const pane = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.32, 0.015)), acrylicMat);
    pane.position.y = 0.19;
    stand.add(pane);
    stand.position.set(-0.2 + i * 0.48, 0.85, -2.26);
    roomGroup.add(stand);
  }

  scene.add(roomGroup);

  // ── 3. Left Desk Props: Mushroom Lamp, Mug, Calendar, Phone, Postcard ─────
  const lampGroup = new THREE.Group();
  const lampCreamMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xf6eedf,
      roughness: 0.28,
      metalness: 0.05,
      emissive: 0xffd59c,
      emissiveIntensity: 0.45,
    })
  );
  const lampBase = new THREE.Mesh(
    track(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.32, 0),
          new THREE.Vector2(0.28, 0.08),
          new THREE.Vector2(0.08, 0.22),
          new THREE.Vector2(0.075, 0.85),
          new THREE.Vector2(0, 0.85),
        ],
        28
      )
    ),
    lampCreamMat
  );
  lampBase.castShadow = !isSoftwareGl;
  lampGroup.add(lampBase);

  const lampShade = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.62, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.56)),
    lampCreamMat
  );
  lampShade.position.y = 0.72;
  lampShade.castShadow = !isSoftwareGl;
  lampGroup.add(lampShade);

  const bulbGlow = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.11, 16, 12)),
    track(
      new THREE.MeshStandardMaterial({
        color: 0xfff5db,
        emissive: 0xffc66e,
        emissiveIntensity: 2.5,
      })
    )
  );
  bulbGlow.position.y = 0.8;
  lampGroup.add(bulbGlow);

  lampGroup.position.set(-2.95, 0, -1.05);
  addContactShadow(scene, -2.95, 0.008, -1.05, 0.9, 0.9, 0.45);
  scene.add(lampGroup);

  // Coffee Mug with heart & marshmallows
  const mugGroup = new THREE.Group();
  const ceramicMat = track(new THREE.MeshStandardMaterial({ color: 0xfaf5ee, roughness: 0.22, metalness: 0.04 }));
  const mugBody = new THREE.Mesh(
    track(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(0.22, 0),
          new THREE.Vector2(0.24, 0.36),
          new THREE.Vector2(0.21, 0.36),
          new THREE.Vector2(0.19, 0.06),
          new THREE.Vector2(0, 0.06),
        ],
        24
      )
    ),
    ceramicMat
  );
  mugBody.castShadow = !isSoftwareGl;
  mugGroup.add(mugBody);

  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.22, 0.29, 0),
    new THREE.Vector3(0.35, 0.26, 0),
    new THREE.Vector3(0.35, 0.12, 0),
    new THREE.Vector3(0.21, 0.09, 0),
  ]);
  const mugHandle = new THREE.Mesh(track(new THREE.TubeGeometry(handleCurve, 18, 0.03, 10, false)), ceramicMat);
  mugGroup.add(mugHandle);

  const cocoa = new THREE.Mesh(
    track(new THREE.CircleGeometry(0.2, 20)),
    track(new THREE.MeshStandardMaterial({ color: 0x3b1f14, roughness: 0.18, metalness: 0.05 }))
  );
  cocoa.rotation.x = -Math.PI / 2;
  cocoa.position.y = 0.31;
  mugGroup.add(cocoa);

  const marshGeo = track(new THREE.CylinderGeometry(0.032, 0.032, 0.025, 10));
  [
    [-0.06, 0.05],
    [0.05, -0.04],
    [0.02, 0.08],
  ].forEach(([mx, mz]) => {
    const m = new THREE.Mesh(marshGeo, ceramicMat);
    m.position.set(mx, 0.315, mz);
    mugGroup.add(m);
  });

  mugGroup.position.set(-1.92, 0, -0.95);
  mugGroup.rotation.y = 0.4;
  addContactShadow(scene, -1.92, 0.008, -0.95, 0.65, 0.65, 0.42);
  scene.add(mugGroup);

  // Desk Calendar
  const calGroup = new THREE.Group();
  const calStand = new THREE.Mesh(track(new THREE.BoxGeometry(0.95, 0.06, 0.45)), woodMat);
  calStand.position.y = 0.03;
  calGroup.add(calStand);

  const calTex = track(createCalendarTexture(maxAnisotropy));
  const calPage = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.86, 0.64, 0.04)),
    track(new THREE.MeshStandardMaterial({ map: calTex, roughness: 0.72 }))
  );
  calPage.position.set(0, 0.35, -0.02);
  calPage.rotation.x = -0.22;
  calPage.castShadow = !isSoftwareGl;
  calGroup.add(calPage);

  calGroup.position.set(-3.95, 0, -1.15);
  calGroup.rotation.y = 0.25;
  addContactShadow(scene, -3.95, 0.008, -1.15, 1.15, 0.65, 0.4);
  scene.add(calGroup);

  // Smartphone
  const phoneGroup = new THREE.Group();
  const phoneBody = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.56, 0.055, 1.05)),
    track(new THREE.MeshStandardMaterial({ color: 0xd9c2b8, roughness: 0.3, metalness: 0.55 }))
  );
  phoneBody.position.y = 0.028;
  phoneBody.castShadow = !isSoftwareGl;
  phoneGroup.add(phoneBody);

  const phoneScreen = new THREE.Mesh(
    track(new THREE.PlaneGeometry(0.5, 0.96)),
    track(new THREE.MeshStandardMaterial({ color: 0x0b0e16, roughness: 0.12, metalness: 0.1 }))
  );
  phoneScreen.rotation.x = -Math.PI / 2;
  phoneScreen.position.y = 0.057;
  phoneGroup.add(phoneScreen);

  phoneGroup.position.set(-2.78, 0, -0.02);
  phoneGroup.rotation.y = 0.62;
  addContactShadow(scene, -2.78, 0.006, -0.02, 0.85, 1.25, 0.36);
  scene.add(phoneGroup);

  // Postcard & Sticky Sheet on left front
  const postcardTex = track(createPostcardTexture(maxAnisotropy));
  const postcard = new THREE.Mesh(
    track(new THREE.BoxGeometry(1.38, 0.012, 0.92)),
    track(new THREE.MeshStandardMaterial({ map: postcardTex, roughness: 0.65 }))
  );
  postcard.position.set(-2.95, 0.009, 1.22);
  postcard.rotation.y = 0.14;
  scene.add(postcard);

  // ── 4. Right Desk Props: Trophy + Tiered Subject Rack + Loose Cards ───────
  const trophyGroup = new THREE.Group();
  const goldMat = track(new THREE.MeshStandardMaterial({ color: 0xf4c45c, roughness: 0.22, metalness: 0.82 }));
  const pinkBaseMat = track(new THREE.MeshStandardMaterial({ color: 0xe39aa8, roughness: 0.42, metalness: 0.1 }));

  const trophyPedestal = new THREE.Mesh(track(new THREE.CylinderGeometry(0.24, 0.28, 0.1, 24)), pinkBaseMat);
  trophyPedestal.position.y = 0.05;
  trophyGroup.add(trophyPedestal);

  const trophyCup = new THREE.Mesh(
    track(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0, 0.1),
          new THREE.Vector2(0.14, 0.1),
          new THREE.Vector2(0.06, 0.24),
          new THREE.Vector2(0.22, 0.56),
          new THREE.Vector2(0.24, 0.62),
          new THREE.Vector2(0.18, 0.62),
          new THREE.Vector2(0.14, 0.34),
          new THREE.Vector2(0, 0.34),
        ],
        24
      )
    ),
    goldMat
  );
  trophyCup.castShadow = !isSoftwareGl;
  trophyGroup.add(trophyCup);

  const earHandleGeo = track(new THREE.TorusGeometry(0.11, 0.022, 10, 20, Math.PI));
  const hLeft = new THREE.Mesh(earHandleGeo, goldMat);
  hLeft.rotation.z = Math.PI / 2;
  hLeft.position.set(-0.2, 0.48, 0);
  trophyGroup.add(hLeft);
  const hRight = new THREE.Mesh(earHandleGeo, goldMat);
  hRight.rotation.z = -Math.PI / 2;
  hRight.position.set(0.2, 0.48, 0);
  trophyGroup.add(hRight);

  trophyGroup.position.set(1.42, 0, -1.05);
  addContactShadow(scene, 1.42, 0.008, -1.05, 0.72, 0.72, 0.4);
  scene.add(trophyGroup);

  // Tiered Subject Organizer Rack (inspired by Image 2 right side)
  const rackGroup = new THREE.Group();
  const rackBase = new THREE.Mesh(track(new THREE.CylinderGeometry(1.45, 1.5, 0.08, 32)), woodMat);
  rackBase.position.y = 0.04;
  rackGroup.add(rackBase);

  const packPalette = ["#9e2b56", "#b8353b", "#2a7da8", "#d9822b", "#4c51bf"];
  const subjects = metrics.subjectSummaries.length > 0
    ? metrics.subjectSummaries.slice(0, 5)
    : [{ name: "Matemática", count: 12 }, { name: "Financeira", count: 8 }, { name: "Lógica", count: 5 }];

  subjects.forEach((subj, i) => {
    const angle = -0.65 + (i - (subjects.length - 1) / 2) * 0.52;
    const pocket = new THREE.Group();
    const color = packPalette[i % packPalette.length];
    const tex = track(createPackLabelTexture(maxAnisotropy, color, subj.name, `${subj.count} cad.`));
    const frontMat = track(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.48 }));
    const boxMat = track(new THREE.MeshStandardMaterial({ color, roughness: 0.55 }));

    const holder = new THREE.Mesh(track(new THREE.BoxGeometry(0.84, 0.52, 0.56)), boxMat);
    holder.position.y = 0.34;
    holder.castShadow = !isSoftwareGl;
    pocket.add(holder);

    const frontFace = new THREE.Mesh(track(new THREE.PlaneGeometry(0.8, 0.44)), frontMat);
    frontFace.position.set(0, 0.34, 0.285);
    pocket.add(frontFace);

    const cardInside = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.68, 0.55, 0.06)),
      track(new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.6 }))
    );
    cardInside.position.set(0, 0.6, -0.05);
    cardInside.rotation.x = -0.15;
    pocket.add(cardInside);

    pocket.position.set(Math.sin(angle) * 0.65, 0.06, Math.cos(angle) * 0.55);
    pocket.rotation.y = angle * 0.85;
    rackGroup.add(pocket);
  });

  rackGroup.position.set(3.25, 0, -0.45);
  rackGroup.rotation.y = -0.42;
  addContactShadow(scene, 3.25, 0.008, -0.45, 3.0, 2.7, 0.45);
  scene.add(rackGroup);

  // Loose study cards on front right
  const looseCardMat1 = track(new THREE.MeshStandardMaterial({ color: 0x5fb3d9, roughness: 0.42 }));
  const looseCardMat2 = track(new THREE.MeshStandardMaterial({ color: 0xd9a7d4, roughness: 0.42 }));
  const loose1 = new THREE.Mesh(track(new THREE.BoxGeometry(0.68, 0.02, 1.05)), looseCardMat1);
  loose1.position.set(2.55, 0.012, 1.25);
  loose1.rotation.y = 0.22;
  scene.add(loose1);
  const loose2 = new THREE.Mesh(track(new THREE.BoxGeometry(0.68, 0.02, 1.05)), looseCardMat2);
  loose2.position.set(3.55, 0.012, 1.15);
  loose2.rotation.y = 0.32;
  scene.add(loose2);

  // ── 5. Centerpiece Hero: Interactive 3D Leather Binder ("Caderno") ────────
  const binderGroup = new THREE.Group();
  const binderW = 2.15;
  const binderD = 2.72;
  const coverThick = 0.045;

  const leatherMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x33132c,
      roughness: 0.52,
      metalness: 0.08,
    })
  );
  const frontCoverTex = track(createLeatherCoverTexture(maxAnisotropy));
  const frontCoverMat = track(
    new THREE.MeshStandardMaterial({
      map: frontCoverTex,
      roughness: 0.45,
      metalness: 0.12,
      emissive: new THREE.Color(0x280d22),
      emissiveIntensity: 0.0,
    })
  );
  const innerLiningMat = track(new THREE.MeshStandardMaterial({ color: 0x2a0f24, roughness: 0.68 }));
  const rightSpreadTex = track(createPaperTexture(maxAnisotropy, true));
  const leftSpreadTex = track(createPaperTexture(maxAnisotropy, false));
  const paperStackMat = track(new THREE.MeshStandardMaterial({ color: 0xefe7d6, roughness: 0.85 }));
  const silverMetalMat = track(new THREE.MeshStandardMaterial({ color: 0xd9dee8, roughness: 0.22, metalness: 0.9 }));

  // Back cover (always flat on desk)
  const backCover = new THREE.Mesh(track(new THREE.BoxGeometry(binderW, coverThick, binderD)), leatherMat);
  backCover.position.set(0, coverThick / 2, 0);
  backCover.castShadow = !isSoftwareGl;
  backCover.receiveShadow = !isSoftwareGl;
  binderGroup.add(backCover);

  // Spine wall on left edge (-binderW/2)
  const spine = new THREE.Mesh(track(new THREE.BoxGeometry(0.11, 0.24, binderD)), leatherMat);
  spine.position.set(-binderW / 2 + 0.04, 0.12, 0);
  spine.castShadow = !isSoftwareGl;
  binderGroup.add(spine);

  // Right page stack inside binder
  const pageBlock = new THREE.Mesh(
    track(new THREE.BoxGeometry(binderW - 0.18, 0.12, binderD - 0.16)),
    [
      paperStackMat,
      paperStackMat,
      track(new THREE.MeshStandardMaterial({ map: rightSpreadTex, roughness: 0.72 })),
      paperStackMat,
      paperStackMat,
      paperStackMat,
    ]
  );
  pageBlock.position.set(0.04, coverThick + 0.06, 0);
  pageBlock.receiveShadow = !isSoftwareGl;
  binderGroup.add(pageBlock);

  // 3 metallic binder rings on the spine
  const ringGeo = track(new THREE.TorusGeometry(0.095, 0.016, 12, 24));
  [-0.78, 0, 0.78].forEach((rz) => {
    const ring = new THREE.Mesh(ringGeo, silverMetalMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(-binderW / 2 + 0.14, 0.16, rz);
    binderGroup.add(ring);
  });

  // Animated Front Cover Pivot at the Spine (-binderW / 2, 0.21, 0)
  const coverPivot = new THREE.Group();
  coverPivot.position.set(-binderW / 2 + 0.03, 0.19, 0);

  const frontCover = new THREE.Mesh(
    track(new THREE.BoxGeometry(binderW, coverThick, binderD)),
    [
      leatherMat,
      leatherMat,
      frontCoverMat,
      innerLiningMat,
      leatherMat,
      leatherMat,
    ]
  );
  frontCover.position.set(binderW / 2 - 0.03, 0, 0);
  frontCover.castShadow = !isSoftwareGl;
  frontCover.receiveShadow = !isSoftwareGl;
  coverPivot.add(frontCover);

  // Left inner page attached to inside of front cover
  const leftInnerPage = new THREE.Mesh(
    track(new THREE.BoxGeometry(binderW - 0.18, 0.025, binderD - 0.18)),
    track(new THREE.MeshStandardMaterial({ map: leftSpreadTex, roughness: 0.78 }))
  );
  leftInnerPage.position.set(binderW / 2 - 0.01, -coverThick / 2 - 0.014, 0);
  coverPivot.add(leftInnerPage);

  // Gold metal corner protectors on front cover
  const cornerGeo = track(new THREE.BoxGeometry(0.14, 0.056, 0.14));
  [
    [binderW - 0.09, -binderD / 2 + 0.07],
    [binderW - 0.09, binderD / 2 - 0.07],
  ].forEach(([cx, cz]) => {
    const corner = new THREE.Mesh(cornerGeo, goldMat);
    corner.position.set(cx, 0, cz);
    coverPivot.add(corner);
  });

  binderGroup.add(coverPivot);

  // ── 6. 3D SurfaceGui Page Quads (exact world corners on 3D Left & Right Pages) ──
  const leftPageQuad: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(binderW / 2 - 0.01 + 0.94, -coverThick / 2 - 0.032, -1.23),
    new THREE.Vector3(binderW / 2 - 0.01 - 0.94, -coverThick / 2 - 0.032, -1.23),
    new THREE.Vector3(binderW / 2 - 0.01 + 0.94, -coverThick / 2 - 0.032, 1.23),
    new THREE.Vector3(binderW / 2 - 0.01 - 0.94, -coverThick / 2 - 0.032, 1.23),
  ];

  const rightPageQuad: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3] = [
    new THREE.Vector3(0.04 - 0.94, coverThick + 0.125, -1.23),
    new THREE.Vector3(0.04 + 0.94, coverThick + 0.125, -1.23),
    new THREE.Vector3(0.04 - 0.94, coverThick + 0.125, 1.23),
    new THREE.Vector3(0.04 + 0.94, coverThick + 0.125, 1.23),
  ];

  binderGroup.position.set(0, 0.005, 0.62);
  addContactShadow(scene, 0, 0.004, 0.62, 2.6, 3.15, 0.48);
  scene.add(binderGroup);

  // State & Animation Targets
  let targetOpen = 0;
  let currentOpen = 0;
  let lampOn = true;
  let targetLampIntensity = 4.2;
  let binderHovered = false;

  const applySurfaceStyle = (
    el: HTMLElement | null,
    transformStr: string | null,
    vis: number,
    pointerMode: "auto" | "none"
  ) => {
    if (!el) return;
    const visible = vis > 0.02 && transformStr !== null;
    const nextVis = visible ? "visible" : "hidden";
    const nextOpacity = visible ? vis.toFixed(3) : "0";
    const nextPtr = visible ? pointerMode : "none";

    if (el.style.visibility !== nextVis) el.style.visibility = nextVis;
    if (el.style.opacity !== nextOpacity) el.style.opacity = nextOpacity;
    if (el.style.pointerEvents !== nextPtr) el.style.pointerEvents = nextPtr;
    if (transformStr && el.style.transform !== transformStr) {
      el.style.transform = transformStr;
    }
  };

  return {
    binderHitTargets: [frontCover, backCover, pageBlock],
    lampHitTargets: [lampBase, lampShade],
    trophyHitTargets: [trophyCup, trophyPedestal],
    setBinderOpen: (open: boolean) => {
      targetOpen = open ? 1 : 0;
    },
    setLampOn: (on: boolean) => {
      lampOn = on;
      targetLampIntensity = on ? 4.2 : 0.25;
      lampCreamMat.emissiveIntensity = on ? 0.45 : 0.04;
      (bulbGlow.material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 2.5 : 0.1;
    },
    getLampOn: () => lampOn,
    setHoverBinder: (hovered: boolean) => {
      binderHovered = hovered;
    },
    updateMetrics: (nextMetrics: StudyDeskMetrics) => {
      const vals = [
        String(nextMetrics.totalCadernos),
        String(nextMetrics.totalQuestoes),
        String(nextMetrics.totalAcertos),
      ];
      stickyMats.forEach((entry, idx) => {
        const oldMap = entry.mat.map;
        const newTex = track(
          createStickyNoteTexture(maxAnisotropy, entry.bg, entry.title, vals[idx] ?? "0", entry.sub)
        );
        entry.mat.map = newTex;
        entry.mat.needsUpdate = true;
        if (oldMap) oldMap.dispose();
      });
    },
    update: (delta: number, elapsed: number): boolean => {
      const clampedDelta = Math.min(delta, 0.08);
      currentOpen = THREE.MathUtils.damp(currentOpen, targetOpen, 7.5, clampedDelta);
      coverPivot.rotation.z = currentOpen * Math.PI * 0.985;
      binderGroup.position.x = currentOpen * (binderW / 2 - 0.03);

      // Gentle hover highlight on closed binder
      const targetEmissive = binderHovered && targetOpen < 0.5 ? 0.28 : 0.0;
      frontCoverMat.emissiveIntensity = THREE.MathUtils.damp(
        frontCoverMat.emissiveIntensity,
        targetEmissive,
        10,
        clampedDelta
      );
      const liftY = binderHovered && targetOpen < 0.5 ? 0.035 : 0.005;
      binderGroup.position.y = THREE.MathUtils.damp(binderGroup.position.y, liftY, 10, clampedDelta);

      // Subtle warm candle flicker & lamp transition
      lampPointLight.intensity = THREE.MathUtils.damp(
        lampPointLight.intensity,
        targetLampIntensity,
        8,
        clampedDelta
      );
      flame.scale.y = 1 + Math.sin(elapsed * 7.2) * 0.12;
      flame.rotation.z = Math.sin(elapsed * 5.3) * 0.08;

      const stillMoving =
        Math.abs(currentOpen - targetOpen) > 0.002 ||
        Math.abs(frontCoverMat.emissiveIntensity - targetEmissive) > 0.005 ||
        Math.abs(binderGroup.position.y - liftY) > 0.001 ||
        Math.abs(lampPointLight.intensity - targetLampIntensity) > 0.02;

      return stillMoving;
    },
    syncSurfaceOverlay: (
      camera: THREE.Camera,
      viewportW: number,
      viewportH: number,
      leftEl: HTMLElement | null,
      rightEl: HTMLElement | null,
      interactive: boolean
    ) => {
      const vis = THREE.MathUtils.clamp((currentOpen - 0.52) / 0.38, 0, 1);
      const pointerMode: "auto" | "none" =
        interactive && targetOpen > 0.5 && vis > 0.65 ? "auto" : "none";

      if (vis <= 0.02) {
        applySurfaceStyle(leftEl, null, 0, "none");
        applySurfaceStyle(rightEl, null, 0, "none");
        return;
      }

      binderGroup.updateMatrixWorld(true);
      camera.updateMatrixWorld();

      const leftTransform = computeQuadMatrix3d(
        leftPageQuad,
        coverPivot.matrixWorld,
        camera,
        viewportW,
        viewportH
      );
      const rightTransform = computeQuadMatrix3d(
        rightPageQuad,
        binderGroup.matrixWorld,
        camera,
        viewportW,
        viewportH
      );

      applySurfaceStyle(leftEl, leftTransform, vis, pointerMode);
      applySurfaceStyle(rightEl, rightTransform, vis, pointerMode);
    },
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
