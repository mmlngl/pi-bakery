import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeUsageDatabase, configureUsageStorageForTests, resetUsageStorageForTests, upsertSessionUsageSummary } from "../extensions/usage-store";
import { getUsageOverview } from "../extensions/usage-aggregation";
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
		outputTokens: tokens * 2,
		cacheReadTokens: 1,
		cacheWriteTokens: 2,
		totalTokens: tokens * 3,
		costInput: tokens / 100,
		costOutput: tokens / 50,
		costCacheRead: 0.01,
		costCacheWrite: 0.02,
		costTotal: tokens / 20,
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

describe("getUsageOverview", () => {
	it("returns rolling range totals and all-time totals from SQLite session summaries", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-10T12:00:00.000Z"));

		const root = mkdtempSync(join(tmpdir(), "pi-usage-agg-"));
		tempRoots.push(root);
		const dbPath = join(root, "usage.sqlite3");
		configureUsageStorageForTests({ appDir: root, databasePath: dbPath });

		upsertSessionUsageSummary(summary("recent", "2026-02-10T09:00:00.000Z", 10));
		upsertSessionUsageSummary(summary("within-week", "2026-02-06T09:00:00.000Z", 20));
		upsertSessionUsageSummary(summary("old", "2026-01-01T09:00:00.000Z", 30));

		const day = getUsageOverview("day");
		const week = getUsageOverview("week");
		const month = getUsageOverview("month");
		const allTime = getUsageOverview("all-time");

		expect(day).toMatchObject({
			range: "day",
			sessionCount: 1,
			totals: {
				inputTokens: 10,
				outputTokens: 20,
				cacheReadTokens: 1,
				cacheWriteTokens: 2,
				totalTokens: 30,
				costTotal: 0.5,
			},
		});

		expect(week).toMatchObject({
			range: "week",
			sessionCount: 2,
			totals: {
				inputTokens: 30,
				outputTokens: 60,
				cacheReadTokens: 2,
				cacheWriteTokens: 4,
				totalTokens: 90,
				costTotal: 1.5,
			},
		});

		expect(month).toMatchObject({
			range: "month",
			sessionCount: 2,
			totals: {
				totalTokens: 90,
			},
		});

		expect(allTime).toMatchObject({
			range: "all-time",
			sessionCount: 3,
			totals: {
				inputTokens: 60,
				outputTokens: 120,
				cacheReadTokens: 3,
				cacheWriteTokens: 6,
				totalTokens: 180,
				costTotal: 3,
			},
		});
	});
});
