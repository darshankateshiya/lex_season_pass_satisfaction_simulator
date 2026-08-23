/* Headless engine tests. Not part of the browser app. */
var fs = require("fs");
var path = require("path");
var vm = require("vm");

var store = {};
var sandbox = {
  console: console,
  Date: Date,
  Math: Math,
  JSON: JSON,
  Number: Number,
  String: String,
  Object: Object,
  Array: Array,
  parseInt: parseInt,
  isNaN: isNaN,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  localStorage: {
    setItem: function (k, v) { store[k] = String(v); },
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    removeItem: function (k) { delete store[k]; }
  }
};
sandbox.window = sandbox;
sandbox.global = sandbox;

function load(rel) {
  var file = path.join(__dirname, "..", rel);
  vm.runInNewContext(fs.readFileSync(file, "utf8"), sandbox, { filename: rel });
}

[
  "js/constants.js",
  "js/utils.js",
  "js/storage.js",
  "js/demand.js",
  "js/scoring.js",
  "js/satisfaction.js",
  "js/allocation.js",
  "js/simulation.js",
  "js/data.js"
].forEach(load);

var Flex = sandbox.Flex;
var failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error("FAIL", msg);
  } else {
    console.log("OK  ", msg);
  }
}

function uniqueDates(alloc) {
  var seen = {};
  alloc.selectedDays.forEach(function (d) { seen[d.date] = (seen[d.date] || 0) + 1; });
  return Object.keys(seen).every(function (k) { return seen[k] === 1; }) && alloc.selectedDays.length === 10;
}

function quotaOk(alloc, organizers) {
  return organizers.every(function (org) {
    return Flex.data.quotaOk(alloc.selectedDays.filter(function (d) { return d.organizerId === org.id; }).length, org);
  });
}

function runScenario(label, count, scenario, algorithm, seed) {
  var t0 = Date.now();
  var state = Flex.data.buildFreshState();
  Flex.simulation.prepare({
    userCount: count,
    scenario: scenario,
    algorithm: algorithm,
    speed: "fast",
    seed: seed || 20261017
  }, state);
  var failures = 0;
  while (state.simulationConfig.processed < state.simulationConfig.queue.length) {
    var step = Flex.simulation.stepOne(state);
    if (step.result && !step.result.ok) failures += 1;
  }
  var snap = Flex.simulation.snapshot(state);
  var ms = Date.now() - t0;
  console.log("\n== " + label + " (" + ms + "ms) ==");
  console.log(JSON.stringify({
    allocated: snap.allocated,
    failed: failures,
    avg: snap.averageSatisfaction,
    min: snap.minimumSatisfaction,
    low: snap.lowSatisfactionPct,
    fairness: snap.fairnessIndex,
    util: snap.capacityUtilization,
    pref: snap.preferenceMatch
  }));
  assert(snap.allocated + failures === count, label + ": processed all users");
  state.allocations.forEach(function (a, i) {
    if (!uniqueDates(a) || !quotaOk(a, state.organizers)) {
      failed += 1;
      console.error("FAIL invalid allocation", i, a.customerId);
    }
  });
  var cap = Flex.demand.emptyInventory(state.organizers, state.dates);
  Flex.demand.applyAllocations(cap, state.allocations);
  var over = false;
  state.organizers.forEach(function (org) {
    state.dates.forEach(function (d) {
      if (cap[org.id][d.date] < 0) over = true;
    });
  });
  assert(!over, label + ": no capacity overflow");
  return { state: state, snap: snap, failures: failures };
}

var demo = Flex.data.seedDemo();
assert(demo.organizers.length === 4, "demo organizers");
assert(demo.dates.length === 10, "demo dates");
assert(demo.customers.length === 10, "demo customers");
assert(demo.allocations.length === 6, "demo allocated 6 customers");
assert(demo.dates.every(function (d) { return d.date.indexOf("2026-10-") === 0; }), "2026 dates");

var weekday = Flex.utils.weekdayName("2026-10-17");
assert(weekday === "Saturday", "17 Oct 2026 is Saturday, computed dynamically");
assert(demo.organizers.every(function (o) { return Flex.data.maxDays(o) >= o.requiredDays; }), "organizers have max days");
var overMax = Flex.allocation.validateHardConstraints([
  { date: "2026-10-11", organizerId: "org_rasvlila", organizerName: "Rasvlila Navrati" },
  { date: "2026-10-12", organizerId: "org_rasvlila", organizerName: "Rasvlila Navrati" },
  { date: "2026-10-13", organizerId: "org_rasvlila", organizerName: "Rasvlila Navrati" },
  { date: "2026-10-14", organizerId: "org_rasvlila", organizerName: "Rasvlila Navrati" },
  { date: "2026-10-15", organizerId: "org_mgm", organizerName: "MGM CULTURA" },
  { date: "2026-10-16", organizerId: "org_mgm", organizerName: "MGM CULTURA" },
  { date: "2026-10-17", organizerId: "org_mgm", organizerName: "MGM CULTURA" },
  { date: "2026-10-18", organizerId: "org_navrat", organizerName: "Navrat" },
  { date: "2026-10-19", organizerId: "org_navrat", organizerName: "Navrat" },
  { date: "2026-10-20", organizerId: "org_acrolawns", organizerName: "Acrolawns Navrati" }
], demo, Flex.demand.buildInventory(demo));
assert(!overMax.valid && overMax.penalties.some(function (p) { return p.indexOf("at most") !== -1; }), "max days per organizer is a hard constraint");

runScenario("10 users balanced", 10, "balanced_pref", "balanced", 11);
runScenario("10 users everyone wants 17 Oct", 10, "popular_day_bias", "global", 17);
runScenario("10 users sudden 12 Oct shift", 10, "sudden_shift", "balanced", 12);
runScenario("10 users Rasvlila overload", 10, "organizer_bias", "global", 3);
runScenario("10 users continuity", 10, "continuous_bias", "balanced", 19);
runScenario("10 users FIFO heavy", 10, "popular_day_bias", "fifo_heavy", 21);

var a100 = runScenario("100 users high demand", 100, "popular_day_bias", "global", 100);
assert(a100.snap.allocated >= 90, "100-user run allocated most customers");

var a250 = runScenario("250 users high demand", 250, "balanced_pref", "balanced", 250);
assert(a250.snap.allocated >= 200, "250-user run allocated most customers");

var a400 = runScenario("400 users near-full", 400, "balanced_pref", "global", 400);
assert(a400.snap.allocated >= 300, "400-user run allocated a large population");

var oct12 = a100.state.dayScores["2026-10-12"];
var sudden = runScenario("12 Oct velocity vs static rank", 40, "sudden_shift", "balanced", 120);
var s12 = sudden.state.dayScores["2026-10-12"];
var s15 = sudden.state.dayScores["2026-10-15"];
assert(s12.dynamicScore > oct12.dynamicScore || s12.velocity > 20, "12 Oct dynamic score/velocity reacts to demand");
console.log("12 Oct dynamic", s12.dynamicScore, "15 Oct dynamic", s15.dynamicScore, "12 Oct base", Flex.utils.dateByISO(sudden.state.dates, "2026-10-12").baseScore);

var cmp = Flex.simulation.compareAlgorithms(10, "popular_day_bias", ["preference_heavy", "fifo_heavy", "balanced", "global"], 77);
assert(cmp.length === 4, "algorithm comparison returns 4 rows");
cmp.forEach(function (row) {
  assert(row.allocated > 0, "comparison " + row.algorithm + " allocated users");
});

if (failed) {
  console.error("\n" + failed + " assertion(s) failed");
  process.exit(1);
}
console.log("\nAll engine assertions passed.");
