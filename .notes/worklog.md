# Worklog

Running notes on how this got built — decisions, assumptions, dead ends, and anything
left unfinished. Append as you go; a line or two per entry is right.

---

- Capacity uses complete Monday-to-Sunday weeks, five eight-hour working days, and every assignment row. The later seed rows intentionally overlap the opening examples under distinct IDs; Ana's first week is 320 allocated hours, not the 20 suggested by row 1 alone.
- Ruling: Corrected the plan's sample expectations after querying the full seed. Deduplicating identical-looking assignments would discard distinct records; if duplicate IDs represent a data error, that needs a separate domain decision.
- PATCH accepts a finite weekly-hours number from 0 to 168 and returns the saved value. The grid will refetch after save because that keeps all server-derived totals in sync. A live edit changed Ana's capacity from 40 to 32 while allocation stayed 320, then was restored to 40.
- The grid shows 50 people per page with name search, full-week navigation, date-range controls, and visible loading/save errors. It clears old numbers on a range change, but keeps them visible during a post-save refresh. A VS Code browser check showed the overage labels and a successful 40 to 32 to 40 edit for Ana without a page reload.
- A two-year API request against the seed returned 200 in 0.76 seconds with 162,485 bytes. This measures the local 500-person seed, not a few-thousand-person production roster; horizontal scrolling over 105 weeks still needs usability validation at that scale.
- In the VS Code browser, changing the date fields to Jan 12 through Jan 16 showed one week and four over-capacity people; searching for Ana narrowed the table to one row. Restored the prior Jan 5 through Jan 23 view and cleared search.
- An unprimed branch review found two defects: search or paging could hide a failed save, and rounding could display a nonzero overage as zero. Search and paging are disabled during saves; weekly hours accept two decimal places, and displayed values preserve small nonzero allocation amounts. Both have regression tests.
- A temporary 3,000-person, 757,170-assignment, 105-week SQL benchmark of the full-roster query took 5.45 seconds and spilled its aggregate and sort to disk. The tables were session-local and did not change the seed. This reopened the scale question: client-side paging reduces rendered rows but does not bound API work or transfer.
