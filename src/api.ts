import { demoById, demoProjects, emptyScene, upgradeDemoScene } from './demos';
import {
  uid,
  type ProjectMeta,
  type Release,
  type RuntimeError,
  type SceneDocument,
  type AssetMeta,
  type SceneDataSource,
} from './types';

// 未配置后端地址时直接使用本地持久化，避免独立运行前端产生无意义的网络错误。
const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;
const storeKey = 'three-vision-projects';
const legacyDraftKey = 'three-vision-project';
const legacyReleasesKey = 'three-vision-releases';

/** 单个项目的本地持久化结构：元信息 + 草稿 + 发布历史。 */
type StoredProject = {
  meta: ProjectMeta;
  draft: SceneDocument;
  revision: number;
  releases: Release[];
  assets?: AssetMeta[];
};
type ProjectStore = Record<string, StoredProject>;

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

function demoMeta(demo: (typeof demoProjects)[number], updatedAt?: string): ProjectMeta {
  const meta: ProjectMeta = {
    id: demo.id,
    name: demo.name,
    description: demo.description,
    icon: demo.icon,
    isDemo: demo.isDemo,
    runtime: demo.runtime,
  };
  return updatedAt ? { ...meta, updatedAt } : meta;
}

function seedStore(): ProjectStore {
  const now = Date.now();
  const store: ProjectStore = {};
  demoProjects.forEach((demo, index) => {
    // 错开时间戳，保证列表排序与示例目录顺序一致。
    store[demo.id] = {
      meta: demoMeta(demo, new Date(now - index * 60000).toISOString()),
      draft: demo.scene,
      revision: 0,
      releases: [],
    };
  });
  return store;
}

/** 旧版单项目 localStorage 数据迁移到首个示例项目，避免升级后丢失草稿与发布记录。 */
function migrateLegacy(store: ProjectStore) {
  const targetId = demoProjects[0]?.id;
  if (!targetId || !store[targetId]) return;
  const legacy = readJson(legacyDraftKey) as {
    scene?: SceneDocument;
    revision?: number;
  } | null;
  if (legacy?.scene?.nodes?.length) {
    store[targetId] = {
      ...store[targetId],
      draft: legacy.scene,
      revision: legacy.revision ?? 0,
    };
  }
  const legacyReleases = readJson(legacyReleasesKey);
  if (Array.isArray(legacyReleases) && legacyReleases.length > 0) {
    store[targetId] = {
      ...store[targetId],
      releases: legacyReleases as Release[],
    };
  }
}

function writeStore(store: ProjectStore) {
  try {
    localStorage.setItem(storeKey, JSON.stringify(store));
  } catch {
    /* 存储不可用时静默降级为内存态。 */
  }
}

/** 同步内置示例元信息，并将完全未编辑的旧默认场景升级到当前版本。 */
function syncDemoCatalog(store: ProjectStore): boolean {
  let changed = false;
  demoProjects.forEach((demo) => {
    const project = store[demo.id];
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      // 缓存被手工修改或旧版本写入空值时，重建该示例项目的最小可用记录。
      store[demo.id] = {
        meta: demoMeta(demo),
        draft: demo.scene,
        revision: 0,
        releases: [],
      };
      changed = true;
      return;
    }
    const meta = demoMeta(demo, project.meta?.updatedAt);
    const draft = upgradeDemoScene(demo.id, project.draft);
    if (JSON.stringify(project.meta) !== JSON.stringify(meta) || draft !== project.draft) {
      store[demo.id] = { ...project, meta, draft };
      changed = true;
    }
  });
  return changed;
}

function readStore(): ProjectStore {
  const raw = readJson(storeKey) as ProjectStore | null;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (syncDemoCatalog(raw)) writeStore(raw);
    return raw;
  }
  const store = seedStore();
  migrateLegacy(store);
  writeStore(store);
  return store;
}

function localSaveDraft(projectId: string, scene: SceneDocument, revision: number) {
  const store = readStore();
  const project = store[projectId];
  const updatedAt = new Date().toISOString();
  if (project) {
    store[projectId] = {
      ...project,
      draft: scene,
      revision: revision + 1,
      meta: { ...project.meta, updatedAt },
    };
  } else {
    store[projectId] = {
      meta: {
        id: projectId,
        name: '未命名项目',
        description: '',
        icon: '🌐',
        isDemo: false,
        updatedAt,
      },
      draft: scene,
      revision: revision + 1,
      releases: [],
    };
  }
  writeStore(store);
}

/** 后端项目列表与本地示例目录合并：补齐示例的图标、描述与运行态配置。 */
function mergeDemoCatalog(list: ProjectMeta[]): ProjectMeta[] {
  const merged = list.map((item) => {
    const demo = demoById(item.id);
    return demo
      ? {
          ...item,
          name: demo.name,
          icon: demo.icon,
          description: demo.description,
          isDemo: true,
          runtime: demo.runtime,
        }
      : item;
  });
  const known = new Set(list.map((item) => item.id));
  demoProjects.forEach((demo) => {
    if (!known.has(demo.id)) merged.push(demoMeta(demo));
  });
  return merged;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  if (API_BASE) {
    try {
      const response = await fetch(`${API_BASE}/projects`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.data)) return mergeDemoCatalog(data.data as ProjectMeta[]);
      }
    } catch {
      /* 接口不可用时退回本地项目库。 */
    }
  }
  return Object.values(readStore())
    .filter((project): project is StoredProject =>
      Boolean(project && typeof project === 'object' && !Array.isArray(project)),
    )
    .map((project) => ({
      ...(project.meta ?? {}),
      nodeCount: project.draft?.nodes?.length ?? 0,
    }))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

export async function getProject(projectId: string): Promise<ProjectMeta | null> {
  return (await listProjects()).find((item) => item.id === projectId) ?? null;
}

export async function createProject(name: string, description: string): Promise<ProjectMeta> {
  const payload = {
    name: name.trim() || '未命名项目',
    description: description.trim(),
  };
  if (API_BASE) {
    try {
      const response = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (response.ok) return (await response.json()).data as ProjectMeta;
    } catch {
      /* 创建接口不可用时退回本地。 */
    }
  }
  const store = readStore();
  const meta: ProjectMeta = {
    id: `project-${uid()}`,
    name: payload.name,
    description: payload.description || '暂无描述',
    icon: ['🌐', '🏢', '🏭', '📦', '⚡', '🚚'][Object.keys(store).length % 6],
    isDemo: false,
    updatedAt: new Date().toISOString(),
  };
  store[meta.id] = {
    meta,
    draft: { ...emptyScene, nodes: [] },
    revision: 0,
    releases: [],
  };
  writeStore(store);
  return meta;
}

export async function deleteProject(projectId: string): Promise<void> {
  if (API_BASE) {
    try {
      await fetch(`${API_BASE}/projects/${projectId}`, { method: 'DELETE' });
    } catch {
      /* 后端不可达时仍删除本地记录。 */
    }
  }
  const store = readStore();
  delete store[projectId];
  writeStore(store);
}

export async function saveDraft(
  projectId: string,
  scene: SceneDocument,
  revision: number,
): Promise<{ revision: number; local: boolean }> {
  if (!API_BASE) {
    localSaveDraft(projectId, scene, revision);
    return { revision: revision + 1, local: true };
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/projects/${projectId}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene, revision }),
    });
  } catch {
    // 后端不可达（未启动/网络断开）时降级到浏览器本地草稿，保证前端可独立体验。
    localSaveDraft(projectId, scene, revision);
    return { revision: revision + 1, local: true };
  }
  if (response.status === 409) throw new DraftConflictError();
  if (!response.ok) throw new Error(`保存失败：HTTP ${response.status}`);
  return {
    revision: (await response.json()).data.revision as number,
    local: false,
  };
}

export async function loadDraft(
  projectId: string,
): Promise<{ scene: SceneDocument; revision: number; local?: boolean } | null> {
  const local = (): {
    scene: SceneDocument;
    revision: number;
    local: boolean;
  } | null => {
    const project = readStore()[projectId];
    return project
      ? {
          // 对本地缓存做同一层场景兜底，避免旧数据为 null 时编辑器初始化崩溃。
          scene: upgradeDemoScene(projectId, project.draft),
          revision: project.revision ?? 0,
          local: true,
        }
      : null;
  };
  if (!API_BASE) return local();
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/draft`);
    if (!response.ok) throw new Error('接口不可用');
    const data = (await response.json()).data as
      { scene?: SceneDocument | null; revision?: number } | null | undefined;
    if (!data) return null;
    return {
      scene: upgradeDemoScene(projectId, data.scene),
      revision: data.revision ?? 0,
    };
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
    } catch {
      /* 接口不可用时退回本地发布历史。 */
    }
  }
  return readStore()[projectId]?.releases ?? [];
}

export async function createRelease(projectId: string, scene: SceneDocument): Promise<Release> {
  const createLocalRelease = () => {
    const store = readStore();
    const project = store[projectId];
    const history = project?.releases ?? [];
    const release: Release = {
      id: `local-${uid()}`,
      version: `v1.0.${history.length}`,
      createdAt: new Date().toISOString(),
      createdBy: '本地用户',
      scene,
    };
    store[projectId] = project
      ? { ...project, releases: [release, ...history] }
      : {
          meta: {
            id: projectId,
            name: '未命名项目',
            description: '',
            icon: '🌐',
            isDemo: false,
          },
          draft: scene,
          revision: 0,
          releases: [release],
        };
    writeStore(store);
    return release;
  };
  if (!API_BASE) return createLocalRelease();
  try {
    const response = await fetch(`${API_BASE}/projects/${projectId}/releases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scene }),
    });
    if (!response.ok) throw new Error('接口不可用');
    return (await response.json()).data;
  } catch {
    // 本地模式保留发布历史，保证没有后端时也能验证版本和回滚流程。
    return createLocalRelease();
  }
}

export async function reportRuntimeError(
  projectId: string,
  error: Omit<RuntimeError, 'id'> & { id?: string },
) {
  if (!API_BASE) return;
  try {
    await fetch(`${API_BASE}/runtime/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...error, projectId }),
    });
  } catch {
    /* 运行态错误不上抛，避免影响用户查看场景。 */
  }
}

function assetKind(file: File): AssetMeta['kind'] {
  return file.type.startsWith('image/') ? 'image' : 'model';
}

function normalizeAssetUrl(url: string): string {
  if (!API_BASE || !/^https?:\/\//.test(API_BASE) || /^(data:|blob:|https?:\/\/)/.test(url))
    return url;
  return new URL(url, API_BASE).toString();
}

function localAssets(projectId: string): AssetMeta[] {
  return readStore()[projectId]?.assets ?? [];
}

export async function listAssets(projectId: string): Promise<AssetMeta[]> {
  if (API_BASE) {
    try {
      const response = await fetch(`${API_BASE}/projects/${projectId}/assets`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.data)) {
          return (data.data as AssetMeta[]).map((asset) => ({
            ...asset,
            url: normalizeAssetUrl(asset.url),
          }));
        }
      }
    } catch {
      /* fallback to browser storage */
    }
  }
  return localAssets(projectId);
}

export async function uploadAsset(projectId: string, file: File): Promise<AssetMeta> {
  if (API_BASE) {
    try {
      const content = await file.arrayBuffer();
      const response = await fetch(`${API_BASE}/projects/${projectId}/assets`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-File-Name': encodeURIComponent(file.name),
        },
        body: content,
      });
      if (response.ok) {
        const asset = (await response.json()).data as AssetMeta;
        return { ...asset, url: normalizeAssetUrl(asset.url) };
      }
      const detail = await response.text();
      throw new Error(detail || `资源上传失败：HTTP ${response.status}`);
    } catch (error) {
      if (error instanceof TypeError) {
        /* API unavailable: retain a browser-only data URL asset. */
      } else {
        throw error;
      }
    }
  }
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('资源读取失败'));
    reader.readAsDataURL(file);
  });
  const asset: AssetMeta = {
    id: `asset-${uid()}`,
    projectId,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    kind: assetKind(file),
    url,
    createdAt: new Date().toISOString(),
  };
  const store = readStore();
  const project = store[projectId];
  if (project) {
    store[projectId] = { ...project, assets: [...(project.assets ?? []), asset] };
    writeStore(store);
  }
  return asset;
}

export async function testDataSource(source: SceneDataSource): Promise<unknown> {
  if (source.type === 'json') {
    return JSON.parse(source.json || '{}');
  }
  if (!source.url) throw new Error('请填写数据源地址');
  if (source.type === 'websocket') {
    return await new Promise((resolve, reject) => {
      const socket = new WebSocket(source.url!);
      const timer = window.setTimeout(
        () => {
          socket.close();
          reject(new Error('WebSocket 连接超时'));
        },
        (source.timeout ?? 10) * 1000,
      );
      socket.onopen = () => {
        window.clearTimeout(timer);
        socket.close();
        resolve({ connected: true });
      };
      socket.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('WebSocket 连接失败'));
      };
    });
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), (source.timeout ?? 10) * 1000);
  try {
    const response = await fetch(source.url, {
      method: 'GET',
      headers: source.headers,
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`数据请求失败：HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}
