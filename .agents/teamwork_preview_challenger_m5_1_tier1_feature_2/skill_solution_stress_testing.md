# Solution Stress Testing Playbook

Pre-submission verification methodology. The goal is to find bugs **before** the judge does. This skill is for anyone verifying a solution: the implementer, a critic, or a dedicated challenger.

## Testing Strategy Selection

Pick the right testing approach based on the problem type:
- Single correct answer: Differential (oracle), Edge case enumeration
- Multiple valid answers: Validator-based, Property checking
- Optimization (min/max): Bound verification, Differential
- Interactive: Protocol simulation, Adversarial interactor
- Constructive: Validator-based, Edge case enumeration

## Differential Testing (Correctness Fuzzing)
The most powerful technique. Compare an optimized solution against a slow-but-obviously-correct oracle on thousands of random inputs.
1. **Generator** — produces random valid inputs
2. **Oracle** — brute-force solver (correct by simplicity, not speed)
3. **Harness** — orchestrates: generate → run both → compare → report

## Performance Testing (TLE/MLE Prevention)
Generate inputs at the **maximum** allowed size. Focus on worst-case structure. Measure wall-clock time and peak memory.

## Edge Case Checklist
Manually construct and test these cases before running the fuzzer:
- Minimal/Maximum N
- Degenerate structures
- Boundary values & overflow triggers
- Empty structures & disconnected components

## Debugging Wrong Answers
Minimize, Trace, Compare, Categorize, Re-fuzz.
