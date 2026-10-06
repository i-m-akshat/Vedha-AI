# E2E Test Infra: Vedha AI Chrome Extension

## Test Philosophy
- Opaque-box, requirement-driven derived strictly from `ORIGINAL_REQUEST.md` (R1–R4).
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- Zero dependency on internal implementation quirks; test against DOM standards, MV3 extension contracts, and portal behaviors.

## Feature Inventory & Test Matrix
| # | Feature | Requirement | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Real-World) |
|---|---------|-------------|:----------------:|:-----------------:|:-----------------:|:-------------------:|
| F1 | Floating Dock Elevation & Stacking | R1 | 5 | 5 | ✓ | ✓ |
| F2 | Dock Pinning Persistence & Fallback Injection | R1 | 5 | 5 | ✓ | ✓ |
| F3 | Native Chrome Side Panel & Responsive Viewport | R1 | 5 | 5 | ✓ | ✓ |
| F4 | Universal Constraint & Error Association | R2 | 5 | 5 | ✓ | ✓ |
| F5 | Deterministic Sanitization & Self-Healing | R2 | 5 | 5 | ✓ | ✓ |
| F6 | React/Vue Reactivity & Composed Event Dispatch | R2 | 5 | 5 | ✓ | ✓ |
| F7 | Visual Review Badging & Optional Field Handling | R2 | 5 | 5 | ✓ | ✓ |
| F8 | Scoped Progression Discovery & Button Priority | R3 | 5 | 5 | ✓ | ✓ |
| F9 | Step Fingerprint Verification & Loop Prevention | R3 | 5 | 5 | ✓ | ✓ |
| F10 | Interactive Review Gateway & Confirmation | R3 | 5 | 5 | ✓ | ✓ |
| F11 | Comprehensive Candidate Profile Fallback | R4 | 5 | 5 | ✓ | ✓ |
| F12 | Idempotent Script Injection & Messaging Resilience | R4 | 5 | 5 | ✓ | ✓ |
| **Total** | | | **60** | **60** | **12** | **6** |

**Grand Total Test Target**: 138 test cases across Tiers 1–4.

## Test Architecture
- **Test Runner**: Node.js test suite executed via `& "C:\Program Files\nodejs\node.exe" tests/e2e/runner.js`.
- **Pass/Fail Semantics**: Process exits with code `0` on 100% pass, non-zero code on any failure.
- **Directory Layout**:
  - `tests/e2e/runner.js`: Orchestrates suite execution, tier breakdown, assertion verification, and reporting.
  - `tests/e2e/tier1_features.test.js`: 60 feature coverage unit/integration tests (5 per feature).
  - `tests/e2e/tier2_boundaries.test.js`: 60 boundary and extreme input tests (5 per feature).
  - `tests/e2e/tier3_pairwise.test.js`: 12 cross-feature interaction scenarios.
  - `tests/e2e/tier4_realworld.test.js`: 6 end-to-end simulated job portal application scenarios (LinkedIn Easy Apply, Greenhouse, Workday, Ashby, Lever, Custom Portal).

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | LinkedIn Easy Apply Multi-Step Flow | F1, F2, F4, F5, F6, F8, F9, F10 | High |
| 2 | Greenhouse Job Board with Strict Validation | F4, F5, F6, F7, F8 | High |
| 3 | Workday Enterprise Application Modal with Web Components | F1, F4, F5, F6, F9, F10 | High |
| 4 | Offline Backend Mode with Fallback Profile & Form Filling | F5, F6, F11 | Medium |
| 5 | Background Script Dynamic Tab Injection & Messaging Recovery | F3, F12 | Medium |
| 6 | Side Panel Persistent Job Application Multi-Tab Context Sync | F1, F3, F10, F12 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature (60 total)
- Tier 2: ≥5 per feature (60 total)
- Tier 3: ≥12 pairwise cross-feature combinations
- Tier 4: ≥6 realistic application workflows
- Exit criteria: 100% test pass rate with exit code 0.
