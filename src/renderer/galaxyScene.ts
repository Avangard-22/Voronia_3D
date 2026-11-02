/** Stage 7.0 — Three.js-сцена галактики. Игровые узлы и рёбра поступают только из PlanetaryGraph. */
import * as THREE from 'three';
import type { GalaxyRenderData } from './galaxyModel';
import type { GalaxyRenderNode } from './galaxyModel';
import { renderPixelRatio } from './pixelRatio';

export interface GalaxyViewer {
  setData(data: GalaxyRenderData): void;
  setNodeSelectHandler(handler: ((nodeId: string) => void) | null): void;
  render(nowMs: number): void;
  resize(): void;
  zoomBy(delta: number): void;
  resetView(): void;
  dispose(): void;
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStarField(count: number, radius: number): THREE.Points {
  const random = seeded(0x70a11ce);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const z = random() * 2 - 1;
    const a = random() * Math.PI * 2;
    const r = radius * Math.cbrt(random());
    const ring = Math.sqrt(1 - z * z);
    positions[i * 3] = Math.cos(a) * ring * r;
    positions[i * 3 + 1] = z * r * 0.32;
    positions[i * 3 + 2] = Math.sin(a) * ring * r;
    color.setHSL(0.52 + random() * 0.12, 0.25 + random() * 0.35, 0.62 + random() * 0.34);
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.018, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true, depthWrite: false }));
}

/** Фоновые спиральные рукава — визуальная структура, игровые системы на них не создаются. */
function makeSpiralArms(radius: number): THREE.Points {
  const arms = 4;
  const perArm = 720;
  const positions = new Float32Array(arms * perArm * 3);
  const colors = new Float32Array(positions.length);
  const random = seeded(0x5a17a1);
  const color = new THREE.Color();
  let cursor = 0;
  for (let arm = 0; arm < arms; arm++) {
    for (let i = 0; i < perArm; i++) {
      const t = 0.08 + (i / (perArm - 1)) * 0.94;
      const r = radius * t;
      const angle = arm * (Math.PI * 2 / arms) + t * Math.PI * 2.7 + (random() - 0.5) * 0.16;
      const spread = (random() - 0.5) * (0.18 + t * 0.55);
      positions[cursor] = Math.cos(angle) * (r + spread);
      positions[cursor + 1] = (random() - 0.5) * (0.12 + t * 0.2);
      positions[cursor + 2] = Math.sin(angle) * (r + spread);
      color.setHSL(0.53 + random() * 0.08, 0.55, 0.28 + random() * 0.34);
      colors[cursor] = color.r; colors[cursor + 1] = color.g; colors[cursor + 2] = color.b;
      cursor += 3;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.48, sizeAttenuation: true, depthWrite: false }));
}

function nodeColor(node: GalaxyRenderNode): THREE.Color {
  if (node.active) return new THREE.Color('#ffd36a');
  if (!node.discovered) return new THREE.Color('#263b50');
  if (!node.unlocked) return new THREE.Color('#4d9ab7');
  if (node.signalClass === 'anomaly') return new THREE.Color('#c18aff');
  if (node.signalClass === 'cryo') return new THREE.Color('#8ceaff');
  if (node.signalClass === 'energy') return new THREE.Color('#ffe18a');
  if (node.signalClass === 'resource') return new THREE.Color('#72d8b0');
  return new THREE.Color('#a5d9ee');
}

export function createGalaxyViewer(canvas: HTMLCanvasElement, initial: GalaxyRenderData): GalaxyViewer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(renderPixelRatio(window.devicePixelRatio || 1, window.innerWidth));
  renderer.setClearColor('#020711', 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#020711', 0.012);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 250);
  const target = new THREE.Vector3();
  let distance = Math.max(15, initial.bounds * 2.2);
  let yaw = 0.42;
  let pitch = 0.82;
  const updateCamera = (): void => {
    const cp = Math.cos(pitch);
    camera.position.set(target.x + Math.sin(yaw) * cp * distance, target.y + Math.sin(pitch) * distance, target.z + Math.cos(yaw) * cp * distance);
    camera.lookAt(target);
  };
  scene.add(new THREE.AmbientLight(0x9bbbd0, 0.55));
  const coreLight = new THREE.PointLight(0x4da9d6, 2.2, 24);
  coreLight.position.set(0, 0, 0);
  scene.add(coreLight);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), new THREE.MeshBasicMaterial({ color: '#b6eaff' }));
  scene.add(core);
  const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(1.35, 24, 16), new THREE.MeshBasicMaterial({ color: '#2c8eb8', transparent: true, opacity: 0.09, depthWrite: false }));
  scene.add(coreGlow);
  scene.add(makeSpiralArms(Math.max(18, initial.bounds * 1.8)));
  scene.add(makeStarField(2400, Math.max(36, initial.bounds * 3.2)));

  let nodeMesh: THREE.InstancedMesh | null = null;
  let edgeLines: THREE.LineSegments | null = null;
  let currentData = initial;
  let onSelect: ((id: string) => void) | null = null;
  const nodeByInstance: string[] = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const disposeDynamic = (): void => {
    if (nodeMesh) { scene.remove(nodeMesh); nodeMesh.geometry.dispose(); (nodeMesh.material as THREE.Material).dispose(); nodeMesh = null; }
    if (edgeLines) { scene.remove(edgeLines); edgeLines.geometry.dispose(); (edgeLines.material as THREE.Material).dispose(); edgeLines = null; }
    nodeByInstance.length = 0;
  };

  function setData(data: GalaxyRenderData): void {
    const previousBounds = currentData.bounds;
    disposeDynamic();
    currentData = data;
    if (data.bounds > previousBounds * 1.15) { distance = Math.max(distance, data.bounds * 2.2); updateCamera(); }
    const geometry = new THREE.SphereGeometry(0.105, 10, 8);
    const material = new THREE.MeshBasicMaterial({ vertexColors: true });
    nodeMesh = new THREE.InstancedMesh(geometry, material, Math.max(1, data.nodes.length));
    nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    data.nodes.forEach((node, index) => {
      matrix.makeTranslation(node.x, node.y, node.z);
      const size = node.active ? 2.2 : node.discovered ? 1.25 : 0.72;
      scale.setScalar(size);
      matrix.scale(scale);
      nodeMesh!.setMatrixAt(index, matrix);
      nodeMesh!.setColorAt(index, color.copy(nodeColor(node)));
      nodeByInstance[index] = node.id;
    });
    nodeMesh.instanceMatrix.needsUpdate = true;
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
    nodeMesh.computeBoundingSphere();
    scene.add(nodeMesh);

    const byId = new Map(data.nodes.map((node) => [node.id, node]));
    const points: number[] = [];
    for (const [a, b] of data.edges) {
      const from = byId.get(a), to = byId.get(b);
      if (!from || !to) continue;
      points.push(from.x, from.y, from.z, to.x, to.y, to.z);
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    edgeLines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: '#4b91b1', transparent: true, opacity: 0.52 }));
    scene.add(edgeLines);
  }

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let downX = 0;
  let downY = 0;
  const onDown = (event: PointerEvent): void => {
    dragging = true; lastX = downX = event.clientX; lastY = downY = event.clientY;
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onMove = (event: PointerEvent): void => {
    if (!dragging) return;
    yaw -= (event.clientX - lastX) * 0.006;
    pitch = clamp(pitch + (event.clientY - lastY) * 0.006, -0.12, 1.42);
    lastX = event.clientX; lastY = event.clientY;
    updateCamera();
  };
  const pick = (event: PointerEvent): void => {
    if (!nodeMesh || Math.hypot(event.clientX - downX, event.clientY - downY) > 5) return;
    const rect = canvas.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(nodeMesh, false)[0];
    const id = hit?.instanceId === undefined ? undefined : nodeByInstance[hit.instanceId];
    const node = currentData.nodes.find((item) => item.id === id);
    if (node?.discovered) onSelect?.(node.id);
  };
  const onUp = (event: PointerEvent): void => { pick(event); dragging = false; };
  const onCancel = (): void => { dragging = false; };
  const onWheel = (event: WheelEvent): void => { event.preventDefault(); distance = clamp(distance + Math.sign(event.deltaY) * 0.8, 3.5, 45); updateCamera(); };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  function resize(): void {
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 420;
    renderer.setPixelRatio(renderPixelRatio(window.devicePixelRatio || 1, window.innerWidth));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  function dispose(): void {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointercancel', onCancel);
    canvas.removeEventListener('wheel', onWheel);
    disposeDynamic();
    for (const object of [...scene.children]) {
      if (object === nodeMesh || object === edgeLines) continue;
      object.traverse((child) => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose()); else mat?.dispose();
      });
    }
    renderer.dispose();
  }
  setData(initial);
  updateCamera();
  resize();
  return {
    setData,
    setNodeSelectHandler(handler) { onSelect = handler; },
    render(nowMs) { core.rotation.y = nowMs * 0.00004; renderer.render(scene, camera); },
    resize,
    zoomBy(delta) { distance = clamp(distance + delta, 3.5, 45); updateCamera(); },
    resetView() { yaw = 0.42; pitch = 0.82; distance = Math.max(12, currentData.bounds * 2.2); updateCamera(); },
    dispose,
  };
}
