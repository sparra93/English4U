import { Paper, SimpleGrid, Text } from "@mantine/core";
import type { ProgressStats } from "../../hooks/useProgressHistory";

interface StatTilesProps {
  stats: ProgressStats;
}

export function StatTiles({ stats }: StatTilesProps) {
  const tiles = [
    { label: "Turns practiced", value: String(stats.turnCount) },
    { label: "Sessions", value: String(stats.sessionCount) },
    { label: "Clean sentence rate", value: `${stats.cleanRate}%` },
    { label: "Words learned", value: String(stats.vocabCount) },
    { label: "Day streak", value: String(stats.streak) },
  ];

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm">
      {tiles.map((tile) => (
        <Paper key={tile.label} withBorder p="md" radius="md">
          <Text fw={700} size="xl">
            {tile.value}
          </Text>
          <Text size="xs" c="dimmed" fw={600}>
            {tile.label}
          </Text>
        </Paper>
      ))}
    </SimpleGrid>
  );
}
