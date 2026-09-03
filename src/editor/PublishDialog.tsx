import { useMemo, useState } from 'react';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';
import type { PublishIssue } from '../publishCheck';

export function PublishDialog({
  issues,
  nodeCount,
  onCancel,
  onConfirm,
}: {
  issues: PublishIssue[];
  nodeCount: number;
  onCancel: () => void;
  onConfirm: (notes: string) => void;
}) {
  const [notes, setNotes] = useState('');
  const errors = useMemo(() => issues.filter((issue) => issue.level === 'error'), [issues]);
  const warnings = useMemo(() => issues.filter((issue) => issue.level === 'warning'), [issues]);
  const grouped = useMemo(() => {
    const map = new Map<string, PublishIssue[]>();
    issues.forEach((issue) => {
      const list = map.get(issue.category) ?? [];
      list.push(issue);
      map.set(issue.category, list);
    });
    return [...map.entries()];
  }, [issues]);

  return (
    <div className="drawer-backdrop publish-backdrop" onClick={onCancel}>
      <div
        className="publish-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="发布确认"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="publish-dialog-head">
          <div>
            <span className="eyebrow">RELEASE CHECK</span>
            <h2>发布确认</h2>
          </div>
          <button className="icon-button" onClick={onCancel} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="publish-dialog-summary">
          <span>对象 {nodeCount} 个</span>
          <span className={errors.length ? 'publish-count-error' : 'publish-count-ok'}>
            错误 {errors.length}
          </span>
          <span className={warnings.length ? 'publish-count-warning' : 'publish-count-ok'}>
            警告 {warnings.length}
          </span>
        </div>
        {issues.length === 0 ? (
          <div className="publish-dialog-clean">
            <ShieldCheck size={20} />
            八项校验全部通过，可以发布。
          </div>
        ) : (
          <div className="publish-issue-list">
            {grouped.map(([category, list]) => (
              <div className="publish-issue-group" key={category}>
                <div className="section-label">
                  <span>{category}</span>
                  <span className="section-tag">{list.length}</span>
                </div>
                {list.map((issue, index) => (
                  <div
                    key={`${category}-${index}`}
                    className={`publish-issue-row publish-issue-${issue.level}`}
                  >
                    <AlertTriangle size={13} />
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
        <label className="field-label publish-notes">
          发布说明（可选）
          <textarea
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="本次发布的变更内容"
          />
        </label>
        <div className="publish-dialog-actions">
          <button className="outline-button" onClick={onCancel}>
            取消
          </button>
          <button
            className="primary-button"
            disabled={errors.length > 0}
            title={errors.length > 0 ? '存在阻断性错误，无法发布' : '生成新的发布版本'}
            onClick={() => onConfirm(notes.trim())}
          >
            {errors.length > 0 ? '修复错误后再发布' : '确认发布'}
          </button>
        </div>
      </div>
    </div>
  );
}
