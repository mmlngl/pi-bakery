import { describe, expect, it, vi } from "vitest";
import usageExtension from "../extensions/usage";

describe("/usage dashboard command", () => {
	it("opens the dashboard fullscreen", async () => {
		const custom = vi.fn(async () => ({ close: () => undefined, requestRender: () => undefined }));
		const commands: Record<string, any> = {};

		usageExtension({
			registerCommand: (name: string, command: any) => {
				commands[name] = command;
			},
			on: () => undefined,
		} as any);

		expect(commands.usage).toBeTruthy();

		await commands.usage.handler("", {
			waitForIdle: async () => undefined,
			ui: {
				custom,
				notify: () => undefined,
			} as any,
		} as any);

		expect(custom).toHaveBeenCalledTimes(1);
		expect(custom.mock.calls[0]?.[1]).toMatchObject({ overlay: true });
	});
});
