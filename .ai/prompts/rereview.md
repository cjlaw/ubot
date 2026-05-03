Re-review the code after fixes have been applied.

## Standards

- Follow `.ai/code_review.md` as the review standard.
- Read previous findings from `.ai/reviews/current.md`.
- Overwrite `.ai/reviews/current.md` with only remaining and new findings.

## Context

- Previous review findings are in `.ai/reviews/current.md`.
- The code has been updated to address those findings.
- The goal is to verify fixes, not to restart the entire review from scratch.

## Scope

- Compare the current code against the previous findings in `.ai/reviews/current.md`.
- Verify whether each previous issue is resolved, partially resolved, or still present.
- Review the applied fixes for regressions.
- Do NOT repeat issues that are clearly fixed.
- Do NOT modify application/source files.

## Constraints

- Only make claims based on inspected code.
- Be strict about whether fixes address root causes.
- Do NOT accept superficial fixes that only silence the symptom.
- Prioritize correctness, regressions, safety, and tests.
- Report new issues only if they were introduced by the fixes or are high-risk gaps discovered during verification.
- Avoid cosmetic/style-only feedback.

## Review Focus

1. Resolution status
   - Which previous issues are fully resolved?
   - Which are partially resolved?
   - Which still exist?

2. Fix quality
   - Did the fix address the root cause?
   - Did it preserve existing behavior?
   - Did it introduce new edge cases?

3. Regressions
   - New correctness bugs
   - Changed API or data contracts
   - Changed error semantics
   - New performance or reliability risks

4. Test adequacy
   - Were appropriate tests added or updated?
   - Do tests cover the original failure scenario?
   - Are assertions strong enough?

5. Severity changes
   - Should any remaining issue be upgraded or downgraded?

## Process

1. Read `.ai/code_review.md`.
2. Read `.ai/reviews/current.md`.
3. For each previous finding:
   - Locate the relevant code.
   - Determine status: Resolved / Partially resolved / Still present.
   - Verify whether the fix creates regressions.
4. Identify any new high-risk issues introduced by the fixes.
5. Overwrite `.ai/reviews/current.md` with only remaining and new findings.

## Output Format

Write only the re-review result to `.ai/reviews/current.md`.

Include these sections:

## Summary

- Resolved issues
- Partially resolved issues
- Remaining issues
- New issues
- Severity changes, if any

## Findings

Group only remaining and new issues by severity:

- Critical
- High
- Medium
- Low

For each finding, include:

- **File/Location**
- **Status**: Partially resolved / Still present / New
- **Category**: Correctness / Regression / Safety / Performance / Tests / Architecture
- **Issue**
- **Why it matters**
- **When it breaks**
- **Suggested fix**

## Unknowns / Gaps

List anything that could not be confidently verified.

## If All Issues Are Resolved

Explicitly state that all previous issues appear resolved, then list any remaining risks or unknowns.
