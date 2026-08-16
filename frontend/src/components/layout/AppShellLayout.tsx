import { ActionIcon, AppShell, Box, Group, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { ChevronLeft } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarNav } from "./SidebarNav";
import { SessionList } from "./SessionList";

export function AppShellLayout() {
  const [collapsed, setCollapsed] = useLocalStorage({
    key: "english-ai-tutor-sidebar-collapsed",
    defaultValue: false,
  });
  const location = useLocation();
  const isConversationPage = location.pathname === "/";

  return (
    <AppShell
      navbar={{
        width: collapsed ? 72 : 260,
        breakpoint: "sm",
        collapsed: { mobile: false },
      }}
      padding={0}
    >
      <AppShell.Navbar
        p="md"
        style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap={8} wrap="nowrap" style={{ overflow: "hidden" }}>
            <Box
              w={30}
              h={30}
              style={{
                flexShrink: 0,
                borderRadius: "var(--mantine-radius-md)",
                backgroundColor: "var(--mantine-color-navy-8)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <Text c="white" fw={700} size="xs">
                EM
              </Text>
            </Box>
            {!collapsed && (
              <Box style={{ overflow: "hidden" }}>
                <Text
                  size="xs"
                  fw={700}
                  c="dimmed"
                  tt="uppercase"
                  style={{ letterSpacing: "0.08em", whiteSpace: "nowrap" }}
                >
                  English AI Tutor
                </Text>
                <Text size="sm" fw={600} style={{ whiteSpace: "nowrap" }}>
                  Private Lesson
                </Text>
              </Box>
            )}
          </Group>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              size={16}
              aria-hidden="true"
              style={{
                transform: collapsed ? "rotate(180deg)" : undefined,
                transition: "transform 150ms ease",
              }}
            />
          </ActionIcon>
        </Group>

        <SidebarNav collapsed={collapsed} />

        {isConversationPage ? <SessionList collapsed={collapsed} /> : null}
      </AppShell.Navbar>

      <AppShell.Main
        style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
