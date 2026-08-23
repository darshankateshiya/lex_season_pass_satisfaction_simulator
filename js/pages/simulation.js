var Flex = window.Flex || {};
Flex.pages = Flex.pages || {};

Flex.pages.simulation = function (root) {
  var runner = null;
  var lastSnap = null;

  function configFromForm() {
    var form = document.getElementById("sim-form");
    var count = form.userCount.value === "custom" ? Number(form.customCount.value || 10) : Number(form.userCount.value);
    return {
      userCount: Flex.utils.clamp(count, 1, 400),
      scenario: form.scenario.value,
      algorithm: form.algorithm.value,
      speed: form.speed.value,
      seed: Number(form.seed.value) || 2026
    };
  }

  function paint(step) {
    var state = Flex.data.getState();
    var cfg = state.simulationConfig || Flex.simulation.defaultConfig();
    var snap = lastSnap || (state.allocations.length ? Flex.simulation.snapshot(state) : null);
    var progress = cfg.queue && cfg.queue.length ? Math.round((cfg.processed || 0) / cfg.queue.length * 100) : 0;

    root.innerHTML =
      Flex.ui.pageHeader("Run simulation", "Generate customers, apply a scenario, and allocate sequentially with live score updates.") +
      '<form id="sim-form" class="card"><div class="card-body form-grid">' +
        Flex.ui.field({
          label: "Number of users",
          control: Flex.ui.select("userCount", [
            { id: "10", name: "10" }, { id: "100", name: "100" }, { id: "250", name: "250" }, { id: "400", name: "400" }, { id: "custom", name: "Custom" }
          ], String([10, 100, 250, 400].indexOf(cfg.userCount) !== -1 ? cfg.userCount : "custom"))
        }) +
        Flex.ui.field({ label: "Custom count", attrs: 'name="customCount" type="number" min="1" max="400"', value: cfg.userCount }) +
        Flex.ui.field({
          label: "Scenario",
          control: Flex.ui.select("scenario", Object.keys(Flex.SCENARIOS).map(function (k) { return Flex.SCENARIOS[k]; }), cfg.scenario)
        }) +
        Flex.ui.field({
          label: "Algorithm",
          control: Flex.ui.select("algorithm", Object.keys(Flex.ALGORITHM_MODES).map(function (k) { return Flex.ALGORITHM_MODES[k]; }), cfg.algorithm)
        }) +
        Flex.ui.field({
          label: "Speed",
          control: Flex.ui.select("speed", [
            { id: "slow", name: "Slow" }, { id: "normal", name: "Normal" }, { id: "fast", name: "Fast" }
          ], cfg.speed)
        }) +
        Flex.ui.field({ label: "Seed", attrs: 'name="seed" type="number"', value: cfg.seed || 2026, help: "Same seed + scenario reproduces the same customers." }) +
      "</div></form>" +
      '<div class="toolbar">' +
        '<button class="btn btn-primary" id="sim-start">Start</button>' +
        '<button class="btn btn-ghost" id="sim-pause">Pause</button>' +
        '<button class="btn btn-ghost" id="sim-resume">Resume</button>' +
        '<button class="btn btn-ghost" id="sim-step">Step one user</button>' +
        '<button class="btn btn-danger" id="sim-reset">Reset</button>' +
      "</div>" +
      Flex.ui.renderCard({
        title: "Progress",
        body: Flex.ui.renderProgressBar(progress, "primary") +
          "<p>" + (cfg.processed || 0) + " / " + ((cfg.queue && cfg.queue.length) || 0) + " users processed</p>" +
          (step && step.result && !step.result.ok ? '<p class="warn-callout">' + Flex.utils.escapeHtml(step.result.error) + "</p>" : "")
      }) +
      (snap ? '<div class="metric-grid cols-4">' +
        Flex.ui.renderMetricCard({ label: "Average satisfaction", value: snap.averageSatisfaction }) +
        Flex.ui.renderMetricCard({ label: "Minimum", value: snap.minimumSatisfaction }) +
        Flex.ui.renderMetricCard({ label: "Low sat %", value: snap.lowSatisfactionPct + "%" }) +
        Flex.ui.renderMetricCard({ label: "Fairness", value: snap.fairnessIndex }) +
      "</div>" : "") +
      Flex.ui.renderCard({
        title: "Scenario notes",
        body: Object.keys(Flex.SCENARIOS).map(function (k) {
          var s = Flex.SCENARIOS[k];
          return "<p><strong>" + s.name + "</strong> — " + s.description + "</p>";
        }).join("")
      });

    document.getElementById("sim-start").addEventListener("click", function () {
      if (runner && runner.stop) runner.stop();
      lastSnap = null;
      var cfg = configFromForm();
      Flex.simulation.prepare(cfg);
      runner = Flex.simulation.runPrepared(Flex.data.getState(), {
        onStep: function (s) { lastSnap = Flex.simulation.snapshot(); paint(s); },
        onComplete: function (snap) {
          lastSnap = snap;
          Flex.ui.showToast("Simulation complete — avg " + snap.averageSatisfaction, "success");
          paint();
        }
      });
    });
    document.getElementById("sim-pause").addEventListener("click", function () {
      var stateNow = Flex.data.getState();
      if (stateNow.simulationConfig) {
        stateNow.simulationConfig.paused = true;
        Flex.storage.save(Flex.STORAGE_KEYS.simulationConfig, stateNow.simulationConfig);
      }
      Flex.ui.showToast("Simulation paused", "warn");
    });
    document.getElementById("sim-resume").addEventListener("click", function () {
      var stateNow = Flex.data.getState();
      if (!stateNow.simulationConfig || !stateNow.simulationConfig.queue) {
        Flex.ui.showToast("Start a simulation first", "danger");
        return;
      }
      stateNow.simulationConfig.paused = false;
      runner = Flex.simulation.runPrepared(stateNow, {
        onStep: function (s) { lastSnap = Flex.simulation.snapshot(); paint(s); },
        onComplete: function (snap) { lastSnap = snap; paint(); }
      });
    });
    document.getElementById("sim-step").addEventListener("click", function () {
      var stateNow = Flex.data.getState();
      if (!stateNow.simulationConfig || !stateNow.simulationConfig.queue) {
        Flex.simulation.prepare(configFromForm(), stateNow);
      }
      var step = Flex.simulation.stepOne(Flex.data.getState());
      lastSnap = Flex.simulation.snapshot();
      if (step.result && step.result.ok) Flex.ui.showToast("Customer allocated — " + step.result.allocation.satisfaction.finalScore, "success");
      else if (step.result) Flex.ui.showToast(step.result.error, "danger");
      paint(step);
    });
    document.getElementById("sim-reset").addEventListener("click", function () {
      Flex.ui.confirm({ title: "Reset simulation", body: "This removes generated simulation customers, tickets, and allocations. Demo customers are kept.", confirmLabel: "Reset" }, function () {
        if (runner && runner.stop) runner.stop();
        var stateNow = Flex.data.getState();
        Flex.simulation.resetGenerated(stateNow);
        stateNow.simulationConfig = Flex.simulation.defaultConfig();
        Flex.scoring.recalculateAllScores(stateNow);
        Flex.data.persistCore(stateNow);
        lastSnap = null;
        Flex.ui.showToast("Simulation reset", "success");
        paint();
      });
    });
  }

  paint();
};
