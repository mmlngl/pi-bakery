import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeUsageDatabase, configureUsageStorageForTests, resetUsageStorageForTests, upsertSessionUsageSummary } from "../extensions/usage-store";
import { UsageDashboard } from "../extensions/usage-dashboard";
import { getUsageViewPrefsDefaults } from "../extensions/usage-aggregation";
import type { SessionUsageSummary } from "../extensions/usage-store";

function summary(
	sessionId: string,
	endedAt: string,
	totalTokens: number,
	inputTokens: number,
	outputTokens: number,
	provider: string,
	modelId: string,
): SessionUsageSummary {
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
		provider,
		modelId,
		inputTokens,
		outputTokens,
		cacheReadTokens: 3,
		cacheWriteTokens: 4,
		totalTokens,
		costInput: inputTokens / 100,
		costOutput: outputTokens / 100,
		costCacheRead: 0.03,
		costCacheWrite: 0.04,
		costTotal: totalTokens / 100,
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

describe("UsageDashboard drill-down", () => {
	it("opens a bucket drill-down with sorted session details", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-10T12:00:00.000Z"));

		const root = mkdtempSync(join(tmpdir(), "pi-usage-drilldown-"));
		tempRoots.push(root);
		configureUsageStorageForTests({ appDir: root, databasePath: join(root, "usage.sqlite3") });

		upsertSessionUsageSummary(summary("small", "2026-02-10T09:00:00.000Z", 50, 20, 30, "openai", "gpt-4o"));
		upsertSessionUsageSummary(summary("big", "2026-02-10T10:00:00.000Z", 200, 40, 160, "anthropic", "claude-sonnet"));

		const dashboard = new UsageDashboard(getUsageViewPrefsDefaults());
		for (let index = 0; index < 6; index += 1) {
			dashboard.handleInput("right");
		}
		dashboard.handleInput("enter");

		const output = dashboard.render(160).join("\n");

		expect(output).toContain("Bucket 2026-02-10");
		expect(output).toContain("Sessions: 2");
		expect(output).toContain("Total tokens: 250");
		expect(output).toContain("big");
		expect(output).toContain("small");
		expect(output.indexOf("big")).toBeLessThan(output.indexOf("small"));
		expect(output).toContain("anthropic/claude-sonnet");
		expect(output).toContain("openai/gpt-4o");
		expect(output).toContain("input 40");
		expect(output).toContain("output 160");
		expect(output).toContain("cache 3/4");
	});
});
