var Flex = window.Flex || {};

Flex.data = {
  _state: null,

  emptyState: function () {
    return {
      organizers: [],
      seasonConfig: Object.assign({}, Flex.DEFAULT_SEASON),
      dates: [],
      preferences: {},
      customers: [],
      tickets: [],
      allocations: [],
      dayScores: {},
      organizerDayScores: {},
      satisfactionResults: [],
      simulationConfig: Flex.simulation.defaultConfig(),
      settings: Flex.utils.deepClone(Flex.DEFAULT_SETTINGS),
      logs: []
    };
  },

  buildDates: function (config, existing) {
    var isos = Flex.utils.calculateSeasonDates(config);
    var existingMap = {};
    (existing || []).forEach(function (d) { existingMap[d.date.slice(5)] = d; });
    return isos.map(function (iso) {
      var md = iso.slice(5);
      var preset = Flex.DEFAULT_DAY_RANKING.filter(function (r) {
        return Flex.utils.pad(r.month) + "-" + Flex.utils.pad(r.day) === md;
      })[0];
      var prev = existingMap[md];
      var rank = prev && prev.rank ? prev.rank : (preset ? preset.rank : 10);
      var reason = prev && prev.reason ? prev.reason : (preset ? preset.reason : "Configured season date");
      return {
        date: iso,
        rank: rank,
        baseScore: (prev && prev.baseScore) || Flex.DEFAULT_BASE_SCORES[rank] || 40,
        reason: reason
      };
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  },

  demoCustomers: function (state) {
    var names = [
      "Aarav Mehta", "Diya Shah", "Kabir Patel", "Anaya Joshi", "Vihaan Desai",
      "Myra Trivedi", "Ishaan Rana", "Sara Kapoor", "Reyansh Nair", "Kiara Bhatt"
    ];
    var rng = Flex.utils.seededRandom(11);
    var customers = [];
    var prefs = {};
    var tickets = [];
    var dates = state.dates.map(function (d) { return d.date; });
    var base = new Date(state.seasonConfig.year, 8, 20, 9, 15, 0).getTime();
    names.forEach(function (name, i) {
      var id = "cust_demo_" + Flex.utils.pad(i + 1);
      var createdAt = new Date(base + i * 420000).toISOString();
      customers.push({
        id: id,
        name: name,
        createdAt: createdAt,
        sequenceNumber: i + 1,
        source: "demo"
      });
      var scenario = i < 4 ? "popular_day_bias" : (i < 7 ? "balanced_pref" : "continuous_bias");
      prefs[id] = Flex.simulation.generatePreferences(customers[i], state, scenario, rng);
      if (!prefs[id] || !Object.keys(prefs[id]).length) {
        var fallback = {};
        state.organizers.forEach(function (org) {
          fallback[org.id] = Flex.utils.shuffle(dates, rng);
        });
        prefs[id] = fallback;
      }
      tickets.push({
        id: "bkg_" + id,
        customerId: id,
        createdAt: createdAt,
        sequenceNumber: i + 1,
        status: "pending"
      });
    });
    return { customers: customers, preferences: prefs, tickets: tickets };
  },

  seedDemo: function () {
    var state = Flex.data.emptyState();
    state.organizers = Flex.utils.deepClone(Flex.DEFAULT_ORGANIZERS);
    state.seasonConfig = Object.assign({}, Flex.DEFAULT_SEASON);
    state.dates = Flex.data.buildDates(state.seasonConfig);
    state.settings = Flex.utils.deepClone(Flex.DEFAULT_SETTINGS);
    var demo = Flex.data.demoCustomers(state);
    state.customers = demo.customers;
    state.preferences = demo.preferences;
    state.tickets = demo.tickets;
    Flex.scoring.recalculateAllScores(state);
    var toAllocate = state.customers.slice(0, 6);
    toAllocate.forEach(function (customer, i) {
      var ticket = state.tickets.filter(function (t) { return t.customerId === customer.id; })[0];
      Flex.allocation.allocateCustomer(customer, {
        state: state,
        booking: ticket,
        now: new Date(ticket.createdAt).getTime(),
        algorithmId: "balanced"
      });
    });
    Flex.data.log({
      type: "system",
      level: "info",
      message: "Demo workspace seeded with 4 organizers, 10 season days, and 10 customers.",
      createdAt: new Date().toISOString()
    }, state);
    Flex.data.persistAll(state);
    Flex.storage.save(Flex.STORAGE_KEYS.seeded, true);
    Flex.data._state = state;
    return state;
  },

  loadState: function () {
    var state = Flex.data.emptyState();
    state.organizers = Flex.storage.load(Flex.STORAGE_KEYS.organizers, null);
    state.seasonConfig = Flex.storage.load(Flex.STORAGE_KEYS.seasonConfig, null);
    state.dates = Flex.storage.load(Flex.STORAGE_KEYS.dates, null);
    state.preferences = Flex.storage.load(Flex.STORAGE_KEYS.preferences, {});
    state.customers = Flex.storage.load(Flex.STORAGE_KEYS.customers, []);
    state.tickets = Flex.storage.load(Flex.STORAGE_KEYS.tickets, []);
    state.allocations = Flex.storage.load(Flex.STORAGE_KEYS.allocations, []);
    state.dayScores = Flex.storage.load(Flex.STORAGE_KEYS.dayScores, {});
    state.organizerDayScores = Flex.storage.load(Flex.STORAGE_KEYS.organizerDayScores, {});
    state.satisfactionResults = Flex.storage.load(Flex.STORAGE_KEYS.satisfactionResults, []);
    state.simulationConfig = Flex.storage.load(Flex.STORAGE_KEYS.simulationConfig, Flex.simulation.defaultConfig());
    state.settings = Flex.storage.load(Flex.STORAGE_KEYS.settings, Flex.utils.deepClone(Flex.DEFAULT_SETTINGS));
    state.logs = Flex.storage.load(Flex.STORAGE_KEYS.logs, []);
    if (!state.organizers || !state.seasonConfig || !state.dates) return null;
    Flex.data.normalizeOrganizers(state);
    return state;
  },

  maxDays: function (org) {
    var required = Math.max(1, Number(org.requiredDays) || 1);
    var max = Number(org.maxDays);
    if (!max || max < 1) max = required;
    return Math.max(required, max);
  },

  quotaOk: function (count, org) {
    return count >= (Number(org.requiredDays) || 0) && count <= Flex.data.maxDays(org);
  },

  normalizeOrganizer: function (org, seasonDays) {
    org.requiredDays = Math.max(1, Number(org.requiredDays) || 1);
    var max = Flex.data.maxDays(org);
    if (seasonDays) max = Math.min(max, seasonDays);
    org.maxDays = Math.max(org.requiredDays, max);
    return org;
  },

  normalizeOrganizers: function (state) {
    var seasonDays = state.dates && state.dates.length ? state.dates.length : 10;
    (state.organizers || []).forEach(function (org) {
      Flex.data.normalizeOrganizer(org, seasonDays);
    });
    return state;
  },

  init: function () {
    var seeded = Flex.storage.load(Flex.STORAGE_KEYS.seeded, false);
    var loaded = seeded ? Flex.data.loadState() : null;
    if (!loaded) {
      Flex.data._state = Flex.data.seedDemo();
    } else {
      Flex.data.normalizeOrganizers(loaded);
      Flex.data._state = loaded;
      Flex.scoring.recalculateAllScores(Flex.data._state);
    }
    return Flex.data._state;
  },

  getState: function () {
    if (!Flex.data._state) Flex.data.init();
    return Flex.data._state;
  },

  persistCore: function (state) {
    Flex.storage.save(Flex.STORAGE_KEYS.organizers, state.organizers);
    Flex.storage.save(Flex.STORAGE_KEYS.seasonConfig, state.seasonConfig);
    Flex.storage.save(Flex.STORAGE_KEYS.dates, state.dates);
    Flex.storage.save(Flex.STORAGE_KEYS.preferences, state.preferences);
    Flex.storage.save(Flex.STORAGE_KEYS.customers, state.customers);
    Flex.storage.save(Flex.STORAGE_KEYS.tickets, state.tickets);
    Flex.storage.save(Flex.STORAGE_KEYS.allocations, state.allocations);
    Flex.storage.save(Flex.STORAGE_KEYS.settings, state.settings);
    Flex.storage.save(Flex.STORAGE_KEYS.simulationConfig, state.simulationConfig);
    Flex.storage.save(Flex.STORAGE_KEYS.satisfactionResults, state.satisfactionResults);
  },

  persistAll: function (state) {
    Flex.data.persistCore(state);
    Flex.storage.save(Flex.STORAGE_KEYS.dayScores, state.dayScores);
    Flex.storage.save(Flex.STORAGE_KEYS.organizerDayScores, state.organizerDayScores);
    Flex.storage.save(Flex.STORAGE_KEYS.logs, state.logs);
    Flex.storage.save(Flex.STORAGE_KEYS.seeded, true);
  },

  persistLogs: function (state) {
    Flex.storage.save(Flex.STORAGE_KEYS.logs, state.logs);
  },

  log: function (entry, state) {
    state = state || Flex.data.getState();
    state.logs.unshift(Object.assign({ id: Flex.utils.uid("log") }, entry));
    if (state.logs.length > 400) state.logs = state.logs.slice(0, 400);
    Flex.data.persistLogs(state);
  },

  resetDemo: function () {
    Flex.storage.clearAll();
    return Flex.data.seedDemo();
  },

  clearAllData: function () {
    Flex.storage.clearAll();
    var state = Flex.data.emptyState();
    state.organizers = Flex.utils.deepClone(Flex.DEFAULT_ORGANIZERS);
    state.seasonConfig = Object.assign({}, Flex.DEFAULT_SEASON);
    state.dates = Flex.data.buildDates(state.seasonConfig);
    state.settings = Flex.utils.deepClone(Flex.DEFAULT_SETTINGS);
    Flex.scoring.recalculateAllScores(state);
    Flex.data.persistAll(state);
    Flex.data._state = state;
    return state;
  },

  buildFreshState: function () {
    var state = Flex.data.emptyState();
    state.organizers = Flex.utils.deepClone(Flex.DEFAULT_ORGANIZERS);
    state.seasonConfig = Object.assign({}, Flex.DEFAULT_SEASON);
    state.dates = Flex.data.buildDates(state.seasonConfig);
    state.settings = Flex.utils.deepClone(Flex.DEFAULT_SETTINGS);
    Flex.scoring.recalculateAllScores(state);
    return state;
  },

  saveOrganizer: function (org) {
    var state = Flex.data.getState();
    Flex.data.normalizeOrganizer(org, state.dates.length);
    var idx = -1;
    state.organizers.forEach(function (o, i) { if (o.id === org.id) idx = i; });
    if (idx === -1) state.organizers.push(org);
    else state.organizers[idx] = org;
    state.organizers.sort(function (a, b) { return a.rank - b.rank; });
    Flex.scoring.recalculateAllScores(state);
    Flex.data.persistCore(state);
    return org;
  },

  deleteOrganizer: function (id) {
    var state = Flex.data.getState();
    state.organizers = state.organizers.filter(function (o) { return o.id !== id; });
    Flex.scoring.recalculateAllScores(state);
    Flex.data.persistCore(state);
  },

  saveSeason: function (config) {
    var state = Flex.data.getState();
    state.seasonConfig = config;
    state.dates = Flex.data.buildDates(config, state.dates);
    Flex.scoring.recalculateAllScores(state);
    Flex.data.persistCore(state);
    return state.dates;
  },

  saveDates: function (dates) {
    var state = Flex.data.getState();
    state.dates = dates;
    Flex.scoring.recalculateAllScores(state);
    Flex.data.persistCore(state);
  },

  saveCustomer: function (customer, preferences) {
    var state = Flex.data.getState();
    var idx = -1;
    state.customers.forEach(function (c, i) { if (c.id === customer.id) idx = i; });
    if (idx === -1) {
      customer.sequenceNumber = customer.sequenceNumber || state.customers.length + 1;
      customer.createdAt = customer.createdAt || new Date().toISOString();
      state.customers.push(customer);
    } else {
      state.customers[idx] = Object.assign({}, state.customers[idx], customer);
    }
    if (preferences) state.preferences[customer.id] = preferences;
    Flex.data.persistCore(state);
    return customer;
  },

  deleteCustomer: function (id) {
    var state = Flex.data.getState();
    state.customers = state.customers.filter(function (c) { return c.id !== id; });
    delete state.preferences[id];
    state.tickets = state.tickets.filter(function (t) { return t.customerId !== id; });
    state.allocations = state.allocations.filter(function (a) { return a.customerId !== id; });
    Flex.scoring.recalculateAllScores(state);
    Flex.data.persistCore(state);
  },

  nextCustomerSequence: function (state) {
    var seq = 1;
    (state.customers || []).forEach(function (c) {
      if ((c.sequenceNumber || 0) >= seq) seq = c.sequenceNumber + 1;
    });
    return seq;
  },

  addCustomersByCount: function (count, options) {
    options = options || {};
    var state = Flex.data.getState();
    count = Math.max(1, Math.min(400, Number(count) || 0));
    var scenario = options.scenario || "balanced_pref";
    var prefix = (options.namePrefix || "Customer").trim() || "Customer";
    var rng = Flex.utils.seededRandom((options.seed || Date.now()) % 2147483646);
    var startSeq = Flex.data.nextCustomerSequence(state);
    var created = [];
    var baseTime = Date.now();
    for (var i = 0; i < count; i++) {
      var seq = startSeq + i;
      var customer = {
        id: "cust_bulk_" + seq + "_" + Date.now().toString(36) + i,
        name: prefix + " #" + seq,
        createdAt: new Date(baseTime + i * 1000).toISOString(),
        sequenceNumber: seq,
        source: "bulk"
      };
      state.customers.push(customer);
      state.preferences[customer.id] = Flex.simulation.generatePreferences(customer, state, scenario, rng);
      created.push(customer);
    }
    Flex.data.persistCore(state);
    Flex.data.log({
      type: "system",
      level: "info",
      message: "Added " + created.length + " customers without tickets.",
      createdAt: new Date().toISOString()
    }, state);
    return created;
  },

  clearAllCustomers: function () {
    var state = Flex.data.getState();
    var removed = state.customers.length;
    state.customers = [];
    state.preferences = {};
    state.tickets = [];
    state.allocations = [];
    state.simulationConfig = Flex.simulation.defaultConfig();
    Flex.scoring.recalculateAllScores(state);
    Flex.data.persistCore(state);
    Flex.data.log({
      type: "system",
      level: "warn",
      message: "Cleared all customer data (" + removed + " customers, tickets, and allocations).",
      createdAt: new Date().toISOString()
    }, state);
    return removed;
  },

  defaultPreferences: function (state) {
    var prefs = {};
    var dates = state.dates.map(function (d) { return d.date; });
    var byRank = state.dates.slice().sort(function (a, b) { return a.rank - b.rank; }).map(function (d) { return d.date; });
    state.organizers.forEach(function (org, i) {
      prefs[org.id] = i === 0 ? byRank.slice() : dates.slice();
    });
    return prefs;
  },

  capacitySnapshot: function (state) {
    state = state || Flex.data.getState();
    var total = Flex.demand.calculateTotalCapacity(state.organizers, state.dates);
    var used = 0;
    state.allocations.forEach(function (a) { used += (a.selectedDays || []).length; });
    return {
      total: total,
      used: used,
      remaining: Math.max(0, total - used),
      daily: Flex.demand.calculateDailyCapacity(state.organizers),
      theoreticalPasses: Flex.demand.theoreticalMaxPasses(state.organizers, state.dates)
    };
  },

  kpis: function (state) {
    state = state || Flex.data.getState();
    var cap = Flex.data.capacitySnapshot(state);
    var summary = Flex.satisfaction.summarizeAllocations(state.allocations);
    return {
      totalCustomers: state.customers.length,
      ticketsAllocated: state.allocations.length,
      totalCapacity: cap.total,
      usedCapacity: cap.used,
      remainingCapacity: cap.remaining,
      dailyCapacity: cap.daily,
      theoreticalPasses: cap.theoreticalPasses,
      averageSatisfaction: summary.average,
      medianSatisfaction: summary.median,
      minimumSatisfaction: summary.minimum,
      maximumSatisfaction: summary.maximum,
      lowSatisfactionPct: summary.lowSatisfactionPct,
      fairnessIndex: Flex.utils.round(Flex.satisfaction.fairnessIndex(state.allocations), 1),
      topPreferenceMatchPct: summary.topPreferenceMatchPct,
      premiumUsed: summary.premiumUsed,
      p10: summary.p10,
      p25: summary.p25,
      p50: summary.p50,
      p75: summary.p75,
      p90: summary.p90,
      components: Flex.satisfaction.componentAverages(state.allocations),
      categories: Flex.satisfaction.categoryCounts(state.allocations),
      utilizationPct: cap.total ? Flex.utils.round((cap.used / cap.total) * 100, 1) : 0
    };
  }
};

window.Flex = Flex;
