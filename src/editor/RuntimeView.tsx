import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rotate3d, X } from 'lucide-react';
import SceneCanvas, { type CameraFocusRequest } from '../SceneCanvas';
import { fetchDataSource } from '../api';
import { applyCameraTimeline, applyTimeline, normalizeTimeline } from '../timeline';
import { evalCondition } from '../schemas/validate';
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
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((current, key) => {
      if (current === null || current === undefined) return undefined;
      if (Array.isArray(current) && /^\d+$/.test(key)) return current[Number(key)];
      if (typeof current === 'object') return (current as Record<string, unknown>)[key];
      return undefined;
    }, value);
}

/** 事件链熔断：同一规则 1 秒窗口内触发超过 10 次即中断，防止事件死循环。 */
const MAX_RULE_FIRES = 10;
const FIRE_WINDOW_MS = 1000;

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
    Record<
      string,
      Partial<
        Pick<SceneNode, 'color' | 'visible' | 'opacity' | 'value' | 'text'> & {
          playing: boolean;
        }
      >
    >
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
  const latestDataRef = useRef<Record<string, unknown>>({});
  const reloadersRef = useRef<Map<string, () => void>>(new Map());
  const fireGuardRef = useRef<
    Map<string, { count: number; first: number; broken: boolean }>
  >(new Map());

  const runRule = useCallback(
    (rule: SceneEventRule, context: Record<string, unknown> = {}) => {
      if (!rule.enabled) return;
      // 事件循环熔断：同一规则 1 秒窗口内触发超过 10 次即中断本次预览中的后续触发。
      const now = performance.now();
      const guard = fireGuardRef.current.get(rule.id) ?? { count: 0, first: now, broken: false };
      if (now - guard.first > FIRE_WINDOW_MS) {
        guard.count = 0;
        guard.first = now;
        guard.broken = false;
      }
      guard.count += 1;
      fireGuardRef.current.set(rule.id, guard);
      if (guard.broken) return;
      if (guard.count > MAX_RULE_FIRES) {
        guard.broken = true;
        onError(
          `事件「${rule.name}」1 秒内触发超过 ${MAX_RULE_FIRES} 次，已自动中断以避免事件循环`,
        );
        return;
      }
      if (rule.condition?.trim()) {
        const conditionScope = {
          ...context,
          data: context.data ?? latestDataRef.current,
          value: context.value ?? context.data,
          node: context.node ?? null,
        };
        if (!evalCondition(rule.condition, conditionScope)) return;
      }
      rule.actions.forEach((action) => {
        const targetId = action.targetId ?? rule.trigger.nodeId ?? rule.ownerNodeId;
        const target = targetId ? nodeById.get(targetId) : null;
        if (
          ['focusCamera', 'setColor', 'setVisibility', 'setOpacity', 'playAnimation'].includes(
            action.type,
          ) &&
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
          return;
        }
        if (action.type === 'setOpacity' && targetId) {
          const opacity = Math.max(0, Math.min(1, action.opacity ?? 1));
          setRuntimeOverrides((current) => ({
            ...current,
            [targetId]: { ...current[targetId], opacity },
          }));
          return;
        }
        if (action.type === 'playAnimation' && targetId) {
          setRuntimeOverrides((current) => ({
            ...current,
            [targetId]: { ...current[targetId], playing: action.play ?? true },
          }));
          return;
        }
        if (action.type === 'refreshData') {
          const sourceId = rule.trigger.sourceId;
          if (sourceId) {
            reloadersRef.current.get(sourceId)?.();
          } else {
            reloadersRef.current.forEach((reload) => reload());
          }
        }
      });
    },
    [nodeById, onError],
  );

  const runTrigger = useCallback(
    (
      type: SceneEventTriggerType,
      nodeId: string | null,
      context?: { sourceId?: string; data?: unknown },
    ) => {
      (scene.events ?? [])
        .filter((rule) => {
          if (!rule.enabled || rule.trigger.type !== type) return false;
          if (type === 'sceneLoad') return getEventScope(rule) === 'scene';
          if (type === 'dataChange') {
            return !rule.trigger.sourceId || rule.trigger.sourceId === context?.sourceId;
          }
          const scope = getEventScope(rule);
          if (scope === 'node') {
            const ownerId = getEventOwnerId(rule);
            return ownerId === nodeId && rule.trigger.nodeId === nodeId;
          }
          // 场景级规则可以选择“整个场景”或指定对象作为触发来源。
          return !rule.trigger.nodeId || rule.trigger.nodeId === nodeId;
        })
        .forEach((rule) =>
          runRule(rule, {
            ...context,
            node: nodeId ? (nodeById.get(nodeId) ?? null) : null,
          }),
        );
    },
    [runRule, scene.events, nodeById],
  );

  useEffect(() => {
    setRuntimeOverrides({});
    setRuntimePopup(null);
    setFocusRequest(null);
    setRuntimeTimelineTime(0);
    latestDataRef.current = {};
    fireGuardRef.current.clear();
    reloadersRef.current.clear();
    window.clearTimeout(focusClearTimerRef.current);
  }, [scene]);

  useEffect(() => {
    const sources = scene.dataSources ?? [];
    const timers: number[] = [];
    const sockets: WebSocket[] = [];
    let cancelled = false;
    reloadersRef.current.clear();
    const consume = (source: SceneDataSource, data: unknown) => {
      if (cancelled) return;
      latestDataRef.current[source.id] = data;
      setRuntimeOverrides((current) => {
        const next = { ...current };
        scene.nodes.forEach((node) => {
          node.dataBindings
            ?.filter((binding) => binding.sourceId === source.id)
            .forEach((binding) => {
              const value = resolveDataPath(data, binding.path);
              if (value === undefined || value === null) return;
              const patch = { ...(next[node.id] ?? {}) };
              if (binding.property === 'value') {
                if (typeof value === 'number') {
                  patch.value = value;
                  // 阈值着色：按顺序比较，最后一个命中的阈值生效。
                  const numeric = Number(value);
                  let hitColor: string | undefined;
                  binding.thresholds?.forEach((threshold) => {
                    let matched = false;
                    switch (threshold.op) {
                      case '>': matched = numeric > threshold.value; break;
                      case '>=': matched = numeric >= threshold.value; break;
                      case '<': matched = numeric < threshold.value; break;
                      case '<=': matched = numeric <= threshold.value; break;
                      case '==': matched = numeric === threshold.value; break;
                      case '!=': matched = numeric !== threshold.value; break;
                    }
                    if (matched) hitColor = threshold.color;
                  });
                  if (hitColor) patch.color = hitColor;
                }
              }
              if (binding.property === 'text') {
                let text: string;
                if (typeof value === 'number' && binding.decimals !== undefined) {
                  text = value.toFixed(binding.decimals);
                } else {
                  text = String(value);
                }
                patch.text = `${binding.prefix ?? ''}${text}${binding.suffix ?? ''}`;
              }
              if (binding.property === 'color' && typeof value === 'string') patch.color = value;
              if (binding.property === 'opacity' && typeof value === 'number')
                patch.opacity = Math.max(0, Math.min(1, value));
              if (binding.property === 'visible') patch.visible = Boolean(value);
              next[node.id] = patch;
            });
        });
        return next;
      });
      // 数据到达后触发 dataChange 规则（条件表达式可使用 data / value）。
      runTrigger('dataChange', null, { sourceId: source.id, data });
    };
    const load = async (source: SceneDataSource) => {
      try {
        const result = await fetchDataSource(source, project.id);
        consume(source, result.data);
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
        reloadersRef.current.set(source.id, () => void load(source));
        const interval = Math.max(1, source.refreshInterval ?? 10) * 1000;
        timers.push(window.setInterval(() => void load(source), interval));
      }
    });
    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearInterval(timer));
      sockets.forEach((socket) => socket.close());
      reloadersRef.current.clear();
    };
  }, [onError, scene, runTrigger]);

  useEffect(() => () => window.clearTimeout(focusClearTimerRef.current), []);

  useEffect(() => {
    // 运行态自动播放场景时间轴，退出预览或切换场景时清理动画帧。
    let frameId = 0;
    let lastTimestamp = performance.now();
    let completed = false;
    const tick = (timestamp: number) => {
      const delta =
        Math.min(0.1, Math.max(0, (timestamp - lastTimestamp) / 1000)) *
        (runtimeTimeline.speed ?? 1);
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
  }, [runtimeTimeline.duration, runtimeTimeline.loop, runtimeTimeline.speed]);

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
