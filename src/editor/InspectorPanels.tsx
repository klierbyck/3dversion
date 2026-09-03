import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type {
  DataThreshold,
  SceneDataBinding,
  SceneDataBindingProperty,
  SceneDataSource,
  SceneNode,
} from '../types';
import SchemaForm from '../schemas/SchemaForm';
import { getFieldsForKind, setPathValue } from '../schemas/nodeSchemas';
import { validateNode } from '../schemas/validate';
import { extractDataFields } from '../api';

export function Inspector({
  selected,
  nodes,
  setNode,
}: {
  selected: SceneNode;
  nodes: SceneNode[];
  setNode: (patch: Partial<SceneNode>) => void;
}) {
  const fields = useMemo(() => getFieldsForKind(selected.kind), [selected.kind]);
  const errors = useMemo(() => validateNode(selected), [selected]);
  const labelOf = (path: string) =>
    fields.find((field) => field.key === path)?.label ?? path;

  /** 点路径补丁：animation.autoplay -> { animation: {...} } 顶层合并。 */
  const handlePatch = (path: string, value: unknown) => {
    const next = setPathValue(selected, path, value);
    const rootKey = path.split('.')[0];
    setNode({
      [rootKey]: (next as Record<string, unknown>)[rootKey],
    } as Partial<SceneNode>);
  };

  return (
    <div className="inspector-body">
      <div className="inspector-kind-tag">组件类型：{selected.kind}</div>
      <SchemaForm fields={fields} node={selected} nodes={nodes} onPatch={handlePatch} />
      {Object.keys(errors).length > 0 && (
        <div className="inspector-error-summary" role="alert">
          {Object.entries(errors).map(([path, message]) => (
            <span key={path}>
              {labelOf(path)}：{message}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const AUTH_LABELS: Record<NonNullable<SceneDataSource['authType']>, string> = {
  none: '无认证',
  bearer: 'Bearer Token',
  apiKey: 'API Key（X-API-Key）',
  basic: 'Basic（用户名:密码）',
};

/** 字符串键值对编辑器（请求头 / 查询参数）。 */
function KeyValueEditor({
  values,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  const entries = Object.entries(values);
  const update = (index: number, nextKey: string, nextValue: string) => {
    const result: Record<string, string> = {};
    entries.forEach(([key, value], i) => {
      if (i === index) result[nextKey.trim()] = nextValue;
      else result[key] = value;
    });
    onChange(result);
  };
  return (
    <div className="kv-editor">
      {entries.map(([key, value], index) => (
        <div className="kv-row" key={`${key}-${index}`}>
          <input
            value={key}
            placeholder={keyPlaceholder}
            onChange={(event) => update(index, event.target.value, value)}
          />
          <input
            value={value}
            placeholder={valuePlaceholder}
            onChange={(event) => update(index, key, event.target.value)}
          />
          <button
            type="button"
            className="icon-button"
            title="删除"
            onClick={() => onChange(Object.fromEntries(entries.filter((_, i) => i !== index)))}
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="outline-button kv-add"
        onClick={() => onChange({ ...values, '': '' })}
      >
        <Plus size={12} /> 添加一行
      </button>
    </div>
  );
}

const THRESHOLD_OPS: DataThreshold['op'][] = ['>', '>=', '<', '<=', '==', '!='];

/** 底部场景编排区：时间轴和场景级事件都作用于整个画布。 */
export function DataSourcePanel({
  selected,
  sources,
  status,
  onAddSource,
  onPatchSource,
  onDeleteSource,
  onAddBinding,
  onUpdateBinding,
  onDeleteBinding,
  onTestSource,
}: {
  selected: SceneNode;
  sources: SceneDataSource[];
  status: string | null;
  onAddSource: () => void;
  onPatchSource: (id: string, patch: Partial<SceneDataSource>) => void;
  onDeleteSource: (id: string) => void;
  onAddBinding: (binding: Omit<SceneDataBinding, 'id'>) => void;
  onUpdateBinding: (id: string, patch: Partial<SceneDataBinding>) => void;
  onDeleteBinding: (id: string) => void;
  onTestSource: (source: SceneDataSource) => Promise<void>;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [path, setPath] = useState('value');
  const [property, setProperty] = useState<SceneDataBindingProperty>('value');
  const [decimals, setDecimals] = useState('');
  const [prefix, setPrefix] = useState('');
  const [suffix, setSuffix] = useState('');
  const [thresholds, setThresholds] = useState<DataThreshold[]>([]);
  const [editingBindingId, setEditingBindingId] = useState<string | null>(null);
  const source = sources.find((item) => item.id === sourceId) ?? sources[0];
  useEffect(() => {
    if (source && !sources.some((item) => item.id === sourceId)) setSourceId(source.id);
  }, [source, sourceId, sources]);

  const sampleFields = useMemo(
    () => (source?.sample !== undefined ? extractDataFields(source.sample) : []),
    [source],
  );

  const resetBindingForm = () => {
    setPath('value');
    setProperty('value');
    setDecimals('');
    setPrefix('');
    setSuffix('');
    setThresholds([]);
    setEditingBindingId(null);
  };

  const buildBinding = (): Omit<SceneDataBinding, 'id'> => ({
    sourceId: source!.id,
    path: path.trim() || 'value',
    property,
    ...(decimals !== '' ? { decimals: Number(decimals) } : {}),
    ...(prefix.trim() ? { prefix: prefix.trim() } : {}),
    ...(suffix.trim() ? { suffix: suffix.trim() } : {}),
    ...(thresholds.length ? { thresholds } : {}),
  });

  const loadBindingForEdit = (binding: SceneDataBinding) => {
    setEditingBindingId(binding.id);
    setPath(binding.path);
    setProperty(binding.property);
    setDecimals(binding.decimals?.toString() ?? '');
    setPrefix(binding.prefix ?? '');
    setSuffix(binding.suffix ?? '');
    setThresholds(binding.thresholds ?? []);
  };

  const patch = (partial: Partial<SceneDataSource>) =>
    source && onPatchSource(source.id, partial);

  return (
    <div className="inspector-body data-source-panel">
      <div className="data-source-head">
        <span className="section-label">数据源</span>
        <button className="icon-button" onClick={onAddSource} title="添加数据源">
          <Plus size={14} />
        </button>
      </div>
      {sources.length ? (
        <>
          <select value={source?.id ?? ''} onChange={(event) => setSourceId(event.target.value)}>
            {sources.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {source && (
            <>
              <label className="field-label">
                名称
                <input
                  value={source.name}
                  onChange={(event) => patch({ name: event.target.value })}
                />
              </label>
              <label className="field-label">
                类型
                <select
                  value={source.type}
                  onChange={(event) =>
                    patch({ type: event.target.value as SceneDataSource['type'] })
                  }
                >
                  <option value="json">静态 JSON</option>
                  <option value="rest">REST 接口</option>
                  <option value="websocket">WebSocket</option>
                </select>
              </label>
              {source.type === 'json' ? (
                <label className="field-label">
                  JSON 内容
                  <textarea
                    value={source.json ?? ''}
                    onChange={(event) => patch({ json: event.target.value })}
                    rows={5}
                    spellCheck={false}
                    placeholder='{"value": 72}'
                  />
                </label>
              ) : source.type === 'websocket' ? (
                <label className="field-label">
                  WebSocket 地址
                  <input
                    value={source.url ?? ''}
                    onChange={(event) => patch({ url: event.target.value })}
                    placeholder="wss://..."
                  />
                </label>
              ) : (
                <>
                  <div className="field-row-inline">
                    <label className="field-label">
                      请求方法
                      <select
                        value={source.method ?? 'GET'}
                        onChange={(event) =>
                          patch({ method: event.target.value as 'GET' | 'POST' })
                        }
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </select>
                    </label>
                    <label className="field-label">
                      超时（秒）
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={source.timeout ?? 10}
                        onChange={(event) => patch({ timeout: Number(event.target.value) })}
                      />
                    </label>
                  </div>
                  <label className="field-label">
                    请求地址
                    <input
                      value={source.url ?? ''}
                      onChange={(event) => patch({ url: event.target.value })}
                      placeholder="https://..."
                      spellCheck={false}
                    />
                  </label>
                  <div className="field-label">
                    查询参数
                    <KeyValueEditor
                      values={source.params ?? {}}
                      keyPlaceholder="参数名"
                      valuePlaceholder="参数值"
                      onChange={(params) => patch({ params })}
                    />
                  </div>
                  {source.method === 'POST' && (
                    <label className="field-label">
                      请求体（JSON）
                      <textarea
                        value={source.body ?? ''}
                        onChange={(event) => patch({ body: event.target.value })}
                        rows={3}
                        spellCheck={false}
                        placeholder='{"key": "value"}'
                      />
                    </label>
                  )}
                  <div className="field-label">
                    请求头
                    <KeyValueEditor
                      values={source.headers ?? {}}
                      keyPlaceholder="Header"
                      valuePlaceholder="值"
                      onChange={(headers) => patch({ headers })}
                    />
                  </div>
                  <div className="field-row-inline">
                    <label className="field-label">
                      认证方式
                      <select
                        value={source.authType ?? 'none'}
                        onChange={(event) =>
                          patch({
                            authType: event.target.value as SceneDataSource['authType'],
                          })
                        }
                      >
                        {Object.entries(AUTH_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {source.authType && source.authType !== 'none' && (
                    <label className="field-label">
                      认证凭证（经服务端代理发送，不回显）
                      <input
                        type="password"
                        value={source.authValue ?? ''}
                        autoComplete="off"
                        placeholder={
                          source.hasAuthValue
                            ? '已保存，留空保持不变'
                            : source.authType === 'basic'
                              ? '用户名:密码'
                              : 'Token / API Key'
                        }
                        onChange={(event) => patch({ authValue: event.target.value })}
                      />
                    </label>
                  )}
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={source.useProxy !== false}
                      onChange={(event) => patch({ useProxy: event.target.checked })}
                    />
                    <span>经服务端代理请求（推荐，规避跨域并隐藏凭证）</span>
                  </label>
                </>
              )}
              <label className="field-label">
                刷新间隔（秒）
                <input
                  type="number"
                  min="1"
                  max="3600"
                  value={source.refreshInterval ?? 10}
                  onChange={(event) => patch({ refreshInterval: Number(event.target.value) })}
                />
              </label>
              <div className="data-source-actions">
                <button className="outline-button" onClick={() => void onTestSource(source)}>
                  测试连接 / 获取字段
                </button>
                <button
                  className="icon-button"
                  onClick={() => onDeleteSource(source.id)}
                  title="删除数据源"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              {status && <div className="data-source-status">{status}</div>}
              {sampleFields.length > 0 && (
                <div className="field-sample-list">
                  <div className="section-label">字段样例（{sampleFields.length}）</div>
                  {sampleFields.map((field) => (
                    <button
                      type="button"
                      className="field-sample-row"
                      key={field.path}
                      title="点击填入数据路径"
                      onClick={() => setPath(field.path)}
                    >
                      <code>{field.path}</code>
                      <span className="field-sample-meta">
                        {field.type}
                        {field.sample !== undefined ? ` · ${field.sample}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <div className="field-section">
                <div className="section-label">
                  <span>绑定到当前对象</span>
                </div>
                <label className="field-label">
                  数据路径
                  <input
                    value={path}
                    onChange={(event) => setPath(event.target.value)}
                    placeholder="data.value"
                  />
                </label>
                <label className="field-label">
                  目标属性
                  <select
                    value={property}
                    onChange={(event) =>
                      setProperty(event.target.value as SceneDataBindingProperty)
                    }
                  >
                    <option value="value">数值</option>
                    <option value="text">文本</option>
                    <option value="color">颜色</option>
                    <option value="opacity">透明度</option>
                    <option value="visible">可见性</option>
                  </select>
                </label>
                {property === 'value' && (
                  <>
                    <div className="field-row-inline">
                      <label className="field-label">
                        小数位
                        <input
                          type="number"
                          min={0}
                          max={6}
                          value={decimals}
                          onChange={(event) => setDecimals(event.target.value)}
                        />
                      </label>
                      <label className="field-label">
                        前缀
                        <input value={prefix} onChange={(event) => setPrefix(event.target.value)} />
                      </label>
                      <label className="field-label">
                        后缀
                        <input value={suffix} onChange={(event) => setSuffix(event.target.value)} />
                      </label>
                    </div>
                    <div className="field-label">
                      阈值着色
                      <div className="threshold-editor">
                        {thresholds.map((threshold, index) => (
                          <div className="threshold-row" key={threshold.id}>
                            <select
                              value={threshold.op}
                              onChange={(event) =>
                                setThresholds(
                                  thresholds.map((item, i) =>
                                    i === index
                                      ? { ...item, op: event.target.value as DataThreshold['op'] }
                                      : item,
                                  ),
                                )
                              }
                            >
                              {THRESHOLD_OPS.map((op) => (
                                <option key={op} value={op}>
                                  {op}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={threshold.value}
                              onChange={(event) =>
                                setThresholds(
                                  thresholds.map((item, i) =>
                                    i === index
                                      ? { ...item, value: Number(event.target.value) }
                                      : item,
                                  ),
                                )
                              }
                            />
                            <input
                              type="color"
                              value={threshold.color}
                              onChange={(event) =>
                                setThresholds(
                                  thresholds.map((item, i) =>
                                    i === index ? { ...item, color: event.target.value } : item,
                                  ),
                                )
                              }
                            />
                            <button
                              type="button"
                              className="icon-button"
                              onClick={() =>
                                setThresholds(thresholds.filter((_, i) => i !== index))
                              }
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="outline-button kv-add"
                          onClick={() =>
                            setThresholds([
                              ...thresholds,
                              {
                                id: `threshold-${Date.now()}-${thresholds.length}`,
                                op: '>',
                                value: 0,
                                color: '#ef7680',
                              },
                            ])
                          }
                        >
                          <Plus size={12} /> 添加阈值
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {editingBindingId ? (
                  <div className="data-source-actions">
                    <button
                      className="outline-button"
                      onClick={() => {
                        onUpdateBinding(editingBindingId, buildBinding());
                        resetBindingForm();
                      }}
                    >
                      保存修改
                    </button>
                    <button className="outline-button" onClick={resetBindingForm}>
                      取消编辑
                    </button>
                  </div>
                ) : (
                  <button
                    className="outline-button"
                    onClick={() => {
                      onAddBinding(buildBinding());
                      resetBindingForm();
                    }}
                  >
                    添加绑定
                  </button>
                )}
                <div className="binding-list">
                  {(selected.dataBindings ?? []).map((binding) => (
                    <div className="binding-row" key={binding.id}>
                      <span>
                        {binding.property} ← {binding.path}
                        {binding.decimals !== undefined ? ` · ${binding.decimals}位小数` : ''}
                        {binding.prefix ? ` · 前缀${binding.prefix}` : ''}
                        {binding.suffix ? ` · 后缀${binding.suffix}` : ''}
                        {binding.thresholds?.length ? ` · ${binding.thresholds.length}条阈值` : ''}
                      </span>
                      <span className="binding-actions">
                        <button
                          className="icon-button"
                          title="编辑"
                          onClick={() => loadBindingForEdit(binding)}
                        >
                          ✎
                        </button>
                        <button
                          className="icon-button"
                          onClick={() => onDeleteBinding(binding.id)}
                          title="删除绑定"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="inspector-empty">
          <strong>暂无数据源</strong>
          <span>点击右上角添加 JSON、REST 或 WebSocket 数据源</span>
        </div>
      )}
    </div>
  );
}
