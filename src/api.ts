import type { Release, RuntimeError, SceneDocument } from './types';

// 未配置后端地址时直接使用本地持久化，避免独立运行前端产生无意义的网络错误。
const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const localKey = 'three-vision-project';
const releasesKey = 'three-vision-releases';

/** 草稿版本冲突（HTTP 409）：远端已有更新的草稿，需要用户刷新加载。 */
export class DraftConflictError extends Error {
  constructor() {
    super('草稿已被其他窗口修改');
    this.name = 'DraftConflictError';
  }
}

function readJson(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // 本地缓存损坏时不让页面崩溃，等同于没有缓存。
    return null;
  }
}

function localReleases(): Release[] {
  const history = readJson(releasesKey);
  return Array.isArray(history) ? (history as Release[]) : [];
}

export async function saveDraft(projectId: string, scene: SceneDocument, revision: number): Promise<{ revision: number; local: boolean }> {
  if (!API_BASE) {
    localStorage.setItem(localKey, JSON.stringify({ scene, revision: revision + 1 }));
    return { revision: revision + 1, local: true };
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/projects/${projectId}/draft`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scene, revision }) });
  } catch {
    // 后端不可达（未启动/网络断开）时降级到浏览器本地草稿，保证前端可独立体验。
    localStorage.setItem(localKey, JSON.stringify({ scene, revision: revision + 1 }));
    return { revision: revision + 1, local: true };
  }
  if (response.status === 409) throw new DraftConflictError();
  if (!response.ok) throw new Error(`保存失败：HTTP ${response.status}`);
  return { revision: (await response.json()).data.revision as number, local: false };
}

export async function loadDraft(projectId: string): Promise<{ scene: SceneDocument; revision: number; local?: boolean } | null> {
  const local = (): { scene: SceneDocument; revision: number; local: boolean } | null => {
    const project = readJson(localKey) as { scene?: SceneDocument; revision?: number } | null;
    return project?.scene ? { scene: project.scene, revision: project.revision ?? 0, local: true } : null;
  };
  if (!API_BASE) return local();
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/draft`);
    if (!response.ok) throw new Error('接口不可用');
    return (await response.json()).data;
  } catch {
    return local();
  }
}

export async function listReleases(projectId: string): Promise<Release[]> {
  if (API_BASE) {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/releases`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.data)) return data.data as Release[];
      }
    } catch { /* 接口不可用时退回本地发布历史。 */ }
  }
  return localReleases();
}

export async function createRelease(projectId: string, scene: SceneDocument): Promise<Release> {
  const createLocalRelease = () => {
    const history = localReleases();
    const release: Release = { id: `local-${crypto.randomUUID()}`, version: `v1.0.${history.length}`, createdAt: new Date().toISOString(), createdBy: '本地用户', scene };
    localStorage.setItem(releasesKey, JSON.stringify([release, ...history]));
    return release;
  };
  if (!API_BASE) return createLocalRelease();
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/releases`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scene }) });
    if (!response.ok) throw new Error('接口不可用');
    return (await response.json()).data;
  } catch {
    // 本地模式保留发布历史，保证没有后端时也能验证版本和回滚流程。
    return createLocalRelease();
  }
}

export async function reportRuntimeError(projectId: string, error: Omit<RuntimeError, 'id'> & { id?: string }) {
  if (!API_BASE) return;
  try {
    await fetch(`${API_BASE}/runtime/errors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...error, projectId }) });
  } catch { /* 运行态错误不上抛，避免影响用户查看场景。 */ }
}
