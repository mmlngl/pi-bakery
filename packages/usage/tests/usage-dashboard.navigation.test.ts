import { describe, expect, it, vi } from "vitest";
import { UsageDashboard } from "../extensions/usage-dashboard";
import { getUsageViewPrefsDefaults } from "../extensions/usage-aggregation";

describe("UsageDashboard keyboard navigation", () => {
	it("moves the selected bucket with arrow keys", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-10T12:00:00.000Z"));

		const dashboard = new UsageDashboard(getUsageViewPrefsDefaults());
		const before = dashboard.render(120).join("\n");
		dashboard.handleInput("right");
		const after = dashboard.render(120).join("\n");

		expect(after).not.toEqual(before);
		expect(after).toContain(">");
	});
});
