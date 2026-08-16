import { Avatar, Box, Group } from "@mantine/core";
import { initialsFor } from "../../utils/format";

const DOT_STYLE = (delay: string): React.CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: "50%",
  backgroundColor: "var(--mantine-color-academicBlue-6)",
  opacity: 0.5,
  animation: `typing-bounce 1.1s ${delay} infinite ease-in-out`,
});

interface TypingIndicatorProps {
  teacherName: string;
}

export function TypingIndicator({ teacherName }: TypingIndicatorProps) {
  return (
    <Group align="flex-start" wrap="nowrap" gap="xs">
      <Avatar radius="xl" size={32} color="navy" variant="filled" mt={2}>
        {initialsFor(teacherName)}
      </Avatar>
      <Box
        px="md"
        py="sm"
        style={{
          borderRadius: "var(--mantine-radius-md)",
          borderBottomLeftRadius: 4,
          backgroundColor: "var(--mantine-color-academicBlue-0)",
          border: "1px solid var(--mantine-color-academicBlue-2)",
        }}
      >
        <Group gap={4}>
          <Box style={DOT_STYLE("0s")} />
          <Box style={DOT_STYLE("0.15s")} />
          <Box style={DOT_STYLE("0.3s")} />
        </Group>
      </Box>
    </Group>
  );
}
