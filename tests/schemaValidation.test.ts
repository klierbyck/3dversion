import { describe, expect, it } from 'vitest';
import { validateSceneForPublish } from '../src/publishCheck';
import { getFieldsForKind, setPathValue } from '../src/schemas/nodeSchemas';
import { clampBySchema, parseNumberSeries, validateNode } from '../src/schemas/validate';
import { componentCatalog, createNode, type NodeKind, type SceneDocument } from '../src/types';

function fieldKeys(kind: NodeKind) {
  return getFieldsForKind(kind).map((field) => field.key);
}

describe('node schema descriptors', () => {
  it('exposes the common editable fields for every catalog component', () => {
    const common = ['name', 'parentId', 'position', 'rotation', 'scale', 'visible', 'locked'];

    for (const component of componentCatalog) {
      expect(fieldKeys(component.kind), component.kind).toEqual(expect.arrayContaining(common));
    }
  });

  it.each([
    ['text', ['text', 'fontSize', 'extrudeDepth', 'billboard']],
    ['light', ['intensity', 'distance']],
    ['directionalLight', ['intensity', 'castShadow']],
    ['ambientLight', ['intensity']],
    ['camera', ['cameraProjection', 'fov', 'near', 'far']],
    ['bar', ['value', 'min', 'max']],
    ['gauge', ['value', 'min', 'max']],
    ['line', ['series', 'min', 'max']],
    ['model', ['animation.autoplay', 'animation.clip']],
  ] as const)('exposes specialized fields for %s', (kind, expected) => {
    expect(fieldKeys(kind)).toEqual(expect.arrayContaining([...expected]));
  });
});

describe('schema value helpers', () => {
  it('updates a nested path without mutating the original object', () => {
    const node = createNode('model', 0);
    const next = setPathValue(node, 'animation.autoplay', false);

    expect(next).not.toBe(node);
    expect(next.animation).not.toBe(node.animation);
    expect(next.animation?.autoplay).toBe(false);
    expect(node.animation?.autoplay).toBe(true);
  });

  it('clamps numbers to schema limits and falls back for non-finite input', () => {
    const opacity = getFieldsForKind('box').find((field) => field.key === 'opacity')!;

    expect(clampBySchema(opacity, -2, 0.5)).toBe(0);
    expect(clampBySchema(opacity, 3, 0.5)).toBe(1);
    expect(clampBySchema(opacity, Number.NaN, 0.5)).toBe(0.5);
  });

  it('parses valid comma-separated series and rejects invalid input', () => {
    expect(parseNumberSeries('12, 28,35')).toEqual([12, 28, 35]);
    expect(parseNumberSeries('12，28，35')).toEqual([12, 28, 35]);
    expect(parseNumberSeries('12, nope, 35')).toBeNull();
    expect(parseNumberSeries(' , ')).toBeNull();
  });
});

describe('node schema validation', () => {
  it('rejects empty names, invalid opacity and non-positive scale', () => {
    const node = {
      ...createNode('box', 0),
      name: '',
      opacity: 1.2,
      scale: [1, 0, 1] as [number, number, number],
    };

    expect(validateNode(node)).toMatchObject({
      name: expect.any(String),
      opacity: expect.any(String),
      scale: expect.any(String),
    });
  });

  it('rejects a camera whose near plane is not before its far plane', () => {
    const node = { ...createNode('camera', 0), near: 20, far: 10 };
    expect(validateNode(node).far).toBeTruthy();
  });

  it.each(['bar', 'gauge'] as const)('rejects an invalid %s value range', (kind) => {
    const node = { ...createNode(kind, 0), min: 100, max: 100 };
    expect(validateNode(node).max).toBeTruthy();
  });

  it('turns schema failures into publish-blocking issues', () => {
    const scene: SceneDocument = {
      schemaVersion: '1.1.0',
      nodes: [{ ...createNode('box', 0), opacity: 2 }],
    };

    const issues = validateSceneForPublish(scene, []);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'error', category: 'JSON Schema' }),
    ]));
  });
});
