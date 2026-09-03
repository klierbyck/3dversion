import { describe, expect, it } from 'vitest';
import { parseGeoJson, projectGisPosition } from '../src/lib/gis';
import { createNode } from '../src/types';
import { validateNode } from '../src/schemas/validate';
import { buildObject, disposeObject } from '../src/sceneObjects';

describe('lightweight GIS', () => {
  it('creates a usable GIS map with local defaults', () => {
    const node = createNode('gisMap', 4);

    expect(node.position).toEqual([0, 0, 0]);
    expect(node.gisMapStyle).toBe('dark');
    expect(node.gisShowBasemap).toBe(true);
    expect(node.gisRange).toBe(1200);
    expect(node.gisTileUrl).toContain('{z}/{x}/{y}');
    expect(node.gisZoom).toBe(15);
    expect(parseGeoJson(node.gisGeoJson).primitives).toHaveLength(2);
  });

  it('expands common GeoJSON geometry types', () => {
    const result = parseGeoJson(
      JSON.stringify({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [121.4, 31.2] } },
          {
            type: 'Feature',
            geometry: {
              type: 'MultiLineString',
              coordinates: [
                [
                  [121.4, 31.2],
                  [121.41, 31.21],
                ],
                [
                  [121.42, 31.22],
                  [121.43, 31.23],
                ],
              ],
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [121.4, 31.2],
                  [121.41, 31.2],
                  [121.41, 31.21],
                  [121.4, 31.2],
                ],
              ],
            },
          },
        ],
      }),
    );

    expect(result.error).toBeNull();
    expect(result.primitives.map((item) => item.kind)).toEqual([
      'point',
      'line',
      'line',
      'polygon',
    ]);
  });

  it('projects the center to the map origin and latitude northward', () => {
    expect(projectGisPosition([121.4737, 31.2304], [121.4737, 31.2304], 1000)).toEqual([
      0, -0,
    ]);
    const north = projectGisPosition([121.4737, 31.2314], [121.4737, 31.2304], 1000);
    expect(north[1]).toBeLessThan(0);
  });

  it('reports malformed GeoJSON as a node validation error', () => {
    const node = { ...createNode('gisMap', 0), gisGeoJson: '{bad json' };
    expect(parseGeoJson(node.gisGeoJson).error).toBeTruthy();
    expect(validateNode(node).gisGeoJson).toBeTruthy();
  });

  it('requires all XYZ placeholders when a tile source is configured', () => {
    const node = { ...createNode('gisMap', 0), gisTileUrl: 'https://tiles.test/{z}/{x}.png' };
    expect(validateNode(node).gisTileUrl).toContain('{z}、{x}、{y}');
  });

  it('builds a selectable map surface and overlay geometry', () => {
    const object = buildObject(createNode('gisMap', 0));
    expect(object.children.length).toBeGreaterThan(20);
    expect(object.children.some((child) => child.userData.tintable)).toBe(true);
    disposeObject(object);
  });

  it('supports overlay-only layers without creating another basemap', () => {
    const node = { ...createNode('gisMap', 0), gisShowBasemap: false };
    const object = buildObject(node);

    expect(object.children.some((child) => child.userData.gisBasemap)).toBe(false);
    expect(object.children.some((child) => child.userData.tintable)).toBe(true);
    disposeObject(object);
  });
});
