import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { closeUsageDatabase, configureUsageStorageForTests, getUsageDatabasePath, getUsageDirectory, upsertSessionUsageSummary, resetUsageStorageForTests } from "../extensions/usage-store";
import type { SessionUsageSummary } from "../extensions/usage-store";

function makeSummary(): SessionUsageSummary {
	return {
		sessionId: "session-abc",
		sessionFile: "/sessions/session-abc.jsonl",
		parentSessionFile: null,
		cwd: "/work/repo",
		sessionName: "Saved Session",
		sessionStartedAt: "2026-01-01T00:00:00.000Z",
		sessionEndedAt: "2026-01-01T00:01:00.000Z",
		writeSource: "shutdown",
		shutdownReason: "quit",
		provider: "anthropic",
		modelId: "claude-sonnet",
		inputTokens: 11,
		outputTokens: 22,
		cacheReadTokens: 3,
		cacheWriteTokens: 4,
		totalTokens: 33,
		costInput: 0.11,
		costOutput: 0.22,
		costCacheRead: 0.03,
		costCacheWrite: 0.04,
		costTotal: 0.4,
		userMessages: 2,
		assistantMessages: 1,
		toolResults: 1,
		updatedAt: "2026-01-01T00:01:00.000Z",
	};
}

const tempRoots: string[] = [];

afterEach(() => {
	closeUsageDatabase();
	resetUsageStorageForTests();
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("upsertSessionUsageSummary", () => {
	it("uses the global usage directory and default database path", () => {
		expect(getUsageDirectory()).toContain(".pi/usage");
		expect(getUsageDatabasePath()).toContain("usage.sqlite3");
	});

	it("creates the SQLite file and stores the session row", () => {
		const root = mkdtempSync(join(tmpdir(), "pi-usage-"));
		tempRoots.push(root);
		const dbPath = join(root, "usage.sqlite3");
		configureUsageStorageForTests({ appDir: root, databasePath: dbPath });

		upsertSessionUsageSummary(makeSummary());
		closeUsageDatabase();

		expect(dbPath).toBeTruthy();
		const db = new DatabaseSync(dbPath, { readOnly: true });
		try {
			const row = db.prepare(
				"SELECT session_id, total_tokens, cost_total, write_source, shutdown_reason FROM session_usage_summary WHERE session_id = ?",
			).get("session-abc") as {
				session_id: string;
				total_tokens: number;
				cost_total: number;
				write_source: string;
				shutdown_reason: string | null;
			} | undefined;

			expect(row).toMatchObject({
				session_id: "session-abc",
				total_tokens: 33,
				cost_total: 0.4,
				write_source: "shutdown",
				shutdown_reason: "quit",
			});
		} finally {
			db.close();
		}
	});
});
