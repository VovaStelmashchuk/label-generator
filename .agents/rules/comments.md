---
description: When a code comment is allowed to exist
---

# Comments

A comment explains **why**, never **what**. Write one only when the code cannot
state the reason itself:

- a constraint imposed from outside the file (a printer, a browser, a library's
  behaviour, an env var that only exists at runtime),
- an approach that was tried and rejected, so nobody "simplifies" it back,
- a bug the shape of the code is defending against.

Anything a careful reader already gets from the line below it is noise.

**The test:** delete the comment. If nothing is lost, leave it deleted.

This binds AI agents in particular. A diff is not the place to show your work —
do not annotate an edit to prove it was made, and do not leave a comment behind
as a receipt for a review comment you addressed.

## Never write

- **Restating the code**: `// create the pool` above `const pool = new Pool()`
- **Labelling an obvious block**: `// helpers`, `// imports`, `// state`
- **Narrating the edit**: `// now lazy`, `// fixed the OOM`, `// changed per
  review`, `// was mongo, now postgres`
- **Section banners**: `// ---------- utils ----------`
- **Commented-out code**: delete it; git remembers.
- **Redundant JSDoc**: `@param spec The spec` on a typed signature. Types
  already say the what; prose is for the why.

## Do write

```ts
// Measuring character by character drifts up to 6% on kerned pairs; whole
// same-style runs measure exact.
const fragments = toFragments(line);
```

```ts
// Read in a server component, so this binds at runtime, not build time.
const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
```

Both survive the test: the constraint is invisible from the code alone, and
deleting the comment loses a reason a future reader would otherwise re-derive
the hard way.
