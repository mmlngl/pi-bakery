import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import usageExtension from "../extensions/usage";
import { closeUsageDatabase, configureUsageStorageForTests, resetUsageStorageForTests } from "../extensions/usage-store";

function makeContext() {
	return {
		cwd: "/work/repo",
		hasUI: true,
		ui: {
			notify: () => undefined,
		} as any,
		sessionManager: {
			getSessionId: () => "session-wire",
			getSessionFile: () => "/sessions/session-wire.jsonl",
			getHeader: () => ({
				type: "session",
				id: "session-wire",
				timestamp: "2026-01-01T00:00:00.000Z",
				cwd: "/work/repo",
			}),
			getEntries: () => [
				{
					type: "message",
					id: "a1",
					parentId: null,
					timestamp: "2026-01-01T00:00:01.000Z",
					message: {
						role: "assistant",
						provider: "anthropic",
						model: "claude-sonnet",
						usage: {
							input: 5,
							output: 7,
							cacheRead: 0,
							cacheWrite: 0,
							totalTokens: 12,
							cost: { input: 0.05, output: 0.07, cacheRead: 0, cacheWrite: 0, total: 0.12 },
						},
					},
				},
			] as any,
			getSessionName: () => undefined,
			getCwd: () => "/work/repo",
		} as any,
		model: { provider: "anthropic", id: "claude-sonnet" },
		waitForIdle: async () => undefined,
	} as any;
}

const tempRoots: string[] = [];

afterEach(() => {
	closeUsageDatabase();
	resetUsageStorageForTests();
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("usage extension wiring", () => {
	it("registers /usage-flush and persists on shutdown", async () => {
		const root = mkdtempSync(join(tmpdir(), "pi-usage-wire-"));
		tempRoots.push(root);
		const dbPath = join(root, "usage.sqlite3");
		configureUsageStorageForTests({ appDir: root, databasePath: dbPath });

		const commands: Record<string, any> = {};
		const events: Record<string, any> = {};
		usageExtension({
			registerCommand: (name: string, command: any) => {
				commands[name] = command;
			},
			on: (eventName: string, handler: any) => {
				events[eventName] = handler;
			},
		} as any);

		expect(commands["usage-flush"]).toBeTruthy();
		expect(events["session_shutdown"]).toBeTruthy();

		await commands["usage-flush"].handler("", makeContext());
		closeUsageDatabase();

		let db = new DatabaseSync(dbPath, { readOnly: true });
		try {
			const row = db.prepare("SELECT total_tokens, write_source FROM session_usage_summary WHERE session_id = ?").get("session-wire") as { total_tokens: number; write_source: string } | undefined;
			expect(row).toMatchObject({ total_tokens: 12, write_source: "manual" });
		} finally {
			db.close();
		}

		await events["session_shutdown"]({ type: "session_shutdown", reason: "quit" }, makeContext());
		closeUsageDatabase();

		db = new DatabaseSync(dbPath, { readOnly: true });
		try {
			const row = db.prepare("SELECT COUNT(*) as count FROM session_usage_summary WHERE session_id = ?").get("session-wire") as { count: number } | undefined;
			expect(row?.count).toBe(1);
		} finally {
			db.close();
		}
	});
});
