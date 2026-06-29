/**
 * Eval harness for the /findepisode semantic ranking.
 *
 * This is NOT a unit test. It hits the real RSS feed and makes real (paid,
 * non-deterministic) Haiku calls, so it lives in scripts/ and is invoked by
 * hand — never wired into `npm test`, or CI would be flaky and cost money.
 *
 *   ANTHROPIC_API_KEY=... npx tsx scripts/eval_findepisode.ts
 *
 * Purpose: measure whether a prompt/model change makes episode matching better
 * or worse, instead of guessing. Workflow:
 *   1. Run it on the CURRENT prompt, record the headline metrics (the baseline).
 *   2. Run it a second time unchanged to see the run-to-run noise floor.
 *   3. Change the prompt in helpers/episode_helper.ts, run again.
 *   4. Keep the change only if the delta beats the noise.
 *
 * Three kinds of case, each scored by its own metric (never blended):
 *   - Single (expectAny): user wants ONE episode; one or more titles are
 *       acceptable identifications of it. Scored by Recall@3 + MRR.
 *   - Set (expectAll): the query asks for a CATEGORY; the whole set should come
 *       back. Scored by set-recall@3 = (expected episodes found) / (expected).
 *       ⚠️ Keep the expected set to ≤3 — the command returns at most 3, so a
 *       larger set caps the score below 1.0 for a UI reason, not a quality one.
 *   - Negative (expectEmpty): should match nothing. Scored by rejection accuracy.
 *
 * Metrics (this is a ranked-retrieval task, so they're classic IR metrics):
 *   - Recall@3 ...... did an acceptable episode land anywhere in the top 3?
 *   - MRR .......... Mean Reciprocal Rank = avg(1 / rank-of-first-correct).
 *                     Rewards ranking the right answer at slot 1 over slot 3.
 *   - set-recall@3 .. for category queries, what fraction of the expected set
 *                     came back in the top 3.
 *   - Rejection .... for queries that SHOULD match nothing, did it return empty?
 */
import { searchEpisodes } from "../helpers/episode_helper.js";

// ---------------------------------------------------------------------------
// 1. DATASET — the actual asset. The runner below is throwaway; this is not.
//
// Identify an episode by number (stable) and/or a title substring (robust when
// an episode has no itunes:episode number). A target matches if EITHER hits.
//
// These run against the LIVE feed. Grow this list over time: every real search
// that misbehaves should become a permanent case here.
// ---------------------------------------------------------------------------
type Target = { number?: number; titleIncludes?: string };
type SingleCase = { query: string; expectAny: Target[] }; // OR — any acceptable
type SetCase = { query: string; expectAll: Target[] }; // AND — the whole set (≤3)
type NegativeCase = { query: string; expectEmpty: true };
type EvalCase = SingleCase | SetCase | NegativeCase;

const CASES: EvalCase[] = [
  // --- single, easy anchors (direct word overlap; should pass on any prompt) ---
  { query: "the game awards episode", expectAny: [{ titleIncludes: "Game Awards" }] }, // #204
  { query: "are AAA games dying", expectAny: [{ titleIncludes: "AAA Games" }] }, // #199

  // --- single, semantic / guest (what the LLM is actually FOR) ---
  { query: "the indie developer interview", expectAny: [{ titleIncludes: "Suttner" }] }, // #106
  { query: "the episode honoring gabe", expectAny: [{ titleIncludes: "Gabe Patillo" }] }, // #198
  { query: "baldur's gate 3 deep dive", expectAny: [{ titleIncludes: "Baldur" }] }, // #192
  { query: "bloodborne spoiler discussion", expectAny: [{ titleIncludes: "Bloodborne" }] }, // #195

  // --- single, recent + the no-number edge case (#201 has no episode number) ---
  { query: "the end of the console wars", expectAny: [{ titleIncludes: "Console Wars" }] }, // #201

  // --- single, OR: ambiguous query — either episode is a valid answer ---
  {
    query: "the switch 2 episode",
    expectAny: [{ titleIncludes: "Electric Boogaloo" }, { titleIncludes: "Dawn of the Switch" }], // #203 or #202
  },

  // hard single: user remembers the role, not the name; must beat the Cuphead-composer distractor
  { query: "hades music composer", expectAny: [{ titleIncludes: "Hot as Hades" }] }, // #160

  // hard single: role-not-name; the GAME "Control" vs the PS5 "Controller" (#145) is the trap
  { query: "control writer", expectAny: [{ titleIncludes: "McCoy" }] }, // #147

  // GUARD: a direct name query that yields ONE genuine fuzzy candidate (#147). Counterweight
  // to removing the single-candidate short-circuit — the lone candidate now flows through the
  // LLM, and this case fails if the LLM wrongly rejects a real match. Must stay recall@3 = 1.
  { query: "angel leigh mccoy", expectAny: [{ titleIncludes: "McCoy" }] }, // #147

  // hard single: name half-remembered + uncoverable alias. Only "travis"/"roberts" hit #70;
  // "deadwards" is in NO show notes, so the match rides on the real name. The generic word
  // "guest" drags in 7 decoys, so #70 (null number; title fingerprint) must win the rerank.
  { query: "travis roberts aka deadwards was a guest", expectAny: [{ titleIncludes: "Ep.70" }] }, // #70

  // hardest name single: "fed" is a unique but 3-char/ambiguous guest name (only #166 has
  // "Super Guest Fed"). Tests whether the LLM trusts a short, easily-dismissed token as a
  // name vs. treating it as noise. "guest" pulls the same 7 decoys; #166 must win on "fed".
  { query: "fed was a guest", expectAny: [{ number: 166 }] }, // #166

  // spelling tolerance: user types "hays" but the notes say "PattyHayesJr" (Hayes). Substring
  // "hays" matches NOTHING — #197 is recalled only via the first name "patty". The LLM must
  // then bridge "patty hays" -> "PattyHayesJr" across the misspelling that the filter can't.
  { query: "patty hays was a guest", expectAny: [{ number: 197 }] }, // #197

  // --- set cases (verified ≤3, all survive the filter) ---
  {
    query: "shabby was the guest",
    expectAll: [{ titleIncludes: "Ep.201" }, { number: 196 }],
  },
  {
    query: "darren korb was the guest",
    expectAll: [{ number: 84 }, { titleIncludes: "Hot as Hades" }],
  },
  {
    query: "spoilercast",
    expectAll: [
      { titleIncludes: "Bloodborne" },
      { titleIncludes: "Last of Us" },
      { titleIncludes: "Uncharted" },
    ],
  },

  // positive, "discusses" bar: NitW is a real discussion topic but NOT the headline
  // (#64 is the Horizon episode). Tests recalling a non-headline topic; 1 real candidate, 7 noise.
  { query: "night in the woods was discussed", expectAny: [{ titleIncludes: "Ep.64" }] }, // #64 (metadata number is null — fingerprint by title)

  {
    query: "the last guardian was discussed",
    expectAny: [{ titleIncludes: "Ep.61" }, { titleIncludes: "Episode 52" }], // #61, Sleepover 52 — both null-number, fingerprint by title
  },

  // semantic equivalence + distractor rejection: RE8 == Resident Evil Village.
  // #166 uses "Village", #172 uses "RE8"; 6 other RE-franchise episodes are decoys.
  {
    query: "resident evil 8",
    expectAll: [{ titleIncludes: "Resident Evil Village" }, { titleIncludes: "RE8" }], // #166, #172
  },

  // --- negatives (should return nothing) ---
  { query: "how do i file my taxes", expectEmpty: true },
  { query: "best ramen in tokyo", expectEmpty: true },

  // hard negatives: plausible games the show never covered. The filter still surfaces a weak
  // decoy, so the LLM IS invoked and must return empty instead of grabbing the lone candidate.
  { query: "madden 2025", expectEmpty: true },       // absent; #204 surfaces via "2025"
  { query: "mina the hollower", expectEmpty: true }, // absent; #189 surfaces via "mina"

  // NORTH STAR — currently unanswerable; documents the two upgrade paths.
  // Fails today: "arnies"≠"Arnolds" filters #ChristmasIII out (retrieval), AND the song
  // is in no show notes (corpus). Recall@3 passing would prove embeddings fixed retrieval;
  // MRR=1 would prove transcripts fixed the corpus. The query that started it all.
  { query: "dueling arnies sing baby its cold outside", expectAny: [{ titleIncludes: "Christmas III" }] },

];

const RUNS_PER_CASE = 5; // average out the model's non-determinism

// ---------------------------------------------------------------------------
// 3. SCORERS — turn one run's output into numbers, by case kind.
// ---------------------------------------------------------------------------
type Episode = { number: string | number | null; title: string };

function matches(episode: Episode, target: Target): boolean {
  if (target.number != null && Number(episode.number) === target.number) return true;
  if (
    target.titleIncludes &&
    episode.title.toLowerCase().includes(target.titleIncludes.toLowerCase())
  )
    return true;
  return false;
}

// Single (OR): hit if ANY target appears; MRR uses the first one's rank.
function scoreSingle(got: Episode[], targets: Target[]) {
  const rank = got.findIndex((ep) => targets.some((t) => matches(ep, t))); // -1 if absent
  const hit = rank !== -1;
  return { recallAt3: hit ? 1 : 0, reciprocalRank: hit ? 1 / (rank + 1) : 0 };
}

// Set (AND): fraction of the expected set that showed up in the top 3.
function scoreSet(got: Episode[], targets: Target[]) {
  const found = targets.filter((t) => got.some((ep) => matches(ep, t))).length;
  return { setRecall: found / targets.length };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ---------------------------------------------------------------------------
// 2 + 4. TASK RUNNER and REPORT.
// ---------------------------------------------------------------------------
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "No ANTHROPIC_API_KEY set — searchEpisodes would fall back to fuzzy-only " +
        "and you'd be evaluating the wrong code path. Aborting.",
    );
    process.exit(1);
  }

  const singleRows: { query: string; recall: number; mrr: number }[] = [];
  const setRows: { query: string; setRecall: number }[] = [];
  const negRows: { query: string; rejected: number }[] = [];

  for (const c of CASES) {
    // run the real search N times, collect the top-3 episodes each time
    const runs: Episode[][] = [];
    for (let i = 0; i < RUNS_PER_CASE; i++) {
      const result = await searchEpisodes(c.query, "eval");
      runs.push(result?.results.map((r) => r.episode) ?? []);
    }

    if ("expectEmpty" in c) {
      negRows.push({
        query: c.query,
        rejected: avg(runs.map((g) => (g.length === 0 ? 1 : 0))),
      });
    } else if ("expectAll" in c) {
      const s = runs.map((g) => scoreSet(g, c.expectAll));
      setRows.push({ query: c.query, setRecall: avg(s.map((x) => x.setRecall)) });
    } else {
      const s = runs.map((g) => scoreSingle(g, c.expectAny));
      singleRows.push({
        query: c.query,
        recall: avg(s.map((x) => x.recallAt3)),
        mrr: avg(s.map((x) => x.reciprocalRank)),
      });
    }
  }

  // Per-case breakdown — this is where you SEE which queries moved between runs.
  if (singleRows.length) {
    console.log("\nSingle cases (query -> one expected episode):");
    console.table(
      singleRows.map((r) => ({ query: r.query, "recall@3": r.recall, MRR: +r.mrr.toFixed(3) })),
    );
  }
  if (setRows.length) {
    console.log("Set cases (query -> a category of episodes):");
    console.table(setRows.map((r) => ({ query: r.query, "set-recall@3": +r.setRecall.toFixed(3) })));
  }
  if (negRows.length) {
    console.log("Negative cases (query -> should be empty):");
    console.table(negRows.map((r) => ({ query: r.query, "rejected%": r.rejected })));
  }

  // Headline metrics — the numbers you compare across prompt versions.
  console.log("─".repeat(40));
  if (singleRows.length) {
    console.log("Recall@3:          ", avg(singleRows.map((r) => r.recall)).toFixed(3));
    console.log("MRR:               ", avg(singleRows.map((r) => r.mrr)).toFixed(3));
  }
  if (setRows.length) {
    console.log("Set-recall@3:      ", avg(setRows.map((r) => r.setRecall)).toFixed(3));
  }
  if (negRows.length) {
    console.log("Rejection accuracy:", avg(negRows.map((r) => r.rejected)).toFixed(3));
  }
  console.log(
    `(${singleRows.length} single + ${setRows.length} set + ${negRows.length} negative, ` +
      `${RUNS_PER_CASE} runs each)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
