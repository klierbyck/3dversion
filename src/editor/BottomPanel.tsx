import { useEffect, useState } from 'react';
import { History, Pause, Play, Plus, Trash2, Zap } from 'lucide-react';
import {
  TIMELINE_SPEEDS,
  formatTimelineTime,
  MAX_TIMELINE_DURATION_SECONDS,
} from '../timeline';
import type {
  SceneDataSource,
  SceneEventAction,
  SceneEventRule,
  SceneEventScope,
  SceneNode,
  SceneTimeline,
  SceneTimelineProperty,
} from '../types';
import { timelinePropertyLabels } from './eventConfig';
import { EventRuleList } from './EventRuleList';
import {
  durationUnits,
  formatDurationInput,
  parseDurationInput,
  preferredDurationUnit,
  type TimelineDurationUnit,
} from '../lib/timelineDuration';

export function BottomPanel({
  tab,
  setTab,
  scope,
  nodes,
  selectedId,
  events,
  onAddEvent,
  onPatchRule,
  onPatchAction,
  onAddAction,
  onMoveAction,
  onDeleteAction,
  onDeleteEvent,
  sources,
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
  onAddAction: (ruleId: string) => void;
  onMoveAction: (ruleId: string, actionId: string, direction: -1 | 1) => void;
  onDeleteAction: (ruleId: string, actionId: string) => void;
  onDeleteEvent: (id: string) => void;
  sources: SceneDataSource[];
  timeline: SceneTimeline;
  timelineTime: number;
  timelinePlaying: boolean;
  onTimelineTimeChange: (time: number) => void;
  onTimelinePlayingChange: (playing: boolean) => void;
  onPatchTimeline: (
    patch: Partial<Pick<SceneTimeline, 'duration' | 'loop' | 'speed'>>,
  ) => void;
  onAddKeyframe: (property: SceneTimelineProperty) => void;
  onDeleteKeyframe: (id: string) => void;
}) {
  const [timelineProperty, setTimelineProperty] = useState<SceneTimelineProperty>('position');
  const [durationUnit, setDurationUnit] = useState<TimelineDurationUnit>(() =>
    preferredDurationUnit(timeline.duration),
  );
  const [durationInput, setDurationInput] = useState(() =>
    formatDurationInput(timeline.duration, durationUnit),
  );
  const [durationDirty, setDurationDirty] = useState(false);
  const selectedName = nodes.find((node) => node.id === selectedId)?.name ?? null;
  const selectedFrames = timeline.keyframes.filter((frame) => frame.nodeId === selectedId);

  useEffect(() => {
    if (durationDirty) return;
    setDurationInput(formatDurationInput(timeline.duration, durationUnit));
  }, [durationDirty, durationUnit, timeline.duration]);

  const commitDuration = () => {
    if (!durationDirty) return;
    const parsed = parseDurationInput(durationInput, durationUnit);
    if (parsed === null) {
      setDurationInput(formatDurationInput(timeline.duration, durationUnit));
      setDurationDirty(false);
      return;
    }
    const duration = Math.min(
      MAX_TIMELINE_DURATION_SECONDS,
      Math.max(1, Math.round(parsed * 1000) / 1000),
    );
    setDurationInput(formatDurationInput(duration, durationUnit));
    setDurationDirty(false);
    onPatchTimeline({ duration });
  };

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
        {tab === 'events' ? (
          <div className="bottom-head-actions">
            <span className="muted-text">{events.length} 条</span>
            <button className="add-event head-add-event" onClick={onAddEvent}>
              <Zap size={13} />
              添加场景事件
            </button>
          </div>
        ) : (
          <span className="muted-text">
            {`关键帧 ${timeline.keyframes.length} 个 · ${formatDurationInput(timeline.duration, durationUnit)} ${durationUnits[durationUnit].label}`}
          </span>
        )}
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
          </div>
          <div className="timeline-controls timeline-controls-sub">
            <label className="timeline-duration">
              <span>时长</span>
              <span className="timeline-duration-control">
                <input
                  aria-label="场景时长数值"
                  type="text"
                  inputMode="decimal"
                  value={durationInput}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (!/^\d*(?:[.,]\d*)?$/.test(value)) return;
                    setDurationInput(value);
                    setDurationDirty(true);
                  }}
                  onBlur={commitDuration}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
                <select
                  aria-label="场景时长单位"
                  value={durationUnit}
                  onChange={(event) => {
                    setDurationUnit(event.target.value as TimelineDurationUnit);
                    setDurationDirty(false);
                  }}
                >
                  {Object.entries(durationUnits).map(([value, config]) => (
                    <option key={value} value={value}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="timeline-speed">
              <span>速度</span>
              <select
                aria-label="时间轴播放速度"
                value={timeline.speed ?? 1}
                onChange={(event) => onPatchTimeline({ speed: Number(event.target.value) })}
              >
                {TIMELINE_SPEEDS.map((speed) => (
                  <option key={speed} value={speed}>
                    {speed}x
                  </option>
                ))}
              </select>
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
        <EventRuleList
          scope="scene"
          nodes={nodes}
          sources={sources}
          selectedId={selectedId}
          events={events}
          onAddEvent={onAddEvent}
          onPatchRule={onPatchRule}
          onPatchAction={onPatchAction}
          onAddAction={onAddAction}
          onMoveAction={onMoveAction}
          onDeleteAction={onDeleteAction}
          onDeleteEvent={onDeleteEvent}
        />
      )}
    </div>
  );
}
