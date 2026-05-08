import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeUsageDatabase, configureUsageStorageForTests, resetUsageStorageForTests } from "../extensions/usage-store";
import { UsageDashboard } from "../extensions/usage-dashboard";
import { getUsageViewPrefsDefaults } from "../extensions/usage-aggregation";

const tempRoots: string[] = [];

afterEach(() => {
	closeUsageDatabase();
	resetUsageStorageForTests();
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("UsageDashboard", () => {
	it("defaults to the rolling week punch-chart overview", () => {
		const root = mkdtempSync(join(tmpdir(), "pi-usage-render-"));
		tempRoots.push(root);
		configureUsageStorageForTests({ appDir: root, databasePath: join(root, "usage.sqlite3") });

		const dashboard = new UsageDashboard(getUsageViewPrefsDefaults());
		const output = dashboard.render(120).join("\n");

		expect(output).toContain("Usage");
		expect(output).toContain("Tokens:");
		expect(output).toContain("Sessions:");
		expect(output).toContain("· S");
		expect(output).toContain("· M");
		expect(output).toContain("· W");
		expect(output).toContain("· F");
	});
});
