import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";

export class Ctx extends Context.Service<Ctx, ExtensionCommandContext>()(
	"Ctx",
) {
	static readonly layerFromCtx = (ctx: ExtensionCommandContext) =>
		Layer.succeed(Ctx, ctx);
}
