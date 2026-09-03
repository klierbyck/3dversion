# -*- coding: utf-8 -*-
"""
Noto Sans SC 可变字体 -> 静态 Regular 子集 TTF
字符集：GB2312 一级汉字(3755) + ASCII 可见字符 + 中文标点 + 常用技术符号
用途：Three.js FontLoader(typeface.json) 的中文 3D 文字字形来源
授权：SIL OFL 1.1（Noto Sans SC, Google/Adobe），允许随项目再分发
"""
import os
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "NotoSansSC-VF.ttf")
STATIC = os.path.join(HERE, "NotoSansSC-Regular-Full.ttf")
OUT_TTF = os.path.join(HERE, "NotoSansSC-Subset.ttf")
CHARS_TXT = os.path.join(HERE, "chars.txt")

# 1. GB2312 一级汉字（区位 16-55 区，覆盖现代中文文本 99.9%）
hanzi = []
for b1 in range(0xB0, 0xD8):
    for b2 in range(0xA1, 0xFF):
        try:
            hanzi.append(bytes([b1, b2]).decode("gb2312"))
        except UnicodeDecodeError:
            pass

# 2. ASCII 可见字符
ascii_chars = [chr(c) for c in range(0x20, 0x7F)]

# 3. 中文标点与技术文档常用符号
punct = list("，。、；：？！“”‘’（）《》【】〈〉「」『』…—·～~￥%℃°×÷±≤≥≠≈←↑→↓★☆●○◆◇■□▲△§№")

chars = sorted(set(ascii_chars + hanzi + punct))
with open(CHARS_TXT, "w", encoding="utf-8") as f:
    f.write("".join(chars))
print(f"字符集: 汉字 {len(hanzi)}，合计 {len(chars)} 字 -> chars.txt")

# 4. 可变字体固定为 wght=400 静态字重
font = TTFont(SRC)
instantiateVariableFont(font, {"wght": 400}, inplace=True)
font.save(STATIC)
font.close()
print(f"静态 Regular: {os.path.getsize(STATIC)/1024/1024:.2f} MB")

# 5. 子集化（保留名称表与推荐字形，去除用不到的布局表）
options = subset.Options()
options.name_IDs = ["*"]
options.notdef_outline = True
options.recommended_glyphs = True
options.layout_features = ["kern"]
options.drop_tables = ["GSUB", "GPOS"]
options.hinting = False
options.desubroutinize = True
font_subset = subset.load_font(STATIC, options)
subsetter = subset.Subsetter(options=options)
subsetter.populate(text="".join(chars))
subsetter.subset(font_subset)
subset.save_font(font_subset, OUT_TTF, options)
size = os.path.getsize(OUT_TTF)
print(f"子集 TTF: {size/1024:.1f} KB ({size/1024/1024:.2f} MB) -> {OUT_TTF}")
