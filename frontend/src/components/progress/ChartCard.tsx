import { useState, type ReactNode } from "react";
import { Group, Paper, Stack, Text, Title, UnstyledButton } from "@mantine/core";

interface ChartCardProps {
  eyebrow: string;
  title: string;
  chart: ReactNode;
  table: ReactNode;
}

export function ChartCard({ eyebrow, title, chart, table }: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" mb="sm">
        <Stack gap={2}>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.06em" }}>
            {eyebrow}
          </Text>
          <Title order={4} fw={600}>
            {title}
          </Title>
        </Stack>
        <UnstyledButton
          onClick={() => setShowTable((current) => !current)}
          px="sm"
          py={4}
          style={{
            borderRadius: "var(--mantine-radius-md)",
            border: "1px solid var(--mantine-color-gray-3)",
            fontSize: "var(--mantine-font-size-xs)",
            fontWeight: 600,
            color: "var(--mantine-color-dimmed)",
          }}
        >
          {showTable ? "Hide table" : "View as table"}
        </UnstyledButton>
      </Group>
      {showTable ? table : chart}
    </Paper>
  );
}
