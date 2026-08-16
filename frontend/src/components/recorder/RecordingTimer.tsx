import { Text } from "@mantine/core";
import { formatDuration } from "../../utils/format";

interface RecordingTimerProps {
  elapsedSeconds: number;
}

export function RecordingTimer({ elapsedSeconds }: RecordingTimerProps) {
  return (
    <Text
      size="sm"
      fw={600}
      c="dimmed"
      style={{ fontVariantNumeric: "tabular-nums" }}
      aria-live="polite"
    >
      {formatDuration(elapsedSeconds)}
    </Text>
  );
}
