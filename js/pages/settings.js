var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.rules = function (root) {
  Flex.pages.renderSettings(root, "rules");
};
Flex.pages.settings = function (root) {
  Flex.pages.renderSettings(root, "settings");
};
Flex.pages.data = function (root) {
  Flex.pages.renderSettings(root, "data");
};

Flex.pages.renderSettings = function (root, tab) {
  var state = Flex.data.getState();
  var s = state.settings;

  function weightFields(prefix, weights) {
    return Object.keys(weights).map(function (k) {
      return Flex.ui.field({
        label: k.replace(/([A-Z])/g, " $1").replace(/^./, function (c) { return c.toUpperCase(); }),
        attrs: 'name="' + prefix + "." + k + '" type="number" min="0" max="100" step="1"',
        value: weights[k]
      });
    }).join("");
  }

  function readWeights(form, prefix, keys) {
    var out = {};
    keys.forEach(function (k) { out[k] = Number(form[prefix + "." + k].value); });
    return out;
  }

  var satSum = Flex.utils.weightsSum(s.satisfactionWeights);
  var daySum = Flex.utils.weightsSum(s.dayScoreWeights);
  var odSum = Flex.utils.weightsSum(s.organizerDayWeights);

  var rulesHtml =
    Flex.ui.pageHeader("Scoring rules", "Every weight is used by the live allocator. Warnings appear when a group does not sum to 100.") +
    '<form id="rules-form" class="stack">' +
      Flex.ui.renderCard({
        title: "Satisfaction weights",
        body: '<div class="form-grid">' + weightFields("sat", s.satisfactionWeights) + "</div>" +
          (satSum === 100 ? "" : '<p class="warn-callout">Satisfaction weights currently sum to ' + satSum + "%. They should total 100%.</p>")
      }) +
      Flex.ui.renderCard({
        title: "Dynamic day score weights",
        body: '<div class="form-grid">' + weightFields("day", s.dayScoreWeights) + "</div>" +
          (daySum === 100 ? "" : '<p class="warn-callout">Day score weights currently sum to ' + daySum + "%.</p>")
      }) +
      Flex.ui.renderCard({
        title: "Organizer / day score weights",
        body: '<div class="form-grid">' + weightFields("od", s.organizerDayWeights) + "</div>" +
          (odSum === 100 ? "" : '<p class="warn-callout">Organizer/day weights currently sum to ' + odSum + "%.</p>")
      }) +
      Flex.ui.renderCard({
        title: "Thresholds",
        body: '<div class="form-grid">' +
          Flex.ui.field({ label: "Low demand pressure", attrs: 'name="pVeryLow" type="number" step="0.05"', value: s.demandPressureLevels.veryLow }) +
          Flex.ui.field({ label: "High demand pressure", attrs: 'name="pMedium" type="number" step="0.05"', value: s.demandPressureLevels.medium }) +
          Flex.ui.field({ label: "Critical demand pressure", attrs: 'name="pHigh" type="number" step="0.05"', value: s.demandPressureLevels.high }) +
          Flex.ui.field({ label: "Low satisfaction threshold", attrs: 'name="lowSat" type="number"', value: s.lowSatisfactionThreshold }) +
          Flex.ui.field({ label: "FIFO tolerance", attrs: 'name="fifoTol" type="number" step="0.1"', value: s.fifoTolerance, help: "If two global scores differ by this much or less, earlier booking wins." }) +
          Flex.ui.field({ label: "Continuity bonus", attrs: 'name="contBonus" type="number"', value: s.continuityBonus }) +
        "</div>"
      }) +
      '<div class="toolbar"><button class="btn btn-primary" type="submit">Save scoring rules</button></div>' +
    "</form>";

  var settingsHtml =
    Flex.ui.pageHeader("Settings", "Season identity and year. Weekdays are never hardcoded.") +
    '<form id="season-form" class="card"><div class="card-body form-grid">' +
      Flex.ui.field({ label: "Season name", attrs: 'name="name" required', value: state.seasonConfig.name }) +
      Flex.ui.field({ label: "Year", attrs: 'name="year" type="number" min="2020" max="2040" required', value: state.seasonConfig.year }) +
      Flex.ui.field({ label: "Start month", attrs: 'name="startMonth" type="number" min="1" max="12"', value: state.seasonConfig.startMonth }) +
      Flex.ui.field({ label: "Start day", attrs: 'name="startDay" type="number" min="1" max="31"', value: state.seasonConfig.startDay }) +
      Flex.ui.field({ label: "End month", attrs: 'name="endMonth" type="number" min="1" max="12"', value: state.seasonConfig.endMonth }) +
      Flex.ui.field({ label: "End day", attrs: 'name="endDay" type="number" min="1" max="31"', value: state.seasonConfig.endDay }) +
    '</div><div class="card-body"><button class="btn btn-primary" type="submit">Save season</button></div></form>' +
    Flex.ui.renderCard({
      title: "Algorithm modes",
      body: Object.keys(Flex.ALGORITHM_MODES).map(function (k) {
        var m = Flex.ALGORITHM_MODES[k];
        return "<p><strong>" + m.name + "</strong> — " + m.description + "</p>";
      }).join("") + '<p class="help-callout">' + Flex.BEST_SATISFACTION_DEFINITION + "</p>"
    });

  var dataHtml =
    Flex.ui.pageHeader("Data management", "localStorage only. Import is validated before it replaces the workspace.") +
    '<div class="toolbar">' +
      '<button class="btn btn-primary" id="export-json">Export JSON</button>' +
      '<label class="btn btn-ghost">Import JSON<input id="import-json" type="file" accept="application/json" hidden></label>' +
      '<button class="btn btn-ghost" id="reset-demo">Reset to demo</button>' +
      '<button class="btn btn-danger" id="clear-customers">Clear all customers</button>' +
      '<button class="btn btn-danger" id="clear-all">Clear all data</button>' +
    "</div>" +
    Flex.ui.renderCard({
      title: "Current workspace",
      body: "<p>Organizers: " + state.organizers.length + "</p><p>Customers: " +
        state.customers.length + "</p><p>Allocations: " + state.allocations.length +
        "</p><p>Tickets: " + state.tickets.length + "</p>"
    });

  root.innerHTML = tab === "rules" ? rulesHtml : tab === "data" ? dataHtml : settingsHtml;

  var rulesForm = document.getElementById("rules-form");
  if (rulesForm) {
    rulesForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var sat = readWeights(rulesForm, "sat", Object.keys(s.satisfactionWeights));
      var day = readWeights(rulesForm, "day", Object.keys(s.dayScoreWeights));
      var od = readWeights(rulesForm, "od", Object.keys(s.organizerDayWeights));
      if (Flex.utils.weightsSum(sat) !== 100) {
        Flex.ui.showToast("Cannot save scoring rules: satisfaction weights must total 100%.", "danger");
        return;
      }
      state.settings.satisfactionWeights = sat;
      state.settings.dayScoreWeights = day;
      state.settings.organizerDayWeights = od;
      state.settings.demandPressureLevels.veryLow = Number(rulesForm.pVeryLow.value);
      state.settings.demandPressureLevels.low = Number(rulesForm.pVeryLow.value) + 0.5;
      state.settings.demandPressureLevels.medium = Number(rulesForm.pMedium.value);
      state.settings.demandPressureLevels.high = Number(rulesForm.pHigh.value);
      state.settings.lowSatisfactionThreshold = Number(rulesForm.lowSat.value);
      state.settings.fifoTolerance = Number(rulesForm.fifoTol.value);
      state.settings.continuityBonus = Number(rulesForm.contBonus.value);
      Flex.scoring.recalculateAllScores(state);
      Flex.data.persistCore(state);
      Flex.ui.showToast("Scoring rules saved", "success");
      Flex.app.render();
    });
  }

  var seasonForm = document.getElementById("season-form");
  if (seasonForm) {
    seasonForm.addEventListener("submit", function (e) {
      e.preventDefault();
      Flex.data.saveSeason({
        name: seasonForm.name.value.trim(),
        year: Number(seasonForm.year.value),
        startMonth: Number(seasonForm.startMonth.value),
        startDay: Number(seasonForm.startDay.value),
        endMonth: Number(seasonForm.endMonth.value),
        endDay: Number(seasonForm.endDay.value)
      });
      Flex.ui.showToast("Season updated — weekdays recalculated", "success");
      Flex.app.render();
    });
  }

  var exp = document.getElementById("export-json");
  if (exp) exp.addEventListener("click", function () {
    Flex.utils.download("flex-season-pass-export.json", JSON.stringify(Flex.storage.exportData(), null, 2));
    Flex.ui.showToast("Export ready", "success");
  });
  var imp = document.getElementById("import-json");
  if (imp) imp.addEventListener("change", function () {
    var file = imp.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var payload = JSON.parse(reader.result);
        var result = Flex.storage.importData(payload);
        if (!result.ok) {
          Flex.ui.showToast(result.error, "danger");
          return;
        }
        Flex.data._state = Flex.data.loadState();
        Flex.scoring.recalculateAllScores(Flex.data._state);
        Flex.ui.showToast("Import complete", "success");
        Flex.app.render();
      } catch (err) {
        Flex.ui.showToast("Import failed: invalid JSON.", "danger");
      }
    };
    reader.readAsText(file);
  });
  var reset = document.getElementById("reset-demo");
  if (reset) reset.addEventListener("click", function () {
    Flex.ui.confirm({ title: "Reset to demo", body: "This replaces the workspace with the built-in Navrat 2026 demo.", confirmLabel: "Reset demo" }, function () {
      Flex.data.resetDemo();
      Flex.ui.showToast("Demo data restored", "success");
      Flex.app.render();
    });
  });
  var clearCustomers = document.getElementById("clear-customers");
  if (clearCustomers) clearCustomers.addEventListener("click", function () {
    Flex.ui.confirm({
      title: "Clear all customer data",
      body: "This removes every customer, plus their preferences, tickets, and allocations. Organizers and season settings stay.",
      confirmLabel: "Clear all customers"
    }, function () {
      var removed = Flex.data.clearAllCustomers();
      Flex.ui.showToast("Cleared " + removed + " customers and related ticket data", "success");
      Flex.app.render();
    });
  });
  var clear = document.getElementById("clear-all");
  if (clear) clear.addEventListener("click", function () {
    Flex.ui.confirm({ title: "Clear all data", body: "This wipes customers, tickets, allocations, and logs. Organizer defaults are restored.", confirmLabel: "Clear all" }, function () {
      Flex.data.clearAllData();
      Flex.ui.showToast("Workspace cleared", "success");
      Flex.app.render();
    });
  });
};
