var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.demand = function (root) {
  var state = Flex.data.getState();
  Flex.scoring.recalculateAllScores(state);
  var slotRows = [];
  state.organizers.forEach(function (org) {
    state.dates.forEach(function (d) {
      var s = state.organizerDayScores[org.id][d.date];
      slotRows.push({
        organizer: Flex.utils.escapeHtml(org.name),
        date: Flex.utils.formatDate(d.date),
        weekday: Flex.utils.weekdayShort(d.date),
        score: "<strong>" + s.score + "</strong>",
        booked: s.booked + " / " + s.capacity,
        util: s.utilization + "%",
        velocity: s.velocity,
        trend: s.trend,
        pending: s.pending,
        pressure: Flex.ui.renderBadge(s.pressureMeta.label + " " + s.pressure, s.pressureMeta.tone)
      });
    });
  });

  root.innerHTML =
    Flex.ui.pageHeader("Dynamic demand", "Organizer/day scores update after every booking. Initial rank is only the starting point.") +
    Flex.ui.renderCard({
      title: "Organizer × date heatmap",
      body: Flex.ui.renderHeatmap(state)
    }) +
    Flex.ui.renderCard({
      title: "Organizer / day score table",
      body: Flex.ui.renderTable({
        columns: [
          { key: "organizer", label: "Organizer" },
          { key: "date", label: "Date" },
          { key: "weekday", label: "Weekday" },
          { key: "score", label: "Dynamic score" },
          { key: "booked", label: "Booked" },
          { key: "util", label: "Utilization" },
          { key: "velocity", label: "Velocity" },
          { key: "trend", label: "Trend" },
          { key: "pending", label: "Pending demand" },
          { key: "pressure", label: "Pressure" }
        ],
        rows: slotRows
      })
    });

  Flex.ui.qsa(".heat-cell", root).forEach(function (btn) {
    btn.addEventListener("click", function () {
      Flex.ui.showSlot(btn.getAttribute("data-org"), btn.getAttribute("data-date"));
    });
  });
};
