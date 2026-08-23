# Cursor Master Prompt — Flex Season Pass Customer Satisfaction Simulator

## 1. Project Overview

Build a complete **frontend-only Flex Season Pass Customer Satisfaction & Smart Allocation Simulator**.

This is a prototype/testing application for our product and development team. The purpose is to test different allocation and satisfaction algorithms before implementing the final system in a backend.

The application must simulate:

- Organizers
- Season dates
- Initial day ranking
- Organizer/day capacity
- Customer preferences
- Customer tickets
- Dynamic demand
- Dynamic day ranking
- Dynamic organizer/day ranking
- Customer satisfaction
- Global satisfaction
- Fairness
- Continuity/consecutive organizer days
- FIFO behavior
- Allocation decisions
- Simulation of many customers
- Algorithm comparison
- Explainable allocation decisions

The application must work entirely in the browser.

---

# 2. Technology Rules

Use ONLY:

- HTML5
- CSS3
- Vanilla JavaScript ES6+
- Browser localStorage
- SVG / HTML / CSS / Canvas for charts if needed

Do NOT use:

- React
- Vue
- Angular
- Svelte
- Node.js
- Express
- PHP
- Python runtime
- Firebase
- Supabase
- MySQL
- PostgreSQL
- Any backend
- Any REST API
- Any external database
- Any external UI framework

The application must run by opening `index.html` in a browser.

No build system is required.

No npm dependency should be required.

---

# 3. Project Structure

Create this structure:

```text
flex-season-pass-simulator/
│
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── app.js
│   ├── constants.js
│   ├── storage.js
│   ├── data.js
│   ├── utils.js
│   ├── scoring.js
│   ├── demand.js
│   ├── allocation.js
│   ├── satisfaction.js
│   ├── simulation.js
│   ├── ui.js
│   ├── charts.js
│   └── pages/
│       ├── dashboard.js
│       ├── organizers.js
│       ├── season.js
│       ├── preferences.js
│       ├── customers.js
│       ├── tickets.js
│       ├── demand.js
│       ├── satisfaction.js
│       ├── allocations.js
│       ├── simulation.js
│       ├── comparison.js
│       └── settings.js
└── assets/
```

Keep calculations independent from DOM/UI code so the algorithm can later be moved to Node.js/backend without major changes.

---

# 4. Core Business Objective

The system must optimize:

> **Total customer satisfaction across all customers**, not just the current customer's satisfaction.

Do NOT use simplistic logic such as:

> “First customer gets all their favorite days.”

Instead, the simulator must consider:

1. Hard package constraints
2. Current customer preference
3. Remaining inventory
4. Demand pressure
5. Future customer opportunity cost
6. Fairness
7. Continuity preference
8. FIFO as a tie-breaker

The best allocation is the valid allocation that gives the strongest overall customer outcome while protecting the ability to satisfy future customers.

---

# 5. Default Season Configuration

Default season:

```text
Season Name: Navrat 2026
Start Date: 11 October
End Date: 20 October
Total Days: 10
```

Allow the year to be changed from the Settings UI.

Never hardcode weekday names. Calculate the weekday dynamically with JavaScript Date.

The system must automatically generate all season dates between start and end date.

---

# 6. Default Organizers

Create these demo organizers:

| Rank | Organizer | Tickets / Day | Required Days / User | Season Capacity |
|---:|---|---:|---:|---:|
| 1 | Rasvlila Navrati | 120 | 3 | 1,200 |
| 2 | MGM CULTURA | 120 | 3 | 1,200 |
| 3 | Navrat | 80 | 2 | 800 |
| 4 | Acrolawns Navrati | 80 | 2 | 800 |

Total daily capacity:

```text
120 + 120 + 80 + 80 = 400 tickets/day
```

Total organizer-day capacity:

```text
400 × 10 = 4,000 organizer-day tickets
```

Theoretical maximum complete 10-day passes:

```text
4,000 / 10 = 400 users
```

Display this calculation in the dashboard.

Allow the user to add/edit/delete organizers.

---

# 7. Hard Customer Pass Rules

Every customer has one 10-day Flex Season Pass.

The allocation must satisfy exactly:

```text
Rasvlila Navrati = 3 days
MGM CULTURA      = 3 days
Navrat           = 2 days
Acrolawns        = 2 days
TOTAL            = 10 days
```

## Critical rule: only ONE organizer per date

Valid:

```text
17 Oct → Rasvlila
18 Oct → MGM
19 Oct → Rasvlila
20 Oct → Navrat
```

Invalid:

```text
17 Oct → Rasvlila
17 Oct → MGM
```

A customer must have:

- Exactly 10 dates
- 10 unique dates
- Exactly one organizer on each selected date
- Exactly 3 Rasvlila days
- Exactly 3 MGM days
- Exactly 2 Navrat days
- Exactly 2 Acrolawns days
- No organizer/day capacity violation

These are HARD CONSTRAINTS.

A candidate allocation violating any hard constraint must receive an invalid/infinite penalty and never be selected.

---

# 8. Continuous / Consecutive Same-Organizer Days

Continuous days for the same organizer are **allowed**.

Example:

```text
17 Oct → Rasvlila
18 Oct → Rasvlila
19 Oct → Rasvlila
```

This is valid.

Continuous days must NOT be:

- Mandatory
- Forbidden

They are only a **soft preference**.

A 3-day Rasvlila sequence may be selected when it is globally reasonable.

However, continuity must never override:

- Capacity
- Unique date rule
- Organizer quota
- Global fairness
- Future capacity protection

Continuity gets only a small score bonus.

Default continuity bonus:

```text
Consecutive same-organizer transition = +10
```

Make this configurable.

---

# 9. Initial Day Popularity Ranking

Use the following default ranking:

| Rank | Date | Initial Reason |
|---:|---|---|
| 1 | 17 Oct | Saturday / expected highest rush |
| 2 | 18 Oct | Sunday |
| 3 | 19 Oct | Monday / next-day public holiday effect |
| 4 | 11 Oct | Sunday |
| 5 | 13 Oct | Expected industrial-week demand effect |
| 6 | 20 Oct | Last day of Navrat |
| 7 | 14 Oct | Industrial-week holiday effect |
| 8 | 16 Oct | Higher expected Friday demand |
| 9 | 15 Oct | Mid-Navrat demand |
| 10 | 12 Oct | Expected lower initial demand |

Do not depend on this weekday text remaining correct for every year. The ranking is business input; weekday is dynamically calculated from the selected year.

Allow the team to manually change ranking.

---

# 10. Initial Base Scores

Convert initial day rank to configurable Base Score.

Default:

```text
Rank 1  = 100
Rank 2  = 95
Rank 3  = 90
Rank 4  = 85
Rank 5  = 80
Rank 6  = 75
Rank 7  = 70
Rank 8  = 60
Rank 9  = 50
Rank 10 = 30
```

Do not hardcode these in the UI.

Store them in `constants.js` / settings and allow editing.

---

# 11. Dynamic Day Score

The initial rank is only the starting point.

As new tickets are created, day scores must change dynamically.

Default formula:

```text
Dynamic Day Score =
    40% Base Popularity Score
  + 35% Current Utilization Score
  + 15% Booking Velocity Score
  + 10% Recent Demand Trend Score
```

All weights must be configurable.

Normalize every component to 0–100.

After every new booking or ticket simulation event:

1. Recalculate capacity
2. Recalculate utilization
3. Recalculate booking velocity
4. Recalculate demand trend
5. Recalculate demand pressure
6. Recalculate dynamic day score
7. Recalculate organizer/day score
8. Update rankings
9. Update dashboard

---

# 12. Date Utilization

For each date:

```text
Total Daily Capacity =
Sum of all organizer capacities for that date
```

Default:

```text
120 + 120 + 80 + 80 = 400
```

Then:

```text
Utilization % =
Total Booked For Date / Total Daily Capacity × 100
```

Example:

```text
320 / 400 = 80%
```

---

# 13. Organizer + Date Utilization

Also calculate utilization at the organizer/day level.

Example:

```text
Rasvlila + 17 Oct
Capacity = 120
Booked = 105
Available = 15
Utilization = 87.5%
```

This is more important for inventory allocation than date-only utilization.

---

# 14. Booking Velocity

Track booking timestamps.

Calculate:

- bookings in the last 1 hour
- bookings in the last 3 hours
- bookings in the last 6 hours
- bookings today

Provide a normalized booking velocity score from 0–100.

The simulation system must support artificial booking timestamps so historical scenarios can be simulated.

Example:

```text
12 Oct = 100 bookings in 2 hours
15 Oct = 100 bookings in 10 hours
```

12 Oct should have significantly higher booking velocity.

---

# 15. Recent Demand Trend

Compare recent demand against an earlier period.

Example:

```text
Previous period = 50 bookings
Current period  = 100 bookings
```

Trend must increase.

If demand is declining, trend score should decrease.

Normalize to 0–100.

---

# 16. Demand Pressure

For organizer/day:

```text
Demand Pressure = Pending Demand / Remaining Capacity
```

Example:

```text
Pending Demand = 100
Remaining Capacity = 20
Demand Pressure = 5.0
```

Default levels:

```text
< 0.50       Very Low
0.50–1.00    Low
1.00–1.50    Medium
1.50–2.50    High
> 2.50       Critical
```

Make thresholds configurable.

---

# 17. Organizer + Day Dynamic Score

Do NOT calculate only a whole-date score.

Calculate a score for each organizer/day pair.

Example:

```text
17 Oct

Rasvlila      → 94
MGM           → 86
Navrat        → 70
Acrolawns     → 62
```

This allows the system to understand that a date may be very popular while specific organizer inventory is more or less constrained.

The organizer/day score should incorporate:

- Organizer initial rank
- Day base score
- Utilization
- Booking velocity
- Demand pressure
- Current booking trend

Keep the formula configurable.

---

# 18. Customer Preference Model

Each customer can rank preferred dates for each organizer.

Example:

```text
Rasvlila
1. 17 Oct
2. 18 Oct
3. 19 Oct
4. 20 Oct
5. 16 Oct
...

MGM
1. 18 Oct
2. 17 Oct
3. 19 Oct
...
```

Preferences must support:

- Drag/drop ranking
- Up/down controls as fallback
- Ranking display
- Preference score

Default preference score:

```text
#1  = 100
#2  = 90
#3  = 80
#4  = 70
#5  = 60
#6  = 50
#7  = 40
#8  = 30
#9  = 20
#10 = 10
```

Make this configurable.

---

# 19. Customer Satisfaction Model

The application must calculate satisfaction for every customer allocation.

Recommended prototype weighting:

```text
User Preference             60%
Fairness                    15%
Future Capacity Protection  15%
Continuity                    5%
FIFO                          5%
--------------------------------
TOTAL                       100%
```

Make every weight configurable.

Final satisfaction must be normalized to 0–100.

Categories:

```text
90–100 = Excellent
80–89  = Very Good
70–79  = Good
60–69  = Acceptable
50–59  = Low
< 50   = Poor
```

---

# 20. Global Satisfaction Principle

Do NOT optimize only for the current customer.

The system must consider:

```text
Current User Satisfaction
+
Effect on Remaining Users
+
Remaining Capacity
+
Demand Pressure
+
Fairness
```

Core product principle:

> **Maximize total customer satisfaction, not individual customer satisfaction.**

---

# 21. Opportunity Cost / Future Protection

Every premium slot has opportunity cost.

Example:

```text
Rasvlila + 18 Oct
Remaining capacity = 5
Pending demand = 50
```

This slot has high opportunity cost.

The system should protect it unless allocating it to the current customer creates a significantly better overall outcome.

Calculate a Future Protection Score from 0–100.

The score should increase when:

- capacity is low
- demand is high
- multiple future customers prefer the slot
- demand pressure is critical

---

# 22. Fairness

Fairness must prevent a small number of users from consuming all premium inventory.

Track per customer:

- premium days received
- high-demand days received
- total preference score
- allocation score
- number of top-3 preferences received

Create a fairness score from 0–100.

A customer who consistently consumes scarce premium slots should receive lower marginal fairness value for additional premium allocations.

Do not use a permanent hard cap unless configured.

Prefer dynamic fairness.

---

# 23. Low Satisfaction Protection

Do not optimize only the average.

Also protect minimum satisfaction.

Track:

- average satisfaction
- median satisfaction
- minimum satisfaction
- P10
- P25
- P50
- P75
- P90
- low satisfaction users %

The optimizer should prefer allocations that avoid extremely low customer satisfaction when total satisfaction is similar.

Example:

```text
Option A
A = 100
B = 95
C = 20
Total = 215

Option B
A = 85
B = 80
C = 75
Total = 240
```

Option B is better.

---

# 24. FIFO

FIFO is required but should not dominate the entire optimization.

Store:

```text
bookingId
customerId
createdAt
sequenceNumber
```

FIFO is the final tie-breaker when candidate allocations have effectively equivalent global value.

Example:

```text
User A booking time = 10:01
User B booking time = 10:05
```

If both have equivalent allocation quality, User A wins.

Do NOT allow FIFO to override a significantly better global allocation for the customer population.

Provide a configurable FIFO tolerance.

---

# 25. Allocation Priority Hierarchy

Implement this conceptual priority:

```text
1. HARD CONSTRAINTS
2. TOTAL CUSTOMER SATISFACTION
3. LOW-SATISFACTION PROTECTION
4. FUTURE INVENTORY PROTECTION
5. FAIRNESS
6. USER PREFERENCE
7. CONTINUITY
8. FIFO TIE-BREAKER
```

The exact weighted scoring may combine these factors, but hard constraints must always be absolute.

---

# 26. Candidate Allocation Generation

For every customer, the allocator should generate valid possible schedules.

Every candidate must satisfy:

```text
10 unique dates
3 Rasvlila
3 MGM
2 Navrat
2 Acrolawns
1 organizer/date
Capacity available
```

Generate possible combinations intelligently; avoid unnecessary brute force explosion.

For the prototype, pruning is acceptable.

Prioritize candidates based on user preferences and available capacity before deeper scoring.

---

# 27. Candidate Evaluation

Create a function:

```javascript
 evaluateAllocation(candidate, context)
```

Return:

```javascript
{
  valid,
  userPreferenceScore,
  fairnessScore,
  futureProtectionScore,
  continuityScore,
  fifoScore,
  globalScore,
  reasons,
  penalties,
  breakdown
}
```

Every final allocation must have an explanation.

---

# 28. Explainable Allocation

Every allocation must be explainable in plain language.

Example:

```text
WHY THIS ALLOCATION?

✓ 8/10 selections matched top preferences
✓ Organizer quota satisfied
✓ 10 unique dates
✓ No duplicate organizer on a date
✓ 17 Oct Rasvlila matched customer's #1 preference
✓ 18 Oct Rasvlila was protected because demand pressure was critical
✓ MGM on 18 Oct produced a better global result
✓ Continuity preference was considered
✓ FIFO was respected as tie-breaker
```

Create an explanation drawer/modal.

---

# 29. Customer Simulator Page

Create a professional booking simulation screen.

Fields:

```text
Customer Name
Customer ID
Booking Timestamp
```

Show all 10 season dates as cards in a grid.

Each card must show:

```text
Date
Weekday
Dynamic Day Score
Demand Level
Utilization
```

Then allow exactly one organizer selection:

```text
○ Rasvlila
○ MGM
○ Navrat
○ Acrolawns
```

Do not allow two organizers on the same date.

---

# 30. Customer Selection Summary

Create a sticky summary panel:

```text
FLEX PASS SUMMARY

Dates Selected       7 / 10

Rasvlila             2 / 3
MGM                  2 / 3
Navrat               2 / 2
Acrolawns            1 / 2

Current Satisfaction 82 / 100

Status: Incomplete
```

When valid:

```text
Dates Selected       10 / 10

Rasvlila             3 / 3 ✓
MGM                  3 / 3 ✓
Navrat               2 / 2 ✓
Acrolawns            2 / 2 ✓

Satisfaction         91 / 100

Status: READY
```

---

# 31. Dashboard Requirements

Create a professional operations dashboard.

Top KPI cards:

```text
Total Customers
Tickets Allocated
Total Capacity
Used Capacity
Remaining Capacity
Average Satisfaction
Minimum Satisfaction
Low Satisfaction %
Fairness Index
```

Add a Season Health card.

Add a Dynamic Day Ranking table.

Add an Organizer × Date Demand Heatmap.

Add Recent Activity.

Add Satisfaction Distribution.

---

# 32. Organizer UI

Do not use a plain CRUD table only.

Show organizer cards with:

```text
Rank
Name
Tickets/Day
Required days/user
Season capacity
Booked
Available
Utilization
Dynamic demand summary
```

Actions:

```text
Edit
View Demand
View Allocation
```

---

# 33. Season Days UI

Create a powerful table with:

```text
Rank
Date
Weekday
Base Score
Dynamic Score
Total Capacity
Booked
Available
Utilization
Velocity
Trend
Pressure
Status
```

Dynamic Score should be visually prominent.

Allow sorting by any major metric.

---

# 34. Organizer × Date Heatmap

Create a visual grid:

```text
                    11 12 13 14 15 16 17 18 19 20
Rasvlila            □  □  □  □  □  □  □  □  □  □
MGM                 □  □  □  □  □  □  □  □  □  □
Navrat              □  □  □  □  □  □  □  □  □  □
Acrolawns           □  □  □  □  □  □  □  □  □  □
```

Each cell should display:

```text
Utilization %
Booked / Capacity
Dynamic Score
```

Color thresholds:

```text
0–40%      Green
41–70%     Blue
71–85%     Yellow
86–95%     Orange
96–100%    Red
```

Use real colored cells, not emoji.

Hover/click must show detailed information.

---

# 35. Satisfaction Dashboard

Show:

```text
Average Satisfaction
Median Satisfaction
Minimum Satisfaction
Maximum Satisfaction
P10
P25
P75
P90
```

Also show components:

```text
User Preference
Fairness
Future Protection
Continuity
FIFO
```

Create a visual leaderboard.

---

# 36. Satisfaction Distribution

Use HTML/SVG/Canvas to show a distribution chart.

Show categories:

```text
Excellent
Very Good
Good
Acceptable
Low
Poor
```

Display both number and percentage.

---

# 37. Allocation Result

After an allocation, display a 10-day timeline:

```text
11 Oct    Acrolawns
12 Oct    Acrolawns
13 Oct    Navrat
14 Oct    Navrat
15 Oct    MGM
16 Oct    MGM
17 Oct    Rasvlila
18 Oct    MGM
19 Oct    Rasvlila
20 Oct    Rasvlila
```

Each row should show:

- preference rank
- capacity state
- demand pressure
- score contribution
- reason

---

# 38. Live Monitor

Create a live operations screen with:

```text
Current bookings
Current capacity
Critical organizer/day slots
Top demand days
Satisfaction trend
Fairness trend
```

Use a live activity feed:

```text
18:24:03
Customer #72 allocated — Satisfaction 91

18:24:02
Rasvlila / 17 Oct reached 95%

18:24:02
Dynamic score recalculated 96 → 98
```

Use simulated browser time when running simulations.

---

# 39. Simulation Engine

Create a Simulation page.

Controls:

```text
Number of users
100 / 250 / 400 / Custom

Scenario
Popular-Day Bias
Balanced
Random
Organizer-Preference Bias
Continuous-Day Bias
Sudden Demand Shift

Algorithm
Preference Heavy
FIFO Heavy
Balanced Satisfaction
Global Satisfaction

Speed
Slow / Normal / Fast
```

Buttons:

```text
Start
Pause
Resume
Reset
Step One User
```

---

# 40. Simulation Scenarios

Provide these default scenarios.

## Scenario A — Everyone wants 17 Oct

```text
80% users rank 17 Oct in top preference
```

Expected result:

- 17 Oct demand rapidly increases
- dynamic score rises
- premium inventory becomes protected
- customers are distributed across organizers/days

## Scenario B — 12 Oct becomes unexpectedly popular

Initially 12 Oct has low score.

Then generate high booking velocity.

Expected result:

```text
12 Oct Dynamic Score increases
```

## Scenario C — Rasvlila overload

Generate high demand for Rasvlila.

Expected result:

- Rasvlila-specific capacity becomes critical
- alternative organizers/dates are considered
- global satisfaction is protected

## Scenario D — Continuous-day preference

Many customers prefer:

```text
17, 18, 19 Rasvlila
```

Expected result:

- continuity is recognized
- continuity does not blindly consume all scarce inventory
- global satisfaction remains the priority

## Scenario E — FIFO competition

Many users request the same organizer/day.

When all other factors are equivalent:

```text
earlier booking wins
```

---

# 41. Scenario Comparison

Create a comparison page.

Run identical user scenarios through different algorithms.

Compare:

```text
Average Satisfaction
Median Satisfaction
Minimum Satisfaction
Low Satisfaction %
Fairness Index
Capacity Utilization
Premium Slot Usage
Preference Match
Continuity
FIFO Conflicts
```

Example table:

| Metric | Preference Heavy | FIFO Heavy | Balanced | Global Satisfaction |
|---|---:|---:|---:|---:|
| Avg Satisfaction | 86 | 81 | 89 | 91 |
| Minimum | 42 | 38 | 67 | 72 |
| Low Satisfaction % | 14% | 18% | 4% | 2% |
| Fairness | 69 | 62 | 91 | 94 |

Numbers are illustrative only; calculate real values from simulations.

---

# 42. Settings UI

Create a professional scoring settings page.

## Satisfaction Weights

```text
User Preference Weight
Fairness Weight
Future Protection Weight
Continuity Weight
FIFO Weight
```

## Dynamic Day Score Weights

```text
Base Popularity Weight
Utilization Weight
Booking Velocity Weight
Trend Weight
```

## Thresholds

```text
Low Demand
High Demand
Critical Demand
Low Satisfaction
FIFO Tolerance
Continuity Bonus
```

Show a warning if weights do not sum to 100%.

---

# 43. Data Management

Use localStorage only.

Suggested keys:

```text
flex_organizers
flex_season_config
flex_dates
flex_user_preferences
flex_customers
flex_tickets
flex_allocations
flex_day_scores
flex_organizer_day_scores
flex_satisfaction_results
flex_simulation_config
flex_settings
flex_logs
```

Create storage functions:

```javascript
save(key, value)
load(key, fallback)
remove(key)
clearAll()
exportData()
importData()
```

---

# 44. Import / Export

Provide:

```text
Export JSON
Import JSON
Reset Demo Data
Clear All Data
```

Export the complete state of the simulator.

Import must validate the JSON structure before replacing data.

Do not silently corrupt existing data.

---

# 45. Demo Data

On first load automatically create:

- 4 organizers
- 10 season days
- initial day ranking
- base scores
- 10 sample customers
- sample ticket records
- sample dynamic score data
- sample satisfaction data

Do not generate unrealistic values that violate the rules.

Provide:

```text
Reset to Demo
```

---

# 46. Professional UI / UX Requirements

The interface must feel like a real SaaS internal product.

Design direction:

```text
Professional
Modern
Clean
Premium
Data-heavy
Easy to scan
Desktop-first
Responsive
```

Use a dashboard layout with:

```text
Sidebar
Top Header
Main Content
Cards
Tables
Heatmaps
Charts
Drawers
Modals
Toasts
```

Use system fonts or a local font stack.

Recommended:

```css
font-family:
Inter,
ui-sans-serif,
system-ui,
-apple-system,
BlinkMacSystemFont,
"Segoe UI",
sans-serif;
```

---

# 47. Color System

Use restrained professional colors.

Suggested semantic palette:

```text
Primary      = dark navy / blue
Success      = green
Info         = blue
Warning      = yellow/orange
Danger       = red
Neutral      = gray
Background   = light gray
Surface      = white
```

Do not use excessive gradients.

Do not use random colors for unrelated concepts.

All colors should have semantic meaning.

---

# 48. Dashboard Visual Hierarchy

The most important visual hierarchy is:

```text
1. Customer Satisfaction
2. Capacity / Availability
3. Demand Pressure
4. Dynamic Score
5. Allocation
6. Secondary Metadata
```

A user should understand current season health within 5 seconds.

The dashboard should immediately answer:

- How many customers?
- How much capacity is used?
- Which dates are hot?
- Which organizer/day combinations are critical?
- What is average satisfaction?
- What is minimum satisfaction?
- Is allocation fair?

---

# 49. UI Components

Create reusable components in vanilla JS:

```javascript
renderCard()
renderMetricCard()
renderTable()
renderBadge()
renderProgressBar()
renderHeatmap()
renderModal()
renderDrawer()
showToast()
renderEmptyState()
renderPagination()
```

Do not duplicate large HTML blocks unnecessarily.

---

# 50. Responsive Design

Desktop:

```text
Fixed sidebar + main content
```

Tablet:

```text
Collapsible sidebar
```

Mobile:

```text
Top navigation
Horizontal table scroll
Stacked cards
```

The dashboard is desktop-first but must remain usable on tablets and mobile.

---

# 51. Tables

All important tables should support:

- sticky header
- hover state
- compact rows
- status badges
- sorting
- search
- filters
- responsive horizontal scrolling

Avoid over-styling every cell.

---

# 52. Modals

Do not use browser `alert()` or `confirm()` for normal operations.

Build custom modals for:

- Add Organizer
- Edit Organizer
- Add Customer
- Create Ticket
- Delete Organizer
- Reset Simulation
- Import Data
- Scoring Settings
- Allocation Explanation

---

# 53. Toast Notifications

Use custom toasts:

```text
✓ Ticket created
✓ Allocation completed
✓ Scores recalculated
⚠ Capacity almost full
⚠ High demand detected
✕ Allocation failed
```

Place in bottom-right.

---

# 54. Empty States

Every major page must have a useful empty state.

Example:

```text
No customers yet

Create your first Flex Season Pass customer
or run a simulation.

[ Create Customer ] [ Run Simulation ]
```

Never leave an empty blank area.

---

# 55. Accessibility

Implement:

- keyboard-friendly buttons
- visible focus states
- readable contrast
- labels for inputs
- semantic HTML where practical
- tooltips for unfamiliar analytics
- non-color-only status indication when possible

Do not depend only on red/green color.

---

# 56. Error Handling

Validate every important operation.

Examples:

```text
Cannot allocate:
Rasvlila requires 3 days but only 2 valid days remain.
```

```text
Cannot select 17 Oct:
Another organizer is already selected for this customer/date.
```

```text
Cannot save scoring rules:
Weights must total 100%.
```

Show clear error messages.

---

# 57. Performance

The prototype must comfortably simulate at least:

```text
10 users
100 users
250 users
400 users
```

Avoid expensive full-DOM redraws when a small component update is sufficient.

During large simulations:

- batch UI updates
- use progress indicators
- avoid rendering thousands of unnecessary nodes simultaneously

---

# 58. Core JavaScript Functions

Create these functions or equivalent:

```javascript
calculateSeasonDates()
calculateDailyCapacity()
calculateTotalCapacity()
calculateDateUtilization()
calculateOrganizerDayUtilization()
calculateBookingVelocity()
calculateDemandTrend()
calculateDemandPressure()
calculateDynamicDayScore()
calculateOrganizerDayScore()
calculatePreferenceScore()
calculateFairnessScore()
calculateFutureProtectionScore()
calculateContinuityScore()
calculateFifoScore()
calculateCustomerSatisfaction()
generateValidAllocations()
evaluateAllocation()
selectBestAllocation()
allocateCustomer()
recalculateAllScores()
runSimulation()
compareAlgorithms()
explainAllocation()
```

Keep these functions independent of UI rendering.

---

# 59. Algorithm Output Structure

For every customer allocation, save a structured result similar to:

```javascript
{
  customerId,
  bookingId,
  allocationId,
  selectedDays: [
    {
      date,
      organizerId,
      organizerName,
      preferenceRank,
      preferenceScore,
      organizerDayScore,
      demandPressure,
      utilization,
      continuityBonus,
      reason
    }
  ],
  satisfaction: {
    finalScore,
    userPreferenceScore,
    fairnessScore,
    futureProtectionScore,
    continuityScore,
    fifoScore
  },
  validation: {
    valid,
    uniqueDates,
    organizerQuotaValid,
    capacityValid
  },
  createdAt
}
```

---

# 60. Allocation Explanation Example

Generate a human-readable explanation like:

```text
Customer Satisfaction: 91/100

Preference Match: 94
You received 8 of your top-ranked organizer/day choices.

Fairness: 88
Your allocation did not consume an excessive share of premium inventory.

Future Protection: 90
The system avoided consuming a critical slot that had high demand from other users.

Continuity: 80
The system preserved a 3-day Rasvlila sequence where capacity allowed.

FIFO: 100
Your booking time was first among equivalent allocation candidates.
```

---

# 61. Algorithm Modes

Create several selectable algorithms for testing.

## Mode 1 — Preference Heavy

Prioritize the current customer's preference.

## Mode 2 — FIFO Heavy

Prioritize booking order after hard rules.

## Mode 3 — Balanced Satisfaction

Use the recommended weighted model.

## Mode 4 — Global Satisfaction

Strongly optimize total satisfaction and future customer impact.

## Mode 5 — Fairness Heavy

Protect low-satisfaction users and distribute premium inventory more evenly.

Make the formulas configurable.

---

# 62. Algorithm Comparison

Run the same generated customers against multiple algorithms and show:

```text
Average Satisfaction
Median Satisfaction
Minimum Satisfaction
P10
Low Satisfaction %
Fairness Index
Capacity Utilization
Premium Inventory Usage
Top Preference Match %
Continuity Rate
FIFO Conflicts
```

Highlight the best overall algorithm.

---

# 63. Recommended Final Allocation Decision Flow

Implement this logical flow:

```text
USER REQUEST
     ↓
LOAD CURRENT INVENTORY
     ↓
LOAD CURRENT DEMAND SCORES
     ↓
GENERATE VALID CANDIDATES
     ↓
REMOVE HARD-CONSTRAINT VIOLATIONS
     ↓
CALCULATE USER PREFERENCE SCORE
     ↓
CALCULATE GLOBAL/FUTURE IMPACT
     ↓
CALCULATE FAIRNESS
     ↓
CALCULATE CONTINUITY
     ↓
CALCULATE FIFO
     ↓
CALCULATE GLOBAL SCORE
     ↓
SORT CANDIDATES
     ↓
APPLY FIFO IF SCORES ARE EFFECTIVELY EQUAL
     ↓
SELECT BEST VALID CANDIDATE
     ↓
UPDATE INVENTORY
     ↓
RECALCULATE DEMAND
     ↓
RECALCULATE SCORES
     ↓
UPDATE SATISFACTION RANKING
```

---

# 64. Important Clarification on FIFO

FIFO must NOT mean:

> “The first customer gets all the best days.”

FIFO means:

> “When customers have effectively equivalent allocation opportunities, the earlier eligible booking receives priority.”

This must be clear throughout the application.

---

# 65. Important Clarification on Continuity

Continuity must NOT mean:

> “Always give the user 17,18,19 with the same organizer.”

Continuity means:

> “When two allocations have similar global value, prefer the one that provides useful consecutive same-organizer days.”

---

# 66. Best Satisfaction Definition

Use this exact product definition in the UI/help text:

> **Best Satisfaction = the highest practical overall satisfaction across the customer population while respecting inventory, organizer quotas, one-organizer-per-date rules, fairness, demand pressure, and FIFO.**

---

# 67. Important Testing Scenarios

The application must test at least:

### Low demand

Only a small number of users.

Expected:

- most customers receive top preferences
- continuity is commonly possible

### Medium demand

About 50–70% of total theoretical capacity.

Expected:

- some conflicts
- dynamic ranking starts to matter

### High demand

80–95% of theoretical capacity.

Expected:

- strong demand pressure
- premium slots become protected
- global fairness becomes important

### Full demand

Near 400 complete passes.

Expected:

- inventory reaches limits
- allocations need strong optimization
- low-satisfaction customers should be minimized

---

# 68. Test Example — 17 October

Simulate many users who strongly prefer:

```text
17 Oct + Rasvlila
```

The system should demonstrate:

1. Rasvlila/17 capacity increases
2. Utilization increases
3. Demand pressure increases
4. Organizer/day score increases
5. Alternative dates become more attractive
6. Future protection score increases
7. Some users get alternative schedules
8. Average satisfaction remains as high as possible

---

# 69. Test Example — 12 October Overtakes 15 October

Initially:

```text
12 Oct Base Score = 30
15 Oct Base Score = 50
```

Then simulate very high booking activity on 12 Oct.

Expected:

```text
12 Oct Dynamic Score increases dramatically
```

It may eventually rank above 15 Oct.

This proves that the system is dynamic rather than static.

---

# 70. Test Example — Same Organizer Continuity

A customer requests:

```text
17 Rasvlila
18 Rasvlila
19 Rasvlila
```

If inventory is healthy:

```text
3-day continuity should be favored.
```

If 18 Oct Rasvlila is critically oversubscribed:

```text
17 Rasvlila
18 MGM
19 Rasvlila
```

may be better globally.

The UI must explain why.

---

# 71. Test Example — Equal Candidates / FIFO

Two customers have nearly identical allocation scores.

```text
Customer A booking = 10:01
Customer B booking = 10:05
```

A should win the contested equivalent slot.

Log:

```text
FIFO tie-breaker applied.
```

---

# 72. Dashboard Target Metrics

At a glance show:

```text
Average Satisfaction
Minimum Satisfaction
Low Satisfaction %
Top Preference Match %
Fairness Index
Capacity Utilization
Premium Inventory Utilization
```

The system should not report “success” just because average satisfaction is high.

Minimum satisfaction and fairness are also critical.

---

# 73. Professional UI Details

Use:

- subtle borders
- rounded cards
- professional spacing
- compact data tables
- sticky headers
- clear badge colors
- skeleton/loading states if needed
- empty states
- hover states
- active states
- disabled states
- responsive drawers
- confirmation dialogs

Avoid:

- excessive rounded shapes
- giant gradients
- cartoon icons
- random bright colors
- overcrowded screens
- giant empty areas
- browser default alerts

---

# 74. Navigation Pages

Final navigation must include:

```text
Dashboard
Live Monitor
Organizers
Season Days
Day Ranking
Customer Preferences
Customers
Tickets
Dynamic Demand
Satisfaction
Allocations
Allocation Analysis
Run Simulation
Scenario Comparison
Scoring Rules
Settings
Data Management
```

---

# 75. Final Acceptance Criteria

The application is complete only when ALL of the following work:

- Add/edit/delete organizers
- Change organizer capacity
- Change required days per user
- Configure season dates
- Configure initial day ranking
- Configure base score
- Create customers
- Create customer preferences
- Create tickets
- One organizer per date is enforced
- Duplicate dates are prevented
- 3/3/2/2 quotas are enforced
- Capacity cannot be exceeded
- Consecutive same-organizer days are allowed
- Continuity is a soft preference
- FIFO is implemented as a tie-breaker
- Demand dynamically changes with bookings
- Organizer/day scores dynamically change
- Customer satisfaction updates dynamically
- Global satisfaction is calculated
- Fairness is calculated
- Future protection is calculated
- Demand pressure is visible
- Allocation explanation works
- Satisfaction ranking works
- Dashboard updates after every event
- Simulation supports 10 users
- Simulation supports 100 users
- Simulation supports 250 users
- Simulation supports 400 users
- Algorithm comparison works
- Export JSON works
- Import JSON works
- Reset demo works
- localStorage persistence works
- No backend is required
- No external database is required
- No unfinished buttons
- No fake placeholder analytics

---

# 76. Final Development Instruction

Build the entire application now.

Do not stop at wireframes.

Do not generate only static HTML.

All major interactions must work.

All calculations must be real.

All dashboard values must come from the simulator data.

All buttons must perform actual actions.

All scores must recalculate when relevant data changes.

The code must be clean and modular.

Use comments only where they add meaningful explanation.

Do not use fake production APIs.

Do not add a backend.

Do not add unnecessary dependencies.

The final application should look and behave like a **professional Smart Allocation Control Center** suitable for product-team algorithm testing.

Before finishing, test the simulator with:

```text
10 users
100 users
250 users
400 users
```

Also test:

```text
Everyone wants 17 Oct
12 Oct unexpectedly becomes highly popular
Rasvlila becomes overloaded
Continuous-day preference
FIFO tie-breaker
Low-demand scenario
High-demand scenario
Near-full-capacity scenario
```

Fix all validation, calculation, and UI issues found during testing.

Create/update `README.md` with:

- how to run
- architecture
- data model
- scoring formulas
- business rules
- simulation instructions
- algorithm modes
- known prototype limitations

Final goal:

> **Provide a realistic, explainable, visually professional browser simulator that allows the team to determine which Flex Season Pass allocation algorithm produces the highest overall customer satisfaction while maintaining fairness and inventory protection.**
