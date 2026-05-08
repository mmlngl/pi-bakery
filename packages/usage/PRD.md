## Problem Statement

As a pi user, I want to understand how much token usage I am generating over time across all of my sessions, so that I can spot trends, compare sessions, and make informed decisions about prompts, models, and workflows.

Right now, that usage is visible only in the moment. There is no global historical dashboard that shows token usage across sessions, no easy way to compare day/week/month totals, and no chart-based view that makes trends obvious at a glance.

## Solution

Add a global usage dashboard command, `/usage`, that opens a fullscreen TUI dashboard showing historical token usage across all sessions.

The dashboard should use a GitHub-style punch chart as the primary visualization, with additional line and bar chart views available by keyboard toggle. The default view should be a rolling week. The dashboard should display absolute token intensity, support drill-down details for selected buckets, and retain the last view state between launches.

Usage data should be stored globally in a local SQLite database, with one row per session. The database should record all sessions, including aborted, errored, zero-usage, resumed, and forked sessions. The dashboard should aggregate from that history to show total tokens, input tokens, output tokens, cache read tokens, cache write tokens, and cost.

The session totals should be written on session shutdown, with a manual command available to flush/write on demand.

## User Stories

1. As a pi user, I want to open `/usage` from within pi, so that I can inspect my token usage history without leaving the terminal.
2. As a pi user, I want the dashboard to open fullscreen, so that the charts have enough space to be readable.
3. As a pi user, I want the dashboard to show usage across all historical sessions, so that I can understand my long-term usage patterns.
4. As a pi user, I want the dashboard to include sessions from every outcome type, so that gaps, failures, and aborted work are still reflected in my history.
5. As a pi user, I want the default dashboard view to be a rolling week, so that I can quickly see my most recent usage trend.
6. As a pi user, I want the main visualization to feel like a GitHub punch chart, so that I can read usage density at a glance.
7. As a pi user, I want the punch chart intensity to be based on absolute token count, so that the chart reflects true scale instead of relative normalization.
8. As a pi user, I want to toggle between punch chart, line chart, and bar chart with the keyboard, so that I can explore the same data in different forms.
9. As a pi user, I want the dashboard to show total tokens by default, so that the primary metric is immediately visible.
10. As a pi user, I want to drill into a selected time bucket, so that I can see which sessions contributed to that usage.
11. As a pi user, I want the drill-down to list sessions sorted by total tokens descending, so that the largest sessions are easiest to find.
12. As a pi user, I want the drill-down to show session start and end times, so that I can understand when the usage occurred.
13. As a pi user, I want the drill-down to show model and provider information, so that I can compare usage sources.
14. As a pi user, I want the drill-down to show total tokens, input tokens, output tokens, cache read tokens, cache write tokens, and cost, so that I can analyze the full usage breakdown.
15. As a pi user, I want the dashboard to remember my last selected view state, so that reopening `/usage` feels continuous.
16. As a pi user, I want the dashboard to persist view preferences locally, so that my preferred range and breakdown mode survive restarts.
17. As a pi user, I want usage data to be stored in a local SQLite database, so that querying and aggregation stay fast as history grows.
18. As a pi user, I want the system to write one summary row per session, so that storage stays compact and chart queries stay simple.
19. As a pi user, I want the session summary to be written on shutdown, so that the dashboard stays up to date without constantly writing during the session.
20. As a pi user, I want a manual flush command, so that I can force a write when I want to verify or persist usage immediately.
21. As a pi user, I want the dashboard to remain keyboard-driven, so that I can navigate and inspect data without using the mouse.
22. As a pi user, I want the weekly punch chart labels to use day initials, so that the chart stays compact and legible.
23. As a pi user, I want the dashboard to start with an overview and then reveal more detail on selection, so that I can move from summary to specifics without leaving the screen.
24. As a pi user, I want the feature to work globally rather than per project, so that my whole usage history lives in one place.

## Implementation Decisions

- Add a new global `/usage` command that opens a fullscreen dashboard.
- Persist usage history in a local SQLite database stored in a global app-data location.
- Store one row per session rather than per turn or per request.
- Record all sessions, including aborted, errored, zero-usage, resumed, and forked sessions.
- Capture the full set of usage metrics: total tokens, input tokens, output tokens, cache read tokens, cache write tokens, and cost.
- Write the session summary on session shutdown.
- Add a manual flush/write command for on-demand persistence.
- Build a dashboard that defaults to a rolling week punch chart and supports keyboard toggles for punch, line, and bar chart styles.
- Use absolute token values for chart intensity.
- Add drill-down details for selected buckets, including session list and per-session usage totals.
- Sort drill-down sessions by total tokens descending.
- Persist view preferences separately from usage data in a small local config file.
- Keep the dashboard global-only for v1; do not scope it to project or provider initially.
- Design the data and charting logic so that filters can be added later without changing the storage model.
- Separate data capture, persistence, aggregation, and UI rendering into independently testable modules.

## Testing Decisions

- Test the session-summary capture behavior by validating that a session shutdown produces exactly one persisted summary row.
- Test that the manual flush command writes the same persisted summary data as shutdown.
- Test that all session types are included in persistence, including empty, errored, aborted, resumed, and forked sessions.
- Test SQLite aggregation behavior for day/week/month rollups across multiple sessions.
- Test that the dashboard renders the correct default view state on startup.
- Test keyboard-driven chart toggling and bucket navigation as external behavior.
- Test that drill-down sorting orders sessions by total tokens descending.
- Test that persisted view preferences are restored across launches.
- Test chart data generation independently from TUI rendering so that aggregation can be verified without terminal-specific concerns.
- Test that the implementation remains stable when the database contains a large number of historical sessions.

## Out of Scope

- Project-local usage history.
- Provider, model, or session-type filtering in v1.
- Always-on dashboard widgets in the main pi UI.
- Live streaming usage charts while a session is running.
- Remote sync or cloud publishing of usage data.
- Per-turn or per-tool-call drill-down storage in the first version.
- Exporting charts to files or images.
- Multi-user or team-wide analytics.
- Advanced cohort analysis, anomaly detection, or forecasting.

## Further Notes

- The feature is inspired by GitHub-style punch charts, but it is purpose-built for pi usage data.
- The first version should prioritize fast reads, simple storage, and a clear overview.
- The implementation should leave room for future filters and deeper drill-downs without forcing a schema rewrite.
