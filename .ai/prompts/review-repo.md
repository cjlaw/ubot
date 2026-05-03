Perform a repository-wide code review like a senior maintainer performing a periodic audit.

## Standards

- Follow `.ai/code_review.md` as the review standard.
- Read `.ai/reviews/current.md` before starting to understand any prior review context.
- Overwrite `.ai/reviews/current.md` with the final review findings.

## Context

- The repository may include code generated or modified by AI agents.
- Assume intent may be correct, but implementations may be inconsistent or flawed.

## Scope

- Review the entire repository, not just the current diff.
- Focus on high-risk areas first:
  - Core flows
  - Entry points
  - Shared utilities
  - Public APIs
  - Auth/permissions
  - Data handling
  - Persistence
  - Background jobs
  - External service boundaries
  - Tests
- Do NOT modify application/source files.
- Do NOT report cosmetic/style-only issues.

## Constraints

- Only make claims traceable to inspected code.
- Do NOT infer behavior across files unless explicitly verified.
- If uncertain, mark it as `Unknown` or `Potential risk — needs verification`.
- Prioritize actionable, high-signal issues.
- Prefer systemic patterns over isolated instances.
- If multiple instances exist, show 1–2 representative examples.
- Avoid broad rewrite recommendations unless the current design creates concrete risk.

## Review Focus

Review in this order:

1. Correctness
   - Logic errors
   - Broken invariants
   - Edge cases handled inconsistently
   - Invalid assumptions between modules

2. Regressions & Inconsistencies
   - Diverging implementations of similar logic
   - Inconsistent API contracts
   - Inconsistent data handling
   - Changed or unclear error semantics

3. Safety & Reliability
   - Missing validation
   - Error handling gaps
   - Auth/permission risks
   - Data integrity risks
   - Concurrency/shared-state issues
   - Persistence or migration risks

4. Architecture
   - Violations of established repository patterns
   - Tight coupling
   - Hidden dependencies
   - Boundary confusion between modules
   - Accidental complexity that creates maintenance risk

5. Performance
   - Obvious inefficiencies in hot paths
   - N+1 patterns
   - Repeated expensive work
   - Avoidable I/O
   - Missing batching/caching where clearly needed

6. Tests
   - Missing coverage for critical flows
   - Weak assertions
   - Lack of integration coverage where unit tests are insufficient
   - Brittle or flaky tests
   - Mismatch between implementation complexity and test depth

## Process

1. Read `.ai/code_review.md`.
2. Read `.ai/reviews/current.md`.
3. Map the repository:
   - Identify entry points.
   - Identify core modules and shared utilities.
   - Identify data flow boundaries.
   - Identify persistence boundaries.
   - Identify auth/permission boundaries.
   - Identify test structure and coverage patterns.
4. Identify the highest-risk areas.
5. Deep-review those areas against the focus list.
6. Identify systemic or repeated patterns.
7. Write the final findings to `.ai/reviews/current.md`, overwriting the file.

## Output Format

Write only the review result to `.ai/reviews/current.md`.

Include these sections:

## Summary

- Highest-risk areas reviewed
- Overall risk level
- Major themes

## Systemic Issues

List cross-cutting issues affecting multiple areas.

## Findings

Group findings by severity:

- Critical
- High
- Medium
- Low

For each finding, include:

- **File/Location** or representative locations
- **Category**: Correctness / Regression / Safety / Architecture / Performance / Tests
- **Issue**
- **Why it matters**
- **When it breaks**
- **Suggested fix**

## Unknowns / Gaps

List areas not confidently reviewed, areas requiring runtime validation, or parts of the repository that need deeper inspection.

## If No Major Issues Are Found

Explicitly state that no major issues were found, then list residual risks and unknowns.
