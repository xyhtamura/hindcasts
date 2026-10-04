# Sounder UI plan

2026-10-04 — Codex. Design record for the layout accepted by the user. The horizontal selector, rack disclosure, compact charts, and app-window focus are implemented; see the dated entry in [sounder-roadmap.md](sounder-roadmap.md). The original proposal follows. Browser fullscreen and the alternative vertical selector were not implemented.

Sounder will have one workspace containing a recording, a rack, and the selected cell's controls. Opening the rack will insert a bounded routing area before the controls. Cell selection and chart focus will be independent of rack visibility.

## Overview and cell selection

The recommended layout will use a persistent horizontal cell selector between the recording controls and the selected cell editor. It will remain available when the routing area is closed. Sounder and mixer cells will use the same selection mechanism; selecting one will show its controls in the existing editor area. Names and cell types will identify each item, and selection will be visible through text and an active marker.

The first cell will be selected initially. A rack with one Sounder will still start as recording → Sounder → output, with the routing area closed. Adding or selecting cells will not require graph manipulation. The selected cell header will include its name, type, input summary, and Routing button. Secondary actions such as duplication and removal will move out of the permanent selector into cell controls or an action menu.

A vertical cell selector is an alternative for large racks. It will remain usable with the routing area closed, but it will reduce the width available to charts. Compare it with the horizontal selector before adopting it; do not ship both navigation systems by default. On narrow screens, the horizontal selector will use scrolling or a labeled cell picker rather than shrinking buttons.

## Rack disclosure

Use **Show rack** and **Hide rack** as disclosure controls. Opening the rack will push the editor down without unloading it, narrowing it through an added sidebar, or clearing its settings. The routing area will have a bounded initial height; larger networks will scroll within that area. Its exact height will be set after checking the real controls at common window sizes.

Selecting a node or a cell-selector item will update the same selection. The graph and selector must agree on the active cell. Routing buttons will remain the supported alternative to port editing. Changes to graphical manipulation remain deferred by the user's earlier request.

Use one main page scrollbar for the controls. Avoid nested scrolling inside the effect editor. Keep recording and transport actions available without duplicating a second toolbar for each cell.

## Compact charts and focus

The overview will keep a compact crossover field and depth chart visible together. Compactness will come from reducing chart height and secondary explanatory text, while preserving legible labels, pointer targets, band selection, and the active curve. Do not scale the whole interface down. Allow the page to scroll rather than crushing the charts to fit a short window.

Both chart headers will have a **Focus** button. Focus will give the selected chart the app window's working area and retain the controls needed for that chart:

- Crossover focus: frequency labels, crossover handles, band selection, split, and merge.
- Depth focus: input/output level axes, curve points, selected band, window, floor, smoothing, makeup, and mix.

**Return to overview** and Escape will exit focus. Restore the previous rack disclosure, selected cell and band, editor scroll position, and keyboard focus. Chart focus will not change effect values, routing, or the recipe. An optional **Full screen** action can enter browser fullscreen after app-window focus works; browser fullscreen will not be required to enlarge a chart.

Clicking the plot will continue to edit it. Do not make plot clicks toggle focus: they already add points, select bands, and move handles. Focus only one chart at a time. Keep its cell and band identity visible so an enlarged chart still has context.

## Implementation order and checks

1. Add persistent cell selection and change rack visibility to a disclosure. Check Sounder/mixer switching with the rack both open and closed; retained values and audio; and usable control widths at desktop and mobile sizes.
2. Define compact chart sizes and consolidate secondary actions. Check actual labels, crossover handles, and curve interactions before choosing minimum heights.
3. Implement one app-level chart focus path for both charts. The current depth chart overlay is fixed inside `effect.html`, which is an iframe; it cannot occupy the parent app window. Coordinate focus and frame sizing with the host, or remove that frame boundary during implementation. Do not copy the existing overlay into a second isolated implementation.
4. Check focus enter/exit at short and narrow window sizes, Escape and button exits, focus restoration, retained rack/band selection, and chart canvas sizing at the actual device pixel ratio. Verify that view changes alone do not invalidate audio or alter saved recipes.

UI presentation state will stay separate from the processing recipe. Keep existing recipes compatible; the layout plan does not change the rack format or DSP. Whole-cell comparison, graphical editing changes, undo/redo, and other-effect adapters are outside this UI pass.
