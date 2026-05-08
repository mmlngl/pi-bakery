import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExtensionContext, SessionShutdownEvent } from "@earendil-works/pi-coding-agent";
import { collectSessionUsageSummary } from "../extensions/usage-store";

function makeEmptyContext(): ExtensionContext {
	return {
		cwd: "/work/repo",
		hasUI: true,
		ui: {} as ExtensionContext["ui"],
		sessionManager: {
			getSessionId: () => "session-empty",
			getSessionFile: () => undefined,
			getHeader: () => ({
				type: "session",
				id: "session-empty",
				timestamp: "2026-01-01T00:00:00.000Z",
				cwd: "/work/repo",
			}),
			getEntries: () => [],
			getSessionName: () => undefined,
			getCwd: () => "/work/repo",
		} as any,
		model: undefined,
	} as ExtensionContext;
}

afterEach(() => {
	vi.useRealTimers();
});

describe("collectSessionUsageSummary session outcomes", () => {
	it("keeps all shutdown reasons eligible for persistence", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-01-01T12:00:00.000Z"));

		for (const reason of ["quit", "reload", "new", "resume", "fork"] as const) {
			const summary = collectSessionUsageSummary(
				makeEmptyContext(),
				{ type: "session_shutdown", reason } satisfies SessionShutdownEvent,
				"shutdown",
			);

			expect(summary).toMatchObject({
				sessionId: "session-empty",
				writeSource: "shutdown",
				shutdownReason: reason,
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				totalTokens: 0,
				costInput: 0,
				costOutput: 0,
				costCacheRead: 0,
				costCacheWrite: 0,
				costTotal: 0,
				userMessages: 0,
				assistantMessages: 0,
				toolResults: 0,
			});
		}
	});
});
