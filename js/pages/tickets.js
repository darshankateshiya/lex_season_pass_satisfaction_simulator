var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.tickets = function (root) {
  var state = Flex.data.getState();
  var selected = {};
  var customerId = state.customers[0] && state.customers[0].id;
  var createdAt = new Date().toISOString().slice(0, 16);

  function counts() {
    var byOrg = {};
    state.organizers.forEach(function (o) { byOrg[o.id] = 0; });
    Object.keys(selected).forEach(function (d) { if (selected[d]) byOrg[selected[d]] += 1; });
    return {
      dates: Object.keys(selected).length,
      byOrg: byOrg,
      complete: Object.keys(selected).length === state.dates.length &&
        state.organizers.every(function (o) { return Flex.data.quotaOk(byOrg[o.id], o); })
    };
  }

  function liveSatisfaction() {
    var customer = state.customers.filter(function (c) { return c.id === customerId; })[0];
    if (!customer) return null;
    var days = Object.keys(selected).map(function (iso) {
      var org = Flex.utils.organizerById(state.organizers, selected[iso]);
      var ranked = ((state.preferences[customer.id] || {})[org.id] || []);
      var idx = ranked.indexOf(iso);
      return {
        date: iso,
        organizerId: org.id,
        organizerName: org.name,
        preferenceRank: idx >= 0 ? idx + 1 : 10,
        preferenceScore: Flex.scoring.preferenceScoreForRank(idx >= 0 ? idx + 1 : 10)
      };
    });
    if (!days.length) return null;
    return Flex.satisfaction.calculateCustomerSatisfaction(days, {
      state: state,
      customer: customer,
      booking: { createdAt: createdAt, customerId: customer.id },
      algorithmId: "balanced"
    });
  }

  function paint() {
    state = Flex.data.getState();
    Flex.scoring.recalculateAllScores(state);
    if (!state.customers.length) {
      root.innerHTML = Flex.ui.pageHeader("Tickets", "Create a booking and optionally pick a manual schedule.") +
        Flex.ui.renderEmptyState({ title: "No customers yet", body: "Create a customer first.", actions: '<a class="btn btn-primary" href="#customers">Create customer</a>' });
      return;
    }
    if (!customerId) customerId = state.customers[0].id;
    var c = counts();
    var sat = liveSatisfaction();
    var cards = state.dates.map(function (d) {
      var s = state.dayScores[d.date] || {};
      var choices = state.organizers.map(function (org) {
        var on = selected[d.date] === org.id;
        var atMax = c.byOrg[org.id] >= Flex.data.maxDays(org) && !on;
        var maxRun = Flex.allocation.maxConsecutiveDays(state);
        var orgDates = Object.keys(selected).filter(function (iso) {
          return selected[iso] === org.id && iso !== d.date;
        });
        var consecutiveBlocked = !on && maxRun != null &&
          Flex.allocation.exceedsMaxConsecutive(orgDates.concat([d.date]), maxRun);
        var blocked = atMax || consecutiveBlocked;
        var consecutiveHint = "";
        if (consecutiveBlocked && maxRun === 1) consecutiveHint = " <small>not next to same organizer</small>";
        if (consecutiveBlocked && maxRun > 1) consecutiveHint = " <small>no 3-day continue</small>";
        return '<label class="' + (on ? "is-on" : "") + (blocked ? " is-disabled" : "") + '"><input type="radio" name="org-' + d.date + '" value="' + org.id + '"' +
          (on ? " checked" : "") + (blocked ? " disabled" : "") + '> ' + Flex.utils.escapeHtml(org.name) +
          (atMax ? " <small>max " + Flex.data.maxDays(org) + "</small>" : "") +
          consecutiveHint + "</label>";
      }).join("");
      return '<article class="day-card" data-date="' + d.date + '"><h3>' + Flex.utils.formatDate(d.date) +
        "</h3><div class='muted'>" + Flex.utils.weekdayName(d.date) + "</div>" +
        "<div>Dynamic score <strong>" + (s.dynamicScore || "—") + "</strong></div>" +
        "<div>Demand " + Flex.ui.renderBadge((s.pressureMeta && s.pressureMeta.label) || "—", (s.pressureMeta && s.pressureMeta.tone) || "neutral") + "</div>" +
        "<div class='muted'>Utilization " + (s.utilization || 0) + "%</div>" +
        '<div class="org-choice">' + choices + "</div>" +
        (selected[d.date] ? '<button class="btn btn-sm btn-ghost" data-clear="' + d.date + '">Clear</button>' : "") +
        "</article>";
    }).join("");

    var quota = state.organizers.map(function (o) {
      var n = c.byOrg[o.id];
      var maxDays = Flex.data.maxDays(o);
      var ok = Flex.data.quotaOk(n, o);
      return "<div>" + Flex.utils.escapeHtml(o.name) + " <strong>" + n + " / " + maxDays + " max</strong>" +
        " <span class='muted'>min " + o.requiredDays + "</span> " +
        (ok ? "✓" : n > maxDays ? "over max" : "") + "</div>";
    }).join("");

    var ticketRows = state.tickets.map(function (t) {
      var cust = state.customers.filter(function (x) { return x.id === t.customerId; })[0];
      return {
        id: t.id,
        customer: cust ? Flex.utils.escapeHtml(cust.name) : t.customerId,
        created: Flex.utils.formatDateTime(t.createdAt),
        seq: t.sequenceNumber,
        status: Flex.ui.renderBadge(t.status || "pending", t.status === "allocated" ? "success" : "warning")
      };
    });

    root.innerHTML =
      Flex.ui.pageHeader("Tickets", "Professional booking desk. Exactly one organizer per date. Quotas are hard constraints.") +
      '<div class="layout-split"><div>' +
        '<div class="toolbar">' +
          '<label class="field"><span>Customer</span>' + Flex.ui.select("customer", state.customers.map(function (x) { return { id: x.id, name: x.name }; }), customerId) + "</label>" +
          Flex.ui.field({ label: "Booking timestamp", attrs: 'name="createdAt" type="datetime-local"', value: createdAt }) +
          '<button class="btn btn-info" id="auto-alloc">Smart allocate</button>' +
          '<button class="btn btn-primary" id="save-ticket"' + (c.complete ? "" : " disabled") + ">Create ticket & allocate</button>" +
        "</div>" +
        '<div class="date-grid">' + cards + "</div>" +
      "</div>" +
      Flex.ui.renderCard({
        className: "summary-panel",
        title: "Flex pass summary",
        body: "<div>Dates selected <strong>" + c.dates + " / " + state.dates.length + "</strong></div>" + quota +
          "<p>Current satisfaction <strong>" + (sat ? sat.finalScore : "—") + " / 100</strong></p>" +
          "<p>Status: <strong>" + (c.complete ? "READY" : "Incomplete") + "</strong></p>" +
          '<p class="help-callout">FIFO is only a tie-breaker. The first customer does not automatically receive every favorite day.</p>'
      }) +
      "</div>" +
      Flex.ui.renderCard({
        title: "Ticket ledger",
        body: Flex.ui.renderTable({
          columns: [
            { key: "seq", label: "#" },
            { key: "customer", label: "Customer" },
            { key: "id", label: "Booking ID" },
            { key: "created", label: "Created" },
            { key: "status", label: "Status" }
          ],
          rows: ticketRows,
          emptyTitle: "No tickets yet",
          emptyBody: "Create a booking from this desk or run a simulation."
        })
      });

    Flex.ui.qs("select[name=customer]", root).addEventListener("change", function (e) {
      customerId = e.target.value;
      selected = {};
      paint();
    });
    Flex.ui.qs("input[name=createdAt]", root).addEventListener("change", function (e) {
      createdAt = e.target.value;
    });
    Flex.ui.qsa(".org-choice input", root).forEach(function (input) {
      input.addEventListener("change", function () {
        var date = input.closest(".day-card").getAttribute("data-date");
        var already = Object.keys(selected).some(function (d) { return d === date && selected[d] && selected[d] !== input.value; });
        if (already) {
          Flex.ui.showToast("Cannot select two organizers on " + Flex.utils.formatDate(date), "danger");
        }
        var org = Flex.utils.organizerById(state.organizers, input.value);
        var nextCount = Object.keys(selected).filter(function (d) {
          return d !== date && selected[d] === input.value;
        }).length + 1;
        if (org && nextCount > Flex.data.maxDays(org)) {
          Flex.ui.showToast("Cannot select " + org.name + ": max " + Flex.data.maxDays(org) + " days in this " + state.dates.length + "-day event.", "danger");
          paint();
          return;
        }
        if (org) {
          var maxRun = Flex.allocation.maxConsecutiveDays(state);
          if (maxRun != null) {
            var orgDates = Object.keys(selected).filter(function (iso) {
              return iso !== date && selected[iso] === org.id;
            });
            if (Flex.allocation.exceedsMaxConsecutive(orgDates.concat([date]), maxRun)) {
              Flex.ui.showToast(
                maxRun === 1
                  ? ("Cannot select " + org.name + " on " + Flex.utils.formatDate(date) + ": same organizer is already on an adjacent day.")
                  : ("Cannot select " + org.name + " on " + Flex.utils.formatDate(date) + ": no 3-day continue. 14 or 20 is still allowed if it is not next to the 2-day block."),
                "danger"
              );
              paint();
              return;
            }
          }
        }
        selected[date] = input.value;
        paint();
      });
    });
    Flex.ui.qsa("[data-clear]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        delete selected[btn.getAttribute("data-clear")];
        paint();
      });
    });
    document.getElementById("auto-alloc").addEventListener("click", function () {
      var customer = state.customers.filter(function (x) { return x.id === customerId; })[0];
      var result = Flex.allocation.allocateCustomer(customer, {
        state: Flex.data.getState(),
        booking: {
          id: Flex.utils.uid("bkg"),
          customerId: customer.id,
          createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
          sequenceNumber: state.tickets.length + 1
        }
      });
      if (!result.ok) Flex.ui.showToast(result.error, "danger");
      else {
        Flex.ui.showToast("Allocation completed", "success");
        Flex.ui.showAllocation(result.allocation);
        Flex.app.render();
      }
    });
    document.getElementById("save-ticket").addEventListener("click", function () {
      var customer = state.customers.filter(function (x) { return x.id === customerId; })[0];
      var result = Flex.allocation.allocateManual(customer, selected, {
        state: Flex.data.getState(),
        createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString()
      });
      if (!result.ok) Flex.ui.showToast(result.error, "danger");
      else {
        Flex.ui.showToast("Ticket created", "success");
        Flex.ui.showAllocation(result.allocation);
        selected = {};
        Flex.app.render();
      }
    });
  }

  paint();
};
