import { Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";

interface SidebarSectionProps {
  label: string;
  collapsed: boolean;
  grow?: boolean;
  children: ReactNode;
}

export function SidebarSection({ label, collapsed, grow, children }: SidebarSectionProps) {
  return (
    <Stack gap={6} style={grow ? { flex: 1, minHeight: 0 } : undefined}>
      {!collapsed && (
        <Text size="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.08em" }}>
          {label}
        </Text>
      )}
      {children}
    </Stack>
  );
}
