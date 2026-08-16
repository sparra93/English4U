import { requestJson } from "./httpClient";
import type { HistoryResponse } from "../types/history";

export async function fetchHistory(limit = 500): Promise<HistoryResponse> {
  return requestJson<HistoryResponse>(`/api/history?limit=${limit}`);
}
