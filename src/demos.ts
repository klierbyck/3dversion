import {
  createNode,
  type NodeKind,
  type ProjectMeta,
  type SceneDocument,
  type SceneNode,
} from './types';

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

/**
 * 示例项目目录：项目列表、编辑器初始场景、运行态大屏配置共用这一份数据。
 * demo-park 沿用历史 ID，保证旧版本保存过的草稿仍能对上项目。
 */
export const demoProjects: DemoProject[] = [
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
    scene: smartParkScene,
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
    scene: {
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
    scene: {
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
    scene: {
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
  },
];

const demoIndex = new Map(demoProjects.map((demo) => [demo.id, demo]));

function sceneWithoutIds(scene: SceneDocument) {
  return {
    schemaVersion: scene.schemaVersion,
    nodes: scene.nodes.map(({ id: _id, ...node }) => node),
  };
}

/**
 * 仅升级完全未编辑的旧园区默认场景。
 * 节点任一属性发生变化都视为用户草稿，不做覆盖。
 */
export function upgradeDemoScene(projectId: string, scene: SceneDocument): SceneDocument {
  if (projectId !== 'demo-park') return scene;
  const isLegacySeed =
    JSON.stringify(sceneWithoutIds(scene)) === JSON.stringify(sceneWithoutIds(legacyParkScene));
  return isLegacySeed ? smartParkScene : scene;
}

export function demoById(id: string): DemoProject | undefined {
  return demoIndex.get(id);
}

/** 取项目对应的示例场景；非示例项目返回空场景。 */
export function demoSceneFor(id: string): SceneDocument {
  return demoIndex.get(id)?.scene ?? emptyScene;
}
