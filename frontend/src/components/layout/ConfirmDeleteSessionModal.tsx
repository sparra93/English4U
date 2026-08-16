import { Button, Group, Modal, Text } from "@mantine/core";

interface ConfirmDeleteSessionModalProps {
  opened: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteSessionModal({
  opened,
  onCancel,
  onConfirm,
}: ConfirmDeleteSessionModalProps) {
  return (
    <Modal opened={opened} onClose={onCancel} title="Delete this session?" centered size="sm">
      <Text size="sm" c="dimmed" mb="lg">
        It will disappear from your session list, but it won&apos;t affect your progress
        stats.
      </Text>
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel}>
          Cancel
        </Button>
        <Button color="red" onClick={onConfirm}>
          Delete
        </Button>
      </Group>
    </Modal>
  );
}
