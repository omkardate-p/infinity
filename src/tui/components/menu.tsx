/**
 * The command menu. It draws the lines the layout produced: which rows exist,
 * how wide they are and where the query matched are all decided in rendering/,
 * so nothing here measures a string.
 */

import {
  type MenuEntry,
  menuLines,
  opaqueLines,
  styledText,
} from "../rendering/lines.ts";

export function Menu({
  entries,
  selected,
  width,
  maxRows,
}: {
  entries: MenuEntry[];
  selected: number;
  width: number;
  // Rows the footer can spare; a longer list scrolls under the selection.
  maxRows: number;
}) {
  return (
    <text
      content={styledText(
        opaqueLines(menuLines(entries, selected, width, maxRows)),
      )}
    />
  );
}
