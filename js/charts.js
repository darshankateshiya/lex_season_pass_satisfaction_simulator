var Flex = window.Flex || {};

Flex.charts = {
  bar: function (items, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
    var bars = items.map(function (item) {
      var h = Math.max(4, (item.value / max) * 120);
      return '<div class="chart-bar"><div class="chart-col" style="height:' + h +
        'px;background:' + (item.color || "var(--primary)") + '"></div><strong>' +
        Flex.utils.round(item.value, opts.digits == null ? 0 : opts.digits) +
        "</strong><span>" + Flex.utils.escapeHtml(item.label) + "</span></div>";
    }).join("");
    return '<div class="bar-chart" role="img" aria-label="' + Flex.utils.escapeHtml(opts.title || "Bar chart") + '">' + bars + "</div>";
  },

  hbar: function (items) {
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
    return '<div class="hbar-chart">' + items.map(function (item) {
      var w = (item.value / max) * 100;
      return '<div class="hbar-row"><span>' + Flex.utils.escapeHtml(item.label) +
        "</span><div class='hbar-track'><div class='hbar-fill' style='width:" + w +
        "%;background:" + (item.color || "var(--primary)") + "'></div></div><em>" +
        Flex.utils.round(item.value, 1) + "</em></div>";
    }).join("") + "</div>";
  },

  distribution: function (allocations) {
    var counts = Flex.satisfaction.categoryCounts(allocations);
    var total = allocations.length || 1;
    var items = Flex.SATISFACTION_CATEGORIES.map(function (c) {
      var colors = {
        success: "#15803d",
        info: "#1d4ed8",
        primary: "#1e3a5f",
        warning: "#ca8a04",
        orange: "#c2410c",
        danger: "#b91c1c"
      };
      return {
        label: c.label,
        value: counts[c.id] || 0,
        pct: Flex.utils.round(((counts[c.id] || 0) / total) * 100, 1),
        color: colors[c.tone]
      };
    });
    return Flex.charts.bar(items.map(function (i) {
      return { label: i.label, value: i.value, color: i.color };
    })) + '<ul class="dist-legend">' + items.map(function (i) {
      return "<li><i style='background:" + i.color + "'></i>" + i.label + " — <strong>" +
        i.value + "</strong> (" + i.pct + "%)</li>";
    }).join("") + "</ul>";
  },

  sparkline: function (values, color) {
    if (!values.length) return "";
    var w = 220;
    var h = 56;
    var max = Math.max.apply(null, values.concat([1]));
    var min = Math.min.apply(null, values.concat([0]));
    var span = Math.max(1, max - min);
    var pts = values.map(function (v, i) {
      var x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
      var y = h - ((v - min) / span) * (h - 8) - 4;
      return x + "," + y;
    }).join(" ");
    return '<svg class="spark" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h +
      '" aria-hidden="true"><polyline fill="none" stroke="' + (color || "#1d4ed8") +
      '" stroke-width="2" points="' + pts + '"/></svg>';
  }
};

window.Flex = Flex;
