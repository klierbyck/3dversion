// 用 three 的 Font 实际加载生成的 typeface.json，验证中文可成字
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const json = JSON.parse(
  fs.readFileSync(path.join(here, '..', '..', 'public', 'fonts', 'noto-sans-sc-subset.typeface.json'), 'utf-8'),
);
const font = new Font(json);
const samples = ['三维可视化', '数据源与事件', '能耗监测ABC123', '，。、？！'];
let ok = true;
for (const text of samples) {
  const shapes = font.generateShapes(text, 1);
  const points = shapes.reduce((sum, s) => sum + (s.getPoints(8).length), 0);
  console.log(`「${text}」 shapes=${shapes.length} points=${points}`);
  if (shapes.length === 0) ok = false;
}
console.log(ok ? 'PASS: 中文 3D 字形可正常生成' : 'FAIL: 存在空字形');
process.exit(ok ? 0 : 1);
