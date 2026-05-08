import { Container, Key, matchesKey, Text } from "@earendil-works/pi-tui";
import {
	getRollingWeekPunchBuckets,
	getUsageBucketSessions,
	getUsageOverview,
	saveUsageViewPrefs,
	type UsagePunchBucket,
	type UsageViewPrefs,
} from "./usage-aggregation.js";

export class UsageDashboard extends Container {
	private prefs: UsageViewPrefs;
	private buckets: UsagePunchBucket[];
	private overview = getUsageOverview("week");
	private selectedIndex = 0;
	private detailOpen = false;
	private onClose?: () => void;

	constructor(prefs: UsageViewPrefs, onClose?: () => void) {
		super();
		this.prefs = prefs;
		this.onClose = onClose;
		this.buckets = getRollingWeekPunchBuckets();
		this.selectedIndex = this.bucketIndexForDate(this.prefs.selectedBucket);
		this.rebuild();
	}

	handleInput(data: string): void {
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data === "escape" || data === "ctrl+c") {
			if (this.detailOpen) {
				this.detailOpen = false;
				this.rebuild();
				return;
			}

			this.onClose?.();
			return;
		}

		if (matchesKey(data, Key.enter) || data === "enter" || data === "return") {
			this.detailOpen = true;
			this.persistSelectedBucket();
			this.rebuild();
			return;
		}

		if (
			matchesKey(data, Key.left) ||
			matchesKey(data, Key.up) ||
			data === "left" ||
			data === "up"
		) {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.persistSelectedBucket();
			this.rebuild();
			return;
		}

		if (
			matchesKey(data, Key.right) ||
			matchesKey(data, Key.down) ||
			data === "right" ||
			data === "down"
		) {
			this.selectedIndex = Math.min(this.buckets.length - 1, this.selectedIndex + 1);
			this.persistSelectedBucket();
			this.rebuild();
		}
	}

	private bucketIndexForDate(date: string | null): number {
		if (!date) return 0;
		const index = this.buckets.findIndex((bucket) => bucket.date === date);
		return index >= 0 ? index : 0;
	}

	private persistSelectedBucket(): void {
		this.prefs.selectedBucket = this.buckets[this.selectedIndex]?.date ?? null;
		saveUsageViewPrefs(this.prefs);
	}

	private punchGlyph(totalTokens: number): string {
		if (totalTokens <= 0) return "·";
		if (totalTokens < 25) return "░";
		if (totalTokens < 100) return "▒";
		if (totalTokens < 500) return "▓";
		return "█";
	}

	private formatTimeRange(start: string, end: string): string {
		return `${start.slice(11, 16)}-${end.slice(11, 16)}`;
	}

	private formatMoney(value: number): string {
		return value.toFixed(2);
	}

	private getSelectedBucket(): UsagePunchBucket {
		return this.buckets[this.selectedIndex] ?? this.buckets[0] ?? {
			date: "",
			label: "?",
			sessionCount: 0,
			totals: {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				totalTokens: 0,
				costInput: 0,
				costOutput: 0,
				costCacheRead: 0,
				costCacheWrite: 0,
				costTotal: 0,
			},
		};
	}

	private buildOverviewLines(): string[] {
		return [
			"Usage",
			`Tokens: ${this.overview.totals.totalTokens.toLocaleString()} | Sessions: ${this.overview.sessionCount}`,
			this.buckets
				.map(
					(bucket, index) =>
						`${index === this.selectedIndex ? ">" : " "}${this.punchGlyph(bucket.totals.totalTokens)} ${bucket.label}`,
				)
				.join("  "),
		];
	}

	private buildDetailLines(): string[] {
		const bucket = this.getSelectedBucket();
		const sessions = getUsageBucketSessions(bucket.date);
		const bucketTotals = bucket.totals;

		return [
			"Usage",
			`Tokens: ${this.overview.totals.totalTokens.toLocaleString()} | Sessions: ${this.overview.sessionCount}`,
			`Bucket ${bucket.date} | Sessions: ${bucket.sessionCount} | Total tokens: ${bucketTotals.totalTokens.toLocaleString()} | Input: ${bucketTotals.inputTokens.toLocaleString()} | Output: ${bucketTotals.outputTokens.toLocaleString()} | Cache: ${bucketTotals.cacheReadTokens.toLocaleString()}/${bucketTotals.cacheWriteTokens.toLocaleString()} | Cost: $${this.formatMoney(bucketTotals.costTotal)}`,
			"Press Esc to return",
			"",
			sessions.length > 0 ? "Sessions" : "Sessions: none",
			...sessions.map((session, index) => {
				const providerModel = [session.provider, session.modelId].filter(Boolean).join("/") || "unknown";
				return `${index + 1}. ${session.sessionName ?? session.sessionId} | ${providerModel} | ${this.formatTimeRange(session.sessionStartedAt, session.sessionEndedAt)} | total ${session.totals.totalTokens} | input ${session.totals.inputTokens} | output ${session.totals.outputTokens} | cache ${session.totals.cacheReadTokens}/${session.totals.cacheWriteTokens} | cost $${this.formatMoney(session.totals.costTotal)}`;
			}),
		];
	}

	private rebuild(): void {
		this.clear();
		this.overview = getUsageOverview(this.prefs.range);
		this.buckets = getRollingWeekPunchBuckets();
		this.selectedIndex = Math.min(this.selectedIndex, this.buckets.length - 1);

		const text = this.detailOpen ? this.buildDetailLines().join("\n") : this.buildOverviewLines().join("\n");
		this.addChild(new Text(text, 1, 0));
	}
}
