import type { NodeKind, SceneNode } from '../types';

/**
 * 组件属性 Schema 层。
 * 每个字段同时携带：
 *  - schema：标准 JSON Schema（draft-07）片段，交 ajv 做合法性校验；
 *  - x-ui：渲染元信息（控件、分组、单位、步长、选项），属性面板据此动态生成。
 * 需求 §4.5：属性面板必须基于 JSON Schema 动态生成，并做范围校验与非法值回退。
 */

export type FieldWidget =
  | 'text'
  | 'textarea'
  | 'number'
  | 'color'
  | 'boolean'
  | 'select'
  | 'vector3'
  | 'tags';

export type FieldSection = '通用' | '变换' | '外观' | '文字' | '灯光' | '相机' | '图表' | '动画';

export type FieldOption = { label: string; value: string | number };

export type FieldDescriptor = {
  /** 支持点路径，如 animation.autoplay。 */
  key: string;
  label: string;
  widget: FieldWidget;
  section: FieldSection;
  /** JSON Schema 片段，描述该字段值的合法范围。 */
  schema: Record<string, unknown>;
  unit?: string;
  step?: number;
  options?: FieldOption[];
  /** 动态选项来源（如父节点候选，依赖当前场景树）。 */
  optionsFrom?: 'parentNodes';
  placeholder?: string;
  help?: string;
};

const numberSchema = (minimum?: number, maximum?: number) => ({
  type: 'number',
  ...(minimum !== undefined ? { minimum } : {}),
  ...(maximum !== undefined ? { maximum } : {}),
});

const vector3Schema = (positive = false) => ({
  type: 'array',
  minItems: 3,
  maxItems: 3,
  items: positive ? { type: 'number', exclusiveMinimum: 0 } : { type: 'number' },
});

// —— 字段库（复用，保证全组件一致的口径与范围）——

const F = {
  name: (): FieldDescriptor => ({
    key: 'name',
    label: '名称',
    widget: 'text',
    section: '通用',
    schema: { type: 'string', minLength: 1, maxLength: 64 },
    help: '1-64 个字符',
  }),
  parent: (): FieldDescriptor => ({
    key: 'parentId',
    label: '父节点',
    widget: 'select',
    section: '通用',
    schema: { type: ['string', 'null'] },
    optionsFrom: 'parentNodes',
    help: '调整对象在场景树中的层级归属',
  }),
  businessId: (): FieldDescriptor => ({
    key: 'businessId',
    label: '业务 ID',
    widget: 'text',
    section: '通用',
    schema: { type: 'string', maxLength: 128 },
    placeholder: '如设备编号 DEV-001',
  }),
  tags: (): FieldDescriptor => ({
    key: 'tags',
    label: '标签',
    widget: 'tags',
    section: '通用',
    schema: { type: 'array', items: { type: 'string', maxLength: 20 }, maxItems: 20 },
    help: '回车添加，最多 20 个',
  }),
  position: (): FieldDescriptor => ({
    key: 'position',
    label: '位置',
    widget: 'vector3',
    section: '变换',
    schema: vector3Schema(false),
    unit: 'm',
    step: 0.1,
  }),
  rotation: (): FieldDescriptor => ({
    key: 'rotation',
    label: '旋转',
    widget: 'vector3',
    section: '变换',
    schema: vector3Schema(false),
    unit: '°',
    step: 1,
  }),
  scale: (): FieldDescriptor => ({
    key: 'scale',
    label: '缩放',
    widget: 'vector3',
    section: '变换',
    schema: vector3Schema(true),
    step: 0.05,
  }),
  color: (): FieldDescriptor => ({
    key: 'color',
    label: '颜色',
    widget: 'color',
    section: '外观',
    schema: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
  }),
  opacity: (): FieldDescriptor => ({
    key: 'opacity',
    label: '透明度',
    widget: 'number',
    section: '外观',
    schema: numberSchema(0, 1),
    step: 0.05,
  }),
  visible: (): FieldDescriptor => ({
    key: 'visible',
    label: '可见',
    widget: 'boolean',
    section: '外观',
    schema: { type: 'boolean' },
  }),
  locked: (): FieldDescriptor => ({
    key: 'locked',
    label: '锁定',
    widget: 'boolean',
    section: '外观',
    schema: { type: 'boolean' },
    help: '锁定后画布不可选中、不可变换',
  }),
  text: (): FieldDescriptor => ({
    key: 'text',
    label: '文本内容',
    widget: 'textarea',
    section: '文字',
    schema: { type: 'string', maxLength: 200 },
  }),
  fontSize: (): FieldDescriptor => ({
    key: 'fontSize',
    label: '字号',
    widget: 'number',
    section: '文字',
    schema: numberSchema(0.05, 20),
    step: 0.05,
    unit: 'm',
  }),
  extrudeDepth: (): FieldDescriptor => ({
    key: 'extrudeDepth',
    label: '挤出厚度',
    widget: 'number',
    section: '文字',
    schema: numberSchema(0, 5),
    step: 0.02,
    unit: 'm',
  }),
  billboard: (): FieldDescriptor => ({
    key: 'billboard',
    label: '始终面向相机',
    widget: 'boolean',
    section: '文字',
    schema: { type: 'boolean' },
  }),
  intensity: (): FieldDescriptor => ({
    key: 'intensity',
    label: '强度',
    widget: 'number',
    section: '灯光',
    schema: numberSchema(0, 10),
    step: 0.1,
  }),
  distance: (): FieldDescriptor => ({
    key: 'distance',
    label: '照射距离',
    widget: 'number',
    section: '灯光',
    schema: numberSchema(0, 500),
    step: 1,
    unit: 'm',
    help: '0 表示不衰减',
  }),
  castShadow: (): FieldDescriptor => ({
    key: 'castShadow',
    label: '投射阴影',
    widget: 'boolean',
    section: '灯光',
    schema: { type: 'boolean' },
  }),
  projection: (): FieldDescriptor => ({
    key: 'cameraProjection',
    label: '投影方式',
    widget: 'select',
    section: '相机',
    schema: { enum: ['perspective', 'orthographic'] },
    options: [
      { label: '透视', value: 'perspective' },
      { label: '正交', value: 'orthographic' },
    ],
  }),
  fov: (): FieldDescriptor => ({
    key: 'fov',
    label: '视场角 FOV',
    widget: 'number',
    section: '相机',
    schema: numberSchema(10, 120),
    unit: '°',
    step: 1,
  }),
  near: (): FieldDescriptor => ({
    key: 'near',
    label: '近裁剪面',
    widget: 'number',
    section: '相机',
    schema: numberSchema(0.01, 100),
    step: 0.1,
    unit: 'm',
  }),
  far: (): FieldDescriptor => ({
    key: 'far',
    label: '远裁剪面',
    widget: 'number',
    section: '相机',
    schema: numberSchema(1, 10000),
    step: 10,
    unit: 'm',
  }),
  value: (): FieldDescriptor => ({
    key: 'value',
    label: '当前数值',
    widget: 'number',
    section: '图表',
    schema: numberSchema(),
  }),
  min: (): FieldDescriptor => ({
    key: 'min',
    label: '量程下限',
    widget: 'number',
    section: '图表',
    schema: numberSchema(),
  }),
  max: (): FieldDescriptor => ({
    key: 'max',
    label: '量程上限',
    widget: 'number',
    section: '图表',
    schema: numberSchema(),
  }),
  series: (): FieldDescriptor => ({
    key: 'series',
    label: '序列数据',
    widget: 'text',
    section: '图表',
    schema: { type: 'array', items: { type: 'number' } },
    help: '英文逗号分隔，如 12,28,35,40',
  }),
  autoplay: (): FieldDescriptor => ({
    key: 'animation.autoplay',
    label: '入场自动播放',
    widget: 'boolean',
    section: '动画',
    schema: { type: 'boolean' },
  }),
  clip: (): FieldDescriptor => ({
    key: 'animation.clip',
    label: '动画片段',
    widget: 'number',
    section: '动画',
    schema: numberSchema(-1, 64),
    help: '-1 表示第一个片段；LOD 多精度模型 V1 预留',
  }),
};

const APPEARANCE = [F.color(), F.opacity(), F.visible(), F.locked()];
const TRANSFORM = [F.position(), F.rotation(), F.scale()];
const COMMON = [F.name(), F.parent(), F.businessId(), F.tags()];

const KIND_FIELDS: Partial<Record<NodeKind, FieldDescriptor[]>> = {
  group: [...COMMON, ...TRANSFORM, F.visible(), F.locked()],
  box: [...COMMON, ...TRANSFORM, ...APPEARANCE],
  sphere: [...COMMON, ...TRANSFORM, ...APPEARANCE],
  plane: [...COMMON, ...TRANSFORM, ...APPEARANCE],
  image: [...COMMON, ...TRANSFORM, ...APPEARANCE],
  text: [
    ...COMMON,
    F.text(),
    F.fontSize(),
    F.extrudeDepth(),
    F.billboard(),
    ...TRANSFORM,
    ...APPEARANCE,
  ],
  label: [...COMMON, F.text(), F.value(), ...TRANSFORM, ...APPEARANCE],
  popup: [...COMMON, F.text(), ...TRANSFORM, ...APPEARANCE],
  light: [
    ...COMMON,
    F.intensity(),
    F.distance(),
    ...TRANSFORM,
    F.color(),
    F.visible(),
    F.locked(),
  ],
  directionalLight: [
    ...COMMON,
    F.intensity(),
    F.castShadow(),
    ...TRANSFORM,
    F.color(),
    F.visible(),
    F.locked(),
  ],
  ambientLight: [...COMMON, F.intensity(), ...TRANSFORM, F.color(), F.visible(), F.locked()],
  camera: [
    ...COMMON,
    F.projection(),
    F.fov(),
    F.near(),
    F.far(),
    ...TRANSFORM,
    F.visible(),
    F.locked(),
  ],
  bar: [...COMMON, F.value(), F.min(), F.max(), ...TRANSFORM, ...APPEARANCE],
  line: [...COMMON, F.series(), F.min(), F.max(), ...TRANSFORM, ...APPEARANCE],
  gauge: [...COMMON, F.value(), F.min(), F.max(), ...TRANSFORM, ...APPEARANCE],
  model: [...COMMON, F.autoplay(), F.clip(), ...TRANSFORM, F.visible(), F.locked(), F.opacity()],
};

/** 行业组件默认走通用外观字段。 */
export function getFieldsForKind(kind: NodeKind): FieldDescriptor[] {
  const custom = KIND_FIELDS[kind];
  if (custom) return custom;
  return [...COMMON, ...TRANSFORM, ...APPEARANCE];
}

export const FIELD_SECTION_ORDER: FieldSection[] = [
  '通用',
  '变换',
  '外观',
  '文字',
  '灯光',
  '相机',
  '图表',
  '动画',
];

/** 按点路径读取节点值。 */
export function getPathValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur && typeof cur === 'object') return (cur as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/** 按点路径写值，返回新对象（不可变更新）。 */
export function setPathValue<T extends object>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const clone = structuredClone(obj);
  let cur: Record<string, unknown> = clone as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = cur[keys[i]] ?? {};
    cur = cur[keys[i]] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
  return clone;
}

/** 节点默认值兜底，避免旧草稿缺新字段。 */
export function ensureNodeFields(node: SceneNode): SceneNode {
  const next = { ...node };
  next.tags = next.tags ?? [];
  if (next.opacity === undefined) next.opacity = 1;
  return next;
}
