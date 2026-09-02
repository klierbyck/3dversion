import { History, X } from 'lucide-react';
import type { Release, RuntimeError } from '../types';

export function ReleaseDrawer({
  releases,
  errors,
  onClose,
  onRollback,
}: {
  releases: Release[];
  errors: RuntimeError[];
  onClose: () => void;
  onRollback: (release: Release) => void;
}) {
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className="release-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <span className="eyebrow">PUBLISH CENTER</span>
            <h2>发布记录</h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {releases.length ? (
          releases.map((release) => (
            <div className="release-card" key={release.id}>
              <div>
                <strong>{release.version}</strong>
                <span>{new Date(release.createdAt).toLocaleString('zh-CN')}</span>
              </div>
              <button className="outline-button" onClick={() => onRollback(release)}>
                回滚到此版本
              </button>
            </div>
          ))
        ) : (
          <div className="drawer-empty">
            <History size={25} />
            <strong>还没有发布版本</strong>
            <span>点击顶部“发布”创建第一个版本</span>
          </div>
        )}
        <div className="drawer-section">
          <div className="section-label">
            <span>运行错误</span>
            <span className="section-tag">{errors.length}</span>
          </div>
          {errors.length ? (
            errors.map((error) => (
              <div className="error-line" key={error.id}>
                <span className="error-type">{error.type}</span>
                <span>{error.message}</span>
              </div>
            ))
          ) : (
            <div className="no-errors">暂无运行错误</div>
          )}
        </div>
      </aside>
    </div>
  );
}
