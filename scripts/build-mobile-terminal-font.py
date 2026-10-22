"""Build the mobile web font from the existing terminal renderer.

Optional authoring dependencies: fonttools and brotli. No runtime dependencies.
Run from the repository root with Python and Node (TypeScript stripping support).
"""
import json
import subprocess
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

source = """
import {TERMINAL_GLYPHS, terminalGlyphRects, terminalTextWidth} from './src/display/TerminalTypeface.ts';
console.log(JSON.stringify(Object.fromEntries(Object.keys(TERMINAL_GLYPHS).map(c =>
[c, {width: terminalTextWidth(c) + 1, rects: terminalGlyphRects(c)}]))));
"""
data = json.loads(subprocess.check_output([
    "node", "--experimental-strip-types", "--input-type=module", "-e", source
]))
font = FontBuilder(1000, isTTF=True)
names = {c: "uni%04X" % ord(c) for c in data}
font.setupGlyphOrder([".notdef", *names.values()])
cmap = {ord(c): n for c, n in names.items()}
for c, n in names.items():
    if c.isalpha() and len(c.lower()) == 1:
        cmap[ord(c.lower())] = n
font.setupCharacterMap(cmap)
glyphs, metrics = {}, {}
for c in [None, *data]:
    pen = TTGlyphPen(None)
    name = ".notdef" if c is None else names[c]
    for rect in ([] if c is None else data[c]["rects"]):
        x, y = rect["x"] * 100, (7 - rect["y"]) * 100
        w, h = rect["width"] * 100, rect["height"] * 100
        pen.moveTo((x, y))
        pen.lineTo((x + w, y))
        pen.lineTo((x + w, y - h))
        pen.lineTo((x, y - h))
        pen.closePath()
    glyphs[name] = pen.glyph()
    metrics[name] = (600 if c is None else data[c]["width"] * 100, 0)
font.setupGlyf(glyphs)
font.setupHorizontalMetrics(metrics)
font.setupHorizontalHeader(ascent=800, descent=-200)
font.setupNameTable({"familyName": "Quantum Box Terminal", "styleName": "Regular",
    "uniqueFontIdentifier": "QuantumBoxTerminalMobile1", "fullName": "Quantum Box Terminal",
    "psName": "QuantumBoxTerminal"})
font.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
font.setupPost()
font.font.flavor = "woff2"
font.save("src/mobile/terminal.woff2")
