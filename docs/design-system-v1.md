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
- **Story:** Continue/New Story entry, then the current terminal page.
- **Arcade:** one five-cabinet overview. A cabinet opens a dedicated trial sheet
  rather than crowding every mode into the overview.
- **Terminal:** five transcript rows with a single right-aligned state:
  unopened, retry required, transcript ready, or transcript read.
- **Settings:** stable Display, Sound, Controls, and Data sections; one group at
  a time. Initials are entered on the score-entry screen, using keyboard or gamepad.
- **Games:** keep permanent text outside the central playfield where possible.

The Arcade trial sheet shares the terminal frame: title and engine above one
top rule, Tutorial at left, mode/player/score controls at right, and a stable
footer with real BACK · ⌫ / B and SELECT · ENTER / A controls. Information appears immediately rather than
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
same spatial navigation as arrow keys. Menu selection uses ENTER / A; live
Player A action uses SPACE / A.

An action key is release-latched across transitions: a press used to reveal a
terminal page or complete a game cannot also activate the next surface.
Important instructions never exist only on canvas.

## Cabinet presentation

- **Qong:** cream paddles, ball, court, and compact score state. Rule state does
  not cross the pitch.
- **SkiPixl:** compact seven-angle skier, distinct trees/moguls/gates, and
  restrained trails that strengthen with Down acceleration. No forward spray.
- **Quantman:** continuous raster maze rails, distinct player/ghost family, and
  `QUANTMAN` title and `HOLD` / `INVERT` labels. Both use the same vision cone;
  no floating target square. Changed walls retain a solid two-pixel muted-brown
  stroke, unchanged walls one-pixel cream. No maze selector.
- **Fluxball:** role-distinct figures and readable pitch. A held ball appears
  once at a hand socket with a short arm pose; never draw a possession beam.
- **Quarry:** four distinct ducks and identity labels; open horizontal wrap
  without side chevrons. No relationship lines or boxes around ducks. Fixed
  A–D header columns state who hunts whom. Grace briefly blinks the sprite.
  Each relation change triggers one 100 ms tobacco-colour screen pulse.
  Opening, round-end and final-result notices replace the top HUD.
- **Pause:** all five games replace their normal top HUD with the shared boxed
  PAUSED header. Resume restores it. Keep the field unobstructed.

## Terminal grammar

A Story terminal page types header, top rule, then body. Actions appear at the
left below the final text unit only after completion. The block keeps flashing unless Reduced Motion is
active. Heading, readable text measure and paragraph rhythm share one layout;
footer actions sit in their own region without a redundant inner rule. See
[Terminal Story](story-terminal.md).

## Audio grammar

The title is silent. Menu backing and terminal music are mutually exclusive
route cues, unlocked by the first valid user gesture.
Games, their pauses, and results are effects-only. Cue transitions fade without
overlap, same-cue navigation preserves transport position, and tab suspension
resumes the latest request. See [Audio](audio.md).

## Review gate

Visible changes require native and enlarged pixel inspection, a served desktop
view, keyboard/pointer/gamepad focus checks, and exact palette/binary-alpha
audits. Screenshots and tests do not replace human judgment of legibility,
comprehension, sound, or feel.

Keyboard navigation reserves Escape for browser fullscreen. Backspace (⌫) mirrors controller B; P/Start pauses and resumes. Leaving fullscreen pauses an unfinished game without toggling an already-paused game. Tab retains native focus traversal; Backspace edits initials while an initials slot is focused.
