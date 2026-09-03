import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
} from 'lucide-react';
import type { NodeKind, SceneNode } from '../types';
import type { SceneNodeDropPosition } from '../lib/sceneTree';

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

type TreeProps = {
  nodes: SceneNode[];
  parentId: string | null;
  level: number;
  selectedId: string | null;
  selectedIds: string[];
  collapsedIds: Set<string>;
  onSelect: (id: string, additive?: boolean) => void;
  onToggleVisible: (id: string) => void;
  onToggleLocked: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onMove: (
    id: string,
    targetId: string | null,
    position: SceneNodeDropPosition,
  ) => void;
  onFocus: (id: string) => void;
  iconFor: (kind: NodeKind) => ReactNode;
};

export function Tree(props: TreeProps) {
  const { nodes, parentId } = props;
  return (
    <>
      {nodes
        .filter((node) => node.parentId === parentId)
        .map((node) => {
          const hasChildren = nodes.some((item) => item.parentId === node.id);
          return (
            <TreeRow key={node.id} {...props} node={node} hasChildren={hasChildren} />
          );
        })}
    </>
  );
}

function TreeRow({
  nodes,
  node,
  hasChildren,
  level,
  selectedId,
  selectedIds,
  collapsedIds,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onToggleCollapsed,
  onRename,
  onMove,
  onFocus,
  iconFor,
}: TreeProps & { node: SceneNode; hasChildren: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(node.name);
  const [dropPosition, setDropPosition] = useState<SceneNodeDropPosition | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const collapsed = collapsedIds.has(node.id);
  const isSelected = selectedIds.includes(node.id);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commitRename = () => {
    const name = draft.trim();
    if (name && name !== node.name) onRename(node.id, name.slice(0, 64));
    setEditing(false);
  };

  return (
    <div>
      <div
        className={`tree-row ${isSelected ? 'selected' : ''} ${selectedId === node.id ? 'primary' : ''} ${dropPosition ? `drop-${dropPosition}` : ''}`}
        data-node-id={node.id}
        draggable={!editing}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('tree-node', node.id);
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('tree-node')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          const bounds = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientY - bounds.top) / bounds.height;
          const nextPosition: SceneNodeDropPosition =
            node.kind === 'group' && ratio >= 0.25 && ratio <= 0.75
              ? 'inside'
              : ratio < 0.5
                ? 'before'
                : 'after';
          if (dropPosition !== nextPosition) setDropPosition(nextPosition);
        }}
        onDragLeave={() => setDropPosition(null)}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const position = dropPosition;
          setDropPosition(null);
          const dragId = event.dataTransfer.getData('tree-node');
          if (!dragId || dragId === node.id || !position) return;
          onMove(dragId, node.id, position);
        }}
        onDragEnd={() => setDropPosition(null)}
      >
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
        {editing ? (
          <input
            ref={inputRef}
            className="tree-name-input"
            style={{ marginLeft: level * 16 }}
            value={draft}
            maxLength={64}
            onChange={(event) => setDraft(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitRename();
              if (event.key === 'Escape') {
                setDraft(node.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            className="tree-main"
            style={{ paddingLeft: level * 16 }}
            onClick={() => {
              // 单击行：选中并聚焦到该对象（已取消 Ctrl 加选）。
              onSelect(node.id);
              onFocus(node.id);
            }}
            onDoubleClick={() => {
              setDraft(node.name);
              setEditing(true);
            }}
            title="单击选中并聚焦，双击重命名，可拖拽调整层级"
          >
            {iconFor(node.kind)}
            <span>{node.name}</span>
          </button>
        )}
        <button
          className={`tree-action ${node.visible ? '' : 'muted'}`}
          title={node.visible ? '隐藏对象' : '显示对象'}
          onClick={() => onToggleVisible(node.id)}
        >
          {node.visible ? <Eye size={13} /> : <EyeOff size={13} />}
        </button>
        <button
          className={`tree-action tree-lock-action ${node.locked ? 'locked' : 'muted'}`}
          title={node.locked ? '解锁对象' : '锁定对象'}
          aria-label={node.locked ? `解锁${node.name}` : `锁定${node.name}`}
          onClick={() => onToggleLocked(node.id)}
        >
          {node.locked ? <Lock size={13} /> : <LockOpen size={13} />}
        </button>
      </div>
      {hasChildren && !collapsed && (
        <Tree
          nodes={nodes}
          parentId={node.id}
          level={level + 1}
          selectedId={selectedId}
          selectedIds={selectedIds}
          collapsedIds={collapsedIds}
          onSelect={onSelect}
          onToggleVisible={onToggleVisible}
          onToggleLocked={onToggleLocked}
          onToggleCollapsed={onToggleCollapsed}
          onRename={onRename}
          onMove={onMove}
          onFocus={onFocus}
          iconFor={iconFor}
        />
      )}
    </div>
  );
}
