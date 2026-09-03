import type {
  SceneDocument,
  SceneCameraKeyframe,
  SceneKeyframe,
  SceneKeyframeValue,
  SceneNode,
  SceneTimeline,
  SceneTimelineProperty,
} from './types';

export const TIMELINE_SPEEDS = [0.25, 0.5, 1, 2] as const;
export type TimelineSpeed = (typeof TIMELINE_SPEEDS)[number];

export const defaultTimeline: SceneTimeline = {
  duration: 15,
  loop: false,
  speed: 1,
  keyframes: [],
  cameraKeyframes: [],
};

export const MAX_TIMELINE_DURATION_SECONDS = 24 * 60 * 60;

/** 读取并约束时间轴配置，避免旧草稿或手工编辑 JSON 造成非法播放状态。 */
export function normalizeTimeline(timeline?: SceneTimeline): SceneTimeline {
  const duration = Math.min(
    MAX_TIMELINE_DURATION_SECONDS,
    Math.max(1, Number(timeline?.duration) || 15),
  );
  const speed = (TIMELINE_SPEEDS as readonly number[]).includes(timeline?.speed ?? 1)
    ? (timeline?.speed as TimelineSpeed)
    : 1;
  return {
    duration,
    loop: timeline?.loop ?? false,
    speed,
    keyframes: (timeline?.keyframes ?? [])
      .filter(isKeyframe)
      .map((frame) => ({ ...frame, time: clamp(frame.time, 0, duration) }))
      .sort((a, b) => a.time - b.time),
    cameraKeyframes: (timeline?.cameraKeyframes ?? [])
      .filter(isCameraKeyframe)
      .map((frame) => ({ ...frame, time: clamp(frame.time, 0, duration) }))
      .sort((a, b) => a.time - b.time),
  };
}

/** 根据场景时间计算相机位置、观察目标和视场角。 */
export function applyCameraTimeline(
  scene: SceneDocument,
  time: number,
): SceneCameraKeyframe | null {
  const frames = normalizeTimeline(scene.timeline).cameraKeyframes ?? [];
  if (!frames.length) return null;
  const previous = [...frames].reverse().find((frame) => frame.time <= time);
  const next = frames.find((frame) => frame.time >= time);
  if (!previous) return frames[0];
  if (!next || previous.id === next.id || previous.time === next.time) return previous;
  const progress = clamp((time - previous.time) / (next.time - previous.time), 0, 1);
  return {
    ...previous,
    position: interpolateVector(previous.position, next.position, progress),
    target: interpolateVector(previous.target, next.target, progress),
    fov: lerp(previous.fov ?? 48, next.fov ?? 48, progress),
  };
}

/** 根据当前播放时间计算节点快照，数值/向量/颜色线性插值，显隐采用离散关键帧。 */
export function applyTimeline(scene: SceneDocument, time: number): SceneNode[] {
  const timeline = normalizeTimeline(scene.timeline);
  if (!timeline.keyframes.length) return scene.nodes;
  const framesByNode = new Map<string, SceneKeyframe[]>();
  timeline.keyframes.forEach((frame) => {
    const frames = framesByNode.get(frame.nodeId) ?? [];
    frames.push(frame);
    framesByNode.set(frame.nodeId, frames);
  });
  return scene.nodes.map((node) => {
    const frames = framesByNode.get(node.id);
    if (!frames?.length) return node;
    const next = { ...node };
    const properties = new Set(frames.map((frame) => frame.property));
    properties.forEach((property) => {
      const propertyFrames = frames
        .filter((frame) => frame.property === property)
        .sort((a, b) => a.time - b.time);
      const value = interpolateFrames(
        propertyFrames,
        time,
        propertyValue(node, property),
        property,
      );
      assignProperty(next, property, value);
    });
    return next;
  });
}

export function propertyValue(
  node: SceneNode,
  property: SceneTimelineProperty,
): SceneKeyframeValue {
  if (property === 'opacity') return node.opacity ?? 1;
  if (property === 'color') return node.color ?? '#34d399';
  return node[property];
}

export function formatTimelineTime(value: number): string {
  const safe = Math.max(0, value);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = Math.floor(safe % 60);
  const centiseconds = Math.floor((safe % 1) * 100);
  const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  return hours ? `${String(hours).padStart(2, '0')}:${clock}` : clock;
}

function interpolateFrames(
  frames: SceneKeyframe[],
  time: number,
  base: SceneKeyframeValue,
  property: SceneTimelineProperty,
): SceneKeyframeValue {
  if (!frames.length) return base;
  const previous = [...frames].reverse().find((frame) => frame.time <= time);
  const next = frames.find((frame) => frame.time >= time);
  if (!previous) return property === 'visible' ? base : frames[0].value;
  if (!next || previous.id === next.id || previous.time === next.time) return previous.value;
  if (property === 'visible') return previous.value;
  const progress = clamp((time - previous.time) / (next.time - previous.time), 0, 1);
  return interpolateValue(previous.value, next.value, progress, property);
}

function interpolateValue(
  from: SceneKeyframeValue,
  to: SceneKeyframeValue,
  progress: number,
  property: SceneTimelineProperty,
): SceneKeyframeValue {
  if (Array.isArray(from) && Array.isArray(to)) {
    return from.map((value, index) => lerp(value, to[index], progress)) as [number, number, number];
  }
  if (typeof from === 'number' && typeof to === 'number') return lerp(from, to, progress);
  if (property === 'color' && typeof from === 'string' && typeof to === 'string') {
    return interpolateColor(from, to, progress);
  }
  return progress < 1 ? from : to;
}

function interpolateVector(
  from: [number, number, number],
  to: [number, number, number],
  progress: number,
): [number, number, number] {
  return from.map((value, index) => lerp(value, to[index], progress)) as [number, number, number];
}

function assignProperty(
  node: SceneNode,
  property: SceneTimelineProperty,
  value: SceneKeyframeValue,
) {
  if (property === 'position' || property === 'rotation' || property === 'scale') {
    if (Array.isArray(value)) node[property] = value as [number, number, number];
    return;
  }
  if (property === 'opacity' && typeof value === 'number') node.opacity = value;
  if (property === 'color' && typeof value === 'string') node.color = value;
  if (property === 'visible' && typeof value === 'boolean') node.visible = value;
}

function interpolateColor(from: string, to: string, progress: number): string {
  const start = parseHex(from);
  const end = parseHex(to);
  if (!start || !end) return progress < 1 ? from : to;
  return `#${start
    .map((value, index) =>
      Math.round(lerp(value, end[index], progress))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function parseHex(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) return null;
  return [0, 2, 4].map((index) => Number.parseInt(match[1].slice(index, index + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function isKeyframe(value: unknown): value is SceneKeyframe {
  if (!value || typeof value !== 'object') return false;
  const frame = value as Partial<SceneKeyframe>;
  return Boolean(
    typeof frame.id === 'string' &&
    typeof frame.nodeId === 'string' &&
    typeof frame.time === 'number' &&
    Number.isFinite(frame.time) &&
    ['position', 'rotation', 'scale', 'color', 'opacity', 'visible'].includes(frame.property ?? ''),
  );
}

function isCameraKeyframe(value: unknown): value is SceneCameraKeyframe {
  if (!value || typeof value !== 'object') return false;
  const frame = value as Partial<SceneCameraKeyframe>;
  return Boolean(
    typeof frame.id === 'string' &&
    typeof frame.time === 'number' &&
    Number.isFinite(frame.time) &&
    Array.isArray(frame.position) &&
    frame.position.length === 3 &&
    frame.position.every((item) => typeof item === 'number' && Number.isFinite(item)) &&
    Array.isArray(frame.target) &&
    frame.target.length === 3 &&
    frame.target.every((item) => typeof item === 'number' && Number.isFinite(item)),
  );
}

function lerp(from: number, to: number, progress: number) {
  return from + (to - from) * progress;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
