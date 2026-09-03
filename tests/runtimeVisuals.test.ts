import { describe, expect, it } from 'vitest';
import { effectiveVisualNode, visualSignature } from '../src/lib/runtimeVisuals';
import { createNode } from '../src/types';

describe('运行态图表值', () => {
  it('柱图和仪表盘绑定值会改变视觉签名', () => {
    for (const kind of ['bar', 'gauge'] as const) {
      const node = createNode(kind, 0);
      const before = visualSignature(node);
      const effective = effectiveVisualNode(node, 88);
      expect(effective.value).toBe(88);
      expect(visualSignature(effective)).not.toBe(before);
    }
  });

  it('折线图绑定值会滚动到序列末尾', () => {
    const node = { ...createNode('line', 0), series: [10, 20, 30] };
    const effective = effectiveVisualNode(node, 42);
    expect(effective.series).toEqual([20, 30, 42]);
    expect(visualSignature(effective)).not.toBe(visualSignature(node));
  });

  it('非图表组件不触发几何重建签名', () => {
    expect(visualSignature(effectiveVisualNode(createNode('box', 0), 12))).toBeNull();
  });
});
