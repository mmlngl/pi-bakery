import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, SessionShutdownEvent } from "@earendil-works/pi-coding-agent";
import { collectSessionUsageSummary } from "../extensions/usage-store";

function makeContext(overrides: Partial<ExtensionContext> = {}): ExtensionContext {
	return {
		cwd: "/work/repo",
		hasUI: true,
		ui: {} as ExtensionContext["ui"],
		sessionManager: {
			getSessionId: () => "session-123",
			getSessionFile: () => "/sessions/session-123.jsonl",
			getHeader: () => ({
				type: "session",
				id: "session-123",
				timestamp: "2026-01-01T00:00:00.000Z",
				cwd: "/work/repo",
				parentSession: "/sessions/parent.jsonl",
			}),
			getEntries: () => [
				{ type: "message", id: "u1", parentId: null, timestamp: "2026-01-01T00:00:01.000Z", message: { role: "user" } },
				{
					type: "message",
					id: "a1",
					parentId: "u1",
					timestamp: "2026-01-01T00:00:02.000Z",
					message: {
						role: "assistant",
						provider: "anthropic",
						model: "claude-sonnet",
						usage: {
							input: 10,
							output: 20,
							cacheRead: 3,
							cacheWrite: 4,
							totalTokens: 33,
							cost: { input: 0.1, output: 0.2, cacheRead: 0.03, cacheWrite: 0.04, total: 0.37 },
						},
					},
				},
				{ type: "message", id: "t1", parentId: "a1", timestamp: "2026-01-01T00:00:03.000Z", message: { role: "toolResult" } },
			] as any,
			getSessionName: () => "My Session",
			getCwd: () => "/work/repo",
		} as any,
		model: { provider: "anthropic", id: "claude-sonnet" },
		...overrides,
	} as ExtensionContext;
}

afterEach(() => {
	vi.useRealTimers();
});

describe("collectSessionUsageSummary", () => {
	it("summarizes session usage from entries", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));

		const summary = collectSessionUsageSummary(
			makeContext(),
			{ type: "session_shutdown", reason: "quit" } satisfies SessionShutdownEvent,
			"shutdown",
		);

		expect(summary).toMatchObject({
			sessionId: "session-123",
			sessionFile: "/sessions/session-123.jsonl",
			parentSessionFile: "/sessions/parent.jsonl",
			cwd: "/work/repo",
			sessionName: "My Session",
			sessionStartedAt: "2026-01-01T00:00:00.000Z",
			sessionEndedAt: "2026-01-01T12:00:00.000Z",
			writeSource: "shutdown",
			shutdownReason: "quit",
			provider: "anthropic",
			modelId: "claude-sonnet",
			inputTokens: 10,
			outputTokens: 20,
			cacheReadTokens: 3,
			cacheWriteTokens: 4,
			totalTokens: 33,
			costInput: 0.1,
			costOutput: 0.2,
			costCacheRead: 0.03,
			costCacheWrite: 0.04,
			costTotal: 0.37,
			userMessages: 1,
			assistantMessages: 1,
			toolResults: 1,
		});
	});
});
