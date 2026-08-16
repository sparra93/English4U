import { NavLink, Stack } from "@mantine/core";
import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { BarChart3, MessageSquare } from "lucide-react";

interface SidebarNavProps {
  collapsed: boolean;
}

const LINKS = [
  { to: "/", label: "Conversation", icon: MessageSquare },
  { to: "/progress", label: "My Progress", icon: BarChart3 },
];

export function SidebarNav({ collapsed }: SidebarNavProps) {
  const location = useLocation();

  return (
    <Stack gap={2}>
      {LINKS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          component={RouterNavLink}
          to={to}
          label={collapsed ? undefined : label}
          title={label}
          leftSection={<Icon size={16} aria-hidden="true" />}
          active={location.pathname === to}
          variant="light"
          color="navy"
          style={{ borderRadius: "var(--mantine-radius-md)" }}
        />
      ))}
    </Stack>
  );
}
