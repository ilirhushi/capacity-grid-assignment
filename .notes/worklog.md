# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

- Capacity uses complete Monday-to-Sunday weeks, five eight-hour working days, and every assignment row. The later seed rows intentionally overlap the opening examples under distinct IDs; Ana's first week is 320 allocated hours, not the 20 suggested by row 1 alone.
- Ruling: Corrected the plan's sample expectations after querying the full seed. Deduplicating identical-looking assignments would discard distinct records; if duplicate IDs represent a data error, that needs a separate domain decision.
- PATCH accepts a finite weekly-hours number from 0 to 168 and returns the saved value. The grid will refetch after save because that keeps all server-derived totals in sync. A live edit changed Ana's capacity from 40 to 32 while allocation stayed 320, then was restored to 40.
