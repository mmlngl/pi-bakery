import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeUsageDatabase, configureUsageStorageForTests, resetUsageStorageForTests, upsertSessionUsageSummary } from "../extensions/usage-store";
import { getRollingWeekPunchBuckets } from "../extensions/usage-aggregation";
import type { SessionUsageSummary } from "../extensions/usage-store";

function summary(sessionId: string, endedAt: string, tokens: number): SessionUsageSummary {
	return {
		sessionId,
		sessionFile: `/sessions/${sessionId}.jsonl`,
		parentSessionFile: null,
		cwd: "/work/repo",
		sessionName: sessionId,
		sessionStartedAt: endedAt,
		sessionEndedAt: endedAt,
		writeSource: "shutdown",
		shutdownReason: "quit",
		provider: "anthropic",
		modelId: "claude-sonnet",
		inputTokens: tokens,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		totalTokens: tokens,
		costInput: 0,
		costOutput: 0,
		costCacheRead: 0,
		costCacheWrite: 0,
		costTotal: tokens / 100,
		userMessages: 1,
		assistantMessages: 1,
		toolResults: 0,
		updatedAt: endedAt,
	};
}

const tempRoots: string[] = [];

afterEach(() => {
	closeUsageDatabase();
	resetUsageStorageForTests();
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
	vi.useRealTimers();
});

describe("getRollingWeekPunchBuckets", () => {
	it("returns seven chronological daily buckets with token totals", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-10T12:00:00.000Z"));

		const root = mkdtempSync(join(tmpdir(), "pi-usage-buckets-"));
		tempRoots.push(root);
		configureUsageStorageForTests({ appDir: root, databasePath: join(root, "usage.sqlite3") });

		upsertSessionUsageSummary(summary("today", "2026-02-10T09:00:00.000Z", 10));
		upsertSessionUsageSummary(summary("yesterday", "2026-02-09T09:00:00.000Z", 20));
		upsertSessionUsageSummary(summary("week-old", "2026-02-04T09:00:00.000Z", 30));

		const buckets = getRollingWeekPunchBuckets();

		expect(buckets).toHaveLength(7);
		expect(buckets.at(-1)).toMatchObject({
			date: "2026-02-10",
			label: "T",
			sessionCount: 1,
			totals: { totalTokens: 10 },
		});
		expect(buckets.at(-2)).toMatchObject({
			date: "2026-02-09",
			label: "M",
			sessionCount: 1,
			totals: { totalTokens: 20 },
		});
		expect(buckets[0]).toMatchObject({
			date: "2026-02-04",
			label: "W",
			sessionCount: 1,
			totals: { totalTokens: 30 },
		});
	});
});
