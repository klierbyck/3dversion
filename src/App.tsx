import { useEffect, useState } from 'react';
import { getProject } from './api';
import EditorPage from './EditorPage';
import ProjectsPage from './ProjectsPage';
import type { ProjectMeta } from './types';

type Route = { name: 'projects' } | { name: 'editor'; projectId: string };

/** 哈希路由：#/ 为项目列表，#/project/:id 为项目编辑器。 */
function parseRoute(): Route {
  const match = /^#\/project\/([^/?#]+)/.exec(window.location.hash);
  return match ? { name: 'editor', projectId: decodeURIComponent(match[1]) } : { name: 'projects' };
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute);

  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', '#/');
    const sync = () => setRoute(parseRoute());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    document.title = route.name === 'editor' ? '3D Vision · 场景编辑' : '3D Vision · 项目中心';
  }, [route]);

  if (route.name === 'editor')
    return <EditorRoute key={route.projectId} projectId={route.projectId} />;
  return <ProjectsPage />;
}

function EditorRoute({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProject(null);
    setNotFound(false);
    void getProject(projectId).then((meta) => {
      if (cancelled) return;
      if (meta) {
        setProject(meta);
        document.title = `3D Vision · ${meta.name}`;
      } else {
        setNotFound(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const back = () => {
    window.location.hash = '#/';
  };

  if (notFound)
    return (
      <div className="page-loading">
        <p>项目不存在或已被删除</p>
        <button className="outline-button" onClick={back}>
          返回项目列表
        </button>
      </div>
    );
  if (!project) return <div className="page-loading">项目加载中…</div>;
  return <EditorPage project={project} onExit={back} />;
}
