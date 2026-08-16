import { Avatar, Group, Popover, Stack, Text, UnstyledButton } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { TeacherStatus } from "./TeacherStatus";
import { useTutorContext } from "../../context/TutorContext";
import { initialsFor } from "../../utils/format";
import type { TutorPhase } from "../../types/tutor";

interface TeacherPresenceProps {
  phase: TutorPhase;
}

export function TeacherPresence({ phase }: TeacherPresenceProps) {
  const { profile } = useTutorContext();
  const [opened, { close, toggle }] = useDisclosure(false);

  return (
    <Group justify="space-between" align="center" wrap="wrap" gap="md">
      <Popover width={280} position="bottom-start" shadow="md" opened={opened} onClose={close}>
        <Popover.Target>
          <UnstyledButton
            onClick={toggle}
            style={{ display: "flex", alignItems: "center", gap: "var(--mantine-spacing-sm)" }}
          >
            <Avatar radius="xl" size={44} color="navy" variant="filled">
              {initialsFor(profile.activeTutor.name)}
            </Avatar>
            <Stack gap={0}>
              <Text fw={600} size="md">
                {profile.activeTutor.name}
              </Text>
              <Text size="xs" c="dimmed">
                {profile.activeTutor.specialty} · {profile.activeTutor.accent}
              </Text>
            </Stack>
          </UnstyledButton>
        </Popover.Target>
        <Popover.Dropdown>
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs" style={{ letterSpacing: "0.06em" }}>
            Choose your tutor
          </Text>
          <Stack gap={2}>
            {profile.tutors.map((tutor) => (
              <UnstyledButton
                key={tutor.id}
                onClick={() => {
                  void profile.selectTutor(tutor.id);
                  close();
                }}
                px="sm"
                py={6}
                style={{
                  borderRadius: "var(--mantine-radius-md)",
                  backgroundColor:
                    tutor.id === profile.activeTutor.id
                      ? "var(--mantine-color-navy-0)"
                      : "transparent",
                }}
              >
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={600}>
                    {tutor.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {tutor.specialty}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed" mt={2}>
                  {tutor.tagline}
                </Text>
              </UnstyledButton>
            ))}
          </Stack>
        </Popover.Dropdown>
      </Popover>

      <TeacherStatus phase={phase} />
    </Group>
  );
}
