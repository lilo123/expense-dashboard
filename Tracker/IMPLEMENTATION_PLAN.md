# Phase 1.5: Modernization Refactor - Implementation Plan

**Architecture Pattern:** Backend-for-Frontend (BFF) using Next.js App Router, React, Tailwind CSS, shadcn/ui, Supabase, and Groq.
**Objective:** 100% functional parity with the Vanilla JS app. NO new features (Budgets/Health bars) until Phase 1.5 is signed off.

## Step 1: Project Scaffolding & Configuration
- Move existing Vanilla JS files into a `/legacy` folder.
- Initialize Next.js (App Router, TypeScript, Tailwind CSS, ESLint).
- Configure absolute imports and environment variables (`.env.local` for Supabase & Groq keys).
- Initialize shadcn/ui and install base components (Button, Input, Card, ScrollArea).

## Step 2: Supabase Auth & Core Setup
- Install `@supabase/ssr` and `@supabase/supabase-js`.
- Create Supabase client utility for Server Components, Client Components, and Route Handlers.
- Implement Next.js Middleware (`middleware.ts`) for route protection and session refreshing.
- Build the Authentication UI (Login / Sign Up pages) and verify session persistence.

## Step 3: Backend-for-Frontend (BFF) API Routes
- Create `app/api/chat/route.ts` to act as the secure proxy for the Groq API.
- Implement the prompt logic to extract user intent (expense amount, category) securely on the server.
- Ensure raw DB/Groq errors are caught and transformed into graceful fallback messages before returning to the client.

## Step 4: Data Access & Types
- Generate/define TypeScript interfaces for Supabase tables (specifically the `expenses` table for parity).
- Create server-side data fetching utilities to load historical expenses.

## Step 5: UI Implementation & State Management
- Implement Zustand store (`useExpenseStore`) to manage chat history and local expense state.
- Build the `ChatBox` component (input, message list).
- Build the `ExpenseList` / `Dashboard` component to display historical data.
- Implement optimistic UI updates (showing the user's message and a loading state instantly while the BFF processes the request).

## Step 6: Integration & Functional Parity QA
- Wire the UI to the Next.js API routes and Supabase database.
- Perform manual regression testing against the Phase 1.5 Success Criteria (Auth, Chat, Groq AI, DB save, Optimistic updates).
- Final code cleanup and sign-off.
