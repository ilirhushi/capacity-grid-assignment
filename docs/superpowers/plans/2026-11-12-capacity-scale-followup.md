# Capacity Scale and Verification Follow-up

**Goal:** Keep the capacity view responsive for a few thousand people and two years, and close the remaining calculation and failure-state verification gaps.

**Architecture:** Search and page people in SQL before joining their assignments to weeks. Return only the selected people and their week arrays, plus a filtered person count. In React, fetch on page or search changes and render a window of week columns with spacer cells while preserving the sticky person and capacity columns.

**Source:** `README.md`, the existing capacity view, and the user's request to address the review gaps. Do not change the fixed schema, seed, or run environment.

## Contract

- `GET /api/capacity?from=&to=&search=&page=&pageSize=` returns `weeks`, `people`, `totalPeople`, `page`, and `pageSize`. `search` is a literal case-insensitive substring. `page` starts at 1; default page size is 50 and maximum is 100.
- The people count reflects the search. The over-capacity summary describes the current page, not the full roster.
- A change to range or search resets to page 1. Late requests cannot replace the latest result.
- Week columns retain their accessible date labels. A column window with overscan limits DOM work on two-year ranges while the table remains horizontally scrollable.

## Tasks

### 1. Server-side people paging

- [ ] Add failing Go integration tests against the fixed seed for positive weekday totals, partial-week selection, literal search, page boundaries, and validation.
- [ ] Restrict people in SQL before aggregating assignments. Return count and page metadata. Keep assignment rows distinct and dates inclusive.
- [ ] Run the Go suite from mounted source in Compose. Compare the default sample and a two-year API response with the previous output.
- [ ] Commit the API and tests.

### 2. Page fetching and week-column window

- [ ] Add failing Vitest tests for server page navigation, search reset, late page responses, and a 105-week result that renders only a limited column window.
- [ ] Implement server-driven page/search state and virtual week columns. Keep editing, failed-save visibility, and post-save refresh correct.
- [ ] Run web tests and build. Open the page and inspect navigation, search, horizontal scrolling, and editing.
- [ ] Commit the UI and tests.

### 3. Live failure check and scale evidence

- [ ] Trigger a failed save in the running browser without changing seeded data. Check the visible error and preserved editor, then restore the API.
- [ ] Repeat a 3,000-person, 105-week temporary-table query benchmark with the paged query. Compare against the prior 5.45-second full-roster SQL run.
- [ ] Append measured outcomes and any remaining limitation to `.notes/worklog.md`. Commit the worklog separately.
