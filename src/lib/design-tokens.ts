// Cosystem design tokens for code that cannot use a Tailwind class — SVG
// charts, canvas, inline styles in emails. The source of truth is the
// @theme block in src/app/globals.css; keep these values in step with it.
//
// Prototype V7 (Nov 2026): warm orange on ink and cream, Inter.

export const colors = {
  brand: "#F36B21",
  brandStrong: "#DF5814",
  brandInk: "#C2410C",
  brandSoft: "#FFF0E4",
  brandLight: "#FFC9A6",

  ink: "#171717",
  ink2: "#3F3F46",
  ink3: "#62636A",

  line: "#EEE8E1",
  lineStrong: "#DDD6CF",

  cream: "#FFF7EF",
  cream2: "#FFFAF5",
  canvas: "#F6F5F3",
  panel: "#1C1C1E",
  panel2: "#2A2A2D",

  success: "#15803D",
  successInk: "#166534",
  successSoft: "#E7F6EC",
  successLine: "#B7E0C3",
} as const;

export const typography = {
  fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
} as const;

export const radius = {
  control: "999px", // buttons are pills
  card: "16px",
  tile: "17px", // feature icon tile
  panel: "22px",
} as const;
