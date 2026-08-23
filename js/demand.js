var Flex = window.Flex || {};

Flex.demand = {
  calculateDailyCapacity: function (organizers, dateISO) {
    var total = 0;
    organizers.forEach(function (org) {
      total += Number(org.ticketsPerDay) || 0;
    });
    return total;
  },

  calculateTotalCapacity: function (organizers, dates) {
    return Flex.demand.calculateDailyCapacity(organizers) * dates.length;
  },

  theoreticalMaxPasses: function (organizers, dates) {
    var totalDaysRequired = 0;
    organizers.forEach(function (org) { totalDaysRequired += org.requiredDays; });
    if (!totalDaysRequired) return 0;
    return Math.floor(Flex.demand.calculateTotalCapacity(organizers, dates) / totalDaysRequired);
  },

  emptyInventory: function (organizers, dates) {
    var inv = {};
    organizers.forEach(function (org) {
      inv[org.id] = {};
      dates.forEach(function (d) {
        inv[org.id][d.date] = org.ticketsPerDay;
      });
    });
    return inv;
  },

  applyAllocations: function (inventory, allocations) {
    allocations.forEach(function (alloc) {
      if (!alloc || !alloc.selectedDays) return;
      alloc.selectedDays.forEach(function (day) {
        if (!inventory[day.organizerId] || inventory[day.organizerId][day.date] == null) return;
        inventory[day.organizerId][day.date] -= 1;
      });
    });
    return inventory;
  },

  buildInventory: function (state, excludeCustomerId) {
    var inv = Flex.demand.emptyInventory(state.organizers, state.dates);
    state.allocations.forEach(function (alloc) {
      if (excludeCustomerId && alloc.customerId === excludeCustomerId) return;
      if (!alloc.selectedDays) return;
      alloc.selectedDays.forEach(function (day) {
        if (inv[day.organizerId] && inv[day.organizerId][day.date] != null) {
          inv[day.organizerId][day.date] -= 1;
        }
      });
    });
    return inv;
  },

  bookedForSlot: function (state, organizerId, dateISO, excludeCustomerId) {
    var booked = 0;
    state.allocations.forEach(function (alloc) {
      if (excludeCustomerId && alloc.customerId === excludeCustomerId) return;
      (alloc.selectedDays || []).forEach(function (day) {
        if (day.organizerId === organizerId && day.date === dateISO) booked += 1;
      });
    });
    return booked;
  },

  calculateOrganizerDayUtilization: function (state, organizerId, dateISO, excludeCustomerId) {
    var org = Flex.utils.organizerById(state.organizers, organizerId);
    if (!org) return { capacity: 0, booked: 0, available: 0, utilization: 0 };
    var booked = Flex.demand.bookedForSlot(state, organizerId, dateISO, excludeCustomerId);
    var available = Math.max(0, org.ticketsPerDay - booked);
    return {
      capacity: org.ticketsPerDay,
      booked: booked,
      available: available,
      utilization: org.ticketsPerDay ? (booked / org.ticketsPerDay) * 100 : 0
    };
  },

  calculateDateUtilization: function (state, dateISO, excludeCustomerId) {
    var capacity = Flex.demand.calculateDailyCapacity(state.organizers, dateISO);
    var booked = 0;
    state.organizers.forEach(function (org) {
      booked += Flex.demand.bookedForSlot(state, org.id, dateISO, excludeCustomerId);
    });
    return {
      capacity: capacity,
      booked: booked,
      available: Math.max(0, capacity - booked),
      utilization: capacity ? (booked / capacity) * 100 : 0
    };
  },

  bookingsForDate: function (state, dateISO) {
    var out = [];
    state.allocations.forEach(function (alloc) {
      (alloc.selectedDays || []).forEach(function (day) {
        if (day.date === dateISO) {
          out.push({
            customerId: alloc.customerId,
            organizerId: day.organizerId,
            createdAt: alloc.createdAt
          });
        }
      });
    });
    return out;
  },

  bookingsForSlot: function (state, organizerId, dateISO) {
    return Flex.demand.bookingsForDate(state, dateISO).filter(function (b) {
      return b.organizerId === organizerId;
    });
  },

  countInWindow: function (bookings, now, hours) {
    var from = now - hours * 3600000;
    var count = 0;
    bookings.forEach(function (b) {
      var t = new Date(b.createdAt).getTime();
      if (t >= from && t <= now) count += 1;
    });
    return count;
  },

  calculateBookingVelocity: function (bookings, now, capacity) {
    now = now || Date.now();
    capacity = capacity || 1;
    var last1 = Flex.demand.countInWindow(bookings, now, 1);
    var last3 = Flex.demand.countInWindow(bookings, now, 3);
    var last6 = Flex.demand.countInWindow(bookings, now, 6);
    var last24 = Flex.demand.countInWindow(bookings, now, 24);
    var weightedRate = last1 * 4 + last3 * 2 + last6 * 1 + last24 * 0.25;
    var score = Flex.utils.clamp((weightedRate / Math.max(8, capacity * 0.35)) * 100, 0, 100);
    return {
      last1: last1,
      last3: last3,
      last6: last6,
      last24: last24,
      score: score
    };
  },

  calculateDemandTrend: function (bookings, now, settings) {
    now = now || Date.now();
    settings = settings || Flex.DEFAULT_SETTINGS;
    var currentH = settings.trendCurrentHours || 6;
    var prevH = settings.trendPreviousHours || 6;
    var current = Flex.demand.countInWindow(bookings, now, currentH);
    var previous = Flex.demand.countInWindow(bookings, now - currentH * 3600000, prevH);
    var ratio;
    if (previous === 0 && current === 0) ratio = 1;
    else if (previous === 0) ratio = 2.5;
    else ratio = current / previous;
    var score = Flex.utils.clamp(50 + (ratio - 1) * 40, 0, 100);
    return {
      current: current,
      previous: previous,
      ratio: ratio,
      score: score
    };
  },

  buildPendingIndex: function (state, excludeCustomerId) {
    var index = {};
    state.organizers.forEach(function (org) {
      index[org.id] = {};
      state.dates.forEach(function (d) { index[org.id][d.date] = 0; });
    });
    var allocated = {};
    state.allocations.forEach(function (a) { allocated[a.customerId] = true; });
    state.customers.forEach(function (c) {
      if (excludeCustomerId && c.id === excludeCustomerId) return;
      if (allocated[c.id]) return;
      var prefs = state.preferences[c.id];
      if (!prefs) return;
      state.organizers.forEach(function (org) {
        var ranked = prefs[org.id] || [];
        for (var i = 0; i < 3 && i < ranked.length; i++) {
          if (index[org.id] && index[org.id][ranked[i]] != null) index[org.id][ranked[i]] += 1;
        }
      });
    });
    return index;
  },

  pendingDemandForSlot: function (state, organizerId, dateISO, excludeCustomerId) {
    var cacheKey = excludeCustomerId || "_all";
    if (!state._pendingIndex || state._pendingIndexKey !== cacheKey || state._pendingIndexAllocations !== state.allocations.length) {
      state._pendingIndex = Flex.demand.buildPendingIndex(state, excludeCustomerId);
      state._pendingIndexKey = cacheKey;
      state._pendingIndexAllocations = state.allocations.length;
    }
    return (state._pendingIndex[organizerId] && state._pendingIndex[organizerId][dateISO]) || 0;
  },

  calculateDemandPressure: function (pending, remaining) {
    if (remaining <= 0) return pending > 0 ? 8 : 0;
    return pending / remaining;
  },

  slotMetrics: function (state, organizerId, dateISO, now, excludeCustomerId) {
    var util = Flex.demand.calculateOrganizerDayUtilization(state, organizerId, dateISO, excludeCustomerId);
    var bookings = Flex.demand.bookingsForSlot(state, organizerId, dateISO);
    var velocity = Flex.demand.calculateBookingVelocity(bookings, now, util.capacity);
    var trend = Flex.demand.calculateDemandTrend(bookings, now, state.settings);
    var pending = Flex.demand.pendingDemandForSlot(state, organizerId, dateISO, excludeCustomerId);
    var pressure = Flex.demand.calculateDemandPressure(pending, util.available);
    return {
      utilization: util,
      velocity: velocity,
      trend: trend,
      pending: pending,
      pressure: pressure,
      pressureMeta: Flex.utils.pressureLabel(pressure, state.settings.demandPressureLevels)
    };
  },

  dateMetrics: function (state, dateISO, now, excludeCustomerId) {
    var util = Flex.demand.calculateDateUtilization(state, dateISO, excludeCustomerId);
    var bookings = Flex.demand.bookingsForDate(state, dateISO);
    var velocity = Flex.demand.calculateBookingVelocity(bookings, now, util.capacity);
    var trend = Flex.demand.calculateDemandTrend(bookings, now, state.settings);
    var pending = 0;
    var remaining = util.available;
    state.organizers.forEach(function (org) {
      pending += Flex.demand.pendingDemandForSlot(state, org.id, dateISO, excludeCustomerId);
    });
    var pressure = Flex.demand.calculateDemandPressure(pending, remaining);
    return {
      utilization: util,
      velocity: velocity,
      trend: trend,
      pending: pending,
      pressure: pressure,
      pressureMeta: Flex.utils.pressureLabel(pressure, state.settings.demandPressureLevels)
    };
  }
};

window.Flex = Flex;
