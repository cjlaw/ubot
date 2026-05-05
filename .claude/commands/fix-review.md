Read `.ai/reviews/current.md` and create a fix plan.

Rules:

- Do not make any code changes
- Follow AGENTS.md and project conventions

Plan format — for each finding, ordered by severity (Critical → High → Medium → Low):

- **Finding**: Brief restatement
- **Action**: Fix | Skip (with reason) | Clarify (with question)
- **Approach**: Specific change to make (file, function, strategy)
- **Tests**: What test coverage is needed, if any
- **Dependencies**: Note if this fix must follow or precedes another

After listing all findings, output a **Summary**:

- Total: X Critical, X High, X Medium, X Low
- Actionable: X fixes, X skips
- Estimated scope: (e.g., "3 small isolated changes, 1 moderate refactor required by finding #2")
- Suggested fix order if dependencies exist

Do not begin fixing. Wait for explicit approval or instruction to proceed.
