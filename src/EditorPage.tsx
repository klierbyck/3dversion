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
  Play,
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
import SceneCanvas from './SceneCanvas';
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
  type SceneNode,
  type TransformMode,
} from './types';
import {
  DraftConflictError,
  createRelease,
  listReleases,
  loadDraft,
  reportRuntimeError,
  saveDraft,
} from './api';

type Props = { project: ProjectMeta; onExit: () => void };

const componentCategories = ['全部', '基础', '建筑', '工业', '能源', '数据', '系统'];

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

  // 场景的最新值以 ref 为准：所有变更先算出 next 再统一写入，
  // 避免 StrictMode 双调用 setState updater 时把撤销快照重复入栈。
  const sceneRef = useRef(initialScene);
  const selectedIdRef = useRef(selectedId);
  const transformStartRef = useRef<SceneDocument | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);

  const selected = scene.nodes.find((node) => node.id === selectedId) ?? null;
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
    setRedoStack((stack) => [...stack.slice(-49), sceneRef.current]);
    applyHistoryScene(previous);
  }, [applyHistoryScene, undoStack]);

  const redo = useCallback(() => {
    if (!redoStack.length) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack.slice(-49), sceneRef.current]);
    applyHistoryScene(next);
  }, [applyHistoryScene, redoStack]);

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
      if (finished && transformStartRef.current) {
        setUndoStack((stack) => [...stack.slice(-49), transformStartRef.current!]);
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
          <button className="tool-button" onClick={() => setBottomOpen(!bottomOpen)}>
            <History size={15} /> 时间轴
          </button>
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
            <div className="asset-empty">
              <Upload size={24} />
              <strong>暂无本地资源</strong>
              <span>支持 GLB、GLTF、PNG、JPG</span>
              <button className="outline-button" disabled title="资源上传将在后续版本提供">
                <Upload size={14} />
                上传资源
              </button>
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
            </div>
          </div>
          <div className="canvas-host">
            <SceneCanvas
              nodes={scene.nodes}
              selectedId={selectedId}
              mode={transformMode}
              gridVisible={gridVisible}
              onSelect={setSelectedId}
              onDropKind={addNode}
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
          {bottomOpen && <BottomPanel tab={bottomTab} setTab={setBottomTab} />}
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
                <button className="active">属性</button>
                <button disabled title="数据绑定规划中">
                  数据
                </button>
                <button disabled title="事件配置规划中">
                  事件
                </button>
              </div>
              <Inspector selected={selected} setNode={setNode} />
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

/** 底部时间轴/事件区：当前为占位视图，动画编排与事件规则将在后续迭代实现。 */
function BottomPanel({
  tab,
  setTab,
}: {
  tab: 'timeline' | 'events';
  setTab: (tab: 'timeline' | 'events') => void;
}) {
  return (
    <div className="bottom-panel">
      <div className="bottom-head">
        <div className="bottom-tabs">
          <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>
            <History size={14} />
            时间轴
          </button>
          <button className={tab === 'events' ? 'active' : ''} onClick={() => setTab('events')}>
            <Zap size={14} />
            事件
          </button>
        </div>
        <span className="muted-text">动画编排 · 规划中（当前为占位视图）</span>
      </div>
      {tab === 'timeline' ? (
        <div className="timeline">
          <div className="timeline-controls">
            <button className="play-button" disabled title="动画播放将在后续迭代提供">
              <Play size={14} />
            </button>
            <span>00:00.00</span>
            <div className="timeline-track">
              <i />
              <i />
              <i />
            </div>
            <span>00:15.00</span>
          </div>
          <div className="timeline-empty">
            <Sparkles size={18} />
            拖入关键帧或选择对象开始创建动画
          </div>
        </div>
      ) : (
        <div className="event-list">
          <div className="event-row">
            <span className="event-dot blue" />
            <strong>点击</strong>
            <span>→ 相机聚焦</span>
            <span className="event-enabled">示例</span>
          </div>
          <div className="event-row">
            <span className="event-dot amber" />
            <strong>数据变化</strong>
            <span>→ 更新颜色</span>
            <span className="event-enabled">示例</span>
          </div>
          <button className="add-event" disabled title="事件规则配置将在后续迭代提供">
            <Zap size={14} />
            添加事件规则
          </button>
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
          nodes={scene.nodes}
          selectedId={null}
          readOnly
          onSelect={() => undefined}
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
