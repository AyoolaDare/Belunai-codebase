// Bounded retry for transactions that lost a race (backend_schema.md section 8).
// Only deadlocks (40P01) and serialization failures (40001) are retried, and
// only a few times. The operation must be idempotent: a caller-supplied UUID
// or a unique key makes a repeated attempt return the first result instead of
// doing the work twice. Any other error is returned to the caller unchanged.

export const RETRYABLE_SQLSTATES: ReadonlySet<string> = new Set(["40001", "40P01"]);

export type RetryOptions = {
  /** Total attempts, including the first. Default 3. */
  attempts?: number;
  /** Delay before attempt n is baseDelayMs * 2^(n-2), plus jitter. Default 25. */
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export function isRetryable(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && RETRYABLE_SQLSTATES.has(code);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withTransactionRetry<T>(
  run: (attempt: number) => Promise<T>,
  { attempts = 3, baseDelayMs = 25, sleep = defaultSleep, random = Math.random }: RetryOptions = {},
): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 5) {
    throw new RangeError("attempts must be an integer from 1 to 5");
  }
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run(attempt);
    } catch (error) {
      if (attempt >= attempts || !isRetryable(error)) throw error;
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      await sleep(backoff + Math.floor(random() * backoff));
    }
  }
}
