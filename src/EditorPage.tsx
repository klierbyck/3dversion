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
import { BottomPanel } from './editor/BottomPanel';
import { CategoryScroller, Tree } from './editor/EditorSidebar';
import { EventRuleList } from './editor/EventRuleList';
import { DataSourcePanel, Inspector } from './editor/InspectorPanels';
import { ReleaseDrawer } from './editor/ReleaseDrawer';
import { RuntimeView } from './editor/RuntimeView';
import { getEventOwnerId, getEventScope, timelinePropertyLabels } from './editor/eventConfig';
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

const componentCategories = [
  '全部',
  '基础',
  '建筑',
  '交通',
  '设施',
  '工业',
  '能源',
  '数据',
  '系统',
];

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
