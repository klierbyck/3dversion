import { ChevronDown, ChevronUp, Sparkles, Trash2, Zap } from 'lucide-react';
import type {
  SceneDataSource,
  SceneEventAction,
  SceneEventActionType,
  SceneEventRule,
  SceneEventScope,
  SceneEventTriggerType,
  SceneNode,
} from '../types';
import {
  ACTION_ORDER,
  actionHasColor,
  actionHasMessage,
  actionHasOpacity,
  actionHasPlay,
  actionHasVisible,
  actionLabels,
  actionNeedsTarget,
  nodeTriggerLabels,
  sceneTriggerLabels,
} from './eventConfig';
import { validateConditionExpression } from '../schemas/validate';

/** 单个动作的编辑子卡片。 */
function ActionEditor({
  action,
  index,
  total,
  nodes,
  onPatch,
  onMove,
  onDelete,
}: {
  action: SceneEventAction;
  index: number;
  total: number;
  nodes: SceneNode[];
  onPatch: (patch: Partial<SceneEventAction>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div className="event-action-card">
      <div className="event-action-head">
        <span className="event-action-index">动作 {index + 1}</span>
        <span className="event-action-tools">
          <button
            type="button"
            className="icon-button"
            title="上移"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            className="icon-button"
            title="下移"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ChevronDown size={13} />
          </button>
          <button type="button" className="icon-button" title="删除动作" onClick={onDelete}>
            <Trash2 size={13} />
          </button>
        </span>
      </div>
      <div className="event-form-grid">
        <label>
          动作类型
          <select
            value={action.type}
            onChange={(event) => onPatch({ type: event.target.value as SceneEventActionType })}
          >
            {ACTION_ORDER.map((value) => (
              <option key={value} value={value}>
                {actionLabels[value]}
              </option>
            ))}
          </select>
        </label>
        {actionNeedsTarget(action.type) && (
          <label>
            动作对象
            <select
              value={action.targetId ?? ''}
              onChange={(event) => onPatch({ targetId: event.target.value || null })}
            >
              <option value="">同触发对象</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {actionHasMessage(action.type) && (
          <label className="event-form-wide">
            弹窗内容
            <input
              value={action.message ?? ''}
              onChange={(event) => onPatch({ message: event.target.value })}
            />
          </label>
        )}
        {actionHasColor(action.type) && (
          <label>
            目标颜色
            <input
              type="color"
              value={action.color ?? '#ff6b6b'}
              onChange={(event) => onPatch({ color: event.target.value })}
            />
          </label>
        )}
        {actionHasVisible(action.type) && (
          <label>
            可见状态
            <select
              value={String(action.visible ?? true)}
              onChange={(event) => onPatch({ visible: event.target.value === 'true' })}
            >
              <option value="true">显示</option>
              <option value="false">隐藏</option>
            </select>
          </label>
        )}
        {actionHasOpacity(action.type) && (
          <label>
            透明度（{Math.round((action.opacity ?? 1) * 100)}%）
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={action.opacity ?? 1}
              onChange={(event) => onPatch({ opacity: Number(event.target.value) })}
            />
          </label>
        )}
        {actionHasPlay(action.type) && (
          <label>
            动画控制
            <select
              value={String(action.play ?? true)}
              onChange={(event) => onPatch({ play: event.target.value === 'true' })}
            >
              <option value="true">播放</option>
              <option value="false">暂停</option>
            </select>
          </label>
        )}
      </div>
    </div>
  );
}

/** 对象事件面板：只展示当前选中节点归属的规则，避免与场景级规则混在一起。 */
export function EventRuleList({
  scope,
  nodes,
  sources,
  selectedId,
  events,
  onAddEvent,
  onPatchRule,
  onPatchAction,
  onAddAction,
  onMoveAction,
  onDeleteAction,
  onDeleteEvent,
}: {
  scope: SceneEventScope;
  nodes: SceneNode[];
  sources: SceneDataSource[];
  selectedId: string | null;
  events: SceneEventRule[];
  onAddEvent: () => void;
  onPatchRule: (id: string, patch: Partial<SceneEventRule>) => void;
  onPatchAction: (ruleId: string, actionId: string, patch: Partial<SceneEventAction>) => void;
  onAddAction: (ruleId: string) => void;
  onMoveAction: (ruleId: string, actionId: string, direction: -1 | 1) => void;
  onDeleteAction: (ruleId: string, actionId: string) => void;
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
            : `${selectedName} 的点击、双击、悬停与数据变化交互`}
        </span>
        {scope !== 'scene' && (
          <button className="add-event" onClick={onAddEvent}>
            <Zap size={14} />
            添加对象事件
          </button>
        )}
      </div>
      {events.length ? (
        <div className="event-rule-list">
          {events.map((rule) => {
            const triggerNodeId = rule.trigger.nodeId ?? rule.ownerNodeId;
            const conditionError = rule.condition?.trim()
              ? validateConditionExpression(rule.condition)
              : null;
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
                      onChange={(event) => {
                        const type = event.target.value as SceneEventTriggerType;
                        onPatchRule(rule.id, {
                          trigger: {
                            ...rule.trigger,
                            type,
                            nodeId:
                              type === 'sceneLoad' || type === 'dataChange'
                                ? null
                                : rule.trigger.nodeId,
                          },
                        });
                      }}
                    >
                      {Object.entries(labels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {rule.trigger.type === 'dataChange' ? (
                    <label>
                      数据源
                      <select
                        value={rule.trigger.sourceId ?? ''}
                        onChange={(event) =>
                          onPatchRule(rule.id, {
                            trigger: { ...rule.trigger, sourceId: event.target.value || null },
                          })
                        }
                      >
                        <option value="">任意数据源</option>
                        {sources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
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
                  )}
                  <label className="event-form-wide">
                    条件表达式（白名单，可用 value / data / node 等变量，留空无条件）
                    <input
                      value={rule.condition ?? ''}
                      spellCheck={false}
                      placeholder='例如 value > 80 && data.status === "alarm"'
                      onChange={(event) => onPatchRule(rule.id, { condition: event.target.value })}
                    />
                  </label>
                  {conditionError && (
                    <span className="event-condition-error event-form-wide">
                      条件非法：{conditionError}
                    </span>
                  )}
                </div>
                <div className="event-action-list">
                  {rule.actions.map((action, index) => (
                    <ActionEditor
                      key={action.id}
                      action={action}
                      index={index}
                      total={rule.actions.length}
                      nodes={nodes}
                      onPatch={(patch) => onPatchAction(rule.id, action.id, patch)}
                      onMove={(direction) => onMoveAction(rule.id, action.id, direction)}
                      onDelete={() => onDeleteAction(rule.id, action.id)}
                    />
                  ))}
                  <button
                    type="button"
                    className="outline-button event-add-action"
                    onClick={() => onAddAction(rule.id)}
                  >
                    + 添加动作
                  </button>
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
