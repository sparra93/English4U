export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail: unknown }).detail;
      if (typeof detail === "string") {
        return detail;
      }
    }
  } catch {
    // Response body wasn't JSON — fall through to the generic message.
  }
  return `Request failed with status ${response.status}.`;
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError("Could not reach the tutor server. Check your connection.", 0);
  }

  if (!response.ok) {
    throw new ApiError(await parseErrorDetail(response), response.status);
  }

  return (await response.json()) as T;
}
