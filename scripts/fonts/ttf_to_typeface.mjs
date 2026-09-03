// 子集 TTF -> Three.js FontLoader typeface.json
// 输出格式对齐 three/examples/jsm/loaders/FontLoader.js（坐标为字体单位，y 由 FontLoader 内部翻转）
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const opentype = require('opentype.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const TTF = path.join(here, 'NotoSansSC-Subset.ttf');
const CHARS = path.join(here, 'chars.txt');
const OUT = path.join(projectRoot, 'public', 'fonts', 'noto-sans-sc-subset.typeface.json');

// 量化到 500em 精度（SCALE=2）：3D 文字尺寸下误差 < 0.5%，体积更小；
// ha/resolution 同比例缩放，视觉宽度不变
const SCALE = 2;
const round = (v) => Math.round((v || 0) / SCALE);
// opentype.js 2.x：loadSync 已废弃，统一用 parse(ArrayBuffer)
const buf = fs.readFileSync(TTF);
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const font = opentype.parse(arrayBuffer);
const text = fs.readFileSync(CHARS, 'utf-8');
const chars = [...new Set(text)].filter((c) => c !== '\n' && c !== '\r');

const glyphs = {};
let missing = [];
for (const ch of chars) {
  const glyph = font.charToGlyph(ch);
  if (!glyph || glyph.index === 0) {
    // 空格等无轮廓字符仍需要字宽；真正缺字记录下来
    if (ch !== ' ') missing.push(ch);
    glyphs[ch] = { ha: round(glyph?.advanceWidth), x_min: 0, x_max: 0, o: '' };
    continue;
  }
  const commands = glyph.path?.commands ?? [];
  const o = [];
  for (const c of commands) {
    switch (c.type) {
      case 'M': o.push(`m ${round(c.x)} ${round(c.y)}`); break;
      case 'L': o.push(`l ${round(c.x)} ${round(c.y)}`); break;
      case 'Q': o.push(`q ${round(c.x1)} ${round(c.y1)} ${round(c.x)} ${round(c.y)}`); break;
      case 'C': o.push(`b ${round(c.x1)} ${round(c.y1)} ${round(c.x2)} ${round(c.y2)} ${round(c.x)} ${round(c.y)}`); break;
      case 'Z': o.push('z'); break;
      default: break;
    }
  }
  glyphs[ch] = {
    ha: round(glyph.advanceWidth),
    x_min: round(glyph.xMin),
    x_max: round(glyph.xMax),
    // FontLoader 要求 o 为空格连接的单一字符串
    o: o.join(' '),
  };
}

const names = font.names?.fontFamily ?? { en: 'Noto Sans SC' };
const data = {
  glyphs,
  familyName: names.en ?? 'Noto Sans SC',
  ascender: round(font.ascender),
  descender: round(font.descender),
  underlinePosition: round(font.tables.post?.underlinePosition ?? -100),
  underlineThickness: round(font.tables.post?.underlineThickness ?? 50),
  boundingBox: {
    xMin: round(font.tables.head?.xMin),
    yMin: round(font.tables.head?.yMin),
    xMax: round(font.tables.head?.xMax),
    yMax: round(font.tables.head?.yMax),
  },
  resolution: Math.round(font.unitsPerEm / SCALE),
  original_font_information: {
    copyright: 'Copyright 2015-2024 Adobe/Google, SIL OFL 1.1',
    subset: 'GB2312 level-1 hanzi + ASCII + CJK punctuation',
  },
  cssFontWeight: '400',
  cssFontStyle: 'normal',
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data));
const kb = fs.statSync(OUT).size / 1024;
console.log(`glyphs: ${Object.keys(glyphs).length}, missing: ${missing.length ? missing.join('') : '(none)'}`);
console.log(`typeface.json: ${kb.toFixed(1)} KB -> ${path.relative(projectRoot, OUT)}`);
