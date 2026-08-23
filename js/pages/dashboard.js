var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.dashboard = function (root) {
  var state = Flex.data.getState();
  Flex.scoring.recalculateAllScores(state);
  var kpis = Flex.data.kpis(state);
  var health = Flex.ui.healthLabel(kpis);
  var dayRows = state.dates.map(function (d) {
    var s = state.dayScores[d.date] || {};
    return {
      rank: s.dynamicRank || d.rank,
      date: Flex.utils.formatDate(d.date),
      weekday: Flex.utils.weekdayName(d.date),
      base: d.baseScore,
      dynamic: "<strong>" + (s.dynamicScore != null ? s.dynamicScore : "—") + "</strong>",
      util: Flex.ui.renderProgressBar(s.utilization || 0, (s.utilization || 0) > 85 ? "danger" : "primary") +
        " " + (s.utilization || 0) + "%",
      pressure: Flex.ui.renderBadge((s.pressureMeta && s.pressureMeta.label) || "—", (s.pressureMeta && s.pressureMeta.tone) || "neutral"),
      status: (s.utilization || 0) >= 96 ? Flex.ui.renderBadge("Critical", "danger") :
        (s.utilization || 0) >= 85 ? Flex.ui.renderBadge("Tight", "warning") : Flex.ui.renderBadge("Open", "success")
    };
  }).sort(function (a, b) { return a.rank - b.rank; });

  var activity = state.logs.slice(0, 8).map(function (l) {
    return "<li><time>" + Flex.utils.formatTime(l.createdAt) + "</time>" + Flex.utils.escapeHtml(l.message) + "</li>";
  }).join("") || "<li>No activity yet.</li>";

  root.innerHTML =
    Flex.ui.pageHeader("Operations dashboard", "Season health, capacity, and satisfaction at a glance.") +
    '<div class="metric-grid cols-5">' +
      Flex.ui.renderMetricCard({ label: "Total customers", value: kpis.totalCustomers }) +
      Flex.ui.renderMetricCard({ label: "Tickets allocated", value: kpis.ticketsAllocated }) +
      Flex.ui.renderMetricCard({ label: "Total capacity", value: kpis.totalCapacity, hint: kpis.dailyCapacity + " / day × " + state.dates.length + " days" }) +
      Flex.ui.renderMetricCard({ label: "Used capacity", value: kpis.usedCapacity, hint: kpis.utilizationPct + "% utilized" }) +
      Flex.ui.renderMetricCard({ label: "Remaining capacity", value: kpis.remainingCapacity }) +
      Flex.ui.renderMetricCard({ label: "Average satisfaction", value: kpis.averageSatisfaction || "—" }) +
      Flex.ui.renderMetricCard({ label: "Minimum satisfaction", value: kpis.minimumSatisfaction || "—" }) +
      Flex.ui.renderMetricCard({ label: "Low satisfaction %", value: kpis.lowSatisfactionPct + "%" }) +
      Flex.ui.renderMetricCard({ label: "Fairness index", value: kpis.fairnessIndex || "—" }) +
      Flex.ui.renderMetricCard({ label: "Top preference match", value: kpis.topPreferenceMatchPct + "%" }) +
    "</div>" +
    Flex.ui.renderCard({
      title: "Season health",
      subtitle: state.seasonConfig.name,
      body: Flex.ui.renderBadge(health.label, health.tone) +
        "<p>" + health.text + "</p>" +
        "<p class='muted'>Theoretical maximum complete 10-day passes: <strong>" +
        kpis.theoreticalPasses + "</strong> &nbsp;(" + kpis.totalCapacity + " organizer-day tickets ÷ " +
        state.dates.length + " days).</p>" +
        '<p class="help-callout">' + Flex.BEST_SATISFACTION_DEFINITION + "</p>"
    }) +
    '<div class="card-grid cols-2">' +
      Flex.ui.renderCard({
        title: "Dynamic day ranking",
        subtitle: "Live score, not the original popularity rank",
        body: Flex.ui.renderTable({
          columns: [
            { key: "rank", label: "Rank" },
            { key: "date", label: "Date" },
            { key: "weekday", label: "Weekday" },
            { key: "base", label: "Base" },
            { key: "dynamic", label: "Dynamic" },
            { key: "util", label: "Utilization" },
            { key: "pressure", label: "Pressure" },
            { key: "status", label: "Status" }
          ],
          rows: dayRows
        })
      }) +
      Flex.ui.renderCard({
        title: "Satisfaction distribution",
        body: kpis.ticketsAllocated ? Flex.charts.distribution(state.allocations) :
          Flex.ui.renderEmptyState({ title: "No allocations yet", body: "Run a simulation or allocate a customer.", actions: '<a class="btn btn-primary" href="#simulation">Run simulation</a>' })
      }) +
    "</div>" +
    Flex.ui.renderCard({
      title: "Organizer × date demand heatmap",
      subtitle: "Utilization %, booked / capacity, dynamic score",
      body: Flex.ui.renderHeatmap(state)
    }) +
    Flex.ui.renderCard({
      title: "Recent activity",
      body: "<ul class='feed'>" + activity + "</ul>"
    });

  Flex.ui.qsa(".heat-cell", root).forEach(function (btn) {
    btn.addEventListener("click", function () {
      Flex.ui.showSlot(btn.getAttribute("data-org"), btn.getAttribute("data-date"));
    });
  });
};
