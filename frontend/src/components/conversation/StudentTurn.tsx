import { Box, Group, Text } from "@mantine/core";

interface StudentTurnProps {
  text: string;
}

export function StudentTurn({ text }: StudentTurnProps) {
  return (
    <Group justify="flex-end" wrap="nowrap" gap="xs">
      <Box maw="72%">
        <Text size="xs" fw={600} c="dimmed" ta="right" mb={4}>
          You
        </Text>
        <Box
          px="md"
          py="sm"
          style={{
            borderRadius: "var(--mantine-radius-md)",
            borderBottomRightRadius: 4,
            backgroundColor: "var(--mantine-color-gray-1)",
            border: "1px solid var(--mantine-color-gray-3)",
          }}
        >
          <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
            {text}
          </Text>
        </Box>
      </Box>
    </Group>
  );
}
