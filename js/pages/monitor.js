var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.monitor = function (root) {
  var state = Flex.data.getState();
  Flex.scoring.recalculateAllScores(state);
  var kpis = Flex.data.kpis(state);
  var critical = [];
  state.organizers.forEach(function (org) {
    state.dates.forEach(function (d) {
      var slot = state.organizerDayScores[org.id] && state.organizerDayScores[org.id][d.date];
      if (!slot) return;
      if (slot.pressureMeta.label === "Critical" || slot.utilization >= 90) {
        critical.push({
          slot: org.name + " / " + Flex.utils.formatDate(d.date),
          util: slot.utilization + "%",
          pressure: Flex.ui.renderBadge(slot.pressureMeta.label + " " + slot.pressure, slot.pressureMeta.tone),
          available: slot.available,
          pending: slot.pending,
          score: slot.score
        });
      }
    });
  });
  critical.sort(function (a, b) { return b.score - a.score; });
  var topDays = state.dates.map(function (d) {
    var s = state.dayScores[d.date];
    return { label: Flex.utils.formatDate(d.date), value: s ? s.dynamicScore : 0 };
  }).sort(function (a, b) { return b.value - a.value; });

  var satTrend = state.allocations.slice(-20).map(function (a) { return a.satisfaction.finalScore; });
  var fairTrend = state.allocations.slice(-20).map(function (_, i, arr) {
    return Flex.satisfaction.fairnessIndex(state.allocations.slice(0, state.allocations.length - (arr.length - 1 - i)));
  });

  root.innerHTML =
    Flex.ui.pageHeader("Live monitor", "Current bookings, scarce slots, and live activity. Simulation timestamps are used when a run is in progress.") +
    '<div class="metric-grid cols-4">' +
      Flex.ui.renderMetricCard({ label: "Current bookings", value: kpis.ticketsAllocated }) +
      Flex.ui.renderMetricCard({ label: "Used capacity", value: kpis.usedCapacity + " / " + kpis.totalCapacity }) +
      Flex.ui.renderMetricCard({ label: "Average satisfaction", value: kpis.averageSatisfaction || "—" }) +
      Flex.ui.renderMetricCard({ label: "Fairness index", value: kpis.fairnessIndex || "—" }) +
    "</div>" +
    '<div class="card-grid cols-2">' +
      Flex.ui.renderCard({
        title: "Critical organizer/day slots",
        body: Flex.ui.renderTable({
          columns: [
            { key: "slot", label: "Slot" },
            { key: "util", label: "Utilization" },
            { key: "pressure", label: "Pressure" },
            { key: "available", label: "Available" },
            { key: "pending", label: "Pending" },
            { key: "score", label: "Score" }
          ],
          rows: critical,
          emptyTitle: "No critical slots",
          emptyBody: "Capacity is healthy across organizer/day inventory."
        })
      }) +
      Flex.ui.renderCard({
        title: "Top demand days",
        body: Flex.charts.hbar(topDays)
      }) +
    "</div>" +
    '<div class="card-grid cols-2">' +
      Flex.ui.renderCard({
        title: "Satisfaction trend",
        subtitle: "Last allocations",
        body: satTrend.length ? Flex.charts.sparkline(satTrend, "#15803d") : "<p>No allocations yet.</p>"
      }) +
      Flex.ui.renderCard({
        title: "Fairness trend",
        body: fairTrend.length ? Flex.charts.sparkline(fairTrend, "#1d4ed8") : "<p>No allocations yet.</p>"
      }) +
    "</div>" +
    Flex.ui.renderCard({
      title: "Live activity feed",
      body: "<ul class='feed'>" + (state.logs.slice(0, 24).map(function (l) {
        return "<li><time>" + Flex.utils.formatDateTime(l.createdAt) + "</time>" + Flex.utils.escapeHtml(l.message) + "</li>";
      }).join("") || "<li>Waiting for bookings.</li>") + "</ul>"
    });
};
