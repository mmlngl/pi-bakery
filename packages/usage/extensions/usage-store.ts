import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ExtensionContext, SessionShutdownEvent } from "@earendil-works/pi-coding-agent";
import type { SessionEntry } from "@earendil-works/pi-coding-agent";
interface UsageLike {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	totalTokens: number;
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
}

export interface SessionUsageSummary {
	sessionId: string;
	sessionFile: string | null;
	parentSessionFile: string | null;
	cwd: string;
	sessionName: string | null;
	sessionStartedAt: string;
	sessionEndedAt: string;
	writeSource: "shutdown" | "manual";
	shutdownReason: SessionShutdownEvent["reason"] | null;
	provider: string | null;
	modelId: string | null;
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
	userMessages: number;
	assistantMessages: number;
	toolResults: number;
	updatedAt: string;
}

const DEFAULT_APP_DIR = join(homedir(), ".pi", "usage");
let appDir = DEFAULT_APP_DIR;
let databasePath = join(appDir, "usage.sqlite3");

let database: DatabaseSync | undefined;

function ensureDirectory(): void {
	mkdirSync(appDir, { recursive: true });
}

function getDatabase(): DatabaseSync {
	if (database) return database;

	ensureDirectory();
	database = new DatabaseSync(databasePath, {
		timeout: 2_000,
		enableForeignKeyConstraints: true,
	});
	database.exec(`
		PRAGMA journal_mode = WAL;
		PRAGMA synchronous = NORMAL;
		CREATE TABLE IF NOT EXISTS session_usage_summary (
			session_id TEXT PRIMARY KEY,
			session_file TEXT,
			parent_session_file TEXT,
			cwd TEXT NOT NULL,
			session_name TEXT,
			session_started_at TEXT NOT NULL,
			session_ended_at TEXT NOT NULL,
			write_source TEXT NOT NULL,
			shutdown_reason TEXT,
			provider TEXT,
			model_id TEXT,
			input_tokens INTEGER NOT NULL DEFAULT 0,
			output_tokens INTEGER NOT NULL DEFAULT 0,
			cache_read_tokens INTEGER NOT NULL DEFAULT 0,
			cache_write_tokens INTEGER NOT NULL DEFAULT 0,
			total_tokens INTEGER NOT NULL DEFAULT 0,
			cost_input REAL NOT NULL DEFAULT 0,
			cost_output REAL NOT NULL DEFAULT 0,
			cost_cache_read REAL NOT NULL DEFAULT 0,
			cost_cache_write REAL NOT NULL DEFAULT 0,
			cost_total REAL NOT NULL DEFAULT 0,
			user_messages INTEGER NOT NULL DEFAULT 0,
			assistant_messages INTEGER NOT NULL DEFAULT 0,
			tool_results INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL
		) STRICT;
		CREATE INDEX IF NOT EXISTS idx_session_usage_summary_ended_at
			ON session_usage_summary(session_ended_at);
		CREATE INDEX IF NOT EXISTS idx_session_usage_summary_started_at
			ON session_usage_summary(session_started_at);
	`);

	return database;
}

function toNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatTimestamp(value: string | undefined): string {
	if (!value) return new Date().toISOString();
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function extractUsage(message: { usage?: UsageLike } | undefined): UsageLike | undefined {
	return message?.usage;
}

function summarizeEntries(entries: SessionEntry[]): Pick<SessionUsageSummary, "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheWriteTokens" | "totalTokens" | "costInput" | "costOutput" | "costCacheRead" | "costCacheWrite" | "costTotal" | "userMessages" | "assistantMessages" | "toolResults" | "provider" | "modelId"> {
	let inputTokens = 0;
	let outputTokens = 0;
	let cacheReadTokens = 0;
	let cacheWriteTokens = 0;
	let totalTokens = 0;
	let costInput = 0;
	let costOutput = 0;
	let costCacheRead = 0;
	let costCacheWrite = 0;
	let costTotal = 0;
	let userMessages = 0;
	let assistantMessages = 0;
	let toolResults = 0;
	let provider: string | null = null;
	let modelId: string | null = null;

	for (const entry of entries) {
		if (entry.type !== "message") continue;

		const message = entry.message as {
			role?: string;
			provider?: string;
			model?: string;
			usage?: UsageLike;
		};

		if (message.role === "user") {
			userMessages += 1;
			continue;
		}

		if (message.role === "toolResult") {
			toolResults += 1;
			continue;
		}

		if (message.role !== "assistant") continue;

		assistantMessages += 1;
		const usage = extractUsage(message);
		if (!usage) continue;

		inputTokens += toNumber(usage.input);
		outputTokens += toNumber(usage.output);
		cacheReadTokens += toNumber(usage.cacheRead);
		cacheWriteTokens += toNumber(usage.cacheWrite);
		totalTokens += toNumber(usage.totalTokens);
		costInput += toNumber(usage.cost?.input);
		costOutput += toNumber(usage.cost?.output);
		costCacheRead += toNumber(usage.cost?.cacheRead);
		costCacheWrite += toNumber(usage.cost?.cacheWrite);
		costTotal += toNumber(usage.cost?.total);

		provider = message.provider ?? provider;
		modelId = message.model ?? modelId;
	}

	return {
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		totalTokens,
		costInput,
		costOutput,
		costCacheRead,
		costCacheWrite,
		costTotal,
		userMessages,
		assistantMessages,
		toolResults,
		provider,
		modelId,
	};
}

export function collectSessionUsageSummary(
	ctx: ExtensionContext,
	event: SessionShutdownEvent,
	writeSource: "shutdown" | "manual",
): SessionUsageSummary {
	const sessionManager = ctx.sessionManager;
	const header = sessionManager.getHeader();
	const entries = sessionManager.getEntries();
	const now = new Date().toISOString();
	const totals = summarizeEntries(entries);
	const currentModel = ctx.model;

	return {
		sessionId: sessionManager.getSessionId(),
		sessionFile: sessionManager.getSessionFile() ?? null,
		parentSessionFile: header?.parentSession ?? null,
		cwd: sessionManager.getCwd() || ctx.cwd,
		sessionName: sessionManager.getSessionName() ?? null,
		sessionStartedAt: formatTimestamp(header?.timestamp),
		sessionEndedAt: now,
		writeSource,
		shutdownReason: writeSource === "shutdown" ? event.reason : null,
		provider: totals.provider ?? currentModel?.provider ?? null,
		modelId: totals.modelId ?? currentModel?.id ?? null,
		inputTokens: totals.inputTokens,
		outputTokens: totals.outputTokens,
		cacheReadTokens: totals.cacheReadTokens,
		cacheWriteTokens: totals.cacheWriteTokens,
		totalTokens: totals.totalTokens,
		costInput: totals.costInput,
		costOutput: totals.costOutput,
		costCacheRead: totals.costCacheRead,
		costCacheWrite: totals.costCacheWrite,
		costTotal: totals.costTotal,
		userMessages: totals.userMessages,
		assistantMessages: totals.assistantMessages,
		toolResults: totals.toolResults,
		updatedAt: now,
	};
}

export function upsertSessionUsageSummary(summary: SessionUsageSummary): void {
	const db = getDatabase();
	const statement = db.prepare(`
		INSERT INTO session_usage_summary (
			session_id,
			session_file,
			parent_session_file,
			cwd,
			session_name,
			session_started_at,
			session_ended_at,
			write_source,
			shutdown_reason,
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
			cost_total,
			user_messages,
			assistant_messages,
			tool_results,
			updated_at
		)
		VALUES (
			@sessionId,
			@sessionFile,
			@parentSessionFile,
			@cwd,
			@sessionName,
			@sessionStartedAt,
			@sessionEndedAt,
			@writeSource,
			@shutdownReason,
			@provider,
			@modelId,
			@inputTokens,
			@outputTokens,
			@cacheReadTokens,
			@cacheWriteTokens,
			@totalTokens,
			@costInput,
			@costOutput,
			@costCacheRead,
			@costCacheWrite,
			@costTotal,
			@userMessages,
			@assistantMessages,
			@toolResults,
			@updatedAt
		)
		ON CONFLICT(session_id) DO UPDATE SET
			session_file = excluded.session_file,
			parent_session_file = excluded.parent_session_file,
			cwd = excluded.cwd,
			session_name = excluded.session_name,
			session_started_at = excluded.session_started_at,
			session_ended_at = excluded.session_ended_at,
			write_source = excluded.write_source,
			shutdown_reason = excluded.shutdown_reason,
			provider = excluded.provider,
			model_id = excluded.model_id,
			input_tokens = excluded.input_tokens,
			output_tokens = excluded.output_tokens,
			cache_read_tokens = excluded.cache_read_tokens,
			cache_write_tokens = excluded.cache_write_tokens,
			total_tokens = excluded.total_tokens,
			cost_input = excluded.cost_input,
			cost_output = excluded.cost_output,
			cost_cache_read = excluded.cost_cache_read,
			cost_cache_write = excluded.cost_cache_write,
			cost_total = excluded.cost_total,
			user_messages = excluded.user_messages,
			assistant_messages = excluded.assistant_messages,
			tool_results = excluded.tool_results,
			updated_at = excluded.updated_at
	`);

	statement.run({
		...summary,
	});
}

export function closeUsageDatabase(): void {
	if (!database) return;
	database.close();
	database = undefined;
}

export function getUsageDatabasePath(): string {
	return databasePath;
}

export function getUsageDirectory(): string {
	return appDir;
}

export function configureUsageStorageForTests(options: { appDir: string; databasePath?: string }): void {
	closeUsageDatabase();
	appDir = options.appDir;
	databasePath = options.databasePath ?? join(appDir, "usage.sqlite3");
}

export function resetUsageStorageForTests(): void {
	closeUsageDatabase();
	appDir = DEFAULT_APP_DIR;
	databasePath = join(appDir, "usage.sqlite3");
}

export default function usageStoreExtension(): void {
	// Helper module: harmless if auto-discovered as an extension.
}
