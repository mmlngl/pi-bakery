import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import usageExtension from "../extensions/usage";
import { closeUsageDatabase, configureUsageStorageForTests, resetUsageStorageForTests } from "../extensions/usage-store";

const tempRoots: string[] = [];

afterEach(() => {
	closeUsageDatabase();
	resetUsageStorageForTests();
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("/usage dashboard command", () => {
	it("opens the dashboard fullscreen", async () => {
		const root = mkdtempSync(join(tmpdir(), "pi-usage-command-"));
		tempRoots.push(root);
		configureUsageStorageForTests({ appDir: root, databasePath: join(root, "usage.sqlite3") });

		let capturedDashboard: any;
		const done = vi.fn();
		const custom = vi.fn((factory: any, options: any) => {
			capturedDashboard = factory(undefined, undefined, undefined, done);
			return { requestRender: () => undefined };
		});
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

		capturedDashboard.handleInput("escape");
		expect(done).toHaveBeenCalledTimes(1);
	});

	it("opens again after escape even if the UI is still settling", async () => {
		const root = mkdtempSync(join(tmpdir(), "pi-usage-command-"));
		tempRoots.push(root);
		configureUsageStorageForTests({ appDir: root, databasePath: join(root, "usage.sqlite3") });

		const pendingIdle = new Promise<void>(() => undefined);
		const dashboards: any[] = [];
		const done = vi.fn();
		const custom = vi.fn((factory: any) => {
			const dashboard = factory(undefined, undefined, undefined, done);
			dashboards.push(dashboard);
			return { requestRender: () => undefined };
		});
		const commands: Record<string, any> = {};

		usageExtension({
			registerCommand: (name: string, command: any) => {
				commands[name] = command;
			},
			on: () => undefined,
		} as any);

		commands.usage.handler("", {
			waitForIdle: () => pendingIdle,
			ui: {
				custom,
				notify: () => undefined,
			} as any,
		} as any);

		await Promise.resolve();
		expect(custom).toHaveBeenCalledTimes(1);

		dashboards[0]?.handleInput("escape");
		expect(done).toHaveBeenCalledTimes(1);

		commands.usage.handler("", {
			waitForIdle: () => pendingIdle,
			ui: {
				custom,
				notify: () => undefined,
			} as any,
		} as any);

		await Promise.resolve();
		expect(custom).toHaveBeenCalledTimes(2);
		expect(custom.mock.calls[1]?.[1]).toMatchObject({ overlay: true });
	});
});
