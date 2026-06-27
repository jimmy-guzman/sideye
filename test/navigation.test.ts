import { describe, expect, test } from "bun:test";

import {
  back,
  canBack,
  canForward,
  currentLocation,
  forward,
  initialNav,
  navigate,
  recall,
  recordCurrent,
  remember,
  type Location,
} from "../src/viewer/navigation";

function loc(
  path: string,
  kind: "browse" | "jump" = "jump",
  over: Partial<Location> = {},
): Location {
  return {
    cursorLine: undefined,
    fileView: false,
    fullContent: false,
    kind,
    path,
    viewport: { scrollTop: 0, scrollX: 0 },
    ...over,
  };
}

const open = (nav: ReturnType<typeof initialNav>, path: string, kind: "browse" | "jump" = "jump") =>
  navigate(nav, loc(path, kind));

describe("history stack", () => {
  test("a fresh open pushes a new current entry", () => {
    const nav = open(initialNav(loc("a")), "b");
    expect(currentLocation(nav)?.path).toBe("b");
    expect(canBack(nav)).toBe(true);
    expect(canForward(nav)).toBe(false);
  });

  test("back then forward returns to where you were", () => {
    const nav = open(open(initialNav(loc("a")), "b"), "c");
    const backOne = back(nav);
    expect(currentLocation(backOne)?.path).toBe("b");
    expect(canForward(backOne)).toBe(true);
    expect(currentLocation(forward(backOne))?.path).toBe("c");
  });

  test("back is bounded at the first entry, forward at the last", () => {
    const nav = open(initialNav(loc("a")), "b");
    const atStart = back(back(nav));
    expect(currentLocation(atStart)?.path).toBe("a");
    expect(canBack(atStart)).toBe(false);
    expect(currentLocation(back(atStart))?.path).toBe("a");

    const atEnd = forward(forward(nav));
    expect(currentLocation(atEnd)?.path).toBe("b");
    expect(canForward(atEnd)).toBe(false);
  });

  test("opening after going back truncates the forward entries", () => {
    const nav = open(open(initialNav(loc("a")), "b"), "c");
    const reopened = open(back(nav), "d");
    expect(currentLocation(reopened)?.path).toBe("d");
    expect(canForward(reopened)).toBe(false);
    // "c" is gone: forward no longer reaches it.
    expect(currentLocation(back(reopened))?.path).toBe("b");
  });
});

describe("browse coalescing", () => {
  test("consecutive browse entries collapse into one", () => {
    const nav = open(open(open(initialNav(loc("a")), "b", "browse"), "c", "browse"), "d", "browse");
    expect(currentLocation(nav)?.path).toBe("d");
    // One step back from the coalesced browse head lands on the original "a".
    expect(currentLocation(back(nav))?.path).toBe("a");
    expect(canBack(back(nav))).toBe(false);
  });

  test("a jump after browsing pushes rather than coalescing", () => {
    const nav = open(open(initialNav(loc("a")), "b", "browse"), "c", "jump");
    expect(currentLocation(back(nav))?.path).toBe("b");
  });

  test("browse does not coalesce onto a forward-truncated middle entry", () => {
    // After going back, the head is not at the end of the stack, so a browse pushes.
    const nav = open(open(initialNav(loc("a")), "b"), "c");
    const browsed = open(back(nav), "d", "browse");
    expect(currentLocation(browsed)?.path).toBe("d");
    expect(currentLocation(back(browsed))?.path).toBe("b");
  });
});

describe("recordCurrent", () => {
  test("overwrites the current entry, so back restores the recorded spot", () => {
    const nav = open(initialNav(loc("a")), "b");
    const recorded = recordCurrent(
      nav,
      loc("b", "jump", { cursorLine: 42, viewport: { scrollTop: 9, scrollX: 3 } }),
    );
    const backOne = back(recorded);
    // The "b" entry we left now carries the recorded cursor/scroll.
    expect(currentLocation(forward(backOne))?.cursorLine).toBe(42);
    expect(currentLocation(forward(backOne))?.viewport).toEqual({ scrollTop: 9, scrollX: 3 });
  });

  test("is a no-op on an empty tab", () => {
    const empty = initialNav(undefined);
    expect(recordCurrent(empty, loc("a"))).toEqual(empty);
    expect(currentLocation(recordCurrent(empty, loc("a")))).toBeUndefined();
  });
});

describe("MRU viewports", () => {
  test("remember then recall returns the stored position", () => {
    const nav = remember(initialNav(loc("a")), "a", {
      cursorLine: 7,
      viewport: { scrollTop: 5, scrollX: 1 },
    });
    expect(recall(nav, "a")).toEqual({ cursorLine: 7, viewport: { scrollTop: 5, scrollX: 1 } });
    expect(recall(nav, "b")).toBeUndefined();
  });

  test("a back entry's own viewport can differ from the MRU for that path", () => {
    // Leaving "a" records scroll 9 into its entry; a later visit bumps the MRU to
    // 20. Going back must restore the entry's 9, not the MRU's 20.
    const left = recordCurrent(
      initialNav(loc("a")),
      loc("a", "jump", { viewport: { scrollTop: 9, scrollX: 0 } }),
    );
    const nav = remember(open(left, "b"), "a", {
      cursorLine: undefined,
      viewport: { scrollTop: 20, scrollX: 0 },
    });
    expect(currentLocation(back(nav))?.viewport.scrollTop).toBe(9);
    expect(recall(nav, "a")?.viewport.scrollTop).toBe(20);
  });
});

describe("initialNav", () => {
  test("seeds a single tab with the given location", () => {
    const nav = initialNav(loc("a"));
    expect(nav.tabs).toHaveLength(1);
    expect(currentLocation(nav)?.path).toBe("a");
    expect(canBack(nav)).toBe(false);
  });

  test("with no location seeds an empty single tab", () => {
    const nav = initialNav(undefined);
    expect(nav.tabs).toHaveLength(1);
    expect(currentLocation(nav)).toBeUndefined();
  });
});
