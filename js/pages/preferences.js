var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.preferences = function (root) {
  var state = Flex.data.getState();
  var selectedId = sessionStorage.getItem("flex_pref_customer") || (state.customers[0] && state.customers[0].id);

  function currentCustomer() {
    return state.customers.filter(function (c) { return c.id === selectedId; })[0];
  }

  function ensurePrefs(customer) {
    if (!state.preferences[customer.id]) state.preferences[customer.id] = Flex.data.defaultPreferences(state);
    state.organizers.forEach(function (org) {
      var dates = state.dates.map(function (d) { return d.date; });
      var existing = state.preferences[customer.id][org.id] || [];
      var merged = existing.filter(function (d) { return dates.indexOf(d) !== -1; });
      dates.forEach(function (d) { if (merged.indexOf(d) === -1) merged.push(d); });
      state.preferences[customer.id][org.id] = merged;
    });
  }

  function paint() {
    state = Flex.data.getState();
    if (!state.customers.length) {
      root.innerHTML = Flex.ui.pageHeader("Customer preferences", "Rank preferred dates for each organizer.") +
        Flex.ui.renderEmptyState({
          title: "No customers yet",
          body: "Create a customer before ranking dates.",
          actions: '<a class="btn btn-primary" href="#customers">Create customer</a>'
        });
      return;
    }
    if (!currentCustomer()) selectedId = state.customers[0].id;
    var customer = currentCustomer();
    ensurePrefs(customer);
    var prefs = state.preferences[customer.id];

    var cols = state.organizers.map(function (org) {
      var items = prefs[org.id].map(function (iso, i) {
        return '<li class="rank-item" draggable="true" data-org="' + org.id + '" data-date="' + iso + '">' +
          '<span class="rank-num">' + (i + 1) + "</span>" +
          "<div><strong>" + Flex.utils.formatDate(iso) + "</strong> · " + Flex.utils.weekdayShort(iso) +
          "</div>" + Flex.ui.renderBadge(Flex.scoring.preferenceScoreForRank(i + 1), "info") +
          '<button class="btn btn-sm btn-ghost" data-up-org="' + org.id + '" data-date="' + iso + '">↑</button>' +
          '<button class="btn btn-sm btn-ghost" data-down-org="' + org.id + '" data-date="' + iso + '">↓</button></li>';
      }).join("");
      return '<section class="card"><header class="card-head"><div><h2>' +
        Flex.utils.escapeHtml(org.name) + "</h2><p>Drag to rank, or use arrows</p></div></header>" +
        '<div class="card-body"><ol class="rank-list" data-list="' + org.id + '">' + items + "</ol></div></section>";
    }).join("");

    root.innerHTML =
      Flex.ui.pageHeader("Customer preferences", "Each customer ranks dates independently per organizer.") +
      '<div class="toolbar"><label class="field" style="min-width:280px"><span>Customer</span>' +
      Flex.ui.select("customer", state.customers.map(function (c) { return { id: c.id, name: c.name }; }), selectedId) +
      "</label><button class="btn btn-primary" id="save-prefs">Save preferences</button></div>" +
      '<div class="pref-cols">' + cols + "</div>";

    Flex.ui.qs("select[name=customer]", root).addEventListener("change", function (e) {
      selectedId = e.target.value;
      sessionStorage.setItem("flex_pref_customer", selectedId);
      paint();
    });

    function move(orgId, iso, dir) {
      var list = prefs[orgId];
      var idx = list.indexOf(iso);
      var swap = idx + dir;
      if (swap < 0 || swap >= list.length) return;
      var tmp = list[idx];
      list[idx] = list[swap];
      list[swap] = tmp;
      paint();
    }
    Flex.ui.qsa("[data-up-org]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { move(btn.getAttribute("data-up-org"), btn.getAttribute("data-date"), -1); });
    });
    Flex.ui.qsa("[data-down-org]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { move(btn.getAttribute("data-down-org"), btn.getAttribute("data-date"), 1); });
    });

    Flex.ui.qsa(".rank-item", root).forEach(function (item) {
      item.addEventListener("dragstart", function (e) {
        e.dataTransfer.setData("text/plain", item.getAttribute("data-org") + "|" + item.getAttribute("data-date"));
      });
    });
    Flex.ui.qsa(".rank-list", root).forEach(function (list) {
      list.addEventListener("dragover", function (e) { e.preventDefault(); });
      list.addEventListener("drop", function (e) {
        e.preventDefault();
        var parts = e.dataTransfer.getData("text/plain").split("|");
        var orgId = parts[0];
        var fromDate = parts[1];
        if (orgId !== list.getAttribute("data-list")) return;
        var target = e.target.closest(".rank-item");
        if (!target) return;
        var arr = prefs[orgId];
        var from = arr.indexOf(fromDate);
        var to = arr.indexOf(target.getAttribute("data-date"));
        if (from < 0 || to < 0) return;
        arr.splice(to, 0, arr.splice(from, 1)[0]);
        paint();
      });
    });

    document.getElementById("save-prefs").addEventListener("click", function () {
      Flex.data.saveCustomer(customer, prefs);
      Flex.ui.showToast("Preferences saved", "success");
    });
  }

  paint();
};
