var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.organizers = function (root) {
  var state = Flex.data.getState();
  Flex.scoring.recalculateAllScores(state);

  function openForm(org) {
    var isNew = !org;
    org = org || { id: Flex.utils.uid("org"), name: "", rank: state.organizers.length + 1, ticketsPerDay: 80, requiredDays: 2, maxDays: 3, color: "#334155" };
    Flex.ui.renderModal({
      title: isNew ? "Add organizer" : "Edit organizer",
      body: '<form id="org-form" class="form-grid">' +
        Flex.ui.field({ label: "Name", attrs: 'name="name" required', value: org.name }) +
        Flex.ui.field({ label: "Rank", attrs: 'name="rank" type="number" min="1" required', value: org.rank }) +
        Flex.ui.field({ label: "Tickets / day", attrs: 'name="ticketsPerDay" type="number" min="1" required', value: org.ticketsPerDay }) +
        Flex.ui.field({ label: "Required days / user", attrs: 'name="requiredDays" type="number" min="1" required', value: org.requiredDays, help: "Minimum days a customer must receive." }) +
        Flex.ui.field({ label: "Max days / user", attrs: 'name="maxDays" type="number" min="1" required', value: Flex.data.maxDays(org), help: "In a " + state.dates.length + "-day event this organizer can be selected on at most this many days." }) +
        Flex.ui.field({ label: "Color", attrs: 'name="color" type="color"', value: org.color }) +
        "</form>",
      footer: '<button class="btn btn-ghost" type="button" data-close="1">Cancel</button><button class="btn btn-primary" type="button" id="save-org">Save</button>'
    });
    document.getElementById("org-form").addEventListener("submit", function (e) {
      e.preventDefault();
    });
    document.getElementById("save-org").addEventListener("click", function () {
      var form = document.getElementById("org-form");
      if (!form.reportValidity()) return;
      var requiredDays = Number(form.requiredDays.value);
      var maxDays = Number(form.maxDays.value);
      if (maxDays < requiredDays) {
        Flex.ui.showToast("Max days cannot be lower than required days.", "danger");
        return;
      }
      if (maxDays > state.dates.length) {
        Flex.ui.showToast("Max days cannot exceed the " + state.dates.length + "-day event.", "danger");
        return;
      }
      Flex.data.saveOrganizer({
        id: org.id,
        name: form.name.value.trim(),
        rank: Number(form.rank.value),
        ticketsPerDay: Number(form.ticketsPerDay.value),
        requiredDays: requiredDays,
        maxDays: maxDays,
        color: form.color.value
      });
      Flex.ui.closeOverlays();
      Flex.ui.showToast(isNew ? "Organizer added" : "Organizer updated", "success");
      Flex.app.render();
    });
  }

  var cards = state.organizers.map(function (org) {
    var booked = 0;
    var capacity = org.ticketsPerDay * state.dates.length;
    state.dates.forEach(function (d) {
      booked += Flex.demand.bookedForSlot(state, org.id, d.date);
    });
    var available = Math.max(0, capacity - booked);
    var util = capacity ? (booked / capacity) * 100 : 0;
    var hot = state.dates.map(function (d) {
      return state.organizerDayScores[org.id] && state.organizerDayScores[org.id][d.date];
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; })[0];
    return '<article class="org-card">' +
      Flex.ui.renderBadge("Rank " + org.rank, "primary") +
      "<h3><span class='org-swatch' style='background:" + org.color + "'></span>" + Flex.utils.escapeHtml(org.name) + "</h3>" +
      '<div class="org-meta">' + org.ticketsPerDay + " tickets/day · " + org.requiredDays + " required / " + Flex.data.maxDays(org) + " max days per pass</div>" +
      '<div class="org-stats">' +
        "<div><div class='metric-label'>Season capacity</div><strong>" + capacity + "</strong></div>" +
        "<div><div class='metric-label'>Booked</div><strong>" + booked + "</strong></div>" +
        "<div><div class='metric-label'>Available</div><strong>" + available + "</strong></div>" +
      "</div>" +
      Flex.ui.renderProgressBar(util, util > 85 ? "danger" : "primary") +
      "<p class='org-meta'>Utilization " + Flex.utils.round(util, 1) + "% · Hottest slot score " + (hot ? hot.score : "—") + "</p>" +
      '<div class="toolbar">' +
        '<button class="btn btn-ghost btn-sm" data-edit="' + org.id + '">Edit</button>' +
        '<button class="btn btn-ghost btn-sm" data-demand="' + org.id + '">View demand</button>' +
        '<button class="btn btn-ghost btn-sm" data-alloc="' + org.id + '">View allocation</button>' +
        '<button class="btn btn-ghost btn-sm" data-del="' + org.id + '">Delete</button>' +
      "</div></article>";
  }).join("");

  root.innerHTML =
    Flex.ui.pageHeader("Organizers", "Inventory, required days, and live utilization for each organizer.",
      '<button class="btn btn-primary" id="add-org">Add organizer</button>') +
    (cards ? '<div class="org-grid">' + cards + "</div>" :
      Flex.ui.renderEmptyState({ title: "No organizers", body: "Add the Flex Pass organizers to begin.", actions: '<button class="btn btn-primary" id="add-org">Add organizer</button>' }));

  var add = document.getElementById("add-org");
  if (add) add.addEventListener("click", function () { openForm(null); });
  Flex.ui.qsa("[data-edit]", root).forEach(function (btn) {
    btn.addEventListener("click", function () {
      openForm(Flex.utils.organizerById(state.organizers, btn.getAttribute("data-edit")));
    });
  });
  Flex.ui.qsa("[data-demand]", root).forEach(function (btn) {
    btn.addEventListener("click", function () { location.hash = "demand"; });
  });
  Flex.ui.qsa("[data-alloc]", root).forEach(function (btn) {
    btn.addEventListener("click", function () { location.hash = "allocations"; });
  });
  Flex.ui.qsa("[data-del]", root).forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-del");
      Flex.ui.confirm({ title: "Delete organizer", body: "This removes the organizer from the season model. Existing allocations may become invalid until re-run.", confirmLabel: "Delete" }, function () {
        Flex.data.deleteOrganizer(id);
        Flex.ui.showToast("Organizer deleted", "success");
        Flex.app.render();
      });
    });
  });
};
