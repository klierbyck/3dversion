import { useEffect, useState } from 'react';
import { Plus, Settings2, Trash2, X } from 'lucide-react';
import type {
  SceneDataBinding,
  SceneDataBindingProperty,
  SceneDataSource,
  SceneNode,
} from '../types';

export function Inspector({
  selected,
  setNode,
}: {
  selected: SceneNode;
  setNode: (patch: Partial<SceneNode>) => void;
}) {
  const number = (value: number, onChange: (value: number) => void) => (
    <input
      type="number"
      value={value}
      step="0.1"
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
  return (
    <div className="inspector-body">
      <label className="field-label">
        名称
        <input value={selected.name} onChange={(event) => setNode({ name: event.target.value })} />
      </label>
      <div className="field-section">
        <div className="section-label">
          <span>变换</span>
          <span className="section-tag">WORLD</span>
        </div>
        {(['position', 'rotation', 'scale'] as const).map((key) => (
          <div className="vector-field" key={key}>
            <span>{key === 'position' ? '位置' : key === 'rotation' ? '旋转' : '缩放'}</span>
            {selected[key].map((value, index) => (
              <div className={`number-wrap ${['x', 'y', 'z'][index]}`} key={`${key}-${index}`}>
                {number(value, (next) => {
                  const vector = [...selected[key]] as [number, number, number];
                  vector[index] = next;
                  setNode({ [key]: vector });
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="field-section">
        <div className="section-label">
          <span>外观</span>
          <Settings2 size={14} />
        </div>
        <label className="field-label">
          颜色
          <div className="color-input">
            <input
              type="color"
              value={selected.color ?? '#34d399'}
              onChange={(event) => setNode({ color: event.target.value })}
            />
            <input
              value={selected.color ?? '#34d399'}
              onChange={(event) => setNode({ color: event.target.value })}
            />
          </div>
        </label>
        <label className="field-label">
          透明度
          <div className="range-row">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={selected.opacity ?? 1}
              onChange={(event) => setNode({ opacity: Number(event.target.value) })}
            />
            <span>{Math.round((selected.opacity ?? 1) * 100)}%</span>
          </div>
        </label>
        {(selected.kind === 'text' || selected.kind === 'label' || selected.kind === 'popup') && (
          <label className="field-label">
            文本
            <input
              value={selected.text ?? ''}
              onChange={(event) => setNode({ text: event.target.value })}
            />
          </label>
        )}
        {(selected.kind === 'bar' || selected.kind === 'label') && (
          <label className="field-label">
            数据值
            <div className="range-row">
              <input
                type="range"
                min="0"
                max="100"
                value={selected.value ?? 50}
                onChange={(event) => setNode({ value: Number(event.target.value) })}
              />
              <span>{selected.value ?? 50}</span>
            </div>
          </label>
        )}
      </div>
      <label className="toggle-row">
        <span>可见</span>
        <input
          type="checkbox"
          checked={selected.visible}
          onChange={(event) => setNode({ visible: event.target.checked })}
        />
      </label>
      <label className="toggle-row">
        <span>锁定</span>
        <input
          type="checkbox"
          checked={selected.locked}
          onChange={(event) => setNode({ locked: event.target.checked })}
        />
      </label>
    </div>
  );
}

/** 底部场景编排区：时间轴和场景级事件都作用于整个画布。 */
export function DataSourcePanel({
  selected,
  sources,
  status,
  onAddSource,
  onPatchSource,
  onDeleteSource,
  onAddBinding,
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
  onDeleteBinding: (id: string) => void;
  onTestSource: (source: SceneDataSource) => Promise<void>;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id ?? '');
  const [path, setPath] = useState('value');
  const [property, setProperty] = useState<SceneDataBindingProperty>('value');
  const source = sources.find((item) => item.id === sourceId) ?? sources[0];
  useEffect(() => {
    if (source && !sources.some((item) => item.id === sourceId)) setSourceId(source.id);
  }, [source, sourceId, sources]);
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
                  onChange={(event) => onPatchSource(source.id, { name: event.target.value })}
                />
              </label>
              <label className="field-label">
                类型
                <select
                  value={source.type}
                  onChange={(event) =>
                    onPatchSource(source.id, {
                      type: event.target.value as SceneDataSource['type'],
                    })
                  }
                >
                  <option value="json">静态 JSON</option>
                  <option value="rest">REST GET</option>
                  <option value="websocket">WebSocket</option>
                </select>
              </label>
              {source.type === 'json' ? (
                <label className="field-label">
                  JSON
                  <textarea
                    value={source.json ?? ''}
                    onChange={(event) => onPatchSource(source.id, { json: event.target.value })}
                    rows={4}
                  />
                </label>
              ) : (
                <label className="field-label">
                  地址
                  <input
                    value={source.url ?? ''}
                    onChange={(event) => onPatchSource(source.id, { url: event.target.value })}
                    placeholder={source.type === 'websocket' ? 'wss://...' : 'https://...'}
                  />
                </label>
              )}
              <label className="field-label">
                刷新间隔（秒）
                <input
                  type="number"
                  min="1"
                  max="3600"
                  value={source.refreshInterval ?? 10}
                  onChange={(event) =>
                    onPatchSource(source.id, { refreshInterval: Number(event.target.value) })
                  }
                />
              </label>
              <div className="data-source-actions">
                <button className="outline-button" onClick={() => void onTestSource(source)}>
                  测试连接
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
                <button
                  className="outline-button"
                  onClick={() =>
                    onAddBinding({ sourceId: source.id, path: path.trim() || 'value', property })
                  }
                >
                  添加绑定
                </button>
                <div className="binding-list">
                  {(selected.dataBindings ?? []).map((binding) => (
                    <div className="binding-row" key={binding.id}>
                      <span>
                        {binding.property} ← {binding.path}
                      </span>
                      <button
                        className="icon-button"
                        onClick={() => onDeleteBinding(binding.id)}
                        title="删除绑定"
                      >
                        <X size={12} />
                      </button>
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
          <span>点击右上角添加 JSON 或 REST 数据源</span>
        </div>
      )}
    </div>
  );
}
