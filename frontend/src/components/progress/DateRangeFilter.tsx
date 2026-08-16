import { SegmentedControl } from "@mantine/core";
import type { DateRangeOption } from "../../types/history";

interface DateRangeFilterProps {
  value: DateRangeOption;
  onChange: (value: DateRangeOption) => void;
}

const OPTIONS: { value: DateRangeOption; label: string }[] = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
];

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  return (
    <SegmentedControl
      value={value}
      onChange={(next) => onChange(next as DateRangeOption)}
      data={OPTIONS}
      color="navy"
      radius="md"
    />
  );
}
