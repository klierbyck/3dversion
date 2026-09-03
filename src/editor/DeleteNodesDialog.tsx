import { useEffect } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export function DeleteNodesDialog({
  nodeCount,
  childCount,
  groupCount,
  onCancel,
  onConfirm,
}: {
  nodeCount: number;
  childCount: number;
  groupCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog delete-nodes-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-nodes-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-head">
          <div>
            <span className="eyebrow">DELETE NODES</span>
            <h2 id="delete-nodes-title">确认删除{groupCount > 0 ? '分组' : '组件'}？</h2>
          </div>
          <button className="icon-button" onClick={onCancel} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="delete-dialog-message">
          <AlertTriangle size={18} />
          {groupCount > 0 ? (
            <p>
              将删除 {groupCount} 个分组及其包含的 {childCount} 个组件，共 {nodeCount}{' '}
              个节点。删除后可通过撤销恢复。
            </p>
          ) : (
            <p>将删除选中的 {nodeCount} 个组件。删除后可通过撤销恢复。</p>
          )}
        </div>
        <div className="dialog-actions">
          <button className="outline-button" onClick={onCancel}>
            取消
          </button>
          <button className="danger-button" onClick={onConfirm}>
            <Trash2 size={14} />
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
