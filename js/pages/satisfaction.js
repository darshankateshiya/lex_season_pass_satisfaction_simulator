var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.satisfaction = function (root) {
  var state = Flex.data.getState();
  var kpis = Flex.data.kpis(state);
  var comps = kpis.components;
  var leaderboard = state.allocations.slice().sort(function (a, b) {
    return b.satisfaction.finalScore - a.satisfaction.finalScore;
  }).map(function (a, i) {
    var c = state.customers.filter(function (x) { return x.id === a.customerId; })[0];
    var cat = Flex.utils.satisfactionCategory(a.satisfaction.finalScore);
    return {
      rank: i + 1,
      customer: c ? Flex.utils.escapeHtml(c.name) : a.customerId,
      score: "<strong>" + a.satisfaction.finalScore + "</strong>",
      category: Flex.ui.renderBadge(cat.label, cat.tone),
      pref: a.satisfaction.userPreferenceScore,
      fair: a.satisfaction.fairnessScore,
      future: a.satisfaction.futureProtectionScore,
      cont: a.satisfaction.continuityScore,
      fifo: a.satisfaction.fifoScore,
      actions: '<button class="btn btn-sm btn-ghost" data-open="' + a.allocationId + '">Explain</button>'
    };
  });

  root.innerHTML =
    Flex.ui.pageHeader("Satisfaction", "Do not treat a high average as success. Minimum satisfaction and fairness are first-class metrics.") +
    '<div class="metric-grid cols-5">' +
      Flex.ui.renderMetricCard({ label: "Average", value: kpis.averageSatisfaction || "—" }) +
      Flex.ui.renderMetricCard({ label: "Median", value: kpis.medianSatisfaction || "—" }) +
      Flex.ui.renderMetricCard({ label: "Minimum", value: kpis.minimumSatisfaction || "—" }) +
      Flex.ui.renderMetricCard({ label: "Maximum", value: kpis.maximumSatisfaction || "—" }) +
      Flex.ui.renderMetricCard({ label: "Low satisfaction %", value: kpis.lowSatisfactionPct + "%" }) +
      Flex.ui.renderMetricCard({ label: "P10", value: kpis.p10 || "—" }) +
      Flex.ui.renderMetricCard({ label: "P25", value: kpis.p25 || "—" }) +
      Flex.ui.renderMetricCard({ label: "P50", value: kpis.p50 || "—" }) +
      Flex.ui.renderMetricCard({ label: "P75", value: kpis.p75 || "—" }) +
      Flex.ui.renderMetricCard({ label: "P90", value: kpis.p90 || "—" }) +
    "</div>" +
    Flex.ui.renderCard({
      title: "Score components",
      body: Flex.charts.hbar([
        { label: "User preference", value: comps.userPreference, color: "#1d4ed8" },
        { label: "Fairness", value: comps.fairness, color: "#0f766e" },
        { label: "Future protection", value: comps.futureProtection, color: "#c2410c" },
        { label: "Continuity", value: comps.continuity, color: "#6d28d9" },
        { label: "FIFO", value: comps.fifo, color: "#334155" }
      ])
    }) +
    Flex.ui.renderCard({
      title: "Distribution",
      body: state.allocations.length ? Flex.charts.distribution(state.allocations) :
        Flex.ui.renderEmptyState({ title: "No satisfaction data", body: "Allocate customers or run a simulation.", actions: '<a class="btn btn-primary" href="#simulation">Run simulation</a>' })
    }) +
    Flex.ui.renderCard({
      title: "Leaderboard",
      body: Flex.ui.renderTable({
        columns: [
          { key: "rank", label: "#" },
          { key: "customer", label: "Customer" },
          { key: "score", label: "Score" },
          { key: "category", label: "Category" },
          { key: "pref", label: "Preference" },
          { key: "fair", label: "Fairness" },
          { key: "future", label: "Future" },
          { key: "cont", label: "Continuity" },
          { key: "fifo", label: "FIFO" },
          { key: "actions", label: "" }
        ],
        rows: leaderboard,
        emptyTitle: "No allocations yet",
        emptyBody: "Satisfaction ranking appears after the first valid pass is allocated."
      })
    });

  Flex.ui.qsa("[data-open]", root).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var alloc = state.allocations.filter(function (a) { return a.allocationId === btn.getAttribute("data-open"); })[0];
      if (alloc) Flex.ui.showAllocation(alloc);
    });
  });
};
