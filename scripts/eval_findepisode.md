# /findepisode eval

Companion to [eval_findepisode.ts](eval_findepisode.ts): how to run it, the current baseline, and the run history. The dataset and scorer details live in the script's header comments.

The eval hits the live RSS feed and makes real (paid) Anthropic calls. Run it by hand only — never from `npm test` or CI.

## Running

```bash
# Stage-1 only (fuzzy retrieval recall) — free, no API calls
env -u ANTHROPIC_API_KEY npx tsx scripts/eval_findepisode.ts

# End-to-end: fuzzy retrieval -> LLM rerank, exactly as prod
npx tsx --env-file=.env scripts/eval_findepisode.ts

# Rerank-only: gold injected into the candidate set, fuzzy picks as decoys
npx tsx --env-file=.env scripts/eval_findepisode.ts --rerank
```

The embedding columns in the stage-1 table need the linux/amd64 dev container (see `CLAUDE.md`); on an Intel Mac host they are skipped with a warning.

## Which mode

| You changed | Run | Why |
| --- | --- | --- |
| Model, prompt, or tool schema in `llmPickTop3` | `--rerank` | Stage-1 misses can't cap the score, so deltas are the reranker's |
| `fuzzyFilter`, `FUZZY_TOP_N`, embeddings | Stage-1 table + end-to-end | Rerank injects gold and hides retrieval changes |
| Anything before shipping | End-to-end | The only mode that matches prod |

- Compare runs in the same mode, on the same day (the live feed drifts).
- Run the baseline twice first; the gap between the two is the noise floor. A change has to beat it.
- Rerank scores are an upper bound for the model, not product quality. Don't put them next to end-to-end numbers.
- Rerank decoys come from `fuzzyFilter`, so a `fuzzyFilter` change invalidates the rerank baseline.

## Current baseline

Recorded 2026-10-07 · `claude-haiku-5-5` · word-start `fuzzyFilter` · 5 runs per case.

| Metric | End-to-end | Rerank |
| --- | --- | --- |
| Recall@3 | 1.000 | not recorded |
| MRR | 0.956 | not recorded |
| Set-recall@3 | 1.000 | not recorded |
| Rejection accuracy | 1.000 | not recorded |
| Cases | 18 single + 4 set + 4 negative | — |
| North Star | recall@3 0 · MRR 0.000 | — |

Stage-1 (no LLM): fuzzy recall 0.947 (18/19 — the North Star is the only miss), set-recall 1.000. Every negative passes at least 1 candidate to the LLM.

Record a rerank baseline (twice) before the next prompt or model change.

## Labeling rules

- **Lenient bar.** For a game the show never covered, a same-franchise episode is the preferred answer over empty ("hollow knight silksong" → Ep.104, which discusses Hollow Knight). Such queries are positive cases, not negatives.
- **Negatives need unrelated decoys.** Before adding one, read the candidates' show notes, not just their titles. Searching only for "silksong" missed that Ep.104 discusses Hollow Knight, and it was mislabeled as a negative.
- **Negatives must reach the LLM.** After any `fuzzyFilter` change, check the stage-1 `fuzzy cands` column. 0 means the case only tests the filter (how "mina the hollower" died: its lone decoy was "mina" inside "illumination").
- **The North Star stays out of the headline.** It's reported on its own line.

## Findings

- **Haiku 4.5 → 5.5 was a tie** on the original case set (end-to-end, identical to three decimals). The set couldn't discriminate between the models; 5.5 shipped on cost.
- **North Star diagnosis.** Christmas III's notes say "Dueling of the Arnolds", so it shares only "dueling" with the query and ties with ~20 episodes; Christmas VI and VIII say "Dueling Arnies" and outrank it. With III injected (`--rerank`), recall@3 is 1 but MRR is about 0.6: the LLM finds "a Christmas episode" but can't tell which year had the song, because the song is in no show notes. Transcripts are the fix, not retrieval or the prompt.
- **Substring matching was noisy.** `includes()` let "sing" hit "losing" and "its" hit "visits", filling 6 of the North Star query's top 8 with noise. Word-start matching fixed it with no recall loss. "patty" still hits "PattyHayesJr", which is why matching is word-start and not whole-word. Remaining known noise: "bot" still matches "both".
- **The eval is near its ceiling.** Most headroom is in MRR. To discriminate future changes it needs harder cases; real failed queries from the prod `[episode-search]` logs are the best source.

## History

All runs are 5 per case. The case set changed between rows, so compare only within a row group.

| Date | Model | Mode | Recall@3 | MRR | Set | Reject | Cases (S+Set+Neg) | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-07 | haiku-4-5 | e2e | 0.941 | 0.912 | 1.000 | 1.000 | 17+4+4 | Original set; North Star counted in headline |
| 2026-10-07 | haiku-5-5 | e2e | 0.941 | 0.912 | 1.000 | 1.000 | 17+4+4 | Identical to 4.5 |
| 2026-10-07 | haiku-5-5 | rerank | 1.000 | 0.975 | 1.000 | 1.000 | 16+4+4 | North Star excluded (recall 1, MRR 0.600) |
| 2026-10-07 | haiku-5-5 | e2e | 1.000 | 0.969 | 1.000 | 0.680 | 16+4+5 | Word-start matching; 2 mislabeled negatives; superseded |
| 2026-10-07 | haiku-5-5 | rerank | 1.000 | 0.975 | 1.000 | 0.640 | 16+4+5 | Same mislabeled set (North Star MRR 0.633); superseded |
| 2026-10-07 | haiku-5-5 | e2e | 1.000 | 0.956 | 1.000 | 1.000 | 18+4+4 | **Current baseline** |

Append a row for every run you act on.
