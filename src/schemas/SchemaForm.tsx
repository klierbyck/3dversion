import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { SceneNode } from '../types';
import {
  FIELD_SECTION_ORDER,
  getPathValue,
  type FieldDescriptor,
} from './nodeSchemas';
import { clampBySchema, parseNumberSeries, validateFieldValue } from './validate';

/**
 * 由 JSON Schema 字段描述符动态渲染的属性表单。
 * - 文本/数值输入 300ms 防抖提交；
 * - 失焦立即提交并校验，非法值回退为上一个合法值；
 * - 错误信息内联展示，不阻断其它字段编辑。
 */
function useDebouncedCommit(commit: (value: string) => void, isValid: (v: string) => boolean) {
  const [draft, setDraft] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const lastValid = useRef('');

  const sync = (external: string) => {
    window.clearTimeout(timer.current);
    setDraft(external);
    lastValid.current = external;
  };

  const onChange = (raw: string) => {
    setDraft(raw);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      if (isValid(raw)) {
        lastValid.current = raw;
        commit(raw);
      }
    }, 300);
  };

  const onBlur = () => {
    window.clearTimeout(timer.current);
    if (isValid(draft)) {
      lastValid.current = draft;
      commit(draft);
    } else {
      // 非法值回退
      setDraft(lastValid.current);
    }
  };

  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { draft, sync, onChange, onBlur };
}

function NumberField({
  descriptor,
  value,
  onCommit,
}: {
  descriptor: FieldDescriptor;
  value: number | undefined;
  onCommit: (n: number) => void;
}) {
  const external = value === undefined ? '' : String(value);
  const { draft, sync, onChange, onBlur } = useDebouncedCommit(
    (raw) => {
      const n = Number(raw);
      const fallback = typeof value === 'number' ? value : 0;
      onCommit(clampBySchema(descriptor, n, fallback));
    },
    (raw) => raw !== '' && Number.isFinite(Number(raw)),
  );
  useEffect(() => sync(external), [external]);
  const [touched, setTouched] = useState(false);
  const error = touched ? validateFieldValue(descriptor, draft === '' ? undefined : Number(draft)) : null;
  return (
    <label className="form-row" style={{ display: 'block' }}>
      <span className="form-label">
        {descriptor.label}
        {descriptor.unit ? <em style={{ fontStyle: 'normal', color: '#94a3b8' }}>（{descriptor.unit}）</em> : null}
      </span>
      <input
        className={`form-input ${error ? 'input-invalid' : ''}`}
        type="number"
        step={descriptor.step ?? 'any'}
        value={draft}
        onChange={(e) => {
          setTouched(true);
          onChange(e.target.value);
        }}
        onBlur={() => {
          setTouched(true);
          onBlur();
        }}
      />
      {error ? <span className="field-error">{error}</span> : null}
      {descriptor.help && !error ? <span className="field-hint">{descriptor.help}</span> : null}
    </label>
  );
}

function TextField({
  descriptor,
  value,
  onCommit,
  textarea,
}: {
  descriptor: FieldDescriptor;
  value: string | undefined;
  onCommit: (s: string) => void;
  textarea?: boolean;
}) {
  const external = value ?? '';
  const { draft, sync, onChange, onBlur } = useDebouncedCommit(
    (raw) => onCommit(raw),
    (raw) => validateFieldValue(descriptor, raw) === null || raw === '',
  );
  useEffect(() => sync(external), [external]);
  const [touched, setTouched] = useState(false);
  const error = touched ? validateFieldValue(descriptor, draft) : null;
  const shared = {
    className: `form-input ${error ? 'input-invalid' : ''}`,
    value: draft,
    onChange: (e: { target: { value: string } }) => {
      setTouched(true);
      onChange(e.target.value);
    },
    onBlur: () => {
      setTouched(true);
      onBlur();
    },
    placeholder: descriptor.placeholder,
  };
  return (
    <label className="form-row" style={{ display: 'block' }}>
      <span className="form-label">{descriptor.label}</span>
      {textarea ? <textarea rows={2} {...shared} /> : <input type="text" {...shared} />}
      {error ? <span className="field-error">{error}</span> : null}
      {descriptor.help && !error ? <span className="field-hint">{descriptor.help}</span> : null}
    </label>
  );
}

function ColorField({
  descriptor,
  value,
  onCommit,
}: {
  descriptor: FieldDescriptor;
  value: string | undefined;
  onCommit: (color: string) => void;
}) {
  const external = /^#[0-9a-fA-F]{6}$/.test(value ?? '') ? value! : '#34d399';
  const { draft, sync, onChange, onBlur } = useDebouncedCommit(
    onCommit,
    (raw) => /^#[0-9a-fA-F]{6}$/.test(raw),
  );
  useEffect(() => sync(external), [external]);

  return (
    <label className="color-row">
      <span className="form-label">{descriptor.label}</span>
      <input type="color" value={external} onChange={(e) => onCommit(e.target.value)} />
      <input
        className="form-input color-text"
        type="text"
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        maxLength={7}
        spellCheck={false}
      />
    </label>
  );
}

function Vector3Field({
  descriptor,
  value,
  onCommit,
}: {
  descriptor: FieldDescriptor;
  value: [number, number, number] | undefined;
  onCommit: (v: [number, number, number]) => void;
}) {
  const vec = value ?? [0, 0, 0];
  const axisLabel = descriptor.key === 'rotation' ? ['X', 'Y', 'Z'] : ['X', 'Y', 'Z'];
  return (
    <div className="form-row">
      <span className="form-label">
        {descriptor.label}
        {descriptor.unit ? <em style={{ fontStyle: 'normal', color: '#94a3b8' }}>（{descriptor.unit}）</em> : null}
      </span>
      <div className="vector-grid">
        {vec.map((axis, i) => (
          <label key={i} className="vector-axis">
            <span>{axisLabel[i]}</span>
            <input
              className="form-input"
              type="number"
              step={descriptor.step ?? 0.1}
              value={Number.isFinite(axis) ? axis : 0}
              onChange={(e) => {
                const next = [...vec] as [number, number, number];
                const n = Number(e.target.value);
                next[i] = Number.isFinite(n) ? n : 0;
                if (descriptor.key === 'scale') next[i] = Math.max(0.0001, next[i]);
                onCommit(next);
              }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function TagsField({
  value,
  onCommit,
}: {
  value: string[] | undefined;
  onCommit: (tags: string[]) => void;
}) {
  const tags = value ?? [];
  const [input, setInput] = useState('');
  const add = () => {
    const t = input.trim();
    if (t && !tags.includes(t) && tags.length < 20) onCommit([...tags, t]);
    setInput('');
  };
  return (
    <div className="form-row">
      <span className="form-label">标签（回车添加）</span>
      <div className="tags-edit">
        {tags.map((tag) => (
          <span key={tag} className="tag-chip">
            {tag}
            <button
              type="button"
              aria-label={`移除标签 ${tag}`}
              onClick={() => onCommit(tags.filter((t) => t !== tag))}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          className="form-input tags-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="添加标签"
        />
      </div>
    </div>
  );
}

/** 判断 candidateId 是否为 ancestorId 的后代。 */
function isDescendantOf(nodes: SceneNode[], ancestorId: string, candidateId: string): boolean {
  let current = nodes.find((n) => n.id === candidateId);
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    current = nodes.find((n) => n.id === current?.parentId);
  }
  return false;
}

export default function SchemaForm({
  fields,
  node,
  nodes,
  onPatch,
}: {
  fields: FieldDescriptor[];
  node: SceneNode;
  /** 动态选项（父节点候选）所需的全量场景节点。 */
  nodes?: SceneNode[];
  onPatch: (path: string, value: unknown) => void;
}) {
  const resolveOptions = (descriptor: FieldDescriptor) => {
    if (descriptor.optionsFrom === 'parentNodes' && nodes) {
      return [
        { label: '根级（无父节点）', value: '' },
        ...nodes
          .filter((item) => item.id !== node.id && !isDescendantOf(nodes, node.id, item.id))
          .map((item) => ({ label: item.name, value: item.id })),
      ];
    }
    return descriptor.options ?? [];
  };
  const sections = FIELD_SECTION_ORDER.filter((section) =>
    fields.some((f) => f.section === section),
  );
  return (
    <>
      {sections.map((section) => (
        <div key={section} className="schema-section">
          <div className="schema-section-title">{section}</div>
          {fields
            .filter((f) => f.section === section)
            .map((descriptor) => {
              const raw = getPathValue(node, descriptor.key);
              const key = descriptor.key;
              switch (descriptor.widget) {
                case 'number':
                  return (
                    <NumberField
                      key={key}
                      descriptor={descriptor}
                      value={typeof raw === 'number' ? raw : undefined}
                      onCommit={(n) => onPatch(key, n)}
                    />
                  );
                case 'vector3':
                  return (
                    <Vector3Field
                      key={key}
                      descriptor={descriptor}
                      value={raw as [number, number, number] | undefined}
                      onCommit={(v) => onPatch(key, v)}
                    />
                  );
                case 'boolean':
                  return (
                    <label key={key} className="toggle-row">
                      <span>
                        {descriptor.label}
                        {descriptor.help ? <em className="switch-help">{descriptor.help}</em> : null}
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(raw)}
                        onChange={(e) => onPatch(key, e.target.checked)}
                      />
                    </label>
                  );
                case 'select':
                  return (
                    <label key={key} className="form-row" style={{ display: 'block' }}>
                      <span className="form-label">{descriptor.label}</span>
                      <select
                        className="form-input"
                        value={String(raw ?? '')}
                        onChange={(e) =>
                          onPatch(key, descriptor.optionsFrom ? (e.target.value || null) : e.target.value)
                        }
                      >
                        {resolveOptions(descriptor).map((opt) => (
                          <option key={String(opt.value)} value={String(opt.value)}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {descriptor.help ? <span className="field-hint">{descriptor.help}</span> : null}
                    </label>
                  );
                case 'color':
                  return (
                    <ColorField
                      key={key}
                      descriptor={descriptor}
                      value={typeof raw === 'string' ? raw : undefined}
                      onCommit={(color) => onPatch(key, color)}
                    />
                  );
                case 'tags':
                  return <TagsField key={key} value={raw as string[]} onCommit={(v) => onPatch(key, v)} />;
                case 'textarea':
                  return (
                    <TextField
                      key={key}
                      descriptor={descriptor}
                      textarea
                      value={typeof raw === 'string' ? raw : ''}
                      onCommit={(s) => onPatch(key, s)}
                    />
                  );
                case 'text':
                default: {
                  // 序列数组字段：文本 <-> number[]
                  if (descriptor.schema.type === 'array' && key === 'series') {
                    const arr = Array.isArray(raw) ? (raw as number[]) : [];
                    return (
                      <TextField
                        key={key}
                        descriptor={descriptor}
                        value={arr.join(', ')}
                        onCommit={(s) => {
                          const parsed = parseNumberSeries(s);
                          if (parsed) onPatch(key, parsed);
                        }}
                      />
                    );
                  }
                  return (
                    <TextField
                      key={key}
                      descriptor={descriptor}
                      value={typeof raw === 'string' ? raw : ''}
                      onCommit={(s) => onPatch(key, s)}
                    />
                  );
                }
              }
            })}
        </div>
      ))}
    </>
  );
}
