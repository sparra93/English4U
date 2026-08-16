import { ActionIcon, Menu } from "@mantine/core";
import { MoreVertical, Trash2 } from "lucide-react";

interface SessionMenuProps {
  onDelete: () => void;
}

export function SessionMenu({ onDelete }: SessionMenuProps) {
  return (
    <Menu position="bottom-end" withinPortal shadow="md">
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          aria-label="Session options"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreVertical size={14} aria-hidden="true" />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          color="red"
          leftSection={<Trash2 size={14} aria-hidden="true" />}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
