export type NodeKind =
  | 'group'
  | 'box'
  | 'sphere'
  | 'plane'
  | 'image'
  | 'model'
  | 'text'
  | 'light'
  | 'directionalLight'
  | 'ambientLight'
  | 'camera'
  | 'bar'
  | 'line'
  | 'gauge'
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
  | 'sensor'
  | 'cctv'
  | 'accessControl'
  | 'robotArm'
  | 'machineTool'
  | 'displayStand'
  | 'ledScreen'
  | 'storageRack'
  | 'pallet'
  | 'agv'
  | 'bridge'
  | 'transmissionTower'
  | 'serverRack'
  | 'precisionAc'
  | 'ups';

export type TransformMode = 'translate' | 'rotate' | 'scale';

/** GLTF 模型内嵌动画的播放配置；LOD 多档模型 V1 预留、暂不支持上传多精度。 */
export type NodeAnimation = {
  autoplay: boolean;
  /** 播放的动画片段序号，-1 表示第一个/全部片段。 */
  clip: number;
  playing: boolean;
  /** LOD 预留：未来存放多档模型资源 id，V1 不参与渲染。 */
  lodLevels?: string[];
};

export type CameraProjection = 'perspective' | 'orthographic';

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
  /** 业务 ID：对接外部系统时的唯一业务编码（如设备编号）。 */
  businessId?: string;
  /** 标签：用于分组检索与批量管理。 */
  tags?: string[];
  // 灯光属性（点/平行/环境光）
  intensity?: number;
  castShadow?: boolean;
  /** 点光源照射距离，0 表示不衰减。 */
  distance?: number;
  // 观察相机组件属性
  cameraProjection?: CameraProjection;
  fov?: number;
  near?: number;
  far?: number;
  // 3D 文字属性
  fontSize?: number;
  extrudeDepth?: number;
  /** true：始终面向相机；false：固定朝向的立体文字。 */
  billboard?: boolean;
  // 图表属性
  /** 折线图序列（柱图用 value，折线图用 series）。 */
  series?: number[];
  min?: number;
  max?: number;
  // 模型动画
  animation?: NodeAnimation;
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
  validationStatus?: 'validated' | 'pending' | 'failed';
};

export type DataSourceType = 'json' | 'rest' | 'websocket';
export type DataSourceAuthType = 'none' | 'bearer' | 'apiKey' | 'basic';

export type SceneDataSource = {
  id: string;
  name: string;
  type: DataSourceType;
  url?: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** 查询参数（REST）。 */
  params?: Record<string, string>;
  /** 请求体（POST，JSON 字符串）。 */
  body?: string;
  json?: string;
  refreshInterval?: number;
  timeout?: number;
  /** 认证方式；凭证由服务端代理加密保存，不明文落草稿。 */
  authType?: DataSourceAuthType;
  authValue?: string;
  /** 服务端已保存加密凭证；明文永不随草稿或运行态响应返回。 */
  hasAuthValue?: boolean;
  /** 是否经 FastAPI 代理访问（默认 true，关闭则浏览器直连，仅静态 JSON 例外）。 */
  useProxy?: boolean;
  /** 最近一次测试返回的字段样例（前端展示用，不参与发布）。 */
  sample?: unknown;
};

export type SceneDataBindingProperty = 'value' | 'text' | 'color' | 'opacity' | 'visible';

/** 数值阈值规则：满足比较条件时把组件染成指定颜色。 */
export type DataThreshold = {
  id: string;
  op: '>' | '>=' | '<' | '<=' | '==' | '!=';
  value: number;
  color: string;
};

export type SceneDataBinding = {
  id: string;
  sourceId: string;
  path: string;
  property: SceneDataBindingProperty;
  /** 数值保留小数位。 */
  decimals?: number;
  /** 文本前缀/后缀。 */
  prefix?: string;
  suffix?: string;
  /** 数值阈值着色（仅 value 属性生效）。 */
  thresholds?: DataThreshold[];
};

export type SceneEventTriggerType =
  | 'click'
  | 'doubleClick'
  | 'hover'
  | 'sceneLoad'
  | 'dataChange';
export type SceneEventActionType =
  | 'focusCamera'
  | 'showPopup'
  | 'setColor'
  | 'setVisibility'
  | 'setOpacity'
  | 'playAnimation'
  | 'refreshData';
/** 事件归属范围：场景级规则由场景编排面板管理，对象级规则由选中对象管理。 */
export type SceneEventScope = 'scene' | 'node';

export type SceneEventAction = {
  id: string;
  type: SceneEventActionType;
  targetId: string | null;
  message?: string;
  color?: string;
  visible?: boolean;
  /** setOpacity 目标透明度 0-1。 */
  opacity?: number;
  /** playAnimation：true 播放 / false 暂停。 */
  play?: boolean;
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
    /** dataChange 触发时关联的数据源 ID；为空表示任意数据源变化。 */
    sourceId?: string | null;
  };
  actions: SceneEventAction[];
  /** 白名单条件表达式，如 value > 80 && status === "alarm"；为空表示无条件。 */
  condition?: string;
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
  /** 播放速度：0.25 / 0.5 / 1 / 2；旧草稿缺省由 normalizeTimeline 补 1。 */
  speed?: number;
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
  /** 发布说明。 */
  notes?: string;
};

/** 运行错误级别与来源分类，对齐需求 §5.5。 */
export type RuntimeErrorLevel = 'error' | 'warn';

export type RuntimeError = {
  id: string;
  type: string;
  level?: RuntimeErrorLevel;
  message: string;
  /** 发生时的发布版本（编辑态为 draft）。 */
  version?: string;
  /** 关联的资源 URL 或接口地址。 */
  source?: string;
  /** 浏览器 UA。 */
  browser?: string;
  /** 链路追踪 ID。 */
  traceId?: string;
  createdAt: string;
};

export type RuntimeMetric = { label: string; value: string; delta?: string };
/** 运行态（预览）大屏的标题区与指标卡配置。 */
export type RuntimeTheme = {
  eyebrow: string;
  tagline: string;
  metrics: RuntimeMetric[];
};

/** 项目发布状态：草稿 / 已发布。 */
export type ProjectStatus = 'draft' | 'published';

export type ProjectMeta = {
  id: string;
  name: string;
  description: string;
  icon: string;
  isDemo: boolean;
  createdAt?: string;
  updatedAt?: string;
  /** 最近编辑人。 */
  lastEditor?: string;
  nodeCount?: number;
  status?: ProjectStatus;
  currentVersion?: string;
  /** 画布缩略图（dataURL）。 */
  thumbnail?: string;
  /** 软删除标记与时间，进入回收站。 */
  deleted?: boolean;
  deletedAt?: string;
  /** 由模板创建时记录模板 id。 */
  templateFrom?: string;
  runtime?: RuntimeTheme;
};

/** 后端分页响应。 */
export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ComponentMeta = {
  kind: NodeKind;
  label: string;
  category:
    | '基础'
    | '建筑'
    | '交通'
    | '设施'
    | '安防'
    | '工业'
    | '仓储'
    | '能源'
    | '展陈'
    | '机房'
    | '数据'
    | '系统';
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
    description: '真实立体中文文字',
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
    kind: 'cctv',
    label: '安防摄像机',
    category: '安防',
    icon: '◉',
    description: '带云台与镜头的监控摄像机',
    color: '#dbe7ec',
  },
  {
    kind: 'accessControl',
    label: '门禁闸机',
    category: '安防',
    icon: '⊢',
    description: '人行通道与刷卡门禁设备',
    color: '#64748b',
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
    kind: 'robotArm',
    label: '工业机器人',
    category: '工业',
    icon: '⌁',
    description: '六轴机械臂与作业底座',
    color: '#f59e0b',
  },
  {
    kind: 'machineTool',
    label: '数控机床',
    category: '工业',
    icon: '▣',
    description: '带观察窗和控制台的 CNC 设备',
    color: '#3b82f6',
  },
  {
    kind: 'storageRack',
    label: '立体货架',
    category: '仓储',
    icon: '▥',
    description: '多层重型仓储货架',
    color: '#f59e0b',
  },
  {
    kind: 'pallet',
    label: '托盘货物',
    category: '仓储',
    icon: '▤',
    description: '木质托盘与箱装货物',
    color: '#b77946',
  },
  {
    kind: 'agv',
    label: 'AGV 搬运车',
    category: '仓储',
    icon: '▰',
    description: '自动导航物料搬运机器人',
    color: '#14b8a6',
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
    kind: 'transmissionTower',
    label: '输电铁塔',
    category: '能源',
    icon: '⌁',
    description: '高压输电线路钢结构塔架',
    color: '#94a3b8',
  },
  {
    kind: 'bridge',
    label: '城市桥梁',
    category: '建筑',
    icon: '⌒',
    description: '带桥塔和拉索的基础设施桥梁',
    color: '#64748b',
  },
  {
    kind: 'displayStand',
    label: '商品展台',
    category: '展陈',
    icon: '◈',
    description: '带灯带与旋转台面的展陈底座',
    color: '#e2e8f0',
  },
  {
    kind: 'ledScreen',
    label: '数字展示屏',
    category: '展陈',
    icon: '▣',
    description: '大尺寸发光数字内容屏',
    color: '#06b6d4',
  },
  {
    kind: 'serverRack',
    label: '服务器机柜',
    category: '机房',
    icon: '▤',
    description: '带服务器、指示灯与玻璃门的标准机柜',
    color: '#334155',
  },
  {
    kind: 'precisionAc',
    label: '精密空调',
    category: '机房',
    icon: '▥',
    description: '数据中心列间精密制冷设备',
    color: '#cbd5e1',
  },
  {
    kind: 'ups',
    label: 'UPS 电源',
    category: '机房',
    icon: 'ϟ',
    description: '不间断电源与电池柜设备',
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
    kind: 'line',
    label: '折线图',
    category: '数据',
    icon: '∿',
    description: '三维趋势折线图',
  },
  {
    kind: 'gauge',
    label: '仪表盘',
    category: '数据',
    icon: '◔',
    description: '三维环形刻度仪表',
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
    description: '加载本地模型资源（支持内嵌动画）',
  },
  {
    kind: 'ambientLight',
    label: '环境光',
    category: '系统',
    icon: '◌',
    description: '均匀照亮整体场景',
  },
  {
    kind: 'directionalLight',
    label: '平行光',
    category: '系统',
    icon: '▸',
    description: '带方向的主光源，可投影',
  },
  {
    kind: 'light',
    label: '点光源',
    category: '系统',
    icon: '✦',
    description: '从位置向四周发光',
  },
  {
    kind: 'camera',
    label: '观察相机',
    category: '系统',
    icon: '◎',
    description: '可切换的场景观察机位',
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
  const base: SceneNode = {
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
    value: kind === 'bar' || kind === 'label' || kind === 'sensor' || kind === 'gauge' ? 72 : undefined,
    tags: [],
  };
  if (kind === 'light') {
    base.intensity = 1.4;
    base.distance = 0;
  }
  if (kind === 'directionalLight') {
    base.color = '#ffffff';
    base.intensity = 1.2;
    base.castShadow = true;
  }
  if (kind === 'ambientLight') {
    base.color = '#ffffff';
    base.intensity = 0.55;
  }
  if (kind === 'camera') {
    base.cameraProjection = 'perspective';
    base.fov = 50;
    base.near = 0.1;
    base.far = 1000;
  }
  if (kind === 'text') {
    base.fontSize = 0.6;
    base.extrudeDepth = 0.12;
    base.billboard = false;
  }
  if (kind === 'line') {
    base.series = [24, 42, 35, 68, 54, 76];
    base.min = 0;
    base.max = 100;
  }
  if (kind === 'gauge') {
    base.min = 0;
    base.max = 100;
  }
  if (kind === 'model') {
    base.animation = { autoplay: true, clip: -1, playing: true };
  }
  return base;
}
