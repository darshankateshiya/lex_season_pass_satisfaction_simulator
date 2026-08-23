var Flex = window.Flex || {};

Flex.app = {
  page: "dashboard",

  init: function () {
    Flex.data.init();
    Flex.app.bindShell();
    window.addEventListener("hashchange", Flex.app.render);
    Flex.app.render();
  },

  currentPage: function () {
    var hash = (location.hash || "#dashboard").replace("#", "");
    if (!Flex.pages[hash]) return "dashboard";
    return hash;
  },

  bindShell: function () {
    var nav = document.getElementById("sidebar-nav");
    var groups = [];
    Flex.NAV.forEach(function (item) {
      if (groups.indexOf(item.group) === -1) groups.push(item.group);
    });
    nav.innerHTML = groups.map(function (group) {
      var links = Flex.NAV.filter(function (i) { return i.group === group; }).map(function (item) {
        return '<a class="nav-link" href="#' + item.id + '" data-nav="' + item.id + '">' + item.label + "</a>";
      }).join("");
      return '<div class="nav-group"><div class="nav-group-label">' + group + "</div>" + links + "</div>";
    }).join("");

    var menu = document.getElementById("menu-btn");
    var sidebar = document.getElementById("sidebar");
    menu.addEventListener("click", function () {
      sidebar.classList.toggle("is-open");
    });
    nav.addEventListener("click", function () {
      sidebar.classList.remove("is-open");
    });
  },

  render: function () {
    Flex.app.page = Flex.app.currentPage();
    Flex.ui.qsa("[data-nav]").forEach(function (link) {
      link.classList.toggle("is-active", link.getAttribute("data-nav") === Flex.app.page);
    });
    var item = Flex.NAV.filter(function (n) { return n.id === Flex.app.page; })[0];
    document.getElementById("topbar-title").textContent = item ? item.label : "Dashboard";
    document.title = (item ? item.label + " · " : "") + "Flex Season Pass Simulator";
    var root = document.getElementById("page-root");
    root.innerHTML = "";
    Flex.pages[Flex.app.page](root);
  }
};

document.addEventListener("DOMContentLoaded", Flex.app.init);
