var Flex = window.Flex || {};

Flex.simulation = {
  defaultConfig: function () {
    return {
      userCount: 10,
      scenario: "balanced_pref",
      algorithm: "balanced",
      speed: "normal",
      running: false,
      paused: false,
      processed: 0,
      seed: 2026
    };
  },

  speedMs: function (speed) {
    if (speed === "slow") return 220;
    if (speed === "fast") return 0;
    return 40;
  },

  generatePreferences: function (customer, state, scenarioId, rng) {
    var dates = state.dates.map(function (d) { return d.date; });
    var prefs = {};
    var oct17 = dates.filter(function (d) { return d.slice(5) === "10-17"; })[0];
    var oct18 = dates.filter(function (d) { return d.slice(5) === "10-18"; })[0];
    var oct19 = dates.filter(function (d) { return d.slice(5) === "10-19"; })[0];
    var oct12 = dates.filter(function (d) { return d.slice(5) === "10-12"; })[0];

    state.organizers.forEach(function (org, orgIndex) {
      var ranked;
      if (scenarioId === "popular_day_bias" && rng() < 0.8 && oct17) {
        ranked = [oct17].concat(Flex.utils.shuffle(dates.filter(function (d) { return d !== oct17; }), rng));
      } else if (scenarioId === "organizer_bias" && org.rank === 1) {
        var hot = dates.slice().sort(function (a, b) {
          var ra = Flex.utils.dateByISO(state.dates, a).rank;
          var rb = Flex.utils.dateByISO(state.dates, b).rank;
          return ra - rb;
        });
        ranked = hot.slice();
      } else if (scenarioId === "continuous_bias" && org.rank === 1 && oct17 && oct18 && oct19 && rng() < 0.7) {
        var rest = Flex.utils.shuffle(dates.filter(function (d) {
          return d !== oct17 && d !== oct18 && d !== oct19;
        }), rng);
        ranked = [oct17, oct18, oct19].concat(rest);
      } else if (scenarioId === "sudden_shift" && oct12 && rng() < 0.55) {
        ranked = [oct12].concat(Flex.utils.shuffle(dates.filter(function (d) { return d !== oct12; }), rng));
      } else if (scenarioId === "no_continuous") {
        var sorted = dates.slice().sort();
        var offset = orgIndex % 2;
        var preferred = [];
        var rest = [];
        sorted.forEach(function (d, i) {
          if (i % 2 === offset) preferred.push(d);
          else rest.push(d);
        });
        ranked = preferred.concat(Flex.utils.shuffle(rest, rng));
      } else if (scenarioId === "max_2_continuous") {
        var allDates = dates.slice().sort();
        var pair = (oct17 && oct18) ? [oct17, oct18] : [];
        if (!pair.length) {
          for (var p = 0; p < allDates.length - 1; p++) {
            if (Flex.allocation.datesAreAdjacent(allDates[p], allDates[p + 1])) {
              pair = [allDates[p], allDates[p + 1]];
              break;
            }
          }
        }
        var isolated = [];
        var edge = [];
        allDates.forEach(function (d) {
          if (pair.indexOf(d) !== -1) return;
          var touchesPair = pair.some(function (pd) { return Flex.allocation.datesAreAdjacent(pd, d); });
          if (touchesPair) edge.push(d);
          else isolated.push(d);
        });
        ranked = pair.concat(isolated).concat(edge);
      } else if (scenarioId === "random") {
        ranked = Flex.utils.shuffle(dates, rng);
      } else {
        var weekendBias = dates.slice().sort(function (a, b) {
          var da = Flex.utils.parseISODate(a).getDay();
          var db = Flex.utils.parseISODate(b).getDay();
          var scoreA = (da === 0 || da === 6 ? 2 : 0) + (Flex.utils.dateByISO(state.dates, a).rank <= 3 ? 1 : 0) + rng();
          var scoreB = (db === 0 || db === 6 ? 2 : 0) + (Flex.utils.dateByISO(state.dates, b).rank <= 3 ? 1 : 0) + rng();
          return scoreB - scoreA;
        });
        if (orgIndex > 0 && rng() < 0.4) weekendBias = Flex.utils.shuffle(weekendBias, rng);
        ranked = weekendBias;
      }
      prefs[org.id] = ranked;
    });
    return prefs;
  },

  generateCustomers: function (count, state, scenarioId, seed, startSeq) {
    var rng = Flex.utils.seededRandom(seed || 2026);
    var customers = [];
    var tickets = [];
    var preferences = {};
    var baseTime = new Date(state.seasonConfig.year, 8, 1, 10, 0, 0).getTime();
    startSeq = startSeq || 1;

    for (var i = 0; i < count; i++) {
      var id = "cust_sim_" + String(startSeq + i).padStart(4, "0");
      var createdAt = new Date(baseTime + i * 90000 + Math.floor(rng() * 20000)).toISOString();
      if (scenarioId === "sudden_shift" && i > count * 0.35) {
        createdAt = new Date(baseTime + 6 * 3600000 + (i - Math.floor(count * 0.35)) * 12000).toISOString();
      }
      var customer = {
        id: id,
        name: "Customer #" + (startSeq + i),
        createdAt: createdAt,
        sequenceNumber: startSeq + i,
        source: "simulation"
      };
      customers.push(customer);
      preferences[id] = Flex.simulation.generatePreferences(customer, state, scenarioId, rng);
      tickets.push({
        id: "bkg_" + id,
        customerId: id,
        createdAt: createdAt,
        sequenceNumber: startSeq + i,
        status: "pending"
      });
    }
    return { customers: customers, tickets: tickets, preferences: preferences };
  },

  resetGenerated: function (state) {
    var keepCustomers = state.customers.filter(function (c) { return c.source !== "simulation"; });
    var keepIds = {};
    keepCustomers.forEach(function (c) { keepIds[c.id] = true; });
    state.customers = keepCustomers;
    var prefs = {};
    Object.keys(state.preferences).forEach(function (id) {
      if (keepIds[id]) prefs[id] = state.preferences[id];
    });
    state.preferences = prefs;
    state.tickets = state.tickets.filter(function (t) { return keepIds[t.customerId]; });
    state.allocations = state.allocations.filter(function (a) { return keepIds[a.customerId]; });
    return state;
  },

  prepare: function (config, state) {
    state = state || Flex.data.getState();
    config = Object.assign(Flex.simulation.defaultConfig(), config || {});
    Flex.simulation.resetGenerated(state);
    var generated = Flex.simulation.generateCustomers(
      config.userCount,
      state,
      config.scenario,
      config.seed,
      state.customers.length + 1
    );
    state.customers = state.customers.concat(generated.customers);
    generated.customers.forEach(function (c) {
      state.preferences[c.id] = generated.preferences[c.id];
    });
    state.tickets = state.tickets.concat(generated.tickets);
    state.simulationConfig = Object.assign({}, config, {
      processed: 0,
      running: false,
      paused: false,
      forbidContinuousDays: config.scenario === "no_continuous",
      maxConsecutiveDays: config.scenario === "no_continuous" ? 1 : (config.scenario === "max_2_continuous" ? 2 : null),
      queue: generated.customers.map(function (c) { return c.id; })
    });
    Flex.data.persistCore(state);
    Flex.scoring.recalculateAllScores(state);
    return state.simulationConfig;
  },

  stepOne: function (state, now) {
    state = state || Flex.data.getState();
    var cfg = state.simulationConfig || Flex.simulation.defaultConfig();
    var queue = cfg.queue || [];
    if (cfg.processed >= queue.length) return { done: true };
    var customerId = queue[cfg.processed];
    var customer = state.customers.filter(function (c) { return c.id === customerId; })[0];
    var ticket = state.tickets.filter(function (t) { return t.customerId === customerId; })[0];
    var simNow = now || new Date(ticket ? ticket.createdAt : Date.now()).getTime();
    var result = Flex.allocation.allocateCustomer(customer, {
      state: state,
      booking: ticket,
      now: simNow,
      algorithmId: cfg.algorithm
    });
    cfg.processed += 1;
    state.simulationConfig = cfg;
    Flex.storage.save(Flex.STORAGE_KEYS.simulationConfig, cfg);
    if (cfg.processed === 1 || cfg.processed % 10 === 0) {
      Flex.data.log({
        type: "score",
        level: "info",
        message: "Dynamic score recalculated after " + cfg.processed + " allocations",
        createdAt: new Date(simNow).toISOString()
      }, state);
    }
    return { done: cfg.processed >= queue.length, result: result, processed: cfg.processed, total: queue.length };
  },

  runSimulation: function (config, hooks) {
    hooks = hooks || {};
    var state = Flex.data.getState();
    Flex.simulation.prepare(config, state);
    return Flex.simulation.runPrepared(state, hooks);
  },

  runPrepared: function (state, hooks) {
    hooks = hooks || {};
    var cfg = state.simulationConfig;
    cfg.running = true;
    cfg.paused = false;
    Flex.storage.save(Flex.STORAGE_KEYS.simulationConfig, cfg);

    var delay = Flex.simulation.speedMs(cfg.speed);
    var cancelled = false;

    function tick() {
      if (cancelled) return;
      state = Flex.data.getState();
      cfg = state.simulationConfig;
      if (cfg.paused) {
        if (hooks.onPause) hooks.onPause(cfg);
        return;
      }
      var step = Flex.simulation.stepOne(state);
      if (hooks.onStep) hooks.onStep(step, state);
      if (step.done) {
        cfg.running = false;
        Flex.storage.save(Flex.STORAGE_KEYS.simulationConfig, cfg);
        if (hooks.onComplete) hooks.onComplete(Flex.simulation.snapshot(state));
        return;
      }
      if (delay === 0) {
        if (cfg.processed % 8 === 0) setTimeout(tick, 0);
        else tick();
      } else {
        setTimeout(tick, delay);
      }
    }

    setTimeout(tick, 0);
    return {
      stop: function () { cancelled = true; cfg.running = false; }
    };
  },

  snapshot: function (state) {
    state = state || Flex.data.getState();
    var summary = Flex.satisfaction.summarizeAllocations(state.allocations);
    var capacity = Flex.demand.calculateTotalCapacity(state.organizers, state.dates);
    var used = 0;
    state.allocations.forEach(function (a) { used += (a.selectedDays || []).length; });
    return {
      algorithm: state.simulationConfig && state.simulationConfig.algorithm,
      scenario: state.simulationConfig && state.simulationConfig.scenario,
      users: state.customers.length,
      allocated: state.allocations.length,
      averageSatisfaction: summary.average,
      medianSatisfaction: summary.median,
      minimumSatisfaction: summary.minimum,
      maximumSatisfaction: summary.maximum,
      p10: summary.p10,
      p25: summary.p25,
      p75: summary.p75,
      p90: summary.p90,
      lowSatisfactionPct: summary.lowSatisfactionPct,
      fairnessIndex: Flex.utils.round(Flex.satisfaction.fairnessIndex(state.allocations), 1),
      capacityUtilization: capacity ? Flex.utils.round((used / capacity) * 100, 1) : 0,
      premiumSlotUsage: summary.premiumUsed,
      preferenceMatch: summary.topPreferenceMatchPct,
      continuity: summary.continuityTransitions,
      fifoConflicts: state.allocations.filter(function (a) { return a.fifoApplied; }).length,
      components: Flex.satisfaction.componentAverages(state.allocations)
    };
  },

  compareAlgorithms: function (userCount, scenarioId, algorithmIds, seed) {
    algorithmIds = algorithmIds || Object.keys(Flex.ALGORITHM_MODES);
    var results = [];
    algorithmIds.forEach(function (algo) {
      var fresh = Flex.data.buildFreshState();
      var cfg = {
        userCount: userCount,
        scenario: scenarioId,
        algorithm: algo,
        speed: "fast",
        seed: seed || 20261017
      };
      Flex.simulation.prepare(cfg, fresh);
      while (fresh.simulationConfig.processed < fresh.simulationConfig.queue.length) {
        Flex.simulation.stepOne(fresh);
      }
      var snap = Flex.simulation.snapshot(fresh);
      snap.algorithm = algo;
      snap.algorithmName = Flex.ALGORITHM_MODES[algo].name;
      results.push(snap);
    });
    return results;
  }
};

window.Flex = Flex;
