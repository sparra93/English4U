import { useState } from "react";
import { ActionIcon, Group, ScrollArea, Stack, Text, UnstyledButton } from "@mantine/core";
import { Plus } from "lucide-react";
import { useTutorContext } from "../../context/TutorContext";
import { SessionMenu } from "./SessionMenu";
import { formatDateTime } from "../../utils/format";

interface SessionListProps {
  collapsed: boolean;
}

export function SessionList({ collapsed }: SessionListProps) {
  const { sessionId, startNewSession, loadSessionTurns, sessions } = useTutorContext();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (collapsed) {
    return (
      <ActionIcon
        variant="light"
        color="navy"
        size="lg"
        mx="auto"
        onClick={startNewSession}
        aria-label="New conversation"
      >
        <Plus size={18} aria-hidden="true" />
      </ActionIcon>
    );
  }

  const handleSwitch = async (id: string) => {
    if (id === sessionId) return;
    setPendingId(id);
    try {
      const turns = await sessions.switchSession(id);
      loadSessionTurns(id, turns);
    } catch {
      // Non-critical: leave the current conversation untouched.
    } finally {
      setPendingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      "Delete this session? It will disappear from your session list, but it won't affect your progress stats.",
    );
    if (!confirmed) return;

    try {
      await sessions.removeSession(id);
    } catch {
      // Ignore — sidebar keeps the previous (unchanged) list.
    }

    if (id === sessionId) {
      startNewSession();
    }
  };

  return (
    <Stack gap="xs" style={{ flex: 1, minHeight: 0 }}>
      <UnstyledButton
        onClick={startNewSession}
        px="sm"
        py={6}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: "var(--mantine-radius-md)",
          backgroundColor: "var(--mantine-color-navy-8)",
          color: "white",
          fontWeight: 600,
          fontSize: "var(--mantine-font-size-sm)",
        }}
      >
        <Plus size={14} aria-hidden="true" />
        New conversation
      </UnstyledButton>

      <Text size="xs" fw={700} c="dimmed" tt="uppercase" mt="xs" style={{ letterSpacing: "0.06em" }}>
        Past sessions
      </Text>

      <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
        <Stack gap={2}>
          {sessions.sessions.length === 0 ? (
            <Text size="xs" c="dimmed">
              No past sessions yet.
            </Text>
          ) : (
            sessions.sessions.map((session) => (
              <Group key={session.session_id} gap={2} wrap="nowrap">
                <UnstyledButton
                  onClick={() => void handleSwitch(session.session_id)}
                  disabled={pendingId === session.session_id}
                  px="sm"
                  py={6}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: "var(--mantine-radius-md)",
                    backgroundColor:
                      session.session_id === sessionId
                        ? "var(--mantine-color-navy-0)"
                        : "transparent",
                  }}
                >
                  <Text size="sm" fw={600} truncate="end">
                    {formatDateTime(session.last_active_at)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {session.turn_count === 1 ? "1 turn" : `${session.turn_count} turns`}
                  </Text>
                </UnstyledButton>
                <SessionMenu onDelete={() => void handleDelete(session.session_id)} />
              </Group>
            ))
          )}
        </Stack>
      </ScrollArea>
    </Stack>
  );
}
