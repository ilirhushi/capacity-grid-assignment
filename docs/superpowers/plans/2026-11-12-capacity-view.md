# Capacity View Implementation Plan

**Goal:** Build the README's capacity API, interactive grid, and weekly-hours edit flow.

**Architecture:** The API returns complete Monday-to-Sunday buckets for every person in the requested range. SQL aggregates assignment fractions into hours by working day and week. React owns range, search, paging, loading, and edit state, and refreshes the active range after a successful save.

**Stack:** Go 1.26, pgx/v5, PostgreSQL 17, React 19, TypeScript, Vite, Vitest, Docker Compose.

**Source:** `README.md` and the project instructions in `AGENTS.md`. `DECISIONS.md` is human-owned and must not be edited.

## Constraints and decisions to review

- Interpret `hours_per_day` as a fraction of a standard eight-hour working day. Count Monday through Friday and inclusive assignment dates. `weekly_hours` is the person's capacity for each complete week. Changing it does not change assignment hours.
- A date range selects every complete week it touches. The API accepts valid `YYYY-MM-DD` dates in ascending order, with a two-year maximum, and returns 400 for invalid ranges.
- Return `{ weeks: string[], people: { id: number, name: string, weeklyHours: number, allocated: number[] }[] }`. `allocated[i]` belongs to `weeks[i]`; zero allocation is explicit. Sort people by name then ID.
- Repeated assignment rows count separately. The schema has no uniqueness rule that makes deduplication safe.
- Limit visible rows to 50 per page and provide name search. This bounds the rendered table for a large roster. Wide date ranges may still require horizontal scrolling and transfer a large response; measure that before claiming two-year production readiness.
- After PATCH succeeds, refresh the active range. Keep the current grid visible during loading, label it as refreshing, and guard against late responses overwriting a newer range or save. A failed PATCH keeps the editor and original numbers visible with a retryable error.
- Use existing dependencies and Compose. Do not change `DECISIONS.md`, schema, seed, Compose, Dockerfiles, or Makefile. Append concise decisions and unfinished work to `.notes/worklog.md`.

## File map

- `api/capacity.go`: range validation, scoped SQL aggregation, response mapping.
- `api/people.go`: PATCH input validation, update, response and error statuses.
- `api/capacity_test.go`, `api/people_test.go`: focused validation and calculation tests where practical; use live API checks for SQL integration against the fixed seed.
- `web/src/CapacityGrid.tsx`: range navigation, date controls, search, paging, grid, editing, and asynchronous state.
- `web/src/CapacityGrid.test.tsx`: interaction and failure-mode tests with mocked fetch.
- `web/src/App.tsx`, `web/src/styles.css`: page framing and accessible responsive presentation.
- `.notes/worklog.md`: append decisions and verification notes as work proceeds.

## Tasks

### 1. Capacity API

- [ ] Add tests for invalid dates, reversed range, and the maximum allowed range. Run them and confirm failure before implementation.
- [ ] Implement `GET /api/capacity?from=&to=` with complete Monday week starts, a scoped assignment query, and the response shape above. Use SQL parameters, aggregate only intersecting assignment days, and count weekdays only.
- [ ] Run the Go tests in Compose, then query the seed's opening weeks. Check Ana's first week as 320/40, Bo's second week as 256/40, and Dee's second week as 360/40. The later seed rows repeat these assignments under distinct IDs, so their hours count. Check a zero-capacity person with assigned hours and a week with no assignments.
- [ ] Append the calculation and range assumptions to the worklog. Commit the API and tests.

### 2. Weekly-hours PATCH

- [ ] Add tests for missing, malformed, negative, excessive, non-finite, and extra JSON input, plus unknown IDs. Confirm the tests fail against the stub.
- [ ] Implement `PATCH /api/people/{id}` accepting `{ "weeklyHours": number }` from 0 to 168, returning `{ id, name, weeklyHours }`. Return 400 for invalid input, 404 for unknown people, and 500 for database errors.
- [ ] Run tests and exercise a successful edit through the API. Restore the seeded value with a second PATCH so the running sample stays predictable.
- [ ] Commit the endpoint and tests.

### 3. Manager grid

- [ ] Add Vitest interaction tests for loading, API error and retry, over-capacity display, editing success, failed save and retry, range navigation, and an older response arriving after a newer request. Confirm relevant tests fail against the stub.
- [ ] Implement the grid with person rows, week columns, allocated/capacity values, clear over-capacity color and text, date controls, backward/forward navigation, name search, and 50-row paging.
- [ ] Save via PATCH, then refetch the current range without a page reload. Keep edits and errors local to the person row. Ignore or abort stale loads so older ranges cannot replace newer data.
- [ ] Run `docker compose exec web npm test` and `docker compose exec web npm run build`. Append UX decisions to the worklog. Commit UI and tests.

### 4. End-to-end verification and review

- [ ] Start the fixed Compose stack with `make up`. Check API health, representative capacity values, invalid requests, and PATCH behavior.
- [ ] Open `http://localhost:3000` and inspect the rendered numbers. Manually navigate, select a date range, search, edit weekly hours, and check the grid after save. Exercise a failed save or failed request and confirm the state shown to the manager.
- [ ] Check a large range for response time and usable horizontal/vertical navigation. Record measured limitations in the worklog.
- [ ] Review the branch diff against the README, including failure modes not derived from the happy path: a request that never resolves, a save cancelled halfway, and two fast range changes. Fix findings, rerun affected checks, and commit fixes separately.
- [ ] Report the final commit state and verification evidence. Leave `DECISIONS.md` for the human to fill in.
