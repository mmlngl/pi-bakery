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

	it("closes on escape or ctrl+c", () => {
		const onClose = vi.fn();
		const dashboard = new UsageDashboard(getUsageViewPrefsDefaults(), onClose);

		dashboard.handleInput("escape");
		dashboard.handleInput("ctrl+c");

		expect(onClose).toHaveBeenCalledTimes(2);
	});

	it("returns from drill-down before closing the dashboard", () => {
		const onClose = vi.fn();
		const dashboard = new UsageDashboard(getUsageViewPrefsDefaults(), onClose);

		for (let index = 0; index < 6; index += 1) {
			dashboard.handleInput("right");
		}
		dashboard.handleInput("enter");

		const detail = dashboard.render(120).join("\n");
		expect(detail).toContain("Bucket ");

		dashboard.handleInput("escape");
		expect(onClose).not.toHaveBeenCalled();

		const overview = dashboard.render(120).join("\n");
		expect(overview).not.toContain("Bucket ");
		expect(overview).toContain("·");

		dashboard.handleInput("escape");
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
