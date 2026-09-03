import Ajv, { type ErrorObject } from 'ajv';
import type { SceneNode } from '../types';
import { getFieldsForKind, type FieldDescriptor } from './nodeSchemas';

// ajv 严格模式关闭：schema 中含 x-ui 等扩展关键字；只做数据校验。
const ajv = new Ajv({ strict: false, allErrors: true });

const validatorCache = new Map<string, ReturnType<Ajv['compile']>>();

function compileField(descriptor: FieldDescriptor) {
  let fn = validatorCache.get(descriptor.key + JSON.stringify(descriptor.schema));
  if (!fn) {
    fn = ajv.compile(descriptor.schema);
    validatorCache.set(descriptor.key + JSON.stringify(descriptor.schema), fn);
  }
  return fn;
}

function ajvMessage(error: ErrorObject): string {
  switch (error.keyword) {
    case 'minimum':
      return `不能小于 ${(error.params as { limit: number }).limit}`;
    case 'maximum':
      return `不能大于 ${(error.params as { limit: number }).limit}`;
    case 'exclusiveMinimum':
      return `必须大于 ${(error.params as { limit: number }).limit}`;
    case 'minLength':
      return '不能为空';
    case 'maxLength':
      return `最多 ${(error.params as { limit: number }).limit} 个字符`;
    case 'pattern':
      return '格式不正确';
    case 'enum':
      return '取值不在允许范围内';
    case 'type':
      return '数据类型不正确';
    default:
      return error.message ?? '取值不合法';
  }
}

/** 校验单个字段值；返回 null 表示合法，否则返回中文错误信息。 */
export function validateFieldValue(descriptor: FieldDescriptor, value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    const required = (descriptor.schema as { minLength?: number }).minLength !== undefined;
    return required ? '不能为空' : null;
  }
  const validate = compileField(descriptor);
  if (validate(value)) return null;
  return validate.errors ? ajvMessage(validate.errors[0]) : '取值不合法';
}

/** 把数值钳制到 schema 声明的范围内；非数值回退到 fallback。 */
export function clampBySchema(
  descriptor: FieldDescriptor,
  raw: number,
  fallback: number,
): number {
  const schema = descriptor.schema as {
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
  };
  if (!Number.isFinite(raw)) return fallback;
  let v = raw;
  if (schema.exclusiveMinimum !== undefined) v = Math.max(v, schema.exclusiveMinimum + 0.0001);
  if (schema.minimum !== undefined) v = Math.max(v, schema.minimum);
  if (schema.maximum !== undefined) v = Math.min(v, schema.maximum);
  return v;
}

/** 校验整个节点，返回字段路径 -> 错误信息。 */
export function validateNode(node: SceneNode): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const descriptor of getFieldsForKind(node.kind)) {
    // 点路径取值
    const value = descriptor.key.split('.').reduce<unknown>((cur, k) => {
      if (cur && typeof cur === 'object') return (cur as Record<string, unknown>)[k];
      return undefined;
    }, node);
    const message = validateFieldValue(descriptor, value);
    if (message) errors[descriptor.key] = message;
  }
  // 相机近远裁剪面关系
  if (node.kind === 'camera' && node.near !== undefined && node.far !== undefined && node.near >= node.far) {
    errors.far = '远裁剪面必须大于近裁剪面';
  }
  // 仪表/柱图量程
  if ((node.kind === 'gauge' || node.kind === 'bar') && node.min !== undefined && node.max !== undefined && node.min >= node.max) {
    errors.max = '量程上限必须大于下限';
  }
  return errors;
}

/**
 * 事件条件表达式白名单静态校验（需求 §4.7.4）。
 * 允许：字段/点路径、数字、字符串常量、比较/逻辑/算术运算符、括号、true/false/null。
 * 禁止：函数调用、赋值、new/箭头、window/document 等危险标识符与成员访问。
 * 返回 null 表示通过，否则返回拒绝原因。
 */
const FORBIDDEN_IDENTS = new Set([
  'window',
  'document',
  'globalThis',
  'self',
  'top',
  'parent',
  'eval',
  'Function',
  'constructor',
  'prototype',
  '__proto__',
  'require',
  'import',
  'export',
  'global',
  'process',
  'localStorage',
  'sessionStorage',
  'fetch',
  'XMLHttpRequest',
  'new',
  'this',
  'super',
  'class',
  'while',
  'for',
  'do',
  'switch',
]);

export function validateConditionExpression(expr: string): string | null {
  const text = expr.trim();
  if (!text) return null;
  if (/[`;{}]/.test(text)) return '不允许反引号、分号或花括号';
  if (/=>|\bnew\b/.test(text)) return '不允许 new 或箭头函数';
  // 赋值：单个 = 但不是 ==/===/!=/>=/<=
  if (/(^|[^=!<>])=([^=])/.test(text)) return '不允许赋值运算';
  // 函数调用：标识符后紧跟 (
  if (/\b[A-Za-z_$][\w$]*\s*\(/.test(text)) return '不允许函数调用';
  // 危险标识符
  const idents = text.match(/[A-Za-z_$][\w$]*/g) ?? [];
  for (const id of idents) {
    if (FORBIDDEN_IDENTS.has(id)) return `不允许使用 ${id}`;
  }
  // 括号配对
  let depth = 0;
  for (const ch of text) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) return '括号不配对';
  }
  if (depth !== 0) return '括号不配对';
  // 剩余字符白名单：剥离合法 token 后不应残留异常字符
  const stripped = text
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""')
    .replace(/[A-Za-z_$][\w$]*/g, '')
    .replace(/\d+(\.\d+)?/g, '')
    .replace(/\.(?=\w)/g, '')
    .replace(/[+\-*/%<>=!&|?()., ]/g, '');
  if (stripped.length > 0) return `包含非法字符：${stripped.slice(0, 8)}`;
  return null;
}

/** 安全求值条件表达式：白名单 token 内用 Function 构造，仅暴露数据字段。 */
export function evalCondition(expr: string, scope: Record<string, unknown>): boolean {
  const text = expr.trim();
  if (!text) return true;
  if (validateConditionExpression(text)) return false;
  const keys = Object.keys(scope);
  const values = keys.map((k) => scope[k]);
  try {
    // 仅传入白名单字段，表达式经静态校验无调用/赋值/全局访问
    const fn = new Function(...keys, `"use strict"; return (${text});`);
    return Boolean(fn(...values));
  } catch {
    return false;
  }
}

/** 解析逗号分隔序列。 */
export function parseNumberSeries(raw: string): number[] | null {
  const parts = raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const nums = parts.map(Number);
  return nums.every((n) => Number.isFinite(n)) ? nums : null;
}
