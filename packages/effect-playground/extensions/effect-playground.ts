import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import * as Cli from "effect/unstable/cli";
import * as N from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Ctx from "./ctx.js";

const name = Cli.Argument.string("name").pipe(
	Cli.Argument.withDefault("World"),
);
const shout = Cli.Flag.boolean("shout").pipe(Cli.Flag.withAlias("s"));

const greet = Cli.Command.make("greet", { name, shout }, ({ name, shout }) =>
	Effect.gen(function* () {
		const ctx = yield* Ctx.Ctx;
		const message = `Hello, ${name}!`;
		const formatted = shout ? message.toUpperCase() : message;
		ctx.ui.notify(formatted, "info");
	}),
);

const COMMAND_NAME = "effect-playground";

function tokenizeArgs(input: string): ReadonlyArray<string> {
	const trimmed = input.trim();
	return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
}

export default function (pi: ExtensionAPI) {
	pi.registerCommand(COMMAND_NAME, {
		description:
			"Stub command for experimenting with Effect-based pi extensions",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const tokenized = tokenizeArgs(args);

			const program = Cli.Command.runWith(greet, {
				version: "1.0.0",
			})(tokenized);

			const infraLayer = Ctx.Ctx.layerFromCtx(ctx);

			const runnable = program.pipe(
				Effect.provide(N.NodeServices.layer),
				Effect.provide(infraLayer),
			);
			const exit = await Effect.runPromiseExit(runnable);

			if (Exit.isFailure(exit)) ctx.ui.notify(exit.cause.toString(), "error");
		},
	});
}
