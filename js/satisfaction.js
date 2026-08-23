var Flex = window.Flex || {};

Flex.satisfaction = {
  weightsForMode: function (state, algorithmId) {
    var mode = Flex.ALGORITHM_MODES[algorithmId] || Flex.ALGORITHM_MODES.balanced;
    if (algorithmId === "balanced" && state.settings && state.settings.satisfactionWeights) {
      return {
        weights: state.settings.satisfactionWeights,
        globalImpactMultiplier: mode.globalImpactMultiplier,
        lowSatProtection: mode.lowSatProtection,
        mode: mode
      };
    }
    return {
      weights: mode.satisfactionWeights,
      globalImpactMultiplier: mode.globalImpactMultiplier,
      lowSatProtection: mode.lowSatProtection,
      mode: mode
    };
  },

  calculateCustomerSatisfaction: function (selectedDays, context) {
    var state = context.state;
    var customer = context.customer;
    var booking = context.booking;
    var now = context.now || Date.now();
    var prefs = state.preferences[customer.id] || {};
    var scoreTable = context.preferenceScores || Flex.DEFAULT_PREFERENCE_SCORES;
    var algorithmId = context.algorithmId || "balanced";
    var modeInfo = Flex.satisfaction.weightsForMode(state, algorithmId);
    var weights = Flex.utils.normalizeWeights(modeInfo.weights);

    var userPreferenceScore = Flex.scoring.calculatePreferenceScore(selectedDays, prefs, scoreTable);
    var fairnessScore = Flex.scoring.calculateFairnessScore(selectedDays, state, customer.id, now);
    var futureProtectionScore = Flex.scoring.calculateFutureProtectionScore(selectedDays, state, now, customer.id);
    var continuityScore = Flex.scoring.calculateContinuityScore(selectedDays, state.settings.continuityBonus);
    var fifoWindow = Flex.satisfaction.fifoWindow(state);
    var fifoScore = Flex.scoring.calculateFifoScore(booking, fifoWindow.min, fifoWindow.max);

    var finalScore =
      weights.userPreference * userPreferenceScore +
      weights.fairness * fairnessScore +
      weights.futureProtection * futureProtectionScore +
      weights.continuity * continuityScore +
      weights.fifo * fifoScore;

    finalScore = Flex.utils.clamp(finalScore, 0, 100);

    return {
      finalScore: Flex.utils.round(finalScore, 1),
      userPreferenceScore: Flex.utils.round(userPreferenceScore, 1),
      fairnessScore: Flex.utils.round(fairnessScore, 1),
      futureProtectionScore: Flex.utils.round(futureProtectionScore, 1),
      continuityScore: Flex.utils.round(continuityScore, 1),
      fifoScore: Flex.utils.round(fifoScore, 1),
      category: Flex.utils.satisfactionCategory(finalScore),
      weights: modeInfo.weights
    };
  },

  fifoWindow: function (state) {
    var times = state.tickets.map(function (t) { return new Date(t.createdAt).getTime(); });
    if (!times.length) return { min: null, max: null };
    return { min: Math.min.apply(null, times), max: Math.max.apply(null, times) };
  },

  summarizeAllocations: function (allocations) {
    var scores = allocations.map(function (a) {
      return a.satisfaction && a.satisfaction.finalScore != null ? a.satisfaction.finalScore : 0;
    });
    var lowThreshold = 50;
    var lowCount = scores.filter(function (s) { return s < lowThreshold; }).length;
    var prefMatches = 0;
    var prefTotal = 0;
    var continuityTransitions = 0;
    var premiumUsed = 0;
    allocations.forEach(function (a) {
      (a.selectedDays || []).forEach(function (day) {
        prefTotal += 1;
        if (day.preferenceRank && day.preferenceRank <= 3) prefMatches += 1;
        if (day.continuityBonus) continuityTransitions += 1;
        if (day.premium) premiumUsed += 1;
      });
    });
    return {
      count: allocations.length,
      average: Flex.utils.round(Flex.utils.mean(scores), 1),
      median: Flex.utils.round(Flex.utils.median(scores), 1),
      minimum: Flex.utils.round(Flex.utils.min(scores), 1),
      maximum: Flex.utils.round(Flex.utils.max(scores), 1),
      p10: Flex.utils.round(Flex.utils.percentile(scores, 10), 1),
      p25: Flex.utils.round(Flex.utils.percentile(scores, 25), 1),
      p50: Flex.utils.round(Flex.utils.percentile(scores, 50), 1),
      p75: Flex.utils.round(Flex.utils.percentile(scores, 75), 1),
      p90: Flex.utils.round(Flex.utils.percentile(scores, 90), 1),
      lowSatisfactionPct: scores.length ? Flex.utils.round((lowCount / scores.length) * 100, 1) : 0,
      lowCount: lowCount,
      topPreferenceMatchPct: prefTotal ? Flex.utils.round((prefMatches / prefTotal) * 100, 1) : 0,
      continuityTransitions: continuityTransitions,
      premiumUsed: premiumUsed,
      scores: scores
    };
  },

  componentAverages: function (allocations) {
    if (!allocations.length) {
      return { userPreference: 0, fairness: 0, futureProtection: 0, continuity: 0, fifo: 0 };
    }
    function avg(key) {
      return Flex.utils.round(Flex.utils.mean(allocations.map(function (a) {
        return a.satisfaction ? a.satisfaction[key] || 0 : 0;
      })), 1);
    }
    return {
      userPreference: avg("userPreferenceScore"),
      fairness: avg("fairnessScore"),
      futureProtection: avg("futureProtectionScore"),
      continuity: avg("continuityScore"),
      fifo: avg("fifoScore")
    };
  },

  categoryCounts: function (allocations) {
    var counts = {};
    Flex.SATISFACTION_CATEGORIES.forEach(function (c) { counts[c.id] = 0; });
    allocations.forEach(function (a) {
      var score = a.satisfaction ? a.satisfaction.finalScore : 0;
      var cat = Flex.utils.satisfactionCategory(score);
      counts[cat.id] += 1;
    });
    return counts;
  },

  fairnessIndex: function (allocations) {
    var scores = allocations.map(function (a) {
      return a.satisfaction ? a.satisfaction.finalScore : 0;
    });
    if (scores.length < 2) return scores.length ? 100 : 0;
    var mean = Flex.utils.mean(scores);
    var variance = Flex.utils.mean(scores.map(function (s) {
      var d = s - mean;
      return d * d;
    }));
    var stdev = Math.sqrt(variance);
    var spreadPenalty = Flex.utils.clamp(stdev * 2.2, 0, 55);
    var minPenalty = Flex.utils.clamp((70 - Flex.utils.min(scores)) * 0.6, 0, 30);
    return Flex.utils.clamp(100 - spreadPenalty - minPenalty, 0, 100);
  },

  explainAllocation: function (allocation, state) {
    if (!allocation) return "No allocation available.";
    var sat = allocation.satisfaction || {};
    var days = allocation.selectedDays || [];
    var top = days.filter(function (d) { return d.preferenceRank && d.preferenceRank <= 3; }).length;
    var lines = [];
    lines.push("Customer Satisfaction: " + sat.finalScore + "/100");
    lines.push("");
    lines.push("Preference Match: " + sat.userPreferenceScore);
    lines.push("You received " + top + " of your top-ranked organizer/day choices out of " + days.length + " days.");
    lines.push("");
    lines.push("Fairness: " + sat.fairnessScore);
    lines.push("Your allocation did not consume an excessive share of premium inventory relative to other customers.");
    lines.push("");
    lines.push("Future Protection: " + sat.futureProtectionScore);
    lines.push("The system avoided consuming critically scarce slots unless they improved overall outcome.");
    lines.push("");
    lines.push("Continuity: " + sat.continuityScore);
    lines.push("Consecutive same-organizer days were treated as a soft preference, not a hard rule.");
    lines.push("");
    lines.push("FIFO: " + sat.fifoScore);
    lines.push("Booking time is used only as a tie-breaker when candidate allocations are effectively equivalent.");
    if (allocation.reasons && allocation.reasons.length) {
      lines.push("");
      lines.push("WHY THIS ALLOCATION?");
      allocation.reasons.forEach(function (r) { lines.push(r); });
    }
    return lines.join("\n");
  },

  reasonList: function (allocation, state) {
    var days = allocation.selectedDays || [];
    var sat = allocation.satisfaction || {};
    var reasons = [];
    var top = days.filter(function (d) { return d.preferenceRank && d.preferenceRank <= 3; }).length;
    reasons.push("✓ " + top + "/" + days.length + " selections matched top-3 preferences");
    reasons.push("✓ Organizer quota satisfied");
    reasons.push("✓ " + days.length + " unique dates");
    reasons.push("✓ No duplicate organizer on a date");
    days.forEach(function (d) {
      if (d.preferenceRank === 1) {
        reasons.push("✓ " + Flex.utils.formatDate(d.date) + " " + d.organizerName + " matched customer's #1 preference");
      }
      if (d.protectedAlternative) {
        reasons.push("✓ " + Flex.utils.formatDate(d.date) + " used an alternative because demand pressure was " + (d.demandPressureLabel || "high"));
      }
    });
    if (sat.futureProtectionScore >= 80) {
      reasons.push("✓ Scarce inventory was protected for future customers");
    }
    if (Flex.allocation.forbidsContinuous(state)) {
      reasons.push("✓ No consecutive same-organizer days — adjacent dates must use a different organizer");
    } else if (sat.continuityScore >= 70) {
      reasons.push("✓ Continuity preference was considered");
    }
    if (allocation.fifoApplied) {
      reasons.push("✓ FIFO was respected as tie-breaker");
    }
    return reasons;
  }
};

window.Flex = Flex;
