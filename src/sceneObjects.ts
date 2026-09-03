import * as THREE from 'three';
import type { SceneNode } from './types';
import { buildText3D, textSprite, updateObjectText } from './threeText';

export { updateObjectText };

export function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
        material.dispose();
      });
    }
    if (child instanceof THREE.Sprite) {
      child.material.map?.dispose();
      child.material.dispose();
    }
  });
}

function standard(color: string, tintable = false, metalness = 0.08) {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness,
  });
  material.userData.tintable = tintable;
  return material;
}
function mesh(
  geometry: THREE.BufferGeometry,
  color: string,
  position: [number, number, number],
  tintable = false,
  metalness = 0.08,
) {
  const item = new THREE.Mesh(geometry, standard(color, tintable, metalness));
  item.position.set(...position);
  item.userData.tintable = tintable;
  return item;
}
function box(
  size: [number, number, number],
  color: string,
  position: [number, number, number],
  tintable = false,
) {
  return mesh(new THREE.BoxGeometry(...size), color, position, tintable);
}
function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  color: string,
  position: [number, number, number],
  tintable = false,
  segments = 24,
) {
  return mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    color,
    position,
    tintable,
    0.18,
  );
}
function group(...items: THREE.Object3D[]) {
  const result = new THREE.Group();
  if (items.length > 0) result.add(...items);
  return result;
}

export function buildObject(node: SceneNode): THREE.Object3D {
  const color = node.color ?? '#34d399';
  if (node.kind === 'group') return new THREE.Group();
  if (node.kind === 'line') return buildLineChart(node);
  if (node.kind === 'gauge') return buildGauge(node);
  if (node.kind === 'bar') return buildBar(node);
  if (node.kind === 'sphere')
    return group(mesh(new THREE.SphereGeometry(0.8, 28, 18), color, [0, 0.8, 0], true));
  if (node.kind === 'plane') {
    const item = mesh(new THREE.PlaneGeometry(3, 3), color, [0, 0.01, 0], true);
    item.rotation.x = -Math.PI / 2;
    return group(item);
  }
  if (node.kind === 'image') return group(box([2.4, 1.6, 0.04], '#173d3a', [0, 0.8, 0], false));
  if (node.kind === 'building') return buildBuilding(color);
  if (node.kind === 'office') return buildOffice(color);
  if (node.kind === 'factory') return buildFactory(color);
  if (node.kind === 'warehouse') return buildWarehouse(color);
  if (node.kind === 'tank') return buildTank(color);
  if (node.kind === 'coolingTower') return buildCoolingTower(color);
  if (node.kind === 'pipeline') return buildPipeline(color);
  if (node.kind === 'road') return buildRoad();
  if (node.kind === 'tree') return buildTree(color);
  if (node.kind === 'windTurbine') return buildWindTurbine(color);
  if (node.kind === 'solarPanel') return buildSolarPanels(color);
  if (node.kind === 'conveyor') return buildConveyor(color);
  if (node.kind === 'gantryCrane') return buildCrane(color);
  if (node.kind === 'truck') return buildTruck(color);
  if (node.kind === 'car') return buildCar(color);
  if (node.kind === 'bus') return buildBus(color);
  if (node.kind === 'forklift') return buildForklift(color);
  if (node.kind === 'trafficLight') return buildTrafficLight(color);
  if (node.kind === 'parkingGate') return buildParkingGate(color);
  if (node.kind === 'streetLight') return buildStreetLight(color);
  if (node.kind === 'fence') return buildFence(color);
  if (node.kind === 'securityBooth') return buildSecurityBooth(color);
  if (node.kind === 'fireHydrant') return buildFireHydrant(color);
  if (node.kind === 'chargingPile') return buildChargingPile(color);
  if (node.kind === 'pump') return buildPump(color);
  if (node.kind === 'valve') return buildValve(color);
  if (node.kind === 'transformer') return buildTransformer(color);
  if (node.kind === 'electricalCabinet') return buildElectricalCabinet(color);
  if (node.kind === 'sensor') return buildSensor(color);
  if (node.kind === 'cctv') return buildCctv(color);
  if (node.kind === 'accessControl') return buildAccessControl(color);
  if (node.kind === 'robotArm') return buildRobotArm(color);
  if (node.kind === 'machineTool') return buildMachineTool(color);
  if (node.kind === 'displayStand') return buildDisplayStand(color);
  if (node.kind === 'ledScreen') return buildLedScreen(color);
  if (node.kind === 'storageRack') return buildStorageRack(color);
  if (node.kind === 'pallet') return buildPallet(color);
  if (node.kind === 'agv') return buildAgv(color);
  if (node.kind === 'bridge') return buildBridge(color);
  if (node.kind === 'transmissionTower') return buildTransmissionTower(color);
  if (node.kind === 'serverRack') return buildServerRack(color);
  if (node.kind === 'precisionAc') return buildPrecisionAc(color);
  if (node.kind === 'ups') return buildUps(color);
  if (node.kind === 'light') {
    const point = new THREE.PointLight(color, node.intensity ?? 1.4, node.distance ?? 0);
    point.position.y = 1.5;
    point.castShadow = false;
    point.add(mesh(new THREE.SphereGeometry(0.18, 12, 8), '#fff7c2', [0, 0, 0]));
    return group(point);
  }
  if (node.kind === 'directionalLight') {
    const dir = new THREE.DirectionalLight(color, node.intensity ?? 1.2);
    dir.castShadow = node.castShadow ?? true;
    const bulb = mesh(new THREE.SphereGeometry(0.22, 14, 10), '#fff3c4', [0, 1.6, 0]);
    // 方向指示箭头：从发光体指向下前方
    const stem = cylinder(0.03, 0.03, 0.9, '#ffe08a', [0, 1.05, 0]);
    const cone = mesh(new THREE.ConeGeometry(0.14, 0.32, 12), '#ffe08a', [0, 0.5, 0]);
    return group(dir, bulb, stem, cone);
  }
  if (node.kind === 'ambientLight') {
    const ambient = new THREE.AmbientLight(color, node.intensity ?? 0.55);
    // 环境光没有位置，用线框八面体作为可选中代理体
    const helper = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.4, 0),
      new THREE.MeshBasicMaterial({ color: '#cfe8ff', wireframe: true }),
    );
    helper.position.y = 1.2;
    ambient.add(helper);
    return group(ambient);
  }
  if (node.kind === 'camera') return buildCameraRig(node, color);
  if (node.kind === 'text') return buildText3D(node);
  if (node.kind === 'label' || node.kind === 'popup')
    return group(
      box([2.4, 0.6, 0.06], node.kind === 'popup' ? '#1d4ed8' : '#0f766e', [0, 1.4, 0], true),
      textSprite(node.text ?? node.name),
    );
  if (node.kind === 'model')
    return group(mesh(new THREE.IcosahedronGeometry(0.95, 1), color, [0, 1, 0], true));
  return group(box([1.5, 1.5, 1.5], color, [0, 0.75, 0], true));
}

function buildBuilding(color: string) {
  const root = group(
    box([4.2, 0.3, 3], '#28384b', [0, 0.15, 0]),
    box([3.5, 6.2, 2.4], color, [0, 3.25, 0], true),
  );
  for (let floor = 0; floor < 6; floor++)
    for (const side of [-1, 1])
      for (let column = -1; column <= 1; column++)
        root.add(box([0.55, 0.52, 0.04], '#8ad5e6', [column * 0.9, 1 + floor * 0.9, side * 1.22]));
  root.add(
    box([1.1, 1.4, 0.08], '#173a58', [0, 0.75, 1.25]),
    box([3.8, 0.18, 2.7], '#c1d3d8', [0, 6.42, 0]),
  );
  return root;
}
function buildOffice(color: string) {
  const root = group(
    box([5.2, 0.25, 3.2], '#29384a', [0, 0.12, 0]),
    box([2.1, 5.3, 2.4], color, [-1.2, 2.8, 0], true),
    box([2.1, 3.9, 2.4], color, [1.2, 2.1, 0], true),
  );
  for (let y = 1; y < 5; y++) root.add(box([4.1, 0.08, 2.46], '#76b9cd', [0, y, 0]));
  root.add(
    box([2.4, 0.18, 1.2], '#d5e0e2', [0, 1.1, 1.75]),
    box([1.2, 1.5, 0.06], '#18344f', [0, 0.8, 1.23]),
  );
  return root;
}
function buildFactory(color: string) {
  const root = group(
    box([7, 2.5, 4], color, [0, 1.25, 0], true),
    box([1.2, 1.8, 0.08], '#25384a', [-2.2, 0.9, 2.04]),
    box([1.2, 1.8, 0.08], '#25384a', [0, 0.9, 2.04]),
    box([1.2, 1.8, 0.08], '#25384a', [2.2, 0.9, 2.04]),
  );
  for (let x = -2.5; x <= 2.5; x += 1.7) {
    const roof = box([1.8, 0.18, 4.2], '#a7b9bd', [x, 2.95, 0]);
    roof.rotation.z = x % 2 === 0 ? 0.35 : -0.35;
    root.add(roof);
  }
  root.add(
    cylinder(0.28, 0.35, 4.2, '#65777e', [2.5, 4.2, -1.2]),
    cylinder(0.24, 0.3, 3.5, '#7a888d', [1.6, 3.85, -1.2]),
  );
  return root;
}
function buildWarehouse(color: string) {
  const root = group(box([7, 2.7, 4.6], color, [0, 1.35, 0], true));
  const roof = box([7.3, 0.25, 5], '#9bacb5', [0, 3.05, 0]);
  roof.rotation.z = 0.05;
  root.add(roof);
  for (const x of [-2.3, 0, 2.3])
    root.add(
      box([1.35, 1.75, 0.08], '#243445', [x, 0.95, 2.34]),
      box([1.5, 0.15, 0.5], '#d5b44f', [x, 0.08, 2.7]),
    );
  return root;
}
function buildTank(color: string) {
  const root = group(
    cylinder(1.5, 1.5, 3.6, color, [0, 1.9, 0], true),
    cylinder(1.35, 1.5, 0.45, '#9cbec0', [0, 3.92, 0]),
  );
  root.add(
    mesh(new THREE.TorusGeometry(1.62, 0.055, 8, 32), '#e3c35c', [0, 3.7, 0]),
    box([0.12, 3.4, 0.12], '#d7b855', [1.6, 1.8, 0]),
  );
  root.children[2].rotation.x = Math.PI / 2;
  return root;
}
function buildCoolingTower(color: string) {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 12; i++) {
    const y = (i / 12) * 5;
    const radius = 1.15 + Math.pow(Math.abs(y - 2.8) / 3, 1.8) * 0.75;
    points.push(new THREE.Vector2(radius, y));
  }
  return group(
    mesh(new THREE.LatheGeometry(points, 32), color, [0, 0, 0], true),
    cylinder(1.55, 1.75, 0.35, '#67777d', [0, 0.18, 0]),
  );
}
function buildPipeline(color: string) {
  const pipe = cylinder(0.28, 0.28, 7, color, [0, 1.3, 0], true);
  pipe.rotation.z = Math.PI / 2;
  const root = group(pipe);
  for (const x of [-2.5, 0, 2.5])
    root.add(
      box([0.18, 1.2, 0.18], '#687783', [x, 0.6, 0]),
      box([0.75, 0.12, 0.6], '#52616e', [x, 0.08, 0]),
    );
  return root;
}
function buildRoad() {
  const root = group(box([9, 0.12, 3.2], '#303b48', [0, 0.06, 0]));
  for (let x = -3.5; x <= 3.5; x += 1.5)
    root.add(box([0.75, 0.025, 0.08], '#f0d45c', [x, 0.13, 0]));
  root.add(
    box([9, 0.15, 0.18], '#a6afb7', [0, 0.07, -1.65]),
    box([9, 0.15, 0.18], '#a6afb7', [0, 0.07, 1.65]),
  );
  return root;
}
function buildTree(color: string) {
  return group(
    cylinder(0.18, 0.25, 2, '#73513a', [0, 1, 0]),
    mesh(new THREE.ConeGeometry(1.15, 2.5, 12), color, [0, 2.8, 0], true),
    mesh(new THREE.ConeGeometry(0.9, 2, 12), '#54a573', [0, 3.8, 0]),
  );
}
function buildWindTurbine(color: string) {
  const root = group(
    cylinder(0.18, 0.38, 6.5, color, [0, 3.25, 0], true),
    box([0.8, 0.45, 0.45], '#c8d6da', [0, 6.55, 0]),
  );
  const hub = mesh(new THREE.SphereGeometry(0.28, 16, 12), '#e4ecee', [0, 6.55, 0.35]);
  root.add(hub);
  for (let i = 0; i < 3; i++) {
    const blade = box([0.18, 2.7, 0.08], color, [0, 7.9, 0.38], true);
    blade.geometry.translate(0, -1.35, 0);
    blade.position.set(0, 6.55, 0.38);
    blade.rotation.z = (i * Math.PI * 2) / 3;
    root.add(blade);
  }
  return root;
}
function buildSolarPanels(color: string) {
  const root = new THREE.Group();
  for (const x of [-1.7, 0, 1.7])
    for (const z of [-0.8, 0.8]) {
      const panel = box([1.45, 0.08, 1.1], color, [x, 0.85, z], true);
      panel.rotation.x = -0.35;
      root.add(panel, box([0.08, 0.7, 0.08], '#667784', [x, 0.35, z]));
    }
  return root;
}
function buildConveyor(color: string) {
  const root = group(
    box([6, 0.18, 1.5], '#566574', [0, 1.15, 0]),
    box([6, 0.12, 0.12], color, [0, 1.35, -0.72], true),
    box([6, 0.12, 0.12], color, [0, 1.35, 0.72], true),
  );
  for (let x = -2.6; x <= 2.6; x += 0.65) {
    const roller = cylinder(0.1, 0.1, 1.35, '#9cabb5', [x, 1.3, 0]);
    roller.rotation.x = Math.PI / 2;
    root.add(roller);
  }
  for (const x of [-2.5, 0, 2.5])
    root.add(
      box([0.15, 1.1, 0.15], '#5f6e7b', [x, 0.55, -0.55]),
      box([0.15, 1.1, 0.15], '#5f6e7b', [x, 0.55, 0.55]),
    );
  return root;
}
function buildCrane(color: string) {
  const root = group();
  for (const x of [-2.5, 2.5])
    root.add(
      box([0.3, 4.8, 0.3], color, [x, 2.4, -1.5], true),
      box([0.3, 4.8, 0.3], color, [x, 2.4, 1.5], true),
      box([0.7, 0.25, 3.5], '#455563', [x, 0.15, 0]),
    );
  root.add(
    box([5.5, 0.45, 0.45], color, [0, 4.7, -1.5], true),
    box([5.5, 0.45, 0.45], color, [0, 4.7, 1.5], true),
    box([0.5, 0.35, 3.2], '#394b5b', [0, 4.45, 0]),
    box([0.08, 2.2, 0.08], '#c3ced3', [0, 3.2, 0]),
    box([0.45, 0.45, 0.45], '#d86a4f', [0, 2.1, 0]),
  );
  return root;
}
function buildTruck(color: string) {
  const root = group(
    box([3.8, 1.45, 1.7], color, [-0.6, 1.05, 0], true),
    box([1.45, 1.7, 1.7], '#d6e0e3', [2, 0.95, 0]),
    box([1.2, 0.62, 1.5], '#31546b', [2.15, 1.45, 0]),
  );
  for (const x of [-1.6, 1.65])
    for (const z of [-0.9, 0.9]) {
      const wheel = cylinder(0.42, 0.42, 0.24, '#17202a', [x, 0.45, z]);
      wheel.rotation.x = Math.PI / 2;
      root.add(wheel);
    }
  return root;
}

function vehicleWheel(position: [number, number, number], radius = 0.36) {
  const wheel = cylinder(radius, radius, 0.22, '#17202a', position);
  wheel.rotation.x = Math.PI / 2;
  return wheel;
}

function buildCar(color: string) {
  const root = group(
    box([3.4, 0.55, 1.55], color, [0, 0.65, 0], true),
    box([1.75, 0.7, 1.38], color, [-0.2, 1.2, 0], true),
    box([1.25, 0.5, 1.42], '#7ec8df', [-0.2, 1.25, 0]),
    box([0.7, 0.12, 1.58], '#f8fafc', [1.42, 0.78, 0]),
  );
  for (const x of [-1.05, 1.05])
    for (const z of [-0.82, 0.82]) root.add(vehicleWheel([x, 0.42, z]));
  return root;
}

function buildBus(color: string) {
  const root = group(
    box([5.8, 1.85, 1.9], color, [0, 1.25, 0], true),
    box([5.45, 0.72, 1.94], '#70b8d2', [0, 1.68, 0]),
    box([0.75, 1.5, 0.08], '#17364b', [2.35, 1.05, 0.97]),
    box([5.9, 0.14, 2], '#e2e8f0', [0, 2.24, 0]),
  );
  for (const x of [-1.9, 1.9])
    for (const z of [-1.02, 1.02]) root.add(vehicleWheel([x, 0.42, z], 0.43));
  return root;
}

function buildForklift(color: string) {
  const root = group(
    box([2.3, 0.7, 1.35], color, [-0.45, 0.7, 0], true),
    box([0.85, 1.2, 1.2], color, [-0.8, 1.45, 0], true),
    box([0.12, 2.5, 0.12], '#334155', [0.85, 1.45, -0.52]),
    box([0.12, 2.5, 0.12], '#334155', [0.85, 1.45, 0.52]),
    box([2.1, 0.1, 0.16], '#64748b', [1.82, 0.18, -0.38]),
    box([2.1, 0.1, 0.16], '#64748b', [1.82, 0.18, 0.38]),
  );
  for (const x of [-0.95, 0.62])
    for (const z of [-0.72, 0.72]) root.add(vehicleWheel([x, 0.4, z], x < 0 ? 0.42 : 0.31));
  return root;
}

function buildTrafficLight(color: string) {
  const root = group(
    cylinder(0.1, 0.16, 3.8, color, [0, 1.9, 0], true),
    cylinder(0.42, 0.52, 0.16, '#475569', [0, 0.08, 0]),
    box([0.72, 1.85, 0.48], color, [0, 3.45, 0], true),
  );
  ['#ef4444', '#facc15', '#22c55e'].forEach((signalColor, index) =>
    root.add(
      mesh(new THREE.SphereGeometry(0.2, 16, 10), signalColor, [0, 3.95 - index * 0.52, 0.28]),
    ),
  );
  return root;
}

function buildParkingGate(color: string) {
  const root = group(
    box([0.7, 1.5, 0.72], color, [-2.05, 0.75, 0], true),
    box([4.5, 0.16, 0.18], '#f8fafc', [0.52, 1.38, 0]),
    cylinder(0.16, 0.16, 0.3, '#334155', [-1.72, 1.38, 0]),
  );
  for (const x of [-1, 0, 1, 2]) root.add(box([0.36, 0.18, 0.2], '#ef4444', [x, 1.38, 0]));
  return root;
}

function buildStreetLight(color: string) {
  return group(
    cylinder(0.1, 0.17, 4.8, color, [0, 2.4, 0], true),
    cylinder(0.38, 0.5, 0.14, '#475569', [0, 0.07, 0]),
    box([1.5, 0.1, 0.12], color, [0.7, 4.75, 0], true),
    box([0.62, 0.16, 0.42], '#fde68a', [1.4, 4.64, 0]),
  );
}

function buildFence(color: string) {
  const root = group(
    box([6, 0.11, 0.12], color, [0, 0.55, 0], true),
    box([6, 0.11, 0.12], color, [0, 1.45, 0], true),
  );
  for (let x = -3; x <= 3; x += 0.6) root.add(box([0.09, 1.7, 0.1], color, [x, 0.85, 0], true));
  root.add(box([6.2, 0.12, 0.55], '#475569', [0, 0.06, 0]));
  return root;
}

function buildSecurityBooth(color: string) {
  return group(
    box([2.35, 2.35, 2], color, [0, 1.2, 0], true),
    box([2.7, 0.18, 2.35], '#334155', [0, 2.48, 0]),
    box([1.2, 0.9, 0.07], '#7dd3fc', [-0.45, 1.55, 1.03]),
    box([0.65, 1.8, 0.08], '#1e293b', [0.72, 0.9, 1.04]),
    box([2.5, 0.16, 2.15], '#64748b', [0, 0.08, 0]),
  );
}

function buildFireHydrant(color: string) {
  const root = group(
    cylinder(0.32, 0.42, 1.25, color, [0, 0.68, 0], true),
    cylinder(0.38, 0.38, 0.12, '#fca5a5', [0, 1.35, 0]),
    mesh(new THREE.SphereGeometry(0.32, 16, 10), color, [0, 1.48, 0], true),
    cylinder(0.52, 0.58, 0.16, '#475569', [0, 0.08, 0]),
  );
  for (const x of [-0.42, 0.42]) {
    const nozzle = cylinder(0.16, 0.22, 0.32, '#fca5a5', [x, 0.9, 0]);
    nozzle.rotation.z = Math.PI / 2;
    root.add(nozzle);
  }
  return root;
}

function buildChargingPile(color: string) {
  const root = group(
    box([1, 1.7, 0.58], color, [0, 0.92, 0], true),
    box([0.66, 0.42, 0.05], '#0f172a', [0, 1.3, 0.315]),
    box([0.2, 0.28, 0.08], '#22c55e', [0, 0.72, 0.34]),
    box([1.25, 0.12, 0.82], '#475569', [0, 0.06, 0]),
  );
  const cable = mesh(
    new THREE.TorusGeometry(0.42, 0.045, 8, 24, Math.PI * 1.45),
    '#17202a',
    [0.58, 0.72, 0],
  );
  cable.rotation.y = Math.PI / 2;
  root.add(cable);
  return root;
}

function buildPump(color: string) {
  const motor = cylinder(0.62, 0.62, 1.75, color, [-0.65, 0.82, 0], true);
  motor.rotation.z = Math.PI / 2;
  const root = group(
    box([3.5, 0.18, 1.45], '#475569', [0, 0.09, 0]),
    motor,
    cylinder(0.68, 0.82, 1.05, color, [0.85, 0.72, 0], true),
    cylinder(0.25, 0.25, 1.15, '#94a3b8', [0.85, 1.72, 0]),
  );
  root.add(mesh(new THREE.TorusGeometry(0.72, 0.08, 10, 28), '#cbd5e1', [0.85, 0.76, 0.56]));
  return root;
}

function buildValve(color: string) {
  const pipe = cylinder(0.28, 0.28, 3.5, '#64748b', [0, 0.55, 0]);
  pipe.rotation.z = Math.PI / 2;
  const wheel = mesh(new THREE.TorusGeometry(0.68, 0.08, 10, 28), color, [0, 1.7, 0], true);
  return group(
    pipe,
    cylinder(0.65, 0.65, 0.72, color, [0, 0.55, 0], true),
    cylinder(0.09, 0.09, 0.95, '#94a3b8', [0, 1.15, 0]),
    wheel,
    box([1.15, 0.08, 0.08], color, [0, 1.7, 0], true),
  );
}

function buildTransformer(color: string) {
  const root = group(
    box([3.6, 2.35, 2.55], color, [0, 1.25, 0], true),
    box([3.9, 0.16, 2.8], '#334155', [0, 2.52, 0]),
    box([3.9, 0.14, 2.8], '#475569', [0, 0.07, 0]),
    box([0.9, 1.35, 0.06], '#1e293b', [1.05, 1.12, 1.3]),
    box([0.9, 1.35, 0.06], '#1e293b', [-1.05, 1.12, 1.3]),
  );
  for (const x of [-1.2, 0, 1.2]) root.add(cylinder(0.12, 0.18, 0.65, '#92400e', [x, 2.88, 0]));
  for (const x of [-1.45, -1.15, -0.85, 0.85, 1.15, 1.45])
    root.add(box([0.08, 1.65, 2.7], '#94a3b8', [x, 1.25, 0]));
  return root;
}

function buildElectricalCabinet(color: string) {
  const root = group(
    box([1.8, 2.5, 0.9], color, [0, 1.3, 0], true),
    box([1.55, 2.18, 0.06], '#334155', [0, 1.32, 0.48]),
    box([0.72, 0.38, 0.05], '#0f172a', [0, 1.85, 0.52]),
    box([0.08, 0.36, 0.08], '#cbd5e1', [0.62, 1.2, 0.54]),
    box([2.05, 0.14, 1.12], '#475569', [0, 0.07, 0]),
  );
  ['#22c55e', '#facc15', '#ef4444'].forEach((indicator, index) =>
    root.add(
      mesh(new THREE.SphereGeometry(0.07, 10, 8), indicator, [-0.24 + index * 0.24, 1.46, 0.54]),
    ),
  );
  return root;
}

function buildSensor(color: string) {
  const root = group(
    cylinder(0.08, 0.12, 2.4, '#647784', [0, 1.2, 0]),
    mesh(new THREE.SphereGeometry(0.28, 16, 12), color, [0, 2.5, 0], true),
    cylinder(0.38, 0.5, 0.18, '#344555', [0, 0.09, 0]),
  );
  const ring = mesh(new THREE.TorusGeometry(0.5, 0.035, 8, 24), color, [0, 2.5, 0], true);
  ring.rotation.x = Math.PI / 2;
  root.add(ring);
  return root;
}

function beamBetween(
  start: [number, number, number],
  end: [number, number, number],
  radius: number,
  color: string,
  tintable = false,
) {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const item = cylinder(radius, radius, direction.length(), color, [0, 0, 0], tintable, 12);
  item.position.copy(from.add(to).multiplyScalar(0.5));
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return item;
}

function buildCctv(color: string) {
  const body = cylinder(0.32, 0.38, 1.15, color, [0.35, 2.75, 0], true);
  body.rotation.z = Math.PI / 2;
  const lens = cylinder(0.19, 0.25, 0.14, '#0f172a', [0.96, 2.75, 0]);
  lens.rotation.z = Math.PI / 2;
  const hood = box([0.72, 0.12, 0.74], '#64748b', [0.4, 3.12, 0]);
  hood.rotation.z = -0.12;
  return group(
    cylinder(0.09, 0.16, 2.45, '#64748b', [0, 1.22, 0]),
    cylinder(0.42, 0.5, 0.16, '#334155', [0, 0.08, 0]),
    cylinder(0.28, 0.34, 0.24, '#334155', [0, 2.48, 0]),
    body,
    lens,
    mesh(new THREE.SphereGeometry(0.11, 14, 10), '#38bdf8', [1.05, 2.75, 0]),
    hood,
  );
}

function buildAccessControl(color: string) {
  const root = group(
    box([0.55, 1.05, 1.75], color, [-1.15, 0.55, 0], true),
    box([0.55, 1.05, 1.75], color, [1.15, 0.55, 0], true),
    box([0.32, 0.28, 0.16], '#22c55e', [-1.15, 1.05, 0.72]),
    box([0.32, 0.28, 0.16], '#22c55e', [1.15, 1.05, 0.72]),
  );
  for (const side of [-1, 1]) {
    root.add(cylinder(0.08, 0.08, 1.45, '#cbd5e1', [side * 0.34, 0.86, 0]));
    for (let arm = 0; arm < 3; arm++) {
      const gateArm = box([0.85, 0.07, 0.1], '#dbe7ec', [side * 0.34, 1.3, 0]);
      gateArm.geometry.translate(side * 0.42, 0, 0);
      gateArm.rotation.y = (arm * Math.PI * 2) / 3;
      root.add(gateArm);
    }
  }
  return root;
}

function buildRobotArm(color: string) {
  const root = group(
    cylinder(0.85, 1.02, 0.35, '#334155', [0, 0.18, 0]),
    cylinder(0.62, 0.72, 0.7, color, [0, 0.7, 0], true),
    mesh(new THREE.SphereGeometry(0.48, 20, 14), '#1e293b', [0, 1.2, 0]),
  );
  root.add(
    beamBetween([0, 1.2, 0], [0.35, 3.05, 0], 0.31, color, true),
    mesh(new THREE.SphereGeometry(0.42, 20, 14), '#1e293b', [0.35, 3.05, 0]),
    beamBetween([0.35, 3.05, 0], [1.65, 4.1, 0], 0.25, color, true),
    mesh(new THREE.SphereGeometry(0.32, 20, 14), '#334155', [1.65, 4.1, 0]),
    beamBetween([1.65, 4.1, 0], [2.25, 3.72, 0], 0.18, color, true),
    cylinder(0.22, 0.22, 0.5, '#475569', [2.25, 3.45, 0]),
  );
  const gripperA = box([0.12, 0.72, 0.15], '#cbd5e1', [2.05, 3.08, 0]);
  const gripperB = box([0.12, 0.72, 0.15], '#cbd5e1', [2.45, 3.08, 0]);
  gripperA.rotation.z = -0.2;
  gripperB.rotation.z = 0.2;
  root.add(gripperA, gripperB);
  return root;
}

function buildMachineTool(color: string) {
  const root = group(
    box([4.2, 0.28, 2.55], '#334155', [0, 0.14, 0]),
    box([4, 2.75, 2.35], color, [0, 1.58, 0], true),
    box([2.1, 1.65, 0.08], '#102a43', [-0.55, 1.65, 1.22]),
    box([0.16, 1.65, 0.1], '#94a3b8', [0.45, 1.65, 1.27]),
    box([0.72, 1.5, 0.18], '#1e293b', [1.5, 1.72, 1.25]),
    box([0.5, 0.42, 0.08], '#0ea5e9', [1.5, 2.1, 1.36]),
  );
  ['#22c55e', '#facc15', '#ef4444'].forEach((indicator, index) =>
    root.add(
      mesh(new THREE.SphereGeometry(0.07, 10, 8), indicator, [1.32 + index * 0.18, 1.62, 1.36]),
    ),
  );
  root.add(cylinder(0.08, 0.1, 0.65, '#64748b', [1.72, 3.25, 0]));
  root.add(mesh(new THREE.SphereGeometry(0.14, 12, 8), '#22c55e', [1.72, 3.62, 0]));
  return root;
}

function buildDisplayStand(color: string) {
  const root = group(
    cylinder(1.7, 1.9, 0.32, '#273449', [0, 0.16, 0]),
    cylinder(1.42, 1.55, 0.36, color, [0, 0.5, 0], true, 48),
    cylinder(1.22, 1.22, 0.1, '#dff7ff', [0, 0.75, 0], false, 48),
  );
  const lightRing = mesh(new THREE.TorusGeometry(1.48, 0.055, 12, 48), '#22d3ee', [0, 0.72, 0]);
  lightRing.rotation.x = Math.PI / 2;
  root.add(lightRing);
  return root;
}

function buildLedScreen(color: string) {
  const screenMaterial = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.55,
    roughness: 0.25,
    metalness: 0.1,
  });
  screenMaterial.userData.tintable = true;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.8, 0.12), screenMaterial);
  panel.position.set(0, 2.55, 0);
  panel.userData.tintable = true;
  const root = group(
    box([5.65, 3.25, 0.3], '#111827', [0, 2.55, -0.12]),
    panel,
    box([0.18, 2, 0.18], '#64748b', [-1.6, 1, -0.2]),
    box([0.18, 2, 0.18], '#64748b', [1.6, 1, -0.2]),
    box([4.4, 0.16, 1], '#334155', [0, 0.08, -0.2]),
  );
  for (let x = -2; x <= 2; x += 0.8)
    root.add(box([0.38, 0.06, 0.04], '#e0f2fe', [x, 2.55 + Math.sin(x * 2) * 0.48, 0.08]));
  return root;
}

function buildStorageRack(color: string) {
  const root = group();
  for (const x of [-2.45, 2.45])
    for (const z of [-0.72, 0.72]) root.add(box([0.16, 4.4, 0.16], color, [x, 2.2, z], true));
  for (const y of [0.55, 1.75, 2.95, 4.15]) {
    root.add(
      box([5.1, 0.16, 1.65], color, [0, y, 0], true),
      box([4.7, 0.08, 1.42], '#64748b', [0, y + 0.12, 0]),
    );
    if (y < 4)
      for (const x of [-1.55, 0, 1.55])
        root.add(box([1.2, 0.72, 1.08], x === 0 ? '#60a5fa' : '#c08457', [x, y + 0.52, 0]));
  }
  return root;
}

function buildPallet(color: string) {
  const root = group();
  for (const z of [-0.75, -0.25, 0.25, 0.75])
    root.add(box([2.5, 0.12, 0.32], color, [0, 0.24, z], true));
  for (const x of [-0.95, 0, 0.95]) root.add(box([0.26, 0.28, 1.9], '#8b5e34', [x, 0.1, 0]));
  root.add(
    box([1.05, 0.9, 0.85], '#d7a86e', [-0.55, 0.77, -0.38]),
    box([1.05, 0.9, 0.85], '#c98c52', [0.55, 0.77, -0.38]),
    box([1.05, 0.9, 0.85], '#d7a86e', [-0.55, 0.77, 0.5]),
    box([1.05, 0.9, 0.85], '#c98c52', [0.55, 0.77, 0.5]),
  );
  return root;
}

function buildAgv(color: string) {
  const root = group(
    cylinder(1.15, 1.15, 0.42, color, [0, 0.38, 0], true, 32),
    cylinder(0.92, 0.92, 0.1, '#1e293b', [0, 0.64, 0], false, 32),
    box([1.45, 0.12, 1.05], '#cbd5e1', [0, 0.75, 0]),
    cylinder(0.08, 0.08, 0.48, '#94a3b8', [0, 1.03, 0]),
    mesh(new THREE.SphereGeometry(0.16, 12, 8), '#22d3ee', [0, 1.33, 0]),
  );
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    root.add(
      mesh(new THREE.SphereGeometry(0.055, 8, 6), '#22c55e', [
        Math.cos(angle),
        0.42,
        Math.sin(angle),
      ]),
    );
  }
  return root;
}

function buildBridge(color: string) {
  const root = group(
    box([12, 0.45, 3.2], color, [0, 2.15, 0], true),
    box([12, 0.12, 0.18], '#dbe7ec', [0, 2.42, -1.45]),
    box([12, 0.12, 0.18], '#dbe7ec', [0, 2.42, 1.45]),
  );
  for (const x of [-4.5, 4.5]) {
    root.add(
      box([0.42, 5.8, 0.42], '#cbd5e1', [x, 3.3, -1.35]),
      box([0.42, 5.8, 0.42], '#cbd5e1', [x, 3.3, 1.35]),
      box([0.48, 0.34, 3.1], '#cbd5e1', [x, 5.95, 0]),
      box([1.2, 2, 2.6], '#475569', [x, 1, 0]),
    );
    for (const offset of [-3.2, -2, -0.9, 0.9, 2, 3.2]) {
      const deckX = x + Math.sign(offset) * Math.min(Math.abs(offset), 3.2);
      root.add(
        beamBetween([x, 5.7, -1.35], [deckX, 2.45, -1.35], 0.035, '#e2e8f0'),
        beamBetween([x, 5.7, 1.35], [deckX, 2.45, 1.35], 0.035, '#e2e8f0'),
      );
    }
  }
  for (let x = -5; x <= 5; x += 1.5) root.add(box([0.75, 0.025, 0.07], '#facc15', [x, 2.39, 0]));
  return root;
}

function buildTransmissionTower(color: string) {
  const root = group(
    box([0.2, 0.2, 0.2], color, [0, 6, 0], true),
    beamBetween([-1.35, 0, -1.35], [0, 6, 0], 0.09, color, true),
    beamBetween([1.35, 0, -1.35], [0, 6, 0], 0.09, color, true),
    beamBetween([-1.35, 0, 1.35], [0, 6, 0], 0.09, color, true),
    beamBetween([1.35, 0, 1.35], [0, 6, 0], 0.09, color, true),
  );
  for (const y of [1.5, 3, 4.5]) {
    const width = 1.35 - y * 0.13;
    root.add(
      beamBetween([-width, y, -width], [width, y, width], 0.055, color, true),
      beamBetween([width, y, -width], [-width, y, width], 0.055, color, true),
      box([width * 2.5, 0.1, 0.1], color, [0, y + 0.25, 0], true),
    );
  }
  for (const y of [4.3, 5.2]) {
    const width = y === 4.3 ? 2.2 : 1.65;
    root.add(box([width * 2, 0.12, 0.12], color, [0, y, 0], true));
    for (const x of [-width, width]) {
      root.add(cylinder(0.06, 0.08, 0.45, '#8b5cf6', [x, y - 0.27, 0]));
    }
  }
  return root;
}

function buildServerRack(color: string) {
  const root = group(
    box([1.6, 3.8, 1.45], color, [0, 1.9, 0], true),
    box([1.42, 3.5, 0.08], '#0f172a', [0, 1.9, 0.765]),
    box([1.78, 0.12, 1.62], '#64748b', [0, 0.06, 0]),
  );
  for (let row = 0; row < 10; row++) {
    const y = 0.45 + row * 0.3;
    root.add(box([1.22, 0.2, 0.06], row % 3 === 0 ? '#243b53' : '#334155', [0, y, 0.82]));
    for (let light = 0; light < 3; light++)
      root.add(
        mesh(
          new THREE.SphereGeometry(0.035, 8, 6),
          (row + light) % 5 === 0 ? '#fbbf24' : '#22c55e',
          [0.37 + light * 0.16, y, 0.87],
        ),
      );
  }
  root.add(box([0.12, 0.46, 0.08], '#94a3b8', [0.61, 2.05, 0.87]));
  return root;
}

function buildPrecisionAc(color: string) {
  const root = group(
    box([1.8, 3.5, 1.35], color, [0, 1.75, 0], true),
    box([1.5, 0.5, 0.08], '#0f172a', [0, 2.65, 0.72]),
    box([0.72, 0.3, 0.05], '#38bdf8', [0, 2.66, 0.78]),
    box([2, 0.12, 1.55], '#64748b', [0, 0.06, 0]),
  );
  for (let row = 0; row < 7; row++)
    root.add(box([1.42, 0.05, 0.08], '#64748b', [0, 0.55 + row * 0.22, 0.72]));
  for (const x of [-0.48, 0.48]) {
    const fan = mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 24), '#475569', [x, 3.15, 0]);
    fan.rotation.x = Math.PI / 2;
    root.add(fan);
  }
  return root;
}

function buildUps(color: string) {
  const root = group(
    box([2.05, 3.25, 1.25], color, [0, 1.62, 0], true),
    box([1.75, 2.9, 0.08], '#1e293b', [0, 1.62, 0.67]),
    box([0.9, 0.48, 0.06], '#0f172a', [0, 2.45, 0.73]),
    box([0.58, 0.24, 0.05], '#22d3ee', [-0.22, 2.45, 0.78]),
    box([2.25, 0.12, 1.45], '#64748b', [0, 0.06, 0]),
  );
  for (let row = 0; row < 6; row++)
    for (const x of [-0.52, 0, 0.52])
      root.add(box([0.34, 0.22, 0.05], '#334155', [x, 0.55 + row * 0.28, 0.74]));
  root.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), '#22c55e', [0.7, 2.45, 0.78]));
  return root;
}

/** 观察相机组件：机身 + 镜头 + 青色视锥线框，提示其观察方向与范围。 */
function buildCameraRig(node: SceneNode, color: string) {
  const root = group(
    box([0.7, 0.45, 0.45], color, [0, 0.6, 0], true),
    cylinder(0.2, 0.3, 0.4, '#253143', [0, 0.6, -0.38]),
  );
  const near = 0.4;
  const far = 2.4;
  const nw = 0.42;
  const nh = 0.3;
  const n = [
    [-nw, -nh],
    [nw, -nh],
    [nw, nh],
    [-nw, nh],
  ].map(([x, y]) => [x, 0.6 + y, -near] as [number, number, number]);
  const f = [
    [-nw * 3, -nh * 3],
    [nw * 3, -nh * 3],
    [nw * 3, nh * 3],
    [-nw * 3, nh * 3],
  ].map(([x, y]) => [x, 0.6 + y, -far] as [number, number, number]);
  const points: number[] = [];
  for (let i = 0; i < 4; i++) {
    points.push(...n[i], ...n[(i + 1) % 4]);
    points.push(...f[i], ...f[(i + 1) % 4]);
    points.push(...n[i], ...f[i]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const frustum = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: '#7ce5c1', transparent: true, opacity: 0.55 }),
  );
  frustum.userData.frustumHelper = true;
  root.add(frustum);
  return root;
}

function normalizeRatio(node: SceneNode, value: number) {
  const min = node.min ?? 0;
  const max = node.max ?? 100;
  return Math.min(1, Math.max(0, (value - min) / Math.max(1e-6, max - min)));
}

/** 三维柱状图：series 多序列时多柱，否则单柱随 value 变化。 */
function buildBar(node: SceneNode) {
  const root = group(box([3.2, 0.08, 1.2], '#263242', [0, 0.04, 0]));
  const values = node.series?.length ? node.series : [node.value ?? 60];
  const slot = 2.8 / values.length;
  values.forEach((value, i) => {
    const height = 0.16 + normalizeRatio(node, value) * 1.84;
    const x = -1.4 + slot * (i + 0.5);
    const column = mesh(
      new THREE.BoxGeometry(Math.min(0.7, slot * 0.6), height, 0.6),
      node.color ?? '#34d399',
      [x, height / 2 + 0.08, 0],
      true,
    );
    column.userData.metricValue = value;
    root.add(column);
  });
  return root;
}

/** 三维折线图：series 沿 X 轴展开，细管连接，节点用小球标注。 */
function buildLineChart(node: SceneNode) {
  const series = node.series?.length ? node.series : [20, 40, 35, 60, 55, 75];
  const root = group(box([3.2, 0.06, 1.4], '#263242', [0, 0.03, 0]));
  const min = node.min ?? Math.min(...series);
  const max = node.max ?? Math.max(...series);
  const span = Math.max(1e-6, max - min);
  const points = series.map(
    (value, i) =>
      new THREE.Vector3(
        -1.4 + (series.length === 1 ? 0 : (2.8 * i) / (series.length - 1)),
        0.18 + ((value - min) / span) * 1.5,
        0,
      ),
  );
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    root.add(
      beamBetween(
        [a.x, a.y, a.z],
        [b.x, b.y, b.z],
        0.045,
        node.color ?? '#38d6b2',
        true,
      ),
    );
  }
  points.forEach((p) => root.add(mesh(new THREE.SphereGeometry(0.09, 12, 8), '#e6fffa', [p.x, p.y, p.z])));
  return root;
}

/** 三维仪表盘：270° 环形刻度 + 值弧 + 指针。 */
function buildGauge(node: SceneNode) {
  const root = group();
  const ratio = normalizeRatio(node, node.value ?? 60);
  const start = -Math.PI / 4;
  const sweep = Math.PI * 1.5;
  const background = mesh(new THREE.TorusGeometry(1, 0.09, 10, 48, sweep), '#334457', [0, 1.1, 0]);
  background.rotation.z = start;
  const valueArc = mesh(
    new THREE.TorusGeometry(1, 0.09, 10, 48, Math.max(0.001, sweep * ratio)),
    node.color ?? '#38d6b2',
    [0, 1.1, 0.02],
    true,
  );
  valueArc.rotation.z = start;
  const needle = box([0.85, 0.05, 0.05], '#e2e8f0', [0.4, 1.1, 0.05]);
  needle.geometry.translate(0.4, 0, 0);
  needle.position.set(0, 1.1, 0.05);
  needle.rotation.z = start + sweep * ratio;
  root.add(background, valueArc, needle, mesh(new THREE.SphereGeometry(0.12, 14, 10), '#1e293b', [0, 1.1, 0.06]));
  const label = textSprite(String(node.value ?? ''));
  label.position.set(0, 0.15, 0.05);
  label.scale.set(1.1, 0.28, 1);
  root.add(label);
  return root;
}
