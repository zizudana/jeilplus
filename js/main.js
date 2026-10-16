(function () {
  "use strict";

  var header = document.querySelector("[data-header]");
  var menuToggle = document.querySelector("[data-menu-toggle]");
  var menu = document.querySelector("[data-menu]");

  function closeMenu() {
    if (!menuToggle || !menu) return;
    menuToggle.setAttribute("aria-expanded", "false");
    menu.classList.remove("is-open");
    document.body.classList.remove("menu-open");
  }

  if (menuToggle && menu) {
    menuToggle.addEventListener("click", function () {
      var open = menuToggle.getAttribute("aria-expanded") === "true";
      menuToggle.setAttribute("aria-expanded", String(!open));
      menu.classList.toggle("is-open", !open);
      document.body.classList.toggle("menu-open", !open);
    });
    menu.querySelectorAll("a").forEach(function (link) { link.addEventListener("click", closeMenu); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") closeMenu(); });
  }

  function updateHeader() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 10);
  }
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  document.querySelectorAll("[data-product-image]").forEach(function (image) {
    function update() {
      var frame = image.closest(".photo-frame");
      if (frame) frame.classList.toggle("is-missing", image.naturalWidth === 0);
    }
    image.addEventListener("error", update);
    image.addEventListener("load", update);
    if (image.complete) update();
  });

  document.querySelectorAll("[data-year]").forEach(function (element) {
    element.textContent = String(new Date().getFullYear());
  });
})();
