import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Plus, Rotate3d, Search, Trash2, X } from 'lucide-react';
import { createProject, deleteProject, listProjects } from './api';
import type { ProjectMeta } from './types';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listProjects().then((list) => {
      if (!cancelled) setProjects(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      (projects ?? []).filter((item) =>
        `${item.name}${item.description}`.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [projects, query],
  );

  const open = (id: string) => {
    window.location.hash = `#/project/${encodeURIComponent(id)}`;
  };

  const handleCreate = (name: string, description: string) => {
    setCreating(false);
    void createProject(name, description).then((meta) => open(meta.id));
  };

  const handleDelete = (meta: ProjectMeta) => {
    if (!window.confirm(`确定删除项目「${meta.name}」？草稿与发布记录将一并移除，且不可恢复。`))
      return;
    void deleteProject(meta.id).then(() => void listProjects().then(setProjects));
  };

  return (
    <div className="projects-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Rotate3d size={18} />
          </div>
          <div>
            <strong>3D Vision</strong>
            <span>三维可视化搭建平台</span>
          </div>
        </div>
        <div className="toolbar-actions">
          <button className="avatar" title="当前用户">
            陈
          </button>
        </div>
      </header>
      <main className="projects-main">
        <div className="projects-head">
          <div>
            <span className="eyebrow">PROJECTS</span>
            <h1>我的项目</h1>
            <p>
              {projects
                ? `共 ${projects.length} 个项目，点击卡片进入场景编辑器`
                : '正在加载项目列表…'}
            </p>
          </div>
          <div className="projects-actions">
            <div className="projects-search">
              <Search size={15} />
              <input
                placeholder="搜索项目"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button className="primary-button" onClick={() => setCreating(true)}>
              <Plus size={15} />
              新建项目
            </button>
          </div>
        </div>
        {projects && filtered.length === 0 ? (
          <div className="projects-empty">
            <LayoutGrid size={26} />
            <strong>{query ? '没有匹配的项目' : '还没有项目'}</strong>
            <span>{query ? '换个关键词试试' : '点击右上角“新建项目”创建第一个三维场景'}</span>
          </div>
        ) : (
          <div className="project-grid">
            {filtered.map((meta) => (
              <div
                className="project-card"
                key={meta.id}
                role="button"
                tabIndex={0}
                onClick={() => open(meta.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') open(meta.id);
                }}
              >
                <span className="project-icon">{meta.icon}</span>
                <span className="project-card-body">
                  <span className="project-card-title">
                    <strong>{meta.name}</strong>
                    {meta.isDemo && <em className="demo-badge">示例</em>}
                  </span>
                  <span className="project-card-desc">{meta.description || '暂无描述'}</span>
                  <span className="project-card-meta">
                    {meta.nodeCount ?? 0} 个对象 · {formatTime(meta.updatedAt)}
                  </span>
                </span>
                {!meta.isDemo && (
                  <span
                    className="card-delete"
                    role="button"
                    aria-label={`删除 ${meta.name}`}
                    title="删除项目"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(meta);
                    }}
                  >
                    <Trash2 size={14} />
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      {creating && <CreateDialog onCancel={() => setCreating(false)} onCreate={handleCreate} />}
    </div>
  );
}

function formatTime(iso?: string) {
  if (!iso) return '示例项目';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '示例项目'
    : date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
}

function CreateDialog({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (name: string, description: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const submit = () => {
    if (name.trim()) onCreate(name, description);
  };
  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="dialog-head">
          <div>
            <span className="eyebrow">NEW PROJECT</span>
            <h2>新建项目</h2>
          </div>
          <button className="icon-button" onClick={onCancel} title="关闭">
            <X size={18} />
          </button>
        </div>
        <label className="field-label">
          项目名称
          <input
            autoFocus
            placeholder="例如：数据中心监控大屏"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit();
            }}
          />
        </label>
        <label className="field-label">
          项目描述
          <textarea
            placeholder="简单描述这个项目的用途（可选）"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="dialog-actions">
          <button className="outline-button" onClick={onCancel}>
            取消
          </button>
          <button className="primary-button" disabled={!name.trim()} onClick={submit}>
            <Plus size={14} />
            创建项目
          </button>
        </div>
      </div>
    </div>
  );
}
