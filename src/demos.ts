import {
  createNode,
  type NodeKind,
  type ProjectMeta,
  type SceneCameraKeyframe,
  type SceneDataBindingProperty,
  type SceneDocument,
  type SceneEventRule,
  type SceneKeyframe,
  type SceneNode,
} from './types';
import { normalizeTimeline } from './timeline';

export type DemoProject = ProjectMeta & { scene: SceneDocument };

export const emptyScene: SceneDocument = { schemaVersion: '1.1.0', nodes: [] };

/** 快捷构造场景节点：kind + 展示名 + 位置，其余属性按需覆盖。 */
function n(
  kind: NodeKind,
  name: string,
  position: [number, number, number],
  extra: Partial<SceneNode> = {},
): SceneNode {
  return { ...createNode(kind, 0, null, position), name, ...extra };
}

/** 旧版园区默认场景仅用于识别未编辑草稿，匹配成功后自动升级到新版布局。 */
const legacyParkScene: SceneDocument = {
  schemaVersion: '1.1.0',
  nodes: [
    n('road', '园区主干道', [0, 0, 3]),
    n('road', '环园支路', [0, 0, -3.5], { rotation: [0, 90, 0] }),
    n('office', '研发办公楼', [-8, 0, -7.5]),
    n('building', '综合楼A座', [-2.5, 0, -8.5]),
    n('building', '综合楼B座', [3, 0, -8.5]),
    n('factory', '动力中心', [9, 0, -7.5]),
    n('warehouse', '物料仓库', [8.5, 0, -0.5]),
    n('tank', '消防水罐', [-4.5, 0, -4.5]),
    n('tree', '景观树01', [-5, 0, 0.6]),
    n('tree', '景观树02', [-7, 0, 0.6]),
    n('tree', '景观树03', [5, 0, 0.6]),
    n('tree', '景观树04', [7, 0, 0.6]),
    n('tree', '景观树05', [-5, 0, 5.4]),
    n('tree', '景观树06', [5, 0, 5.4]),
    n('sensor', '环境监测站', [1.5, 0, -6], { value: 68 }),
    n('camera', '安防云台', [-1.5, 0, -6]),
    n('bar', 'A区能耗', [10.5, 0, 1.5], { value: 62 }),
    n('bar', 'B区能耗', [11.5, 0, 1.5], { value: 84, color: '#6ea8fe' }),
    n('bar', 'C区能耗', [12.5, 0, 1.5], { value: 47, color: '#f4b860' }),
    n('label', '分区能耗总览', [11.5, 0, 3.4], { value: 64 }),
    n('popup', '值班调度台', [11.5, 0, -1.2]),
    n('text', '智慧园区态势中心', [0, 0.1, 6.6], { scale: [2.4, 1.3, 1] }),
    n('tree', '景观树07', [-11, 0, -1.5]),
    n('tree', '景观树08', [12, 0, -4]),
  ],
};

/** 新版智慧园区：只保留具有园区语义的实体，避免示例场景像基础几何体陈列页。 */
const smartParkScene: SceneDocument = {
  schemaVersion: '1.1.0',
  nodes: [
    n('road', '中央景观大道', [0, 0, 3.5], { scale: [3, 1, 1] }),
    n('road', '创新区横路', [0, 0, -4.5], { scale: [3, 1, 1] }),
    n('road', '南北连接路', [0, 0, -0.5], { rotation: [0, 90, 0], scale: [1.25, 1, 1] }),
    n('office', '园区运营中心', [-9, 0, -10], { scale: [0.92, 0.92, 0.92] }),
    n('building', '人才服务中心', [-3.2, 0, -10], { scale: [0.74, 0.78, 0.74] }),
    n('building', '数字产业中心', [3.2, 0, -10], { scale: [0.74, 0.78, 0.74] }),
    n('office', '研发创新中心', [9, 0, -10], { scale: [0.92, 0.92, 0.92] }),
    n('building', '创新中心A座', [-8, 0, 0], { scale: [0.82, 0.82, 0.82] }),
    n('building', '创新中心B座', [8, 0, 0], { scale: [0.82, 0.82, 0.82] }),
    n('solarPanel', '低碳停车棚A区', [-7.2, 0, 8.2], { scale: [0.75, 0.75, 0.75] }),
    n('solarPanel', '低碳停车棚B区', [7.2, 0, 8.2], { scale: [0.75, 0.75, 0.75] }),
    n('truck', '园区接驳车', [-3.5, 0, 3.5], {
      scale: [0.38, 0.38, 0.38],
      color: '#4aa8d8',
    }),
    n('truck', '安防巡逻车', [5, 0, -4.5], {
      rotation: [0, 180, 0],
      scale: [0.35, 0.35, 0.35],
      color: '#f4b860',
    }),
    ...[
      [-11, 0, 6.2],
      [-8, 0, 6.2],
      [-5, 0, 6.2],
      [5, 0, 6.2],
      [8, 0, 6.2],
      [11, 0, 6.2],
      [-11, 0, -2.3],
      [-8, 0, -2.3],
      [-5, 0, -2.3],
      [5, 0, -2.3],
      [8, 0, -2.3],
      [11, 0, -2.3],
      [-12, 0, 9.2],
      [12, 0, 9.2],
    ].map((position, index) =>
      n(
        'tree',
        `景观树${String(index + 1).padStart(2, '0')}`,
        position as [number, number, number],
        {
          scale: [0.58, 0.58, 0.58],
        },
      ),
    ),
  ],
};

type DemoEventSpec = {
  name: string;
  triggerNode: string;
  action: 'focusCamera' | 'showPopup' | 'setColor' | 'setVisibility';
  actionNode?: string;
  message?: string;
  color?: string;
  visible?: boolean;
};

type DemoDataBindingSpec = {
  nodeName: string;
  path: string;
  property: SceneDataBindingProperty;
};

type DemoDataConfig = {
  sourceName: string;
  data: Record<string, unknown>;
  bindings: DemoDataBindingSpec[];
};

/** 给内置示例挂载可直接运行的静态数据源，并按节点名称生成稳定绑定。 */
function sceneWithDemoData(
  scene: SceneDocument,
  projectId: string,
  config: DemoDataConfig,
): SceneDocument {
  const sourceId = `${projectId}-live-data`;
  const bindingsByNodeId = new Map<string, Array<DemoDataBindingSpec & { bindingIndex: number }>>();
  const idByName = new Map(scene.nodes.map((node) => [node.name, node.id]));
  config.bindings.forEach((binding, bindingIndex) => {
    const nodeId = idByName.get(binding.nodeName);
    if (!nodeId) throw new Error(`Demo data binding node not found: ${binding.nodeName}`);
    bindingsByNodeId.set(nodeId, [
      ...(bindingsByNodeId.get(nodeId) ?? []),
      { ...binding, bindingIndex },
    ]);
  });
  return {
    ...scene,
    dataSources: [
      {
        id: sourceId,
        name: config.sourceName,
        type: 'json',
        json: JSON.stringify(config.data, null, 2),
        refreshInterval: 10,
      },
    ],
    nodes: scene.nodes.map((node) => ({
      ...node,
      dataBindings: (bindingsByNodeId.get(node.id) ?? []).map((binding) => ({
        id: `${sourceId}-binding-${binding.bindingIndex + 1}`,
        sourceId,
        path: binding.path,
        property: binding.property,
      })),
    })),
  };
}

const vector = (x: number, y: number, z: number): [number, number, number] => [x, y, z];

/** 为行业示例生成统一的“全景-推进-局部-回景”镜头路径。 */
function createDemoCameraKeyframes(
  scene: SceneDocument,
  duration: number,
  focusNode: SceneNode | undefined,
): SceneCameraKeyframe[] {
  const xValues = scene.nodes.map((node) => node.position[0]);
  const zValues = scene.nodes.map((node) => node.position[2]);
  const minX = Math.min(...xValues, -8);
  const maxX = Math.max(...xValues, 8);
  const minZ = Math.min(...zValues, -8);
  const maxZ = Math.max(...zValues, 8);
  const center = vector((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const span = Math.max(16, maxX - minX, maxZ - minZ);
  const far = span * 0.92;
  const localTarget = focusNode?.position ?? center;
  const localDistance = Math.max(5, span * 0.24);
  const overviewPosition = vector(center[0] + far, Math.max(13, span * 0.74), center[2] + far);
  return [
    {
      id: 'demo-camera-overview',
      time: 0,
      position: overviewPosition,
      target: center,
      fov: 53,
    },
    {
      id: 'demo-camera-approach',
      time: 3,
      position: vector(center[0] + far * 0.62, Math.max(9, span * 0.5), center[2] + far * 0.62),
      target: center,
      fov: 48,
    },
    {
      id: 'demo-camera-local',
      time: 6,
      position: vector(
        localTarget[0] + localDistance,
        Math.max(4.5, span * 0.2),
        localTarget[2] + localDistance,
      ),
      target: vector(localTarget[0], localTarget[1] + 1.2, localTarget[2]),
      fov: 40,
    },
    {
      id: 'demo-camera-orbit',
      time: 9,
      position: vector(
        localTarget[0] - localDistance,
        Math.max(5, span * 0.24),
        localTarget[2] + localDistance * 0.8,
      ),
      target: vector(localTarget[0], localTarget[1] + 1.2, localTarget[2]),
      fov: 42,
    },
    {
      id: 'demo-camera-return',
      time: duration,
      position: overviewPosition,
      target: center,
      fov: 53,
    },
  ];
}

/** 生成示例对象动画；车辆采用绕行路径，确保不会穿过同一车道上的其他车辆。 */
function createDemoAnimationKeyframes(scene: SceneDocument, duration: number): SceneKeyframe[] {
  const keyframes: SceneKeyframe[] = [];
  const animatedNode = scene.nodes.find((node) => node.kind === 'truck' || node.kind === 'agv');
  if (animatedNode) {
    const [x, y, z] = animatedNode.position;
    const side = x <= 0 ? -4 : 4;
    const laneZ = z + (z >= 0 ? 3 : -3);
    const safeX = x + side;
    const motion = [
      [0, vector(x, y, z)],
      [2.4, vector(safeX, y, z)],
      [5.2, vector(safeX, y, laneZ)],
      [8.5, vector(x, y, laneZ)],
      [duration, vector(x, y, z)],
    ] as const;
    motion.forEach(([time, value], index) =>
      keyframes.push({
        id: `demo-vehicle-position-${index}`,
        nodeId: animatedNode.id,
        time,
        property: 'position',
        value,
      }),
    );
    const baseRotation = animatedNode.rotation;
    const turnYaw = z >= 0 ? 90 : -90;
    const rotations = [
      [0, baseRotation[1] + (side < 0 ? 180 : 0)],
      [2.4, baseRotation[1] + (side < 0 ? 180 : 0)],
      [5.2, baseRotation[1] + turnYaw],
      [8.5, baseRotation[1]],
      [duration, baseRotation[1] - turnYaw],
    ] as const;
    rotations.forEach(([time, yaw], index) =>
      keyframes.push({
        id: `demo-vehicle-rotation-${index}`,
        nodeId: animatedNode.id,
        time,
        property: 'rotation',
        value: vector(baseRotation[0], yaw, baseRotation[2]),
      }),
    );
  } else {
    const rotatingNode =
      scene.nodes.find((node) => node.kind === 'windTurbine') ??
      scene.nodes.find((node) => node.kind === 'displayStand');
    if (rotatingNode) {
      keyframes.push(
        {
          id: 'demo-rotation-start',
          nodeId: rotatingNode.id,
          time: 0,
          property: 'rotation',
          value: rotatingNode.rotation,
        },
        {
          id: 'demo-rotation-mid',
          nodeId: rotatingNode.id,
          time: duration / 2,
          property: 'rotation',
          value: vector(
            rotatingNode.rotation[0],
            rotatingNode.rotation[1] + 180,
            rotatingNode.rotation[2],
          ),
        },
        {
          id: 'demo-rotation-end',
          nodeId: rotatingNode.id,
          time: duration,
          property: 'rotation',
          value: vector(
            rotatingNode.rotation[0],
            rotatingNode.rotation[1] + 360,
            rotatingNode.rotation[2],
          ),
        },
      );
    }
  }
  const sensor = scene.nodes.find((node) => node.kind === 'sensor');
  if (sensor) {
    const [sx, sy, sz] = sensor.scale;
    [
      [0, 1],
      [3, 0.82],
      [6, 1.18],
      [9, 0.88],
      [duration, 1],
    ].forEach(([time, factor], index) => {
      keyframes.push({
        id: `demo-sensor-pulse-${index}`,
        nodeId: sensor.id,
        time,
        property: 'scale',
        value: vector(sx * factor, sy * factor, sz * factor),
      });
    });
  }
  return keyframes;
}

/** 根据节点名称给示例场景挂载事件，避免随机节点 ID 影响事件目标映射。 */
function sceneWithEvents(scene: SceneDocument, specs: DemoEventSpec[]): SceneDocument {
  const idByName = new Map(scene.nodes.map((node) => [node.name, node.id]));
  const events: SceneEventRule[] = specs.map((spec, index) => {
    const triggerId = idByName.get(spec.triggerNode) ?? null;
    const targetId = idByName.get(spec.actionNode ?? spec.triggerNode) ?? triggerId;
    return {
      id: `demo-event-${index + 1}`,
      name: spec.name,
      enabled: true,
      scope: 'node',
      ownerNodeId: triggerId,
      trigger: { type: 'click', nodeId: triggerId },
      actions: [
        {
          id: `demo-action-${index + 1}`,
          type: spec.action,
          targetId,
          message: spec.message,
          color: spec.color,
          visible: spec.visible,
        },
      ],
    };
  });
  // 每个示例都提供一个场景级入口事件，用于验证“场景编排”和“对象事件”的范围区别。
  const overviewTarget = scene.nodes.find((node) =>
    ['building', 'office', 'factory', 'warehouse', 'bridge', 'displayStand', 'serverRack'].includes(
      node.kind,
    ),
  );
  const sceneEvent: SceneEventRule = {
    id: 'demo-scene-load',
    name: '场景加载定位总览',
    enabled: true,
    scope: 'scene',
    ownerNodeId: null,
    trigger: { type: 'sceneLoad', nodeId: null },
    actions: [
      {
        id: 'demo-scene-load-action',
        type: 'focusCamera',
        targetId: overviewTarget?.id ?? null,
      },
    ],
  };
  const animatedNode =
    scene.nodes.find((node) => node.kind === 'truck') ??
    scene.nodes.find((node) => node.kind === 'agv') ??
    scene.nodes.find((node) => node.kind === 'windTurbine') ??
    scene.nodes.find((node) => node.kind === 'displayStand') ??
    scene.nodes[0];
  const duration = 12;
  const keyframes = animatedNode ? createDemoAnimationKeyframes(scene, duration) : [];
  const timeline = {
    duration,
    loop: false,
    keyframes,
    cameraKeyframes: createDemoCameraKeyframes(scene, duration, overviewTarget),
  };
  return { ...scene, events: [sceneEvent, ...events], timeline };
}

/**
 * 示例项目目录：项目列表、编辑器初始场景、运行态大屏配置共用这一份数据。
 * demo-park 沿用历史 ID，保证旧版本保存过的草稿仍能对上项目。
 */
const legacyDemoProjectSeeds: DemoProject[] = [
  {
    id: 'demo-park',
    name: '智慧园区态势中心',
    description: '办公研发、道路绿化、低碳停车与园区交通的三维态势场景',
    icon: '🏙️',
    isDemo: true,
    runtime: {
      eyebrow: 'SMART CAMPUS',
      tagline: '实时运行视图 · 指标为示例数据',
      metrics: [
        { label: '在线设备', value: '1,284', delta: '+12.4%' },
        { label: '今日能耗', value: '86.4 MWh', delta: '-3.2%' },
        { label: '环境指数', value: '92', delta: '良好' },
      ],
    },
    scene: sceneWithEvents(smartParkScene, [
      {
        name: '点击运营中心查看总览',
        triggerNode: '园区运营中心',
        action: 'showPopup',
        message: '园区运营中心：在线设备 1,284 台，今日运行平稳。',
      },
      {
        name: '点击巡逻车高亮位置',
        triggerNode: '安防巡逻车',
        action: 'setColor',
        color: '#ff6b6b',
      },
      {
        name: '点击研发中心聚焦视角',
        triggerNode: '研发创新中心',
        action: 'focusCamera',
      },
    ]),
  },
  {
    id: 'demo-energy',
    name: '风光储一体化电站',
    description: '风机、光伏阵列与储能系统的发电监控示范场景',
    icon: '⚡',
    isDemo: true,
    runtime: {
      eyebrow: 'GREEN ENERGY',
      tagline: '风光储一体化实时监控 · 指标为示例数据',
      metrics: [
        { label: '实时功率', value: '24.6 MW', delta: '+8.1%' },
        { label: '今日发电', value: '182 MWh', delta: '+4.6%' },
        { label: '设备在线率', value: '99.2%', delta: '正常' },
      ],
    },
    scene: sceneWithEvents(
      {
        schemaVersion: '1.1.0',
        nodes: [
          n('windTurbine', '1号风机', [-12, 0, -9]),
          n('windTurbine', '2号风机', [-12, 0, -1]),
          n('windTurbine', '3号风机', [-12, 0, 7]),
          n('windTurbine', '4号风机', [-6.5, 0, -12]),
          n('solarPanel', '光伏阵列A1', [2, 0, 3]),
          n('solarPanel', '光伏阵列B1', [4.6, 0, 3]),
          n('solarPanel', '光伏阵列C1', [7.2, 0, 3]),
          n('solarPanel', '光伏阵列A2', [2, 0, 5.6]),
          n('solarPanel', '光伏阵列B2', [4.6, 0, 5.6]),
          n('solarPanel', '光伏阵列C2', [7.2, 0, 5.6]),
          n('warehouse', '储能控制中心', [3, 0, -5], { scale: [1.05, 1, 1] }),
          n('tank', '储能罐1号', [10, 0, -8.5]),
          n('tank', '储能罐2号', [13, 0, -8.5]),
          n('pipeline', '输能管道', [11.5, 0, -5.8], { rotation: [0, 90, 0] }),
          n('coolingTower', '冷却塔', [13.5, 0, -3]),
          n('sensor', '光照传感器', [3.3, 0, 4.3], { value: 82 }),
          n('sensor', '温度传感器', [8.8, 0, 7.4], { value: 76 }),
          n('sensor', '风机状态监测', [-9.5, 0, -5], { value: 96 }),
          n('bar', '风电功率', [-1.5, 0, -1], { value: 72 }),
          n('bar', '光伏功率', [-0.5, 0, -1], { value: 54, color: '#f4b860' }),
          n('bar', '储能充放', [0.5, 0, -1], { value: 88, color: '#6ea8fe' }),
          n('label', '实时总功率', [0, 0, 0.9], { value: 76 }),
          n('popup', '1号风机预警', [-9, 0, 3]),
          n('text', '风光储一体化电站', [4.5, 0.1, 9], { scale: [2.2, 1.3, 1] }),
          n('tree', '场区绿化01', [-6.5, 0, -8]),
          n('tree', '场区绿化02', [-4, 0, -8.2]),
        ],
      },
      [
        {
          name: '点击1号风机查看预警',
          triggerNode: '1号风机',
          action: 'showPopup',
          message: '1号风机：振动趋势偏高，建议安排巡检。',
        },
        {
          name: '点击光伏阵列高亮发电区',
          triggerNode: '光伏阵列B2',
          action: 'setColor',
          color: '#ffd166',
        },
        {
          name: '点击储能中心聚焦',
          triggerNode: '储能控制中心',
          action: 'focusCamera',
        },
      ],
    ),
  },
  {
    id: 'demo-factory',
    name: '智能工厂数字孪生',
    description: '车间产线、物流输送与设备状态的数字孪生场景',
    icon: '🏭',
    isDemo: true,
    runtime: {
      eyebrow: 'DIGITAL TWIN',
      tagline: '生产全要素实时映射 · 指标为示例数据',
      metrics: [
        { label: '设备OEE', value: '87.2%', delta: '+1.8%' },
        { label: '今日产量', value: '1,842 件', delta: '+6.3%' },
        { label: '活动告警', value: '2 起', delta: '待处理' },
      ],
    },
    scene: sceneWithEvents(
      {
        schemaVersion: '1.1.0',
        nodes: [
          n('factory', '总装车间', [-6, 0, -6], { scale: [1.15, 1, 1] }),
          n('factory', '部装车间', [3.5, 0, -6], { scale: [1.15, 1, 1] }),
          n('warehouse', '成品仓库', [11, 0, -3], { rotation: [0, 90, 0] }),
          n('road', '厂区主干道', [0, 0, 1.5], { scale: [2.2, 1, 1] }),
          n('conveyor', '1号线输送', [-6, 0, -2.8]),
          n('conveyor', '2号线输送', [3.5, 0, -2.8]),
          n('gantryCrane', '成品吊装龙门吊', [11, 0, 3.5]),
          n('truck', '成品运输车', [-2.5, 0, 1.1]),
          n('truck', '原料运输车', [5.5, 0, 1.9]),
          n('tank', '原料储罐1号', [-11.5, 0, -3]),
          n('tank', '原料储罐2号', [-11.5, 0, -6.5]),
          n('pipeline', '原料管道', [-11.5, 0, -4.75], { rotation: [0, 90, 0] }),
          n('coolingTower', '循环水塔', [-11.5, 0, -10.5]),
          n('sensor', '产线温度监测', [-3.5, 0, -3.7], { value: 78 }),
          n('sensor', '设备振动监测', [1, 0, -3.7], { value: 64 }),
          n('sensor', '仓库环境监测', [7.5, 0, -0.5], { value: 91 }),
          n('bar', '1线良率', [5.5, 0, 6.5], { value: 92 }),
          n('bar', '2线良率', [6.5, 0, 6.5], { value: 87, color: '#6ea8fe' }),
          n('bar', '3线良率', [7.5, 0, 6.5], { value: 95, color: '#f4b860' }),
          n('label', '今日产量看板', [0.5, 0, 5], { value: 92 }),
          n('popup', '3号产线OEE预警', [-4.5, 0, 5.5]),
          n('text', '智能工厂数字孪生', [0, 0.1, 9.5], { scale: [2.2, 1.3, 1] }),
          n('tree', '厂区绿化01', [-9, 0, 7]),
          n('tree', '厂区绿化02', [10, 0, 8]),
        ],
      },
      [
        {
          name: '点击总装车间看生产状态',
          triggerNode: '总装车间',
          action: 'showPopup',
          message: '总装车间：OEE 87.2%，当前节拍正常。',
        },
        {
          name: '点击振动监测标红',
          triggerNode: '设备振动监测',
          action: 'setColor',
          color: '#ff6b6b',
        },
        {
          name: '点击成品仓库聚焦',
          triggerNode: '成品仓库',
          action: 'focusCamera',
        },
      ],
    ),
  },
  {
    id: 'demo-logistics',
    name: '智慧物流园运营中心',
    description: '仓库月台、车辆调度与吞吐数据的三维运营视图',
    icon: '📦',
    isDemo: true,
    runtime: {
      eyebrow: 'LOGISTICS HUB',
      tagline: '园区物流全链路监控 · 指标为示例数据',
      metrics: [
        { label: '今日出入库', value: '326 车', delta: '+5.6%' },
        { label: '月台利用率', value: '78%', delta: '+2.1%' },
        { label: '在途车辆', value: '41', delta: '实时' },
      ],
    },
    scene: sceneWithEvents(
      {
        schemaVersion: '1.1.0',
        nodes: [
          n('warehouse', '1号库', [-8, 0, -5]),
          n('warehouse', '2号库', [0, 0, -5]),
          n('warehouse', '3号库', [8, 0, -5]),
          n('road', '园区主路', [0, 0, 3], { scale: [2.6, 1, 1] }),
          n('conveyor', '1号月台输送', [-6.2, 0, -2.4]),
          n('conveyor', '2号月台输送', [1.5, 0, -2.4]),
          n('conveyor', '3号月台输送', [9.2, 0, -2.4]),
          n('gantryCrane', '集装箱龙门吊', [8, 0, 0]),
          n('truck', '进场车辆01', [-7, 0, 3.1]),
          n('truck', '装卸车辆02', [0.5, 0, 2.5]),
          n('truck', '离场车辆03', [7.5, 0, 3.5]),
          n('office', '运营调度中心', [0, 0, 8]),
          n('tree', '园区绿化01', [-6.5, 0, 6.2]),
          n('tree', '园区绿化02', [-10, 0, 6.2]),
          n('tree', '园区绿化03', [10.5, 0, 6.2]),
          n('sensor', '地磅监测点', [-3, 0, 5.2], { value: 88 }),
          n('sensor', '冷链温控', [-11.5, 0, -9], { value: 45 }),
          n('bar', '1号库吞吐', [11, 0, 7.5], { value: 66 }),
          n('bar', '2号库吞吐', [12, 0, 7.5], { value: 81, color: '#6ea8fe' }),
          n('bar', '3号库吞吐', [13, 0, 7.5], { value: 58, color: '#f4b860' }),
          n('label', '吞吐对比', [12, 0, 9.6], { value: 68 }),
          n('label', '今日入库看板', [-5, 0, 5.4], { value: 81 }),
          n('popup', '月台B拥堵预警', [5.5, 0, 5.4]),
          n('text', '智慧物流园', [0, 0.1, 11.5], { scale: [2.2, 1.3, 1] }),
        ],
      },
      [
        {
          name: '点击月台预警查看拥堵',
          triggerNode: '月台B拥堵预警',
          action: 'showPopup',
          message: '月台B：排队车辆 6 台，建议引导至 3 号库月台。',
        },
        {
          name: '点击离场车辆标记',
          triggerNode: '离场车辆03',
          action: 'setColor',
          color: '#7ce5c1',
        },
        {
          name: '点击调度中心聚焦',
          triggerNode: '运营调度中心',
          action: 'focusCamera',
        },
      ],
    ),
  },
];

const demoProjectSeeds: DemoProject[] = [
  {
    id: 'demo-park',
    name: '智慧楼宇与园区安防',
    description: '融合 BIM 楼宇、园区 GIS、门禁视频与消防感知的综合安防场景',
    icon: '🏙️',
    isDemo: true,
    runtime: {
      eyebrow: 'BIM / GIS SECURITY',
      tagline: '楼宇空间与安防事件一张图 · 指标为示例数据',
      metrics: [
        { label: '在线点位', value: '2,416', delta: '99.7%' },
        { label: '访客在园', value: '186', delta: '+12' },
        { label: '待处置事件', value: '3 起', delta: '实时' },
      ],
    },
    scene: sceneWithEvents(
      {
        schemaVersion: '1.1.0',
        nodes: [
          n('road', '园区东西主路', [0, 0, 3.8], { scale: [3.25, 1, 1] }),
          n('road', '园区南北主路', [0, 0, -1], {
            rotation: [0, 90, 0],
            scale: [1.7, 1, 1],
          }),
          n('office', '园区指挥中心', [-9.5, 0, -9.5], { color: '#2878a5' }),
          n('building', '研发楼 A 座', [-3.3, 0, -10], { scale: [0.84, 0.9, 0.84] }),
          n('building', '研发楼 B 座', [3.3, 0, -10], { scale: [0.84, 0.9, 0.84] }),
          n('office', '综合服务中心', [9.5, 0, -9.2], { color: '#4b8095' }),
          n('securityBooth', '访客登记岗亭', [-9.5, 0, 8.7]),
          n('parkingGate', '车辆入口道闸', [-5.8, 0, 4.9], { scale: [0.7, 0.7, 0.7] }),
          n('accessControl', '西门人行门禁', [-10.6, 0, 5.6], { scale: [0.82, 0.82, 0.82] }),
          n('accessControl', '指挥中心门禁', [-9.5, 0, -6.3], { scale: [0.65, 0.65, 0.65] }),
          n('cctv', '西门全景摄像机', [-7.8, 0, 6.5]),
          n('cctv', '路口球机', [1.8, 0, 1.4]),
          n('cctv', '研发楼周界摄像机', [6.8, 0, -6]),
          n('cctv', '停车区摄像机', [9.4, 0, 7.3]),
          n('fence', '西侧电子围栏', [-12.5, 0, -1.5], {
            rotation: [0, 90, 0],
            scale: [1.8, 1, 1],
          }),
          n('fence', '东侧电子围栏', [12.5, 0, -1.5], {
            rotation: [0, 90, 0],
            scale: [1.8, 1, 1],
          }),
          n('fireHydrant', '消防栓 A1', [-6.5, 0, -5.5]),
          n('fireHydrant', '消防栓 B1', [6.5, 0, -5.5]),
          n('sensor', '楼宇环境监测', [-1.8, 0, -6.2], { value: 93 }),
          n('sensor', '周界入侵感知', [11.2, 0, 0], { value: 99, color: '#22d3ee' }),
          n('car', '安防巡逻车', [4.8, 0, 3.8], {
            rotation: [0, 180, 0],
            scale: [0.58, 0.58, 0.58],
            color: '#f59e0b',
          }),
          n('bus', '园区接驳车', [-2.5, 0, 3.8], { scale: [0.42, 0.42, 0.42] }),
          n('streetLight', '智慧灯杆 01', [-5.5, 0, 1.3], { scale: [0.7, 0.7, 0.7] }),
          n('streetLight', '智慧灯杆 02', [5.5, 0, 1.3], { scale: [0.7, 0.7, 0.7] }),
          n('label', '楼宇运行评分', [-4.5, 0, 7.8], { value: 96, text: '楼宇运行 96 分' }),
          n('popup', '周界告警', [5.7, 0, 7.8], { text: '东侧周界待复核' }),
          n('text', '智慧楼宇 · 园区安防', [0, 0.1, 11], { scale: [2.4, 1.25, 1] }),
        ],
      },
      [
        {
          name: '点击周界感知查看告警',
          triggerNode: '周界入侵感知',
          action: 'showPopup',
          message: '东侧周界检测到异常停留，已联动最近摄像机复核。',
        },
        {
          name: '点击路口球机高亮',
          triggerNode: '路口球机',
          action: 'setColor',
          color: '#ef4444',
        },
        {
          name: '点击指挥中心聚焦',
          triggerNode: '园区指挥中心',
          action: 'focusCamera',
        },
      ],
    ),
  },
  {
    id: 'demo-factory',
    name: '智能工厂产线监控',
    description: '覆盖数控加工、机器人作业、输送与厂内物流的工业数字孪生场景',
    icon: '🏭',
    isDemo: true,
    runtime: {
      eyebrow: 'INDUSTRIAL DIGITAL TWIN',
      tagline: '产线节拍与设备状态实时映射 · 指标为示例数据',
      metrics: [
        { label: '整线 OEE', value: '87.2%', delta: '+1.8%' },
        { label: '当班产量', value: '1,842 件', delta: '+6.3%' },
        { label: '设备告警', value: '2 起', delta: '待处理' },
      ],
    },
    scene: sceneWithEvents(
      {
        schemaVersion: '1.1.0',
        nodes: [
          n('factory', '柔性制造车间', [-7.5, 0, -9], { scale: [1.25, 0.9, 1.05] }),
          n('factory', '动力与公用工程站', [8, 0, -9], { scale: [0.9, 0.85, 0.9] }),
          n('road', '厂内物流通道', [0, 0, 5.5], { scale: [2.8, 1, 0.85] }),
          n('machineTool', 'CNC 加工中心 01', [-9, 0, -3.2], { scale: [0.72, 0.72, 0.72] }),
          n('machineTool', 'CNC 加工中心 02', [-5, 0, -3.2], { scale: [0.72, 0.72, 0.72] }),
          n('machineTool', 'CNC 加工中心 03', [-1, 0, -3.2], { scale: [0.72, 0.72, 0.72] }),
          n('robotArm', '焊装机器人 01', [3.2, 0, -3.2], { scale: [0.72, 0.72, 0.72] }),
          n('robotArm', '焊装机器人 02', [7.2, 0, -3.2], {
            rotation: [0, 180, 0],
            scale: [0.72, 0.72, 0.72],
          }),
          n('conveyor', '总装输送线 A', [-5.6, 0, 1.2], { scale: [0.75, 0.75, 0.75] }),
          n('conveyor', '总装输送线 B', [1, 0, 1.2], { scale: [0.75, 0.75, 0.75] }),
          n('storageRack', '线边物料架', [10.7, 0, 0.5], {
            rotation: [0, 90, 0],
            scale: [0.68, 0.68, 0.68],
          }),
          n('agv', 'AGV 配送料车', [-7.5, 0, 5.5], { scale: [0.75, 0.75, 0.75] }),
          n('pallet', '待加工物料', [6.5, 0, 1.4], { scale: [0.7, 0.7, 0.7] }),
          n('tank', '切削液储罐', [12, 0, -7.5], { scale: [0.65, 0.65, 0.65] }),
          n('pump', '循环泵组', [11.5, 0, -4.6], { scale: [0.65, 0.65, 0.65] }),
          n('electricalCabinet', '产线控制柜', [4.2, 0, 1.8], { scale: [0.75, 0.75, 0.75] }),
          n('sensor', '主轴振动监测', [-1.2, 0, -0.4], { value: 68, color: '#f59e0b' }),
          n('sensor', '焊装温度监测', [6, 0, -0.4], { value: 82 }),
          n('label', '当班产量看板', [-2, 0, 9], { value: 92, text: '当班产量 1,842 件' }),
          n('popup', 'CNC 03 刀具预警', [5, 0, 9], { text: '刀具寿命剩余 12%' }),
          n('text', '智能工厂数字孪生', [0, 0.1, 12], { scale: [2.35, 1.25, 1] }),
        ],
      },
      [
        {
          name: '点击 CNC 查看设备状态',
          triggerNode: 'CNC 加工中心 03',
          action: 'showPopup',
          message: 'CNC 03：主轴负载 78%，刀具寿命剩余 12%，建议本班更换。',
        },
        {
          name: '点击振动点标记异常',
          triggerNode: '主轴振动监测',
          action: 'setColor',
          color: '#ef4444',
        },
        {
          name: '点击机器人聚焦',
          triggerNode: '焊装机器人 01',
          action: 'focusCamera',
        },
      ],
    ),
  },
  {
    id: 'demo-showroom',
    name: '3D 数字化展厅',
    description: '面向汽车与零售商品的沉浸式展销、热点讲解和虚拟定制场景',
    icon: '🛍️',
    isDemo: true,
    runtime: {
      eyebrow: 'IMMERSIVE COMMERCE',
      tagline: '三维展销与商品虚拟定制 · 指标为示例数据',
      metrics: [
        { label: '今日访客', value: '12,860', delta: '+18.6%' },
        { label: '商品互动', value: '4,219 次', delta: '+9.4%' },
        { label: '询价转化', value: '8.7%', delta: '+1.2%' },
      ],
    },
    scene: sceneWithEvents(
      {
        schemaVersion: '1.1.0',
        nodes: [
          n('plane', '展厅镜面地台', [0, 0, 0], { scale: [9, 1, 6], color: '#243447' }),
          n('ledScreen', '品牌主屏', [0, 0, -9.5], { color: '#0ea5e9', scale: [1.15, 1.15, 1.15] }),
          n('ledScreen', '参数对比屏', [10.5, 0, -2.5], {
            rotation: [0, -90, 0],
            scale: [0.72, 0.72, 0.72],
            color: '#14b8a6',
          }),
          n('displayStand', '旗舰车型旋转展台', [0, 0, -2.2], { scale: [1.55, 1, 1.55] }),
          n('car', '旗舰概念车', [0, 0.75, -2.2], { scale: [1.15, 1.15, 1.15], color: '#e11d48' }),
          n('displayStand', '城市车型展台', [-7, 0, 3.8], { scale: [1.15, 0.9, 1.15] }),
          n('car', '城市通勤车型', [-7, 0.68, 3.8], { scale: [0.8, 0.8, 0.8], color: '#0ea5e9' }),
          n('displayStand', '户外车型展台', [7, 0, 3.8], { scale: [1.15, 0.9, 1.15] }),
          n('car', '户外探索车型', [7, 0.68, 3.8], {
            rotation: [0, 180, 0],
            scale: [0.8, 0.8, 0.8],
            color: '#f59e0b',
          }),
          n('displayStand', '智能终端展台 A', [-8.2, 0, -4], { scale: [0.65, 0.8, 0.65] }),
          n('displayStand', '智能终端展台 B', [8.2, 0, -4], { scale: [0.65, 0.8, 0.65] }),
          n('sphere', '沉浸交互装置 A', [-8.2, 0.65, -4], {
            scale: [0.65, 0.65, 0.65],
            color: '#a78bfa',
          }),
          n('sphere', '沉浸交互装置 B', [8.2, 0.65, -4], {
            scale: [0.65, 0.65, 0.65],
            color: '#22d3ee',
          }),
          n('sensor', '客流热度采集', [-10, 0, 8], { value: 86, color: '#f472b6' }),
          n('label', '旗舰车型热度', [-3.8, 0, 6.8], { value: 94, text: '互动热度 94%' }),
          n('popup', '个性化配置清单', [4.5, 0, 6.8], { text: '已选择：曜石红 / 智驾包' }),
          n('text', '未来出行数字展厅', [0, 0.1, 10.8], { scale: [2.35, 1.25, 1] }),
        ],
      },
      [
        {
          name: '点击旗舰车查看配置',
          triggerNode: '旗舰概念车',
          action: 'showPopup',
          message: '旗舰概念车：曜石红外观、智能驾驶增强包、预计交付 6 周。',
        },
        {
          name: '点击城市车型切换颜色',
          triggerNode: '城市通勤车型',
          action: 'setColor',
          color: '#a855f7',
        },
        {
          name: '点击旗舰展台聚焦',
          triggerNode: '旗舰车型旋转展台',
          action: 'focusCamera',
        },
      ],
    ),
  },
  {
    id: 'demo-logistics',
    name: '智慧仓储 WMS 中心',
    description: '展示库位、托盘、AGV、叉车与出入库输送协同的数字仓储场景',
    icon: '📦',
    isDemo: true,
    runtime: {
      eyebrow: 'WMS DIGITAL WAREHOUSE',
      tagline: '库存、库位与搬运任务实时协同 · 指标为示例数据',
      metrics: [
        { label: '库存准确率', value: '99.8%', delta: '+0.2%' },
        { label: '今日任务', value: '1,286 单', delta: '完成 81%' },
        { label: 'AGV 在线', value: '36 / 38', delta: '正常' },
      ],
    },
    scene: sceneWithEvents(
      {
        schemaVersion: '1.1.0',
        nodes: [
          n('warehouse', '智能仓储中心', [0, 0, -10], { scale: [2.4, 0.8, 0.8] }),
          n('road', '出入库车道', [0, 0, 8], { scale: [3, 1, 0.8] }),
          ...[-9, -3, 3, 9].map((x, index) =>
            n('storageRack', `A${index + 1} 立体货架`, [x, 0, -3.2], { scale: [0.82, 0.82, 0.82] }),
          ),
          ...[-9, -3, 3, 9].map((x, index) =>
            n('storageRack', `B${index + 1} 立体货架`, [x, 0, 2], { scale: [0.82, 0.82, 0.82] }),
          ),
          n('conveyor', '入库输送线', [-6.2, 0, 5.4], { scale: [0.72, 0.72, 0.72] }),
          n('conveyor', '出库输送线', [6.2, 0, 5.4], { scale: [0.72, 0.72, 0.72] }),
          n('agv', 'AGV 任务车 07', [-8, 0, 4.1]),
          n('agv', 'AGV 任务车 12', [1.5, 0, -0.8], { color: '#0ea5e9' }),
          n('forklift', '人工复核叉车', [8.5, 0, 6.1], { scale: [0.58, 0.58, 0.58] }),
          n('pallet', '待上架托盘 01', [-3.8, 0, 5.7], { scale: [0.65, 0.65, 0.65] }),
          n('pallet', '待上架托盘 02', [3.8, 0, 5.7], { scale: [0.65, 0.65, 0.65] }),
          n('truck', '入库月台车辆', [-7.2, 0, 8], { scale: [0.45, 0.45, 0.45] }),
          n('sensor', '冷链库温湿度', [-11.5, 0, -7.5], { value: 45, color: '#38bdf8' }),
          n('sensor', 'A 区库位感知', [-0.5, 0, 3.7], { value: 98 }),
          n('label', '库存作业看板', [-4.5, 0, 11.5], { value: 81, text: '任务完成率 81%' }),
          n('popup', '巷道拥堵提醒', [5, 0, 11.5], { text: 'B3 巷道任务积压' }),
          n('text', '智慧仓储 WMS 中心', [0, 0.1, 14], { scale: [2.35, 1.25, 1] }),
        ],
      },
      [
        {
          name: '点击 AGV 查看任务',
          triggerNode: 'AGV 任务车 12',
          action: 'showPopup',
          message: 'AGV 12：执行 B3-021 至出库缓存区任务，预计 2 分 18 秒完成。',
        },
        {
          name: '点击冷链监测标记异常',
          triggerNode: '冷链库温湿度',
          action: 'setColor',
          color: '#ef4444',
        },
        {
          name: '点击智能仓聚焦',
          triggerNode: '智能仓储中心',
          action: 'focusCamera',
        },
      ],
    ),
  },
  {
    id: 'demo-energy',
    name: '智慧城市与能源基建',
    description: '城市建筑、交通桥梁、风光电网与基础设施的宏观态势感知场景',
    icon: '⚡',
    isDemo: true,
    runtime: {
      eyebrow: 'CITY & INFRASTRUCTURE',
      tagline: '城市运行与能源网络宏观态势 · 指标为示例数据',
      metrics: [
        { label: '城市负荷', value: '826 MW', delta: '+3.1%' },
        { label: '绿电占比', value: '38.6%', delta: '+5.4%' },
        { label: '设施在线率', value: '99.4%', delta: '正常' },
      ],
    },
    scene: sceneWithEvents(
      {
        schemaVersion: '1.1.0',
        nodes: [
          n('road', '城市快速路', [0, 0, 4.5], { scale: [3.2, 1, 1] }),
          n('road', '城市纵向干道', [-3.5, 0, -2], {
            rotation: [0, 90, 0],
            scale: [1.65, 1, 1],
          }),
          n('bridge', '跨江智慧桥梁', [8.5, 0, 4.5], { scale: [0.82, 0.82, 0.82] }),
          n('building', '城市运行中心', [-9.5, 0, -8.5], { color: '#2563a8' }),
          n('office', '智慧政务中心', [-3.5, 0, -9], { scale: [0.78, 0.78, 0.78] }),
          n('building', '城市综合体 A', [3, 0, -8.5], { scale: [0.9, 1.12, 0.9] }),
          n('building', '城市综合体 B', [8.2, 0, -8.5], { scale: [0.72, 0.82, 0.72] }),
          n('transmissionTower', '高压输电塔 01', [-11, 0, 0]),
          n('transmissionTower', '高压输电塔 02', [-6.5, 0, 0], { scale: [0.82, 0.82, 0.82] }),
          n('transformer', '城市 110kV 变电站', [-9, 0, 8.8], { scale: [0.72, 0.72, 0.72] }),
          n('solarPanel', '分布式光伏阵列', [-2, 0, 9.5], { scale: [0.7, 0.7, 0.7] }),
          n('windTurbine', '城市绿电风机', [14, 0, -6], { scale: [0.85, 0.85, 0.85] }),
          n('trafficLight', '智慧路口信号机', [0.4, 0, 2.1], { scale: [0.65, 0.65, 0.65] }),
          n('bus', '城市公交', [-7, 0, 4.5], { scale: [0.42, 0.42, 0.42] }),
          n('car', '道路巡检车', [1.2, 0, 4.5], { scale: [0.56, 0.56, 0.56], color: '#f59e0b' }),
          n('sensor', '桥梁结构监测', [8.5, 0, 1.3], { value: 97, color: '#22d3ee' }),
          n('sensor', '电网负荷监测', [-7.5, 0, 6.8], { value: 83 }),
          n('label', '城市综合指数', [2.3, 0, 9.2], { value: 91, text: '城市运行指数 91' }),
          n('popup', '桥梁健康预警', [8.8, 0, 10.5], { text: '桥梁健康度 97%' }),
          n('text', '智慧城市能源态势', [0, 0.1, 13], { scale: [2.35, 1.25, 1] }),
        ],
      },
      [
        {
          name: '点击桥梁查看健康度',
          triggerNode: '跨江智慧桥梁',
          action: 'showPopup',
          message: '跨江智慧桥梁：结构健康度 97%，支座位移与索力均处于正常区间。',
        },
        {
          name: '点击电网负荷标记过载',
          triggerNode: '电网负荷监测',
          action: 'setColor',
          color: '#ef4444',
        },
        {
          name: '点击城市中心聚焦',
          triggerNode: '城市运行中心',
          action: 'focusCamera',
        },
      ],
    ),
  },
  {
    id: 'demo-datacenter',
    name: '数据中心 DCIM 运维',
    description: '覆盖服务器机柜、制冷、UPS 配电与动环监控的数据中心基础设施场景',
    icon: '🗄️',
    isDemo: true,
    runtime: {
      eyebrow: 'DATA CENTER DCIM',
      tagline: '算力、能耗、制冷与动环统一运维 · 指标为示例数据',
      metrics: [
        { label: 'IT 负载', value: '3.82 MW', delta: '+4.2%' },
        { label: '实时 PUE', value: '1.28', delta: '-0.03' },
        { label: '机柜在线率', value: '99.99%', delta: '正常' },
      ],
    },
    scene: sceneWithEvents(
      {
        schemaVersion: '1.1.0',
        nodes: [
          n('plane', '机房防静电地板', [0, 0, 0], { scale: [8.5, 1, 5.5], color: '#2b4052' }),
          ...[-7.5, -4.5, -1.5, 1.5, 4.5, 7.5].flatMap((x, index) => [
            n('serverRack', `A${String(index + 1).padStart(2, '0')} 服务器机柜`, [x, 0, -3.2], {
              scale: [0.86, 0.86, 0.86],
            }),
            n('serverRack', `B${String(index + 1).padStart(2, '0')} 服务器机柜`, [x, 0, 2.2], {
              rotation: [0, 180, 0],
              scale: [0.86, 0.86, 0.86],
            }),
          ]),
          n('precisionAc', '列间精密空调 01', [-9.8, 0, -3.2], { scale: [0.82, 0.82, 0.82] }),
          n('precisionAc', '列间精密空调 02', [9.8, 0, -3.2], { scale: [0.82, 0.82, 0.82] }),
          n('precisionAc', '列间精密空调 03', [-9.8, 0, 2.2], { scale: [0.82, 0.82, 0.82] }),
          n('precisionAc', '列间精密空调 04', [9.8, 0, 2.2], { scale: [0.82, 0.82, 0.82] }),
          n('ups', 'UPS 主机 A', [-6.2, 0, -7.7], { scale: [0.82, 0.82, 0.82] }),
          n('ups', 'UPS 主机 B', [-3.8, 0, -7.7], { scale: [0.82, 0.82, 0.82] }),
          n('electricalCabinet', '低压配电柜', [-0.8, 0, -7.7], { scale: [0.82, 0.82, 0.82] }),
          n('ledScreen', 'DCIM 运维大屏', [6.2, 0, -7.8], {
            scale: [0.78, 0.78, 0.78],
            color: '#0ea5e9',
          }),
          n('accessControl', '机房双因子门禁', [-8.5, 0, 7.2], { scale: [0.8, 0.8, 0.8] }),
          n('cctv', '机房通道摄像机', [8.8, 0, 6.4], { scale: [0.85, 0.85, 0.85] }),
          n('sensor', 'A 通道温湿度', [-2.6, 0, -0.4], { value: 72, color: '#38bdf8' }),
          n('sensor', 'B 通道温湿度', [3.4, 0, -0.4], { value: 76, color: '#22d3ee' }),
          n('sensor', '漏水检测点', [9.2, 0, -0.4], { value: 99, color: '#a78bfa' }),
          n('label', '实时 PUE 看板', [-4.5, 0, 7.3], { value: 82, text: '实时 PUE 1.28' }),
          n('popup', 'A03 机柜告警', [3.8, 0, 7.3], { text: 'A03 柜温偏高' }),
          n('text', '数据中心 DCIM 运维', [0, 0.1, 10], { scale: [2.35, 1.25, 1] }),
        ],
      },
      [
        {
          name: '点击 A03 机柜查看容量',
          triggerNode: 'A03 服务器机柜',
          action: 'showPopup',
          message: 'A03 机柜：功率 8.6 kW，容量利用率 78%，柜顶温度 27.8°C。',
        },
        {
          name: '点击温湿度点标记异常',
          triggerNode: 'A 通道温湿度',
          action: 'setColor',
          color: '#ef4444',
        },
        {
          name: '点击运维大屏聚焦',
          triggerNode: 'DCIM 运维大屏',
          action: 'focusCamera',
        },
      ],
    ),
  },
];

const demoDataConfigs: Record<string, DemoDataConfig> = {
  'demo-park': {
    sourceName: '楼宇园区安防实时数据',
    data: {
      security: {
        score: '楼宇运行 97 分',
        perimeterColor: '#22d3ee',
        commandCenterColor: '#0ea5e9',
        alertVisible: true,
      },
    },
    bindings: [
      { nodeName: '楼宇运行评分', path: 'security.score', property: 'text' },
      { nodeName: '周界入侵感知', path: 'security.perimeterColor', property: 'color' },
      { nodeName: '园区指挥中心', path: 'security.commandCenterColor', property: 'color' },
      { nodeName: '周界告警', path: 'security.alertVisible', property: 'visible' },
    ],
  },
  'demo-factory': {
    sourceName: '工厂设备与生产实时数据',
    data: {
      production: {
        outputText: '当班产量 1,936 件',
        cncColor: '#2563eb',
        vibrationColor: '#f59e0b',
        alertVisible: true,
      },
    },
    bindings: [
      { nodeName: '当班产量看板', path: 'production.outputText', property: 'text' },
      { nodeName: 'CNC 加工中心 03', path: 'production.cncColor', property: 'color' },
      { nodeName: '主轴振动监测', path: 'production.vibrationColor', property: 'color' },
      { nodeName: 'CNC 03 刀具预警', path: 'production.alertVisible', property: 'visible' },
    ],
  },
  'demo-showroom': {
    sourceName: '展厅商品互动数据',
    data: {
      showroom: {
        popularityText: '互动热度 96%',
        heroColor: '#e11d48',
        screenColor: '#06b6d4',
        configVisible: true,
      },
    },
    bindings: [
      { nodeName: '旗舰车型热度', path: 'showroom.popularityText', property: 'text' },
      { nodeName: '旗舰概念车', path: 'showroom.heroColor', property: 'color' },
      { nodeName: '品牌主屏', path: 'showroom.screenColor', property: 'color' },
      { nodeName: '个性化配置清单', path: 'showroom.configVisible', property: 'visible' },
    ],
  },
  'demo-logistics': {
    sourceName: 'WMS 库存与任务数据',
    data: {
      warehouse: {
        progressText: '任务完成率 86%',
        coldChainColor: '#38bdf8',
        agvColor: '#14b8a6',
        congestionVisible: true,
      },
    },
    bindings: [
      { nodeName: '库存作业看板', path: 'warehouse.progressText', property: 'text' },
      { nodeName: '冷链库温湿度', path: 'warehouse.coldChainColor', property: 'color' },
      { nodeName: 'AGV 任务车 12', path: 'warehouse.agvColor', property: 'color' },
      { nodeName: '巷道拥堵提醒', path: 'warehouse.congestionVisible', property: 'visible' },
    ],
  },
  'demo-energy': {
    sourceName: '城市能源与基建态势数据',
    data: {
      city: {
        indexText: '城市运行指数 93',
        bridgeColor: '#64748b',
        gridColor: '#22d3ee',
        warningVisible: false,
      },
    },
    bindings: [
      { nodeName: '城市综合指数', path: 'city.indexText', property: 'text' },
      { nodeName: '跨江智慧桥梁', path: 'city.bridgeColor', property: 'color' },
      { nodeName: '电网负荷监测', path: 'city.gridColor', property: 'color' },
      { nodeName: '桥梁健康预警', path: 'city.warningVisible', property: 'visible' },
    ],
  },
  'demo-datacenter': {
    sourceName: 'DCIM 动环与容量数据',
    data: {
      dcim: {
        pueText: '实时 PUE 1.26',
        rackColor: '#334155',
        temperatureColor: '#38bdf8',
        alertVisible: true,
      },
    },
    bindings: [
      { nodeName: '实时 PUE 看板', path: 'dcim.pueText', property: 'text' },
      { nodeName: 'A03 服务器机柜', path: 'dcim.rackColor', property: 'color' },
      { nodeName: 'A 通道温湿度', path: 'dcim.temperatureColor', property: 'color' },
      { nodeName: 'A03 机柜告警', path: 'dcim.alertVisible', property: 'visible' },
    ],
  },
};

export const demoProjects: DemoProject[] = demoProjectSeeds.map((demo) => ({
  ...demo,
  scene: sceneWithDemoData(demo.scene, demo.id, demoDataConfigs[demo.id]),
}));

const demoIndex = new Map(demoProjects.map((demo) => [demo.id, demo]));

function sceneStructureWithoutIds(scene: SceneDocument) {
  return {
    schemaVersion: scene.schemaVersion,
    nodes: scene.nodes.map(({ id: _id, dataBindings: _dataBindings, ...node }) => node),
  };
}

const legacySceneByDemoId = new Map(
  legacyDemoProjectSeeds.map((demo) => [demo.id, sceneStructureWithoutIds(demo.scene)]),
);

/**
 * 仅升级完全未编辑的示例默认场景。
 * 节点任一属性发生变化都视为用户草稿，不做覆盖；只给原始示例补齐新版事件规则。
 */
export function upgradeDemoScene(
  projectId: string,
  scene: SceneDocument | null | undefined,
): SceneDocument {
  const demo = demoById(projectId);
  // 旧版本缓存可能写入 null 或不完整对象，先回退到安全场景，避免读取 events 时崩溃。
  if (!isSceneDocument(scene)) return demo?.scene ?? emptyScene;
  if (!demo) return normalizeSceneDocument(scene);
  const legacyScene = legacySceneByDemoId.get(projectId);
  const isFirstParkSeed =
    projectId === 'demo-park' &&
    JSON.stringify(sceneStructureWithoutIds(scene)) ===
      JSON.stringify(sceneStructureWithoutIds(legacyParkScene));
  const isLegacySeed =
    Boolean(legacyScene) &&
    JSON.stringify(sceneStructureWithoutIds(scene)) === JSON.stringify(legacyScene);
  const isCurrentSeedWithoutEvents =
    !scene.events?.length &&
    JSON.stringify(sceneStructureWithoutIds(scene)) ===
      JSON.stringify(sceneStructureWithoutIds(demo.scene));
  const isCurrentSeed =
    JSON.stringify(sceneStructureWithoutIds(scene)) ===
    JSON.stringify(sceneStructureWithoutIds(demo.scene));
  if (isFirstParkSeed || isLegacySeed || isCurrentSeedWithoutEvents) return demo.scene;
  const normalized = normalizeSceneDocument(scene);
  const normalizedTimeline = normalizeTimeline(scene.timeline);
  // 兼容旧版示例草稿：节点未被编辑时补入镜头动画，并将官方关键帧映射到旧草稿节点 ID。
  if (isCurrentSeed) {
    const currentIdByDemoId = new Map(
      demo.scene.nodes.map((node, index) => [node.id, scene.nodes[index]?.id ?? node.id]),
    );
    const needsDemoDataUpgrade =
      scene.dataSources === undefined && Boolean(demo.scene.dataSources?.length);
    const sceneWithDataUpgrade = needsDemoDataUpgrade
      ? {
          ...normalized,
          dataSources: demo.scene.dataSources,
          nodes: normalized.nodes.map((node, index) => ({
            ...node,
            dataBindings: demo.scene.nodes[index]?.dataBindings,
          })),
        }
      : normalized;
    if (!demo.scene.timeline) return sceneWithDataUpgrade;
    const isLegacyDemoMotion = normalizedTimeline.keyframes.some((frame) =>
      frame.id.startsWith('demo-keyframe-'),
    );
    const demoKeyframes = demo.scene.timeline.keyframes.map((frame) => ({
      ...frame,
      nodeId: currentIdByDemoId.get(frame.nodeId) ?? frame.nodeId,
    }));
    const keyframes = isLegacyDemoMotion
      ? demoKeyframes
      : [
          ...normalizedTimeline.keyframes,
          ...demoKeyframes.filter(
            (frame) => !normalizedTimeline.keyframes.some((item) => item.id === frame.id),
          ),
        ];
    const cameraKeyframes = normalizedTimeline.cameraKeyframes?.length
      ? normalizedTimeline.cameraKeyframes
      : demo.scene.timeline.cameraKeyframes;
    const isSystemDemoTimeline =
      keyframes.length > 0 && keyframes.every((frame) => frame.id.startsWith('demo-'));
    const loop = isSystemDemoTimeline ? false : normalizedTimeline.loop;
    if (
      needsDemoDataUpgrade ||
      keyframes.length !== normalizedTimeline.keyframes.length ||
      cameraKeyframes?.length !== normalizedTimeline.cameraKeyframes?.length ||
      loop !== normalizedTimeline.loop
    ) {
      return {
        ...sceneWithDataUpgrade,
        timeline: {
          ...normalizedTimeline,
          keyframes,
          cameraKeyframes,
          loop,
        },
      };
    }
  }
  return normalized;
}

/** 运行时校验本地缓存/接口返回的场景结构，防止脏数据击穿项目列表页面。 */
function isSceneDocument(value: unknown): value is SceneDocument {
  return Boolean(
    value && typeof value === 'object' && Array.isArray((value as { nodes?: unknown }).nodes),
  );
}

/** 将旧版仅有 trigger.nodeId 的事件迁移为显式场景级/对象级规则。 */
function normalizeSceneDocument(scene: SceneDocument): SceneDocument {
  const rawEvents = Array.isArray((scene as { events?: unknown }).events)
    ? ((scene as { events: unknown[] }).events ?? [])
    : [];
  const nodeIds = new Set(scene.nodes.map((node) => node.id));
  const events = rawEvents
    .filter(isEventRule)
    .map((rule) => {
      const scope = rule.scope ?? (rule.trigger.type === 'sceneLoad' ? 'scene' : 'node');
      const triggerNodeId = rule.trigger.nodeId ?? null;
      const ownerNodeId = scope === 'scene' ? null : (rule.ownerNodeId ?? triggerNodeId);
      return {
        ...rule,
        scope,
        ownerNodeId: ownerNodeId && nodeIds.has(ownerNodeId) ? ownerNodeId : null,
        trigger: {
          ...rule.trigger,
          nodeId:
            scope === 'scene' || !triggerNodeId || nodeIds.has(triggerNodeId)
              ? triggerNodeId
              : null,
        },
        actions: rule.actions.filter((action) => !action.targetId || nodeIds.has(action.targetId)),
      };
    })
    .filter((rule) => rule.actions.length > 0);
  const timeline = normalizeTimeline(scene.timeline);
  return {
    ...scene,
    events,
    timeline: {
      ...timeline,
      keyframes: timeline.keyframes.filter((frame) => nodeIds.has(frame.nodeId)),
    },
  };
}

function isEventRule(value: unknown): value is SceneEventRule {
  if (!value || typeof value !== 'object') return false;
  const rule = value as Partial<SceneEventRule>;
  return Boolean(
    typeof rule.id === 'string' &&
    typeof rule.name === 'string' &&
    rule.trigger &&
    typeof rule.trigger === 'object' &&
    typeof rule.trigger.type === 'string' &&
    Array.isArray(rule.actions),
  );
}

export function demoById(id: string): DemoProject | undefined {
  return demoIndex.get(id);
}

/** 取项目对应的示例场景；非示例项目返回空场景。 */
export function demoSceneFor(id: string): SceneDocument {
  return demoIndex.get(id)?.scene ?? emptyScene;
}
