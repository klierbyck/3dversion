import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  Grid3X3,
  History,
  MousePointer2,
  Package,
  Pause,
  Play,
  Plus,
  Redo2,
  Rotate3d,
  Search,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import SceneCanvas, { type CameraFocusRequest } from './SceneCanvas';
import { demoSceneFor, upgradeDemoScene } from './demos';
import {
  componentCatalog,
  createNode,
  uid,
  type NodeKind,
  type ProjectMeta,
  type Release,
  type RuntimeError,
  type SceneDocument,
  type SceneEventAction,
  type SceneEventActionType,
  type SceneEventRule,
  type SceneEventScope,
  type SceneEventTriggerType,
  type SceneTimeline,
  type SceneTimelineProperty,
  type SceneNode,
  type AssetMeta,
  type SceneDataBinding,
  type SceneDataBindingProperty,
  type SceneDataSource,
  type TransformMode,
} from './types';
import {
  DraftConflictError,
  createRelease,
  listReleases,
  loadDraft,
  reportRuntimeError,
  saveDraft,
  listAssets,
  uploadAsset,
  testDataSource,
} from './api';
import {
  applyCameraTimeline,
  applyTimeline,
  formatTimelineTime,
  normalizeTimeline,
  propertyValue,
} from './timeline';

type Props = { project: ProjectMeta; onExit: () => void };

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isSceneSnapshot(value: unknown): value is SceneDocument {
  return Boolean(
    value && typeof value === 'object' && Array.isArray((value as SceneDocument).nodes),
  );
}

const componentCategories = ['全部', '基础', '建筑', '工业', '能源', '数据', '系统'];

const sceneTriggerLabels: Record<SceneEventTriggerType, string> = {
  sceneLoad: '场景加载',
  click: '任意对象点击',
  doubleClick: '任意对象双击',
  hover: '任意对象悬停',
};
const nodeTriggerLabels: Pick<
  Record<SceneEventTriggerType, string>,
  'click' | 'doubleClick' | 'hover'
> = {
  click: '点击',
  doubleClick: '双击',
  hover: '悬停',
};
const actionLabels: Record<SceneEventActionType, string> = {
  focusCamera: '相机聚焦',
  showPopup: '显示弹窗',
  setColor: '设置颜色',
  setVisibility: '显示/隐藏',
};
const timelinePropertyLabels: Record<SceneTimelineProperty, string> = {
  position: '位置',
  rotation: '旋转',
  scale: '缩放',
  color: '颜色',
  opacity: '透明度',
  visible: '显隐',
};

/** 兼容旧草稿：场景加载规则视为场景级，其余旧规则视为对象级。 */
function getEventScope(rule: SceneEventRule): SceneEventScope {
  return rule.scope ?? (rule.trigger.type === 'sceneLoad' ? 'scene' : 'node');
}

function getEventOwnerId(rule: SceneEventRule): string | null {
  return rule.ownerNodeId ?? rule.trigger.nodeId ?? null;
}

export default function EditorPage({ project, onExit }: Props) {
  // 无草稿时以示例场景（或空场景）作为编辑起点。
  const initialScene = useMemo(() => demoSceneFor(project.id), [project.id]);
  const [scene, setScene] = useState<SceneDocument>(initialScene);
  const [selectedId, setSelectedId] = useState<string | null>(initialScene.nodes[0]?.id ?? null);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState('已保存');
  const [activeTab, setActiveTab] = useState<'components' | 'assets'>('components');
  const [category, setCategory] = useState('全部');
  const [query, setQuery] = useState('');
  const [bottomTab, setBottomTab] = useState<'timeline' | 'events'>('timeline');
  const [bottomOpen, setBottomOpen] = useState(false);
  const [timelineTime, setTimelineTime] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'properties' | 'data' | 'events'>('properties');
  const [showReleases, setShowReleases] = useState(false);
  const [releases, setReleases] = useState<Release[]>([]);
  const [runtimeErrors, setRuntimeErrors] = useState<RuntimeError[]>([]);
  const [isRuntime, setIsRuntime] = useState(false);
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [gridVisible, setGridVisible] = useState(true);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<SceneDocument[]>([]);
  const [redoStack, setRedoStack] = useState<SceneDocument[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetMeta[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dataSourceStatus, setDataSourceStatus] = useState<string | null>(null);

  // 场景的最新值以 ref 为准：所有变更先算出 next 再统一写入，
  // 避免 StrictMode 双调用 setState updater 时把撤销快照重复入栈。
  const sceneRef = useRef(initialScene);
  const selectedIdRef = useRef(selectedId);
  const transformStartRef = useRef<SceneDocument | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);

  const selected = scene.nodes.find((node) => node.id === selectedId) ?? null;
  const allEvents = scene.events ?? [];
  const sceneEvents = allEvents.filter((rule) => getEventScope(rule) === 'scene');
  const objectEvents = allEvents.filter(
    (rule) => getEventScope(rule) === 'node' && getEventOwnerId(rule) === selectedId,
  );
  const eventCount = objectEvents.length;
  const timeline = useMemo(() => normalizeTimeline(scene.timeline), [scene.timeline]);
  const canvasNodes = useMemo(() => applyTimeline(scene, timelineTime), [scene, timelineTime]);
  const cameraView = useMemo(() => applyCameraTimeline(scene, timelineTime), [scene, timelineTime]);
  const filtered = useMemo(
    () =>
      componentCatalog.filter(
        (item) =>
          (category === '全部' || item.category === category) &&
          `${item.label}${item.kind}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [category, query],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2800);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    if (!timelinePlaying || !timeline.keyframes.length) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = (now - previous) / 1000;
      previous = now;
      setTimelineTime((current) => {
        const next = current + delta;
        if (next < timeline.duration) return next;
        if (timeline.loop) return next % timeline.duration;
        setTimelinePlaying(false);
        return timeline.duration;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [timeline.duration, timeline.keyframes.length, timeline.loop, timelinePlaying]);

  useEffect(() => {
    setTimelineTime((current) => Math.min(current, timeline.duration));
  }, [timeline.duration]);

  /** 将 next 场景提交为当前状态（同步维护 sceneRef）。 */
  const commitScene = useCallback((next: SceneDocument) => {
    sceneRef.current = next;
    setScene(next);
  }, []);

  /** 可撤销的场景更新：以 ref 中最新场景为基准计算，撤销/重做栈在 updater 之外维护。 */
  const updateScene = useCallback(
    (updater: (current: SceneDocument) => SceneDocument) => {
      const base = sceneRef.current;
      commitScene(updater(base));
      setUndoStack((stack) => [...stack.slice(-49), base]);
      setRedoStack([]);
      setSaveState('未保存');
    },
    [commitScene],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadDraft(project.id), listReleases(project.id)]).then(([draft, history]) => {
      if (cancelled) return;
      if (history.length > 0) setReleases(history);
      if (draft && draft.scene.nodes.length > 0) {
        const loadedScene = upgradeDemoScene(project.id, draft.scene);
        sceneRef.current = loadedScene;
        setScene(loadedScene);
        setRevision(draft.revision);
        setSelectedId(loadedScene.nodes[0]?.id ?? null);
        if (loadedScene !== draft.scene) setSaveState('未保存');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    let cancelled = false;
    void listAssets(project.id).then((items) => {
      if (!cancelled) setAssets(items);
    });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  // 编辑后 10 秒无操作自动保存；scene 进入依赖使连续编辑能重置防抖计时器。
  useEffect(() => {
    if (saveState !== '未保存') return;
    const timer = window.setTimeout(() => void handleSave(), 10000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, saveState]);

  const handleSave = useCallback(async () => {
    setSaveState('保存中');
    try {
      const result = await saveDraft(project.id, sceneRef.current, revision);
      setRevision(result.revision);
      setSaveState(result.local ? '已保存（本地）' : '已保存');
    } catch (error) {
      if (error instanceof DraftConflictError) {
        // 远端已有更新的草稿：提示用户刷新，而不是静默降级覆盖。
        setSaveState('保存冲突');
        showToast('草稿已在其他窗口修改，请刷新页面加载最新版本');
      } else {
        setSaveState('保存失败');
        showToast(error instanceof Error ? error.message : '草稿保存失败');
      }
    }
  }, [project.id, revision, showToast]);

  // 离开编辑器（返回项目列表）前若仍有未保存变更，先补一次保存，避免切换页面丢数据。
  const saveStateRef = useRef(saveState);
  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);
  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);
  useEffect(
    () => () => {
      if (saveStateRef.current === '未保存') void handleSaveRef.current();
    },
    [],
  );

  const patchNodes = useCallback(
    (id: string, patch: Partial<SceneNode>) => {
      updateScene((current) => ({
        ...current,
        nodes: current.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
      }));
    },
    [updateScene],
  );

  const addNode = useCallback(
    (kind: NodeKind, position?: [number, number, number]) => {
      const node = createNode(kind, sceneRef.current.nodes.length, null, position);
      updateScene((current) => ({
        ...current,
        nodes: [...current.nodes, node],
      }));
      setSelectedId(node.id);
    },
    [updateScene],
  );

  const addNodeEventRule = useCallback(() => {
    const targetId = selectedIdRef.current ?? sceneRef.current.nodes[0]?.id ?? null;
    const target = sceneRef.current.nodes.find((node) => node.id === targetId);
    if (!targetId || !target) {
      showToast('请先添加或选择一个场景对象，再创建事件');
      return;
    }
    const rule: SceneEventRule = {
      id: `event-${uid()}`,
      name: `点击${target.name}显示信息`,
      enabled: true,
      scope: 'node',
      ownerNodeId: targetId,
      trigger: { type: 'click', nodeId: targetId },
      actions: [
        {
          id: `action-${uid()}`,
          type: 'showPopup',
          targetId,
          message: `${target.name}：请在这里配置业务说明。`,
          color: '#ff6b6b',
          visible: true,
        },
      ],
    };
    updateScene((current) => ({
      ...current,
      events: [...(current.events ?? []), rule],
    }));
    setInspectorTab('events');
  }, [showToast, updateScene]);

  const addSceneEventRule = useCallback(() => {
    const target = sceneRef.current.nodes.find((node) =>
      ['building', 'office', 'factory', 'warehouse'].includes(node.kind),
    );
    const action: SceneEventAction = target
      ? {
          id: `action-${uid()}`,
          type: 'focusCamera',
          targetId: target.id,
        }
      : {
          id: `action-${uid()}`,
          type: 'showPopup',
          targetId: null,
          message: '场景已加载，可以在这里配置全局说明。',
        };
    const rule: SceneEventRule = {
      id: `event-${uid()}`,
      name: '场景加载定位总览',
      enabled: true,
      scope: 'scene',
      ownerNodeId: null,
      trigger: { type: 'sceneLoad', nodeId: null },
      actions: [action],
    };
    updateScene((current) => ({
      ...current,
      events: [...(current.events ?? []), rule],
    }));
    setBottomTab('events');
    setBottomOpen(true);
  }, [updateScene]);

  const patchEventRule = useCallback(
    (id: string, patch: Partial<SceneEventRule>) => {
      updateScene((current) => ({
        ...current,
        events: (current.events ?? []).map((rule) =>
          rule.id === id ? { ...rule, ...patch } : rule,
        ),
      }));
    },
    [updateScene],
  );

  const patchEventAction = useCallback(
    (ruleId: string, actionId: string, patch: Partial<SceneEventAction>) => {
      updateScene((current) => ({
        ...current,
        events: (current.events ?? []).map((rule) =>
          rule.id === ruleId
            ? {
                ...rule,
                actions: rule.actions.map((action) =>
                  action.id === actionId ? { ...action, ...patch } : action,
                ),
              }
            : rule,
        ),
      }));
    },
    [updateScene],
  );

  const deleteEventRule = useCallback(
    (id: string) => {
      updateScene((current) => ({
        ...current,
        events: (current.events ?? []).filter((rule) => rule.id !== id),
      }));
    },
    [updateScene],
  );

  const patchTimeline = useCallback(
    (patch: Partial<Pick<SceneTimeline, 'duration' | 'loop'>>) => {
      updateScene((current) => ({
        ...current,
        timeline: normalizeTimeline({
          ...normalizeTimeline(current.timeline),
          ...patch,
        }),
      }));
    },
    [updateScene],
  );

  const addKeyframe = useCallback(
    (property: SceneTimelineProperty) => {
      const node = sceneRef.current.nodes.find((item) => item.id === selectedIdRef.current);
      if (!node) {
        showToast('请先选择一个场景对象，再添加关键帧');
        return;
      }
      updateScene((current) => {
        const currentTimeline = normalizeTimeline(current.timeline);
        const time = Math.min(timelineTime, currentTimeline.duration);
        const existing = currentTimeline.keyframes.find(
          (frame) =>
            frame.nodeId === node.id &&
            frame.property === property &&
            Math.abs(frame.time - time) < 0.01,
        );
        const keyframe = {
          id: existing?.id ?? `keyframe-${uid()}`,
          nodeId: node.id,
          time,
          property,
          value: propertyValue(node, property),
        };
        return {
          ...current,
          timeline: {
            ...currentTimeline,
            keyframes: [
              ...currentTimeline.keyframes.filter((frame) => frame.id !== existing?.id),
              keyframe,
            ].sort((a, b) => a.time - b.time),
          },
        };
      });
      showToast(
        `已在 ${formatTimelineTime(timelineTime)} 添加${timelinePropertyLabels[property]}关键帧`,
      );
    },
    [showToast, timelineTime, updateScene],
  );

  const deleteKeyframe = useCallback(
    (id: string) => {
      updateScene((current) => {
        const currentTimeline = normalizeTimeline(current.timeline);
        return {
          ...current,
          timeline: {
            ...currentTimeline,
            keyframes: currentTimeline.keyframes.filter((frame) => frame.id !== id),
          },
        };
      });
    },
    [updateScene],
  );

  const deleteSelected = useCallback(() => {
    const target = sceneRef.current.nodes.find((node) => node.id === selectedIdRef.current);
    if (!target) return;
    if (target.locked) {
      showToast(`「${target.name}」已锁定，请先解除锁定再删除`);
      return;
    }
    const removed = new Set([target.id]);
    let changed = true;
    while (changed) {
      changed = false;
      sceneRef.current.nodes.forEach((node) => {
        if (node.parentId && removed.has(node.parentId) && !removed.has(node.id)) {
          removed.add(node.id);
          changed = true;
        }
      });
    }
    updateScene((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => !removed.has(node.id)),
      events: (current.events ?? [])
        .map((rule) => ({
          ...rule,
          ownerNodeId:
            getEventScope(rule) === 'node' && rule.ownerNodeId && removed.has(rule.ownerNodeId)
              ? null
              : rule.ownerNodeId,
          trigger: {
            ...rule.trigger,
            nodeId:
              rule.trigger.nodeId && removed.has(rule.trigger.nodeId) ? null : rule.trigger.nodeId,
          },
          actions: rule.actions.filter(
            (action) => !action.targetId || !removed.has(action.targetId),
          ),
        }))
        .filter(
          (rule) =>
            rule.actions.length > 0 &&
            (getEventScope(rule) === 'scene' || getEventOwnerId(rule) !== null),
        ),
    }));
    setSelectedId(null);
  }, [showToast, updateScene]);

  const duplicateSelected = useCallback(() => {
    const source = sceneRef.current.nodes.find((node) => node.id === selectedIdRef.current);
    if (!source) return;
    const clone = {
      ...source,
      id: `${source.kind}-${uid()}`,
      name: `${source.name} 副本`,
      position: [source.position[0] + 1, source.position[1], source.position[2]] as [
        number,
        number,
        number,
      ],
    };
    updateScene((current) => ({
      ...current,
      nodes: [...current.nodes, clone],
    }));
    setSelectedId(clone.id);
  }, [updateScene]);

  const setNode = useCallback(
    (patch: Partial<SceneNode>) => {
      const id = selectedIdRef.current;
      if (!id) return;
      patchNodes(id, patch);
    },
    [patchNodes],
  );

  const addDataSource = useCallback(() => {
    const source: SceneDataSource = {
      id: `source-${uid()}`,
      name: `数据源 ${(sceneRef.current.dataSources?.length ?? 0) + 1}`,
      type: 'json',
      json: '{"value": 72}',
      refreshInterval: 10,
      timeout: 10,
    };
    updateScene((current) => ({
      ...current,
      dataSources: [...(current.dataSources ?? []), source],
    }));
    setDataSourceStatus('已添加数据源');
  }, [updateScene]);

  const patchDataSource = useCallback(
    (id: string, patch: Partial<SceneDataSource>) => {
      updateScene((current) => ({
        ...current,
        dataSources: (current.dataSources ?? []).map((source) =>
          source.id === id ? { ...source, ...patch } : source,
        ),
      }));
    },
    [updateScene],
  );

  const deleteDataSource = useCallback(
    (id: string) => {
      updateScene((current) => ({
        ...current,
        dataSources: (current.dataSources ?? []).filter((source) => source.id !== id),
        nodes: current.nodes.map((node) => ({
          ...node,
          dataBindings: node.dataBindings?.filter((binding) => binding.sourceId !== id),
        })),
      }));
    },
    [updateScene],
  );

  const addDataBinding = useCallback(
    (binding: Omit<SceneDataBinding, 'id'>) => {
      const id = selectedIdRef.current;
      if (!id) return;
      updateScene((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                dataBindings: [
                  ...(node.dataBindings ?? []).filter((item) => item.property !== binding.property),
                  { ...binding, id: `binding-${uid()}` },
                ],
              }
            : node,
        ),
      }));
    },
    [updateScene],
  );

  const deleteDataBinding = useCallback(
    (bindingId: string) => {
      const id = selectedIdRef.current;
      if (!id) return;
      updateScene((current) => ({
        ...current,
        nodes: current.nodes.map((node) =>
          node.id === id
            ? {
                ...node,
                dataBindings: node.dataBindings?.filter((binding) => binding.id !== bindingId),
              }
            : node,
        ),
      }));
    },
    [updateScene],
  );

  const handleUpload = useCallback(
    async (file: File) => {
      try {
        const asset = await uploadAsset(project.id, file);
        setAssets((current) => [...current.filter((item) => item.id !== asset.id), asset]);
        showToast(`已上传资源：${asset.name}`);
      } catch (error) {
        showToast(error instanceof Error ? error.message : '资源上传失败');
      }
    },
    [project.id, showToast],
  );

  const addAssetNode = useCallback(
    (asset: AssetMeta, position: [number, number, number] = [0, 0, 0]) => {
      const node = createNode(
        asset.kind === 'image' ? 'image' : 'model',
        sceneRef.current.nodes.length,
        null,
        position,
      );
      node.name = asset.name;
      node.assetPath = asset.url;
      updateScene((current) => ({ ...current, nodes: [...current.nodes, node] }));
      setSelectedId(node.id);
      showToast(`已将${asset.kind === 'image' ? '图片' : '模型'}添加到场景`);
    },
    [showToast, updateScene],
  );

  const dropAssetNode = useCallback(
    (assetId: string, position: [number, number, number]) => {
      const asset = assets.find((item) => item.id === assetId);
      if (asset) addAssetNode(asset, position);
    },
    [addAssetNode, assets],
  );

  const toggleVisible = useCallback(
    (id: string) => {
      const node = sceneRef.current.nodes.find((item) => item.id === id);
      if (node) patchNodes(id, { visible: !node.visible });
    },
    [patchNodes],
  );

  /** 撤销/重做后尽量保持当前选择，避免每次都跳到第一个节点。 */
  const applyHistoryScene = useCallback(
    (next: SceneDocument) => {
      commitScene(next);
      setSelectedId((id) =>
        id && next.nodes.some((node) => node.id === id) ? id : (next.nodes[0]?.id ?? null),
      );
      setSaveState('未保存');
    },
    [commitScene],
  );

  const undo = useCallback(() => {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    if (!isSceneSnapshot(previous)) {
      showToast('已忽略损坏的撤销记录，当前场景未发生变化');
      return;
    }
    setRedoStack((stack) => [...stack.slice(-49), sceneRef.current]);
    applyHistoryScene(previous);
  }, [applyHistoryScene, showToast, undoStack]);

  const redo = useCallback(() => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, -1));
    if (!isSceneSnapshot(next)) {
      showToast('已忽略损坏的重做记录，当前场景未发生变化');
      return;
    }
    setUndoStack((stack) => [...stack.slice(-49), sceneRef.current]);
    applyHistoryScene(next);
  }, [applyHistoryScene, redoStack, showToast]);

  const handleTransformStart = useCallback(() => {
    transformStartRef.current = sceneRef.current;
  }, []);

  const handleTransform = useCallback(
    (id: string, patch: Pick<SceneNode, 'position' | 'rotation' | 'scale'>, finished: boolean) => {
      commitScene({
        ...sceneRef.current,
        nodes: sceneRef.current.nodes.map((node) =>
          node.id === id ? { ...node, ...patch } : node,
        ),
      });
      setSaveState('未保存');
      const transformStart = transformStartRef.current;
      if (finished && transformStart) {
        // Capture before clearing the ref. React may execute the state updater asynchronously.
        setUndoStack((stack) => [...stack.slice(-49), transformStart]);
        setRedoStack([]);
        transformStartRef.current = null;
      }
    },
    [commitScene],
  );

  const logError = useCallback(
    (message: string, type: string = 'webgl') => {
      const error: RuntimeError = {
        id: uid(),
        type,
        message,
        createdAt: new Date().toISOString(),
      };
      setRuntimeErrors((current) => [error, ...current].slice(0, 20));
      void reportRuntimeError(project.id, error);
    },
    [project.id],
  );

  const openReleases = useCallback(async () => {
    setShowReleases(true);
    setReleases(await listReleases(project.id));
  }, [project.id]);

  const handlePublish = async () => {
    await handleSave();
    const release = await createRelease(project.id, sceneRef.current);
    setReleases((current) => [release, ...current]);
    setShowReleases(true);
    setSaveState('已发布');
  };

  /** 回滚即恢复历史版本内容并标记为未保存，走统一的自动保存链路持久化。 */
  const handleRollback = async (release: Release) => {
    setUndoStack((stack) => [...stack.slice(-49), sceneRef.current]);
    setRedoStack([]);
    applyHistoryScene(release.scene);
    setShowReleases(false);
    showToast(`已回滚到 ${release.version}，正在保存草稿`);
    await handleSave();
  };

  const iconFor = (kind: NodeKind): ReactNode => (
    <span className="tree-text-icon">
      {componentCatalog.find((item) => item.kind === kind)?.icon ?? '◇'}
    </span>
  );

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void handleSave();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if (event.key.toLowerCase() === 'w') setTransformMode('translate');
      if (event.key.toLowerCase() === 'e') setTransformMode('rotate');
      if (event.key.toLowerCase() === 'r') setTransformMode('scale');
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedIdRef.current)
        deleteSelected();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [deleteSelected, handleSave, redo, undo]);

  if (isRuntime)
    return (
      <RuntimeView
        project={project}
        scene={scene}
        onExit={() => setIsRuntime(false)}
        onError={logError}
      />
    );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Rotate3d size={18} />
          </div>
          <div>
            <strong>3D Vision</strong>
            <span>场景工作台</span>
          </div>
        </div>
        <div className="project-title">
          <button className="crumb-link" onClick={onExit} title="返回项目列表">
            我的项目
          </button>
          <span className="crumb">/</span>
          <strong>{project.name}</strong>
          <span className="saved-dot" data-state={saveState} /> <small>{saveState}</small>
        </div>
        <div className="toolbar-actions">
          <button
            className="icon-button"
            onClick={undo}
            disabled={!undoStack.length}
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 size={16} />
          </button>
          <button
            className="icon-button"
            onClick={redo}
            disabled={!redoStack.length}
            title="重做 (Ctrl+Shift+Z)"
          >
            <Redo2 size={16} />
          </button>
          <span className="divider" />
          <button className="tool-button" onClick={() => setIsRuntime(true)}>
            <Play size={15} /> 预览
          </button>
          <button className="primary-button" onClick={() => void handlePublish()}>
            <Zap size={15} /> 发布
          </button>
          <button className="avatar" title="当前用户">
            陈
          </button>
        </div>
      </header>
      <main className="editor-body">
        <aside className="left-panel">
          <div className="panel-tabs">
            <button
              className={activeTab === 'components' ? 'active' : ''}
              onClick={() => setActiveTab('components')}
            >
              <Package size={15} />
              组件
            </button>
            <button
              className={activeTab === 'assets' ? 'active' : ''}
              onClick={() => setActiveTab('assets')}
            >
              <Upload size={15} />
              资源
            </button>
          </div>
          {activeTab === 'components' ? (
            <>
              <div className="search-box">
                <Search size={15} />
                <input
                  placeholder="搜索组件"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
              <CategoryScroller
                categories={componentCategories}
                value={category}
                onChange={setCategory}
              />
              <div className="component-grid">
                {filtered.map((item) => (
                  <button
                    className="component-card"
                    key={item.kind}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'copy';
                      event.dataTransfer.setData('component-kind', item.kind);
                    }}
                    onClick={() => addNode(item.kind)}
                  >
                    <span className="component-icon">{item.icon}</span>
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <span className="add-hint">+</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="asset-panel">
              <input
                ref={fileInputRef}
                type="file"
                accept=".glb,.gltf,.png,.jpg,.jpeg,.webp,model/gltf-binary,model/gltf+json,image/png,image/jpeg"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void handleUpload(file);
                }}
              />
              <button
                className="outline-button asset-upload-button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} />
                上传资源
              </button>
              {assets.length ? (
                <div className="asset-list">
                  {assets.map((asset) => (
                    <button
                      className="asset-card"
                      key={asset.id}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'copy';
                        event.dataTransfer.setData('asset-id', asset.id);
                      }}
                      onClick={() => addAssetNode(asset)}
                      title="点击添加，或拖到画布指定位置"
                    >
                      <span className="asset-preview" aria-hidden="true">
                        {asset.kind === 'image' ? <img src={asset.url} alt="" /> : <span>3D</span>}
                      </span>
                      <span className="asset-copy">
                        <strong>{asset.name}</strong>
                        <small>{formatBytes(asset.size)} · 点击或拖拽添加</small>
                      </span>
                      <Plus size={14} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="asset-empty">
                  <Upload size={24} />
                  <strong>暂无本地资源</strong>
                  <span>支持 GLB、GLTF、PNG、JPG、WebP</span>
                </div>
              )}
            </div>
          )}
          <div className="panel-section-title">
            <span>场景树</span>
            <span className="tree-count">{scene.nodes.length}</span>
          </div>
          <div className="scene-tree">
            <Tree
              nodes={scene.nodes}
              parentId={null}
              level={0}
              selectedId={selectedId}
              collapsedIds={collapsedIds}
              onSelect={setSelectedId}
              onToggleVisible={toggleVisible}
              onToggleCollapsed={(id) =>
                setCollapsedIds((prev) => {
                  const next = new Set(prev);
                  next.has(id) ? next.delete(id) : next.add(id);
                  return next;
                })
              }
              iconFor={iconFor}
            />
          </div>
        </aside>
        <section className="canvas-column">
          <div className="canvas-toolbar">
            <div className="canvas-modes">
              <button
                className={transformMode === 'translate' ? 'active' : ''}
                onClick={() => setTransformMode('translate')}
                title="移动对象 (W)"
              >
                <MousePointer2 size={14} />
                移动
              </button>
              <button
                className={transformMode === 'rotate' ? 'active' : ''}
                onClick={() => setTransformMode('rotate')}
                title="旋转对象 (E)"
              >
                <Rotate3d size={14} />
                旋转
              </button>
              <button
                className={transformMode === 'scale' ? 'active' : ''}
                onClick={() => setTransformMode('scale')}
                title="缩放对象 (R)"
              >
                <Square size={14} />
                缩放
              </button>
              <button
                className={gridVisible ? 'active' : ''}
                onClick={() => setGridVisible(!gridVisible)}
              >
                <Grid3X3 size={14} />
                网格
              </button>
            </div>
            <div className="canvas-status">
              <span className="status-live">
                <span /> LIVE
              </span>
              <span>节点 {scene.nodes.length}</span>
              <button
                className="icon-button"
                title="导出场景 JSON"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(scene, null, 2)], {
                    type: 'application/json',
                  });
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = 'scene.json';
                  link.click();
                  URL.revokeObjectURL(link.href);
                }}
              >
                <Download size={15} />
              </button>
              <span className="canvas-divider" />
              <button
                className="tool-button canvas-orchestration-button"
                onClick={() => setBottomOpen(!bottomOpen)}
              >
                <History size={15} /> 场景编排{' '}
                {sceneEvents.length > 0 ? `(${sceneEvents.length})` : ''}
              </button>
            </div>
          </div>
          <div className="canvas-host">
            <SceneCanvas
              nodes={canvasNodes}
              cameraView={cameraView}
              selectedId={selectedId}
              mode={transformMode}
              gridVisible={gridVisible}
              onSelect={setSelectedId}
              onDropKind={addNode}
              onDropAsset={dropAssetNode}
              onTransformStart={handleTransformStart}
              onTransform={handleTransform}
              onRuntimeError={logError}
            />
            <div className="canvas-help">
              <span>拖拽组件到画布</span>
              <span>左键选择/拖动 Gizmo</span>
              <span>右键旋转视角</span>
              <span>滚轮缩放</span>
            </div>
            <div className="axis-widget">
              <span className="axis-x">X</span>
              <span className="axis-y">Y</span>
              <span className="axis-z">Z</span>
              <div />
            </div>
          </div>
          {bottomOpen && (
            <BottomPanel
              tab={bottomTab}
              setTab={setBottomTab}
              scope="scene"
              nodes={scene.nodes}
              selectedId={selectedId}
              events={sceneEvents}
              onAddEvent={addSceneEventRule}
              onPatchRule={patchEventRule}
              onPatchAction={patchEventAction}
              onDeleteEvent={deleteEventRule}
              timeline={timeline}
              timelineTime={timelineTime}
              timelinePlaying={timelinePlaying}
              onTimelineTimeChange={setTimelineTime}
              onTimelinePlayingChange={setTimelinePlaying}
              onPatchTimeline={patchTimeline}
              onAddKeyframe={addKeyframe}
              onDeleteKeyframe={deleteKeyframe}
            />
          )}
        </section>
        <aside className="right-panel">
          <div className="right-panel-head">
            <h2>{selected ? selected.name : '未选择对象'}</h2>
            {selected && (
              <button
                className="icon-button"
                onClick={deleteSelected}
                title={selected.locked ? '对象已锁定' : '删除节点'}
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {selected ? (
            <>
              <div className="inspector-tabs">
                <button
                  className={inspectorTab === 'properties' ? 'active' : ''}
                  onClick={() => setInspectorTab('properties')}
                >
                  属性
                </button>
                <button
                  className={inspectorTab === 'data' ? 'active' : ''}
                  onClick={() => setInspectorTab('data')}
                >
                  数据
                </button>
                <button
                  className={inspectorTab === 'events' ? 'active' : ''}
                  onClick={() => {
                    setInspectorTab('events');
                  }}
                >
                  对象事件 {eventCount ? eventCount : ''}
                </button>
              </div>
              {inspectorTab === 'properties' ? (
                <Inspector selected={selected} setNode={setNode} />
              ) : inspectorTab === 'data' ? (
                <DataSourcePanel
                  selected={selected}
                  sources={scene.dataSources ?? []}
                  status={dataSourceStatus}
                  onAddSource={addDataSource}
                  onPatchSource={patchDataSource}
                  onDeleteSource={deleteDataSource}
                  onAddBinding={addDataBinding}
                  onDeleteBinding={deleteDataBinding}
                  onTestSource={async (source) => {
                    setDataSourceStatus('测试中…');
                    try {
                      await testDataSource(source);
                      setDataSourceStatus('连接成功');
                    } catch (error) {
                      setDataSourceStatus(error instanceof Error ? error.message : '连接失败');
                    }
                  }}
                />
              ) : (
                <EventRuleList
                  scope="node"
                  nodes={scene.nodes}
                  selectedId={selectedId}
                  events={objectEvents}
                  onAddEvent={addNodeEventRule}
                  onPatchRule={patchEventRule}
                  onPatchAction={patchEventAction}
                  onDeleteEvent={deleteEventRule}
                />
              )}
            </>
          ) : (
            <div className="inspector-empty">
              <MousePointer2 size={24} />
              <strong>选择一个场景对象</strong>
              <span>在画布或场景树中选择对象后编辑属性</span>
            </div>
          )}
          <div className="right-footer">
            <button className="outline-button" onClick={duplicateSelected}>
              <Copy size={14} />
              复制对象
            </button>
            <button className="outline-button" onClick={() => void openReleases()}>
              <History size={14} />
              发布记录
            </button>
          </div>
        </aside>
      </main>
      {showReleases && (
        <ReleaseDrawer
          releases={releases}
          errors={runtimeErrors}
          onClose={() => setShowReleases(false)}
          onRollback={(release) => void handleRollback(release)}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/** 组件分类横向滚动条：两端箭头按钮滚动，滚动到边界时对应箭头置灰。 */
function CategoryScroller({
  categories,
  value,
  onChange,
}: {
  categories: readonly string[];
  value: string;
  onChange: (category: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateArrows]);

  const scrollBy = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: direction * 96, behavior: 'smooth' });
  };

  return (
    <div className="category-list">
      <button
        className="category-arrow"
        disabled={!canLeft}
        onClick={() => scrollBy(-1)}
        title="向左滚动分类"
      >
        <ChevronLeft size={14} />
      </button>
      <div className="category-scroll" ref={scrollRef} onScroll={updateArrows}>
        {categories.map((item) => (
          <button
            className={`category-item ${value === item ? 'selected' : ''}`}
            key={item}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <button
        className="category-arrow"
        disabled={!canRight}
        onClick={() => scrollBy(1)}
        title="向右滚动分类"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

function Tree({
  nodes,
  parentId,
  level,
  selectedId,
  collapsedIds,
  onSelect,
  onToggleVisible,
  onToggleCollapsed,
  iconFor,
}: {
  nodes: SceneNode[];
  parentId: string | null;
  level: number;
  selectedId: string | null;
  collapsedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  iconFor: (kind: NodeKind) => ReactNode;
}) {
  return (
    <>
      {nodes
        .filter((node) => node.parentId === parentId)
        .map((node) => {
          const hasChildren = nodes.some((item) => item.parentId === node.id);
          const collapsed = collapsedIds.has(node.id);
          return (
            <div key={node.id}>
              <div className={`tree-row ${selectedId === node.id ? 'selected' : ''}`}>
                {hasChildren ? (
                  <button
                    className="tree-caret"
                    title={collapsed ? '展开子节点' : '折叠子节点'}
                    aria-expanded={!collapsed}
                    onClick={() => onToggleCollapsed(node.id)}
                  >
                    {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </button>
                ) : (
                  <span className="tree-spacer" />
                )}
                <button
                  className="tree-main"
                  style={{ paddingLeft: level * 16 }}
                  onClick={() => onSelect(node.id)}
                >
                  {iconFor(node.kind)}
                  <span>{node.name}</span>
                </button>
                <button
                  className={`tree-action ${node.visible ? '' : 'muted'}`}
                  title={node.visible ? '隐藏对象' : '显示对象'}
                  onClick={() => onToggleVisible(node.id)}
                >
                  {node.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
              </div>
              {hasChildren && !collapsed && (
                <Tree
                  nodes={nodes}
                  parentId={node.id}
                  level={level + 1}
                  selectedId={selectedId}
                  collapsedIds={collapsedIds}
                  onSelect={onSelect}
                  onToggleVisible={onToggleVisible}
                  onToggleCollapsed={onToggleCollapsed}
                  iconFor={iconFor}
                />
              )}
            </div>
          );
        })}
    </>
  );
}

function Inspector({
  selected,
  setNode,
}: {
  selected: SceneNode;
  setNode: (patch: Partial<SceneNode>) => void;
}) {
  const number = (value: number, onChange: (value: number) => void) => (
    <input
      type="number"
      value={value}
      step="0.1"
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
  return (
    <div className="inspector-body">
      <label className="field-label">
        名称
        <input value={selected.name} onChange={(event) => setNode({ name: event.target.value })} />
      </label>
      <div className="field-section">
        <div className="section-label">
          <span>变换</span>
          <span className="section-tag">WORLD</span>
        </div>
        {(['position', 'rotation', 'scale'] as const).map((key) => (
          <div className="vector-field" key={key}>
            <span>{key === 'position' ? '位置' : key === 'rotation' ? '旋转' : '缩放'}</span>
            {selected[key].map((value, index) => (
              <div className={`number-wrap ${['x', 'y', 'z'][index]}`} key={`${key}-${index}`}>
                {number(value, (next) => {
                  const vector = [...selected[key]] as [number, number, number];
                  vector[index] = next;
                  setNode({ [key]: vector });
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="field-section">
        <div className="section-label">
          <span>外观</span>
          <Settings2 size={14} />
        </div>
        <label className="field-label">
          颜色
          <div className="color-input">
            <input
              type="color"
              value={selected.color ?? '#34d399'}
              onChange={(event) => setNode({ color: event.target.value })}
            />
            <input
              value={selected.color ?? '#34d399'}
              onChange={(event) => setNode({ color: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          透明度
          <div className="range-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={selected.opacity ?? 1}
              onChange={(event) => setNode({ opacity: Number(event.target.value) })}
            />
            <span>{Math.round((selected.opacity ?? 1) * 100)}%</span>
          </div>
        </label>
        {(selected.kind === 'text' || selected.kind === 'label' || selected.kind === 'popup') && (
          <label className="field-label">
            文本
            <input
              value={selected.text ?? ''}
              onChange={(event) => setNode({ text: event.target.value })}
            />
          </label>
        )}
        {(selected.kind === 'bar' || selected.kind === 'label') && (
          <label className="field-label">
            数据值
            <div className="range-row">
              <input
                type="range"
                min="0"
                max="100"
                value={selected.value ?? 50}
                onChange={(event) => setNode({ value: Number(event.target.value) })}
              />
              <span>{selected.value ?? 50}</span>
            </div>
          </label>
        )}
      </div>
      <label className="toggle-row">
        <span>可见</span>
        <input
          type="checkbox"
          checked={selected.visible}
          onChange={(event) => setNode({ visible: event.target.checked })}
        />
      </label>
      <label className="toggle-row">
        <span>锁定</span>
        <input
          type="checkbox"
          checked={selected.locked}
          onChange={(event) => setNode({ locked: event.target.checked })}
        />
      </label>
    </div>
  );
}

/** 底部场景编排区：时间轴和场景级事件都作用于整个画布。 */
function DataSourcePanel({
  selected,
  sources,
  status,
  onAddSource,
  onPatchSource,
  onDeleteSource,
  onAddBinding,
  onDeleteBinding,
  onTestSource,
}: {
  selected: SceneNode;
  sources: SceneDataSource[];
  status: string | null;
  onAddSource: () => void;
  onPatchSource: (id: string, patch: Partial<SceneDataSource>) => void;
  onDeleteSource: (id: string) => void;
  onAddBinding: (binding: Omit<SceneDataBinding, 'id'>) => void;
  onDeleteBinding: (id: string) => void;
  onTestSource: (source: SceneDataSource) => Promise<void>;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [path, setPath] = useState('value');
  const [property, setProperty] = useState<SceneDataBindingProperty>('value');
  const source = sources.find((item) => item.id === sourceId) ?? sources[0];
  useEffect(() => {
    if (source && !sources.some((item) => item.id === sourceId)) setSourceId(source.id);
  }, [source, sourceId, sources]);
  return (
    <div className="inspector-body data-source-panel">
      <div className="data-source-head">
        <span className="section-label">数据源</span>
        <button className="icon-button" onClick={onAddSource} title="添加数据源">
          <Plus size={14} />
        </button>
      </div>
      {sources.length ? (
        <>
          <select value={source?.id ?? ''} onChange={(event) => setSourceId(event.target.value)}>
            {sources.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {source && (
            <>
              <label className="field-label">
                名称
                <input
                  value={source.name}
                  onChange={(event) => onPatchSource(source.id, { name: event.target.value })}
                />
              </label>
              <label className="field-label">
                类型
                <select
                  value={source.type}
                  onChange={(event) =>
                    onPatchSource(source.id, {
                      type: event.target.value as SceneDataSource['type'],
                    })
                  }
                >
                  <option value="json">静态 JSON</option>
                  <option value="rest">REST GET</option>
                  <option value="websocket">WebSocket</option>
                </select>
              </label>
              {source.type === 'json' ? (
                <label className="field-label">
                  JSON
                  <textarea
                    value={source.json ?? ''}
                    onChange={(event) => onPatchSource(source.id, { json: event.target.value })}
                    rows={4}
                  />
                </label>
              ) : (
                <label className="field-label">
                  地址
                  <input
                    value={source.url ?? ''}
                    onChange={(event) => onPatchSource(source.id, { url: event.target.value })}
                    placeholder={source.type === 'websocket' ? 'wss://...' : 'https://...'}
                  />
                </label>
              )}
              <label className="field-label">
                刷新间隔（秒）
                <input
                  type="number"
                  min="1"
                  max="3600"
                  value={source.refreshInterval ?? 10}
                  onChange={(event) =>
                    onPatchSource(source.id, { refreshInterval: Number(event.target.value) })
                  }
                />
              </label>
              <div className="data-source-actions">
                <button className="outline-button" onClick={() => void onTestSource(source)}>
                  测试连接
                </button>
                <button
                  className="icon-button"
                  onClick={() => onDeleteSource(source.id)}
                  title="删除数据源"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {status && <div className="data-source-status">{status}</div>}
              <div className="field-section">
                <div className="section-label">
                  <span>绑定到当前对象</span>
                </div>
                <label className="field-label">
                  数据路径
                  <input
                    value={path}
                    onChange={(event) => setPath(event.target.value)}
                    placeholder="data.value"
                  />
                </label>
                <label className="field-label">
                  目标属性
                  <select
                    value={property}
                    onChange={(event) =>
                      setProperty(event.target.value as SceneDataBindingProperty)
                    }
                  >
                    <option value="value">数值</option>
                    <option value="text">文本</option>
                    <option value="color">颜色</option>
                    <option value="opacity">透明度</option>
                    <option value="visible">可见性</option>
                  </select>
                </label>
                <button
                  className="outline-button"
                  onClick={() =>
                    onAddBinding({ sourceId: source.id, path: path.trim() || 'value', property })
                  }
                >
                  添加绑定
                </button>
                <div className="binding-list">
                  {(selected.dataBindings ?? []).map((binding) => (
                    <div className="binding-row" key={binding.id}>
                      <span>
                        {binding.property} ← {binding.path}
                      </span>
                      <button
                        className="icon-button"
                        onClick={() => onDeleteBinding(binding.id)}
                        title="删除绑定"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="inspector-empty">
          <strong>暂无数据源</strong>
          <span>点击右上角添加 JSON 或 REST 数据源</span>
        </div>
      )}
    </div>
  );
}

function resolveDataPath(value: unknown, path: string): unknown {
  if (!path.trim()) return value;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
    if (typeof current === 'object') return (current as Record<string, unknown>)[key];
    return undefined;
  }, value);
}

function BottomPanel({
  tab,
  setTab,
  scope,
  nodes,
  selectedId,
  events,
  onAddEvent,
  onPatchRule,
  onPatchAction,
  onDeleteEvent,
  timeline,
  timelineTime,
  timelinePlaying,
  onTimelineTimeChange,
  onTimelinePlayingChange,
  onPatchTimeline,
  onAddKeyframe,
  onDeleteKeyframe,
}: {
  tab: 'timeline' | 'events';
  setTab: (tab: 'timeline' | 'events') => void;
  scope: SceneEventScope;
  nodes: SceneNode[];
  selectedId: string | null;
  events: SceneEventRule[];
  onAddEvent: () => void;
  onPatchRule: (id: string, patch: Partial<SceneEventRule>) => void;
  onPatchAction: (ruleId: string, actionId: string, patch: Partial<SceneEventAction>) => void;
  onDeleteEvent: (id: string) => void;
  timeline: SceneTimeline;
  timelineTime: number;
  timelinePlaying: boolean;
  onTimelineTimeChange: (time: number) => void;
  onTimelinePlayingChange: (playing: boolean) => void;
  onPatchTimeline: (patch: Partial<Pick<SceneTimeline, 'duration' | 'loop'>>) => void;
  onAddKeyframe: (property: SceneTimelineProperty) => void;
  onDeleteKeyframe: (id: string) => void;
}) {
  const [timelineProperty, setTimelineProperty] = useState<SceneTimelineProperty>('position');
  const selectedName = nodes.find((node) => node.id === selectedId)?.name ?? null;
  const selectedFrames = timeline.keyframes.filter((frame) => frame.nodeId === selectedId);
  return (
    <div className="bottom-panel">
      <div className="bottom-head">
        <div className="bottom-tabs">
          <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>
            <History size={14} />
            场景时间轴
          </button>
          <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>
            <Zap size={14} />
            场景事件
          </button>
        </div>
        <span className="muted-text">
          {tab === 'events'
            ? `场景事件规则 ${events.length} 条`
            : `关键帧 ${timeline.keyframes.length} 个 · ${timeline.duration.toFixed(1)} 秒`}
        </span>
      </div>
      {tab === 'timeline' ? (
        <div className="timeline">
          <div className="timeline-controls">
            <button
              className="play-button"
              disabled={!timeline.keyframes.length}
              title={timelinePlaying ? '暂停时间轴' : '播放时间轴'}
              onClick={() => onTimelinePlayingChange(!timelinePlaying)}
            >
              {timelinePlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <span>{formatTimelineTime(timelineTime)}</span>
            <div className="timeline-track timeline-track-live">
              <input
                aria-label="时间轴播放位置"
                type="range"
                min="0"
                max={timeline.duration}
                step="0.01"
                value={timelineTime}
                onChange={(event) => {
                  onTimelinePlayingChange(false);
                  onTimelineTimeChange(Number(event.target.value));
                }}
              />
              <div
                className="timeline-playhead"
                style={{ left: `${(timelineTime / timeline.duration) * 100}%` }}
              />
              {timeline.keyframes.map((frame) => (
                <button
                  key={frame.id}
                  className={`timeline-marker ${frame.nodeId === selectedId ? 'selected' : ''}`}
                  style={{ left: `${(frame.time / timeline.duration) * 100}%` }}
                  title={`${nodes.find((node) => node.id === frame.nodeId)?.name ?? '未知对象'} · ${timelinePropertyLabels[frame.property]} · ${formatTimelineTime(frame.time)}`}
                  onClick={() => {
                    onTimelinePlayingChange(false);
                    onTimelineTimeChange(frame.time);
                  }}
                />
              ))}
            </div>
            <span>{formatTimelineTime(timeline.duration)}</span>
            <label className="timeline-duration">
              时长
              <input
                aria-label="场景时长"
                type="number"
                min="1"
                max="3600"
                step="1"
                value={timeline.duration}
                onChange={(event) => onPatchTimeline({ duration: Number(event.target.value) })}
              />
            </label>
            <label className="timeline-loop">
              <input
                type="checkbox"
                checked={timeline.loop}
                onChange={(event) => onPatchTimeline({ loop: event.target.checked })}
              />
              循环
            </label>
          </div>
          <div className="timeline-editor-row">
            <div className="timeline-object">
              <strong>{selectedName ?? '未选择对象'}</strong>
              <span>
                {selectedName
                  ? `当前对象关键帧 ${selectedFrames.length} 个`
                  : '请在画布或场景树中选择对象'}
              </span>
            </div>
            <select
              aria-label="关键帧属性"
              value={timelineProperty}
              onChange={(event) => setTimelineProperty(event.target.value as SceneTimelineProperty)}
            >
              {Object.entries(timelinePropertyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className="add-keyframe"
              disabled={!selectedId}
              onClick={() => onAddKeyframe(timelineProperty)}
            >
              <Plus size={14} />
              在当前时间添加关键帧
            </button>
            <div className="keyframe-chips">
              {selectedFrames.length ? (
                selectedFrames.map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => onTimelineTimeChange(frame.time)}
                    title="点击定位；使用右侧删除按钮移除关键帧"
                  >
                    <span>{formatTimelineTime(frame.time)}</span>
                    <span>{timelinePropertyLabels[frame.property]}</span>
                    <i
                      role="button"
                      aria-label="删除关键帧"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteKeyframe(frame.id);
                      }}
                    >
                      <Trash2 size={11} />
                    </i>
                  </button>
                ))
              ) : (
                <span className="timeline-hint">选择属性并在当前时间记录对象状态</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="event-list">
          <div className="event-toolbar">
            <span>场景级规则在预览中按场景加载或全局触发条件执行</span>
            <button className="add-event" onClick={onAddEvent}>
              <Zap size={14} />
              添加场景事件
            </button>
          </div>
          {events.length ? (
            <div className="event-rule-list">
              {events.map((rule) => {
                const action = rule.actions[0] ?? {
                  id: `action-${rule.id}`,
                  type: 'showPopup' as SceneEventActionType,
                  targetId: rule.trigger.nodeId,
                };
                return (
                  <div className="event-rule-card" key={rule.id}>
                    <div className="event-rule-head">
                      <label className="event-enable">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(event) =>
                            onPatchRule(rule.id, { enabled: event.target.checked })
                          }
                        />
                        启用
                      </label>
                      <input
                        aria-label="事件名称"
                        value={rule.name}
                        onChange={(event) => onPatchRule(rule.id, { name: event.target.value })}
                      />
                      <button className="icon-button" onClick={() => onDeleteEvent(rule.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="event-form-grid">
                      <label>
                        触发方式
                        <select
                          value={rule.trigger.type}
                          onChange={(event) =>
                            onPatchRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                type: event.target.value as SceneEventTriggerType,
                              },
                            })
                          }
                        >
                          {Object.entries(
                            scope === 'scene' ? sceneTriggerLabels : nodeTriggerLabels,
                          ).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        触发对象
                        <select
                          value={rule.trigger.nodeId ?? ''}
                          disabled={rule.trigger.type === 'sceneLoad'}
                          onChange={(event) =>
                            onPatchRule(rule.id, {
                              trigger: { ...rule.trigger, nodeId: event.target.value || null },
                            })
                          }
                        >
                          <option value="">全场景</option>
                          {nodes.map((node) => (
                            <option key={node.id} value={node.id}>
                              {node.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        执行动作
                        <select
                          value={action.type}
                          onChange={(event) =>
                            onPatchAction(rule.id, action.id, {
                              type: event.target.value as SceneEventActionType,
                            })
                          }
                        >
                          {Object.entries(actionLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        动作对象
                        <select
                          value={action.targetId ?? ''}
                          onChange={(event) =>
                            onPatchAction(rule.id, action.id, {
                              targetId: event.target.value || null,
                            })
                          }
                        >
                          <option value="">同触发对象</option>
                          {nodes.map((node) => (
                            <option key={node.id} value={node.id}>
                              {node.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {action.type === 'showPopup' && (
                        <label className="event-form-wide">
                          弹窗内容
                          <input
                            value={action.message ?? ''}
                            onChange={(event) =>
                              onPatchAction(rule.id, action.id, { message: event.target.value })
                            }
                          />
                        </label>
                      )}
                      {action.type === 'setColor' && (
                        <label>
                          目标颜色
                          <input
                            type="color"
                            value={action.color ?? '#ff6b6b'}
                            onChange={(event) =>
                              onPatchAction(rule.id, action.id, { color: event.target.value })
                            }
                          />
                        </label>
                      )}
                      {action.type === 'setVisibility' && (
                        <label>
                          可见状态
                          <select
                            value={String(action.visible ?? true)}
                            onChange={(event) =>
                              onPatchAction(rule.id, action.id, {
                                visible: event.target.value === 'true',
                              })
                            }
                          >
                            <option value="true">显示</option>
                            <option value="false">隐藏</option>
                          </select>
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="timeline-empty">
              <Sparkles size={18} />
              点击“添加场景事件”配置场景加载后的相机定位或全局动作
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 对象事件面板：只展示当前选中节点归属的规则，避免与场景级规则混在一起。 */
function EventRuleList({
  scope,
  nodes,
  selectedId,
  events,
  onAddEvent,
  onPatchRule,
  onPatchAction,
  onDeleteEvent,
}: {
  scope: SceneEventScope;
  nodes: SceneNode[];
  selectedId: string | null;
  events: SceneEventRule[];
  onAddEvent: () => void;
  onPatchRule: (id: string, patch: Partial<SceneEventRule>) => void;
  onPatchAction: (ruleId: string, actionId: string, patch: Partial<SceneEventAction>) => void;
  onDeleteEvent: (id: string) => void;
}) {
  const selectedName = nodes.find((node) => node.id === selectedId)?.name ?? '当前对象';
  const labels = scope === 'scene' ? sceneTriggerLabels : nodeTriggerLabels;
  return (
    <div className="object-event-panel">
      <div className="event-toolbar">
        <span>
          {scope === 'scene'
            ? '场景级规则作用于整个画布，可控制相机或多个对象'
            : `${selectedName} 的点击、双击和悬停交互`}
        </span>
        <button className="add-event" onClick={onAddEvent}>
          <Zap size={14} />
          {scope === 'scene' ? '添加场景事件' : '添加对象事件'}
        </button>
      </div>
      {events.length ? (
        <div className="event-rule-list">
          {events.map((rule) => {
            const action = rule.actions[0] ?? {
              id: `action-${rule.id}`,
              type: 'showPopup' as SceneEventActionType,
              targetId: rule.trigger.nodeId ?? rule.ownerNodeId,
            };
            const triggerNodeId = rule.trigger.nodeId ?? rule.ownerNodeId;
            return (
              <div className="event-rule-card" key={rule.id}>
                <div className="event-rule-head">
                  <label className="event-enable">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(event) => onPatchRule(rule.id, { enabled: event.target.checked })}
                    />
                    启用
                  </label>
                  <input
                    aria-label="事件名称"
                    value={rule.name}
                    onChange={(event) => onPatchRule(rule.id, { name: event.target.value })}
                  />
                  <button
                    className="icon-button"
                    title="删除事件"
                    onClick={() => onDeleteEvent(rule.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="event-form-grid">
                  <label>
                    触发方式
                    <select
                      value={rule.trigger.type}
                      onChange={(event) =>
                        onPatchRule(rule.id, {
                          trigger: {
                            ...rule.trigger,
                            type: event.target.value as SceneEventTriggerType,
                            nodeId: event.target.value === 'sceneLoad' ? null : rule.trigger.nodeId,
                          },
                        })
                      }
                    >
                      {Object.entries(labels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    触发对象
                    <select
                      value={triggerNodeId ?? ''}
                      disabled={scope === 'node' || rule.trigger.type === 'sceneLoad'}
                      onChange={(event) =>
                        onPatchRule(rule.id, {
                          trigger: { ...rule.trigger, nodeId: event.target.value || null },
                        })
                      }
                    >
                      <option value="">{scope === 'scene' ? '整个场景' : selectedName}</option>
                      {scope === 'scene' &&
                        nodes.map((node) => (
                          <option key={node.id} value={node.id}>
                            {node.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    执行动作
                    <select
                      value={action.type}
                      onChange={(event) =>
                        onPatchAction(rule.id, action.id, {
                          type: event.target.value as SceneEventActionType,
                        })
                      }
                    >
                      {Object.entries(actionLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    动作对象
                    <select
                      value={action.targetId ?? ''}
                      onChange={(event) =>
                        onPatchAction(rule.id, action.id, {
                          targetId: event.target.value || null,
                        })
                      }
                    >
                      <option value="">同触发对象</option>
                      {nodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {action.type === 'showPopup' && (
                    <label className="event-form-wide">
                      弹窗内容
                      <input
                        value={action.message ?? ''}
                        onChange={(event) =>
                          onPatchAction(rule.id, action.id, { message: event.target.value })
                        }
                      />
                    </label>
                  )}
                  {action.type === 'setColor' && (
                    <label>
                      目标颜色
                      <input
                        type="color"
                        value={action.color ?? '#ff6b6b'}
                        onChange={(event) =>
                          onPatchAction(rule.id, action.id, { color: event.target.value })
                        }
                      />
                    </label>
                  )}
                  {action.type === 'setVisibility' && (
                    <label>
                      可见状态
                      <select
                        value={String(action.visible ?? true)}
                        onChange={(event) =>
                          onPatchAction(rule.id, action.id, {
                            visible: event.target.value === 'true',
                          })
                        }
                      >
                        <option value="true">显示</option>
                        <option value="false">隐藏</option>
                      </select>
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="timeline-empty">
          <Sparkles size={18} />
          {scope === 'scene'
            ? '暂无场景事件，点击“添加场景事件”创建全局规则'
            : '暂无对象事件，点击“添加对象事件”配置当前对象交互'}
        </div>
      )}
    </div>
  );
}

function RuntimeView({
  project,
  scene,
  onExit,
  onError,
}: {
  project: ProjectMeta;
  scene: SceneDocument;
  onExit: () => void;
  onError: (message: string) => void;
}) {
  const theme = project.runtime ?? {
    eyebrow: 'LIVE VIEW',
    tagline: '实时运行视图 · 指标为示例数据',
    metrics: [
      { label: '在线设备', value: '1,284', delta: '+12.4%' },
      { label: '今日能耗', value: '86.4 MWh', delta: '-3.2%' },
      { label: '环境指数', value: '92', delta: '良好' },
    ],
  };
  const today = new Date().toLocaleDateString('zh-CN');
  const [runtimeOverrides, setRuntimeOverrides] = useState<
    Record<string, Partial<Pick<SceneNode, 'color' | 'visible' | 'opacity' | 'value' | 'text'>>>
  >({});
  const [focusRequest, setFocusRequest] = useState<CameraFocusRequest | null>(null);
  const [runtimePopup, setRuntimePopup] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [runtimeTimelineTime, setRuntimeTimelineTime] = useState(0);
  const runtimeTimeline = useMemo(() => normalizeTimeline(scene.timeline), [scene.timeline]);
  const animatedNodes = useMemo(
    () => applyTimeline(scene, runtimeTimelineTime),
    [scene, runtimeTimelineTime],
  );
  const runtimeCameraView = useMemo(
    () => applyCameraTimeline(scene, runtimeTimelineTime),
    [scene, runtimeTimelineTime],
  );
  const focusClearTimerRef = useRef<number | undefined>(undefined);
  const nodeById = useMemo(
    () => new Map(scene.nodes.map((node) => [node.id, node])),
    [scene.nodes],
  );

  const runRule = useCallback(
    (rule: SceneEventRule) => {
      if (!rule.enabled) return;
      rule.actions.forEach((action) => {
        const targetId = action.targetId ?? rule.trigger.nodeId;
        const target = targetId ? nodeById.get(targetId) : null;
        if (
          (action.type === 'focusCamera' ||
            action.type === 'setColor' ||
            action.type === 'setVisibility') &&
          !targetId
        ) {
          onError(`事件「${rule.name}」缺少动作对象`);
          return;
        }
        if (action.type === 'focusCamera' && targetId) {
          const request = { nodeId: targetId, nonce: Date.now() };
          setFocusRequest(request);
          window.clearTimeout(focusClearTimerRef.current);
          // 保留短暂的事件聚焦镜头，之后继续播放场景自动镜头。
          focusClearTimerRef.current = window.setTimeout(() => {
            setFocusRequest((current) => (current?.nonce === request.nonce ? null : current));
          }, 1800);
          return;
        }
        if (action.type === 'showPopup') {
          setRuntimePopup({
            title: target?.name ?? rule.name,
            message: action.message?.trim() || `${target?.name ?? '当前对象'} 已触发事件`,
          });
          return;
        }
        if (action.type === 'setColor' && targetId) {
          setRuntimeOverrides((current) => ({
            ...current,
            [targetId]: { ...current[targetId], color: action.color ?? '#ff6b6b' },
          }));
          return;
        }
        if (action.type === 'setVisibility' && targetId) {
          setRuntimeOverrides((current) => ({
            ...current,
            [targetId]: { ...current[targetId], visible: action.visible ?? true },
          }));
        }
      });
    },
    [nodeById, onError],
  );

  const runTrigger = useCallback(
    (type: SceneEventTriggerType, nodeId: string | null) => {
      (scene.events ?? [])
        .filter((rule) => {
          if (!rule.enabled || rule.trigger.type !== type) return false;
          const scope = getEventScope(rule);
          if (type === 'sceneLoad') return scope === 'scene';
          if (scope === 'node') {
            const ownerId = getEventOwnerId(rule);
            return ownerId === nodeId && rule.trigger.nodeId === nodeId;
          }
          // 场景级规则可以选择“整个场景”或指定对象作为触发来源。
          return !rule.trigger.nodeId || rule.trigger.nodeId === nodeId;
        })
        .forEach(runRule);
    },
    [runRule, scene.events],
  );

  useEffect(() => {
    setRuntimeOverrides({});
    setRuntimePopup(null);
    setFocusRequest(null);
    setRuntimeTimelineTime(0);
    window.clearTimeout(focusClearTimerRef.current);
  }, [scene]);

  useEffect(() => {
    const sources = scene.dataSources ?? [];
    const timers: number[] = [];
    const sockets: WebSocket[] = [];
    let cancelled = false;
    const consume = (source: SceneDataSource, data: unknown) => {
      if (cancelled) return;
      setRuntimeOverrides((current) => {
        const next = { ...current };
        scene.nodes.forEach((node) => {
          node.dataBindings
            ?.filter((binding) => binding.sourceId === source.id)
            .forEach((binding) => {
              const value = resolveDataPath(data, binding.path);
              if (value === undefined) return;
              const patch = { ...(next[node.id] ?? {}) };
              if (binding.property === 'value' && typeof value === 'number') patch.value = value;
              if (binding.property === 'text') patch.text = String(value);
              if (binding.property === 'color' && typeof value === 'string') patch.color = value;
              if (binding.property === 'opacity' && typeof value === 'number')
                patch.opacity = Math.max(0, Math.min(1, value));
              if (binding.property === 'visible') patch.visible = Boolean(value);
              next[node.id] = patch;
            });
        });
        return next;
      });
    };
    const load = async (source: SceneDataSource) => {
      try {
        const data = await testDataSource(source);
        consume(source, data);
      } catch (error) {
        onError(
          error instanceof Error
            ? `${source.name}: ${error.message}`
            : `${source.name}: 数据读取失败`,
        );
      }
    };
    sources.forEach((source) => {
      if (source.type === 'websocket' && source.url) {
        try {
          const socket = new WebSocket(source.url);
          socket.onmessage = (event) => {
            try {
              consume(source, JSON.parse(event.data));
            } catch {
              onError(`${source.name}: WebSocket 返回的不是 JSON`);
            }
          };
          socket.onerror = () => onError(`${source.name}: WebSocket 连接失败`);
          sockets.push(socket);
        } catch (error) {
          onError(error instanceof Error ? error.message : `${source.name}: WebSocket 连接失败`);
        }
      } else {
        void load(source);
        const interval = Math.max(1, source.refreshInterval ?? 10) * 1000;
        timers.push(window.setInterval(() => void load(source), interval));
      }
    });
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearInterval(timer));
      sockets.forEach((socket) => socket.close());
    };
  }, [onError, scene]);

  useEffect(() => () => window.clearTimeout(focusClearTimerRef.current), []);

  useEffect(() => {
    // 运行态自动播放场景时间轴，退出预览或切换场景时清理动画帧。
    let frameId = 0;
    let lastTimestamp = performance.now();
    let completed = false;
    const tick = (timestamp: number) => {
      const delta = Math.min(0.1, Math.max(0, (timestamp - lastTimestamp) / 1000));
      lastTimestamp = timestamp;
      setRuntimeTimelineTime((current) => {
        const next = current + delta;
        if (next < runtimeTimeline.duration) return next;
        if (runtimeTimeline.loop) return next % runtimeTimeline.duration;
        completed = true;
        return runtimeTimeline.duration;
      });
      if (!completed) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [runtimeTimeline.duration, runtimeTimeline.loop]);

  useEffect(() => {
    runTrigger('sceneLoad', null);
  }, [runTrigger]);

  return (
    <div className="runtime-shell">
      <header className="runtime-head">
        <div className="brand">
          <div className="brand-mark">
            <Rotate3d size={18} />
          </div>
          <strong>{project.name}</strong>
        </div>
        <div className="runtime-tools">
          <span className="status-live">
            <span /> LIVE
          </span>
          <button className="outline-button" onClick={onExit}>
            退出预览
          </button>
        </div>
      </header>
      <div className="runtime-canvas">
        <SceneCanvas
          nodes={animatedNodes}
          cameraView={runtimeCameraView}
          selectedId={null}
          readOnly
          runtimeOverrides={runtimeOverrides}
          focusRequest={focusRequest}
          onSelect={() => undefined}
          onNodeClick={(nodeId) => runTrigger('click', nodeId)}
          onNodeDoubleClick={(nodeId) => runTrigger('doubleClick', nodeId)}
          onNodeHover={(nodeId) => {
            if (nodeId) runTrigger('hover', nodeId);
          }}
          onRuntimeError={onError}
        />
        <div className="runtime-overlay">
          <div className="runtime-title">
            <span>{theme.eyebrow}</span>
            <h1>{project.name}</h1>
            <p>
              {theme.tagline} · {today}
            </p>
          </div>
          <div className="runtime-event-tip">
            场景事件{' '}
            {scene.events?.filter((rule) => rule.enabled && getEventScope(rule) === 'scene')
              .length ?? 0}{' '}
            条，对象交互事件{' '}
            {scene.events?.filter((rule) => rule.enabled && getEventScope(rule) === 'node')
              .length ?? 0}{' '}
            条
          </div>
          <div className="metric-cards">
            {theme.metrics.map((metric) => (
              <div key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.delta ?? ''}</small>
              </div>
            ))}
          </div>
        </div>
        {runtimePopup && (
          <div className="runtime-popup">
            <button
              className="icon-button"
              onClick={() => setRuntimePopup(null)}
              aria-label="关闭弹窗"
            >
              <X size={15} />
            </button>
            <span className="eyebrow">EVENT POPUP</span>
            <strong>{runtimePopup.title}</strong>
            <p>{runtimePopup.message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ReleaseDrawer({
  releases,
  errors,
  onClose,
  onRollback,
}: {
  releases: Release[];
  errors: RuntimeError[];
  onClose: () => void;
  onRollback: (release: Release) => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="release-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">PUBLISH CENTER</span>
            <h2>发布记录</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {releases.length ? (
          releases.map((release) => (
            <div className="release-card" key={release.id}>
              <div>
                <strong>{release.version}</strong>
                <span>{new Date(release.createdAt).toLocaleString('zh-CN')}</span>
              </div>
              <button className="outline-button" onClick={() => onRollback(release)}>
                回滚到此版本
              </button>
            </div>
          ))
        ) : (
          <div className="drawer-empty">
            <History size={25} />
            <strong>还没有发布版本</strong>
            <span>点击顶部“发布”创建第一个版本</span>
          </div>
        )}
        <div className="drawer-section">
          <div className="section-label">
            <span>运行错误</span>
            <span className="section-tag">{errors.length}</span>
          </div>
          {errors.length ? (
            errors.map((error) => (
              <div className="error-line" key={error.id}>
                <span className="error-type">{error.type}</span>
                <span>{error.message}</span>
              </div>
            ))
          ) : (
            <div className="no-errors">暂无运行错误</div>
          )}
        </div>
      </aside>
    </div>
  );
}
