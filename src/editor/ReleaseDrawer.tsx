import { useMemo, useState } from 'react';
import { History, Trash2, X } from 'lucide-react';
import type { Release, RuntimeError } from '../types';

const ERROR_PAGE_SIZE = 10;

export function ReleaseDrawer({
  releases,
  errors,
  onClose,
  onRollback,
  onDeleteError,
  onClearErrors,
}: {
  releases: Release[];
  errors: RuntimeError[];
  onClose: () => void;
  onRollback: (release: Release) => void;
  onDeleteError: (errorId: string) => void;
  onClearErrors: () => void;
}) {
  const [levelFilter, setLevelFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const errorTypes = useMemo(
    () => [...new Set(errors.map((error) => error.type))],
    [errors],
  );
  const filtered = useMemo(
    () =>
      errors.filter(
        (error) =>
          (!levelFilter || (error.level ?? 'error') === levelFilter) &&
          (!typeFilter || error.type === typeFilter),
      ),
    [errors, levelFilter, typeFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ERROR_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * ERROR_PAGE_SIZE, safePage * ERROR_PAGE_SIZE);

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
          <div className="section-label error-log-head">
            <span>运行错误（{filtered.length}/{errors.length}）</span>
            {errors.length > 0 && (
              <button
                className="outline-button error-clear-button"
                onClick={() => {
                  if (window.confirm('确定清空该项目的全部运行错误日志？')) onClearErrors();
                }}
              >
                <Trash2 size={12} /> 清空
              </button>
            )}
          </div>
          {errors.length > 0 && (
            <div className="error-filter-row">
              <select
                aria-label="按级别筛选"
                value={levelFilter}
                onChange={(event) => {
                  setLevelFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部级别</option>
                <option value="error">错误</option>
                <option value="warn">警告</option>
              </select>
              <select
                aria-label="按类型筛选"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">全部类型</option>
                {errorTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          )}
          {paged.length ? (
            paged.map((error) => (
              <div className="error-line" key={error.id}>
                <div className="error-line-main">
                  <span className={`error-type error-level-${error.level ?? 'error'}`}>
                    {error.level ?? 'error'}
                  </span>
                  <span className="error-type">{error.type}</span>
                  {error.version && <span className="error-version">{error.version}</span>}
                  <span title={error.source ?? error.browser}>{error.message}</span>
                </div>
                <div className="error-line-meta">
                  <span>{new Date(error.createdAt).toLocaleString('zh-CN')}</span>
                  <button
                    className="icon-button"
                    aria-label="删除该错误"
                    onClick={() => onDeleteError(error.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="no-errors">暂无运行错误</div>
          )}
          {totalPages > 1 && (
            <div className="error-pager">
              <button
                className="outline-button"
                disabled={safePage <= 1}
                onClick={() => setPage(safePage - 1)}
              >
                上一页
              </button>
              <span>
                {safePage}/{totalPages}
              </span>
              <button
                className="outline-button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(safePage + 1)}
              >
                下一页
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
