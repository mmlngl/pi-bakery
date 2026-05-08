import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

const COMMAND_NAME = "effect-playground";

export default function (pi: ExtensionAPI) {
	pi.registerCommand(COMMAND_NAME, {
		description:
			"Stub command for experimenting with Effect-based pi extensions",
		handler: async (_args, ctx: ExtensionCommandContext) => {
			const program = Effect.gen(function* () {
				yield* Effect.die("what?");
				return "YOOOO";
			});

			const runnable = program;
			const exit = await Effect.runPromiseExit(runnable);

			Exit.isSuccess(exit)
				? ctx.ui.notify(exit.value, "info")
				: ctx.ui.notify(exit.cause.toString(), "error");
		},
	});
}
