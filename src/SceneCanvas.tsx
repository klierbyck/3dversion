import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { NodeKind, SceneCameraKeyframe, SceneNode, TransformMode } from './types';
import { buildObject, disposeObject, updateObjectText } from './sceneObjects';
import { effectiveVisualNode, visualSignature } from './lib/runtimeVisuals';

type TransformPatch = Pick<SceneNode, 'position' | 'rotation' | 'scale'>;
export type CameraFocusRequest = { nodeId: string; nonce: number };
/** 视图预设：透视 + 六个正交标准视图。 */
export type ViewPreset =
  | 'perspective'
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom';
export type CoordinateSpace = 'world' | 'local';

type RuntimeOverride = Partial<
  Pick<SceneNode, 'color' | 'visible' | 'opacity' | 'value' | 'text'> & { playing: boolean }
>;

type Props = {
  nodes: SceneNode[];
  selectedId: string | null;
  /** 加选（Ctrl/Shift 点击或框选）命中的其它节点。 */
  multiSelectedIds?: string[];
  mode?: TransformMode;
  gridVisible?: boolean;
  axesVisible?: boolean;
  readOnly?: boolean;
  viewPreset?: ViewPreset;
  coordinateSpace?: CoordinateSpace;
  runtimeOverrides?: Record<string, RuntimeOverride>;
  focusRequest?: CameraFocusRequest | null;
  cameraView?: SceneCameraKeyframe | null;
  onSelect: (id: string | null, additive?: boolean) => void;
  /** 框选结束，返回框内节点 id。 */
  onBoxSelect?: (ids: string[], additive: boolean) => void;
  onNodeClick?: (id: string) => void;
  onNodeDoubleClick?: (id: string) => void;
  onNodeHover?: (id: string | null) => void;
  onPointerWorldPosition?: (position: [number, number, number]) => void;
  onDropKind?: (kind: NodeKind, position: [number, number, number]) => void;
  onTransform?: (id: string, patch: TransformPatch, finished: boolean) => void;
  onTransformStart?: () => void;
  onRuntimeError: (message: string) => void;
};

const VIEW_PRESETS: Record<ViewPreset, { pos: [number, number, number]; up: [number, number, number] }> = {
  perspective: { pos: [14, 11, 17], up: [0, 1, 0] },
  top: { pos: [0, 20, 0.001], up: [0, 0, -1] },
  bottom: { pos: [0, -20, 0.001], up: [0, 0, 1] },
  front: { pos: [0, 0, 20], up: [0, 1, 0] },
  back: { pos: [0, 0, -20], up: [0, 1, 0] },
  left: { pos: [-20, 0, 0], up: [0, 1, 0] },
  right: { pos: [20, 0, 0], up: [0, 1, 0] },
};

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')),
    );
  } catch {
    return false;
  }
}

export default function SceneCanvas({
  nodes,
  selectedId,
  multiSelectedIds = [],
  mode = 'translate',
  gridVisible = true,
  axesVisible = true,
  readOnly = false,
  viewPreset = 'perspective',
  coordinateSpace = 'world',
  runtimeOverrides = {},
  focusRequest = null,
  cameraView = null,
  onSelect,
  onBoxSelect,
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
  onPointerWorldPosition,
  onDropKind,
  onTransform,
  onTransformStart,
  onRuntimeError,
}: Props) {
  const [webglFailed, setWebglFailed] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const perspectiveRef = useRef<THREE.PerspectiveCamera>();
  const orthoRef = useRef<THREE.OrthographicCamera>();
  const activeCameraRef = useRef<THREE.Camera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const orbitRef = useRef<OrbitControls>();
  const transformRef = useRef<TransformControls>();
  const gridRef = useRef<THREE.GridHelper>();
  const axesRef = useRef<THREE.AxesHelper>();
  const objectsRef = useRef(new Map<string, THREE.Object3D>());
  const selectionBoxesRef = useRef(new Map<string, THREE.Box3Helper>());
  const selectedIdRef = useRef(selectedId);
  const hoveredIdRef = useRef<string | null>(null);
  const nodesRef = useRef(nodes);
  const runtimeOverridesRef = useRef(runtimeOverrides);
  const transformCallbacksRef = useRef({ onTransform, onTransformStart });
  const gltfLoaderRef = useRef(new GLTFLoader());
  const textureLoaderRef = useRef(new THREE.TextureLoader());
  const boxLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    runtimeOverridesRef.current = runtimeOverrides;
  }, [runtimeOverrides]);
  useEffect(() => {
    transformCallbacksRef.current = { onTransform, onTransformStart };
  }, [onTransform, onTransformStart]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!detectWebGL()) {
      setWebglFailed(true);
      return;
    }
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#101826');
      scene.fog = new THREE.Fog('#101826', 35, 90);
      const aspect = host.clientWidth / Math.max(host.clientHeight, 1);
      const perspective = new THREE.PerspectiveCamera(48, aspect, 0.1, 1000);
      perspective.position.set(...VIEW_PRESETS.perspective.pos);
      const orthoSize = 16;
      const orthographic = new THREE.OrthographicCamera(
        -orthoSize * aspect,
        orthoSize * aspect,
        orthoSize,
        -orthoSize,
        0.1,
        1000,
      );
      orthographic.position.set(...VIEW_PRESETS.front.pos);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.replaceChildren(renderer.domElement);
      if (boxLayerRef.current) host.appendChild(boxLayerRef.current);

      scene.add(new THREE.HemisphereLight('#dff6ff', '#142238', 2.25));
      const sun = new THREE.DirectionalLight('#ffffff', 2.1);
      sun.position.set(12, 20, 8);
      sun.castShadow = true;
      scene.add(sun);
      const grid = new THREE.GridHelper(60, 60, '#38506a', '#203149');
      grid.position.y = -0.01;
      scene.add(grid);
      gridRef.current = grid;
      const axes = new THREE.AxesHelper(3);
      scene.add(axes);
      axesRef.current = axes;

      const orbit = new OrbitControls(perspective, renderer.domElement);
      orbit.enableDamping = true;
      orbit.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      orbit.minDistance = 2;
      orbit.maxDistance = 100;
      orbit.maxPolarAngle = Math.PI * 0.49;

      let externalDragActive = false;
      const handleExternalDragStart = (event: DragEvent) => {
        if (externalDragActive || !(event.target instanceof HTMLElement) || !event.target.draggable)
          return;
        externalDragActive = true;
        orbit.saveState();
        orbit.enabled = false;
      };
      const handleExternalDragEnd = () => {
        if (!externalDragActive) return;
        orbit.reset();
        externalDragActive = false;
        orbit.enabled = !transformRef.current?.dragging;
      };
      document.addEventListener('dragstart', handleExternalDragStart);
      document.addEventListener('dragend', handleExternalDragEnd);

      const transform = new TransformControls(perspective, renderer.domElement);
      transform.setSize(0.82);
      transform.setTranslationSnap(0.5);
      transform.setRotationSnap(THREE.MathUtils.degToRad(15));
      scene.add(transform.getHelper());
      const handleDragging = (event: { value?: unknown }) => {
        orbit.enabled = !Boolean(event.value);
      };
      const handleMouseDown = () => transformCallbacksRef.current.onTransformStart?.();
      const emitTransform = (finished: boolean) => {
        const object = transform.object;
        const id = selectedIdRef.current;
        if (!object || !id) return;
        transformCallbacksRef.current.onTransform?.(
          id,
          {
            position: roundVector(object.position),
            rotation: roundVector(
              new THREE.Vector3(
                THREE.MathUtils.radToDeg(object.rotation.x),
                THREE.MathUtils.radToDeg(object.rotation.y),
                THREE.MathUtils.radToDeg(object.rotation.z),
              ),
            ),
            scale: roundVector(object.scale),
          },
          finished,
        );
      };
      transform.addEventListener('dragging-changed', handleDragging);
      transform.addEventListener('mouseDown', handleMouseDown);
      transform.addEventListener('objectChange', () => emitTransform(false));
      transform.addEventListener('mouseUp', () => emitTransform(true));

      sceneRef.current = scene;
      perspectiveRef.current = perspective;
      orthoRef.current = orthographic;
      activeCameraRef.current = perspective;
      rendererRef.current = renderer;
      orbitRef.current = orbit;
      transformRef.current = transform;
      const resize = () => {
        const a = host.clientWidth / Math.max(host.clientHeight, 1);
        perspective.aspect = a;
        perspective.updateProjectionMatrix();
        orthographic.left = -orthoSize * a;
        orthographic.right = orthoSize * a;
        orthographic.top = orthoSize;
        orthographic.bottom = -orthoSize;
        orthographic.updateProjectionMatrix();
        renderer.setSize(host.clientWidth, host.clientHeight);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      const clock = new THREE.Clock();
      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        if (!externalDragActive) orbit.update();
        objectsRef.current.forEach((object) => {
          const mixer = object.userData.anim?.mixer as THREE.AnimationMixer | undefined;
          if (mixer) mixer.update(delta);
        });
        renderer.render(scene, activeCameraRef.current ?? perspective);
      };
      animate();
      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        document.removeEventListener('dragstart', handleExternalDragStart);
        document.removeEventListener('dragend', handleExternalDragEnd);
        orbit.dispose();
        transform.dispose();
        renderer.forceContextLoss();
        renderer.dispose();
        objectsRef.current.forEach(disposeObject);
        objectsRef.current.clear();
        selectionBoxesRef.current.forEach((helper) => scene.remove(helper));
        selectionBoxesRef.current.clear();
        host.replaceChildren();
      };
    } catch (error) {
      setWebglFailed(true);
      onRuntimeError(error instanceof Error ? error.message : 'WebGL 初始化失败');
    }
  }, [onRuntimeError]);

  // 网格 / 坐标轴显隐
  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = gridVisible;
  }, [gridVisible]);
  useEffect(() => {
    if (axesRef.current) axesRef.current.visible = axesVisible;
  }, [axesVisible]);

  useEffect(() => {
    transformRef.current?.setMode(mode);
  }, [mode]);

  // 世界/局部坐标空间
  useEffect(() => {
    transformRef.current?.setSpace(coordinateSpace);
  }, [coordinateSpace]);

  // 视图预设切换（透视 / 六视图）
  useEffect(() => {
    const orbit = orbitRef.current;
    const perspective = perspectiveRef.current;
    const orthographic = orthoRef.current;
    const transform = transformRef.current;
    if (!orbit || !perspective || !orthographic || !transform) return;
    const preset = VIEW_PRESETS[viewPreset];
    const isPerspective = viewPreset === 'perspective';
    const camera = isPerspective ? perspective : orthographic;
    activeCameraRef.current = camera;
    orbit.object = camera;
    transform.camera = camera;
    camera.up.set(...preset.up);
    camera.position.set(...preset.pos);
    orbit.target.set(0, 0, 0);
    orbit.enableRotate = isPerspective;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    orbit.update();
  }, [viewPreset]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const active = new Set(nodes.map((node) => node.id));
    objectsRef.current.forEach((object, id) => {
      if (!active.has(id)) {
        transformRef.current?.detach();
        object.userData.anim?.mixer?.stopAllAction();
        scene.remove(object);
        disposeObject(object);
        objectsRef.current.delete(id);
      }
    });
    nodes.forEach((node) => {
      const override = runtimeOverrides[node.id];
      const visualNode = effectiveVisualNode(node, override?.value);
      const nextVisualSignature = visualSignature(visualNode);
      let object = objectsRef.current.get(node.id);
      if (object && object.userData.visualSignature !== nextVisualSignature) {
        if (transformRef.current?.object === object) transformRef.current.detach();
        object.userData.anim?.mixer?.stopAllAction();
        scene.remove(object);
        disposeObject(object);
        objectsRef.current.delete(node.id);
        object = undefined;
      }
      if (!object) {
        object = buildObject(visualNode);
        object.userData.visualSignature = nextVisualSignature;
        object.traverse((child) => {
          child.userData.nodeId = node.id;
        });
        objectsRef.current.set(node.id, object);
        scene.add(object);
      }
      if (node.kind === 'model' && node.assetPath && object.userData.assetPath !== node.assetPath) {
        object.userData.assetPath = node.assetPath;
        const root = object;
        gltfLoaderRef.current.load(
          node.assetPath,
          (gltf) => {
            if (
              objectsRef.current.get(node.id) !== root ||
              root.userData.assetPath !== node.assetPath
            ) {
              disposeObject(gltf.scene);
              return;
            }
            root.children.forEach((child) => disposeObject(child));
            while (root.children.length) root.remove(root.children[0]);
            const model = gltf.scene;
            model.traverse((child) => {
              child.userData.nodeId = node.id;
              if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            root.add(model);
            // GLTF 内嵌动画：使用最新属性决定片段和初始播放状态。
            if (gltf.animations.length) {
              const latestNode = nodesRef.current.find((item) => item.id === node.id) ?? node;
              const latestOverride = runtimeOverridesRef.current[node.id];
              const mixer = new THREE.AnimationMixer(model);
              const clipIndex =
                latestNode.animation?.clip && latestNode.animation.clip >= 0
                  ? latestNode.animation.clip
                  : 0;
              const clip = gltf.animations[Math.min(clipIndex, gltf.animations.length - 1)];
              const action = mixer.clipAction(clip);
              const playing = latestOverride?.playing ?? latestNode.animation?.autoplay ?? true;
              action.paused = !playing;
              action.play();
              root.userData.anim = {
                mixer,
                action,
                clips: gltf.animations,
                clipIndex: Math.min(clipIndex, gltf.animations.length - 1),
                model,
              };
            }
          },
          undefined,
          (error) =>
            onRuntimeError(
              `模型 ${node.name} 加载失败: ${error instanceof Error ? error.message : '资源无效'}`,
            ),
        );
      }
      if (node.kind === 'image' && node.assetPath && object.userData.assetPath !== node.assetPath) {
        object.userData.assetPath = node.assetPath;
        const root = object;
        textureLoaderRef.current.load(
          node.assetPath,
          (texture) => {
            if (
              objectsRef.current.get(node.id) !== root ||
              root.userData.assetPath !== node.assetPath
            ) {
              texture.dispose();
              return;
            }
            texture.colorSpace = THREE.SRGBColorSpace;
            const source = texture.image as { width?: number; height?: number };
            const aspect = Math.max(0.25, Math.min(4, (source.width ?? 1) / (source.height ?? 1)));
            const height = 2.4;
            const image = new THREE.Mesh(
              new THREE.PlaneGeometry(height * aspect, height),
              new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                toneMapped: false,
              }),
            );
            image.position.y = height / 2;
            image.userData.nodeId = node.id;
            root.children.forEach((child) => disposeObject(child));
            while (root.children.length) root.remove(root.children[0]);
            root.add(image);
          },
          undefined,
          (error) =>
            onRuntimeError(
              `图片 ${node.name} 加载失败: ${error instanceof Error ? error.message : '资源无效'}`,
            ),
        );
      }
      object.position.set(...node.position);
      object.rotation.set(
        ...(node.rotation.map(THREE.MathUtils.degToRad) as [number, number, number]),
      );
      object.scale.set(...node.scale);
      const effectiveColor = override?.color ?? node.color;
      const effectiveOpacity = override?.opacity ?? node.opacity;
      const effectiveText = override?.text ?? node.text ?? node.name;
      object.visible = override?.visible ?? node.visible;
      updateObjectText(object, { ...node, text: effectiveText });
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = node.kind !== 'road' && node.kind !== 'plane';
        child.receiveShadow = true;
        if (child.userData.tintable && child.material instanceof THREE.MeshStandardMaterial) {
          child.material.color.set(effectiveColor ?? '#34d399');
          child.material.opacity = effectiveOpacity ?? 1;
          child.material.transparent = (effectiveOpacity ?? 1) < 1;
        }
        if (node.kind === 'image' && child.material instanceof THREE.MeshBasicMaterial) {
          child.material.color.set(effectiveColor ?? '#ffffff');
          child.material.opacity = effectiveOpacity ?? 1;
          child.material.transparent = true;
        }
      });
      // 灯光参数实时同步
      object.traverse((child) => {
        if (child instanceof THREE.PointLight && node.kind === 'light') {
          child.color.set(effectiveColor ?? '#ffd166');
          child.intensity = node.intensity ?? 1.4;
          child.distance = node.distance ?? 0;
        }
        if (child instanceof THREE.DirectionalLight && node.kind === 'directionalLight') {
          child.color.set(effectiveColor ?? '#ffffff');
          child.intensity = node.intensity ?? 1.2;
          child.castShadow = node.castShadow ?? true;
        }
        if (child instanceof THREE.AmbientLight && node.kind === 'ambientLight') {
          child.color.set(effectiveColor ?? '#ffffff');
          child.intensity = node.intensity ?? 0.55;
        }
      });
      // 模型动画播放/暂停（事件动作或属性面板控制）
      if (node.kind === 'model' && object.userData.anim?.action) {
        const anim = object.userData.anim as {
          mixer: THREE.AnimationMixer;
          action: THREE.AnimationAction;
          clips: THREE.AnimationClip[];
          clipIndex: number;
          model: THREE.Object3D;
        };
        const desiredClipIndex = Math.min(
          Math.max(node.animation?.clip ?? 0, 0),
          anim.clips.length - 1,
        );
        if (desiredClipIndex !== anim.clipIndex) {
          anim.action.stop();
          anim.action = anim.mixer.clipAction(anim.clips[desiredClipIndex], anim.model);
          anim.action.play();
          anim.clipIndex = desiredClipIndex;
        }
        const playing = override?.playing ?? node.animation?.autoplay ?? true;
        anim.action.paused = !playing;
      }
    });
  }, [nodes, runtimeOverrides, onRuntimeError]);

  // 多选对象的包围盒高亮
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const active = new Set(multiSelectedIds);
    selectionBoxesRef.current.forEach((helper, id) => {
      if (!active.has(id) || id === selectedId) {
        scene.remove(helper);
        helper.geometry?.dispose();
        selectionBoxesRef.current.delete(id);
      }
    });
    multiSelectedIds.forEach((id) => {
      if (id === selectedId) return;
      const object = objectsRef.current.get(id);
      if (!object) return;
      let helper = selectionBoxesRef.current.get(id);
      const box = new THREE.Box3().setFromObject(object);
      if (!helper) {
        helper = new THREE.Box3Helper(box, new THREE.Color('#7ce5c1'));
        selectionBoxesRef.current.set(id, helper);
        scene.add(helper);
      } else {
        helper.box.copy(box);
      }
    });
  }, [multiSelectedIds, selectedId, nodes]);

  useEffect(() => {
    if (!focusRequest) return;
    const object = objectsRef.current.get(focusRequest.nodeId);
    const camera = activeCameraRef.current;
    const orbit = orbitRef.current;
    if (!object || !camera || !orbit) return;
    const bounds = new THREE.Box3().setFromObject(object);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = Math.max(bounds.getSize(new THREE.Vector3()).length(), 4);
    orbit.target.copy(center);
    camera.position.set(center.x + size * 1.2, center.y + size * 0.8, center.z + size * 1.2);
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    (camera as THREE.PerspectiveCamera | THREE.OrthographicCamera).updateProjectionMatrix();
    orbit.update();
  }, [focusRequest]);

  useEffect(() => {
    if (focusRequest || !cameraView) return;
    const camera = activeCameraRef.current;
    const orbit = orbitRef.current;
    if (!camera || !orbit) return;
    camera.position.set(...cameraView.position);
    orbit.target.set(...cameraView.target);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = cameraView.fov ?? 48;
      camera.updateProjectionMatrix();
    }
    orbit.update();
  }, [cameraView, focusRequest]);

  const selectedLocked = nodes.find((item) => item.id === selectedId)?.locked ?? false;
  useEffect(() => {
    const transform = transformRef.current;
    if (!transform) return;
    const object = selectedId ? objectsRef.current.get(selectedId) : undefined;
    if (object && !selectedLocked && !readOnly) transform.attach(object);
    else transform.detach();
  }, [readOnly, selectedId, selectedLocked]);

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    let pointerDown: [number, number] = [0, 0];
    let boxSelecting = false;
    let boxAdditive = false;
    const boxEl = boxLayerRef.current;

    const nodeById = (id: string | null) =>
      id ? nodesRef.current.find((item) => item.id === id) : undefined;
    const hitTest = (event: MouseEvent | PointerEvent) => {
      const camera = activeCameraRef.current;
      if (!camera) return null;
      const pointer = pointerFromEvent(event, renderer.domElement);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...objectsRef.current.values()], true);
      for (const hit of hits) {
        const id = findNodeId(hit.object);
        if (!id) continue;
        const node = nodeById(id);
        // 编辑态下隐藏/锁定对象不可被选中；运行态仍可触发事件
        if (!readOnly && node && (node.locked || !node.visible)) continue;
        return id;
      }
      return null;
    };
    const groundPosition = (event: MouseEvent | PointerEvent): [number, number, number] | null => {
      const camera = activeCameraRef.current;
      if (!camera) return null;
      const pointer = pointerFromEvent(event, renderer.domElement);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      // 优先与可见模型表面求交
      const surfaceHits = raycaster.intersectObjects([...objectsRef.current.values()], true);
      for (const hit of surfaceHits) {
        const id = findNodeId(hit.object);
        const node = nodeById(id);
        if (node && !node.visible) continue;
        if (hit.face) return [snap(hit.point.x), snap(hit.point.y), snap(hit.point.z)];
      }
      const point = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point))
        return null;
      return [snap(point.x), 0, snap(point.z)];
    };
    const onPointerDown = (event: PointerEvent) => {
      pointerDown = [event.clientX, event.clientY];
      // Shift 左键拖拽框选（编辑态）
      if (!readOnly && event.shiftKey && event.button === 0 && onBoxSelect && boxEl) {
        const rect = renderer.domElement.getBoundingClientRect();
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          boxSelecting = true;
          boxAdditive = false;
          orbitRef.current && (orbitRef.current.enabled = false);
          boxEl.dataset.x = String(event.clientX - rect.left);
          boxEl.dataset.y = String(event.clientY - rect.top);
          boxEl.style.display = 'block';
          boxEl.style.left = `${event.clientX - rect.left}px`;
          boxEl.style.top = `${event.clientY - rect.top}px`;
          boxEl.style.width = '0px';
          boxEl.style.height = '0px';
        }
      }
    };
    const onClick = (event: MouseEvent) => {
      if (
        Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) > 4 ||
        transformRef.current?.dragging
      )
        return;
      const id = hitTest(event);
      onSelect(id);
      if (id) onNodeClick?.(id);
    };
    const onDoubleClick = (event: MouseEvent) => {
      const id = hitTest(event);
      if (id) onNodeDoubleClick?.(id);
    };
    const onPointerMove = (event: PointerEvent) => {
      const position = groundPosition(event);
      if (position) onPointerWorldPosition?.([position[0], position[1], position[2]]);
      if (boxSelecting && boxEl) {
        const rect = renderer.domElement.getBoundingClientRect();
        const x0 = Number(boxEl.dataset.x ?? 0);
        const y0 = Number(boxEl.dataset.y ?? 0);
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        boxEl.style.left = `${Math.min(x, x0)}px`;
        boxEl.style.top = `${Math.min(y, y0)}px`;
        boxEl.style.width = `${Math.abs(x - x0)}px`;
        boxEl.style.height = `${Math.abs(y - y0)}px`;
        return;
      }
      const id = hitTest(event);
      if (id === hoveredIdRef.current) return;
      hoveredIdRef.current = id;
      onNodeHover?.(id);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!boxSelecting || !boxEl) return;
      boxSelecting = false;
      if (orbitRef.current) orbitRef.current.enabled = !transformRef.current?.dragging;
      const rect = renderer.domElement.getBoundingClientRect();
      const x0 = Number(boxEl.dataset.x ?? 0);
      const y0 = Number(boxEl.dataset.y ?? 0);
      const x1 = event.clientX - rect.left;
      const y1 = event.clientY - rect.top;
      boxEl.style.display = 'none';
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1);
      const maxY = Math.max(y0, y1);
      const camera = activeCameraRef.current;
      if (camera && (maxX - minX > 4 || maxY - minY > 4)) {
        const ids: string[] = [];
        objectsRef.current.forEach((object, id) => {
          const node = nodeById(id);
          if (!node || node.locked || !node.visible) return;
          const center = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
          center.project(camera);
          const sx = ((center.x + 1) / 2) * rect.width;
          const sy = ((-center.y + 1) / 2) * rect.height;
          if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) ids.push(id);
        });
        onBoxSelect?.(ids, boxAdditive);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('dblclick', onDoubleClick);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [onNodeClick, onNodeDoubleClick, onNodeHover, onPointerWorldPosition, onSelect, onBoxSelect, readOnly]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData('component-kind') as NodeKind;
    const camera = activeCameraRef.current;
    const renderer = rendererRef.current;
    if (!kind || !camera || !renderer) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointerFromEvent(event, renderer.domElement), camera);
    // 优先落在可见模型表面，其次工作平面，最后相机正前方
    let position: [number, number, number] | null = null;
    const surfaceHits = raycaster.intersectObjects([...objectsRef.current.values()], true);
    for (const hit of surfaceHits) {
      if (!hit.face) continue;
      const id = findNodeId(hit.object);
      const node = id ? nodes.find((item) => item.id === id) : undefined;
      if (node && !node.visible) continue;
      position = [snap(hit.point.x), snap(hit.point.y), snap(hit.point.z)];
      break;
    }
    if (!position) {
      const point = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point)) {
        position = [snap(point.x), 0, snap(point.z)];
      } else {
        camera.getWorldDirection(point).multiplyScalar(5).add(camera.position);
        position = [snap(point.x), snap(point.y), snap(point.z)];
      }
    }
    onDropKind?.(kind, position);
  };

  if (webglFailed) {
    return (
      <div className="webgl-fallback" role="alert">
        <strong>当前浏览器无法启用 WebGL</strong>
        <p>三维画布需要 WebGL 支持，请尝试：</p>
        <ul>
          <li>使用最新版 Chrome / Edge 浏览器；</li>
          <li>在浏览器设置中开启「硬件加速」后重启；</li>
          <li>更新显卡驱动；若为远程桌面，请启用 GPU 加速转发。</li>
        </ul>
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className="scene-canvas"
      role="application"
      tabIndex={0}
      aria-label="三维场景画布"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={handleDrop}
    >
      <div
        ref={boxLayerRef}
        className="box-select-layer"
        style={{ display: 'none' }}
        aria-hidden
      />
    </div>
  );
}

function roundVector(vector: THREE.Vector3): [number, number, number] {
  return [vector.x, vector.y, vector.z].map((value) => Math.round(value * 100) / 100) as [
    number,
    number,
    number,
  ];
}
function snap(value: number) {
  return Math.round(value * 2) / 2;
}
function pointerFromEvent(event: { clientX: number; clientY: number }, element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
}
function findNodeId(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (current.userData.nodeId) return current.userData.nodeId;
    current = current.parent;
  }
  return null;
}
