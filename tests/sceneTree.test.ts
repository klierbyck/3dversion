import { describe, expect, it } from 'vitest';
import type { SceneNode } from '../src/types';
import {
  applySubtreeToggle,
  collectSubtreeIds,
  isNodeInSubtree,
  moveSceneNode,
  normalizeSingleSelection,
} from '../src/lib/sceneTree';

/** 构造最小可用节点，仅关心 id / kind / parentId / visible / locked。 */
function makeNode(
  id: string,
  kind: SceneNode['kind'] = 'box',
  parentId: string | null = null,
): SceneNode {
  return {
    id,
    name: id,
    kind,
    parentId,
    visible: true,
    locked: false,
  } as unknown as SceneNode;
}

/** 结构：g(组) -> a -> b；g -> c；d 为顶层独立节点。 */
function buildTree(): SceneNode[] {
  return [
    makeNode('g', 'group', null),
    makeNode('a', 'box', 'g'),
    makeNode('b', 'box', 'a'),
    makeNode('c', 'box', 'g'),
    makeNode('d', 'box', null),
  ];
}

describe('collectSubtreeIds 后代收集', () => {
  it('收集自身与多层后代，且不包含无关节点', () => {
    const ids = collectSubtreeIds(buildTree(), 'g');
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'g']);
    expect(ids).not.toContain('d');
  });

  it('叶子节点只返回自身', () => {
    expect(collectSubtreeIds(buildTree(), 'd')).toEqual(['d']);
  });
});

describe('isNodeInSubtree 子树判断', () => {
  it('孙节点属于组子树，顶层节点不属于，组自身属于', () => {
    const nodes = buildTree();
    expect(isNodeInSubtree(nodes, 'g', 'b')).toBe(true);
    expect(isNodeInSubtree(nodes, 'g', 'g')).toBe(true);
    expect(isNodeInSubtree(nodes, 'g', 'd')).toBe(false);
  });
});

describe('applySubtreeToggle 整体显隐/锁定', () => {
  it('隐藏分组时，组与全部后代一起隐藏，组外节点不受影响', () => {
    const next = applySubtreeToggle(buildTree(), 'g', 'visible', false);
    const map = new Map(next.map((node) => [node.id, node.visible]));
    expect(map.get('g')).toBe(false);
    expect(map.get('a')).toBe(false);
    expect(map.get('b')).toBe(false);
    expect(map.get('c')).toBe(false);
    expect(map.get('d')).toBe(true);
  });

  it('锁定分组时级联到全部后代', () => {
    const next = applySubtreeToggle(buildTree(), 'g', 'locked', true);
    const locked = next.filter((node) => node.locked).map((node) => node.id).sort();
    expect(locked).toEqual(['a', 'b', 'c', 'g']);
  });

  it('再次整体显示可恢复全部后代', () => {
    let next = applySubtreeToggle(buildTree(), 'g', 'visible', false);
    next = applySubtreeToggle(next, 'g', 'visible', true);
    expect(next.every((node) => node.visible)).toBe(true);
  });

  it('普通节点只切换自身，不影响兄弟或父级', () => {
    const next = applySubtreeToggle(buildTree(), 'a', 'visible', false);
    const map = new Map(next.map((node) => [node.id, node.visible]));
    expect(map.get('a')).toBe(false);
    expect(map.get('b')).toBe(true);
    expect(map.get('c')).toBe(true);
    expect(map.get('g')).toBe(true);
  });

  it('目标不存在时原样返回，不产生新数组', () => {
    const nodes = buildTree();
    expect(applySubtreeToggle(nodes, 'missing', 'visible', false)).toBe(nodes);
  });

  it('不修改入参（不可变更新）', () => {
    const nodes = buildTree();
    const snapshot = nodes.map((node) => node.visible);
    applySubtreeToggle(nodes, 'g', 'visible', false);
    expect(nodes.map((node) => node.visible)).toEqual(snapshot);
  });
});

describe('normalizeSingleSelection 单选归一（已取消 Ctrl 加选）', () => {
  it('给定 id 时只保留该节点', () => {
    expect(normalizeSingleSelection('x')).toEqual({ selectedId: 'x', selectedIds: ['x'] });
  });

  it('null 时清空选择', () => {
    expect(normalizeSingleSelection(null)).toEqual({ selectedId: null, selectedIds: [] });
  });
});

describe('moveSceneNode 场景树拖拽', () => {
  it('可在同级节点前后调整顺序', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    expect(moveSceneNode(nodes, 'c', 'a', 'before').map((node) => node.id)).toEqual([
      'c',
      'a',
      'b',
    ]);
    expect(moveSceneNode(nodes, 'a', 'b', 'after').map((node) => node.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('可移入分组并追加到分组子节点末尾', () => {
    const nodes = [makeNode('g', 'group'), makeNode('a', 'box', 'g'), makeNode('b')];
    const next = moveSceneNode(nodes, 'b', 'g', 'inside');
    expect(next.find((node) => node.id === 'b')?.parentId).toBe('g');
    expect(next.filter((node) => node.parentId === 'g').map((node) => node.id)).toEqual([
      'a',
      'b',
    ]);
  });

  it('不可移入普通组件或自身子树', () => {
    const nodes = buildTree();
    expect(moveSceneNode(nodes, 'd', 'a', 'inside')).toBe(nodes);
    expect(moveSceneNode(nodes, 'g', 'b', 'after')).toBe(nodes);
  });

  it('拖到场景树空白处会移回根级末尾', () => {
    const nodes = buildTree();
    const next = moveSceneNode(nodes, 'a', null, 'inside');
    expect(next.at(-1)).toMatchObject({ id: 'a', parentId: null });
  });
});
