var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.season = function (root) {
  Flex.pages.renderSeasonTable(root, false);
};

Flex.pages.ranking = function (root) {
  Flex.pages.renderSeasonTable(root, true);
};

Flex.pages.renderSeasonTable = function (root, rankingMode) {
  var state = Flex.data.getState();
  Flex.scoring.recalculateAllScores(state);
  var ctx = { sortKey: rankingMode ? "dynamic" : "date", sortDir: rankingMode ? "desc" : "asc", q: "" };

  function rows() {
    var list = state.dates.map(function (d) {
      var s = state.dayScores[d.date] || {};
      return {
        _date: d.date,
        rank: d.rank,
        date: Flex.utils.formatDate(d.date),
        weekday: Flex.utils.weekdayName(d.date),
        base: d.baseScore,
        dynamic: s.dynamicScore,
        capacity: s.capacity,
        booked: s.booked,
        available: s.available,
        utilization: s.utilization,
        velocity: s.velocity,
        trend: s.trend,
        pressure: s.pressure,
        status: (s.utilization || 0) >= 96 ? "Critical" : (s.utilization || 0) >= 85 ? "Tight" : "Open",
        reason: d.reason,
        _search: (Flex.utils.formatDate(d.date) + " " + Flex.utils.weekdayName(d.date) + " " + d.reason).toLowerCase()
      };
    });
    if (ctx.q) list = list.filter(function (r) { return r._search.indexOf(ctx.q.toLowerCase()) !== -1; });
    return Flex.utils.sortBy(list, ctx.sortKey, ctx.sortDir);
  }

  function paint() {
    var display = rows().map(function (r) {
      return {
        rank: r.rank,
        date: r.date,
        weekday: r.weekday,
        base: rankingMode
          ? '<input class="base-input" data-date="' + r._date + '" type="number" min="0" max="100" value="' + r.base + '">'
          : r.base,
        dynamic: "<strong>" + r.dynamic + "</strong>",
        capacity: r.capacity,
        booked: r.booked,
        available: r.available,
        utilization: r.utilization + "%",
        velocity: r.velocity,
        trend: r.trend,
        pressure: Flex.ui.renderBadge(String(r.pressure), r.pressure >= 2.5 ? "danger" : "neutral"),
        status: Flex.ui.renderBadge(r.status, r.status === "Critical" ? "danger" : r.status === "Tight" ? "warning" : "success"),
        reason: rankingMode
          ? '<input class="reason-input" data-date="' + r._date + '" value="' + Flex.utils.escapeHtml(r.reason) + '">'
          : Flex.utils.escapeHtml(r.reason),
        actions: rankingMode
          ? '<button class="btn btn-sm btn-ghost" data-up="' + r._date + '">Up</button>' +
            '<button class="btn btn-sm btn-ghost" data-down="' + r._date + '">Down</button>'
          : ""
      };
    });
    var cols = [
      { key: "rank", label: "Rank" },
      { key: "date", label: "Date" },
      { key: "weekday", label: "Weekday" },
      { key: "base", label: "Base score" },
      { key: "dynamic", label: "Dynamic score" },
      { key: "capacity", label: "Capacity" },
      { key: "booked", label: "Booked" },
      { key: "available", label: "Available" },
      { key: "utilization", label: "Utilization" },
      { key: "velocity", label: "Velocity" },
      { key: "trend", label: "Trend" },
      { key: "pressure", label: "Pressure" },
      { key: "status", label: "Status" }
    ];
    if (rankingMode) cols.push({ key: "reason", label: "Initial reason" }, { key: "actions", label: "" });

    root.innerHTML =
      Flex.ui.pageHeader(
        rankingMode ? "Day ranking" : "Season days",
        rankingMode
          ? "Initial rank is business input. Weekdays are calculated from the selected year. Dynamic score updates with bookings."
          : "Capacity, velocity, trend, and live dynamic score for every season date.",
        rankingMode ? '<button class="btn btn-primary" id="save-ranks">Save ranking</button>' : ""
      ) +
      '<div class="toolbar"><input data-search placeholder="Search dates" aria-label="Search dates"></div>' +
      Flex.ui.renderCard({
        title: rankingMode ? "Editable initial ranking" : "Season day metrics",
        body: Flex.ui.renderTable({ columns: cols, rows: display, sortKey: ctx.sortKey, sortDir: ctx.sortDir })
      });

    Flex.ui.bindSortSearch(root, function (next) {
      if (next.q != null) ctx.q = next.q;
      if (next.sortKey) {
        if (ctx.sortKey === next.sortKey) ctx.sortDir = ctx.sortDir === "asc" ? "desc" : "asc";
        else { ctx.sortKey = next.sortKey; ctx.sortDir = "desc"; }
      }
      paint();
    });

    Flex.ui.qsa("[data-up]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { move(btn.getAttribute("data-up"), -1); });
    });
    Flex.ui.qsa("[data-down]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { move(btn.getAttribute("data-down"), 1); });
    });
    var save = document.getElementById("save-ranks");
    if (save) save.addEventListener("click", saveRanks);
  }

  function move(iso, dir) {
    var dates = state.dates.slice().sort(function (a, b) { return a.rank - b.rank; });
    var idx = -1;
    dates.forEach(function (d, i) { if (d.date === iso) idx = i; });
    var swap = idx + dir;
    if (swap < 0 || swap >= dates.length) return;
    var tmp = dates[idx].rank;
    dates[idx].rank = dates[swap].rank;
    dates[swap].rank = tmp;
    dates.forEach(function (d) { d.baseScore = Flex.DEFAULT_BASE_SCORES[d.rank] || d.baseScore; });
    Flex.data.saveDates(dates);
    state = Flex.data.getState();
    Flex.ui.showToast("Ranking updated", "success");
    paint();
  }

  function saveRanks() {
    Flex.ui.qsa(".base-input", root).forEach(function (input) {
      var day = Flex.utils.dateByISO(state.dates, input.getAttribute("data-date"));
      if (day) day.baseScore = Number(input.value);
    });
    Flex.ui.qsa(".reason-input", root).forEach(function (input) {
      var day = Flex.utils.dateByISO(state.dates, input.getAttribute("data-date"));
      if (day) day.reason = input.value;
    });
    Flex.data.saveDates(state.dates);
    Flex.ui.showToast("Day ranking saved", "success");
    state = Flex.data.getState();
    paint();
  }

  paint();
};
