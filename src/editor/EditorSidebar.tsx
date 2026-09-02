import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react';
import type { NodeKind, SceneNode } from '../types';

/** 组件分类横向滚动条：两端箭头按钮滚动，滚动到边界时对应箭头置灰。 */
export function CategoryScroller({
  categories,
  value,
  onChange,
}: {
  categories: readonly string[];
  value: string;
  onChange: (category: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateArrows]);

  const scrollBy = (direction: 1 | -1) => {
    scrollRef.current?.scrollBy({ left: direction * 96, behavior: 'smooth' });
  };

  return (
    <div className="category-list">
      <button
        className="category-arrow"
        disabled={!canLeft}
        onClick={() => scrollBy(-1)}
        title="向左滚动分类"
      >
        <ChevronLeft size={14} />
      </button>
      <div className="category-scroll" ref={scrollRef} onScroll={updateArrows}>
        {categories.map((item) => (
          <button
            className={`category-item ${value === item ? 'selected' : ''}`}
            key={item}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <button
        className="category-arrow"
        disabled={!canRight}
        onClick={() => scrollBy(1)}
        title="向右滚动分类"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

export function Tree({
  nodes,
  parentId,
  level,
  selectedId,
  collapsedIds,
  onSelect,
  onToggleVisible,
  onToggleCollapsed,
  iconFor,
}: {
  nodes: SceneNode[];
  parentId: string | null;
  level: number;
  selectedId: string | null;
  collapsedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  iconFor: (kind: NodeKind) => ReactNode;
}) {
  return (
    <>
      {nodes
        .filter((node) => node.parentId === parentId)
        .map((node) => {
          const hasChildren = nodes.some((item) => item.parentId === node.id);
          const collapsed = collapsedIds.has(node.id);
          return (
            <div key={node.id}>
              <div className={`tree-row ${selectedId === node.id ? 'selected' : ''}`}>
                {hasChildren ? (
                  <button
                    className="tree-caret"
                    title={collapsed ? '展开子节点' : '折叠子节点'}
                    aria-expanded={!collapsed}
                    onClick={() => onToggleCollapsed(node.id)}
                  >
                    {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </button>
                ) : (
                  <span className="tree-spacer" />
                )}
                <button
                  className="tree-main"
                  style={{ paddingLeft: level * 16 }}
                  onClick={() => onSelect(node.id)}
                >
                  {iconFor(node.kind)}
                  <span>{node.name}</span>
                </button>
                <button
                  className={`tree-action ${node.visible ? '' : 'muted'}`}
                  title={node.visible ? '隐藏对象' : '显示对象'}
                  onClick={() => onToggleVisible(node.id)}
                >
                  {node.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
              </div>
              {hasChildren && !collapsed && (
                <Tree
                  nodes={nodes}
                  parentId={node.id}
                  level={level + 1}
                  selectedId={selectedId}
                  collapsedIds={collapsedIds}
                  onSelect={onSelect}
                  onToggleVisible={onToggleVisible}
                  onToggleCollapsed={onToggleCollapsed}
                  iconFor={iconFor}
                />
              )}
            </div>
          );
        })}
    </>
  );
}
