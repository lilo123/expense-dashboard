# Wealth App Project Kanban Board & Milestones Status

This document tracks the status of all development phases, milestones, and feature integrations.

---

## 1. Milestones Overview

- [x] **Phase 1.5:** Core Dashboard Framework, Next.js App Router Scaffolding, and Supabase Integration.
- [x] **Phase 1.6:** Automated Test Harness (Jest Unit Tests, Playwright viewport E2E, and BFF network mocks).
- [x] **Phase 1.65:** Postgres Trigger Categories Auto-Seeding & Multi-Currency conversion pipeline.
- [x] **Phase 1.7:** User Profile Management, Protected settings routes, and transactional category seeding.
- [x] **Phase 1.8:** Background Chron Automation, pg_cron hourly workers, janitor purges, Yearly Stacked Breakdown Charts, and Advanced Touch Gestures long-press bulk selection.
- [x] **Phase 2:** RPG-style Budget "Health Bars" & Next.js 15 Route Refinements (MVP v2).
- [ ] **Phase 3:** Budget Rollovers and Avatars Gamification.

---

## 2. Phase 1.8 Detailed Checklists (Kanban Status)

### A. Database & Automation [100% COMPLETED]
- [x] Create `recurring_expenses` postgres schema tables.
- [x] Establish database trigger `seed_first_next_occurrence` on configs insertion.
- [x] Implement PL/pgSQL function `process_recurring_expenses` for calendar matching.
- [x] Schedule pg_cron hourly runner (`0 * * * *`) to execute global local timezones.
- [x] Schedule pg_cron daily janitor (`0 0 * * *`) to automatically prune logs under 7 days (Free Tier compliance).

### B. UI/UX Advanced Polish [100% COMPLETED]
- [x] Category Relocation: inline card under settings `/settings` page.
- [x] Profile dropdown: inject `"Recurring Expense"` above Siri Setup.
- [x] Yearly Breakdown stacked bar charts (Lavender/One-off vs Sage/Recurring) with SIMPLE toggle.
- [x] Mobile Press-and-Hold (Long Press) Selection gestures with vibration feedback and scroll safety.
- [x] Custom dynamic sort select (`Sort by Date: Newest`) using transparent select overlay styling.
- [x] Unified absolute card corner-anchored vectors SVG close buttons across all 6 modal triggers.
- [x] Bounding box `w-fit` header alignment overrides to prevent false-positive coordinate overlap collisions.
- [x] Mathematical filter heights alignment locking search and selects to exactly `36px` height.

### C. Verification & Test Automation [100% COMPLETED]
- [x] Write Jest component tests for first execution date math calculations.
- [x] Write Playwright E2E tests for weekly/monthly configs creation, deletion, and pg_cron validations.
- [x] Write Playwright E2E mathematical height alignment assertions to check filter heights.
- [x] Sequential browser validation passed perfectly (36/36 E2E tests passed green!).
