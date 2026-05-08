import { describe, expect, it } from "vitest";
import { UsageDashboard } from "../extensions/usage-dashboard";
import { getUsageViewPrefsDefaults } from "../extensions/usage-aggregation";

describe("UsageDashboard", () => {
	it("defaults to the rolling week punch-chart overview", () => {
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
