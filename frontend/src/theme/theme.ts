import { createTheme, type MantineColorsTuple } from "@mantine/core";

// Deep navy — primary. Used for the teacher identity, primary actions, active nav.
const navy: MantineColorsTuple = [
  "#eef1f7",
  "#d6dcea",
  "#adb9d2",
  "#8194b9",
  "#5c74a0",
  "#435c89",
  "#324873",
  "#253a61",
  "#1b2a4a",
  "#121c33",
];

// Muted academic blue — secondary, used for teacher message surfaces and links.
const academicBlue: MantineColorsTuple = [
  "#eff3f7",
  "#d7e1ea",
  "#b0c3d6",
  "#88a5c1",
  "#6689ac",
  "#4e7196",
  "#3c5c82",
  "#2e4a6b",
  "#213954",
  "#15283d",
];

// Soft teal — accent, used for the microphone control and small live-state hints.
const teal: MantineColorsTuple = [
  "#eaf7f6",
  "#cdeeea",
  "#a2ded8",
  "#78cdc5",
  "#57b8af",
  "#3f9f97",
  "#358883",
  "#2a6e6a",
  "#1f5451",
  "#153b39",
];

// Subtle gold/amber — learning highlight, used sparingly for vocabulary notes.
const amber: MantineColorsTuple = [
  "#fcf5e7",
  "#f6e7c6",
  "#eed6a0",
  "#e5c378",
  "#dcaf52",
  "#c99a44",
  "#a87f37",
  "#866429",
  "#644a1d",
  "#432f11",
];

// Muted green — success/clean-sentence state.
const success: MantineColorsTuple = [
  "#ebf5ef",
  "#cde6d9",
  "#a9d4be",
  "#84c1a2",
  "#66ac89",
  "#4e8b6b",
  "#3e7357",
  "#2f5a44",
  "#204232",
  "#132a1f",
];

export const theme = createTheme({
  primaryColor: "navy",
  primaryShade: { light: 8, dark: 5 },
  colors: {
    navy,
    academicBlue,
    teal,
    amber,
    success,
  },
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  headings: {
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: "600",
  },
  defaultRadius: "md",
  radius: {
    xs: "4px",
    sm: "6px",
    md: "8px",
    lg: "12px",
    xl: "16px",
  },
  shadows: {
    xs: "0 1px 2px rgba(27, 42, 74, 0.06)",
    sm: "0 2px 6px rgba(27, 42, 74, 0.08)",
    md: "0 6px 16px rgba(27, 42, 74, 0.1)",
    lg: "0 12px 28px rgba(27, 42, 74, 0.12)",
    xl: "0 20px 44px rgba(27, 42, 74, 0.14)",
  },
  components: {
    Button: {
      defaultProps: {
        radius: "md",
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: "md",
      },
    },
    Paper: {
      defaultProps: {
        radius: "md",
      },
    },
  },
});

export const APP_BACKGROUND = "#faf8f3";
