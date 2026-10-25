/**
 * Parser + transposer for the song body format carried over from the
 * reference RY Song Book app (see ChordView.swift there):
 *
 *   - Chords are written inline as `[C]` immediately before the lyric
 *     syllable they belong to, e.g. `O my [C]lord and my [F]hope!`.
 *   - A `{...}label` block boxes a group of lines (e.g. a chorus) and
 *     shows it labeled in the corner. Everything from the closing `}` up
 *     to the next newline (or end of string) is the label, verbatim —
 *     e.g. `{[C]Lyrics here\n[F]More lyrics}Repeat twice` labels the box
 *     "Repeat twice". A label that's just digits (`}2`) is shown as
 *     "x2" for convenience, matching how repeat counts were written in
 *     the original app. Anything after the label's newline continues as
 *     ungrouped (unboxed) text.
 *   - Alternative/slash chords written with `|` (e.g. `C | Cadd9`) are
 *     shown as-is and are not transposed, matching the reference app.
 *
 * This is a direct port of that Swift parsing/transposition logic so
 * existing songs render identically without reformatting.
 */

export const CHROMATIC_KEYS = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export interface LineToken {
  /** null = no chord row reserved above this lyric chunk. */
  chord: string | null;
  lyrics: string;
}

export type ParsedLine = LineToken[];

export interface Segment {
  boxed: boolean;
  /** e.g. "x2" or "Repeat twice", only present on boxed segments that had one. */
  label?: string;
  lines: ParsedLine[];
}

function splitNonEmpty(str: string, sep: string): string[] {
  return str.split(sep).filter((s) => s.length > 0);
}

function mod(a: number, n: number): number {
  const r = a % n;
  return r < 0 ? r + n : r;
}

/** Transposes a single chord by a number of semitones. Leaves `|`-alternative chords untouched. */
export function transposeChord(chord: string, semitones: number): string {
  if (chord.length === 0 || chord.includes('|')) return chord;
  const hasSharp = chord.length > 1 && chord[1] === '#';
  const root = chord[0] + (hasSharp ? '#' : '');
  const quality = chord.slice(hasSharp ? 2 : 1);
  const index = CHROMATIC_KEYS.indexOf(root as (typeof CHROMATIC_KEYS)[number]);
  const baseIndex = index === -1 ? 0 : index;
  const newIndex = mod(baseIndex + semitones, CHROMATIC_KEYS.length);
  return CHROMATIC_KEYS[newIndex] + quality;
}

/** Semitone shift to apply so chords written for `originalCapo` display correctly at `desiredCapo`. */
export function capoSemitoneShift(originalCapo: number, desiredCapo: number): number {
  return originalCapo - desiredCapo;
}

function parseLine(line: string): ParsedLine {
  const chunks = splitNonEmpty(line, '[');
  const hasMultipleChunks = chunks.length > 1;
  return chunks.map((chunk, i) => {
    const parts = splitNonEmpty(chunk, ']');
    if (parts.length > 1) {
      return { chord: parts[0], lyrics: parts[1] };
    }
    const lyrics = parts[0] ?? '';
    // Reserve a blank chord row for alignment when other chunks on this
    // line do have chords, matching the reference app's behavior.
    return { chord: hasMultipleChunks ? '' : null, lyrics };
  });
}

function parseLines(text: string): ParsedLine[] {
  return splitNonEmpty(text, '\n').map(parseLine);
}

/** Parses a raw song body into a sequence of boxed/plain line groups. */
export function parseSong(song: string): Segment[] {
  const segments: Segment[] = [];
  const groups = splitNonEmpty(song, '{');

  for (const group of groups) {
    const split = splitNonEmpty(group, '}');
    if (split.length > 1) {
      const remainder = split[1];
      // Everything after the closing `}` up to the next newline is the
      // box's label, verbatim (e.g. "Repeat twice", "Bridge", "x2").
      const newlineIndex = remainder.indexOf('\n');
      const labelText = (newlineIndex === -1 ? remainder : remainder.slice(0, newlineIndex)).trim();
      const rest = newlineIndex === -1 ? '' : remainder.slice(newlineIndex + 1);
      // A bare number is shorthand for a repeat count, shown as "xN" to
      // match how the original app displayed it.
      const label = labelText.length === 0 ? undefined : /^\d+$/.test(labelText) ? `x${labelText}` : labelText;
      segments.push({
        boxed: true,
        label,
        lines: parseLines(split[0]),
      });
      if (rest.length > 0) {
        segments.push({ boxed: false, lines: parseLines(rest) });
      }
    } else {
      segments.push({ boxed: false, lines: parseLines(split[0] ?? '') });
    }
  }

  return segments;
}
