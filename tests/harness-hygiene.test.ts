/**
 * The harness fleet's own rules, enforced by a test instead of by memory.
 *
 * 2.0's ship gate produced three harness failures in one afternoon. Every one of them was already
 * understood, written down in §12, and fixed somewhere else in the fleet — and every one of them
 * shipped anyway, because "remember to do it this way" is not a mechanism. These three checks are the
 * mechanism. They read the harness sources as text and fail on the exact shapes that cost 2.0 an
 * afternoon each:
 *
 * 1. **A fixture reported as an assertion.** `pickClaims` seeds from the clock and every fight rolls
 *    a stance, so what a harness gets to measure *with* — a claim in view, a leaping cat, a claim
 *    inside a link — is a roll. A harness re-rolls until it has one (`deal()`) and reports which
 *    attempt it took (`fixture()`); asserting the roll with `ok()` produces a red that describes the
 *    fixture rather than the build, appears intermittently, and says nothing about the game.
 * 2. **`waitForFunction` options in the argument position.** Playwright's signature is
 *    `(pageFunction, arg, options)`. 1.4 found all twenty-two call sites in the fleet passing
 *    `{ timeout }` second, where it becomes the page function's *argument* and the bound silently
 *    becomes 30s — a wait asking for 4000ms measured 30104ms, and twenty of those seconds belong to
 *    §11's idle truce, so the wait ended the fight it was waiting on.
 * 3. **An absolute path into a container.** Twelve harnesses imported Playwright as
 *    `/home/user/Blog-For-Myself/node_modules/playwright-core/index.mjs`, and this repo's sessions run
 *    in containers that get reclaimed. `battle.mjs` did it while committed, which is the proof that a
 *    convention nothing checks decays even in tracked code.
 *
 * These are text checks on scripts, not unit tests of the game, which is why they can live in the
 * same run: `npx vitest run` is the one command that happens on every build, and a rule checked on
 * every build is a rule.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'scratchpad';
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.mjs'))
  .sort();
const source = new Map(files.map((f) => [f, blankComments(readFileSync(join(DIR, f), 'utf8'))]));

/**
 * Split a call's arguments at the top level.
 *
 * Needed because both of the first two rules are about *which position* something sits in, and a
 * regex cannot count arguments through a nested arrow function full of commas — which is what every
 * `waitForFunction` call is. Tracks depth over `()[]{}`, and skips strings, template literals and
 * comments, so a comma inside `'a, b'` or `// like this,` does not open a new argument.
 */
function callArgs(src: string, openParen: number): { args: string[]; end: number } {
  const args: string[] = [];
  let depth = 0;
  let start = openParen + 1;
  let i = openParen;
  let quote: string | null = null;
  for (; i < src.length; i++) {
    const c = src[i];
    const prev = src[i - 1];
    if (quote) {
      if (c === quote && prev !== '\\') quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      i = src.indexOf('\n', i);
      if (i < 0) break;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i) + 1;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) {
        args.push(src.slice(start, i));
        break;
      }
    } else if (c === ',' && depth === 1) {
      args.push(src.slice(start, i));
      start = i + 1;
    }
  }
  return { args: args.map((a) => a.trim()).filter((a) => a.length > 0), end: i };
}

/**
 * Blank out comments, keeping every newline so line numbers still line up.
 *
 * Needed because the first version of this file scanned raw source and flagged **its own
 * documentation**: the sentence explaining that `ok(..., false)` is never an assertion parses, to a
 * regex, as a call to `ok` with `false` in the second position. Both offenders in the final run were
 * comments describing the rule being enforced. A text checker that does not understand comments will
 * eventually read its own explanation as a violation.
 */
function blankComments(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      out += c;
      if (c === quote && src[i - 1] !== '\\') quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? src.length : end;
      out += ' '.repeat(stop - i);
      i = stop;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i);
      const stop = end < 0 ? src.length : end + 2;
      for (let j = i; j < stop; j++) out += src[j] === '\n' ? '\n' : ' ';
      i = stop;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Every call of `name(` in a file, with its arguments and the line it starts on. */
function callsOf(src: string, name: string) {
  const out: { args: string[]; line: number; text: string }[] = [];
  const needle = new RegExp(`(^|[^\\w.])${name}\\s*\\(`, 'g');
  let m: RegExpExecArray | null;
  while ((m = needle.exec(src))) {
    const open = src.indexOf('(', m.index + m[0].length - 1);
    const { args, end } = callArgs(src, open);
    out.push({ args, line: src.slice(0, m.index).split('\n').length, text: src.slice(m.index, end + 1) });
  }
  return out;
}

/**
 * The tell of a fixture reported as an assertion.
 *
 * The first version of this rule looked for the *words* — "none", "nowhere", "never rolled one" — and
 * flagged eight checks that were entirely correct, because `none` is also a CSS value and
 * `pointer-events: none` is exactly what several assertions are asserting. Narrowed, per this
 * work's own stop-condition: a checker that has to be suppressed in five places is not enforcing a
 * rule.
 *
 * What actually distinguishes the fault is not vocabulary but **shape** — the detail is a *fallback*
 * for something the roll might not have produced:
 *
 *   ok('found a claim', !!spot, spot ? `at ${spot.x}` : 'none')   ← a ternary's else
 *   ok('rolled a fighter', !!foe, foe ?? 'never rolled one')      ← a nullish default
 *
 * Both say "I might not have got one", which is the definition of a fixture. A CSS value never
 * arrives that way.
 */
const FIXTURE_WORDS = /none\b|nowhere|never rolled|no deal|not (?:on|in) this|couldn't find|could not find/i;

/**
 * …reached through a ternary's else branch or a `??` default, which is what makes it a fallback.
 *
 * `x || '(none)'` was tried as a third shape and dropped: it caught one real site (`arena.mjs`'s
 * `stance || '(none)'`) and four correct ones, because `during.focus || '(none)'` and `lv || '(none)'`
 * are *readings* — "nothing has focus" is a fact about the DOM, not a fixture that failed to arrive.
 * Four suppressions to catch one is the trade this work refuses to make, and the one real site gets
 * converted by hand instead. A checker's job is to stop the next fault, not to be the only reason a
 * known one gets fixed.
 */
const fixtureShaped = (arg: string) =>
  [...arg.matchAll(/(?::|\?\?)\s*(['"`])((?:\\.|(?!\1)[\s\S])*)\1/g)].some((m) => FIXTURE_WORDS.test(m[2]));

describe('the harness fleet obeys its own rules', () => {
  it('has harnesses to check at all', () => {
    // A guard on the guard: a rename that empties this list would make every check below vacuous.
    expect(files.length).toBeGreaterThan(10);
  });

  /*
   * Rule 1. A fixture-shaped detail may appear inside `fixture(...)`, which re-rolls and reports the
   * attempt, and nowhere else. This is the rule that would have caught all three of 2.0's reds.
   */
  it('reports what a roll handed it through fixture(), never through ok()', () => {
    const offenders: string[] = [];
    for (const [file, src] of source) {
      for (const call of callsOf(src, 'ok')) {
        if (call.args.some(fixtureShaped)) {
          offenders.push(`${file}:${call.line}  ${call.args[0]?.slice(0, 72)}`);
        }
      }
    }
    expect(offenders, `a fixture asserted with ok() — use deal() + fixture():\n${offenders.join('\n')}`).toEqual([]);
  });

  /*
   * The same fault in its bluntest form: `ok(name, false, …)` is a check that cannot pass. Every one
   * in this fleet is a harness saying "I could not set myself up" — `touch-fight`'s "none placeable",
   * `top-state`'s "none in the notice band" — which is a fixture report wearing an assertion's label,
   * and it is what made five skipped checks look like one failure.
   */
  it('never hard-codes a failing check to report a missing fixture', () => {
    const offenders: string[] = [];
    for (const [file, src] of source) {
      for (const call of callsOf(src, 'ok')) {
        if (call.args[1] === 'false') offenders.push(`${file}:${call.line}  ${call.args[0]?.slice(0, 72)}`);
      }
    }
    expect(offenders, `ok(..., false) — say it with fixture():\n${offenders.join('\n')}`).toEqual([]);
  });

  /*
   * Rule 2. Options in the third position. A two-argument call whose second argument is an object
   * literal is the fault; `(fn, arg, {timeout})` and `(fn, undefined, {timeout})` are both fine, and
   * so is a two-argument call passing a real argument.
   */
  it('binds every waitForFunction in the argument position Playwright reads', () => {
    const offenders: string[] = [];
    for (const [file, src] of source) {
      for (const call of callsOf(src, 'waitForFunction')) {
        const second = call.args[1] ?? '';
        if (call.args.length === 2 && second.startsWith('{')) {
          offenders.push(`${file}:${call.line}  second arg is ${second.slice(0, 48)}`);
        }
      }
    }
    expect(offenders, `waitForFunction options in the arg slot — the bound becomes 30s:\n${offenders.join('\n')}`).toEqual(
      [],
    );
  });

  /* Rule 3. Nothing imports by absolute path: the container it points into does not survive. */
  it('imports by specifier, not by a path into this machine', () => {
    const offenders: string[] = [];
    for (const [file, src] of source) {
      for (const m of src.matchAll(/from\s+['"](\/[^'"]*)['"]/g)) {
        offenders.push(`${file}: ${m[1]}`);
      }
    }
    expect(offenders, `absolute import — breaks in any other checkout:\n${offenders.join('\n')}`).toEqual([]);
  });

  /*
   * And the shared strategy has to actually be shared. This does not demand that every harness import
   * it — `check-ink` and `cycle` never open a fight — but a harness that re-implements the fixture
   * loop locally is how the fleet got sixteen copies of one idea in the first place.
   */
  it('keeps one copy of the re-roll strategy', () => {
    const local: string[] = [];
    for (const [file, src] of source) {
      if (file.startsWith('lib')) continue;
      for (const name of ['forceStance', 'forceFighter', 'forceLeaper', 'pickSpot']) {
        if (new RegExp(`(async\\s+)?function\\s+${name}\\b`).test(src)) local.push(`${file}: ${name}`);
      }
    }
    expect(local, `a private re-roller — import deal()/wants.stance() from lib/fixture.mjs:\n${local.join('\n')}`).toEqual(
      [],
    );
  });
});
