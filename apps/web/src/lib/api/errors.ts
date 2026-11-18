import type { ErrorCode } from "@ahq/shared-types";

export type ErrorDetail = { path: string; message: string };

/** Error thrown for any non-2xx API response, mapped from the API error envelope. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | "NETWORK_ERROR",
    message: string,
    public readonly details?: ErrorDetail[],
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  detail(path: string) {
    return this.details?.find((d) => d.path === path)?.message;
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as {
      error?: { code: ErrorCode; message: string; details?: ErrorDetail[]; requestId?: string };
    };
    if (body.error) {
      return new ApiError(
        res.status,
        body.error.code,
        body.error.message,
        body.error.details,
        body.error.requestId,
      );
    }
  } catch {
    // fall through to a generic error
  }
  return new ApiError(res.status, "INTERNAL", `Request failed with status ${res.status}`);
}

/** A user-facing message for any thrown value. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again.") {
  if (err instanceof ApiError) return err.message;
  return fallback;
}
