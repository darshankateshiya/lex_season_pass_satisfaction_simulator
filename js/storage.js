var Flex = window.Flex || {};

Flex.storage = {
  save: function (key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      console.error("Storage save failed", key, err);
      return false;
    }
  },

  load: function (key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error("Storage load failed", key, err);
      return fallback;
    }
  },

  remove: function (key) {
    localStorage.removeItem(key);
  },

  clearAll: function () {
    Object.keys(Flex.STORAGE_KEYS).forEach(function (k) {
      localStorage.removeItem(Flex.STORAGE_KEYS[k]);
    });
  },

  exportData: function () {
    var payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      product: "flex-season-pass-simulator"
    };
    Object.keys(Flex.STORAGE_KEYS).forEach(function (k) {
      payload[k] = Flex.storage.load(Flex.STORAGE_KEYS[k], null);
    });
    return payload;
  },

  validateImport: function (payload) {
    if (!payload || typeof payload !== "object") return { ok: false, error: "File is not a JSON object." };
    if (payload.product && payload.product !== "flex-season-pass-simulator") {
      return { ok: false, error: "JSON is not a Flex Season Pass simulator export." };
    }
    var required = ["organizers", "seasonConfig", "dates", "settings"];
    for (var i = 0; i < required.length; i++) {
      if (!(required[i] in payload) && !(Flex.STORAGE_KEYS[required[i]] in payload)) {
        return { ok: false, error: "Missing required key: " + required[i] };
      }
    }
    var organizers = payload.organizers || payload[Flex.STORAGE_KEYS.organizers];
    if (!Array.isArray(organizers) || !organizers.length) {
      return { ok: false, error: "Import must include at least one organizer." };
    }
    var dates = payload.dates || payload[Flex.STORAGE_KEYS.dates];
    if (!Array.isArray(dates) || !dates.length) {
      return { ok: false, error: "Import must include season dates." };
    }
    return { ok: true };
  },

  importData: function (payload) {
    var check = Flex.storage.validateImport(payload);
    if (!check.ok) return check;
    Object.keys(Flex.STORAGE_KEYS).forEach(function (k) {
      var value = payload[k];
      if (value === undefined) value = payload[Flex.STORAGE_KEYS[k]];
      if (value !== undefined && value !== null) {
        Flex.storage.save(Flex.STORAGE_KEYS[k], value);
      }
    });
    return { ok: true };
  }
};

window.Flex = Flex;
