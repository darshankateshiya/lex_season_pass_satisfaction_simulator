var Flex = window.Flex || {};

Flex.utils = {
  uid: function (prefix) {
    return (prefix || "id") + "_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  },

  clamp: function (value, min, max) {
    return Math.min(max, Math.max(min, value));
  },

  round: function (value, digits) {
    var p = Math.pow(10, digits == null ? 1 : digits);
    return Math.round((value + Number.EPSILON) * p) / p;
  },

  pct: function (value, digits) {
    return Flex.utils.round(value, digits == null ? 1 : digits) + "%";
  },

  pad: function (n) {
    return n < 10 ? "0" + n : String(n);
  },

  toISODate: function (year, month, day) {
    return year + "-" + Flex.utils.pad(month) + "-" + Flex.utils.pad(day);
  },

  parseISODate: function (iso) {
    var parts = String(iso).split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  },

  weekdayName: function (iso) {
    return Flex.utils.parseISODate(iso).toLocaleDateString("en-US", { weekday: "long" });
  },

  weekdayShort: function (iso) {
    return Flex.utils.parseISODate(iso).toLocaleDateString("en-US", { weekday: "short" });
  },

  formatDate: function (iso) {
    var d = Flex.utils.parseISODate(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  },

  formatDateLong: function (iso) {
    var d = Flex.utils.parseISODate(iso);
    return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  },

  formatDateTime: function (ts) {
    var d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    });
  },

  formatTime: function (ts) {
    var d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleTimeString("en-GB", { hour12: false });
  },

  daysBetween: function (startISO, endISO) {
    var start = Flex.utils.parseISODate(startISO);
    var end = Flex.utils.parseISODate(endISO);
    var dates = [];
    for (var d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(Flex.utils.toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate()));
    }
    return dates;
  },

  calculateSeasonDates: function (config) {
    var year = config.year;
    var start = Flex.utils.toISODate(year, config.startMonth, config.startDay);
    var end = Flex.utils.toISODate(year, config.endMonth, config.endDay);
    return Flex.utils.daysBetween(start, end);
  },

  sortBy: function (arr, key, dir) {
    var copy = arr.slice();
    var factor = dir === "asc" ? 1 : -1;
    copy.sort(function (a, b) {
      var av = typeof key === "function" ? key(a) : a[key];
      var bv = typeof key === "function" ? key(b) : b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return av.localeCompare(bv) * (dir === "desc" ? -1 : 1);
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
    return copy;
  },

  percentile: function (values, p) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var idx = (p / 100) * (sorted.length - 1);
    var lo = Math.floor(idx);
    var hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  },

  median: function (values) {
    return Flex.utils.percentile(values, 50);
  },

  mean: function (values) {
    if (!values.length) return 0;
    var sum = 0;
    for (var i = 0; i < values.length; i++) sum += values[i];
    return sum / values.length;
  },

  min: function (values) {
    if (!values.length) return 0;
    return Math.min.apply(null, values);
  },

  max: function (values) {
    if (!values.length) return 0;
    return Math.max.apply(null, values);
  },

  combinations: function (arr, k) {
    var result = [];
    function rec(start, combo) {
      if (combo.length === k) {
        result.push(combo.slice());
        return;
      }
      for (var i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        rec(i + 1, combo);
        combo.pop();
      }
    }
    rec(0, []);
    return result;
  },

  consecutiveRuns: function (sortedDates) {
    if (!sortedDates.length) return [];
    var runs = [];
    var current = [sortedDates[0]];
    for (var i = 1; i < sortedDates.length; i++) {
      var prev = Flex.utils.parseISODate(sortedDates[i - 1]);
      var next = Flex.utils.parseISODate(sortedDates[i]);
      var diff = (next - prev) / 86400000;
      if (diff === 1) {
        current.push(sortedDates[i]);
      } else {
        runs.push(current);
        current = [sortedDates[i]];
      }
    }
    runs.push(current);
    return runs;
  },

  findConsecutiveBlocks: function (dates, length) {
    var sorted = dates.slice().sort();
    var blocks = [];
    for (var i = 0; i <= sorted.length - length; i++) {
      var block = [sorted[i]];
      var ok = true;
      for (var j = 1; j < length; j++) {
        var prev = Flex.utils.parseISODate(sorted[i + j - 1]);
        var next = Flex.utils.parseISODate(sorted[i + j]);
        if ((next - prev) / 86400000 !== 1) {
          ok = false;
          break;
        }
        block.push(sorted[i + j]);
      }
      if (ok) blocks.push(block);
    }
    return blocks;
  },

  deepClone: function (value) {
    return JSON.parse(JSON.stringify(value));
  },

  escapeHtml: function (str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  debounce: function (fn, wait) {
    var t;
    return function () {
      var ctx = this;
      var args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  },

  download: function (filename, text, type) {
    var blob = new Blob([text], { type: type || "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  },

  satisfactionCategory: function (score) {
    var cats = Flex.SATISFACTION_CATEGORIES;
    for (var i = 0; i < cats.length; i++) {
      if (score >= cats[i].min && score <= cats[i].max) return cats[i];
    }
    return cats[cats.length - 1];
  },

  pressureLabel: function (pressure, levels) {
    levels = levels || Flex.DEFAULT_SETTINGS.demandPressureLevels;
    if (pressure < levels.veryLow) return { label: "Very Low", tone: "success" };
    if (pressure < levels.low) return { label: "Low", tone: "info" };
    if (pressure < levels.medium) return { label: "Medium", tone: "warning" };
    if (pressure < levels.high) return { label: "High", tone: "orange" };
    return { label: "Critical", tone: "danger" };
  },

  heatmapTone: function (util, thresholds) {
    thresholds = thresholds || Flex.DEFAULT_SETTINGS.heatmapThresholds;
    if (util <= thresholds.green) return "green";
    if (util <= thresholds.blue) return "blue";
    if (util <= thresholds.yellow) return "yellow";
    if (util <= thresholds.orange) return "orange";
    return "red";
  },

  organizerById: function (organizers, id) {
    for (var i = 0; i < organizers.length; i++) {
      if (organizers[i].id === id) return organizers[i];
    }
    return null;
  },

  dateByISO: function (dates, iso) {
    for (var i = 0; i < dates.length; i++) {
      if (dates[i].date === iso) return dates[i];
    }
    return null;
  },

  weightsSum: function (weights) {
    var sum = 0;
    Object.keys(weights).forEach(function (k) { sum += Number(weights[k]) || 0; });
    return Flex.utils.round(sum, 2);
  },

  normalizeWeights: function (weights) {
    var sum = Flex.utils.weightsSum(weights);
    if (!sum) return weights;
    var out = {};
    Object.keys(weights).forEach(function (k) { out[k] = weights[k] / sum; });
    return out;
  },

  seededRandom: function (seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  },

  shuffle: function (arr, rng) {
    var copy = arr.slice();
    rng = rng || Math.random;
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }
};

window.Flex = Flex;
