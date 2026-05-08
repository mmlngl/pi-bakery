import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * model-status
 *
 * Shows the active model and thinking level in the pi footer status bar.
 * Updates live when you switch models (Ctrl+P or /model) or change thinking level.
 */
export default function (pi: ExtensionAPI) {
	const STATUS_KEY = "model-status";

	function update(
		model: { provider: string; id: string } | undefined,
		level: string | undefined,
		ctx: Parameters<Parameters<typeof pi.on>[1]>[1],
	) {
		if (!model) return;
		const label =
			level && level !== "none" ? `${model.id} [${level}]` : model.id;
		ctx.ui.setStatus(STATUS_KEY, label);
	}

	pi.on("model_select", async (event, ctx) => {
		update(event.model, undefined, ctx);
	});

	pi.on("thinking_level_select", async (event, ctx) => {
		update(ctx.model, event.level, ctx);
	});

	pi.on("session_start", async (_event, ctx) => {
		update(ctx.model, undefined, ctx);
	});
}
