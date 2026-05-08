import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getUsageDatabasePath, getUsageDirectory } from "./usage-store.js";

export type UsageRange = "day" | "week" | "month" | "all-time";

export interface UsageTotals {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	totalTokens: number;
	costInput: number;
	costOutput: number;
	costCacheRead: number;
	costCacheWrite: number;
	costTotal: number;
}

export interface UsageOverview {
	range: UsageRange;
	windowStart: string | null;
	windowEnd: string;
	sessionCount: number;
	totals: UsageTotals;
}

export interface UsagePunchBucket {
	date: string;
	label: string;
	sessionCount: number;
	totals: UsageTotals;
}

export interface UsageBucketSession {
	sessionId: string;
	sessionName: string | null;
	sessionStartedAt: string;
	sessionEndedAt: string;
	provider: string | null;
	modelId: string | null;
	totals: UsageTotals;
}

export type UsageChartStyle = "punch" | "line" | "bar";
export type UsageBreakdownMode = "total" | "input" | "output" | "cache" | "cost";

export interface UsageViewPrefs {
	range: UsageRange;
	chartStyle: UsageChartStyle;
	breakdown: UsageBreakdownMode;
	selectedBucket: string | null;
	updatedAt?: string;
}

const DEFAULT_VIEW_PREFS: UsageViewPrefs = {
	range: "week",
	chartStyle: "punch",
	breakdown: "total",
	selectedBucket: null,
};

function emptyTotals(): UsageTotals {
	return {
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
	};
}

function rangeWindow(range: UsageRange, now: Date): { start: Date | null; end: Date } {
	const end = new Date(now);
	if (range === "all-time") return { start: null, end };

	const days = range === "day" ? 1 : range === "week" ? 7 : 30;
	const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
	return { start, end };
}

function toIso(value: Date): string {
	return value.toISOString();
}

function sumOrZero(row: Record<string, unknown>, key: string): number {
	const value = row[key];
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mapTotals(row: Record<string, unknown>): UsageTotals {
	return {
		inputTokens: sumOrZero(row, "input_tokens"),
		outputTokens: sumOrZero(row, "output_tokens"),
		cacheReadTokens: sumOrZero(row, "cache_read_tokens"),
		cacheWriteTokens: sumOrZero(row, "cache_write_tokens"),
		totalTokens: sumOrZero(row, "total_tokens"),
		costInput: sumOrZero(row, "cost_input"),
		costOutput: sumOrZero(row, "cost_output"),
		costCacheRead: sumOrZero(row, "cost_cache_read"),
		costCacheWrite: sumOrZero(row, "cost_cache_write"),
		costTotal: sumOrZero(row, "cost_total"),
	};
}

function dayKey(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function weekdayInitial(date: Date): string {
	return ["S", "M", "T", "W", "T", "F", "S"][date.getUTCDay()] ?? "?";
}

function getPrefsPath(): string {
	return join(getUsageDirectory(), "usage-prefs.json");
}

export function loadUsageViewPrefs(): UsageViewPrefs {
	const path = getPrefsPath();
	if (!existsSync(path)) return { ...DEFAULT_VIEW_PREFS };

	try {
		const raw = readFileSync(path, "utf8");
		const parsed = JSON.parse(raw) as Partial<UsageViewPrefs>;
		return {
			range: parsed.range ?? DEFAULT_VIEW_PREFS.range,
			chartStyle: parsed.chartStyle ?? DEFAULT_VIEW_PREFS.chartStyle,
			breakdown: parsed.breakdown ?? DEFAULT_VIEW_PREFS.breakdown,
			selectedBucket: parsed.selectedBucket ?? DEFAULT_VIEW_PREFS.selectedBucket,
			updatedAt: parsed.updatedAt,
		};
	} catch {
		return { ...DEFAULT_VIEW_PREFS };
	}
}

export function saveUsageViewPrefs(prefs: UsageViewPrefs): void {
	const path = getPrefsPath();
	writeFileSync(
		path,
		JSON.stringify(
			{
				...prefs,
				updatedAt: prefs.updatedAt ?? new Date().toISOString(),
			},
			null,
			2,
		),
	);
}

export function getUsagePreferencesPath(): string {
	return getPrefsPath();
}

export function getUsageViewPrefsDefaults(): UsageViewPrefs {
	return { ...DEFAULT_VIEW_PREFS };
}

export function getUsageOverview(range: UsageRange, now = new Date()): UsageOverview {
	const window = rangeWindow(range, now);
	const totals = emptyTotals();
	const dbPath = getUsageDatabasePath();
	const end = toIso(window.end);

	if (!existsSync(dbPath)) {
		return {
			range,
			windowStart: window.start ? toIso(window.start) : null,
			windowEnd: end,
			sessionCount: 0,
			totals,
		};
	}

	const db = new DatabaseSync(dbPath, { readOnly: true });
	try {
		const whereClause = window.start ? "WHERE session_ended_at >= ? AND session_ended_at <= ?" : "WHERE session_ended_at <= ?";
		const params = window.start ? [toIso(window.start), end] : [end];
		const row = db
			.prepare(
				`
				SELECT
					COUNT(*) AS session_count,
					COALESCE(SUM(input_tokens), 0) AS input_tokens,
					COALESCE(SUM(output_tokens), 0) AS output_tokens,
					COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
					COALESCE(SUM(cache_write_tokens), 0) AS cache_write_tokens,
					COALESCE(SUM(total_tokens), 0) AS total_tokens,
					COALESCE(SUM(cost_input), 0) AS cost_input,
					COALESCE(SUM(cost_output), 0) AS cost_output,
					COALESCE(SUM(cost_cache_read), 0) AS cost_cache_read,
					COALESCE(SUM(cost_cache_write), 0) AS cost_cache_write,
					COALESCE(SUM(cost_total), 0) AS cost_total
				FROM session_usage_summary
				${whereClause}
				`,
			)
			.get(...params) as Record<string, unknown> | undefined;

		return {
			range,
			windowStart: window.start ? toIso(window.start) : null,
			windowEnd: end,
			sessionCount: Number(row?.session_count ?? 0),
			totals: mapTotals(row ?? {}),
		};
	} finally {
		db.close();
	}
}

export function getRollingWeekPunchBuckets(now = new Date()): UsagePunchBucket[] {
	const dbPath = getUsageDatabasePath();
	const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const start = new Date(today);
	start.setUTCDate(start.getUTCDate() - 6);
	const end = new Date(today);
	end.setUTCHours(23, 59, 59, 999);

	const days = Array.from({ length: 7 }, (_, index) => {
		const date = new Date(start);
		date.setUTCDate(start.getUTCDate() + index);
		return date;
	});

	const buckets = days.map((date) => ({
		date: dayKey(date),
		label: weekdayInitial(date),
		sessionCount: 0,
		totals: emptyTotals(),
	} satisfies UsagePunchBucket));

	if (!existsSync(dbPath)) return buckets;

	const db = new DatabaseSync(dbPath, { readOnly: true });
	try {
		const rows = db
			.prepare(
				`
				SELECT
					substr(session_ended_at, 1, 10) AS day,
					COUNT(*) AS session_count,
					COALESCE(SUM(input_tokens), 0) AS input_tokens,
					COALESCE(SUM(output_tokens), 0) AS output_tokens,
					COALESCE(SUM(cache_read_tokens), 0) AS cache_read_tokens,
					COALESCE(SUM(cache_write_tokens), 0) AS cache_write_tokens,
					COALESCE(SUM(total_tokens), 0) AS total_tokens,
					COALESCE(SUM(cost_input), 0) AS cost_input,
					COALESCE(SUM(cost_output), 0) AS cost_output,
					COALESCE(SUM(cost_cache_read), 0) AS cost_cache_read,
					COALESCE(SUM(cost_cache_write), 0) AS cost_cache_write,
					COALESCE(SUM(cost_total), 0) AS cost_total
				FROM session_usage_summary
				WHERE session_ended_at >= ? AND session_ended_at <= ?
				GROUP BY day
				`,
			)
			.all(toIso(start), toIso(end)) as Array<Record<string, unknown>>;

		const byDay = new Map(rows.map((row) => [String(row.day), row]));

		return buckets.map((bucket) => {
			const row = byDay.get(bucket.date);
			if (!row) return bucket;

			return {
				date: bucket.date,
				label: bucket.label,
				sessionCount: Number(row.session_count ?? 0),
				totals: mapTotals(row),
			};
		});
	} finally {
		db.close();
	}
}

export function getUsageBucketSessions(bucketDate: string): UsageBucketSession[] {
	const dbPath = getUsageDatabasePath();
	if (!existsSync(dbPath)) return [];

	const db = new DatabaseSync(dbPath, { readOnly: true });
	try {
		const rows = db
			.prepare(
				`
				SELECT
					session_id,
					session_name,
					session_started_at,
					session_ended_at,
					provider,
					model_id,
					input_tokens,
					output_tokens,
					cache_read_tokens,
					cache_write_tokens,
					total_tokens,
					cost_input,
					cost_output,
					cost_cache_read,
					cost_cache_write,
					cost_total
				FROM session_usage_summary
				WHERE substr(session_ended_at, 1, 10) = ?
				ORDER BY total_tokens DESC, session_ended_at DESC, session_id ASC
				`,
			)
			.all(bucketDate) as Array<Record<string, unknown>>;

		return rows.map((row) => ({
			sessionId: String(row.session_id ?? ""),
			sessionName: row.session_name == null ? null : String(row.session_name),
			sessionStartedAt: String(row.session_started_at ?? ""),
			sessionEndedAt: String(row.session_ended_at ?? ""),
			provider: row.provider == null ? null : String(row.provider),
			modelId: row.model_id == null ? null : String(row.model_id),
			totals: mapTotals(row),
		}));
	} finally {
		db.close();
	}
}
