import type { SceneNode } from '../types';

/**
 * 收集某节点自身及其全部后代节点 id（按 parentId 递归，多层嵌套也覆盖）。
 * 结果集合包含 rootId 自身。
 */
export function collectSubtreeIds(nodes: SceneNode[], rootId: string): string[] {
  const result = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parentId && result.has(node.parentId) && !result.has(node.id)) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return [...result];
}

/** 判断 maybeDescendant 是否为 rootId 自身或其后代（用于禁止拖入自己的子树）。 */
export function isNodeInSubtree(
  nodes: SceneNode[],
  rootId: string,
  maybeDescendant: string,
): boolean {
  return collectSubtreeIds(nodes, rootId).includes(maybeDescendant);
}

export type SceneNodeDropPosition = 'before' | 'inside' | 'after';

/**
 * 按场景树拖放结果移动节点：节点行前后用于排序，分组行内部用于收纳子节点。
 * targetId 为 null 时把节点移动到根级末尾。
 */
export function moveSceneNode(
  nodes: SceneNode[],
  nodeId: string,
  targetId: string | null,
  position: SceneNodeDropPosition,
): SceneNode[] {
  const moving = nodes.find((node) => node.id === nodeId);
  if (!moving) return nodes;

  if (targetId === null) {
    const remaining = nodes.filter((node) => node.id !== nodeId);
    return [...remaining, { ...moving, parentId: null }];
  }

  const target = nodes.find((node) => node.id === targetId);
  if (!target || isNodeInSubtree(nodes, nodeId, targetId)) return nodes;
  if (position === 'inside' && target.kind !== 'group') return nodes;

  const nextParentId = position === 'inside' ? target.id : target.parentId;
  const moved = { ...moving, parentId: nextParentId };
  const remaining = nodes.filter((node) => node.id !== nodeId);

  if (position === 'inside') return [...remaining, moved];

  const targetIndex = remaining.findIndex((node) => node.id === targetId);
  if (targetIndex < 0) return nodes;
  const insertAt = position === 'after' ? targetIndex + 1 : targetIndex;
  return [...remaining.slice(0, insertAt), moved, ...remaining.slice(insertAt)];
}

/**
 * 整体切换某个可级联字段（visible / locked）。
 * - 分组节点（kind === 'group'）：自身与全部后代一起被设置为目标值；
 * - 普通节点：只改自身。
 * 返回新的 nodes 数组，不修改入参。
 */
export function applySubtreeToggle(
  nodes: SceneNode[],
  rootId: string,
  field: 'visible' | 'locked',
  value: boolean,
): SceneNode[] {
  const target = nodes.find((node) => node.id === rootId);
  if (!target) return nodes;
  const ids = new Set(
    target.kind === 'group' ? collectSubtreeIds(nodes, rootId) : [rootId],
  );
  return nodes.map((node) =>
    ids.has(node.id) ? { ...node, [field]: value } : node,
  );
}

/** 单选归一：无论之前选择集如何，单击后只保留目标节点（或清空）。 */
export function normalizeSingleSelection(
  id: string | null,
): { selectedId: string | null; selectedIds: string[] } {
  return id ? { selectedId: id, selectedIds: [id] } : { selectedId: null, selectedIds: [] };
}
