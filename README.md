# Flex Season Pass Customer Satisfaction Simulator

Browser-only prototype for testing Flex Season Pass allocation and satisfaction algorithms before a backend is built.

The product goal is **highest practical overall satisfaction across the customer population**, not “first customer gets every favorite day.”

## How to run

1. Open `index.html` in a modern desktop browser.
2. No install, build, or server is required.
3. All state is stored in `localStorage`.

If a browser blocks `file://` scripts, serve the folder with any static file server and open the URL.

## Architecture

```text
index.html
css/style.css
js/
  constants.js      defaults, storage keys, algorithm modes
  utils.js          dates, percentiles, combinations
  storage.js        localStorage save/load/import/export
  demand.js         capacity, velocity, trend, pressure
  scoring.js        dynamic day and organizer/day scores
  satisfaction.js   customer + population satisfaction
  allocation.js     candidate generation, evaluation, selection
  simulation.js     scenarios, sequential allocation, comparison
  data.js           demo seed, CRUD, KPIs
  ui.js             cards, tables, heatmap, modal, drawer, toasts
  charts.js         SVG/HTML charts
  pages/            dashboard and workspace screens
  app.js            hash router
```

Calculation modules do not touch the DOM. They can be moved to Node later without rewriting the scoring model.

## Data model

| Entity | Meaning |
|---|---|
| Organizer | Daily capacity + required days per pass |
| Season date | Calendar day with initial rank and base score |
| Customer | Pass holder with booking timestamp / sequence |
| Preferences | Ranked dates **per organizer** |
| Ticket | FIFO booking record |
| Allocation | 10-day schedule + scores + explanation |

Hard rules for the default Navrat package:

- Exactly 10 unique dates
- One organizer per date
- Rasvlila 3 / MGM 3 / Navrat 2 / Acrolawns 2
- Organizer/day capacity cannot go negative

## Scoring formulas

Dynamic day score (weights configurable):

```text
40% base popularity + 35% utilization + 15% booking velocity + 10% recent trend
```

Customer satisfaction (Balanced mode, configurable):

```text
60% preference + 15% fairness + 15% future protection + 5% continuity + 5% FIFO
```

Demand pressure = pending top-3 demand / remaining capacity.

FIFO is a **tie-breaker** when global scores are within the configured tolerance. Continuity is a **soft bonus**, never a hard requirement.

## Business rules

- Best satisfaction = highest practical overall satisfaction while respecting inventory, quotas, one-organizer-per-date, fairness, demand pressure, and FIFO.
- Premium slots have opportunity cost. The allocator may refuse a customer’s #1 date if it protects the population.
- Low-satisfaction outcomes are penalized even when the average looks fine.

## Simulation

Open **Run Simulation**:

1. Choose 10 / 100 / 250 / 400 users (or custom).
2. Pick a scenario (popular-day bias, sudden 12 Oct shift, Rasvlila overload, continuity, random, balanced).
3. Pick an algorithm mode.
4. Start, pause, resume, step one user, or reset.

**Scenario Comparison** replays the same seeded customers through Preference Heavy, FIFO Heavy, Balanced, Global, and Fairness Heavy.

## Algorithm modes

| Mode | Intent |
|---|---|
| Preference Heavy | Current customer’s ranked dates |
| FIFO Heavy | Booking order after hard rules |
| Balanced Satisfaction | Recommended weighted model |
| Global Satisfaction | Population outcome + inventory protection |
| Fairness Heavy | Even premium distribution + low-score protection |

## Known prototype limitations

- Candidate generation uses beam search, not exhaustive enumeration of every legal 10-day schedule.
- Pending demand is inferred from unallocated customers’ top-3 preferences, not a live waitlist service.
- 250–400 user runs are usable in Fast mode; the UI batches updates to stay responsive.
- There is no multi-user sync. This is a single-browser lab.
- Changing organizer quotas after allocations exist can make historical records inconsistent until you re-simulate.
