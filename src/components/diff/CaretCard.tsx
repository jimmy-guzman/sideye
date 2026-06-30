import { createMemo, Index, Show } from "solid-js";

import { state } from "@/state";
import { useTheme } from "@/theme/context";
import { truncate } from "@/utils/text";
import { caretCell, placeCard } from "@/viewer/anchor";

// A caret-anchored decoration is capped so a verbose reply (a long doc comment)
// Stays a glanceable card, not a second pane; overflow collapses to a trailing
// Ellipsis line rather than scrolling, the keyboard-only v1 behavior.
const MAX_CARD_LINES = 12;
const MAX_CARD_WIDTH = 72;

// Each decoration status maps to its own body so loading, empty, and error read as
// Real states (TASTE: every async surface designs all three), never a blank box.
function bodyLines(decoration: NonNullable<ReturnType<typeof state.viewerDecoration>>) {
  if (decoration.status === "loading") {
    return ["…"];
  }
  if (decoration.status === "error") {
    return ["couldn't reach the language server"];
  }
  if (decoration.status === "empty" || decoration.lines.length === 0) {
    return ["no hover info"];
  }
  return decoration.lines;
}

/**
 * The floating card for the active caret-anchored decoration (hover today, peek Later). Absolutely
 * positioned inside the viewer content area so it never clips Against the scrollbox or shifts the
 * diff; placed below the caret and flipped Above near the bottom edge. The geometry DiffView
 * already computes (the caret's Cumulative top, the gutter+sign offset, the inner width) arrives as
 * accessors.
 */
export function CaretCard(props: {
  cursorTop: () => number | undefined;
  caretFrom: () => number | undefined;
  contentLeft: () => number;
  innerWidth: () => number;
}) {
  const theme = useTheme();

  const card = createMemo(() => {
    const decoration = state.viewerDecoration();
    const cursorTop = props.cursorTop();
    const caretFrom = props.caretFrom();
    if (decoration === undefined || cursorTop === undefined || caretFrom === undefined) {
      return undefined;
    }
    const viewportHeight = state.viewerHeight();
    const viewportWidth = props.innerWidth();
    const anchor = caretCell({
      caretFrom,
      contentLeft: props.contentLeft(),
      cursorTop,
      scrollTop: state.viewerScrollTop(),
      scrollX: state.viewerScrollX(),
      viewportHeight,
    });
    if (anchor === undefined) {
      return undefined;
    }
    // Leave room for the border (2) and a column of padding each side (2).
    const textWidth = Math.max(8, Math.min(MAX_CARD_WIDTH, viewportWidth - 4));
    const body = bodyLines(decoration);
    const clamped = body.slice(0, MAX_CARD_LINES).map((line) => truncate(line, textWidth));
    const lines = body.length > MAX_CARD_LINES ? [...clamped, "…"] : clamped;
    const contentWidth = Math.max(...lines.map((line) => line.length));
    const placement = placeCard({
      anchor,
      cardHeight: lines.length + 2,
      cardWidth: contentWidth + 4,
      viewportHeight,
      viewportWidth,
    });
    const muted = decoration.status !== "ready";
    return { lines, muted, placement, width: contentWidth + 4 };
  });

  return (
    <Show when={card()}>
      {(value) => (
        <box
          position="absolute"
          top={value().placement.top}
          left={value().placement.left}
          width={value().width}
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.colors.border.focused}
          backgroundColor={theme.colors.surface.panel}
          paddingLeft={1}
          paddingRight={1}
          zIndex={50}
        >
          <Index each={value().lines}>
            {(line) => (
              <text fg={value().muted ? theme.colors.text.muted : theme.colors.text.primary}>
                {line()}
              </text>
            )}
          </Index>
        </box>
      )}
    </Show>
  );
}
