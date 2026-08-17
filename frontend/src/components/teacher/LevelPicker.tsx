import { Menu, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { ChevronDown, Lock } from "lucide-react";
import { useTutorContext } from "../../context/TutorContext";
import { CEFR_LEVELS } from "../../types/level";

export function LevelPicker() {
  const { level } = useTutorContext();
  const activeOption = CEFR_LEVELS.find((option) => option.code === level.activeLevel);

  const trigger = (
    <UnstyledButton
      disabled={level.isLocked}
      px="sm"
      py={4}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderRadius: "var(--mantine-radius-xl)",
        border: "1px solid var(--mantine-color-gray-3)",
        cursor: level.isLocked ? "default" : "pointer",
      }}
    >
      <Text size="xs" fw={700}>
        {level.activeLevel}
      </Text>
      <Text size="xs" c="dimmed">
        {activeOption?.label}
      </Text>
      {level.isLocked ? (
        <Lock size={12} aria-hidden="true" opacity={0.6} />
      ) : (
        <ChevronDown size={12} aria-hidden="true" opacity={0.6} />
      )}
    </UnstyledButton>
  );

  return (
    <Menu position="bottom-end" withinPortal shadow="md" disabled={level.isLocked}>
      <Menu.Target>
        {level.isLocked ? (
          <Tooltip label="Level locked for this conversation — start a new one to change it." position="bottom-end">
            {trigger}
          </Tooltip>
        ) : (
          trigger
        )}
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>English level for this chat</Menu.Label>
        {CEFR_LEVELS.map((option) => (
          <Menu.Item
            key={option.code}
            onClick={() => void level.selectLevel(option.code)}
            fw={option.code === level.activeLevel ? 700 : 400}
          >
            {option.code} · {option.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
