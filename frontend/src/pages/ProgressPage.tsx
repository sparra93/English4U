import { Alert, Box, Loader, Stack, Title } from "@mantine/core";
import { AlertCircle } from "lucide-react";
import { useProgressHistory } from "../hooks/useProgressHistory";
import { DateRangeFilter } from "../components/progress/DateRangeFilter";
import { StatTiles } from "../components/progress/StatTiles";
import { ChartCard } from "../components/progress/ChartCard";
import { ActivityChart } from "../components/progress/ActivityChart";
import { CleanRateChart } from "../components/progress/CleanRateChart";
import { BucketTable } from "../components/progress/BucketTable";
import { VocabularyGrid } from "../components/progress/VocabularyGrid";
import { CorrectionHistoryList } from "../components/progress/CorrectionHistoryList";
import { PracticeLogList } from "../components/progress/PracticeLogList";

export function ProgressPage() {
  const {
    isLoading,
    errorMessage,
    range,
    setRange,
    filteredTurns,
    stats,
    buckets,
    vocabulary,
    correctionHistory,
  } = useProgressHistory();

  if (isLoading) {
    return (
      <Box style={{ flex: 1, display: "grid", placeItems: "center" }}>
        <Loader color="navy" />
      </Box>
    );
  }

  if (errorMessage) {
    return (
      <Box p="xl">
        <Alert icon={<AlertCircle size={16} aria-hidden="true" />} color="red" variant="light">
          {errorMessage}
        </Alert>
      </Box>
    );
  }

  return (
    <Box style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "24px 32px 48px" }}>
      <Stack gap="xl" maw={1100}>
        <Title order={2} fw={600}>
          My Progress
        </Title>

        <DateRangeFilter value={range} onChange={setRange} />

        <StatTiles stats={stats} />

        <ChartCard
          eyebrow="Activity"
          title="Practice consistency"
          chart={<ActivityChart buckets={buckets} />}
          table={<BucketTable buckets={buckets} />}
        />

        <ChartCard
          eyebrow="Accuracy trend"
          title="Sentences with no corrections needed"
          chart={<CleanRateChart buckets={buckets} />}
          table={<BucketTable buckets={buckets} showCleanRate />}
        />

        <Stack gap="sm">
          <Title order={4} fw={600}>
            Vocabulary
          </Title>
          <VocabularyGrid vocabulary={vocabulary} />
        </Stack>

        <Stack gap="sm">
          <Title order={4} fw={600}>
            Corrections
          </Title>
          <CorrectionHistoryList history={correctionHistory} />
        </Stack>

        <Stack gap="sm">
          <Title order={4} fw={600}>
            Practice log
          </Title>
          <PracticeLogList turns={filteredTurns} />
        </Stack>
      </Stack>
    </Box>
  );
}
