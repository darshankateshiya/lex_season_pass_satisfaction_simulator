var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.comparison = function (root) {
  var results = Flex.storage.load("flex_last_comparison", null);

  function highlight(rows, key, better) {
    var values = rows.map(function (r) { return r[key]; });
    var best = better === "min" ? Math.min.apply(null, values) : Math.max.apply(null, values);
    return rows.map(function (r) {
      var copy = Object.assign({}, r);
      if (r[key] === best) copy[key] = '<span class="compare-best">' + r[key] + "</span>";
      return copy;
    });
  }

  function paint(busy) {
    var scenario = (results && results.scenario) || "balanced_pref";
    var count = (results && results.userCount) || 10;
    root.innerHTML =
      Flex.ui.pageHeader("Scenario comparison", "Run the same generated customers through every algorithm. Best cells are highlighted.") +
      '<div class="toolbar">' +
        '<label class="field"><span>Users</span>' + Flex.ui.select("count", [
          { id: "10", name: "10" }, { id: "25", name: "25" }, { id: "50", name: "50" }, { id: "100", name: "100" }
        ], String(count)) + "</label>" +
        '<label class="field"><span>Scenario</span>' +
        Flex.ui.select("scenario", Object.keys(Flex.SCENARIOS).map(function (k) { return Flex.SCENARIOS[k]; }), scenario) +
        "</label>" +
        '<button class="btn btn-primary" id="run-compare"' + (busy ? " disabled" : "") + ">" + (busy ? "Running…" : "Run comparison") + "</button>" +
      "</div>" +
      (results ? renderTable(results.rows) : Flex.ui.renderEmptyState({
        title: "No comparison yet",
        body: "Run a comparison to see which algorithm protects overall satisfaction, fairness, and inventory."
      }));

    document.getElementById("run-compare").addEventListener("click", function () {
      paint(true);
      setTimeout(function () {
        var userCount = Number(Flex.ui.qs("select[name=count]").value);
        var scenarioId = Flex.ui.qs("select[name=scenario]").value;
        var rows = Flex.simulation.compareAlgorithms(userCount, scenarioId);
        results = { rows: rows, userCount: userCount, scenario: scenarioId, at: new Date().toISOString() };
        Flex.storage.save("flex_last_comparison", results);
        Flex.ui.showToast("Comparison complete", "success");
        paint(false);
      }, 30);
    });
  }

  function renderTable(rows) {
    var metrics = [
      { key: "averageSatisfaction", label: "Avg satisfaction", better: "max" },
      { key: "medianSatisfaction", label: "Median", better: "max" },
      { key: "minimumSatisfaction", label: "Minimum", better: "max" },
      { key: "p10", label: "P10", better: "max" },
      { key: "lowSatisfactionPct", label: "Low satisfaction %", better: "min" },
      { key: "fairnessIndex", label: "Fairness index", better: "max" },
      { key: "capacityUtilization", label: "Capacity utilization", better: "max" },
      { key: "premiumSlotUsage", label: "Premium slot usage", better: "min" },
      { key: "preferenceMatch", label: "Preference match %", better: "max" },
      { key: "continuity", label: "Continuity transitions", better: "max" },
      { key: "fifoConflicts", label: "FIFO tie-breaks", better: "max" }
    ];
    var tableRows = metrics.map(function (m) {
      var row = { metric: m.label };
      rows.forEach(function (r) { row[r.algorithm] = r[m.key]; });
      var best = m.better === "min"
        ? Math.min.apply(null, rows.map(function (r) { return r[m.key]; }))
        : Math.max.apply(null, rows.map(function (r) { return r[m.key]; }));
      rows.forEach(function (r) {
        if (r[m.key] === best) row[r.algorithm] = '<strong class="compare-best">' + r[m.key] + "</strong>";
      });
      return row;
    });
    var scores = rows.map(function (r) {
      return {
        algo: r.algorithm,
        score: r.averageSatisfaction * 0.35 + r.minimumSatisfaction * 0.3 + r.fairnessIndex * 0.25 - r.lowSatisfactionPct * 0.4
      };
    }).sort(function (a, b) { return b.score - a.score; });
    var winner = Flex.ALGORITHM_MODES[scores[0].algo];

    return Flex.ui.renderCard({
      title: "Algorithm comparison",
      subtitle: "Best overall in this run: " + winner.name,
      body: Flex.ui.renderTable({
        columns: [{ key: "metric", label: "Metric" }].concat(rows.map(function (r) {
          return { key: r.algorithm, label: r.algorithmName };
        })),
        rows: tableRows
      })
    }) + '<p class="help-callout">Highlighted values are best for that metric. Overall winner balances average, minimum, fairness, and low-satisfaction share — not average alone.</p>';
  }

  paint(false);
};
