# Solution Stress Testing Playbook

Pre-submission verification methodology. The goal is to find bugs **before** the judge does. This skill is for anyone verifying a solution: the implementer, a critic, or a dedicated challenger.

## Testing Strategy Selection
Pick the right testing approach based on the problem type:
| Problem Type             | Primary Test          | Secondary Test         |
| ------------------------ | --------------------- | ---------------------- |
| Single correct answer    | Differential (oracle) | Edge case enumeration  |
| Multiple valid answers   | Validator-based       | Property checking      |
| Optimization (min/max)   | Bound verification    | Differential (if feasible) |
| Interactive              | Protocol simulation   | Adversarial interactor |
| Special judge            | Replicate checker     | Differential           |
| Constructive             | Validator-based       | Edge case enumeration  |

## Differential Testing (Correctness Fuzzing)
The most powerful technique. Compare an optimized solution against a slow-but-obviously-correct oracle on thousands of random inputs.
1. **Generator** — produces random valid inputs
2. **Oracle** — brute-force solver (correct by simplicity, not speed)
3. **Harness** — orchestrates: generate → run both → compare → report

## Performance Testing (TLE/MLE Prevention)
- Max-Constraint Input Generation: Generate inputs at the maximum allowed size. Focus on worst-case structure.
- Time Measurement: Measure wall-clock time. Target ≤ 50% of time limit.
- Memory Measurement: Track peak memory (RSS).

## Edge Case Checklist
- Minimal: smallest N allowed by constraints
- Maximum: N at upper constraint bound
- Degenerate: all elements equal, sorted, reverse-sorted
- Boundary values: 0, -1, 1, INT_MAX, INT_MIN
- Overflow triggers, empty structures, disconnected graphs, constraint boundary interactions.

## Verification Checklist (Pre-Submission Gate)
- [ ] All sample test cases pass
- [ ] Manual edge cases pass
- [ ] Differential fuzzing passed
- [ ] No integer overflow in intermediate computations
- [ ] Max-constraint inputs finish within 50% of time limit
- [ ] Memory usage within limit on max-constraint inputs
- [ ] Multi-test cleanup verified
