var Flex = window.Flex || {};

Flex.STORAGE_KEYS = {
  organizers: "flex_organizers",
  seasonConfig: "flex_season_config",
  dates: "flex_dates",
  preferences: "flex_user_preferences",
  customers: "flex_customers",
  tickets: "flex_tickets",
  allocations: "flex_allocations",
  dayScores: "flex_day_scores",
  organizerDayScores: "flex_organizer_day_scores",
  satisfactionResults: "flex_satisfaction_results",
  simulationConfig: "flex_simulation_config",
  settings: "flex_settings",
  logs: "flex_logs",
  seeded: "flex_seeded"
};

Flex.DEFAULT_SEASON = {
  name: "Navrat 2026",
  startMonth: 10,
  startDay: 11,
  endMonth: 10,
  endDay: 20,
  year: 2026
};

Flex.DEFAULT_ORGANIZERS = [
  { id: "org_rasvlila", name: "Rasvlila Navrati", rank: 1, ticketsPerDay: 120, requiredDays: 3, maxDays: 3, color: "#c2410c" },
  { id: "org_mgm", name: "MGM CULTURA", rank: 2, ticketsPerDay: 120, requiredDays: 3, maxDays: 3, color: "#1d4ed8" },
  { id: "org_navrat", name: "Navrat", rank: 3, ticketsPerDay: 80, requiredDays: 2, maxDays: 2, color: "#0f766e" },
  { id: "org_acrolawns", name: "Acrolawns Navrati", rank: 4, ticketsPerDay: 80, requiredDays: 2, maxDays: 2, color: "#6d28d9" }
];

Flex.DEFAULT_DAY_RANKING = [
  { month: 10, day: 17, rank: 1, reason: "Saturday / expected highest rush" },
  { month: 10, day: 18, rank: 2, reason: "Sunday" },
  { month: 10, day: 19, rank: 3, reason: "Monday / next-day public holiday effect" },
  { month: 10, day: 11, rank: 4, reason: "Sunday" },
  { month: 10, day: 13, rank: 5, reason: "Expected industrial-week demand effect" },
  { month: 10, day: 20, rank: 6, reason: "Last day of Navrat" },
  { month: 10, day: 14, rank: 7, reason: "Industrial-week holiday effect" },
  { month: 10, day: 16, rank: 8, reason: "Higher expected Friday demand" },
  { month: 10, day: 15, rank: 9, reason: "Mid-Navrat demand" },
  { month: 10, day: 12, rank: 10, reason: "Expected lower initial demand" }
];

Flex.DEFAULT_BASE_SCORES = {
  1: 100,
  2: 95,
  3: 90,
  4: 85,
  5: 80,
  6: 75,
  7: 70,
  8: 60,
  9: 50,
  10: 30
};

Flex.DEFAULT_PREFERENCE_SCORES = {
  1: 100,
  2: 90,
  3: 80,
  4: 70,
  5: 60,
  6: 50,
  7: 40,
  8: 30,
  9: 20,
  10: 10
};

Flex.DEFAULT_SETTINGS = {
  satisfactionWeights: {
    userPreference: 60,
    fairness: 15,
    futureProtection: 15,
    continuity: 5,
    fifo: 5
  },
  dayScoreWeights: {
    basePopularity: 40,
    utilization: 35,
    bookingVelocity: 15,
    trend: 10
  },
  organizerDayWeights: {
    organizerRank: 15,
    dayBase: 20,
    utilization: 25,
    bookingVelocity: 15,
    demandPressure: 15,
    trend: 10
  },
  continuityBonus: 10,
  fifoTolerance: 2,
  lowSatisfactionThreshold: 50,
  demandPressureLevels: {
    veryLow: 0.5,
    low: 1.0,
    medium: 1.5,
    high: 2.5
  },
  heatmapThresholds: {
    green: 40,
    blue: 70,
    yellow: 85,
    orange: 95
  },
  premiumRankCutoff: 3,
  beamWidth: 28,
  maxCandidates: 40,
  velocityWindowsHours: [1, 3, 6, 24],
  trendCurrentHours: 6,
  trendPreviousHours: 6
};

Flex.ALGORITHM_MODES = {
  preference_heavy: {
    id: "preference_heavy",
    name: "Preference Heavy",
    description: "Prioritize the current customer's ranked organizer/day preferences after hard constraints.",
    satisfactionWeights: { userPreference: 80, fairness: 5, futureProtection: 5, continuity: 5, fifo: 5 },
    globalImpactMultiplier: 0.35,
    lowSatProtection: 0.4
  },
  fifo_heavy: {
    id: "fifo_heavy",
    name: "FIFO Heavy",
    description: "Prioritize booking order after hard rules. FIFO is still not a license to take all premium days.",
    satisfactionWeights: { userPreference: 25, fairness: 10, futureProtection: 10, continuity: 5, fifo: 50 },
    globalImpactMultiplier: 0.4,
    lowSatProtection: 0.5
  },
  balanced: {
    id: "balanced",
    name: "Balanced Satisfaction",
    description: "Recommended weighted model: preference, fairness, future protection, continuity, and FIFO.",
    satisfactionWeights: { userPreference: 60, fairness: 15, futureProtection: 15, continuity: 5, fifo: 5 },
    globalImpactMultiplier: 1,
    lowSatProtection: 1
  },
  global: {
    id: "global",
    name: "Global Satisfaction",
    description: "Strongly optimize total population satisfaction and future inventory protection.",
    satisfactionWeights: { userPreference: 35, fairness: 20, futureProtection: 35, continuity: 5, fifo: 5 },
    globalImpactMultiplier: 1.6,
    lowSatProtection: 1.4
  },
  fairness_heavy: {
    id: "fairness_heavy",
    name: "Fairness Heavy",
    description: "Protect low-satisfaction users and distribute premium inventory more evenly.",
    satisfactionWeights: { userPreference: 35, fairness: 40, futureProtection: 15, continuity: 5, fifo: 5 },
    globalImpactMultiplier: 1.1,
    lowSatProtection: 1.8
  }
};

Flex.SATISFACTION_CATEGORIES = [
  { id: "excellent", label: "Excellent", min: 90, max: 100, tone: "success" },
  { id: "very_good", label: "Very Good", min: 80, max: 89, tone: "info" },
  { id: "good", label: "Good", min: 70, max: 79, tone: "primary" },
  { id: "acceptable", label: "Acceptable", min: 60, max: 69, tone: "warning" },
  { id: "low", label: "Low", min: 50, max: 59, tone: "orange" },
  { id: "poor", label: "Poor", min: 0, max: 49, tone: "danger" }
];

Flex.SCENARIOS = {
  popular_day_bias: {
    id: "popular_day_bias",
    name: "Popular-Day Bias",
    description: "80% of users rank 17 Oct in their top preference for the lead organizer."
  },
  balanced_pref: {
    id: "balanced_pref",
    name: "Balanced",
    description: "Preferences are distributed across dates with mild weekend bias."
  },
  random: {
    id: "random",
    name: "Random",
    description: "Preferences are shuffled independently per organizer."
  },
  organizer_bias: {
    id: "organizer_bias",
    name: "Organizer-Preference Bias",
    description: "Rasvlila demand is overloaded; other organizers stay mixed."
  },
  continuous_bias: {
    id: "continuous_bias",
    name: "Continuous-Day Bias",
    description: "Many customers prefer consecutive Rasvlila blocks on 17–19 Oct."
  },
  sudden_shift: {
    id: "sudden_shift",
    name: "Sudden Demand Shift",
    description: "12 Oct starts low, then receives a concentrated booking-velocity spike."
  },
  no_continuous: {
    id: "no_continuous",
    name: "No continuous-day allowed",
    description: "Same organizer cannot be used on adjacent dates. If 17 Oct is Organizer A, 16 Oct and 18 Oct cannot also be Organizer A."
  },
  max_2_continuous: {
    id: "max_2_continuous",
    name: "No 3-day continue",
    description: "Same organizer cannot be used on 3 days in a row. A 2-day block is allowed (17–18 or 16–17). Other days like 14 or 20 are still allowed because they are not attached to that block."
  }
};

Flex.NAV = [
  { id: "dashboard", label: "Dashboard", group: "Overview" },
  { id: "monitor", label: "Live Monitor", group: "Overview" },
  { id: "organizers", label: "Organizers", group: "Inventory" },
  { id: "season", label: "Season Days", group: "Inventory" },
  { id: "ranking", label: "Day Ranking", group: "Inventory" },
  { id: "demand", label: "Dynamic Demand", group: "Inventory" },
  { id: "customers", label: "Customers", group: "Demand" },
  { id: "preferences", label: "Customer Preferences", group: "Demand" },
  { id: "tickets", label: "Tickets", group: "Demand" },
  { id: "allocations", label: "Allocations", group: "Allocation" },
  { id: "analysis", label: "Allocation Analysis", group: "Allocation" },
  { id: "satisfaction", label: "Satisfaction", group: "Allocation" },
  { id: "simulation", label: "Run Simulation", group: "Experiments" },
  { id: "comparison", label: "Scenario Comparison", group: "Experiments" },
  { id: "rules", label: "Scoring Rules", group: "System" },
  { id: "settings", label: "Settings", group: "System" },
  { id: "data", label: "Data Management", group: "System" }
];

Flex.BEST_SATISFACTION_DEFINITION =
  "Best Satisfaction = the highest practical overall satisfaction across the customer population while respecting inventory, organizer quotas, one-organizer-per-date rules, fairness, demand pressure, and FIFO.";

window.Flex = Flex;
