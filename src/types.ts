export type NodeKind =
  | 'group'
  | 'box'
  | 'sphere'
  | 'plane'
  | 'image'
  | 'model'
  | 'text'
  | 'light'
  | 'camera'
  | 'bar'
  | 'label'
  | 'popup'
  | 'building'
  | 'factory'
  | 'warehouse'
  | 'office'
  | 'tank'
  | 'coolingTower'
  | 'pipeline'
  | 'road'
  | 'tree'
  | 'windTurbine'
  | 'solarPanel'
  | 'conveyor'
  | 'gantryCrane'
  | 'truck'
  | 'car'
  | 'bus'
  | 'forklift'
  | 'trafficLight'
  | 'parkingGate'
  | 'streetLight'
  | 'fence'
  | 'securityBooth'
  | 'fireHydrant'
  | 'chargingPile'
  | 'pump'
  | 'valve'
  | 'transformer'
  | 'electricalCabinet'
  | 'sensor';

export type TransformMode = 'translate' | 'rotate' | 'scale';

export type SceneNode = {
  id: string;
  name: string;
  kind: NodeKind;
  parentId: string | null;
  visible: boolean;
  locked: boolean;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color?: string;
  opacity?: number;
  text?: string;
  value?: number;
  assetPath?: string;
  dataBindings?: SceneDataBinding[];
};

export type AssetKind = 'model' | 'image';

export type AssetMeta = {
  id: string;
  projectId: string;
  name: string;
  mimeType: string;
  size: number;
  kind: AssetKind;
  url: string;
  createdAt: string;
};

export type DataSourceType = 'json' | 'rest' | 'websocket';

export type SceneDataSource = {
  id: string;
  name: string;
  type: DataSourceType;
  url?: string;
  method?: 'GET';
  headers?: Record<string, string>;
  json?: string;
  refreshInterval?: number;
  timeout?: number;
};

export type SceneDataBindingProperty = 'value' | 'text' | 'color' | 'opacity' | 'visible';

export type SceneDataBinding = {
  id: string;
  sourceId: string;
  path: string;
  property: SceneDataBindingProperty;
};

export type SceneEventTriggerType = 'click' | 'doubleClick' | 'hover' | 'sceneLoad';
export type SceneEventActionType = 'focusCamera' | 'showPopup' | 'setColor' | 'setVisibility';
/** 事件归属范围：场景级规则由场景编排面板管理，对象级规则由选中对象管理。 */
export type SceneEventScope = 'scene' | 'node';

export type SceneEventAction = {
  id: string;
  type: SceneEventActionType;
  targetId: string | null;
  message?: string;
  color?: string;
  visible?: boolean;
};

export type SceneEventRule = {
  id: string;
  name: string;
  enabled: boolean;
  /** 规则的管理范围；旧草稿缺少该字段时由读取层按触发方式迁移。 */
  scope: SceneEventScope;
  /** 对象级规则的归属节点，场景级规则固定为空。 */
  ownerNodeId: string | null;
  trigger: {
    type: SceneEventTriggerType;
    nodeId: string | null;
  };
  actions: SceneEventAction[];
};

export type SceneTimelineProperty =
  'position' | 'rotation' | 'scale' | 'color' | 'opacity' | 'visible';

export type SceneKeyframeValue = [number, number, number] | number | string | boolean;

export type SceneKeyframe = {
  id: string;
  nodeId: string;
  time: number;
  property: SceneTimelineProperty;
  value: SceneKeyframeValue;
};

export type SceneCameraKeyframe = {
  id: string;
  time: number;
  position: [number, number, number];
  target: [number, number, number];
  fov?: number;
};

export type SceneTimeline = {
  duration: number;
  loop: boolean;
  keyframes: SceneKeyframe[];
  /** 场景镜头关键帧，用于全景、推进、局部聚焦等演示镜头。 */
  cameraKeyframes?: SceneCameraKeyframe[];
};

export type SceneDocument = {
  schemaVersion: string;
  nodes: SceneNode[];
  dataSources?: SceneDataSource[];
  /** 事件规则：用于运行态点击/悬停/加载后触发相机聚焦、弹窗、变色、显隐等动作。 */
  events?: SceneEventRule[];
  /** 场景级关键帧动画配置；未配置时按 15 秒循环场景处理。 */
  timeline?: SceneTimeline;
};
export type Release = {
  id: string;
  version: string;
  createdAt: string;
  createdBy: string;
  scene: SceneDocument;
};
export type RuntimeError = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

export type RuntimeMetric = { label: string; value: string; delta?: string };
/** 运行态（预览）大屏的标题区与指标卡配置。 */
export type RuntimeTheme = {
  eyebrow: string;
  tagline: string;
  metrics: RuntimeMetric[];
};

export type ProjectMeta = {
  id: string;
  name: string;
  description: string;
  icon: string;
  isDemo: boolean;
  updatedAt?: string;
  nodeCount?: number;
  runtime?: RuntimeTheme;
};

export type ComponentMeta = {
  kind: NodeKind;
  label: string;
  category: '基础' | '建筑' | '交通' | '设施' | '工业' | '能源' | '数据' | '系统';
  icon: string;
  description: string;
  color?: string;
};

export const componentCatalog: ComponentMeta[] = [
  {
    kind: 'box',
    label: '立方体',
    category: '基础',
    icon: '◇',
    description: '基础几何体',
  },
  {
    kind: 'sphere',
    label: '球体',
    category: '基础',
    icon: '●',
    description: '球形几何体',
  },
  {
    kind: 'plane',
    label: '平面',
    category: '基础',
    icon: '▱',
    description: '地面或展示面',
  },
  {
    kind: 'text',
    label: '3D 文字',
    category: '基础',
    icon: 'T',
    description: '空间文字标牌',
  },
  {
    kind: 'building',
    label: '园区建筑',
    category: '建筑',
    icon: '▦',
    description: '带玻璃幕墙的多层建筑',
    color: '#4195d1',
  },
  {
    kind: 'office',
    label: '办公楼',
    category: '建筑',
    icon: '▤',
    description: '现代办公楼及入口雨棚',
    color: '#3b82a6',
  },
  {
    kind: 'factory',
    label: '工业厂房',
    category: '建筑',
    icon: '▥',
    description: '锯齿屋顶与烟囱厂房',
    color: '#4f7f86',
  },
  {
    kind: 'warehouse',
    label: '物流仓库',
    category: '建筑',
    icon: '▰',
    description: '大型仓库与装卸门',
    color: '#65758b',
  },
  {
    kind: 'road',
    label: '园区道路',
    category: '建筑',
    icon: '═',
    description: '带中心线的双向道路',
    color: '#303b48',
  },
  {
    kind: 'tree',
    label: '绿化树木',
    category: '建筑',
    icon: '♣',
    description: '园区景观绿化树',
    color: '#3f8f62',
  },
  {
    kind: 'car',
    label: '小型车辆',
    category: '交通',
    icon: '◆',
    description: '园区巡检及通勤轿车',
    color: '#3b82f6',
  },
  {
    kind: 'bus',
    label: '通勤巴士',
    category: '交通',
    icon: '▰',
    description: '园区接驳及员工通勤车',
    color: '#16a3a5',
  },
  {
    kind: 'forklift',
    label: '工业叉车',
    category: '交通',
    icon: '⊏',
    description: '仓储装卸搬运叉车',
    color: '#eab308',
  },
  {
    kind: 'trafficLight',
    label: '交通信号灯',
    category: '交通',
    icon: '⋮',
    description: '园区路口三色信号灯',
    color: '#334155',
  },
  {
    kind: 'parkingGate',
    label: '停车道闸',
    category: '交通',
    icon: '⊣',
    description: '车辆出入口自动栏杆',
    color: '#e2e8f0',
  },
  {
    kind: 'streetLight',
    label: '园区路灯',
    category: '设施',
    icon: '⌉',
    description: '道路照明灯杆',
    color: '#64748b',
  },
  {
    kind: 'fence',
    label: '安全围栏',
    category: '设施',
    icon: '╫',
    description: '园区及设备区域隔离围栏',
    color: '#94a3b8',
  },
  {
    kind: 'securityBooth',
    label: '门卫岗亭',
    category: '设施',
    icon: '▣',
    description: '园区出入口值守岗亭',
    color: '#cbd5e1',
  },
  {
    kind: 'fireHydrant',
    label: '消防栓',
    category: '设施',
    icon: '♜',
    description: '室外消防供水设施',
    color: '#dc2626',
  },
  {
    kind: 'chargingPile',
    label: '充电桩',
    category: '设施',
    icon: 'ϟ',
    description: '新能源车辆交流充电终端',
    color: '#0f766e',
  },
  {
    kind: 'tank',
    label: '立式储罐',
    category: '工业',
    icon: '◉',
    description: '带护栏的工业储罐',
    color: '#6aa7aa',
  },
  {
    kind: 'coolingTower',
    label: '冷却塔',
    category: '工业',
    icon: '⌇',
    description: '双曲面工业冷却塔',
    color: '#8aa3a8',
  },
  {
    kind: 'pipeline',
    label: '工艺管道',
    category: '工业',
    icon: '⌁',
    description: '带支架的输送管线',
    color: '#df8b45',
  },
  {
    kind: 'conveyor',
    label: '输送线',
    category: '工业',
    icon: '≋',
    description: '滚筒式物料输送线',
    color: '#d6a94b',
  },
  {
    kind: 'gantryCrane',
    label: '龙门吊',
    category: '工业',
    icon: 'Π',
    description: '厂区重型龙门起重机',
    color: '#e3a52c',
  },
  {
    kind: 'truck',
    label: '运输车辆',
    category: '工业',
    icon: '▱',
    description: '园区物流运输车',
    color: '#dc5f57',
  },
  {
    kind: 'pump',
    label: '工业泵组',
    category: '工业',
    icon: '◍',
    description: '电机、泵体与底座总成',
    color: '#2563a8',
  },
  {
    kind: 'valve',
    label: '工艺阀门',
    category: '工业',
    icon: '⊗',
    description: '管线手轮控制阀',
    color: '#d97706',
  },
  {
    kind: 'windTurbine',
    label: '风力机组',
    category: '能源',
    icon: '✣',
    description: '三叶风力发电机组',
    color: '#d9e7ea',
  },
  {
    kind: 'solarPanel',
    label: '光伏阵列',
    category: '能源',
    icon: '▧',
    description: '倾斜式太阳能板阵列',
    color: '#245b91',
  },
  {
    kind: 'sensor',
    label: '监测传感器',
    category: '能源',
    icon: '⌾',
    description: '设备状态监测点位',
    color: '#38d6b2',
  },
  {
    kind: 'transformer',
    label: '箱式变电站',
    category: '能源',
    icon: '▦',
    description: '园区箱式变压配电设备',
    color: '#64748b',
  },
  {
    kind: 'electricalCabinet',
    label: '配电控制柜',
    category: '能源',
    icon: '▤',
    description: '低压配电与设备控制柜',
    color: '#475569',
  },
  {
    kind: 'bar',
    label: '柱状图',
    category: '数据',
    icon: '▥',
    description: '三维数据柱状图',
  },
  {
    kind: 'label',
    label: '数据标签',
    category: '数据',
    icon: '#',
    description: '指标或状态标签',
  },
  {
    kind: 'popup',
    label: '信息弹窗',
    category: '数据',
    icon: '▣',
    description: '节点详情弹窗',
  },
  {
    kind: 'model',
    label: 'GLTF 模型',
    category: '系统',
    icon: '◈',
    description: '加载本地模型资源',
  },
  {
    kind: 'light',
    label: '点光源',
    category: '系统',
    icon: '✦',
    description: '照亮场景',
  },
  {
    kind: 'camera',
    label: '相机',
    category: '系统',
    icon: '◎',
    description: '场景观察视角',
  },
];

/** 生成全局唯一 ID；HTTP 非 Secure Context 下没有 crypto.randomUUID，降级为时间戳+随机串。 */
export function uid(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createNode(
  kind: NodeKind,
  index: number,
  parentId: string | null = null,
  position?: [number, number, number],
): SceneNode {
  const meta = componentCatalog.find((item) => item.kind === kind);
  const defaults: Partial<Record<NodeKind, [number, number, number]>> = {
    road: [1.8, 1, 1],
    pipeline: [1.4, 1, 1],
    building: [1.2, 1.2, 1.2],
    factory: [1.1, 1.1, 1.1],
  };
  return {
    id: `${kind}-${uid()}`,
    name: meta?.label ?? '新节点',
    kind,
    parentId,
    visible: true,
    locked: false,
    position: position ?? [index * 1.8 - 2, 0, 0],
    rotation: [0, 0, 0],
    scale: defaults[kind] ?? [1, 1, 1],
    color: meta?.color ?? (kind === 'light' ? '#ffd166' : kind === 'image' ? '#ffffff' : '#34d399'),
    opacity: 1,
    text: kind === 'text' || kind === 'label' ? '设备状态' : undefined,
    value: kind === 'bar' || kind === 'label' || kind === 'sensor' ? 72 : undefined,
  };
}
