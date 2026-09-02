import { useEffect, useState } from 'react';
import { History, Pause, Play, Plus, Sparkles, Trash2, Zap } from 'lucide-react';
import { formatTimelineTime, MAX_TIMELINE_DURATION_SECONDS } from '../timeline';
import type {
  SceneEventAction,
  SceneEventActionType,
  SceneEventRule,
  SceneEventScope,
  SceneEventTriggerType,
  SceneNode,
  SceneTimeline,
  SceneTimelineProperty,
} from '../types';
import {
  actionLabels,
  nodeTriggerLabels,
  sceneTriggerLabels,
  timelinePropertyLabels,
} from './eventConfig';

type TimelineDurationUnit = 'seconds' | 'minutes' | 'hours';

const durationUnits: Record<
  TimelineDurationUnit,
  { label: string; factor: number; precision: number }
> = {
  seconds: { label: '秒', factor: 1, precision: 2 },
  minutes: { label: '分', factor: 60, precision: 4 },
  hours: { label: '时', factor: 3600, precision: 6 },
};

function preferredDurationUnit(seconds: number): TimelineDurationUnit {
  if (seconds >= 3600) return 'hours';
  if (seconds >= 60) return 'minutes';
  return 'seconds';
}

function formatDurationInput(seconds: number, unit: TimelineDurationUnit) {
  const config = durationUnits[unit];
  return String(Number((seconds / config.factor).toFixed(config.precision)));
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
    const value = Number(durationInput.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setDurationInput(formatDurationInput(timeline.duration, durationUnit));
      setDurationDirty(false);
      return;
    }
    const duration = Math.min(
      MAX_TIMELINE_DURATION_SECONDS,
      Math.max(1, Math.round(value * durationUnits[durationUnit].factor * 1000) / 1000),
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
        <span className="muted-text">
          {tab === 'events'
            ? `场景事件规则 ${events.length} 条`
            : `关键帧 ${timeline.keyframes.length} 个 · ${formatDurationInput(timeline.duration, durationUnit)} ${durationUnits[durationUnit].label}`}
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
