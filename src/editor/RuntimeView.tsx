import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rotate3d, X } from 'lucide-react';
import SceneCanvas, { type CameraFocusRequest } from '../SceneCanvas';
import { testDataSource } from '../api';
import { applyCameraTimeline, applyTimeline, normalizeTimeline } from '../timeline';
import type {
  ProjectMeta,
  SceneDataSource,
  SceneDocument,
  SceneEventRule,
  SceneEventTriggerType,
  SceneNode,
} from '../types';
import { getEventOwnerId, getEventScope } from './eventConfig';

function resolveDataPath(value: unknown, path: string): unknown {
  if (!path.trim()) return value;
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
    if (typeof current === 'object') return (current as Record<string, unknown>)[key];
    return undefined;
  }, value);
}

export function RuntimeView({
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
