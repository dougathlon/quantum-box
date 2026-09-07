export const BROWN_BOX_LOGICAL_SCREEN = Object.freeze({
  width: 320,
  height: 180,
});

// Existing cabinet renderers use the original 640x360 coordinate plane. The
// shared display scales that plane exactly by one half while each cabinet is
// moved onto the native 320x180 grid in later slices.
export const LEGACY_CABINET_PLANE = Object.freeze({
  width: 640,
  height: 360,
  scale: 0.5,
});

export const BROWN_BOX_PALETTE = Object.freeze({
  ink: 0x2b1c14,
  tobacco: 0x564330,
  darkTobacco: 0x2b1c14,
  mutedTan: 0x564330,
  cream: 0xd6bd8b,
  paper: 0xd6bd8b,
  rust: 0xd6bd8b,
  amber: 0xd6bd8b,
  olive: 0xd6bd8b,
  blue: 0xd6bd8b,
});

export const BROWN_BOX_CSS_PALETTE = Object.freeze({
  ink: "#2b1c14",
  tobacco: "#564330",
  darkTobacco: "#2b1c14",
  mutedTan: "#564330",
  cream: "#d6bd8b",
  paper: "#d6bd8b",
  rust: "#d6bd8b",
  amber: "#d6bd8b",
  olive: "#d6bd8b",
  blue: "#d6bd8b",
});
