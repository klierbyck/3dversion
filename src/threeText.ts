import * as THREE from 'three';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import type { SceneNode } from './types';

const FONT_URL = '/fonts/noto-sans-sc-subset.typeface.json';

let fontCache: Font | null = null;
let fontPromise: Promise<Font | null> | null = null;

/** 单例加载子集中文字体；失败返回 null，由调用方回退贴图。 */
export function loadTextFont(): Promise<Font | null> {
  if (fontCache) return Promise.resolve(fontCache);
  if (!fontPromise) {
    fontPromise = new FontLoader()
      .loadAsync(FONT_URL)
      .then((font) => {
        fontCache = font;
        return font;
      })
      .catch(() => null);
  }
  return fontPromise;
}

/** 判断字体是否覆盖全部字符（生僻字回退贴图用）。 */
function fontCovers(font: Font, text: string): boolean {
  const glyphs = (font.data as unknown as { glyphs: Record<string, unknown> }).glyphs;
  return [...text].every((ch) => ch === ' ' || ch === '\n' || Boolean(glyphs[ch]));
}

export function createTextTexture(text: string, color = '#f8fafc') {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  if (!context) return new THREE.CanvasTexture(canvas);
  const content = text.trim();
  let fontSize = 72;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  do {
    context.font = `600 ${fontSize}px sans-serif`;
    fontSize -= 4;
  } while (fontSize > 30 && context.measureText(content).width > canvas.width - 52);
  context.fillStyle = color;
  context.fillText(content, canvas.width / 2, canvas.height / 2, canvas.width - 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** label/popup 使用的标牌贴图（位置在底板上方）。 */
export function textSprite(text: string) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createTextTexture(text),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.position.set(0, 1.4, 0.05);
  sprite.scale.set(3.2, 0.8, 1);
  sprite.renderOrder = 10;
  sprite.userData.dynamicText = true;
  sprite.userData.text = text;
  return sprite;
}

/** 3D 文字组件的贴图兜底：居中、无底板。 */
function centeredSprite(text: string, width: number) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createTextTexture(text),
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  sprite.scale.set(width, width / 4, 1);
  sprite.renderOrder = 10;
  sprite.userData.dynamicText = true;
  sprite.userData.text = text;
  return sprite;
}

function clearChildren(object: THREE.Object3D) {
  [...object.children].forEach((child) => {
    object.remove(child);
    child.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.geometry.dispose();
        const mats = Array.isArray(c.material) ? c.material : [c.material];
        mats.forEach((m) => m.dispose());
      }
      if (c instanceof THREE.Sprite) {
        c.material.map?.dispose();
        c.material.dispose();
      }
    });
  });
}

function textGeometrySignature(node: SceneNode) {
  return JSON.stringify([
    node.text ?? node.name,
    node.name,
    node.fontSize ?? 0.6,
    node.extrudeDepth ?? 0.12,
    node.billboard === true,
  ]);
}

function makeExtrudedText(font: Font, node: SceneNode) {
  const content = (node.text ?? node.name).trim() || node.name;
  const size = node.fontSize ?? 0.6;
  const depth = node.extrudeDepth ?? 0.12;
  const geometry = new TextGeometry(content, {
    font,
    size,
    depth,
    curveSegments: 4,
    bevelEnabled: true,
    bevelThickness: Math.max(0.005, size * 0.03),
    bevelSize: Math.max(0.004, size * 0.02),
    bevelSegments: 1,
  });
  geometry.center();
  const color = node.color ?? '#9af0d2';
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.06,
    emissive: new THREE.Color(color).multiplyScalar(0.12),
  });
  material.userData.tintable = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.tintable = true;
  return mesh;
}

function renderText3D(root: THREE.Group, node: SceneNode, font: Font | null) {
  clearChildren(root);
  const content = (node.text ?? node.name).trim() || node.name;
  if (node.billboard !== true && font && fontCovers(font, content)) {
    root.add(makeExtrudedText(font, node));
    root.userData.textMode = 'geometry';
  } else {
    const width = Math.max(1.2, (node.fontSize ?? 0.6) * 4.2);
    root.add(centeredSprite(content, width));
    root.userData.textMode = 'sprite';
  }
}

/** 构建立体 3D 文字；字体异步加载完成后自动替换占位贴图。 */
export function buildText3D(node: SceneNode): THREE.Group {
  const root = new THREE.Group();
  root.userData.text3d = true;
  root.userData.latestTextNode = node;
  root.userData.rebuildText = (next: SceneNode) => {
    root.userData.latestTextNode = next;
    const signature = textGeometrySignature(next);
    if (root.userData.textGeometrySignature === signature) return;
    if (fontCache) renderText3D(root, next, fontCache);
    else renderText3D(root, next, null);
    root.userData.textGeometrySignature = signature;
  };
  renderText3D(root, node, fontCache);
  root.userData.textGeometrySignature = textGeometrySignature(node);
  if (!fontCache && node.billboard !== true) {
    void loadTextFont().then((font) => {
      if (font && root.parent !== null) {
        const latest = root.userData.latestTextNode as SceneNode;
        renderText3D(root, latest, font);
        root.userData.textGeometrySignature = textGeometrySignature(latest);
      }
    });
  }
  return root;
}

/** 统一的文字更新：3D 文字重建几何，标牌只换贴图。 */
export function updateObjectText(object: THREE.Object3D, node: SceneNode) {
  if (object.userData.text3d) {
    object.userData.rebuildText?.(node);
    return;
  }
  object.traverse((child) => {
    if (!(child instanceof THREE.Sprite) || !child.userData.dynamicText) return;
    if (child.userData.text === node.text) return;
    child.userData.text = node.text;
    child.material.map?.dispose();
    child.material.map = createTextTexture(node.text ?? '');
    child.material.needsUpdate = true;
  });
}
