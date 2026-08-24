var Flex = window.Flex || {};

Flex.allocation = {
  maxConsecutiveDays: function (state) {
    var cfg = state && state.simulationConfig;
    if (!cfg) return null;
    if (cfg.maxConsecutiveDays != null && cfg.maxConsecutiveDays !== "") {
      var n = Number(cfg.maxConsecutiveDays);
      if (!isNaN(n) && n > 0) return n;
    }
    if (cfg.scenario === "no_continuous" || cfg.forbidContinuousDays) return 1;
    if (cfg.scenario === "max_2_continuous") return 2;
    return null;
  },

  forbidsContinuous: function (state) {
    return Flex.allocation.maxConsecutiveDays(state) === 1;
  },

  datesAreAdjacent: function (a, b) {
    var da = Flex.utils.parseISODate(a);
    var db = Flex.utils.parseISODate(b);
    return Math.abs((db - da) / 86400000) === 1;
  },

  longestRun: function (dateList) {
    var runs = Flex.utils.consecutiveRuns((dateList || []).slice().sort());
    var max = 0;
    runs.forEach(function (run) { if (run.length > max) max = run.length; });
    return max;
  },

  exceedsMaxConsecutive: function (dateList, maxRun) {
    if (maxRun == null) return false;
    return Flex.allocation.longestRun(dateList) > maxRun;
  },

  hasConsecutiveDates: function (dateList) {
    return Flex.allocation.exceedsMaxConsecutive(dateList, 1);
  },

  consecutiveViolations: function (selectedDays, maxRun) {
    if (maxRun == null) maxRun = 1;
    var byOrg = {};
    (selectedDays || []).forEach(function (day) {
      if (!byOrg[day.organizerId]) byOrg[day.organizerId] = [];
      byOrg[day.organizerId].push(day);
    });
    var violations = [];
    Object.keys(byOrg).forEach(function (orgId) {
      var days = byOrg[orgId].slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      var dates = days.map(function (d) { return d.date; });
      Flex.utils.consecutiveRuns(dates).forEach(function (run) {
        if (run.length > maxRun) {
          violations.push({
            organizerId: orgId,
            organizerName: days[0].organizerName || orgId,
            dates: run,
            length: run.length
          });
        }
      });
    });
    return violations;
  },

  pickNonAdjacent: function (available, count) {
    return Flex.allocation.pickWithMaxRun(available, count, 1);
  },

  pickWithMaxRun: function (available, count, maxRun) {
    if (maxRun == null) return (available || []).slice(0, count);
    function tryPick(order) {
      var picked = [];
      (order || []).forEach(function (iso) {
        if (picked.length >= count) return;
        if (!Flex.allocation.exceedsMaxConsecutive(picked.concat([iso]), maxRun)) {
          picked.push(iso);
        }
      });
      return picked.length >= count ? picked.slice(0, count) : null;
    }
    var first = tryPick(available);
    if (first) return first;
    return tryPick((available || []).slice().sort());
  },

  validateHardConstraints: function (selectedDays, state, inventory) {
    var penalties = [];
    var organizers = state.organizers;
    var dates = state.dates.map(function (d) { return d.date; });

    if (!selectedDays || selectedDays.length !== dates.length) {
      penalties.push("A Flex Season Pass must cover exactly " + dates.length + " unique dates.");
    }

    var seenDates = {};
    selectedDays.forEach(function (day) {
      if (seenDates[day.date]) penalties.push("Duplicate date selected: " + day.date);
      seenDates[day.date] = true;
    });

    organizers.forEach(function (org) {
      var count = selectedDays.filter(function (d) { return d.organizerId === org.id; }).length;
      var maxDays = Flex.data.maxDays(org);
      if (count < org.requiredDays) {
        penalties.push(org.name + " requires at least " + org.requiredDays + " days but " + count + " were selected.");
      } else if (count > maxDays) {
        penalties.push(org.name + " allows at most " + maxDays + " days in this " + dates.length + "-day event but " + count + " were selected.");
      }
    });

    selectedDays.forEach(function (day) {
      if (inventory && inventory[day.organizerId] && inventory[day.organizerId][day.date] <= 0) {
        penalties.push("No remaining capacity for " + day.organizerName + " on " + Flex.utils.formatDate(day.date) + ".");
      }
    });

    var maxRun = Flex.allocation.maxConsecutiveDays(state);
    if (maxRun != null) {
      Flex.allocation.consecutiveViolations(selectedDays, maxRun).forEach(function (v) {
        penalties.push(
          maxRun === 1
            ? (v.organizerName + " cannot be used on consecutive days (" +
              v.dates.map(function (d) { return Flex.utils.formatDate(d); }).join(", ") + ").")
            : (v.organizerName + " cannot have a 3-day continue (" +
              v.dates.map(function (d) { return Flex.utils.formatDate(d); }).join(", ") +
              "). A 2-day block is allowed, and isolated days like 14 or 20 are still allowed.")
        );
      });
    }

    return {
      valid: penalties.length === 0,
      uniqueDates: Object.keys(seenDates).length === dates.length && selectedDays.length === dates.length,
      organizerQuotaValid: organizers.every(function (org) {
        return Flex.data.quotaOk(selectedDays.filter(function (d) { return d.organizerId === org.id; }).length, org);
      }),
      capacityValid: penalties.every(function (p) { return p.indexOf("remaining capacity") === -1; }),
      penalties: penalties
    };
  },

  buildSelectedDays: function (assignedByOrg, state, customerId) {
    var prefs = state.preferences[customerId] || {};
    var rows = [];
    Object.keys(assignedByOrg).forEach(function (orgId) {
      var org = Flex.utils.organizerById(state.organizers, orgId);
      (assignedByOrg[orgId] || []).forEach(function (iso) {
        var ranked = prefs[orgId] || [];
        var idx = ranked.indexOf(iso);
        rows.push({
          date: iso,
          organizerId: orgId,
          organizerName: org ? org.name : orgId,
          preferenceRank: idx >= 0 ? idx + 1 : null,
          preferenceScore: Flex.scoring.preferenceScoreForRank(idx >= 0 ? idx + 1 : 10)
        });
      });
    });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return rows;
  },

  enrichSelectedDays: function (selectedDays, state, customerId, now) {
    var prevOrg = null;
    var prevDate = null;
    return selectedDays.map(function (day) {
      var metrics = Flex.demand.slotMetrics(state, day.organizerId, day.date, now, customerId);
      var scores = state.organizerDayScores && state.organizerDayScores[day.organizerId]
        ? state.organizerDayScores[day.organizerId][day.date]
        : null;
      var consecutive = false;
      if (prevOrg === day.organizerId && prevDate) {
        var prev = Flex.utils.parseISODate(prevDate);
        var cur = Flex.utils.parseISODate(day.date);
        consecutive = (cur - prev) / 86400000 === 1;
      }
      prevOrg = day.organizerId;
      prevDate = day.date;
      var reason = "Matched preference rank #" + (day.preferenceRank || "n/a") +
        " with " + metrics.pressureMeta.label.toLowerCase() + " demand pressure.";
      if (consecutive) reason += " Consecutive same-organizer day.";
      if (metrics.pressure >= (state.settings.demandPressureLevels.high || 2.5)) {
        day.protectedAlternative = day.preferenceRank && day.preferenceRank > 2;
      }
      return Object.assign({}, day, {
        organizerDayScore: scores ? scores.score : Flex.utils.round(Flex.scoring.calculateOrganizerDayScore(
          Flex.utils.organizerById(state.organizers, day.organizerId),
          Flex.utils.dateByISO(state.dates, day.date),
          metrics,
          state.settings.organizerDayWeights
        ), 1),
        demandPressure: Flex.utils.round(metrics.pressure, 2),
        demandPressureLabel: metrics.pressureMeta.label,
        utilization: Flex.utils.round(metrics.utilization.utilization, 1),
        available: metrics.utilization.available,
        capacity: metrics.utilization.capacity,
        booked: metrics.utilization.booked,
        continuityBonus: consecutive ? (state.settings.continuityBonus || 10) : 0,
        premium: Flex.scoring.isPremiumDate(state, day.date),
        reason: reason
      });
    });
  },

  generateValidAllocations: function (customer, context) {
    var state = context.state;
    var inventory = context.inventory || Flex.demand.buildInventory(state, customer.id);
    var dates = state.dates.map(function (d) { return d.date; });
    var organizers = state.organizers.slice().sort(function (a, b) {
      if (b.requiredDays !== a.requiredDays) return b.requiredDays - a.requiredDays;
      return a.rank - b.rank;
    });
    var prefs = state.preferences[customer.id] || {};
    var beamWidth = (state.settings && state.settings.beamWidth) || 28;
    var maxCandidates = (state.settings && state.settings.maxCandidates) || 40;
    var maxRun = Flex.allocation.maxConsecutiveDays(state);

    var beam = [{ assigned: {}, used: {}, prefScore: 0 }];

    function datePref(orgId, iso) {
      var ranked = prefs[orgId] || [];
      var idx = ranked.indexOf(iso);
      return Flex.scoring.preferenceScoreForRank(idx >= 0 ? idx + 1 : 10);
    }

    function leftoverFeasible(used, fromIndex) {
      var free = dates.filter(function (iso) { return !used[iso]; });
      var later = organizers.slice(fromIndex + 1);
      var minNeed = 0;
      var maxNeed = 0;
      later.forEach(function (org) {
        minNeed += org.requiredDays;
        maxNeed += Flex.data.maxDays(org);
      });
      if (free.length < minNeed || free.length > maxNeed) return false;
      for (var i = 0; i < later.length; i++) {
        var laterOrg = later[i];
        var avail = free.filter(function (iso) {
          return inventory[laterOrg.id] && inventory[laterOrg.id][iso] > 0;
        });
        if (avail.length < laterOrg.requiredDays) return false;
        avail.sort(function (a, b) { return (inventory[laterOrg.id][b] || 0) - (inventory[laterOrg.id][a] || 0); });
        var take = maxRun != null
          ? Flex.allocation.pickWithMaxRun(avail, laterOrg.requiredDays, maxRun)
          : avail.slice(0, laterOrg.requiredDays);
        if (!take) return false;
        free = free.filter(function (iso) { return take.indexOf(iso) === -1; });
      }
      return true;
    }

    organizers.forEach(function (org, orgIndex) {
      var next = [];
      var orgMax = Flex.data.maxDays(org);
      beam.forEach(function (stateNode) {
        var unused = dates.filter(function (iso) { return !stateNode.used[iso]; });
        var available = unused.filter(function (iso) {
          return inventory[org.id] && inventory[org.id][iso] > 0;
        });
        if (available.length < org.requiredDays) return;

        available.sort(function (a, b) {
          var pref = datePref(org.id, b) - datePref(org.id, a);
          if (pref) return pref;
          return (inventory[org.id][b] || 0) - (inventory[org.id][a] || 0);
        });

        var combos = [];
        var lastOrg = orgIndex === organizers.length - 1;
        var sizes = [];
        if (lastOrg) {
          if (unused.length >= org.requiredDays && unused.length <= orgMax && unused.length <= available.length) {
            sizes.push(unused.length);
          }
        } else {
          for (var k = org.requiredDays; k <= Math.min(orgMax, available.length); k++) sizes.push(k);
        }

        sizes.forEach(function (size) {
          var poolSize = Math.min(available.length, size + (available.length <= 8 ? 8 : 6));
          var pool = lastOrg ? unused.filter(function (iso) { return available.indexOf(iso) !== -1; }) : available.slice(0, poolSize);
          if (lastOrg && pool.length !== unused.length) return;
          Flex.utils.combinations(pool, size).forEach(function (combo) { combos.push(combo); });
          if (maxRun == null || size <= maxRun) {
            Flex.utils.findConsecutiveBlocks(available, size).forEach(function (block) {
              var key = block.join("|");
              var exists = combos.some(function (c) { return c.slice().sort().join("|") === key; });
              if (!exists) combos.push(block.slice());
            });
          }
        });

        var seenCombo = {};
        combos.forEach(function (combo) {
          var key = combo.slice().sort().join("|");
          if (seenCombo[key]) return;
          seenCombo[key] = true;
          var used = Object.assign({}, stateNode.used);
          var clash = false;
          combo.forEach(function (iso) {
            if (used[iso]) clash = true;
            used[iso] = true;
          });
          if (clash) return;
          if (maxRun != null && Flex.allocation.exceedsMaxConsecutive(combo, maxRun)) return;
          if (!leftoverFeasible(used, orgIndex)) return;
          var assigned = Object.assign({}, stateNode.assigned);
          assigned[org.id] = combo.slice();
          var prefScore = stateNode.prefScore;
          var capScore = 0;
          combo.forEach(function (iso) {
            prefScore += datePref(org.id, iso);
            capScore += inventory[org.id][iso] || 0;
          });
          next.push({ assigned: assigned, used: used, prefScore: prefScore, capScore: capScore });
        });
      });
      next.sort(function (a, b) {
        if (b.prefScore !== a.prefScore) return b.prefScore - a.prefScore;
        return (b.capScore || 0) - (a.capScore || 0);
      });
      beam = next.slice(0, beamWidth);
      if (!beam.length && next.length) beam = next.slice(0, beamWidth);
    });

    var candidates = [];
    beam.forEach(function (node) {
      var selected = Flex.allocation.buildSelectedDays(node.assigned, state, customer.id);
      if (selected.length !== dates.length) return;
      candidates.push({
        assigned: node.assigned,
        selectedDays: selected,
        prefScore: node.prefScore
      });
    });

    if (!candidates.length) {
      var fallback = Flex.allocation.capacityFirstAssignment(dates, organizers, inventory, maxRun);
      if (fallback) {
        candidates.push({
          assigned: fallback,
          selectedDays: Flex.allocation.buildSelectedDays(fallback, state, customer.id),
          prefScore: 0
        });
      }
    }

    return candidates.slice(0, maxCandidates);
  },

  capacityFirstAssignment: function (dates, organizers, inventory, maxRun) {
    var used = {};
    var assigned = {};
    var orgs = organizers.slice().sort(function (a, b) {
      var aAvail = dates.filter(function (d) { return inventory[a.id] && inventory[a.id][d] > 0; }).length;
      var bAvail = dates.filter(function (d) { return inventory[b.id] && inventory[b.id][d] > 0; }).length;
      if (aAvail !== bAvail) return aAvail - bAvail;
      return b.requiredDays - a.requiredDays;
    });
    for (var i = 0; i < orgs.length; i++) {
      var org = orgs[i];
      var available = dates.filter(function (iso) {
        return !used[iso] && inventory[org.id] && inventory[org.id][iso] > 0;
      }).sort(function (a, b) {
        return (inventory[org.id][b] || 0) - (inventory[org.id][a] || 0);
      });
      if (available.length < org.requiredDays) return null;
      var picked = maxRun != null
        ? Flex.allocation.pickWithMaxRun(available, org.requiredDays, maxRun)
        : available.slice(0, org.requiredDays);
      if (!picked) return null;
      assigned[org.id] = picked;
      assigned[org.id].forEach(function (iso) { used[iso] = true; });
    }
    dates.filter(function (iso) { return !used[iso]; }).forEach(function (iso) {
      var candidate = orgs.filter(function (org) {
        if (assigned[org.id].length >= Flex.data.maxDays(org)) return false;
        if (!inventory[org.id] || inventory[org.id][iso] <= 0) return false;
        if (maxRun != null && Flex.allocation.exceedsMaxConsecutive(assigned[org.id].concat([iso]), maxRun)) return false;
        return true;
      }).sort(function (a, b) {
        var slackA = Flex.data.maxDays(a) - assigned[a.id].length;
        var slackB = Flex.data.maxDays(b) - assigned[b.id].length;
        return slackB - slackA;
      })[0];
      if (!candidate) return;
      assigned[candidate.id].push(iso);
      used[iso] = true;
    });
    if (dates.some(function (iso) { return !used[iso]; })) return null;
    return assigned;
  },

  evaluateAllocation: function (candidate, context) {
    var state = context.state;
    var customer = context.customer;
    var inventory = context.inventory;
    var now = context.now || Date.now();
    var algorithmId = context.algorithmId || "balanced";
    var selectedDays = Flex.allocation.enrichSelectedDays(candidate.selectedDays, state, customer.id, now);
    var validation = Flex.allocation.validateHardConstraints(selectedDays, state, inventory);

    if (!validation.valid) {
      return {
        valid: false,
        userPreferenceScore: 0,
        fairnessScore: 0,
        futureProtectionScore: 0,
        continuityScore: 0,
        fifoScore: 0,
        globalScore: Number.NEGATIVE_INFINITY,
        reasons: [],
        penalties: validation.penalties,
        breakdown: validation,
        selectedDays: selectedDays
      };
    }

    var sat = Flex.satisfaction.calculateCustomerSatisfaction(selectedDays, {
      state: state,
      customer: customer,
      booking: context.booking,
      now: now,
      algorithmId: algorithmId
    });

    var modeInfo = Flex.satisfaction.weightsForMode(state, algorithmId);
    var opportunityCost = 0;
    selectedDays.forEach(function (day) {
      var metrics = Flex.demand.slotMetrics(state, day.organizerId, day.date, now, customer.id);
      if (metrics.pressure >= (state.settings.demandPressureLevels.high || 2.5)) {
        opportunityCost += 8;
      } else if (metrics.pressure >= (state.settings.demandPressureLevels.medium || 1.5)) {
        opportunityCost += 3;
      }
      if (metrics.utilization.available <= 3 && metrics.pending >= 5) opportunityCost += 6;
    });

    var remainingUsers = state.customers.filter(function (c) {
      return c.id !== customer.id && !state.allocations.some(function (a) { return a.customerId === c.id; });
    }).length;
    var futureImpact = opportunityCost * (1 + Math.min(remainingUsers, 80) / 80);

    var lowSatPenalty = 0;
    if (sat.finalScore < (state.settings.lowSatisfactionThreshold || 50)) {
      lowSatPenalty = (50 - sat.finalScore) * 1.4 * modeInfo.lowSatProtection;
    } else if (sat.finalScore < 60) {
      lowSatPenalty = (60 - sat.finalScore) * 0.4 * modeInfo.lowSatProtection;
    }

    var globalScore = sat.finalScore
      - futureImpact * 0.35 * modeInfo.globalImpactMultiplier
      - lowSatPenalty
      + sat.fairnessScore * 0.05;

    var reasons = [];
    if (sat.userPreferenceScore >= 80) reasons.push("Strong preference match (" + sat.userPreferenceScore + ")");
    if (sat.futureProtectionScore >= 80) reasons.push("Protected scarce inventory for remaining customers");
    if (sat.continuityScore >= 70) reasons.push("Useful consecutive same-organizer days were available");
    if (opportunityCost >= 12) reasons.push("Some high-pressure slots were still used because they improved overall value");

    return {
      valid: true,
      userPreferenceScore: sat.userPreferenceScore,
      fairnessScore: sat.fairnessScore,
      futureProtectionScore: sat.futureProtectionScore,
      continuityScore: sat.continuityScore,
      fifoScore: sat.fifoScore,
      globalScore: Flex.utils.round(globalScore, 2),
      satisfaction: sat,
      reasons: reasons,
      penalties: [],
      breakdown: {
        opportunityCost: Flex.utils.round(opportunityCost, 1),
        futureImpact: Flex.utils.round(futureImpact, 1),
        lowSatPenalty: Flex.utils.round(lowSatPenalty, 1),
        remainingUsers: remainingUsers,
        validation: validation
      },
      selectedDays: selectedDays
    };
  },

  selectBestAllocation: function (evaluated, context) {
    var valid = evaluated.filter(function (e) { return e.valid; });
    if (!valid.length) return null;
    valid.sort(function (a, b) { return b.globalScore - a.globalScore; });
    var best = valid[0];
    var tolerance = (context.state.settings && context.state.settings.fifoTolerance) || 2;
    var tied = valid.filter(function (e) { return Math.abs(e.globalScore - best.globalScore) <= tolerance; });
    if (tied.length > 1 && context.booking) {
      var bookingTs = new Date(context.booking.createdAt).getTime();
      tied.sort(function (a, b) {
        var diff = b.globalScore - a.globalScore;
        if (Math.abs(diff) > 0.01) return diff;
        return a.fifoScore === b.fifoScore ? 0 : b.fifoScore - a.fifoScore;
      });
      best = tied[0];
      best.fifoApplied = true;
      best.reasons = (best.reasons || []).concat(["FIFO tie-breaker applied."]);
      best.fifoBookingTime = bookingTs;
    }
    return best;
  },

  allocateCustomer: function (customer, options) {
    options = options || {};
    var state = options.state || Flex.data.getState();
    var now = options.now || Date.now();
    var algorithmId = options.algorithmId || (state.simulationConfig && state.simulationConfig.algorithm) || "balanced";
    var inventory = Flex.demand.buildInventory(state, customer.id);
    var existingTicket = state.tickets.filter(function (t) { return t.customerId === customer.id; })[0];
    var booking = options.booking || existingTicket || {
      id: Flex.utils.uid("bkg"),
      customerId: customer.id,
      createdAt: customer.createdAt || new Date(now).toISOString(),
      sequenceNumber: customer.sequenceNumber || state.tickets.length + 1
    };

    if (!state.preferences[customer.id]) {
      return { ok: false, error: "Customer has no date preferences for each organizer." };
    }

    Flex.scoring.recalculateAllScores(state, now);

    var candidates = Flex.allocation.generateValidAllocations(customer, {
      state: state,
      inventory: inventory,
      now: now
    });

    if (!candidates.length) {
      return { ok: false, error: "No valid allocation remains. Capacity or organizer-day quotas cannot be satisfied." };
    }

    var evaluated = candidates.map(function (c) {
      return Flex.allocation.evaluateAllocation(c, {
        state: state,
        customer: customer,
        inventory: inventory,
        booking: booking,
        now: now,
        algorithmId: algorithmId
      });
    });

    var best = Flex.allocation.selectBestAllocation(evaluated, {
      state: state,
      booking: booking,
      algorithmId: algorithmId
    });

    if (!best) {
      return { ok: false, error: "All candidate allocations violated hard constraints." };
    }

    var allocation = {
      customerId: customer.id,
      bookingId: booking.id,
      allocationId: Flex.utils.uid("alloc"),
      algorithmId: algorithmId,
      selectedDays: best.selectedDays,
      satisfaction: best.satisfaction,
      validation: best.breakdown.validation,
      reasons: Flex.satisfaction.reasonList({
        selectedDays: best.selectedDays,
        satisfaction: best.satisfaction,
        fifoApplied: best.fifoApplied,
        reasons: best.reasons
      }, state).concat(best.reasons || []),
      fifoApplied: !!best.fifoApplied,
      globalScore: best.globalScore,
      createdAt: booking.createdAt || new Date(now).toISOString()
    };

    state.allocations = state.allocations.filter(function (a) { return a.customerId !== customer.id; });
    state.allocations.push(allocation);

    if (!existingTicket) {
      state.tickets.push({
        id: booking.id,
        customerId: customer.id,
        createdAt: allocation.createdAt,
        sequenceNumber: booking.sequenceNumber,
        status: "allocated",
        allocationId: allocation.allocationId
      });
    } else {
      existingTicket.status = "allocated";
      existingTicket.allocationId = allocation.allocationId;
    }

    Flex.scoring.recalculateAllScores(state, now);
    Flex.data.persistCore(state);
    Flex.data.log({
      type: "allocation",
      level: "success",
      message: "Customer " + (customer.name || customer.id) + " allocated — Satisfaction " + allocation.satisfaction.finalScore,
      createdAt: new Date(now).toISOString(),
      customerId: customer.id,
      allocationId: allocation.allocationId
    }, state);

    Flex.allocation.logCapacityAlerts(state, now);
    return { ok: true, allocation: allocation, evaluatedCount: evaluated.length };
  },

  logCapacityAlerts: function (state, now) {
    state.organizers.forEach(function (org) {
      state.dates.forEach(function (day) {
        var slot = state.organizerDayScores[org.id] && state.organizerDayScores[org.id][day.date];
        if (!slot) return;
        if (slot.utilization >= 95) {
          Flex.data.log({
            type: "capacity",
            level: "warn",
            message: org.name + " / " + Flex.utils.formatDate(day.date) + " reached " + Flex.utils.round(slot.utilization, 0) + "%",
            createdAt: new Date(now).toISOString()
          }, state);
        }
      });
    });
  },

  allocateManual: function (customer, dateToOrganizer, options) {
    options = options || {};
    var state = options.state || Flex.data.getState();
    var now = options.now || Date.now();
    var inventory = Flex.demand.buildInventory(state, customer.id);
    var selectedDays = [];
    Object.keys(dateToOrganizer).forEach(function (iso) {
      var org = Flex.utils.organizerById(state.organizers, dateToOrganizer[iso]);
      if (!org) return;
      var ranked = (state.preferences[customer.id] || {})[org.id] || [];
      var idx = ranked.indexOf(iso);
      selectedDays.push({
        date: iso,
        organizerId: org.id,
        organizerName: org.name,
        preferenceRank: idx >= 0 ? idx + 1 : null,
        preferenceScore: Flex.scoring.preferenceScoreForRank(idx >= 0 ? idx + 1 : 10)
      });
    });
    selectedDays.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var validation = Flex.allocation.validateHardConstraints(selectedDays, state, inventory);
    if (!validation.valid) {
      return { ok: false, error: validation.penalties[0], penalties: validation.penalties };
    }
    var booking = options.booking || {
      id: Flex.utils.uid("bkg"),
      customerId: customer.id,
      createdAt: options.createdAt || new Date(now).toISOString(),
      sequenceNumber: state.tickets.length + 1
    };
    var enriched = Flex.allocation.enrichSelectedDays(selectedDays, state, customer.id, now);
    var sat = Flex.satisfaction.calculateCustomerSatisfaction(enriched, {
      state: state,
      customer: customer,
      booking: booking,
      now: now,
      algorithmId: "balanced"
    });
    var allocation = {
      customerId: customer.id,
      bookingId: booking.id,
      allocationId: Flex.utils.uid("alloc"),
      algorithmId: "manual",
      selectedDays: enriched,
      satisfaction: sat,
      validation: validation,
      reasons: Flex.satisfaction.reasonList({ selectedDays: enriched, satisfaction: sat }, state),
      fifoApplied: false,
      globalScore: sat.finalScore,
      createdAt: booking.createdAt
    };
    state.allocations = state.allocations.filter(function (a) { return a.customerId !== customer.id; });
    state.allocations.push(allocation);
    if (!state.tickets.some(function (t) { return t.customerId === customer.id; })) {
      state.tickets.push({
        id: booking.id,
        customerId: customer.id,
        createdAt: booking.createdAt,
        sequenceNumber: booking.sequenceNumber,
        status: "allocated",
        allocationId: allocation.allocationId
      });
    }
    Flex.scoring.recalculateAllScores(state, now);
    Flex.data.persistCore(state);
    Flex.data.log({
      type: "allocation",
      level: "success",
      message: "Manual allocation for " + customer.name + " — Satisfaction " + sat.finalScore,
      createdAt: booking.createdAt,
      customerId: customer.id
    }, state);
    return { ok: true, allocation: allocation };
  }
};

window.Flex = Flex;
