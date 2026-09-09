# Quantum Box design system

**Status:** binding browser implementation contract, revised 2026-09-09

**Logical screen:** `320×180`

## Visual grammar

Quantum Box is a handmade early electronic game system, not a generic CRT
shader. Every surface uses one native logical framebuffer with three colours:

| Role         | Value     | Use                                               |
| ------------ | --------- | ------------------------------------------------- |
| dark tobacco | `#2B1C14` | negative space, outlines, and deepest field       |
| muted tan    | `#564330` | the second field value and subordinate structure  |
| warm cream   | `#D6BD8B` | text, focus, sprites, courts, walls, and controls |

The Brown Box background uses dark tobacco and muted tan. Warm cream is local
interface/game geometry, not provider output. Do not add antialiasing, blur,
gradient, glow, bloom, opacity-derived shades, generic CRT damage, or fractional
placement.

## Surface hierarchy

- **Title:** animated selected field; centred `QUANTUM BOX`; centred
  `PRESS START`; no photographic cabinet or secondary copy inside the display.
- **Home:** four quiet rows—Story, Arcade, Terminal, Settings.
- **Story:** no selector. Render the current terminal page directly.
- **Arcade:** one five-cabinet overview. A cabinet opens a dedicated trial sheet
  rather than crowding every mode into the overview.
- **Terminal:** five transcript rows with a single right-aligned state:
  unopened, retry required, transcript ready, or transcript read.
- **Settings:** stable Display, Field, Controls, and Data sections; one group at
  a time. Initials receive their own row.
- **Games:** keep permanent text outside the central playfield where possible.

The Arcade trial sheet shares the terminal frame: title and engine above one
top rule, Tutorial at left, mode/player/score controls at right, and one bottom
rule with nothing beneath it. Information appears immediately rather than
typing.

## Bitmap type and geometry

All visible type is painted by the bitmap layer. Semantic DOM text remains for
accessibility but does not independently paint borders, icons, focus rings, or
glyphs. DOM bounds are projected to integer logical rectangles.

- Body text uses the native bitmap face with at least one logical tracking
  column.
- The title uses the 5×7 face at three-pixel cell scale.
- `PRESS START` uses the 5×7 face at two-pixel cell scale.
- Required punctuation and `™` are authored bitmap glyphs, never browser-font
  fallbacks.
- Public raster helpers reject fractional positions, sizes, widths, and scales.

At viewport sizes that permit it, scale the complete framebuffer by an integer
multiple using nearest-neighbour interpolation. Non-100% browser zoom cannot be
guaranteed to align with physical device pixels.

## Input and focus

Transparent native buttons and form controls own semantics, focus, pointer,
keyboard, and screen-reader behavior. The bitmap layer paints their state.
Selectors sit outside numerals and labels. D-pad/gamepad movement follows the
same focus order as arrow keys.

An action key is release-latched across transitions: a press used to reveal a
terminal page or complete a game cannot also activate the next surface.
Important instructions never exist only on canvas.

## Cabinet presentation

- **Qong:** cream paddles, ball, court, and compact score state. Rule state does
  not cross the pitch.
- **SkiPixl:** compact seven-angle skier, distinct trees/moguls/gates, no trail
  or speed panel. Down acceleration is explained on the trial sheet.
- **Quantman:** continuous raster maze rails, distinct player/ghost family, and
  `HOLD` / `INVERT` labels. No maze selector.
- **Fluxball:** role-distinct figures and readable pitch. A held ball appears
  once at a hand socket with a short arm pose; never draw a possession beam.
- **Quarry:** four distinct ducks, open horizontal wrap, human pursuit lines as
  thin continuous cream and CPU lines as cream dashes, plus visible knockout
  and respawn grace.

## Terminal grammar

A Story terminal page types header, top rule, then body. Actions appear at the
bottom right only after completion. The block flashes unless Reduced Motion is
active. One bottom framing rule appears with no text beneath it. See
[Terminal Story](story-terminal.md).

## Audio grammar

Title hum, menu backing, and terminal music are mutually exclusive route cues.
Games, their pauses, and results are effects-only. Cue transitions fade without
overlap, same-cue navigation preserves transport position, and tab suspension
resumes the latest request. See [Audio](audio.md).

## Review gate

Visible changes require native and enlarged pixel inspection, a served desktop
view, keyboard/pointer/gamepad focus checks, and exact palette/binary-alpha
audits. Screenshots and tests do not replace human judgment of legibility,
comprehension, sound, or feel.
