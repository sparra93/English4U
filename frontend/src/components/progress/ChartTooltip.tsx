export interface TooltipState {
  x: number;
  y: number;
  value: string;
  label: string;
}

interface ChartTooltipProps {
  tooltip: TooltipState | null;
}

export function ChartTooltip({ tooltip }: ChartTooltipProps) {
  if (!tooltip) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        left: tooltip.x,
        top: tooltip.y,
        transform: "translate(-50%, calc(-100% - 12px))",
        padding: "6px 10px",
        borderRadius: "var(--mantine-radius-sm)",
        background: "var(--mantine-color-navy-9)",
        color: "white",
        pointerEvents: "none",
        zIndex: 40,
        whiteSpace: "nowrap",
        boxShadow: "var(--mantine-shadow-md)",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13 }}>{tooltip.value}</div>
      <div style={{ fontSize: 11, opacity: 0.8 }}>{tooltip.label}</div>
    </div>
  );
}
