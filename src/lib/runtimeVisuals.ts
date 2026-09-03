import type { SceneNode } from '../types';

export function effectiveVisualNode(node: SceneNode, value?: number): SceneNode {
  if (value === undefined) return node;
  if (node.kind === 'line') {
    const previous = node.series ?? [];
    return {
      ...node,
      value,
      series: previous.length ? [...previous.slice(1), value] : [value],
    };
  }
  return { ...node, value };
}

export function visualSignature(node: SceneNode): string | null {
  if (node.kind === 'gisMap') {
    return JSON.stringify([
      node.kind,
      node.gisLongitude,
      node.gisLatitude,
      node.gisRange,
      node.gisMapStyle,
      node.gisShowBasemap,
      node.gisShowGrid,
      node.gisTileUrl,
      node.gisZoom,
      node.gisAttribution,
      node.gisGeoJson,
      node.gisOverlayHeight,
    ]);
  }
  if (!['bar', 'line', 'gauge'].includes(node.kind)) return null;
  return JSON.stringify([node.kind, node.value, node.series, node.min, node.max]);
}
