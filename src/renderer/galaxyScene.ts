/** Stage 7.0 — Three.js-сцена галактики. Игровые узлы и рёбра поступают только из PlanetaryGraph. */
import * as THREE from 'three';
import type { GalaxyRenderData } from './galaxyModel';
import type { GalaxyRenderNode } from './galaxyModel';
import { renderPixelRatio } from './pixelRatio';
import { galaxyLodForDistance, galaxyVisualBudget } from './galaxyVisualDepth';
import { findSelectableGalaxyNode, resolveGalaxyRoute, routePositionAtProgress } from './galaxyInteraction';
import { buildGalaxySystemDetail } from './galaxySystemDetail';
export interface OrbitalTopologyRenderData { readonly systemId: string; readonly hostPlanetId: string; readonly star: { readonly class: string; readonly temperatureK: number; readonly luminosity: number }; readonly bodies: readonly { readonly bodyId: string; readonly orbitIndex: number; readonly orbitRadius: number; readonly eccentricity: number; readonly inclination: number; readonly orbitalPhase: number; readonly bodyClass: string; readonly discovered: boolean; readonly planetId: string | null; readonly parentSystemId: string }[] }

export interface GalaxyViewer {
  setData(data: GalaxyRenderData): void;
  setNodeSelectHandler(handler: ((nodeId: string) => void) | null): void;
  setSelectedNode(nodeId: string | null): void;
  setSystemFocus(nodeId: string | null): void;
  setOrbitalTopology(topology: OrbitalTopologyRenderData | null, onNavigate: ((planetId: string) => void) | null): void;
  setRoute(path: readonly string[]): void;
  focusNode(nodeId: string, durationMs?: number): void;
  animateRoute(path: readonly string[], durationMs?: number): void;
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


/** Объёмные газопылевые облака. Это только фоновые эффекты, не игровые объекты. */
function makeNebulaClouds(radius: number, count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const random = seeded(0x6e8b1a);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const arm = Math.floor(random() * 4);
    const t = 0.12 + random() * 0.86;
    const angle = arm * Math.PI * 0.5 + t * Math.PI * 2.7 + (random() - 0.5) * 0.52;
    const radialSpread = (random() + random() + random() - 1.5) * radius * (0.018 + t * 0.035);
    const r = radius * t + radialSpread;
    const vertical = (random() + random() + random() - 1.5) * radius * (0.008 + t * 0.025);
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = vertical;
    positions[i * 3 + 2] = Math.sin(angle) * r;
    const hue = random() < 0.58 ? 0.76 + random() * 0.08 : 0.49 + random() * 0.09;
    color.setHSL(hue, 0.58, 0.32 + random() * 0.2);
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false }));
}

/** Небольшие скопления звёзд вдоль рукавов, не связанные с PlanetaryGraph. */
function makeStarClusters(radius: number, count: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const random = seeded(0xc1a57e);
  const color = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const arm = i % 4;
    const t = 0.18 + random() * 0.78;
    const angle = arm * Math.PI * 0.5 + t * Math.PI * 2.7;
    const r = radius * t + (random() + random() - 1) * radius * 0.045;
    positions[i * 3] = Math.cos(angle) * r + (random() - 0.5) * radius * 0.035;
    positions[i * 3 + 1] = (random() - 0.5) * radius * 0.055;
    positions[i * 3 + 2] = Math.sin(angle) * r + (random() - 0.5) * radius * 0.035;
    color.setHSL(0.52 + random() * 0.13, 0.2 + random() * 0.25, 0.72 + random() * 0.26);
    colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ size: 0.035, vertexColors: true, transparent: true, opacity: 0.86, sizeAttenuation: true, depthWrite: false }));
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
  const galaxyRadius = Math.max(18, initial.bounds * 1.8);
  const visualBudget = galaxyVisualBudget(window.innerWidth, window.devicePixelRatio || 1);
  const spiralArms = makeSpiralArms(galaxyRadius);
  const nebulaClouds = makeNebulaClouds(galaxyRadius, visualBudget.nebulaPoints);
  const starClusters = makeStarClusters(galaxyRadius, visualBudget.clusterStars);
  const starField = makeStarField(Math.max(900, Math.floor(visualBudget.nebulaPoints * 0.9)), Math.max(36, initial.bounds * 3.2));
  scene.add(spiralArms, nebulaClouds, starClusters, starField);
  const coreRing = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.018, 6, 96), new THREE.MeshBasicMaterial({ color: '#397fa8', transparent: true, opacity: 0.28, depthWrite: false }));
  coreRing.rotation.x = Math.PI * 0.5;
  scene.add(coreRing);

  let nodeMesh: THREE.InstancedMesh | null = null;
  let systemCoreMesh: THREE.InstancedMesh | null = null;
  let edgeLines: THREE.LineSegments | null = null;
  let currentData = initial;
  let onSelect: ((id: string) => void) | null = null;
  let selectedNodeId: string | null = null;
  let routePath: readonly string[] = [];
  let routeLines: THREE.Line | null = null;
  let selectionRing: THREE.Mesh | null = null;
  let systemDetailGroup: THREE.Group | null = null;
  let systemFocusId: string | null = null;
  let systemOrbitBody: THREE.Group | null = null;
  let systemOrbitRadius = 0;
  let systemOrbitTilt = 0;
  let systemOrbitPhase = 0;
  let orbitalSystemGroup: THREE.Group | null = null;
  let orbitalBodies: { planetId: string; mesh: THREE.Mesh; semiMajor: number; eccentricity: number; phase: number; speed: number; inclination: number }[] = [];
  let onOrbitalNavigate: ((planetId: string) => void) | null = null;
  let flightMarker: THREE.Mesh | null = null;
  let flightStartedAt = 0;
  let flightDuration = 0;
  let flightPoints: THREE.Vector3[] = [];
  let focusFrom = new THREE.Vector3();
  let focusTo = new THREE.Vector3();
  let focusStartedAt = 0;
  let focusDuration = 0;
  const nodeByInstance: string[] = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const disposeDynamic = (): void => {
    if (nodeMesh) { scene.remove(nodeMesh); nodeMesh.geometry.dispose(); (nodeMesh.material as THREE.Material).dispose(); nodeMesh = null; }
    if (systemCoreMesh) { scene.remove(systemCoreMesh); systemCoreMesh.geometry.dispose(); (systemCoreMesh.material as THREE.Material).dispose(); systemCoreMesh = null; }
    if (edgeLines) { scene.remove(edgeLines); edgeLines.geometry.dispose(); (edgeLines.material as THREE.Material).dispose(); edgeLines = null; }
    nodeByInstance.length = 0;
    if (routeLines) { scene.remove(routeLines); routeLines.geometry.dispose(); (routeLines.material as THREE.Material).dispose(); routeLines = null; }
    if (selectionRing) { scene.remove(selectionRing); selectionRing.geometry.dispose(); (selectionRing.material as THREE.Material).dispose(); selectionRing = null; }
    if (orbitalSystemGroup) { scene.remove(orbitalSystemGroup); orbitalSystemGroup.traverse((child) => { const mesh = child as THREE.Mesh; mesh.geometry?.dispose?.(); const material = mesh.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material?.dispose(); }); orbitalSystemGroup = null; orbitalBodies = []; }
    if (systemDetailGroup) { scene.remove(systemDetailGroup); systemDetailGroup.traverse((child) => { const mesh = child as THREE.Mesh; mesh.geometry?.dispose?.(); const material = mesh.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material?.dispose(); }); systemDetailGroup = null; systemOrbitBody = null; }
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

    // Ближний LOD: более чёткое ядро только у известных звёздных систем.
    const knownNodes = data.nodes.filter((node) => node.discovered);
    const coreGeometry = new THREE.SphereGeometry(0.042, 10, 8);
    const coreMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });
    systemCoreMesh = new THREE.InstancedMesh(coreGeometry, coreMaterial, Math.max(1, knownNodes.length));
    const coreMatrix = new THREE.Matrix4();
    const coreScale = new THREE.Vector3();
    knownNodes.forEach((node, index) => {
      coreMatrix.makeTranslation(node.x, node.y, node.z);
      coreScale.setScalar(node.active ? 1.7 : node.unlocked ? 1.25 : 1);
      coreMatrix.scale(coreScale);
      systemCoreMesh!.setMatrixAt(index, coreMatrix);
      systemCoreMesh!.setColorAt(index, nodeColor(node));
    });
    systemCoreMesh.instanceMatrix.needsUpdate = true;
    if (systemCoreMesh.instanceColor) systemCoreMesh.instanceColor.needsUpdate = true;
    scene.add(systemCoreMesh);
    applyLod();

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
    updateSelectionAndRoute();
    updateSystemDetail();
    applyLod();
  }

  function updateSelectionAndRoute(): void {
    if (routeLines) { scene.remove(routeLines); routeLines.geometry.dispose(); (routeLines.material as THREE.Material).dispose(); routeLines = null; }
    if (selectionRing) { scene.remove(selectionRing); selectionRing.geometry.dispose(); (selectionRing.material as THREE.Material).dispose(); selectionRing = null; }
    const routePoints: number[] = [];
    for (const node of resolveGalaxyRoute(currentData, routePath)) routePoints.push(node.x, node.y, node.z);
    if (routePoints.length >= 6) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(routePoints, 3));
      routeLines = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ffe18a', transparent: true, opacity: 0.98 }));
      routeLines.computeLineDistances();
      scene.add(routeLines);
    }
    const selected = selectedNodeId ? findSelectableGalaxyNode(currentData, selectedNodeId) : null;
    if (selected) {
      selectionRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 36), new THREE.MeshBasicMaterial({ color: '#fff0a8', transparent: true, opacity: 0.95 }));
      selectionRing.position.set(selected.x, selected.y, selected.z);
      selectionRing.rotation.x = Math.PI / 2;
      scene.add(selectionRing);
    }
  }

  function updateSystemDetail(): void {
    if (systemDetailGroup) {
      scene.remove(systemDetailGroup);
      systemDetailGroup.traverse((child) => {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose?.();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material?.dispose();
      });
      systemDetailGroup = null;
      systemOrbitBody = null;
    }
    const node = systemFocusId ? findSelectableGalaxyNode(currentData, systemFocusId) : null;
    const detail = buildGalaxySystemDetail(node);
    if (!node || !detail) return;
    const group = new THREE.Group();
    group.position.set(node.x, node.y, node.z);
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.31, 28, 20), new THREE.MeshBasicMaterial({ color: detail.starColor }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.72, 24, 16), new THREE.MeshBasicMaterial({ color: detail.starColor, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending }));
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(detail.orbitRadius, 0.009, 6, 112), new THREE.MeshBasicMaterial({ color: '#8caec2', transparent: true, opacity: 0.48, depthWrite: false }));
    orbit.rotation.x = Math.PI / 2 + detail.orbitTilt;
    const planetBody = new THREE.Group();
    const planet = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), new THREE.MeshStandardMaterial({ color: detail.planetColor, roughness: 0.82, metalness: 0.08, emissive: detail.planetColor, emissiveIntensity: detail.anomaly ? 0.34 : 0.08 }));
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), new THREE.MeshBasicMaterial({ color: detail.planetColor, wireframe: true, transparent: true, opacity: 0.38 }));
    planetBody.add(planet, marker);
    if (detail.anomaly) {
      const anomalyHalo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.018, 8, 64), new THREE.MeshBasicMaterial({ color: '#c18aff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending }));
      anomalyHalo.rotation.set(0.6, 0.2, 0.9);
      planetBody.add(anomalyHalo);
    }
    group.add(glow, star, orbit, planetBody);
    systemOrbitBody = planetBody;
    systemOrbitRadius = detail.orbitRadius;
    systemOrbitTilt = detail.orbitTilt;
    systemOrbitPhase = detail.orbitPhase;
    systemDetailGroup = group;
    scene.add(group);
  }

  function setSystemFocus(nodeId: string | null): void {
    systemFocusId = nodeId;
    updateSystemDetail();
    if (nodeId) {
      const node = findSelectableGalaxyNode(currentData, nodeId);
      if (node) {
        focusFrom.copy(target);
        focusTo.set(node.x, node.y, node.z);
        focusStartedAt = performance.now();
        focusDuration = 780;
        distance = 6.2;
        updateCamera();
      }
    } else {
      focusFrom.copy(target);
      focusTo.set(0, 0, 0);
      focusStartedAt = performance.now();
      focusDuration = 650;
      distance = Math.max(12, currentData.bounds * 2.2);
      updateCamera();
    }
    applyLod();
  }

  function setOrbitalTopology(topology: OrbitalTopologyRenderData | null, onNavigate: ((planetId: string) => void) | null): void {
    if (orbitalSystemGroup) {
      scene.remove(orbitalSystemGroup);
      orbitalSystemGroup.traverse((child) => { const mesh = child as THREE.Mesh; mesh.geometry?.dispose?.(); const material = mesh.material as THREE.Material | THREE.Material[] | undefined; if (Array.isArray(material)) material.forEach((item) => item.dispose()); else material?.dispose(); });
      orbitalSystemGroup = null;
    }
    orbitalBodies = []; onOrbitalNavigate = onNavigate;
    if (!topology) { applyLod(); return; }
    const group = new THREE.Group();
    const starPalette: Record<string, string> = { blue: '#8bdcff', white: '#e8f4ff', yellow: '#ffe39a', orange: '#ffb66e', red: '#ff806f' };
    const starColor = starPalette[topology.star?.class ?? 'yellow'] ?? '#ffe39a';
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.48, 32, 24), new THREE.MeshBasicMaterial({ color: starColor }));
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.92, 24, 16), new THREE.MeshBasicMaterial({ color: starColor, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    group.add(star, glow);
    const colors: Record<string, string> = { terrestrial: '#55b8a0', ice: '#9fe8ff', 'gas-giant': '#d9a66c', dwarf: '#b6a8c9', 'asteroid-belt': '#8b929d', unknown: '#587080' };
    for (const body of topology.bodies) {
      if (!body.discovered || !body.planetId) continue;
      const a = Math.max(1.35, body.orbitRadius * 1.05);
      const e = clamp(body.eccentricity, 0, 0.35);
      const inclination = body.inclination;
      const orbitPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= 160; i++) {
        const angle = (i / 160) * Math.PI * 2;
        const x = a * (Math.cos(angle) - e);
        const z = a * Math.sqrt(1 - e * e) * Math.sin(angle);
        orbitPoints.push(new THREE.Vector3(x, z * Math.sin(inclination), z * Math.cos(inclination)));
      }
      const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbit = new THREE.LineLoop(orbitGeometry, new THREE.LineBasicMaterial({ color: '#7794a8', transparent: true, opacity: 0.42, depthWrite: false }));
      group.add(orbit);
      const size = body.orbitIndex === 0 ? 0.19 : Math.max(0.105, 0.18 - body.orbitIndex * 0.012);
      const color = colors[body.bodyClass] ?? '#8bb8c9';
      const planet = new THREE.Mesh(new THREE.SphereGeometry(size, 20, 14), new THREE.MeshStandardMaterial({ color, roughness: body.bodyClass === 'gas-giant' ? 0.58 : 0.82, metalness: 0.06, emissive: color, emissiveIntensity: 0.08 }));
      group.add(planet);
      orbitalBodies.push({ planetId: body.planetId, mesh: planet, semiMajor: a, eccentricity: e, phase: body.orbitalPhase, speed: 0.00012 / Math.sqrt(Math.max(1, a)), inclination });
    }
    orbitalSystemGroup = group; scene.add(group);
    target.set(0, 0, 0);
    const maxOrbit = Math.max(2, ...topology.bodies.filter((b) => b.discovered && b.planetId).map((b) => b.orbitRadius * (1 + b.eccentricity) * 1.25));
    distance = clamp(maxOrbit * 2.2, 5.5, 15);
    focusDuration = 0; updateCamera(); applyLod();
  }

  function applyLod(): void {
    const lod = galaxyLodForDistance(distance);
    spiralArms.visible = lod !== 'system';
    nebulaClouds.visible = lod !== 'system';
    starClusters.visible = lod !== 'system';
    starField.visible = true;
    if (systemCoreMesh) systemCoreMesh.visible = lod === 'regional';
    if (nodeMesh) nodeMesh.visible = lod !== 'system';
    if (edgeLines) edgeLines.visible = lod !== 'system';
    if (systemDetailGroup) systemDetailGroup.visible = lod === 'system' && !orbitalSystemGroup;
    if (orbitalSystemGroup) orbitalSystemGroup.visible = lod === 'system';
  }

  function setRoute(path: readonly string[]): void { routePath = [...path]; updateSelectionAndRoute(); }

  function focusNode(nodeId: string, durationMs = 650): void {
    const node = findSelectableGalaxyNode(currentData, nodeId);
    if (!node) return;
    focusFrom.copy(target); focusTo.set(node.x, node.y, node.z);
    focusStartedAt = performance.now(); focusDuration = Math.max(0, durationMs);
    if (!focusDuration) { target.copy(focusTo); updateCamera(); }
  }

  function animateRoute(path: readonly string[], durationMs = 2400): void {
    flightPoints = resolveGalaxyRoute(currentData, path).map((node) => new THREE.Vector3(node.x, node.y, node.z));
    if (flightPoints.length < 2) return;
    if (!flightMarker) {
      flightMarker = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      scene.add(flightMarker);
    }
    flightStartedAt = performance.now(); flightDuration = Math.max(500, durationMs);
    flightMarker.visible = true;
    flightMarker.position.copy(flightPoints[0]);
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
    if (orbitalSystemGroup?.visible) {
      const orbitalHit = raycaster.intersectObjects(orbitalBodies.map((body) => body.mesh), false)[0];
      if (orbitalHit?.object) { const body = orbitalBodies.find((item) => item.mesh === orbitalHit.object); if (body) { onOrbitalNavigate?.(body.planetId); return; } }
    }
    const hit = nodeMesh ? raycaster.intersectObject(nodeMesh, false)[0] : undefined;
    const id = hit?.instanceId === undefined ? undefined : nodeByInstance[hit.instanceId];
    const node = id ? findSelectableGalaxyNode(currentData, id) : null;
    if (node) onSelect?.(node.id);
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
    if (flightMarker) { scene.remove(flightMarker); flightMarker.geometry.dispose(); (flightMarker.material as THREE.Material).dispose(); flightMarker = null; }
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
    setSelectedNode(nodeId) { selectedNodeId = nodeId; updateSelectionAndRoute(); },
    setSystemFocus,
    setOrbitalTopology,
    setRoute,
    focusNode,
    animateRoute,
    render(nowMs) {
      core.rotation.y = nowMs * 0.00004;
      for (const body of orbitalBodies) { const mean = body.phase + nowMs * body.speed; let eccentric = mean; for (let i = 0; i < 4; i++) eccentric -= (eccentric - body.eccentricity * Math.sin(eccentric) - mean) / (1 - body.eccentricity * Math.cos(eccentric)); const x = body.semiMajor * (Math.cos(eccentric) - body.eccentricity); const z = body.semiMajor * Math.sqrt(1 - body.eccentricity * body.eccentricity) * Math.sin(eccentric); body.mesh.position.set(x, z * Math.sin(body.inclination), z * Math.cos(body.inclination)); body.mesh.rotation.y += 0.002; }
      if (systemOrbitBody) {
        const phase = systemOrbitPhase + nowMs * 0.00022;
        systemOrbitBody.position.set(Math.cos(phase) * systemOrbitRadius, Math.sin(phase) * systemOrbitRadius * Math.sin(systemOrbitTilt), Math.sin(phase) * systemOrbitRadius);
      }
      applyLod();
      if (focusDuration > 0) { const t = clamp((nowMs - focusStartedAt) / focusDuration, 0, 1); const eased = t * t * (3 - 2 * t); target.lerpVectors(focusFrom, focusTo, eased); updateCamera(); if (t >= 1) focusDuration = 0; }
      if (flightMarker && flightPoints.length >= 2 && flightDuration > 0) {
        const t = clamp((nowMs - flightStartedAt) / flightDuration, 0, 1);
        const point = routePositionAtProgress(flightPoints, t);
        if (point) flightMarker.position.set(point.x, point.y, point.z);
        if (t >= 1) { flightDuration = 0; flightMarker.visible = false; } else flightMarker.visible = true;
      }
      renderer.render(scene, camera);
    },
    resize,
    zoomBy(delta) { distance = clamp(distance + delta, 3.5, 45); updateCamera(); applyLod(); },
    resetView() { yaw = 0.42; pitch = 0.82; target.set(0, 0, 0); focusDuration = 0; distance = Math.max(12, currentData.bounds * 2.2); updateCamera(); applyLod(); },
    dispose,
  };
}
