---
name: test-coverage-audit
description: >-
  Adversarial test coverage audit. Analyzes the specification and
  existing test suite to find untested features, then generates
  adversarial test cases to expose the gaps. Optionally reads
  implementation source for deeper whitebox analysis.
use_for: >-
  Auditing test suite completeness, finding untested features, or
  generating adversarial test cases.
dont_use_for: >-
  Writing the initial test suite, stress testing, or opaque-box test design.
---

# Test Coverage Audit Playbook

Adversarial audit of a test suite's feature coverage. Your job is to find what
the tests **don't** test — then write tests that expose those gaps.

## Audit Modes

This playbook operates in two modes depending on available inputs:

-   **Opaque-box** (spec + tests only): Audit coverage against the
    specification. Use when implementation source is not available or when
    testing must be requirement-driven.
-   **Whitebox** (spec + tests + source): Additionally analyze implementation
    code to find untested code paths and potential bugs. Use when you have
    access to the implementation source.

## Prerequisites

You need access to:

1.  **Specification** — `ORIGINAL_REQUEST.md`, `PROJECT.md`, or any document
    listing what the product must do
2.  **Existing test suite** — the tests you are auditing
3.  **Implementation source code** (whitebox mode only) — the product being
    tested. Enables Source B analysis in Phase 1.
4.  **Reference implementation** (if available) — an oracle to verify your
    adversarial tests produce the correct output

## Audit Procedure

### Phase 1: Feature Matrix Extraction

Build a comprehensive checklist of every feature the product supports. Use
**three sources** (any missing source = lower confidence):

**Source A — Specification** (most authoritative): Read `ORIGINAL_REQUEST.md` or
equivalent. Extract every capability/feature the product claims to support — including
**implicit features** that the specification entails but does not explicitly
enumerate.

**Source B — Implementation** (whitebox mode only): Analyze the source code and
development artifacts to identify additional attack surfaces. Look for:
-   Code paths that no existing test exercises
-   Worker-reported caveats, known weaknesses, or TODO comments (in their `handoff.md`)
-   Complex branching logic (switch/case, type dispatch) with partial test coverage
-   Potential bugs visible from code inspection (off-by-one, missing error handling, unvalidated inputs)

**Source C — Existing test suite** (catches features only known to tests): Scan
test file names and test code. If a test exercises a feature not in your matrix, add it.

**Merge**: Combine all sources. Each feature should appear once. Mark which sources mention it.

### Phase 2: Feature-to-Test Mapping

For each feature in the matrix, find whether the existing test suite exercises it.

### Phase 3: Gap Report

For each uncovered feature, assess Severity and Why it matters.

### Phase 4: Adversarial Test Generation

For each gap (prioritized by severity), write a test case designed to make the product under test fail.
Naming convention: Prefix adversarial tests with `adv_`.

### Phase 5: Validation

1. Run every adversarial test against the reference implementation (if available).
2. Run against the product under test. Record pass/fail.
3. Any failure confirms the gap was real. Report the failure with expected vs. actual output.

## Output Format

Produce a single handoff report with concrete file references:
## Coverage Audit Summary
## Feature Matrix
## Gap Report
## Adversarial Test Results
## New Test Files
