#!/usr/bin/env node
// Checks that Row Level Security keeps songs, libraries and library_songs
// read-only for the app's anon key.
//
//   node scripts/check-rls.mjs                # reads, no-op updates, a reverted tag
//                                             # update, labelled inserts
//   node scripts/check-rls.mjs --destructive  # also deletes real rows: TEST PROJECTS ONLY
//
// Reads EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY from .env.
// --destructive also requires LIVE_SUPABASE_PROJECT_REF in .env and refuses
// to run if the URL points at that project. Only ever uses the anon key.
//
// With RLS, a blocked update or delete usually returns no error and simply
// affects zero rows, so every write test re-reads the row afterwards and
// compares it, instead of trusting the absence of an error.

import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const INSERT_LABEL = 'RLS CHECK - safe to delete';
const RLS_VIOLATION = '42501';
// Column doesn't exist: PostgREST's schema cache (PGRST204) or Postgres (42703).
const MISSING_COLUMN = ['PGRST204', '42703'];
const TAG_CHECK_VALUE = 'RLS CHECK';

function loadEnv() {
  const path = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    fail(`Could not read ${path}. Copy .env.example to .env first.`);
  }
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(2);
}

/**
 * Accepts a new-format publishable key (sb_publishable_...) or a legacy JWT
 * whose role claim is "anon". Refuses secret keys (sb_secret_...), JWTs with
 * any other role (e.g. service_role), and anything unrecognisable.
 */
function assertAnonKey(key) {
  if (key.startsWith('sb_secret_')) fail('EXPO_PUBLIC_SUPABASE_ANON_KEY is a secret key. Use the anon/publishable key.');
  if (key.startsWith('sb_publishable_')) return;
  let role;
  try {
    const parts = key.split('.');
    if (parts.length !== 3) throw new Error('not a JWT');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    role = payload.role;
  } catch {
    fail('EXPO_PUBLIC_SUPABASE_ANON_KEY is not a recognisable Supabase anon key.');
  }
  if (role !== 'anon') fail(`EXPO_PUBLIC_SUPABASE_ANON_KEY has role "${role}", expected "anon". Refusing to run.`);
}

/** Fails closed: --destructive only runs when we can tell this is not the live project. */
function assertNotLive(url, liveRef) {
  if (!liveRef) {
    fail('--destructive needs LIVE_SUPABASE_PROJECT_REF in .env (your live project ref), so it can refuse to run against it.');
  }
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    fail(`EXPO_PUBLIC_SUPABASE_URL is not a valid URL: ${url}`);
  }
  if (host.split('.')[0] === liveRef.toLowerCase() || host.includes(liveRef.toLowerCase())) {
    fail(`Refusing --destructive: ${host} is the live project (${liveRef}).`);
  }
}

const env = loadEnv();
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const destructive = process.argv.includes('--destructive');

if (!url || !anonKey) fail('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY must be set in .env.');
assertAnonKey(anonKey);
if (destructive) assertNotLive(url, env.LIVE_SUPABASE_PROJECT_REF);

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const results = [];
function record(table, operation, status, detail) {
  results.push({ table, operation, status, detail });
}

function matchKey(row, keyColumns) {
  return Object.fromEntries(keyColumns.map((c) => [c, row[c]]));
}

async function readRow(table, key) {
  const { data, error } = await supabase.from(table).select('*').match(key);
  if (error) throw new Error(`re-read failed: ${error.message}`);
  return data[0] ?? null;
}

// One existing row per table, plus an unused (library, song) pair for the library_songs insert.
async function loadSamples() {
  const samples = {};
  for (const table of ['songs', 'libraries', 'library_songs']) {
    const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' }).limit(1);
    if (error) {
      record(table, 'read', 'FAIL', error.message);
      samples[table] = undefined;
    } else {
      record(table, 'read', 'PASS', `${count ?? '?'} rows visible`);
      samples[table] = data[0] ?? null;
    }
  }

  samples.unusedPair = null;
  const [libs, songs, links] = await Promise.all([
    supabase.from('libraries').select('id'),
    supabase.from('songs').select('id'),
    supabase.from('library_songs').select('library_id, song_id'),
  ]);
  if (!libs.error && !songs.error && !links.error) {
    const existing = new Set(links.data.map((l) => `${l.library_id}:${l.song_id}`));
    outer: for (const lib of libs.data) {
      for (const song of songs.data) {
        if (!existing.has(`${lib.id}:${song.id}`)) {
          samples.unusedPair = { library_id: lib.id, song_id: song.id };
          break outer;
        }
      }
    }
  }
  return samples;
}

const TABLES = {
  songs: {
    key: ['id'],
    noopField: 'title',
    insertRow: () => ({ title: INSERT_LABEL, origin: null, capo: 0, song: INSERT_LABEL }),
    insertedFilter: () => ({ title: INSERT_LABEL }),
  },
  libraries: {
    key: ['id'],
    noopField: 'name',
    insertRow: () => ({ slug: 'rls-check-safe-to-delete', name: INSERT_LABEL, sort_order: 9999 }),
    insertedFilter: () => ({ slug: 'rls-check-safe-to-delete' }),
  },
  library_songs: {
    key: ['library_id', 'song_id'],
    noopField: 'library_id',
    insertRow: (samples) => samples.unusedPair,
    insertedFilter: (row) => row,
  },
};

async function checkInsert(table, samples) {
  const row = TABLES[table].insertRow(samples);
  if (!row) {
    record(table, 'insert', 'SKIP', 'no unused library/song pair to try (add a song or library)');
    return;
  }
  const { data, error } = await supabase.from(table).insert(row).select();
  if (error) {
    if (error.code === RLS_VIOLATION) record(table, 'insert', 'PASS', 'blocked by RLS');
    else record(table, 'insert', 'UNCLEAR', `rejected, but not by RLS (${error.code}: ${error.message})`);
    return;
  }
  // Inserted rows may be invisible to select; double-check by reading it back.
  const inserted = data?.[0] ?? (await readRow(table, TABLES[table].insertedFilter(row)).catch(() => null));
  const id = inserted ? JSON.stringify(matchKey(inserted, TABLES[table].key)) : '(could not read it back)';
  record(table, 'insert', 'FAIL', `row was inserted. Delete it in the dashboard: ${table} ${id}`);
}

async function checkUpdate(table, sample) {
  const { key, noopField } = TABLES[table];
  if (!sample) {
    record(table, 'update', 'SKIP', 'table is empty');
    return;
  }
  const filter = matchKey(sample, key);
  // Setting a field to its current value: harmless even if RLS were broken.
  const { data, error } = await supabase
    .from(table)
    .update({ [noopField]: sample[noopField] })
    .match(filter)
    .select();
  const after = await readRow(table, filter);
  const unchanged = after !== null && JSON.stringify(after) === JSON.stringify(sample);
  const affected = data?.length ?? 0;
  if (affected === 0 && unchanged) {
    record(table, 'update', 'PASS', error ? `blocked (${error.code})` : 'affected 0 rows, row unchanged');
  } else {
    record(table, 'update', 'FAIL', `affected ${affected} row(s); row ${unchanged ? 'unchanged' : 'CHANGED'}`);
  }
}

/**
 * Tries a real change to a song's vibes and difficulty, in case a column-level
 * or update policy treats them differently from the no-op update above. If it
 * gets through, the original values are put back straight away.
 */
async function checkTagUpdate(sample) {
  if (!sample) {
    record('songs', 'update tags', 'SKIP', 'table is empty');
    return;
  }
  const filter = matchKey(sample, TABLES.songs.key);
  const { data, error } = await supabase
    .from('songs')
    .update({ vibes: TAG_CHECK_VALUE, difficulty: TAG_CHECK_VALUE })
    .match(filter)
    .select();
  if (error && MISSING_COLUMN.includes(error.code)) {
    record('songs', 'update tags', 'SKIP', 'no vibes/difficulty columns yet (run supabase/tags.sql)');
    return;
  }
  const after = await readRow('songs', filter);
  const unchanged = after !== null && JSON.stringify(after) === JSON.stringify(sample);
  const affected = data?.length ?? 0;
  if (affected === 0 && unchanged) {
    record('songs', 'update tags', 'PASS', error ? `blocked (${error.code})` : 'affected 0 rows, row unchanged');
    return;
  }
  const restore = await supabase
    .from('songs')
    .update({ vibes: sample.vibes ?? null, difficulty: sample.difficulty ?? null })
    .match(filter);
  record(
    'songs',
    'update tags',
    'FAIL',
    `affected ${affected} row(s); row ${unchanged ? 'unchanged' : 'CHANGED'}` +
      (unchanged ? '' : restore.error ? `; restore failed (${restore.error.message})` : '; original values restored')
  );
}

async function checkDelete(table, sample) {
  if (!destructive) {
    record(table, 'delete', 'SKIP', 'needs --destructive (test projects only)');
    return;
  }
  if (!sample) {
    record(table, 'delete', 'SKIP', 'table is empty');
    return;
  }
  const filter = matchKey(sample, TABLES[table].key);
  const { data, error } = await supabase.from(table).delete().match(filter).select();
  const after = await readRow(table, filter);
  if (after !== null && (data?.length ?? 0) === 0) {
    record(table, 'delete', 'PASS', error ? `blocked (${error.code})` : 'affected 0 rows, row still exists');
    return;
  }
  console.error(`\n${table}: row was DELETED. Its contents were:\n${JSON.stringify(sample, null, 2)}`);
  if (table === 'songs' || table === 'libraries') {
    console.error('Deleting it also removed its library_songs rows (on delete cascade); those are not restored.');
  }
  const restore = await supabase.from(table).insert(sample);
  record(
    table,
    'delete',
    'FAIL',
    restore.error ? `row deleted; restore failed (${restore.error.message})` : 'row deleted; restored from backup'
  );
}

const samples = await loadSamples();
for (const table of Object.keys(TABLES)) {
  if (samples[table] === undefined) continue; // read failed; nothing else is meaningful
  await checkInsert(table, samples);
  await checkUpdate(table, samples[table]);
  if (table === 'songs') await checkTagUpdate(samples.songs);
}
// Deletes last, join table first, so a broken policy on one table can't
// cascade away the rows another test relies on.
for (const table of ['library_songs', 'libraries', 'songs']) {
  if (samples[table] === undefined) continue;
  await checkDelete(table, samples[table]);
}

const host = new URL(url).hostname;
console.log(`\nRLS check against ${host}${destructive ? ' (destructive)' : ''}\n`);
const order = ['read', 'insert', 'update', 'update tags', 'delete'];
results.sort(
  (a, b) =>
    Object.keys(TABLES).indexOf(a.table) - Object.keys(TABLES).indexOf(b.table) ||
    order.indexOf(a.operation) - order.indexOf(b.operation)
);
for (const r of results) {
  console.log(`${r.status.padEnd(8)} ${r.table.padEnd(14)} ${r.operation.padEnd(11)} ${r.detail}`);
}

const bad = results.filter((r) => r.status === 'FAIL' || r.status === 'UNCLEAR');
console.log(bad.length === 0 ? '\nAll checks passed.' : `\n${bad.length} check(s) failed or were unclear.`);
process.exit(bad.length === 0 ? 0 : 1);
