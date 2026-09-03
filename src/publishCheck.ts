import type { AssetMeta, SceneDocument, SceneNode } from './types';
import { validateConditionExpression, validateNode } from './schemas/validate';

export type PublishIssueLevel = 'error' | 'warning';
export type PublishIssue = {
  level: PublishIssueLevel;
  /** 对应需求 5.2 的八个校验维度。 */
  category: string;
  message: string;
};

const CURRENT_SCHEMA_VERSION = '1.1.0';
const KNOWN_KINDS = new Set<SceneNode['kind']>([
  'group', 'box', 'sphere', 'plane', 'image', 'model', 'text', 'light',
  'directionalLight', 'ambientLight', 'camera', 'bar', 'line', 'gauge',
  'label', 'popup', 'building', 'factory', 'warehouse', 'office', 'tank',
  'coolingTower', 'pipeline', 'road', 'tree', 'windTurbine', 'solarPanel',
  'conveyor', 'gantryCrane', 'truck', 'car', 'bus', 'forklift', 'trafficLight',
  'parkingGate', 'streetLight', 'fence', 'securityBooth', 'fireHydrant',
  'chargingPile', 'pump', 'valve', 'transformer', 'electricalCabinet',
  'sensor', 'cctv', 'accessControl', 'robotArm', 'machineTool', 'displayStand',
  'ledScreen', 'storageRack', 'pallet', 'agv', 'bridge', 'transmissionTower',
  'serverRack', 'precisionAc', 'ups',
]);
const ALLOWED_ASSET_MIME = new Set([
  'model/gltf-binary',
  'model/gltf+json',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/octet-stream',
]);
const MAX_ASSET_BYTES = 100 * 1024 * 1024;
const TARGETED_ACTIONS = new Set([
  'focusCamera',
  'setColor',
  'setVisibility',
  'setOpacity',
  'playAnimation',
]);

/** 发布前八项校验：error 阻断发布，warning 需用户在确认框中知悉。 */
export function validateSceneForPublish(
  scene: SceneDocument,
  assets: AssetMeta[],
): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const push = (level: PublishIssueLevel, category: string, message: string) =>
    issues.push({ level, category, message });
  const nodes = scene.nodes ?? [];

  // 1. JSON Schema：逐节点字段校验
  nodes.forEach((node) => {
    const errors = validateNode(node);
    Object.entries(errors).forEach(([field, message]) =>
      push('error', 'JSON Schema', `「${node.name}」${field}：${message}`),
    );
  });

  // 2. 节点父子关系：悬空父级 + 循环父级
  const byId = new Map(nodes.map((node) => [node.id, node]));
  nodes.forEach((node) => {
    if (node.parentId !== null && !byId.has(node.parentId)) {
      push('error', '节点父子关系', `「${node.name}」的父节点不存在`);
    }
    const seen = new Set<string>();
    let current: SceneNode | undefined = node;
    while (current?.parentId) {
      if (seen.has(current.id)) {
        push('error', '节点父子关系', `「${node.name}」所在层级存在循环引用`);
        break;
      }
      seen.add(current.id);
      current = byId.get(current.parentId);
    }
  });

  // 3. 资源存在性 + 4. 资源大小/格式
  const assetByUrl = new Map(assets.map((asset) => [asset.url, asset]));
  nodes.forEach((node) => {
    if (node.kind !== 'model' && node.kind !== 'image') return;
    if (!node.assetPath) {
      push('warning', '资源存在性', `「${node.name}」尚未配置资源文件，将使用占位外观`);
      return;
    }
    if (node.assetPath.startsWith('data:') || node.assetPath.startsWith('blob:')) {
      push('warning', '资源存在性', `「${node.name}」使用浏览器本地资源，换设备访问可能丢失`);
    } else if (!assetByUrl.has(node.assetPath)) {
      push('error', '资源存在性', `「${node.name}」引用的资源未上传或已被删除`);
    }
  });
  assets.forEach((asset) => {
    if (asset.size > MAX_ASSET_BYTES) {
      push('error', '资源大小/格式', `资源「${asset.name}」超过 100MB 上限`);
    }
    if (asset.mimeType && !ALLOWED_ASSET_MIME.has(asset.mimeType)) {
      push('error', '资源大小/格式', `资源「${asset.name}」格式 ${asset.mimeType} 不受支持`);
    }
  });

  // 5. 数据源配置
  const sources = scene.dataSources ?? [];
  const sourceIds = new Set(sources.map((source) => source.id));
  sources.forEach((source) => {
    if (source.type === 'rest' && !source.url?.trim()) {
      push('error', '数据源配置', `数据源「${source.name}」缺少请求地址`);
    }
    if (source.type === 'json') {
      try {
        JSON.parse(source.json ?? '{}');
      } catch {
        push('error', '数据源配置', `数据源「${source.name}」的静态 JSON 无法解析`);
      }
    }
    if (source.timeout !== undefined && !(source.timeout >= 1 && source.timeout <= 60)) {
      push('error', '数据源配置', `数据源「${source.name}」超时时间需在 1-60 秒之间`);
    }
  });
  nodes.forEach((node) => {
    node.dataBindings?.forEach((binding) => {
      if (!sourceIds.has(binding.sourceId)) {
        push('error', '数据源配置', `「${node.name}」绑定了已删除的数据源`);
      }
      if (!binding.path.trim()) {
        push('error', '数据源配置', `「${node.name}」存在空的数据路径绑定`);
      }
    });
  });

  // 6. 事件表达式（白名单校验在编辑层，发布前再兜底一次）
  (scene.events ?? []).forEach((rule) => {
    if (rule.condition?.trim()) {
      const error = validateConditionExpression(rule.condition);
      if (error) push('error', '事件表达式', `事件「${rule.name}」条件非法：${error}`);
    }
    if (rule.actions.length === 0) {
      push('error', '事件表达式', `事件「${rule.name}」没有配置任何动作`);
    }
    rule.actions.forEach((action) => {
      const fallbackTarget = rule.trigger.nodeId ?? rule.ownerNodeId;
      if (TARGETED_ACTIONS.has(action.type) && !action.targetId && !fallbackTarget) {
        push('error', '事件表达式', `事件「${rule.name}」的动作缺少作用对象`);
      }
    });
    if (rule.trigger.type === 'dataChange' && rule.trigger.sourceId &&
      !sourceIds.has(rule.trigger.sourceId)) {
      push('error', '事件表达式', `事件「${rule.name}」关联的数据源不存在`);
    }
  });

  // 7. 组件版本
  if (scene.schemaVersion && scene.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    push(
      'warning',
      '组件版本',
      `场景版本 ${scene.schemaVersion} 与当前 ${CURRENT_SCHEMA_VERSION} 不一致，将按兼容规则发布`,
    );
  }
  nodes.forEach((node) => {
    if (!KNOWN_KINDS.has(node.kind)) {
      push('error', '组件版本', `「${node.name}」使用了未知组件类型 ${node.kind}`);
    }
  });

  // 8. 磁盘空间：浏览器侧估算发布载荷（后端落盘前还会再校验一次磁盘余量）
  const sceneBytes = new Blob([JSON.stringify(scene)]).size;
  const assetBytes = assets.reduce((sum, asset) => sum + (asset.size ?? 0), 0);
  const totalMB = (sceneBytes + assetBytes) / 1048576;
  if (totalMB > 90) {
    push('warning', '磁盘空间', `发布载荷约 ${totalMB.toFixed(1)}MB，接近单机容量上限`);
  }

  return issues;
}
