RTL layout verification (2026-08-12):

The Arabic Revenue page was refreshed in the authenticated live preview after changing DashboardLayout. The sidebar now renders on the right side, while the content occupies the remaining left side, matching RTL expectations. The document direction is `rtl`; the computed viewport width is 1280 CSS pixels; the sidebar is `position: static` at the large-screen breakpoint with a bounding rectangle from left 1024 to right 1280. Its mobile closed transform is now direction-aware (`translate-x-full` in RTL, `-translate-x-full` in LTR).

The user-provided screenshot appears to show the previous state where the sidebar was left-aligned and the main content was clipped. The current preview no longer reproduces that state.
