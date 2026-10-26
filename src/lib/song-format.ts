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
 *
 * Also home to the parsing of a song's filter values (origin, vibes,
 * difficulty) for the home screen's filter chips — see songFilterValues.
 */

import type { Song } from '@/lib/supabase';

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

// ---------------------------------------------------------------------------
// Filter values (home screen chips)
// ---------------------------------------------------------------------------

export type FilterTab = 'origin' | 'vibe' | 'difficulty';

export const FILTER_TABS: readonly FilterTab[] = ['origin', 'vibe', 'difficulty'];

/**
 * Values to show first in each tab's chip row, in this order (matched
 * case-insensitively). Everything else follows alphabetically. Values listed
 * here that no visible song uses are simply not shown.
 */
export const PREFERRED_ORIGIN_ORDER: readonly string[] = [];
export const PREFERRED_VIBE_ORDER: readonly string[] = [];
export const PREFERRED_DIFFICULTY_ORDER: readonly string[] = [];

const PREFERRED_ORDER: Record<FilterTab, readonly string[]> = {
  origin: PREFERRED_ORIGIN_ORDER,
  vibe: PREFERRED_VIBE_ORDER,
  difficulty: PREFERRED_DIFFICULTY_ORDER,
};

/** One filter value: `key` groups spellings case-insensitively, `label` is the spelling as written. */
export interface FilterValue {
  key: string;
  label: string;
}

export type SongFilterValues = Record<FilterTab, FilterValue[]>;

function toFilterValue(raw: string): FilterValue | null {
  const label = raw.trim();
  return label.length === 0 ? null : { key: label.toLowerCase(), label };
}

/** Splits a comma-separated column ("Hype, Mellow") into values: trimmed, no empties, no duplicates. */
export function parseTagList(value: string | null | undefined): FilterValue[] {
  if (!value) return [];
  const seen = new Set<string>();
  const values: FilterValue[] = [];
  for (const part of value.split(',')) {
    const v = toFilterValue(part);
    if (v && !seen.has(v.key)) {
      seen.add(v.key);
      values.push(v);
    }
  }
  return values;
}

// Keyed by the song object itself: every fetch creates new objects, so an
// edited song is re-parsed and stale entries are garbage collected.
const filterValuesCache = new WeakMap<Song, SongFilterValues>();

/**
 * A song's values for each filter tab. Origin is a single value (not split on
 * commas); vibes and difficulty are comma-separated lists. Missing columns
 * (supabase/tags.sql not run yet) give no values.
 */
export function songFilterValues(song: Song): SongFilterValues {
  let values = filterValuesCache.get(song);
  if (!values) {
    const origin = song.origin ? toFilterValue(song.origin) : null;
    values = {
      origin: origin ? [origin] : [],
      vibe: parseTagList(song.vibes),
      difficulty: parseTagList(song.difficulty),
    };
    filterValuesCache.set(song, values);
  }
  return values;
}

/**
 * The chips for one tab: every value used by at least one of `visibleSongs`,
 * labelled with its most common spelling across `allSongs` (so a label doesn't
 * change when libraries do; ties go to the alphabetically first spelling), in
 * PREFERRED_*_ORDER first and then alphabetical order.
 */
export function buildFilterOptions(allSongs: Song[], visibleSongs: Song[], tab: FilterTab): FilterValue[] {
  const visibleKeys = new Set<string>();
  for (const song of visibleSongs) {
    for (const v of songFilterValues(song)[tab]) visibleKeys.add(v.key);
  }
  if (visibleKeys.size === 0) return [];

  const spellings = new Map<string, Map<string, number>>();
  for (const song of allSongs) {
    for (const v of songFilterValues(song)[tab]) {
      if (!visibleKeys.has(v.key)) continue;
      let counts = spellings.get(v.key);
      if (!counts) spellings.set(v.key, (counts = new Map()));
      counts.set(v.label, (counts.get(v.label) ?? 0) + 1);
    }
  }

  const options: FilterValue[] = [];
  for (const key of visibleKeys) {
    // visibleSongs is a subset of allSongs, so every visible key has spellings.
    // Spellings of one key differ only in case/inner spacing, so ties compare
    // by code point, which prefers capitalised forms ("Mellow" over "mellow").
    let best: string | null = null;
    let bestCount = 0;
    for (const [label, count] of spellings.get(key) ?? []) {
      if (count > bestCount || (count === bestCount && best !== null && label < best)) {
        best = label;
        bestCount = count;
      }
    }
    options.push({ key, label: best ?? key });
  }

  const preferred = PREFERRED_ORDER[tab].map((v) => v.trim().toLowerCase());
  const rank = (key: string) => {
    const i = preferred.indexOf(key);
    return i === -1 ? preferred.length : i;
  };
  return options.sort(
    (a, b) => rank(a.key) - rank(b.key) || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );
}
