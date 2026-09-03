import { useEffect, useState } from 'react';
import { History, Pause, Play, Plus, Trash2, Zap } from 'lucide-react';
import { TIMELINE_SPEEDS, formatTimelineTime, MAX_TIMELINE_DURATION_SECONDS } from '../timeline';
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

function formatTimelineAxisTime(value: number): string {
  const totalCentiseconds = Math.round(Math.max(0, value) * 100);
  const hours = Math.floor(totalCentiseconds / 360000);
  const minutes = Math.floor((totalCentiseconds % 360000) / 6000);
  const seconds = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;
  return [hours, minutes, seconds, centiseconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

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
  onPatchTimeline: (patch: Partial<Pick<SceneTimeline, 'duration' | 'loop' | 'speed'>>) => void;
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
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
  const selectedName = nodes.find((node) => node.id === selectedId)?.name ?? null;
  const selectedFrames = timeline.keyframes.filter((frame) => frame.nodeId === selectedId);
  const selectedKeyframe = selectedFrames.find((frame) => frame.id === selectedKeyframeId) ?? null;

  useEffect(() => {
    if (durationDirty) return;
    setDurationInput(formatDurationInput(timeline.duration, durationUnit));
  }, [durationDirty, durationUnit, timeline.duration]);

  useEffect(() => {
    if (selectedKeyframeId && !selectedKeyframe) setSelectedKeyframeId(null);
  }, [selectedKeyframe, selectedKeyframeId]);

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

  const timelineSettings = (
    <div className="timeline-head-controls">
      <span className="timeline-frame-count">{timeline.keyframes.length} 帧</span>
      <label className="timeline-duration" title="场景时长">
        <span className="timeline-control-label">时长</span>
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
      <label className="timeline-speed" title="播放速度">
        <span className="timeline-control-label">速度</span>
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
  );

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
            <button className="add-event compact-add-button" onClick={onAddEvent}>
              <Zap size={13} />
              添加场景事件
            </button>
          </div>
        ) : (
          timelineSettings
        )}
      </div>
      {tab === 'timeline' ? (
        <div className="timeline">
          <div className="timeline-transport">
            <div className="timeline-playback">
              <button
                className="play-button"
                disabled={!timeline.keyframes.length}
                title={timelinePlaying ? '暂停时间轴' : '播放时间轴'}
                onClick={() => onTimelinePlayingChange(!timelinePlaying)}
              >
                {timelinePlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>
              <span className="timeline-time" title={formatTimelineTime(timelineTime)}>
                {formatTimelineAxisTime(timelineTime)}
              </span>
            </div>
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
                    setSelectedKeyframeId(frame.nodeId === selectedId ? frame.id : null);
                  }}
                />
              ))}
            </div>
            <span
              className="timeline-time timeline-time-end"
              title={formatTimelineTime(timeline.duration)}
            >
              {formatTimelineAxisTime(timeline.duration)}
            </span>
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
            <div className="timeline-object-track">
              <div className="timeline-object-track-line" />
              {selectedFrames.length > 0 ? (
                selectedFrames.map((frame) => {
                  const ratio = Math.min(1, Math.max(0, frame.time / timeline.duration));
                  const edgeClass = ratio < 0.12 ? 'edge-start' : ratio > 0.88 ? 'edge-end' : '';
                  return (
                    <span
                      className={`timeline-keyframe-point ${edgeClass}`}
                      key={frame.id}
                      style={{ left: `${ratio * 100}%` }}
                    >
                      <button
                        className={`timeline-keyframe-diamond ${selectedKeyframeId === frame.id ? 'active' : ''}`}
                        aria-label={`${formatTimelineTime(frame.time)} ${timelinePropertyLabels[frame.property]}`}
                        title="查看关键帧"
                        onClick={() => {
                          onTimelinePlayingChange(false);
                          onTimelineTimeChange(frame.time);
                          setSelectedKeyframeId(frame.id);
                        }}
                      />
                      {selectedKeyframeId === frame.id && (
                        <span className="timeline-keyframe-detail">
                          <span>{formatTimelineTime(frame.time)}</span>
                          <span>{timelinePropertyLabels[frame.property]}</span>
                          <button
                            aria-label="删除关键帧"
                            title="删除关键帧"
                            onClick={() => onDeleteKeyframe(frame.id)}
                          >
                            <Trash2 size={11} />
                          </button>
                        </span>
                      )}
                    </span>
                  );
                })
              ) : (
                <span className="timeline-track-empty">
                  {selectedId ? '当前对象暂无关键帧' : '选择对象后添加关键帧'}
                </span>
              )}
            </div>
            <div className="timeline-keyframe-tools">
              <select
                aria-label="关键帧属性"
                value={timelineProperty}
                onChange={(event) =>
                  setTimelineProperty(event.target.value as SceneTimelineProperty)
                }
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
                title="在当前播放位置添加关键帧"
                aria-label="在当前播放位置添加关键帧"
              >
                <Plus size={14} />
              </button>
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
