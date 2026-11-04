/**
 * renderer/scene.ts — Three.js r170-прототип планеты (Этап 5; вердикт: «сфера → поли-сетка → граф
 * соседства, LOD/instancing, замер FPS»). 2.5D-гибрид baseline: поли-сетка клеток (vertexColors),
 * маркеры клеток — InstancedMesh в THREE.LOD (2 уровня), граф соседства — LineSegments.
 * Вращение — как 1.x (n.rotX=-0.08/n.rotY=0 после свитча планеты, аудит §setActive): drag по canvas.
 * Данные — renderer/planetMesh.ts (чистый билдер); этот модуль — ТОЛЬКО DOM/WebGL-обвязка.
 */
import * as THREE from 'three';
import type { PlanetMeshData } from './planetMesh';
import { parseColor } from './planetMesh';
import { AdaptiveSurfaceQuality, SURFACE_QUALITY, surfacePixelRatio, type SurfaceQualityTier } from './surfaceQuality';
import { RuntimeSurfaceLodController } from './runtimeSurfaceLod';
import { buildSurfaceChunksAsync, type SurfaceChunk } from './surfaceChunks';
import { buildSurfaceChunksWithWorker } from './surfaceWorkerPipeline';
import { buildPolygonSurfaceChunkPlan } from './polygonSurfaceStreaming';
import { prioritizeSurfaceChunks } from './surfaceStreamingPolicy';
import { SurfaceStreamingRuntime } from './surfaceStreamingRuntime';
import { SurfaceResidencyManager, estimateGeometryBytes } from './surfaceResidency';
import { SurfaceGpuResourceLifecycle } from './surfaceGpuLifecycle';
import { SurfaceResourceStreaming } from './surfaceResourceStreaming';
import { AdaptiveSurfaceStreamingController } from './adaptiveSurfaceStreamingController';
import { SurfaceStreamingDiagnostics, type SurfaceDiagnosticSnapshot } from './surfaceDiagnostics';
import { SurfaceStabilityMonitor } from './surfaceStabilityMonitor';
import { createSurfaceDiagnosticsDashboard } from './surfaceDiagnosticsDashboard';

export interface PlanetViewer {
  setPlanet(data: PlanetMeshData, borderColor: string): void;
  selectCell(cellId: number | null): void;
  setCellSelectHandler(handler: ((cellId: number) => void) | null): void;
  render(nowMs: number): void;
  resize(): void;
  zoomBy(delta: number): void;
  resetView(): void;
  dispose(): void;
  readonly rotX: number;
  readonly rotY: number;
  readonly qualityTier: SurfaceQualityTier;
  getSurfaceDiagnostics(): SurfaceDiagnosticSnapshot;
  toggleSurfaceDiagnostics(): void;
}

const LOD_NEAR = 0;
const LOD_FAR = 3.55;

function createGeologicalSurfaceMaterial(): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.08, side: THREE.DoubleSide });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uVoroniaTime = { value: 0 };
    shader.uniforms.uVoroniaQuality = { value: 0.55 };
    shader.uniforms.uVoroniaAnimation = { value: 0.7 };
    shader.uniforms.uVoroniaLodDetail = { value: 1 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uVoroniaTime;\nuniform float uVoroniaQuality;\nuniform float uVoroniaAnimation;\nuniform float uVoroniaLodDetail;\nattribute float geologyType;\nattribute float surfaceDetail;\nattribute float emissiveStrength;\nattribute float geologicalMotionAmplitude;\nattribute float geologicalMotionSpeed;\nvarying float vGeologyType;\nvarying float vSurfaceDetail;\nvarying float vEmissiveStrength;\nvarying vec3 vGeologyPosition;\nvarying float vGeoPulse;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nfloat geoPhase = uVoroniaTime * geologicalMotionSpeed + dot(transformed, vec3(7.1, 11.7, 5.3));\nfloat geoDisplacement = sin(geoPhase * 1.7) * geologicalMotionAmplitude * uVoroniaAnimation;\ntransformed += normalize(transformed) * geoDisplacement;\nvGeoPulse = 0.5 + 0.5 * sin(geoPhase * 1.35);\nvGeologyType = geologyType;\nvSurfaceDetail = surfaceDetail;\nvEmissiveStrength = emissiveStrength;\nvGeologyPosition = transformed;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uVoroniaTime;\nuniform float uVoroniaQuality;\nuniform float uVoroniaLodDetail;\nvarying float vGeologyType;\nvarying float vSurfaceDetail;\nvarying float vEmissiveStrength;\nvarying vec3 vGeologyPosition;\nvarying float vGeoPulse;\nfloat voroniaNoise(vec3 p) { vec3 q = floor(p); return fract(sin(dot(q, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>\nfloat geoNoise = 0.5;\nif (uVoroniaQuality > 0.01) { geoNoise = voroniaNoise(vGeologyPosition * (24.0 + vSurfaceDetail * 18.0)); }\nfloat geoFlow = 0.5 + 0.5 * sin(vGeologyPosition.x * 34.0 + vGeologyPosition.z * 27.0 - uVoroniaTime * 1.8);\nfloat geoKnown = step(0.0, vGeologyType);\nfloat geoWater = 1.0 - step(0.5, abs(vGeologyType));\nfloat geoCrystal = 1.0 - step(0.5, abs(vGeologyType - 2.0));\nfloat geoAnomaly = 1.0 - step(0.5, abs(vGeologyType - 4.0));\nfloat geoRock = 1.0 - step(0.5, abs(vGeologyType - 3.0));\nvec3 waterTint = vec3(0.55, 0.78, 1.12);\nvec3 crystalTint = vec3(0.82, 1.08, 1.18);\nvec3 anomalyTint = vec3(1.18, 0.72, 1.22);\ndiffuseColor.rgb *= mix(vec3(1.0), mix(vec3(0.96), waterTint, geoWater), geoKnown);\ndiffuseColor.rgb *= mix(vec3(1.0), crystalTint, geoCrystal * 0.22);\ndiffuseColor.rgb *= mix(vec3(1.0), anomalyTint, geoAnomaly * 0.26);\ndiffuseColor.rgb *= 1.0 + (geoNoise - 0.5) * (0.05 + 0.10 * geoRock + 0.06 * geoCrystal) * uVoroniaQuality * uVoroniaLodDetail;\ndiffuseColor.rgb *= 1.0 + geoWater * (geoFlow - 0.5) * 0.12 * uVoroniaQuality * uVoroniaLodDetail;\ndiffuseColor.rgb *= 1.0 + geoCrystal * (vGeoPulse - 0.5) * 0.10 * uVoroniaQuality * uVoroniaLodDetail;\ndiffuseColor.rgb *= 1.0 + geoAnomaly * sin(uVoroniaTime * 1.4 + vGeologyPosition.y * 22.0) * 0.09 * uVoroniaQuality * uVoroniaLodDetail;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nfloat geoRoughness = mix(0.88, 0.30, geoWater);\ngeoRoughness = mix(geoRoughness, 0.22, geoCrystal);\ngeoRoughness = mix(geoRoughness, 0.44, geoAnomaly);\nroughnessFactor = mix(roughnessFactor, geoRoughness, geoKnown * 0.72);\nroughnessFactor = clamp(roughnessFactor + (geoNoise - 0.5) * 0.08 * uVoroniaQuality, 0.12, 1.0);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vEmissiveStrength * (0.55 + 0.25 * vGeoPulse + 0.20 * sin(uVoroniaTime * 1.1 + vGeologyPosition.y * 18.0 + vSurfaceDetail * 6.283));`);
  };
  material.userData.shader = null;
  material.customProgramCacheKey = () => 'voronia-geology-material-v2-dynamic';
  return material;
}

/**
 * Этап 9.2: звёздное небо surface-сцены. В версии 1 планета висела в космосе со
 * звёздами; пустой чёрный фон читался как «графика хуже». Точки детерминированы
 * (LCG с фиксированным seed) и не входят в planetGroup — не вращаются с планетой.
 */
function buildSurfaceStarField(): THREE.Points {
  const count = 520;
  const positions = new Float32Array(count * 3);
  let state = 0x5eed1234;
  const rnd = (): number => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let i = 0; i < count; i++) {
    const radius = 26 + rnd() * 30;
    const theta = rnd() * Math.PI * 2;
    const phi = Math.acos(2 * rnd() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color: 0x9fc9e8, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false });
  return new THREE.Points(geometry, material);
}

export function createPlanetViewer(canvas: HTMLCanvasElement, initial: PlanetMeshData, borderColor = '#8fd7ff'): PlanetViewer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const adaptiveQuality = new AdaptiveSurfaceQuality();
  const runtimeLod = new RuntimeSurfaceLodController();
  const targetPixelRatio = (): number => surfacePixelRatio(window.devicePixelRatio || 1, window.innerWidth, adaptiveQuality.tier);
  renderer.setPixelRatio(targetPixelRatio());
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const DEFAULT_CAMERA_Z = 3.2;
  camera.position.set(0, 0, DEFAULT_CAMERA_Z);
  scene.add(new THREE.HemisphereLight(0xb9d9ff, 0x171c2b, 0.72));
  const dir = new THREE.DirectionalLight(0xfff1d8, 1.15);
  dir.position.set(2.5, 3, 4);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0x6b9dce, 0.28);
  fill.position.set(-3, -1, -2);
  scene.add(fill);

  const planetGroup = new THREE.Group();
  scene.add(planetGroup);
  const surfaceStarField = buildSurfaceStarField();
  scene.add(surfaceStarField);
  let rotX = -0.08; // 1.x n.rotX после setActivePlanet
  let rotY = 0;
  const idleSpin = 0.0016;

  let surface: THREE.Mesh | null = null;
  let surfaceChunks: Array<{ id: number; mesh: THREE.Mesh; faceCellIds: Uint32Array }> = [];
  let surfaceBuildToken = 0;
  const surfaceRuntime = new SurfaceStreamingRuntime(24 * 1024 * 1024, 2);
  const deviceHints = navigator as Navigator & { deviceMemory?: number };
  const streamingController = new AdaptiveSurfaceStreamingController({
    deviceMemoryGb: deviceHints.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
    mobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
  });
  const residency = new SurfaceResidencyManager(96 * 1024 * 1024);
  const gpuLifecycle = new SurfaceGpuResourceLifecycle(residency);
  const trackedGeometries = new WeakSet<THREE.BufferGeometry>();
  const trackGeometry = (id: string, geometry: THREE.BufferGeometry, kind: 'base' | 'decorative' | 'staging', pinned: boolean): void => {
    trackedGeometries.add(geometry);
    const attributes = Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, attribute.array]));
    gpuLifecycle.track({ id, kind, pinned, bytes: estimateGeometryBytes(attributes), dispose: () => geometry.dispose(), restore: () => { for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true; } });
  };
  const surfaceDiagnostics = new SurfaceStreamingDiagnostics(residency);
  const surfaceStabilityMonitor = new SurfaceStabilityMonitor();
  const surfaceDashboard = createSurfaceDiagnosticsDashboard(document.body);
  const resourceStreaming = new SurfaceResourceStreaming(residency, 1);
  let requestDecorativeRestoration: (() => void) | null = null;
  let contextLost = false;
  let stagedSurfaceMeshes: Array<{ id: number; mesh: THREE.Mesh; faceCellIds: Uint32Array }> = [];
  let stagedSurfaceReady = false;
  let surfaceMaterial: THREE.MeshStandardMaterial | null = null;
  let markers: THREE.LOD | null = null;
  let graph: THREE.LineSegments | null = null;
  let cellBoundaries: THREE.LineSegments | null = null;
  let selectionRing: THREE.Mesh | null = null;
  let currentData = initial;
  let onCellSelected: ((cellId: number) => void) | null = null;
  let selectedCellId: number | null = null;
  let runtimeCellChunkById = new Map<number, number>();
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const cellIndexById = new Map<number, number>();
  let previousFrameMs: number | null = null;
  let lastQualityTier: SurfaceQualityTier = adaptiveQuality.tier;
  let lastRuntimeLodTier = runtimeLod.tier;

  function disposeGroup(): void {
    for (const child of [...planetGroup.children]) {
      planetGroup.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry && !trackedGeometries.has(m.geometry)) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) for (const x of mat) x.dispose();
        else mat?.dispose();
      });
    }
    surfaceBuildToken++;
    gpuLifecycle.releaseAll();
    surfaceRuntime.cancel();
    resourceStreaming.cancel();
    requestDecorativeRestoration = null;
    for (const item of stagedSurfaceMeshes) gpuLifecycle.release(`surface-chunk-${item.id}`);
    stagedSurfaceMeshes = [];
    stagedSurfaceReady = false;
    surface = null;
    surfaceChunks = [];
    residency.clear();
    surfaceMaterial = null;
    markers = null;
    graph = null;
    cellBoundaries = null;
    selectionRing = null;
    cellIndexById.clear();
    runtimeCellChunkById.clear();
  }

  function instancedMarkers(geometry: THREE.BufferGeometry, data: PlanetMeshData): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ toneMapped: false }), data.cellCount);
    const m4 = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.cellCount; i++) {
      const selectable = data.cellSelectable[i] === 1;
      m4.compose(
        new THREE.Vector3(data.cellSurfaceCenters[i * 3]! * 1.012, data.cellSurfaceCenters[i * 3 + 1]! * 1.012, data.cellSurfaceCenters[i * 3 + 2]! * 1.012),
        new THREE.Quaternion(),
        new THREE.Vector3(selectable ? 1 : 0, selectable ? 1 : 0, selectable ? 1 : 0),
      );
      mesh.setMatrixAt(i, m4);
      color.setRGB(data.cellColors[i * 3]!, data.cellColors[i * 3 + 1]!, data.cellColors[i * 3 + 2]!);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    return mesh;
  }

  function setPlanet(data: PlanetMeshData, borderColorInner: string): void {
    disposeGroup();
    currentData = data;
    selectedCellId = null;
    for (let i = 0; i < data.cellIds.length; i++) cellIndexById.set(data.cellIds[i]!, i);
    // — поли-сетка (грани клеток, flat shading, vertexColors)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
    g.setAttribute('geologyBlend', new THREE.BufferAttribute(data.geologyBlend, 1));
    g.setAttribute('geologyType', new THREE.BufferAttribute(data.geologyTypes, 1));
    g.setAttribute('surfaceDetail', new THREE.BufferAttribute(data.surfaceDetail, 1));
    g.setAttribute('emissiveStrength', new THREE.BufferAttribute(data.emissiveStrength, 1));
    g.setAttribute('geologicalMotionAmplitude', new THREE.BufferAttribute(data.geologicalMotionAmplitude, 1));
    g.setAttribute('geologicalMotionSpeed', new THREE.BufferAttribute(data.geologicalMotionSpeed, 1));
    const material = createGeologicalSurfaceMaterial();
    surfaceMaterial = material;
    const originalCompile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = (shader, rendererInstance) => {
      originalCompile(shader, rendererInstance);
      material.userData.shader = shader;
    };
    surface = new THREE.Mesh(g, material);
    planetGroup.add(surface);
    trackGeometry('base-surface', g, 'base', true);
    // Decorative resources are reconstructible from retained CPU-side PlanetMeshData.
    const restoreBoundaries = (): boolean => {
      if (cellBoundaries) return true;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.boundaryPositions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(data.boundaryColors, 3));
      const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.88, depthWrite: false }));
      cellBoundaries = mesh;
      planetGroup.add(mesh);
      const bytes = estimateGeometryBytes(Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, attribute.array])));
      residency.register({ id: 'cell-boundaries', kind: 'decorative', pinned: false, bytes, evict: () => { if (cellBoundaries === mesh) { planetGroup.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); cellBoundaries = null; } } });
      return cellBoundaries === mesh;
    };
    const restoreGraph = (): boolean => {
      if (graph) return true;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(data.edgePositions, 3));
      const mesh = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: new THREE.Color(...parseColor(borderColorInner)), transparent: true, opacity: 0.35 }));
      graph = mesh;
      planetGroup.add(mesh);
      const bytes = estimateGeometryBytes(Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => [name, attribute.array])));
      residency.register({ id: 'neighbour-graph', kind: 'decorative', pinned: false, bytes, evict: () => { if (graph === mesh) { planetGroup.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); graph = null; } } });
      return graph === mesh;
    };
    restoreBoundaries();
    // — маркеры клеток: instancing + LOD (high detail вблизи, low вдалеке)
    const lod = new THREE.LOD();
    lod.addLevel(instancedMarkers(new THREE.IcosahedronGeometry(0.028, 2), data), LOD_NEAR);
    lod.addLevel(instancedMarkers(new THREE.IcosahedronGeometry(0.028, 0), data), LOD_FAR);
    markers = lod;
    planetGroup.add(lod);
    // — граф соседства восстанавливается отдельно, когда он снова нужен.
    requestDecorativeRestoration = () => {
      if (runtimeLod.tier !== 'far' && !cellBoundaries) resourceStreaming.request({ id: 'cell-boundaries', priority: 2, restore: restoreBoundaries });
      if (runtimeLod.tier === 'near' && !graph) resourceStreaming.request({ id: 'neighbour-graph', priority: 1, restore: restoreGraph });
    };

    // Build spatial chunks cooperatively. The monolithic mesh remains visible and pickable until
    // every chunk is ready, so loading never leaves a blank planet or interrupts interaction.
    const token = ++surfaceBuildToken;
    const polygonPlan = buildPolygonSurfaceChunkPlan({ cellIds: data.cellIds, cellSideCounts: data.cellSideCounts, neighborOffsets: data.neighborOffsets, neighborIds: data.neighborIds });
    runtimeCellChunkById = new Map(Array.from(data.cellIds, (id, index): [number, number] => [id, polygonPlan.cellChunkIds[index]!]));
    const initialView = new THREE.Vector3(0, 0, 1).applyQuaternion(planetGroup.quaternion.clone().invert());
    const priorityOrder = prioritizeSurfaceChunks({ cellIds: data.cellIds, cellCenters: data.cellCenters, cellChunkIds: polygonPlan.cellChunkIds, neighborOffsets: data.neighborOffsets, neighborIds: data.neighborIds, viewDirection: [initialView.x, initialView.y, initialView.z], activeCellId: selectedCellId }).map((entry) => entry.chunkId);
    const chunkInput = {
      positions: data.positions,
      faceCellIds: data.faceCellIds,
      cellIds: data.cellIds,
      cellCenters: data.cellCenters,
      cellChunkIds: polygonPlan.cellChunkIds,
      attributes: {
        color: data.colors,
        normal: data.normals,
        geologyBlend: data.geologyBlend,
        geologyType: data.geologyTypes,
        surfaceDetail: data.surfaceDetail,
        emissiveStrength: data.emissiveStrength,
        geologicalMotionAmplitude: data.geologicalMotionAmplitude,
        geologicalMotionSpeed: data.geologicalMotionSpeed,
      },
    };
    const queueChunksForRuntime = (chunks: SurfaceChunk[]): void => {
      if (token !== surfaceBuildToken || chunks.length === 0 || !surface) return;
      surfaceRuntime.begin(chunks);
      stagedSurfaceMeshes = [];
      stagedSurfaceReady = true;
    };
    // Worker receives copies via Transferable buffers: source geometry stays resident and pickable
    // until the complete replacement is ready. The output budget prevents unbounded duplication.
    void buildSurfaceChunksWithWorker(chunkInput, { maxOutputBytes: 24 * 1024 * 1024, maxInputCopyBytes: 24 * 1024 * 1024, chunkPriorityOrder: priorityOrder })
      .then((result) => { if (token === surfaceBuildToken) queueChunksForRuntime(result.chunks); })
      .catch(async (workerError: unknown) => {
        if (token !== surfaceBuildToken) return;
        console.warn('Voronia surface worker unavailable or over memory budget; using cooperative fallback.', workerError);
        try {
          const chunks = await buildSurfaceChunksAsync(chunkInput, { isCancelled: () => token !== surfaceBuildToken });
          const order = new Map(priorityOrder.map((id, index) => [id, index]));
          chunks.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
          queueChunksForRuntime(chunks);
        } catch (fallbackError) {
          console.warn('Voronia surface chunking failed; using monolithic surface.', fallbackError);
        }
      });
  }

  function selectCell(cellId: number | null): void {
    selectedCellId = cellId;
    if (selectionRing) {
      planetGroup.remove(selectionRing);
      selectionRing.geometry.dispose();
      (selectionRing.material as THREE.Material).dispose();
      selectionRing = null;
    }
    if (cellId === null) return;
    const index = cellIndexById.get(cellId);
    if (index === undefined) return;
    const x = currentData.cellSurfaceCenters[index * 3]!;
    const y = currentData.cellSurfaceCenters[index * 3 + 1]!;
    const z = currentData.cellSurfaceCenters[index * 3 + 2]!;
    const normal = new THREE.Vector3(x, y, z).normalize();
    selectionRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.055, 0.008, 6, 28),
      new THREE.MeshBasicMaterial({ color: 0xffdf75, depthTest: true, transparent: true, opacity: 0.95 }),
    );
    selectionRing.position.copy(normal.clone().multiplyScalar(Math.hypot(x, y, z) + 0.012));
    selectionRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    planetGroup.add(selectionRing);
  }

  let hoverRing: THREE.Mesh | null = null;
  let hoverCellId: number | null = null;

  /**
   * Этап 9.2: кольцо наведения (v1: подсветка подсказывала, что клетку можно ткнуть).
   * Тоньше и холоднее кольца выбора, чтобы не спорить с ним.
   */
  function setHover(cellId: number | null): void {
    if (cellId === hoverCellId) return;
    hoverCellId = cellId;
    if (hoverRing) {
      planetGroup.remove(hoverRing);
      hoverRing.geometry.dispose();
      (hoverRing.material as THREE.Material).dispose();
      hoverRing = null;
    }
    if (cellId === null || cellId === selectedCellId) return;
    const index = cellIndexById.get(cellId);
    if (index === undefined) return;
    const x = currentData.cellSurfaceCenters[index * 3]!;
    const y = currentData.cellSurfaceCenters[index * 3 + 1]!;
    const z = currentData.cellSurfaceCenters[index * 3 + 2]!;
    const normal = new THREE.Vector3(x, y, z).normalize();
    hoverRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.0045, 6, 24),
      new THREE.MeshBasicMaterial({ color: 0x8fd7ff, transparent: true, opacity: 0.5, depthTest: true }),
    );
    hoverRing.position.copy(normal.clone().multiplyScalar(Math.hypot(x, y, z) + 0.01));
    hoverRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    planetGroup.add(hoverRing);
  }

  /** id клетки под курсором (null — мимо или клетка недоступна). Общий для клика и наведения. */
  function cellAt(clientX: number, clientY: number): number | null {
    if (!surface && surfaceChunks.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    if (surface) {
      const hit = raycaster.intersectObject(surface, false)[0];
      const faceIndex = hit?.faceIndex;
      if (faceIndex == null) return null;
      const cellId = currentData.faceCellIds[faceIndex];
      if (cellId === undefined) return null;
      const cellIndex = cellIndexById.get(cellId);
      if (cellIndex === undefined || currentData.cellSelectable[cellIndex] !== 1) return null;
      return cellId;
    }
    const hits = raycaster.intersectObjects(surfaceChunks.map((item) => item.mesh), false);
    const hit = hits[0];
    const hitFaceIndex = hit?.faceIndex;
    if (hitFaceIndex == null || !hit?.object) return null;
    const chunk = surfaceChunks.find((item) => item.mesh === hit.object);
    const cellId = chunk?.faceCellIds[hitFaceIndex];
    if (cellId === undefined) return null;
    const cellIndex = cellIndexById.get(cellId);
    if (cellIndex === undefined || currentData.cellSelectable[cellIndex] !== 1) return null;
    return cellId;
  }

  function pickCell(clientX: number, clientY: number): void {
    const cellId = cellAt(clientX, clientY);
    if (cellId === null) return;
    selectCell(cellId);
    onCellSelected?.(cellId);
  }

  // drag-вращение (1.x: rotY по X-драгу, rotX по Y c клампом)
  let dragging = false;
  let px = 0;
  let py = 0;
  let downX = 0;
  let downY = 0;
  const activePointers = new Map<number, { x: number; y: number }>();
  let pinchDistance = 0;
  const distance = (): number => {
    const pts = [...activePointers.values()];
    return pts.length >= 2 ? Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) : 0;
  };
  const onDown = (e: PointerEvent): void => { activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); pinchDistance = distance(); dragging = true; px = downX = e.clientX; py = downY = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch { /* capture may be unavailable in embedded browsers */ } };
  const onMove = (e: PointerEvent): void => {
    if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointers.size >= 2) {
      const nextDistance = distance();
      if (pinchDistance > 0 && nextDistance > 0) camera.position.z = Math.max(2.15, Math.min(5.2, camera.position.z * (pinchDistance / nextDistance)));
      pinchDistance = nextDistance;
      return;
    }
    if (!dragging) return;
    rotY += (e.clientX - px) * 0.005;
    rotX = Math.max(-1.2, Math.min(1.2, rotX + (e.clientY - py) * 0.005));
    px = e.clientX;
    py = e.clientY;
  };
  const onUp = (e: PointerEvent): void => {
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    activePointers.delete(e.pointerId);
    pinchDistance = distance();
    dragging = activePointers.size > 0;
    if (moved < 6 && activePointers.size === 0) pickCell(e.clientX, e.clientY);
  };
  const onCancel = (e: PointerEvent): void => { activePointers.delete(e.pointerId); pinchDistance = distance(); dragging = activePointers.size > 0; };
  const onWheel = (e: WheelEvent): void => { e.preventDefault(); camera.position.z = Math.max(2.15, Math.min(5.2, camera.position.z + Math.sign(e.deltaY) * 0.16)); };
  const onContextLost = (event: Event): void => { event.preventDefault(); contextLost = true; gpuLifecycle.onContextLost(); };
  const onContextRestored = (): void => {
    contextLost = false;
    gpuLifecycle.onContextRestored();
    // Three.js recreates its WebGL state; mark retained CPU-side buffers/materials dirty for upload.
    planetGroup.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) for (const attribute of Object.values(mesh.geometry.attributes)) attribute.needsUpdate = true;
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) material.needsUpdate = true;
    });
  };
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  canvas.addEventListener('webglcontextrestored', onContextRestored, false);

  // Этап 9.2: наведение — кольцо + курсор-pointer (v1-паритет «клетки кликабельны»).
  // Пикинг дорогой, поэтому не чаще одного кадра (rAF-троттлинг).
  let hoverRaf = 0;
  const onHoverMove = (e: PointerEvent): void => {
    if (dragging || activePointers.size > 0) { if (hoverCellId !== null) setHover(null); return; }
    const x = e.clientX;
    const y = e.clientY;
    if (hoverRaf) return;
    hoverRaf = requestAnimationFrame(() => {
      hoverRaf = 0;
      const id = cellAt(x, y);
      setHover(id);
      canvas.style.cursor = id === null ? 'grab' : 'pointer';
    });
  };
  const onHoverLeave = (): void => { if (hoverRaf) { cancelAnimationFrame(hoverRaf); hoverRaf = 0; } setHover(null); canvas.style.cursor = 'grab'; };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointermove', onHoverMove);
  canvas.addEventListener('pointerleave', onHoverLeave);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function resize(): void {
    const w = canvas.clientWidth || 320;
    const h = canvas.clientHeight || 320;
    renderer.setPixelRatio(targetPixelRatio());
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function render(nowMs: number): void {
    if (contextLost) return;
    let currentFrameMs = 16.67;
    if (previousFrameMs !== null) {
      const frameMs = nowMs - previousFrameMs;
      currentFrameMs = frameMs;
      const nextTier = adaptiveQuality.update(nowMs, frameMs);
      if (nextTier !== lastQualityTier) {
        lastQualityTier = nextTier;
        resize(); // меняем только внутреннее разрешение canvas, CSS-размер не трогаем
      }
    }
    previousFrameMs = nowMs;
    const residencyState = residency.stats();
    const streamingLimits = streamingController.update(nowMs, currentFrameMs, residencyState.residentBytes, residencyState.budgetBytes);
    surfaceRuntime.setLimits(streamingLimits.stagingBudgetBytes, streamingLimits.maxChunksPerFrame);
    if (stagedSurfaceReady && surface && surfaceBuildToken > 0) {
      const cameraDirection = camera.position.clone().normalize().applyQuaternion(planetGroup.quaternion.clone().invert());
      const activeChunkId = selectedCellId === null ? null : (runtimeCellChunkById.get(selectedCellId) ?? null);
      const activeNeighborChunks = new Set<number>();
      if (selectedCellId !== null) {
        const activeIndex = cellIndexById.get(selectedCellId);
        if (activeIndex !== undefined) {
          for (let n = currentData.neighborOffsets[activeIndex] ?? 0; n < (currentData.neighborOffsets[activeIndex + 1] ?? 0); n++) {
            const neighborChunk = runtimeCellChunkById.get(currentData.neighborIds[n]!);
            if (neighborChunk !== undefined && neighborChunk !== activeChunkId) activeNeighborChunks.add(neighborChunk);
          }
        }
      }
      surfaceRuntime.reprioritize([cameraDirection.x, cameraDirection.y, cameraDirection.z], activeChunkId, activeNeighborChunks);
      const batch = surfaceRuntime.takeFrameBatch();
      for (const entry of batch) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(entry.chunk.positions, 3));
        for (const [name, values] of Object.entries(entry.chunk.attributes)) geometry.setAttribute(name, new THREE.BufferAttribute(values, ['geologyBlend', 'geologyType', 'surfaceDetail', 'emissiveStrength', 'geologicalMotionAmplitude', 'geologicalMotionSpeed'].includes(name) ? 1 : 3));
        const mesh = new THREE.Mesh(geometry, surface.material as THREE.Material);
        stagedSurfaceMeshes.push({ id: entry.chunk.id, mesh, faceCellIds: entry.chunk.faceCellIds });
        trackGeometry(`surface-chunk-${entry.chunk.id}`, geometry, 'base', true);
      }
      surfaceRuntime.markInstalled(batch.length);
      if (surfaceRuntime.isComplete()) {
        const oldSurface = surface;
        planetGroup.remove(oldSurface);
        gpuLifecycle.release('base-surface');
        surface = null;
        surfaceChunks = stagedSurfaceMeshes;
        for (const item of surfaceChunks) planetGroup.add(item.mesh);
        stagedSurfaceMeshes = [];
        stagedSurfaceReady = false;
      } else if (surfaceRuntime.isAborted()) {
        stagedSurfaceReady = false;
        for (const item of stagedSurfaceMeshes) gpuLifecycle.release(`surface-chunk-${item.id}`);
        stagedSurfaceMeshes = [];
        surfaceRuntime.cancel();
      }
    }
    if (!dragging) rotY += idleSpin;
    const lodState = runtimeLod.update(camera.position.distanceTo(planetGroup.position));
    if (lodState.tier !== lastRuntimeLodTier) {
      lastRuntimeLodTier = lodState.tier;
      if (cellBoundaries) cellBoundaries.visible = lodState.showCellBoundaries;
      if (graph) graph.visible = lodState.showNeighbourGraph;
    }
    if (lodState.showCellBoundaries || lodState.showNeighbourGraph) requestDecorativeRestoration?.();
    resourceStreaming.processFrame();
    const shader = surfaceMaterial?.userData.shader as { uniforms: { uVoroniaTime?: { value: number }; uVoroniaQuality?: { value: number }; uVoroniaAnimation?: { value: number }; uVoroniaLodDetail?: { value: number } } } | null;
    const qualityProfile = SURFACE_QUALITY[adaptiveQuality.tier];
    if (shader?.uniforms.uVoroniaTime) shader.uniforms.uVoroniaTime.value = nowMs * 0.001;
    if (shader?.uniforms.uVoroniaQuality) shader.uniforms.uVoroniaQuality.value = qualityProfile.shaderDetail;
    if (shader?.uniforms.uVoroniaAnimation) shader.uniforms.uVoroniaAnimation.value = Math.min(qualityProfile.animationScale, lodState.animationScale);
    if (shader?.uniforms.uVoroniaLodDetail) shader.uniforms.uVoroniaLodDetail.value = lodState.shaderDetail;
    planetGroup.rotation.set(rotX, rotY, 0);
    if (selectionRing) {
      const pulse = 1 + Math.sin(nowMs * 0.004) * 0.045;
      selectionRing.scale.setScalar(pulse);
    }
    markers?.update(camera);
    renderer.render(scene, camera);
    const diagnosticSnapshot = surfaceDiagnostics.snapshot(nowMs);
    surfaceStabilityMonitor.update(diagnosticSnapshot, nowMs);
    surfaceDashboard.update(diagnosticSnapshot, surfaceStabilityMonitor);
  }

  function dispose(): void {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointermove', onHoverMove);
    canvas.removeEventListener('pointerleave', onHoverLeave);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('webglcontextlost', onContextLost, false);
    canvas.removeEventListener('webglcontextrestored', onContextRestored, false);
    disposeGroup();
    gpuLifecycle.releaseAll();
    renderer.dispose();
    surfaceDiagnostics.dispose();
    surfaceDashboard.dispose();
  }

  setPlanet(initial, borderColor);
  resize();

  return {
    setPlanet,
    selectCell,
    setCellSelectHandler(handler) { onCellSelected = handler; },
    render,
    resize,
    zoomBy(delta) { camera.position.z = Math.max(2.15, Math.min(5.2, camera.position.z + delta)); },
    resetView() { rotX = -0.08; rotY = 0; camera.position.z = DEFAULT_CAMERA_Z; },
    dispose,
    get rotX() { return rotX; },
    get rotY() { return rotY; },
    get qualityTier() { return adaptiveQuality.tier; },
    getSurfaceDiagnostics() { return surfaceDiagnostics.snapshot(); },
    toggleSurfaceDiagnostics() { surfaceDashboard.toggle(); },
  };
}
