export type GisPosition = [number, number];

export type GisPrimitive =
  | { kind: 'point'; point: GisPosition }
  | { kind: 'line'; points: GisPosition[] }
  | { kind: 'polygon'; rings: GisPosition[][] };

export type GisParseResult = {
  primitives: GisPrimitive[];
  error: string | null;
};

const MAX_GIS_COORDINATES = 5000;

function position(value: unknown): GisPosition | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) return null;
  return [longitude, latitude];
}

function positions(value: unknown): GisPosition[] | null {
  if (!Array.isArray(value)) return null;
  const result = value.map(position);
  return result.every((item): item is GisPosition => item !== null) ? result : null;
}

/** 将常用 GeoJSON 几何统一展开成点、线、面，便于 Three.js 直接渲染。 */
export function parseGeoJson(input: string | undefined): GisParseResult {
  if (!input?.trim()) return { primitives: [], error: null };
  let coordinateCount = 0;
  const primitives: GisPrimitive[] = [];

  const addPositions = (items: GisPosition[]) => {
    coordinateCount += items.length;
    if (coordinateCount > MAX_GIS_COORDINATES) throw new Error('坐标数量不能超过 5000 个');
  };

  const collect = (value: unknown): void => {
    if (!value || typeof value !== 'object') throw new Error('GeoJSON 结构无效');
    const item = value as { type?: unknown; coordinates?: unknown; geometry?: unknown; features?: unknown; geometries?: unknown };
    if (item.type === 'FeatureCollection') {
      if (!Array.isArray(item.features)) throw new Error('FeatureCollection 缺少 features');
      item.features.forEach(collect);
      return;
    }
    if (item.type === 'Feature') {
      if (item.geometry === null) return;
      collect(item.geometry);
      return;
    }
    if (item.type === 'GeometryCollection') {
      if (!Array.isArray(item.geometries)) throw new Error('GeometryCollection 缺少 geometries');
      item.geometries.forEach(collect);
      return;
    }
    if (item.type === 'Point') {
      const point = position(item.coordinates);
      if (!point) throw new Error('Point 坐标无效');
      addPositions([point]);
      primitives.push({ kind: 'point', point });
      return;
    }
    if (item.type === 'MultiPoint') {
      const points = positions(item.coordinates);
      if (!points) throw new Error('MultiPoint 坐标无效');
      addPositions(points);
      points.forEach((point) => primitives.push({ kind: 'point', point }));
      return;
    }
    if (item.type === 'LineString') {
      const points = positions(item.coordinates);
      if (!points || points.length < 2) throw new Error('LineString 至少需要两个坐标');
      addPositions(points);
      primitives.push({ kind: 'line', points });
      return;
    }
    if (item.type === 'MultiLineString') {
      if (!Array.isArray(item.coordinates)) throw new Error('MultiLineString 坐标无效');
      item.coordinates.forEach((line) => collect({ type: 'LineString', coordinates: line }));
      return;
    }
    if (item.type === 'Polygon') {
      if (!Array.isArray(item.coordinates)) throw new Error('Polygon 坐标无效');
      const rings = item.coordinates.map(positions);
      if (!rings.length || !rings.every((ring): ring is GisPosition[] => Boolean(ring && ring.length >= 3))) {
        throw new Error('Polygon 每个环至少需要三个坐标');
      }
      rings.forEach(addPositions);
      primitives.push({ kind: 'polygon', rings });
      return;
    }
    if (item.type === 'MultiPolygon') {
      if (!Array.isArray(item.coordinates)) throw new Error('MultiPolygon 坐标无效');
      item.coordinates.forEach((polygon) => collect({ type: 'Polygon', coordinates: polygon }));
      return;
    }
    throw new Error(`暂不支持 ${String(item.type ?? '未知')} 类型`);
  };

  try {
    collect(JSON.parse(input));
    return { primitives, error: null };
  } catch (error) {
    return {
      primitives: [],
      error: error instanceof Error ? error.message : 'GeoJSON 解析失败',
    };
  }
}

/** 将经纬度按局部等距近似投影到 12x12 的地图平面。 */
export function projectGisPosition(
  point: GisPosition,
  center: GisPosition,
  rangeMeters: number,
): [number, number] {
  const metersPerLongitudeDegree = 111320 * Math.cos((center[1] * Math.PI) / 180);
  const safeRange = Math.max(10, rangeMeters);
  const x = ((point[0] - center[0]) * metersPerLongitudeDegree * 12) / safeRange;
  const z = (-(point[1] - center[1]) * 111320 * 12) / safeRange;
  return [x, z];
}
