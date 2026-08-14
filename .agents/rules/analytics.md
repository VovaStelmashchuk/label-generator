---
description: Analytics event tracking rule
---

# Analytics Actions

When tracking analytics events, **always** use hardcoded string literals for the event action names.

Do NOT use an enum or a centralized object (like `ACTIONS.eventName`).

For example:
- **Correct**: `track('labels_generated', { ... })`
- **Incorrect**: `track(ACTIONS.labelsGenerated, { ... })`
