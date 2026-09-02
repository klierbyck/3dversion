import { Sparkles, Trash2, Zap } from 'lucide-react';
import type {
  SceneEventAction,
  SceneEventActionType,
  SceneEventRule,
  SceneEventScope,
  SceneEventTriggerType,
  SceneNode,
} from '../types';
import { actionLabels, nodeTriggerLabels, sceneTriggerLabels } from './eventConfig';

/** 对象事件面板：只展示当前选中节点归属的规则，避免与场景级规则混在一起。 */
export function EventRuleList({
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
