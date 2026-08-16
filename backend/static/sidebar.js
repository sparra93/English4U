const SIDEBAR_COLLAPSED_KEY = "english-ai-tutor-sidebar-collapsed";

function initSidebarToggle() {
  const sidebar = document.getElementById("appSidebar");
  const toggle = document.getElementById("sidebarToggle");

  if (!sidebar || !toggle) {
    return;
  }

  let collapsed = false;
  try {
    collapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    // Ignore storage failures; default to expanded.
  }

  sidebar.classList.toggle("is-collapsed", collapsed);
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");

  toggle.addEventListener("click", () => {
    const isCollapsed = sidebar.classList.toggle("is-collapsed");
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    toggle.setAttribute("aria-label", isCollapsed ? "Expand sidebar" : "Collapse sidebar");

    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed ? "1" : "0");
    } catch {
      // Ignore storage failures; the toggle still works for this page view.
    }
  });
}

initSidebarToggle();
