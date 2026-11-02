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
import { renderPixelRatio } from './pixelRatio';

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
}

const LOD_NEAR = 0;
const LOD_FAR = 5.5;

export function createPlanetViewer(canvas: HTMLCanvasElement, initial: PlanetMeshData, borderColor = '#8fd7ff'): PlanetViewer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  // На мобильных ограничиваем DPR до 1.5: меньше пикселей для GPU при сохранении чёткости.
  const targetPixelRatio = (): number => renderPixelRatio(window.devicePixelRatio || 1, window.innerWidth);
  renderer.setPixelRatio(targetPixelRatio());
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  const DEFAULT_CAMERA_Z = 3.2;
  camera.position.set(0, 0, DEFAULT_CAMERA_Z);
  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(2.5, 3, 4);
  scene.add(dir);

  const planetGroup = new THREE.Group();
  scene.add(planetGroup);
  let rotX = -0.08; // 1.x n.rotX после setActivePlanet
  let rotY = 0;
  const idleSpin = 0.0016;

  let surface: THREE.Mesh | null = null;
  let markers: THREE.LOD | null = null;
  let graph: THREE.LineSegments | null = null;
  let selectionRing: THREE.Mesh | null = null;
  let currentData = initial;
  let onCellSelected: ((cellId: number) => void) | null = null;
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const cellIndexById = new Map<number, number>();

  function disposeGroup(): void {
    for (const child of [...planetGroup.children]) {
      planetGroup.remove(child);
      child.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) for (const x of mat) x.dispose();
        else mat?.dispose();
      });
    }
    surface = null;
    markers = null;
    graph = null;
    selectionRing = null;
    cellIndexById.clear();
  }

  function instancedMarkers(geometry: THREE.BufferGeometry, data: PlanetMeshData): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ toneMapped: false }), data.cellCount);
    const m4 = new THREE.Matrix4();
    const color = new THREE.Color();
    for (let i = 0; i < data.cellCount; i++) {
      m4.makeTranslation(data.cellSurfaceCenters[i * 3]! * 1.012, data.cellSurfaceCenters[i * 3 + 1]! * 1.012, data.cellSurfaceCenters[i * 3 + 2]! * 1.012);
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
    for (let i = 0; i < data.cellIds.length; i++) cellIndexById.set(data.cellIds[i]!, i);
    // — поли-сетка (грани клеток, flat shading, vertexColors)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
    g.computeVertexNormals();
    surface = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    planetGroup.add(surface);
    // — маркеры клеток: instancing + LOD (high detail вблизи, low вдалеке)
    const lod = new THREE.LOD();
    lod.addLevel(instancedMarkers(new THREE.IcosahedronGeometry(0.028, 2), data), LOD_NEAR);
    lod.addLevel(instancedMarkers(new THREE.IcosahedronGeometry(0.028, 0), data), LOD_FAR);
    markers = lod;
    planetGroup.add(lod);
    // — граф соседства
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(data.edgePositions, 3));
    graph = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: new THREE.Color(...parseColor(borderColorInner)), transparent: true, opacity: 0.35 }));
    planetGroup.add(graph);
  }

  function selectCell(cellId: number | null): void {
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

  function pickCell(clientX: number, clientY: number): void {
    if (!surface) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObject(surface, false)[0];
    const faceIndex = hit?.faceIndex;
    if (faceIndex === undefined) return;
    const cellId = currentData.faceCellIds[faceIndex];
    if (cellId === undefined) return;
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
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
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
    if (!dragging) rotY += idleSpin;
    planetGroup.rotation.set(rotX, rotY, 0);
    markers?.update(camera);
    renderer.render(scene, camera);
    void nowMs;
  }

  function dispose(): void {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('wheel', onWheel);
    disposeGroup();
    renderer.dispose();
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
  };
}
