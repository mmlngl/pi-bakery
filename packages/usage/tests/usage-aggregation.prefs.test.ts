import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { configureUsageStorageForTests, resetUsageStorageForTests } from "../extensions/usage-store";
import { loadUsageViewPrefs, saveUsageViewPrefs } from "../extensions/usage-aggregation";

const tempRoots: string[] = [];

afterEach(() => {
	resetUsageStorageForTests();
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("usage view prefs", () => {
	it("saves and restores the last dashboard view state", () => {
		const root = mkdtempSync(join(tmpdir(), "pi-usage-prefs-"));
		tempRoots.push(root);
		configureUsageStorageForTests({ appDir: root, databasePath: join(root, "usage.sqlite3") });

		saveUsageViewPrefs({
			range: "month",
			chartStyle: "bar",
			breakdown: "cost",
			selectedBucket: "2026-02-10",
		});

		expect(loadUsageViewPrefs()).toMatchObject({
			range: "month",
			chartStyle: "bar",
			breakdown: "cost",
			selectedBucket: "2026-02-10",
		});
	});
});
