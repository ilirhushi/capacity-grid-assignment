# Decisions

Yours to write, not your AI's. Short is good — bullets are fine, and half a page is
plenty. We read this first.

## What did the spec not tell you?

There are things this brief doesn't specify. Which ones did you hit, what did you decide,
and why?

- I treated a selected date range as Monday to Sunday weeks. I calculate allocations for Monday to Friday using an eight-hour workday.
- After editing weekly hours, I refetch the current date range, search, and people page so the grid shows the latest values from the API.
- For larger teams, I chose to search and page people in the API before calculating their allocations, and render only the nearby week columns. That keeps a two-year view bounded in both the response and the browser.

## What did you notice that looked wrong?

Anything in the output that didn't match what you expected. Whether you fixed it or left
it, we want to know you saw it.

- I noticed that Ana showed 320 allocated hours in the first week, I was expecting 20 from looking at the seed rows, but later rows repeated that assignment under distinct IDs. I then counted every row cause the schema gives no basis for discarding them.

## What did the AI get wrong that you caught?

One concrete example. Every real session has one.

- the AI started implementing before we a reviewed plan and an approved plan. I stopped it, had it to restore those edit and start over with a plan, reviewed the plan, and then approved it. The AI then implemented the plan correctly.
- the table was rounding hours to 1 decimal place, with 40 hours allocated against 39.99 hours of capacity, it could show "Over by 0.0 hours" which is misleading. I caught this contradiction and fixed it, also we added a regression
test to catch it in the future.

## What would you do differently with a week?

- I would have added effective dates (recording when a capacity change starts) to weekly capacity changes, so editing someone’s hours would preserve the correct capacity for past weeks.
