var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.customers = function (root) {
  var state = Flex.data.getState();
  var ctx = { q: "", page: 1, size: 12, sortKey: "sequenceNumber", sortDir: "asc" };

  function openForm(customer) {
    var isNew = !customer;
    customer = customer || {
      id: Flex.utils.uid("cust"),
      name: "",
      createdAt: new Date().toISOString(),
      source: "manual"
    };
    Flex.ui.renderModal({
      title: isNew ? "Add customer" : "Edit customer",
      body: '<form id="cust-form" class="stack">' +
        Flex.ui.field({ label: "Customer name", attrs: 'name="name" required', value: customer.name }) +
        Flex.ui.field({ label: "Customer ID", attrs: 'name="id" required', value: customer.id }) +
        Flex.ui.field({ label: "Booking timestamp", attrs: 'name="createdAt" type="datetime-local"', value: customer.createdAt.slice(0, 16) }) +
        "</form>",
      footer: '<button class="btn btn-ghost" data-close="1">Cancel</button><button class="btn btn-primary" id="save-cust">Save</button>'
    });
    document.getElementById("save-cust").addEventListener("click", function () {
      var form = document.getElementById("cust-form");
      if (!form.reportValidity()) return;
      var prefs = state.preferences[customer.id] || Flex.data.defaultPreferences(state);
      Flex.data.saveCustomer({
        id: form.id.value.trim(),
        name: form.name.value.trim(),
        createdAt: form.createdAt.value ? new Date(form.createdAt.value).toISOString() : new Date().toISOString(),
        source: customer.source || "manual"
      }, prefs);
      Flex.ui.closeOverlays();
      Flex.ui.showToast(isNew ? "Customer created" : "Customer updated", "success");
      Flex.app.render();
    });
  }

  function openBulkForm() {
    Flex.ui.renderModal({
      title: "Add customers by count",
      body: '<form id="bulk-cust-form" class="stack">' +
        Flex.ui.field({
          label: "How many customers",
          attrs: 'name="count" type="number" min="1" max="400" required',
          value: 10,
          help: "Creates this many customers only. No tickets and no day/organizer selection."
        }) +
        Flex.ui.field({
          label: "Name prefix",
          attrs: 'name="namePrefix"',
          value: "Customer",
          help: "Names will be Prefix #sequence, for example Customer #21."
        }) +
        Flex.ui.field({
          label: "Preference pattern",
          control: Flex.ui.select("scenario", [
            { id: "balanced_pref", name: "Balanced" },
            { id: "random", name: "Random" },
            { id: "popular_day_bias", name: "Popular-day bias" },
            { id: "organizer_bias", name: "Organizer bias" },
            { id: "continuous_bias", name: "Continuous-day bias" },
            { id: "no_continuous", name: "No continuous-day allowed" }
          ], "balanced_pref"),
          help: "Used later if you allocate. Tickets are not created now."
        }) +
        "</form>",
      footer: '<button class="btn btn-ghost" type="button" data-close="1">Cancel</button>' +
        '<button class="btn btn-primary" type="button" id="save-bulk">Add customers</button>'
    });
    document.getElementById("bulk-cust-form").addEventListener("submit", function (e) { e.preventDefault(); });
    document.getElementById("save-bulk").addEventListener("click", function () {
      var form = document.getElementById("bulk-cust-form");
      if (!form.reportValidity()) return;
      var count = Number(form.count.value);
      if (!count || count < 1) {
        Flex.ui.showToast("Enter a customer count of at least 1.", "danger");
        return;
      }
      var created = Flex.data.addCustomersByCount(count, {
        namePrefix: form.namePrefix.value,
        scenario: form.scenario.value
      });
      Flex.ui.closeOverlays();
      Flex.ui.showToast("Added " + created.length + " customers without tickets", "success");
      Flex.app.render();
    });
  }

  function clearCustomers() {
    Flex.ui.confirm({
      title: "Clear all customer data",
      body: "This removes every customer, plus their preferences, tickets, and allocations. Organizers and season settings stay.",
      confirmLabel: "Clear all customers"
    }, function () {
      var removed = Flex.data.clearAllCustomers();
      Flex.ui.showToast("Cleared " + removed + " customers and related ticket data", "success");
      Flex.app.render();
    });
  }

  function paint() {
    state = Flex.data.getState();
    var list = state.customers.map(function (c) {
      var alloc = state.allocations.filter(function (a) { return a.customerId === c.id; })[0];
      return {
        id: c.id,
        name: Flex.utils.escapeHtml(c.name),
        sequenceNumber: c.sequenceNumber,
        created: Flex.utils.formatDateTime(c.createdAt),
        status: alloc ? Flex.ui.renderBadge("Allocated", "success") : Flex.ui.renderBadge("Pending", "warning"),
        satisfaction: alloc ? alloc.satisfaction.finalScore : "—",
        source: c.source || "manual",
        actions: '<button class="btn btn-sm btn-ghost" data-edit="' + c.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-ghost" data-pref="' + c.id + '">Preferences</button>' +
          '<button class="btn btn-sm btn-ghost" data-alloc="' + c.id + '">Allocate</button>' +
          '<button class="btn btn-sm btn-ghost" data-del="' + c.id + '">Delete</button>',
        _search: (c.name + " " + c.id).toLowerCase()
      };
    });
    if (ctx.q) list = list.filter(function (r) { return r._search.indexOf(ctx.q.toLowerCase()) !== -1; });
    list = Flex.utils.sortBy(list, ctx.sortKey, ctx.sortDir);
    var pages = Math.max(1, Math.ceil(list.length / ctx.size));
    ctx.page = Math.min(ctx.page, pages);
    var slice = list.slice((ctx.page - 1) * ctx.size, ctx.page * ctx.size);

    root.innerHTML =
      Flex.ui.pageHeader("Customers", "Every Flex Season Pass holder. FIFO uses booking timestamp and sequence.",
        '<button class="btn btn-primary" type="button" id="add-cust">Create customer</button>' +
        '<button class="btn btn-info" type="button" id="add-by-count">Add by count</button>' +
        '<button class="btn btn-danger" type="button" id="clear-customers">Clear all customers</button>') +
      (state.customers.length ? "" : Flex.ui.renderEmptyState({
        title: "No customers yet",
        body: "Create one customer, add many by count without ticket selection, or run a simulation.",
        actions: '<button class="btn btn-primary" type="button" id="add-cust-empty">Create customer</button>' +
          '<button class="btn btn-info" type="button" id="add-by-count-empty">Add by count</button>'
      })) +
      (state.customers.length ? '<div class="toolbar"><input data-search placeholder="Search customers" aria-label="Search customers" value="' +
        Flex.utils.escapeHtml(ctx.q) + '"></div>' +
        Flex.ui.renderCard({
          body: Flex.ui.renderTable({
            columns: [
              { key: "sequenceNumber", label: "#" },
              { key: "name", label: "Name" },
              { key: "id", label: "Customer ID" },
              { key: "created", label: "Booking time" },
              { key: "status", label: "Status" },
              { key: "satisfaction", label: "Satisfaction" },
              { key: "source", label: "Source" },
              { key: "actions", label: "" }
            ],
            rows: slice,
            sortKey: ctx.sortKey,
            sortDir: ctx.sortDir
          }) + Flex.ui.renderPagination(ctx.page, pages, "cust")
        }) : "");

    ["add-cust", "add-cust-empty"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", function () { openForm(null); });
    });
    ["add-by-count", "add-by-count-empty"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("click", openBulkForm);
    });
    var clearBtn = document.getElementById("clear-customers");
    if (clearBtn) clearBtn.addEventListener("click", clearCustomers);
    Flex.ui.bindSortSearch(root, function (next) {
      if (next.q != null) { ctx.q = next.q; ctx.page = 1; }
      if (next.sortKey) {
        if (ctx.sortKey === next.sortKey) ctx.sortDir = ctx.sortDir === "asc" ? "desc" : "asc";
        else { ctx.sortKey = next.sortKey; ctx.sortDir = "asc"; }
      }
      paint();
    });
    Flex.ui.qsa("[data-page]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { ctx.page = Number(btn.getAttribute("data-page")); paint(); });
    });
    Flex.ui.qsa("[data-edit]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        openForm(state.customers.filter(function (c) { return c.id === btn.getAttribute("data-edit"); })[0]);
      });
    });
    Flex.ui.qsa("[data-pref]", root).forEach(function (btn) {
      btn.addEventListener("click", function () { location.hash = "preferences"; sessionStorage.setItem("flex_pref_customer", btn.getAttribute("data-pref")); });
    });
    Flex.ui.qsa("[data-alloc]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var customer = state.customers.filter(function (c) { return c.id === btn.getAttribute("data-alloc"); })[0];
        var result = Flex.allocation.allocateCustomer(customer, { state: Flex.data.getState() });
        if (!result.ok) Flex.ui.showToast(result.error, "danger");
        else {
          Flex.ui.showToast("Allocation completed — " + result.allocation.satisfaction.finalScore + "/100", "success");
          Flex.ui.showAllocation(result.allocation);
        }
        Flex.app.render();
      });
    });
    Flex.ui.qsa("[data-del]", root).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-del");
        Flex.ui.confirm({ title: "Delete customer", body: "This also removes their ticket and allocation.", confirmLabel: "Delete" }, function () {
          Flex.data.deleteCustomer(id);
          Flex.ui.showToast("Customer deleted", "success");
          Flex.app.render();
        });
      });
    });
  }

  paint();
};
