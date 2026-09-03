import { describe, expect, it } from 'vitest';
import { componentCatalog } from '../src/types';

describe('组件库不再提供“空组”组件', () => {
  it('组件目录中不存在 kind=group 的可拖拽组件', () => {
    expect(componentCatalog.some((item) => item.kind === 'group')).toBe(false);
    expect(componentCatalog.some((item) => item.label === '空组')).toBe(false);
  });

  it('基础组件仍然保留（移除空组不影响其它组件）', () => {
    const kinds = componentCatalog.map((item) => item.kind);
    for (const kind of ['box', 'sphere', 'plane', 'text']) {
      expect(kinds).toContain(kind);
    }
  });

  it('分组仍作为合法节点类型存在（由“添加分组”创建，而非组件拖出）', () => {
    // group 不再出现在目录，但 NodeKind 联合类型仍由场景树“添加分组”使用。
    const catalogKinds = new Set(componentCatalog.map((item) => item.kind));
    expect(catalogKinds.has('group')).toBe(false);
  });
});
