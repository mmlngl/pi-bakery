import { Container, Key, matchesKey, Text } from "@earendil-works/pi-tui";
import {
	getRollingWeekPunchBuckets,
	getUsageOverview,
	type UsagePunchBucket,
	type UsageViewPrefs,
} from "./usage-aggregation.js";

export class UsageDashboard extends Container {
	private prefs: UsageViewPrefs;
	private buckets: UsagePunchBucket[];
	private overview = getUsageOverview("week");
	private selectedIndex = 0;
	private onClose?: () => void;

	constructor(prefs: UsageViewPrefs, onClose?: () => void) {
		super();
		this.prefs = prefs;
		this.onClose = onClose;
		this.buckets = getRollingWeekPunchBuckets();
		this.rebuild();
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data === "escape" || data === "ctrl+c") {
			this.onClose?.();
			return;
		}

		if (
			matchesKey(data, Key.left) ||
			matchesKey(data, Key.up) ||
			data === "left" ||
			data === "up"
		) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.rebuild();
			return;
		}

		if (
			matchesKey(data, Key.right) ||
			matchesKey(data, Key.down) ||
			data === "right" ||
			data === "down"
		) {
			this.selectedIndex = Math.min(
				this.buckets.length - 1,
				this.selectedIndex + 1,
			);
			this.rebuild();
		}
	}

	private punchGlyph(totalTokens: number): string {
		if (totalTokens <= 0) return "·";
		if (totalTokens < 25) return "░";
		if (totalTokens < 100) return "▒";
		if (totalTokens < 500) return "▓";
		return "█";
	}

	private rebuild(): void {
		this.clear();
		this.overview = getUsageOverview(this.prefs.range);
		this.buckets = getRollingWeekPunchBuckets();

		this.addChild(new Text("Usage", 1, 0));
		this.addChild(
			new Text(
				`Tokens: ${this.overview.totals.totalTokens.toLocaleString()} | Sessions: ${this.overview.sessionCount}`,
				1,
				0,
			),
		);
		this.addChild(
			new Text(
				this.buckets
					.map(
						(bucket, index) =>
							`${index === this.selectedIndex ? ">" : " "}${this.punchGlyph(bucket.totals.totalTokens)} ${bucket.label}`,
					)
					.join("  "),
				1,
				0,
			),
		);
	}
}
