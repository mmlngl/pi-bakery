import type {
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionContext,
	SessionShutdownEvent,
} from "@earendil-works/pi-coding-agent";
import { getUsageViewPrefsDefaults, loadUsageViewPrefs } from "./usage-aggregation.js";
import { UsageDashboard } from "./usage-dashboard.js";
import {
	closeUsageDatabase,
	collectSessionUsageSummary,
	upsertSessionUsageSummary,
} from "./usage-store.js";

function persistUsage(
	ctx: ExtensionContext,
	event: SessionShutdownEvent,
	writeSource: "shutdown" | "manual",
) {
	const summary = collectSessionUsageSummary(ctx, event, writeSource);
	upsertSessionUsageSummary(summary);
	return summary;
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand("usage", {
		description: "Open the global usage dashboard",
		handler: async (_args, ctx: ExtensionCommandContext) => {
			return ctx.ui.custom((_tui, _theme, _keybindings, done) => new UsageDashboard(loadUsageViewPrefs(), done));
		},
	});

	pi.registerCommand("usage-flush", {
		description: "Flush the current session usage summary to SQLite",
		handler: async (_args, ctx: ExtensionCommandContext) => {
			await ctx.waitForIdle();
			const summary = persistUsage(
				ctx,
				{
					type: "session_shutdown",
					reason: "quit",
				},
				"manual",
			);
			ctx.ui.notify(
				`Usage summary saved for ${summary.sessionId} (${summary.totalTokens.toLocaleString()} tokens)`,
				"info",
			);
		},
	});

	pi.on("session_shutdown", async (event, ctx) => {
		persistUsage(ctx, event as SessionShutdownEvent, "shutdown");
		closeUsageDatabase();
	});
}
