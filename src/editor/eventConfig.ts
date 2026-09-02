import type {
  SceneEventActionType,
  SceneEventRule,
  SceneEventScope,
  SceneEventTriggerType,
  SceneTimelineProperty,
} from '../types';

export const sceneTriggerLabels: Record<SceneEventTriggerType, string> = {
  sceneLoad: '场景加载',
  click: '任意对象点击',
  doubleClick: '任意对象双击',
  hover: '任意对象悬停',
};

export const nodeTriggerLabels: Pick<
  Record<SceneEventTriggerType, string>,
  'click' | 'doubleClick' | 'hover'
> = {
  click: '点击',
  doubleClick: '双击',
  hover: '悬停',
};

export const actionLabels: Record<SceneEventActionType, string> = {
  focusCamera: '相机聚焦',
  showPopup: '显示弹窗',
  setColor: '设置颜色',
  setVisibility: '显示/隐藏',
};

export const timelinePropertyLabels: Record<SceneTimelineProperty, string> = {
  position: '位置',
  rotation: '旋转',
  scale: '缩放',
  color: '颜色',
  opacity: '透明度',
  visible: '显隐',
};

/** 兼容旧草稿：场景加载规则视为场景级，其余旧规则视为对象级。 */
export function getEventScope(rule: SceneEventRule): SceneEventScope {
  return rule.scope ?? (rule.trigger.type === 'sceneLoad' ? 'scene' : 'node');
}

export function getEventOwnerId(rule: SceneEventRule): string | null {
  return rule.ownerNodeId ?? rule.trigger.nodeId ?? null;
}
