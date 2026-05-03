Review this change like a senior maintainer responsible for long-term stability.

## Standards

- Follow `.ai/code_review.md` as the review standard.
- Read `.ai/reviews/current.md` before starting to understand any prior review context.
- Overwrite `.ai/reviews/current.md` with the final review findings.

## Context

- The code may have been generated or modified by another AI agent.
- Assume intent may be correct, but implementation may be flawed.

## Scope

- Review ONLY the provided diff / PR.
- Use surrounding code only to understand the diff.
- Do NOT audit unrelated parts of the repository.
- Do NOT speculate about unseen code or behavior.

## Constraints

- Only make claims traceable to the diff or inspected surrounding context.
- If a risk depends on code not inspected, mark it as `Potential risk — needs verification`.
- Prioritize actionable, high-signal issues.
- Do NOT report cosmetic/style-only issues.
- Do NOT modify application/source files.
- Prefer minimal fixes over rewrites.

## Review Focus

Review in this order:

1. Correctness
   - Logic errors
   - Edge cases
   - Null/undefined handling
   - Invalid assumptions about state, inputs, or data shape
   - Broken invariants introduced by the change

2. Regressions
   - Behavior changes from the previous implementation
   - Backward compatibility issues
   - API, contract, schema, or data format changes
   - Silent failures or changed error semantics

3. Safety & Reliability
   - Missing validation
   - Error handling gaps
   - Auth/permission issues
   - Data integrity risks
   - Concurrency issues, if applicable

4. Performance
   - Obvious inefficiencies introduced by the change
   - N+1 behavior
   - Repeated expensive work
   - Avoidable I/O or recomputation

5. Tests
   - Missing tests for changed behavior
   - Weak assertions
   - Missing edge case coverage
   - Brittle or flaky test changes

6. Architecture
   - Only report architecture issues when they introduce correctness, reliability, or maintenance risk.
   - Use existing repository patterns as the baseline.

## Process

1. Read `.ai/code_review.md`.
2. Read `.ai/reviews/current.md`.
3. Understand the intent of the diff.
4. Identify behavior added, removed, or changed.
5. Review the diff against the focus areas above.
6. Write the final findings to `.ai/reviews/current.md`, overwriting the file.

## Output Format

Write only the review result to `.ai/reviews/current.md`.

Group findings by severity:

- Critical
- High
- Medium
- Low

For each finding, include:

- **File/Location**
- **Category**: Correctness / Regression / Safety / Performance / Tests / Architecture
- **Issue**
- **Why it matters**
- **When it breaks**
- **Suggested fix**

Also include:

## Potential Risks — Needs Verification

List risks that require broader repo context or runtime validation.

## Unknowns / Gaps

List relevant areas that could not be confidently assessed from the diff.

## If No Major Issues Are Found

Explicitly state that no major issues were found, then list remaining risks or unknowns.
