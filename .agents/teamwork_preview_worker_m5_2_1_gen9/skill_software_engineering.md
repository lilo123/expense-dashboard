---
name: software-engineering
description: >-
  Software engineering methodology for modifying, refactoring, and extending
  large production codebases. Covers call chain analysis, side effect
  changing APIs, or adding features. Don't use for algorithmic puzzles
use_for: >-
  Modifying existing code, performing surgical changes, and ensuring correctness.
dont_use_for: Algorithmic puzzles or competitive programming.
---

1.  **Read the failing test or requirement** — understand WHAT needs to change
2.  **Trace the call chain** — find all callers and callees of the target code
3.  **Perform surgical changes** — touch only what you must, keep changes minimal and clean
4.  **Verify correctness** — run build and tests to ensure no regressions
