import { Box, Group } from "@mantine/core";

interface RecordingVisualizerProps {
  level: number;
  active: boolean;
}

const BAR_WEIGHTS = [0.5, 0.85, 1, 0.7, 0.45];

export function RecordingVisualizer({ level, active }: RecordingVisualizerProps) {
  return (
    <Group gap={3} align="center" h={18} aria-hidden="true">
      {BAR_WEIGHTS.map((weight, index) => {
        const scale = active ? Math.max(0.18, Math.min(1, level * weight * 1.6)) : 0.18;
        return (
          <Box
            key={index}
            style={{
              width: 3,
              height: 16,
              borderRadius: 999,
              backgroundColor: "var(--mantine-color-red-6)",
              transform: `scaleY(${scale})`,
              transformOrigin: "center",
              opacity: active ? 1 : 0.3,
              transition: "transform 90ms ease",
            }}
          />
        );
      })}
    </Group>
  );
}
