import { Box, Text } from "@mantine/core";

interface NaturalVersionProps {
  text: string;
}

export function NaturalVersion({ text }: NaturalVersionProps) {
  return (
    <Box pl="sm" style={{ borderLeft: "2px solid var(--mantine-color-academicBlue-3)" }}>
      <Text size="sm">{text || "No rewrite available."}</Text>
    </Box>
  );
}
