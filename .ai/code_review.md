# Code Review Guidelines

Review changes like a senior maintainer. Prioritize correctness and risk over style.

## Scope

- Review ONLY the current diff (or specified commit/PR)
- Use existing codebase patterns as the standard
- Do not rewrite code unless necessary to explain a fix

## Focus Areas

### 1) Correctness

- Logical errors, edge cases, off-by-one, null/undefined handling
- Incorrect assumptions about data shape or state
- Broken invariants

### 2) Regressions

- Behavior changes vs existing code
- Backward compatibility (APIs, contracts)
- Silent failures

### 3) Tests

- Missing tests for new behavior
- Weak assertions
- Edge cases not covered
- Flaky or brittle tests

### 4) Safety

- Input validation
- Error handling paths
- Auth / permissions (if applicable)
- Data integrity

### 5) Performance (when relevant)

- Obvious inefficiencies (N+1, unnecessary loops, blocking ops)
- Large data handling
- Avoid premature optimization

### 6) Architecture & Consistency

- Violations of existing patterns
- Unnecessary abstraction or complexity
- Leaky boundaries between layers

## Avoid

- Cosmetic/style-only comments
- Renaming unless it impacts clarity or correctness
- Generic “best practices” not grounded in this codebase
- Large rewrites unless current approach is clearly wrong

## Output Format

Group findings by severity:

### Critical

- Breaks functionality, data integrity, or security

### High

- Likely bug, missing validation, or major gap

### Medium

- Maintainability or moderate risk

### Low

- Minor improvements (only if high-signal)

For each finding include:

- **File/Location**
- **Issue**
- **Why it matters**
- **When it breaks (scenario)**
- **Suggested fix (brief)**

## Rules

- Prefer fewer, high-signal findings over exhaustive lists
- If no major issues, explicitly say so and list remaining risks
- Do NOT modify files during review unless explicitly asked
