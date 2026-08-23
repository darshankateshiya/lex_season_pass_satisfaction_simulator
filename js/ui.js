var Flex = window.Flex || {};

Flex.ui = {
  el: function (html) {
    var wrap = document.createElement("div");
    wrap.innerHTML = String(html).trim();
    return wrap.firstElementChild;
  },

  qs: function (sel, root) {
    return (root || document).querySelector(sel);
  },

  qsa: function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  },

  renderBadge: function (label, tone) {
    return '<span class="badge badge-' + (tone || "neutral") + '">' + Flex.utils.escapeHtml(label) + "</span>";
  },

  renderProgressBar: function (value, tone) {
    var v = Flex.utils.clamp(value, 0, 100);
    return '<div class="progress" role="progressbar" aria-valuenow="' + Flex.utils.round(v, 0) +
      '" aria-valuemin="0" aria-valuemax="100"><span class="progress-fill tone-' +
      (tone || "primary") + '" style="width:' + v + '%"></span></div>';
  },

  renderMetricCard: function (opts) {
    return '<article class="metric-card">' +
      '<div class="metric-label">' + Flex.utils.escapeHtml(opts.label) + "</div>" +
      '<div class="metric-value">' + opts.value + "</div>" +
      (opts.hint ? '<div class="metric-hint">' + opts.hint + "</div>" : "") +
      "</article>";
  },

  renderCard: function (opts) {
    return '<section class="card' + (opts.className ? " " + opts.className : "") + '">' +
      (opts.title || opts.actions ? '<header class="card-head"><div><h2>' +
        (opts.title || "") + "</h2>" + (opts.subtitle ? "<p>" + opts.subtitle + "</p>" : "") +
        "</div><div class='card-actions'>" + (opts.actions || "") + "</div></header>" : "") +
      '<div class="card-body">' + (opts.body || "") + "</div></section>";
  },

  renderEmptyState: function (opts) {
    return '<div class="empty-state">' +
      "<h3>" + Flex.utils.escapeHtml(opts.title) + "</h3>" +
      "<p>" + Flex.utils.escapeHtml(opts.body || "") + "</p>" +
      '<div class="empty-actions">' + (opts.actions || "") + "</div></div>";
  },

  renderTable: function (opts) {
    var cols = opts.columns || [];
    var rows = opts.rows || [];
    var sortKey = opts.sortKey;
    var sortDir = opts.sortDir || "desc";
    if (!rows.length) {
      return Flex.ui.renderEmptyState({
        title: opts.emptyTitle || "Nothing to show yet",
        body: opts.emptyBody || "Data will appear here once the simulator has records.",
        actions: opts.emptyActions || ""
      });
    }
    var head = cols.map(function (c) {
      var sortable = c.sort !== false;
      var active = sortKey === c.key;
      return '<th data-sort="' + Flex.utils.escapeHtml(c.key) + '" class="' +
        (sortable ? "sortable" : "") + (active ? " is-sorted" : "") + '">' +
        Flex.utils.escapeHtml(c.label) + (active ? (sortDir === "asc" ? " ↑" : " ↓") : "") + "</th>";
    }).join("");
    var body = rows.map(function (row) {
      return "<tr" + (row._attr || "") + ">" + cols.map(function (c) {
        return "<td>" + (row[c.key] != null ? row[c.key] : "") + "</td>";
      }).join("") + "</tr>";
    }).join("");
    return '<div class="table-wrap"><table class="data-table">' +
      "<thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></div>";
  },

  renderPagination: function (page, pages, id) {
    if (pages <= 1) return "";
    return '<div class="pagination" data-pager="' + id + '">' +
      '<button class="btn btn-ghost" data-page="' + Math.max(1, page - 1) + '" ' + (page <= 1 ? "disabled" : "") + ">Prev</button>" +
      "<span>Page " + page + " of " + pages + "</span>" +
      '<button class="btn btn-ghost" data-page="' + Math.min(pages, page + 1) + '" ' + (page >= pages ? "disabled" : "") + ">Next</button>" +
      "</div>";
  },

  renderHeatmap: function (state) {
    var dates = state.dates;
    var orgs = state.organizers;
    var scores = state.organizerDayScores || {};
    var head = '<th class="sticky-col">Organizer</th>' + dates.map(function (d) {
      return "<th>" + Flex.utils.formatDate(d.date) + "<small>" + Flex.utils.weekdayShort(d.date) + "</small></th>";
    }).join("");
    var body = orgs.map(function (org) {
      var cells = dates.map(function (d) {
        var slot = scores[org.id] && scores[org.id][d.date];
        var util = slot ? slot.utilization : 0;
        var tone = Flex.utils.heatmapTone(util, state.settings.heatmapThresholds);
        var title = org.name + " · " + Flex.utils.formatDate(d.date) +
          " · " + Flex.utils.round(util, 1) + "% · " +
          (slot ? slot.booked + "/" + slot.capacity : "0/0") +
          " · score " + (slot ? slot.score : "—");
        return '<td><button class="heat-cell heat-' + tone + '" data-org="' + org.id +
          '" data-date="' + d.date + '" title="' + Flex.utils.escapeHtml(title) +
          '"><strong>' + Flex.utils.round(util, 0) +
          '%</strong><span>' + (slot ? slot.booked + "/" + slot.capacity : "0/0") +
          "</span><em>" + (slot ? slot.score : "—") + "</em></button></td>";
      }).join("");
      return '<tr><th class="sticky-col"><span class="org-swatch" style="background:' +
        org.color + '"></span>' + Flex.utils.escapeHtml(org.name) + "</th>" + cells + "</tr>";
    }).join("");
    return '<div class="heatmap-wrap"><table class="heatmap"><thead><tr>' + head +
      "</tr></thead><tbody>" + body + "</tbody></table></div>";
  },

  pageHeader: function (title, subtitle, actions) {
    return '<div class="page-header"><div><h1>' + title + "</h1><p>" +
      (subtitle || "") + "</p></div><div class='page-actions'>" + (actions || "") + "</div></div>";
  },

  showToast: function (message, tone) {
    var host = document.getElementById("toast-host");
    if (!host) return;
    var el = Flex.ui.el('<div class="toast toast-' + (tone || "info") + '" role="status">' +
      Flex.utils.escapeHtml(message) + "</div>");
    host.appendChild(el);
    setTimeout(function () { el.classList.add("is-out"); }, 3200);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 3800);
  },

  closeOverlays: function () {
    var modal = document.getElementById("modal-root");
    var drawer = document.getElementById("drawer-root");
    if (modal) modal.innerHTML = "";
    if (drawer) drawer.innerHTML = "";
  },

  renderModal: function (opts) {
    var root = document.getElementById("modal-root");
    root.innerHTML = '<div class="overlay"><div class="modal" role="dialog" aria-modal="true" aria-label="' +
      Flex.utils.escapeHtml(opts.title) + '"><header class="modal-head"><h2>' + opts.title +
      '</h2><button class="icon-btn" type="button" data-close="1" aria-label="Close">✕</button></header><div class="modal-body">' +
      (opts.body || "") + '</div><footer class="modal-foot">' + (opts.footer ||
      '<button class="btn btn-ghost" type="button" data-close="1">Cancel</button>') +
      "</footer></div></div>";
    Flex.ui.qsa("button[data-close]", root).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        Flex.ui.closeOverlays();
      });
    });
    var overlay = Flex.ui.qs(".overlay", root);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) Flex.ui.closeOverlays();
    });
    var modal = Flex.ui.qs(".modal", root);
    if (modal) {
      modal.addEventListener("click", function (e) { e.stopPropagation(); });
    }
    return root;
  },

  renderDrawer: function (opts) {
    var root = document.getElementById("drawer-root");
    root.innerHTML = '<div class="overlay"><aside class="drawer" role="dialog" aria-modal="true"><header class="modal-head"><h2>' +
      opts.title + '</h2><button class="icon-btn" type="button" data-close="1" aria-label="Close">✕</button></header><div class="modal-body">' +
      (opts.body || "") + "</div></aside></div>";
    Flex.ui.qsa("button[data-close]", root).forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        Flex.ui.closeOverlays();
      });
    });
    Flex.ui.qs(".overlay", root).addEventListener("click", function (e) {
      if (e.target.classList.contains("overlay")) Flex.ui.closeOverlays();
    });
    var drawer = Flex.ui.qs(".drawer", root);
    if (drawer) {
      drawer.addEventListener("click", function (e) { e.stopPropagation(); });
    }
    return root;
  },

  confirm: function (opts, onYes) {
    Flex.ui.renderModal({
      title: opts.title,
      body: "<p>" + Flex.utils.escapeHtml(opts.body) + "</p>",
      footer: '<button class="btn btn-ghost" data-close="1">Cancel</button>' +
        '<button class="btn btn-danger" id="confirm-yes">' + (opts.confirmLabel || "Confirm") + "</button>"
    });
    document.getElementById("confirm-yes").addEventListener("click", function () {
      Flex.ui.closeOverlays();
      onYes();
    });
  },

  field: function (opts) {
    return '<label class="field"><span>' + Flex.utils.escapeHtml(opts.label) + "</span>" +
      (opts.control || '<input ' + (opts.attrs || "") + ' value="' +
        Flex.utils.escapeHtml(opts.value == null ? "" : opts.value) + '">') +
      (opts.help ? "<small>" + opts.help + "</small>" : "") + "</label>";
  },

  select: function (name, options, value) {
    return '<select name="' + name + '">' + options.map(function (o) {
      var val = o.id || o.value;
      return '<option value="' + val + '"' + (String(val) === String(value) ? " selected" : "") + ">" +
        Flex.utils.escapeHtml(o.name || o.label) + "</option>";
    }).join("") + "</select>";
  },

  bindSortSearch: function (root, onChange) {
    Flex.ui.qsa("th.sortable", root).forEach(function (th) {
      th.addEventListener("click", function () {
        onChange({ sortKey: th.getAttribute("data-sort") });
      });
    });
    var search = Flex.ui.qs("[data-search]", root);
    if (search) search.addEventListener("input", Flex.utils.debounce(function () {
      onChange({ q: search.value });
    }, 160));
  },

  healthLabel: function (kpis) {
    if (!kpis.ticketsAllocated) return { label: "Idle", tone: "neutral", text: "No allocations yet. Season is ready." };
    if (kpis.minimumSatisfaction < 50 || kpis.lowSatisfactionPct > 15) {
      return { label: "At risk", tone: "danger", text: "Minimum satisfaction or low-score share needs attention." };
    }
    if (kpis.utilizationPct > 90 && kpis.averageSatisfaction < 75) {
      return { label: "Tight", tone: "warning", text: "Inventory is scarce and satisfaction is under pressure." };
    }
    if (kpis.averageSatisfaction >= 85 && kpis.fairnessIndex >= 80) {
      return { label: "Healthy", tone: "success", text: "Population satisfaction and fairness are in a strong range." };
    }
    return { label: "Stable", tone: "info", text: "Season is operating with manageable trade-offs." };
  },

  allocationTimeline: function (allocation) {
    if (!allocation) return "";
    return '<ol class="timeline">' + allocation.selectedDays.map(function (d) {
      return "<li><div class='tl-date'><strong>" + Flex.utils.formatDate(d.date) +
        "</strong><span>" + Flex.utils.weekdayName(d.date) + "</span></div>" +
        "<div class='tl-org'><span class='dot' style='background:" +
        ((Flex.utils.organizerById(Flex.data.getState().organizers, d.organizerId) || {}).color || "#334") +
        "'></span>" + Flex.utils.escapeHtml(d.organizerName) + "</div>" +
        "<div class='tl-meta'>" + Flex.ui.renderBadge("Pref #" + (d.preferenceRank || "–"), "info") +
        Flex.ui.renderBadge((d.demandPressureLabel || "Demand") + " " + d.demandPressure, "neutral") +
        Flex.ui.renderBadge(d.utilization + "% used", "neutral") +
        "</div><p>" + Flex.utils.escapeHtml(d.reason) + "</p></li>";
    }).join("") + "</ol>";
  },

  explanationHtml: function (allocation, state) {
    var text = Flex.satisfaction.explainAllocation(allocation, state);
    var sat = allocation.satisfaction || {};
    return '<div class="explain">' +
      '<div class="explain-score">' + sat.finalScore + "<small>/100</small></div>" +
      Flex.ui.allocationTimeline(allocation) +
      '<pre class="explain-text">' + Flex.utils.escapeHtml(text) + "</pre></div>";
  },

  showAllocation: function (allocation) {
    var state = Flex.data.getState();
    var customer = state.customers.filter(function (c) { return c.id === allocation.customerId; })[0];
    Flex.ui.renderDrawer({
      title: "Allocation explanation — " + (customer ? customer.name : allocation.customerId),
      body: Flex.ui.explanationHtml(allocation, state)
    });
  },

  showSlot: function (orgId, dateISO) {
    var state = Flex.data.getState();
    var org = Flex.utils.organizerById(state.organizers, orgId);
    var slot = state.organizerDayScores[orgId] && state.organizerDayScores[orgId][dateISO];
    var day = state.dayScores[dateISO];
    Flex.ui.renderModal({
      title: org.name + " · " + Flex.utils.formatDateLong(dateISO),
      body: '<div class="metric-grid cols-3">' +
        Flex.ui.renderMetricCard({ label: "Dynamic score", value: slot ? slot.score : "—" }) +
        Flex.ui.renderMetricCard({ label: "Utilization", value: slot ? slot.utilization + "%" : "—" }) +
        Flex.ui.renderMetricCard({ label: "Booked", value: slot ? slot.booked + " / " + slot.capacity : "—" }) +
        Flex.ui.renderMetricCard({ label: "Available", value: slot ? slot.available : "—" }) +
        Flex.ui.renderMetricCard({ label: "Demand pressure", value: slot ? slot.pressure + " · " + slot.pressureMeta.label : "—" }) +
        Flex.ui.renderMetricCard({ label: "Pending top-3 demand", value: slot ? slot.pending : "—" }) +
        Flex.ui.renderMetricCard({ label: "Velocity", value: slot ? slot.velocity : "—" }) +
        Flex.ui.renderMetricCard({ label: "Trend", value: slot ? slot.trend : "—" }) +
        Flex.ui.renderMetricCard({ label: "Day dynamic score", value: day ? day.dynamicScore : "—" }) +
        "</div>",
      footer: '<button class="btn btn-primary" data-close="1">Close</button>'
    });
  }
};

window.Flex = Flex;
