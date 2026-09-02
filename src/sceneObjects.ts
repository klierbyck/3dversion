import * as THREE from 'three';
import type { SceneNode } from './types';

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
  if (node.kind === 'sphere')
    return group(mesh(new THREE.SphereGeometry(0.8, 28, 18), color, [0, 0.8, 0], true));
  if (node.kind === 'plane') {
    const item = mesh(new THREE.PlaneGeometry(3, 3), color, [0, 0.01, 0], true);
    item.rotation.x = -Math.PI / 2;
    return group(item);
  }
  if (node.kind === 'image') return group(box([2.4, 1.6, 0.04], '#173d3a', [0, 0.8, 0], false));
  if (node.kind === 'bar') return group(box([0.8, 2, 0.8], color, [0, 1, 0], true));
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
  if (node.kind === 'sensor') return buildSensor(color);
  if (node.kind === 'light') {
    const light = new THREE.PointLight(color, 3, 16);
    light.position.y = 1.5;
    light.add(mesh(new THREE.SphereGeometry(0.18, 12, 8), '#fff7c2', [0, 0, 0]));
    return group(light);
  }
  if (node.kind === 'camera')
    return group(
      box([0.7, 0.45, 0.45], color, [0, 0.6, 0], true),
      cylinder(0.2, 0.3, 0.4, '#253143', [0, 0.6, -0.38]),
    );
  if (node.kind === 'text' || node.kind === 'label' || node.kind === 'popup')
    return group(
      box([2.4, 0.6, 0.06], node.kind === 'popup' ? '#1d4ed8' : '#0f766e', [0, 1.4, 0], true),
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
