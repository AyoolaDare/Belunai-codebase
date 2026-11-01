// BEL-0205: bounded retry of transactions that lost a race.
import { describe, expect, it } from "vitest";
import { isRetryable, withTransactionRetry } from "@/lib/db/retry";

const sqlError = (code: string) => Object.assign(new Error(code), { code });
const noWait = { sleep: async () => undefined, random: () => 0 };

describe("withTransactionRetry", () => {
  it("retries deadlocks and serialization failures, then succeeds", async () => {
    const failures = [sqlError("40P01"), sqlError("40001")];
    const seen: number[] = [];
    const result = await withTransactionRetry(async (attempt) => {
      seen.push(attempt);
      const next = failures.shift();
      if (next) throw next;
      return "done";
    }, noWait);
    expect(result).toBe("done");
    expect(seen).toEqual([1, 2, 3]);
  });

  it("gives up after the attempt limit with the last error", async () => {
    let calls = 0;
    await expect(
      withTransactionRetry(async () => {
        calls += 1;
        throw sqlError("40P01");
      }, noWait),
    ).rejects.toMatchObject({ code: "40P01" });
    expect(calls).toBe(3);
  });

  it("never retries other errors, such as constraint violations", async () => {
    for (const code of ["23505", "23514", "42501", "P0001"]) {
      let calls = 0;
      await expect(
        withTransactionRetry(async () => {
          calls += 1;
          throw sqlError(code);
        }, noWait),
      ).rejects.toMatchObject({ code });
      expect(calls, code).toBe(1);
    }
    expect(isRetryable(new Error("no code"))).toBe(false);
    expect(isRetryable(null)).toBe(false);
  });

  it("backs off exponentially and keeps attempts bounded", async () => {
    const delays: number[] = [];
    await withTransactionRetry(
      async (attempt) => {
        if (attempt < 3) throw sqlError("40001");
        return attempt;
      },
      { baseDelayMs: 10, sleep: async (ms) => void delays.push(ms), random: () => 0 },
    );
    expect(delays).toEqual([10, 20]);
    await expect(withTransactionRetry(async () => 1, { attempts: 0 })).rejects.toThrow(RangeError);
    await expect(withTransactionRetry(async () => 1, { attempts: 6 })).rejects.toThrow(RangeError);
  });
});
