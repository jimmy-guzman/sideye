// The viewer's navigation model: a set of tabs, each an ordered history of the
// Locations it has visited, plus a global most-recently-used viewport per path.
// Back/forward, tabs, and remembered-scroll are the same mechanism seen three
// Ways: a Location is what restores the viewer, a Tab is a history of Locations.
// This module is pure (no Solid/Effect/OpenTUI), so the stack/index/truncation
// And MRU logic is unit-testable without rendering; `state` owns the live signals
// That capture a Location on leave and apply one on arrive.

interface Viewport {
  scrollTop: number;
  scrollX: number;
}

// A remembered position for a path: where the cursor and viewport last sat. The
// Cursor is a file line (a NavigableLine.newLine), stable across refreshes, not a
// Navigable index (which only has meaning against a loaded diff).
export interface Position {
  cursorLine: number | undefined;
  viewport: Viewport;
}

export interface Location extends Position {
  path: string;
  fileView: boolean;
  fullContent: boolean;
  // How this entry was reached: continuous tree browsing coalesces into one
  // `browse` entry; a deliberate open (enter, palette, search, jump) `pushes`.
  kind: "browse" | "jump";
}

interface Tab {
  id: string;
  entries: Location[];
  // Index of the current entry; -1 when the tab has no entries yet.
  index: number;
}

export interface NavState {
  tabs: Tab[];
  activeTabId: string;
  // Global last-known position per path, shared across tabs, so a fresh
  // Navigation to a path you have visited restores where you were.
  viewports: Map<string, Position>;
}

export function initialNav(location: Location | undefined, tabId = "0"): NavState {
  return {
    activeTabId: tabId,
    tabs: [
      {
        entries: location === undefined ? [] : [location],
        id: tabId,
        index: location === undefined ? -1 : 0,
      },
    ],
    viewports: new Map(),
  };
}

function activeTab(nav: NavState) {
  return nav.tabs.find((tab) => tab.id === nav.activeTabId) ?? nav.tabs[0];
}

export function currentLocation(nav: NavState): Location | undefined {
  const tab = activeTab(nav);
  return tab.index < 0 ? undefined : tab.entries[tab.index];
}

export function canBack(nav: NavState) {
  return activeTab(nav).index > 0;
}

export function canForward(nav: NavState) {
  const tab = activeTab(nav);
  return tab.index < tab.entries.length - 1;
}

function mapActive(nav: NavState, fn: (tab: Tab) => Tab): NavState {
  return { ...nav, tabs: nav.tabs.map((tab) => (tab.id === nav.activeTabId ? fn(tab) : tab)) };
}

// Overwrite the active tab's current entry with the location being left, so a
// Later back/forward restores the exact spot. A no-op on an empty tab.
export function recordCurrent(nav: NavState, location: Location): NavState {
  return mapActive(nav, (tab) =>
    tab.index < 0
      ? tab
      : {
          ...tab,
          entries: tab.entries.map((entry, index) => (index === tab.index ? location : entry)),
        },
  );
}

// Move to a new location in the active tab. A `browse` onto a `browse` head at
// The end of the stack replaces it in place (so arrowing through the tree is one
// Entry); anything else pushes, truncating any forward entries (browser semantics).
export function navigate(nav: NavState, location: Location): NavState {
  return mapActive(nav, (tab) => {
    const head = tab.entries[tab.index];
    const coalesce =
      location.kind === "browse" && head?.kind === "browse" && tab.index === tab.entries.length - 1;
    if (coalesce) {
      return {
        ...tab,
        entries: tab.entries.map((entry, index) => (index === tab.index ? location : entry)),
      };
    }
    const entries = [...tab.entries.slice(0, tab.index + 1), location];
    return { ...tab, entries, index: entries.length - 1 };
  });
}

export function back(nav: NavState): NavState {
  return mapActive(nav, (tab) => (tab.index > 0 ? { ...tab, index: tab.index - 1 } : tab));
}

export function forward(nav: NavState): NavState {
  return mapActive(nav, (tab) =>
    tab.index < tab.entries.length - 1 ? { ...tab, index: tab.index + 1 } : tab,
  );
}

export function remember(nav: NavState, path: string, position: Position): NavState {
  return { ...nav, viewports: new Map(nav.viewports).set(path, position) };
}

export function recall(nav: NavState, path: string): Position | undefined {
  return nav.viewports.get(path);
}
