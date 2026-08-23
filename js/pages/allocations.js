var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.allocations = function (root) {
  Flex.pages.renderAllocations(root, false);
};

Flex.pages.analysis = function (root) {
  Flex.pages.renderAllocations(root, true);
};

Flex.pages.renderAllocations = function (root, analysis) {
  var state = Flex.data.getState();
  var ctx = { q: "", page: 1, size: 10 };

  function paint() {
    state = Flex.data.getState();
    var rows = state.allocations.map(function (a) {
      var c = state.customers.filter(function (x) { return x.id === a.customerId; })[0];
      var cat = Flex.utils.satisfactionCategory(a.satisfaction.finalScore);
      return {
        customer: c ? Flex.utils.escapeHtml(c.name) : a.customerId,
        algorithm: a.algorithmId,
        score: a.satisfaction.finalScore,
        category: Flex.ui.renderBadge(cat.label, cat.tone),
        pref: a.satisfaction.userPreferenceScore,
        fifo: a.fifoApplied ? Flex.ui.renderBadge("FIFO tie-break", "info") : "—",
        created: Flex.utils.formatDateTime(a.createdAt),
        actions: '<button class="btn btn-sm btn-ghost" data-open="' + a.allocationId + '">Explain</button>',
        _id: a.allocationId,
        _search: ((c && c.name) || a.customerId).toLowerCase()
      };
    });
    if (ctx.q) rows = rows.filter(function (r) { return r._search.indexOf(ctx.q.toLowerCase()) !== -1; });
    var pages = Math.max(1, Math.ceil(rows.length / ctx.size));
    ctx.page = Math.min(ctx.page, pages);
    var slice = rows.slice((ctx.page - 1) * ctx.size, ctx.page * ctx.size);
    var selected = state.allocations[0];

    var analysisBody = "";
    if (analysis) {
      var reasons = {};
      state.allocations.forEach(function (a) {
        (a.reasons || []).forEach(function (r) {
          reasons[r] = (reasons[r] || 0) + 1;
        });
      });
      var topReasons = Object.keys(reasons).map(function (r) {
        return { label: r.replace("✓ ", "").slice(0, 42), value: reasons[r] };
      }).sort(function (a, b) { return b.value - a.value; }).slice(0, 8);
      analysisBody = Flex.ui.renderCard({
        title: "Decision pattern analysis",
        subtitle: "Most common explanation lines across allocations",
        body: topReasons.length ? Flex.charts.hbar(topReasons) : "<p>No allocations to analyse.</p>"
      }) + Flex.ui.renderCard({
        title: "Sample 10-day timeline",
        body: selected ? Flex.ui.allocationTimeline(selected) :
          Flex.ui.renderEmptyState({ title: "No allocation to inspect", body: "Allocate a customer to see the day-by-day schedule." })
      });
    }

    root.innerHTML =
      Flex.ui.pageHeader(analysis ? "Allocation analysis" : "Allocations",
        analysis
          ? "Inspect why schedules were chosen. Continuity and FIFO are soft; hard quotas always win."
          : "Every allocated Flex Pass, with explainable scoring.") +
      (state.allocations.length ? '<div class="toolbar"><input data-search placeholder="Search allocations" aria-label="Search allocations"></div>' : "") +
      analysisBody +
      Flex.ui.renderCard({
        title: "Allocation results",
        body: Flex.ui.renderTable({
          columns: [
            { key: "customer", label: "Customer" },
            { key: "algorithm", label: "Algorithm" },
            { key: "score", label: "Satisfaction" },
            { key: "category", label: "Category" },
            { key: "pref", label: "Preference" },
            { key: "fifo", label: "FIFO" },
            { key: "created", label: "Created" },
            { key: "actions", label: "" }
          ],
          rows: slice,
          emptyTitle: "No allocations yet",
          emptyBody: "Smart-allocate a customer or run a simulation.",
          emptyActions: '<a class="btn btn-primary" href="#tickets">Create ticket</a><a class="btn btn-ghost" href="#simulation">Run simulation</a>'
        }) + Flex.ui.renderPagination(ctx.page, pages, "alloc")
      });

    Flex.ui.bindSortSearch(root, function (next) {
      if (next.q != null) { ctx.q = next.q; ctx.page = 1; paint(); }
    });
    Flex.ui.qsa("[data-page]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { ctx.page = Number(btn.getAttribute("data-page")); paint(); });
    });
    Flex.ui.qsa("[data-open]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var alloc = state.allocations.filter(function (a) { return a.allocationId === btn.getAttribute("data-open"); })[0];
        if (alloc) Flex.ui.showAllocation(alloc);
      });
    });
  }

  paint();
};
