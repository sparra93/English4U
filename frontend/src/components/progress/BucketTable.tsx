import { Table } from "@mantine/core";
import type { Bucket } from "../../utils/dateBuckets";

interface BucketTableProps {
  buckets: Bucket[];
  showCleanRate?: boolean;
}

export function BucketTable({ buckets, showCleanRate }: BucketTableProps) {
  return (
    <Table striped verticalSpacing={6} fz="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Period</Table.Th>
          {showCleanRate ? <Table.Th>Clean rate</Table.Th> : null}
          <Table.Th>Turns</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {buckets.map((bucket) => (
          <Table.Tr key={bucket.label}>
            <Table.Td>{bucket.label}</Table.Td>
            {showCleanRate ? (
              <Table.Td>
                {bucket.count > 0 ? `${Math.round((bucket.cleanCount / bucket.count) * 100)}%` : "-"}
              </Table.Td>
            ) : null}
            <Table.Td>{bucket.count}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
