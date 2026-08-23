var Flex = window.Flex || {};

Flex.scoring = {
  organizerRankScore: function (rank) {
    if (rank === 1) return 100;
    if (rank === 2) return 85;
    if (rank === 3) return 70;
    if (rank === 4) return 55;
    return Flex.utils.clamp(100 - (rank - 1) * 15, 20, 100);
  },

  preferenceScoreForRank: function (rank, table) {
    table = table || Flex.DEFAULT_PREFERENCE_SCORES;
    if (table[rank] != null) return table[rank];
    return Math.max(0, 110 - rank * 10);
  },

  calculateDynamicDayScore: function (baseScore, dateMetrics, weights) {
    weights = Flex.utils.normalizeWeights(weights || Flex.DEFAULT_SETTINGS.dayScoreWeights);
    var utilScore = Flex.utils.clamp(dateMetrics.utilization.utilization, 0, 100);
    var velocityScore = dateMetrics.velocity.score;
    var trendScore = dateMetrics.trend.score;
    var score =
      weights.basePopularity * baseScore +
      weights.utilization * utilScore +
      weights.bookingVelocity * velocityScore +
      weights.trend * trendScore;
    return Flex.utils.clamp(score, 0, 100);
  },

  calculateOrganizerDayScore: function (org, day, slotMetrics, weights) {
    weights = Flex.utils.normalizeWeights(weights || Flex.DEFAULT_SETTINGS.organizerDayWeights);
    var pressureNorm = Flex.utils.clamp(slotMetrics.pressure * 28, 0, 100);
    var score =
      weights.organizerRank * Flex.scoring.organizerRankScore(org.rank) +
      weights.dayBase * (day.baseScore || 0) +
      weights.utilization * Flex.utils.clamp(slotMetrics.utilization.utilization, 0, 100) +
      weights.bookingVelocity * slotMetrics.velocity.score +
      weights.demandPressure * pressureNorm +
      weights.trend * slotMetrics.trend.score;
    return Flex.utils.clamp(score, 0, 100);
  },

  calculatePreferenceScore: function (selectedDays, preferences, scoreTable) {
    if (!selectedDays.length) return 0;
    var total = 0;
    selectedDays.forEach(function (day) {
      var ranked = (preferences && preferences[day.organizerId]) || [];
      var idx = ranked.indexOf(day.date);
      var rank = idx >= 0 ? idx + 1 : 10;
      total += Flex.scoring.preferenceScoreForRank(rank, scoreTable);
    });
    return Flex.utils.clamp(total / selectedDays.length, 0, 100);
  },

  calculateContinuityScore: function (selectedDays, bonus) {
    bonus = bonus == null ? Flex.DEFAULT_SETTINGS.continuityBonus : bonus;
    var byOrg = {};
    selectedDays.forEach(function (day) {
      if (!byOrg[day.organizerId]) byOrg[day.organizerId] = [];
      byOrg[day.organizerId].push(day.date);
    });
    var transitions = 0;
    var consecutive = 0;
    Object.keys(byOrg).forEach(function (orgId) {
      var dates = byOrg[orgId].slice().sort();
      var runs = Flex.utils.consecutiveRuns(dates);
      runs.forEach(function (run) {
        if (run.length > 1) consecutive += run.length - 1;
      });
      transitions += Math.max(0, dates.length - 1);
    });
    if (!transitions) return 50;
    var raw = (consecutive / transitions) * 100;
    var bonusScore = Flex.utils.clamp(consecutive * bonus, 0, 30);
    return Flex.utils.clamp(raw * 0.7 + bonusScore, 0, 100);
  },

  countConsecutiveTransitions: function (selectedDays) {
    var byOrg = {};
    selectedDays.forEach(function (day) {
      if (!byOrg[day.organizerId]) byOrg[day.organizerId] = [];
      byOrg[day.organizerId].push(day.date);
    });
    var count = 0;
    Object.keys(byOrg).forEach(function (orgId) {
      var dates = byOrg[orgId].slice().sort();
      Flex.utils.consecutiveRuns(dates).forEach(function (run) {
        if (run.length > 1) count += run.length - 1;
      });
    });
    return count;
  },

  calculateFifoScore: function (booking, earliestBookingTs, latestBookingTs) {
    if (!booking || !booking.createdAt) return 50;
    var t = new Date(booking.createdAt).getTime();
    var min = earliestBookingTs;
    var max = latestBookingTs;
    if (min == null || max == null || min === max) return 100;
    var recency = (t - min) / (max - min);
    return Flex.utils.clamp(100 - recency * 100, 0, 100);
  },

  calculateFutureProtectionScore: function (selectedDays, state, now, excludeCustomerId) {
    if (!selectedDays.length) return 100;
    var scores = selectedDays.map(function (day) {
      var metrics = Flex.demand.slotMetrics(state, day.organizerId, day.date, now, excludeCustomerId);
      var remainingRatio = metrics.utilization.capacity
        ? metrics.utilization.available / metrics.utilization.capacity
        : 1;
      var pressure = metrics.pressure;
      var scarcity = Flex.utils.clamp((1 - remainingRatio) * 100, 0, 100);
      var pressureScore = Flex.utils.clamp(pressure * 30, 0, 100);
      var cost = scarcity * 0.45 + pressureScore * 0.55;
      return 100 - cost;
    });
    return Flex.utils.clamp(Flex.utils.mean(scores), 0, 100);
  },

  calculateFairnessScore: function (selectedDays, state, customerId, now) {
    var premiumCutoff = (state.settings && state.settings.premiumRankCutoff) || 3;
    var premiumDays = 0;
    var highDemandDays = 0;
    var top3 = 0;
    var prefs = state.preferences[customerId] || {};

    selectedDays.forEach(function (day) {
      var dateRow = Flex.utils.dateByISO(state.dates, day.date);
      if (dateRow && dateRow.rank <= premiumCutoff) premiumDays += 1;
      var cached = state.organizerDayScores && state.organizerDayScores[day.organizerId] && state.organizerDayScores[day.organizerId][day.date];
      var pressure = cached ? cached.pressure : Flex.demand.slotMetrics(state, day.organizerId, day.date, now, customerId).pressure;
      var utilization = cached ? cached.utilization : Flex.demand.slotMetrics(state, day.organizerId, day.date, now, customerId).utilization.utilization;
      if (pressure >= (state.settings.demandPressureLevels.medium || 1.5) || utilization >= 80) {
        highDemandDays += 1;
      }
      var ranked = prefs[day.organizerId] || [];
      if (ranked.indexOf(day.date) >= 0 && ranked.indexOf(day.date) < 3) top3 += 1;
    });

    var others = state.allocations.filter(function (a) { return a.customerId !== customerId; });
    var otherPremium = others.map(function (a) {
      return (a.selectedDays || []).filter(function (day) {
        var dateRow = Flex.utils.dateByISO(state.dates, day.date);
        return dateRow && dateRow.rank <= premiumCutoff;
      }).length;
    });
    var avgOtherPremium = otherPremium.length ? Flex.utils.mean(otherPremium) : premiumDays;
    var premiumGap = premiumDays - avgOtherPremium;
    var premiumPenalty = Flex.utils.clamp(premiumGap * 12, 0, 40);
    var highDemandPenalty = Flex.utils.clamp(highDemandDays * 6, 0, 24);
    var balanceBonus = Flex.utils.clamp(20 - Math.abs(top3 - 5) * 3, 0, 20);
    return Flex.utils.clamp(88 - premiumPenalty - highDemandPenalty + balanceBonus, 0, 100);
  },

  isPremiumDate: function (state, dateISO) {
    var dateRow = Flex.utils.dateByISO(state.dates, dateISO);
    var cutoff = (state.settings && state.settings.premiumRankCutoff) || 3;
    return !!(dateRow && dateRow.rank <= cutoff);
  },

  recalculateAllScores: function (state, now) {
    now = now || Date.now();
    var dayScores = {};
    var organizerDayScores = {};

    state.dates.forEach(function (day) {
      var dm = Flex.demand.dateMetrics(state, day.date, now);
      var dynamic = Flex.scoring.calculateDynamicDayScore(day.baseScore, dm, state.settings.dayScoreWeights);
      dayScores[day.date] = {
        date: day.date,
        baseScore: day.baseScore,
        dynamicScore: Flex.utils.round(dynamic, 1),
        utilization: Flex.utils.round(dm.utilization.utilization, 1),
        booked: dm.utilization.booked,
        capacity: dm.utilization.capacity,
        available: dm.utilization.available,
        velocity: Flex.utils.round(dm.velocity.score, 1),
        velocityDetail: dm.velocity,
        trend: Flex.utils.round(dm.trend.score, 1),
        trendDetail: dm.trend,
        pressure: Flex.utils.round(dm.pressure, 2),
        pressureMeta: dm.pressureMeta,
        pending: dm.pending
      };
    });

    var rankedDays = Object.keys(dayScores).sort(function (a, b) {
      return dayScores[b].dynamicScore - dayScores[a].dynamicScore;
    });
    rankedDays.forEach(function (iso, i) {
      dayScores[iso].dynamicRank = i + 1;
    });

    state.organizers.forEach(function (org) {
      organizerDayScores[org.id] = {};
      state.dates.forEach(function (day) {
        var sm = Flex.demand.slotMetrics(state, org.id, day.date, now);
        var score = Flex.scoring.calculateOrganizerDayScore(org, day, sm, state.settings.organizerDayWeights);
        organizerDayScores[org.id][day.date] = {
          organizerId: org.id,
          date: day.date,
          score: Flex.utils.round(score, 1),
          utilization: Flex.utils.round(sm.utilization.utilization, 1),
          booked: sm.utilization.booked,
          capacity: sm.utilization.capacity,
          available: sm.utilization.available,
          velocity: Flex.utils.round(sm.velocity.score, 1),
          trend: Flex.utils.round(sm.trend.score, 1),
          pressure: Flex.utils.round(sm.pressure, 2),
          pressureMeta: sm.pressureMeta,
          pending: sm.pending
        };
      });
    });

    state.dayScores = dayScores;
    state.organizerDayScores = organizerDayScores;
    Flex.storage.save(Flex.STORAGE_KEYS.dayScores, dayScores);
    Flex.storage.save(Flex.STORAGE_KEYS.organizerDayScores, organizerDayScores);
    return { dayScores: dayScores, organizerDayScores: organizerDayScores };
  }
};

window.Flex = Flex;
