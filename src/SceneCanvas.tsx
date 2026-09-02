import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { NodeKind, SceneCameraKeyframe, SceneNode, TransformMode } from './types';
import { buildObject, disposeObject, updateObjectText } from './sceneObjects';

type TransformPatch = Pick<SceneNode, 'position' | 'rotation' | 'scale'>;
export type CameraFocusRequest = { nodeId: string; nonce: number };
type Props = {
  nodes: SceneNode[];
  selectedId: string | null;
  mode?: TransformMode;
  gridVisible?: boolean;
  readOnly?: boolean;
  runtimeOverrides?: Record<
    string,
    Partial<Pick<SceneNode, 'color' | 'visible' | 'opacity' | 'value' | 'text'>>
  >;
  focusRequest?: CameraFocusRequest | null;
  cameraView?: SceneCameraKeyframe | null;
  onSelect: (id: string | null) => void;
  onNodeClick?: (id: string) => void;
  onNodeDoubleClick?: (id: string) => void;
  onNodeHover?: (id: string | null) => void;
  onDropKind?: (kind: NodeKind, position: [number, number, number]) => void;
  onDropAsset?: (assetId: string, position: [number, number, number]) => void;
  onTransform?: (id: string, patch: TransformPatch, finished: boolean) => void;
  onTransformStart?: () => void;
  onRuntimeError: (message: string) => void;
};

export default function SceneCanvas({
  nodes,
  selectedId,
  mode = 'translate',
  gridVisible = true,
  readOnly = false,
  runtimeOverrides = {},
  focusRequest = null,
  cameraView = null,
  onSelect,
  onNodeClick,
  onNodeDoubleClick,
  onNodeHover,
  onDropKind,
  onDropAsset,
  onTransform,
  onTransformStart,
  onRuntimeError,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const orbitRef = useRef<OrbitControls>();
  const transformRef = useRef<TransformControls>();
  const gridRef = useRef<THREE.GridHelper>();
  const objectsRef = useRef(new Map<string, THREE.Object3D>());
  const selectedIdRef = useRef(selectedId);
  const hoveredIdRef = useRef<string | null>(null);
  const transformCallbacksRef = useRef({ onTransform, onTransformStart });
  const gltfLoaderRef = useRef(new GLTFLoader());
  const textureLoaderRef = useRef(new THREE.TextureLoader());

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    transformCallbacksRef.current = { onTransform, onTransformStart };
  }, [onTransform, onTransformStart]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    try {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#101826');
      scene.fog = new THREE.Fog('#101826', 35, 90);
      const camera = new THREE.PerspectiveCamera(
        48,
        host.clientWidth / host.clientHeight,
        0.1,
        1000,
      );
      camera.position.set(14, 11, 17);
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      host.replaceChildren(renderer.domElement);

      scene.add(new THREE.HemisphereLight('#dff6ff', '#142238', 2.25));
      const sun = new THREE.DirectionalLight('#ffffff', 2.1);
      sun.position.set(12, 20, 8);
      sun.castShadow = true;
      scene.add(sun);
      const grid = new THREE.GridHelper(60, 60, '#38506a', '#203149');
      grid.position.y = -0.01;
      scene.add(grid);
      gridRef.current = grid;
      scene.add(new THREE.AxesHelper(3));

      const orbit = new OrbitControls(camera, renderer.domElement);
      orbit.enableDamping = true;
      orbit.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.ROTATE,
      };
      orbit.minDistance = 2;
      orbit.maxDistance = 100;
      orbit.maxPolarAngle = Math.PI * 0.49;

      const transform = new TransformControls(camera, renderer.domElement);
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
      cameraRef.current = camera;
      rendererRef.current = renderer;
      orbitRef.current = orbit;
      transformRef.current = transform;
      const resize = () => {
        camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1);
        camera.updateProjectionMatrix();
        renderer.setSize(host.clientWidth, host.clientHeight);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      let frame = 0;
      const animate = () => {
        frame = requestAnimationFrame(animate);
        orbit.update();
        renderer.render(scene, camera);
      };
      animate();
      return () => {
        cancelAnimationFrame(frame);
        observer.disconnect();
        orbit.dispose();
        transform.dispose();
        // 路由切换或预览退出时主动释放 WebGL 上下文，避免多次打开 Demo 后触发浏览器上下文上限警告。
        renderer.forceContextLoss();
        renderer.dispose();
        objectsRef.current.forEach(disposeObject);
        objectsRef.current.clear();
        host.replaceChildren();
      };
    } catch (error) {
      onRuntimeError(error instanceof Error ? error.message : 'WebGL 初始化失败');
    }
  }, [onRuntimeError]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = gridVisible;
  }, [gridVisible]);
  useEffect(() => {
    transformRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const active = new Set(nodes.map((node) => node.id));
    objectsRef.current.forEach((object, id) => {
      if (!active.has(id)) {
        transformRef.current?.detach();
        scene.remove(object);
        disposeObject(object);
        objectsRef.current.delete(id);
      }
    });
    nodes.forEach((node) => {
      let object = objectsRef.current.get(node.id);
      if (!object) {
        object = buildObject(node);
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
      const override = runtimeOverrides[node.id];
      const effectiveColor = override?.color ?? node.color;
      const effectiveOpacity = override?.opacity ?? node.opacity;
      const effectiveValue = override?.value ?? node.value;
      const effectiveText = override?.text ?? node.text ?? node.name;
      object.visible = override?.visible ?? node.visible;
      updateObjectText(object, effectiveText);
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
      if (node.kind === 'bar') object.scale.y = Math.max(0.15, (effectiveValue ?? 50) / 50);
    });
  }, [nodes, runtimeOverrides]);

  useEffect(() => {
    if (!focusRequest) return;
    const object = objectsRef.current.get(focusRequest.nodeId);
    const camera = cameraRef.current;
    const orbit = orbitRef.current;
    if (!object || !camera || !orbit) return;
    const bounds = new THREE.Box3().setFromObject(object);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = Math.max(bounds.getSize(new THREE.Vector3()).length(), 4);
    // 运行态事件聚焦：相机移动到目标斜上方，Orbit 目标对准节点中心，确保用户能看到触发对象。
    orbit.target.copy(center);
    camera.position.set(center.x + size * 1.2, center.y + size * 0.8, center.z + size * 1.2);
    camera.lookAt(center);
    camera.updateProjectionMatrix();
    orbit.update();
  }, [focusRequest]);

  useEffect(() => {
    // 事件聚焦期间让用户看到明确的目标，聚焦结束后再恢复自动镜头。
    if (focusRequest || !cameraView) return;
    const camera = cameraRef.current;
    const orbit = orbitRef.current;
    if (!camera || !orbit) return;
    camera.position.set(...cameraView.position);
    orbit.target.set(...cameraView.target);
    camera.fov = cameraView.fov ?? 48;
    camera.updateProjectionMatrix();
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
    const camera = cameraRef.current;
    if (!renderer || !camera) return;
    let pointerDown: [number, number] = [0, 0];
    const onPointerDown = (event: PointerEvent) => {
      pointerDown = [event.clientX, event.clientY];
    };
    const hitTest = (event: MouseEvent | PointerEvent) => {
      const pointer = pointerFromEvent(event, renderer.domElement);
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...objectsRef.current.values()], true);
      return hits.map((hit) => findNodeId(hit.object)).find(Boolean) ?? null;
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
      const id = hitTest(event);
      if (id === hoveredIdRef.current) return;
      hoveredIdRef.current = id;
      onNodeHover?.(id);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('dblclick', onDoubleClick);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    return () => {
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('dblclick', onDoubleClick);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
    };
  }, [onNodeClick, onNodeDoubleClick, onNodeHover, onSelect]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData('component-kind') as NodeKind;
    const assetId = event.dataTransfer.getData('asset-id');
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if ((!kind && !assetId) || !camera || !renderer) return;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointerFromEvent(event, renderer.domElement), camera);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point))
      camera.getWorldDirection(point).multiplyScalar(5).add(camera.position);
    const position: [number, number, number] = [snap(point.x), 0, snap(point.z)];
    if (kind) onDropKind?.(kind, position);
    else if (assetId) onDropAsset?.(assetId, position);
  };

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
    />
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
