# 🛠️ PambantuLog

**Enterprise-Grade Internal Helpdesk & Ticketing System with Built-in Serverless Protection**

[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.15.1-339933?logo=node.js)](https://nodejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2F%20Postgres-3ECF8E?logo=supabase)](https://supabase.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle)](https://orm.drizzle.team/)
[![Upstash](https://img.shields.io/badge/Upstash-Redis%20Rate%20Limit-00E599?logo=redis)](https://upstash.com/)
[![Tests](https://img.shields.io/badge/Tests-78%20Passed-22c55e?logo=checkmarx)](scripts/test-suite.ts)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

[**Live Demo**](https://pambantulog.vercel.app) • [**Architecture Specs**](./docs/architecture.md) • [**Brand Guidelines**](./docs/branding.md) • [**Progress Report**](./docs/progress_report.md)

<br />

<p align="center">
  <img src="./public/preview-live.png" alt="PambantuLog Helpdesk Live Application Preview" width="820" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.25);" />
</p>

---

## 📌 Overview

**PambantuLog** is a full-stack, enterprise-ready internal helpdesk and ticketing platform built for cross-department incident tracking and technical support. Engineered on **Next.js 16 (App Router)** and deployed to Vercel's serverless runtime, the application implements zero-trust security, strict serverless workload protection, dual-driver rate limiting, cryptographic session token signing, and client-side media optimization.

---

## ✨ Key Features

### 🛡️ Serverless Workload Protection & Restrictions
- **Client-Side Adaptive Compression**: Lossless/adaptive HTML5 Canvas compression (`src/lib/file-compression.ts`: max 1920px, 0.8 quality, WebP/JPEG, target size 300–600 KB) before uploading to object storage.
- **Strict File Upload Whitelist**: Enforces MIME and extension validation (`.png`, `.jpg`, `.jpeg`, `.webp`, `.pdf`, `.log`) with a hard cap of 5 attachments per ticket. Rejects dangerous executables (`.exe`, `.bat`, `.sh`, `.cmd`).
- **Distributed & In-Memory Rate Limiting**: Dual-driver rate limiter (`src/lib/rate-limit.ts`) using Upstash Redis sliding window with memory fallback, featuring non-consuming quota inspection (`peekRateLimit`) and quota reset triggers:
  - *Ticket Creation*: Max 5 tickets / 10 minutes per IP/User.
  - *Comments*: Max 15 comments / minute per User.
  - *Authentication*: Max 5 failed attempts / 15 minutes per identifier with automatic counter reset upon successful login.
- **Idempotency Protection**: Token-based anti-double submission guard (`src/lib/idempotency.ts` with 120s TTL) preventing duplicate ticket creations during network latency or accidental double-clicks (`HTTP 409 Conflict`).
- **Strict Pagination & Query Hard-Cap**: Prevents database Denial-of-Service with a hard cap of 50 records per request (`Math.min(limit, 50)`), sanitized positive page indexing, and 350ms debounced search hooks (`useTicketSearch`).
- **Export Guard & Cooldown**: Protected CSV data exporter (`src/lib/export-guard.ts`) with a mandatory 30-day date range cap, 1,000 records maximum output, 2-minute user cooldown, RFC 4180 quotation escaping, and role-based agent ticket isolation.
- **Keep-Alive Supabase Ping**: Automated health check and anti-inactivity ping endpoint (`/api/v1/ping`) orchestrated with GitHub Actions (`.github/workflows/supabase-ping.yml`) to prevent free-tier database freezing.

### 🔐 Security & Access Control
- **Next.js 16 Edge Proxy RBAC**: Server-side route interception (`src/proxy.ts`) enforcing role-based access control across `/(dashboard)` segments (`ADMIN`, `AGENT`, `EMPLOYEE`).
- **Cryptographic Session Verification**: Dual-mode session handling with HMAC SHA-256 signed cookie token validation (`src/lib/auth-session.ts`).
- **PostgreSQL Row Level Security (RLS)**: Enforced database-level isolation ensuring employees only access their own tickets (`createdById = auth.uid()`) while technicians and administrators maintain authorized visibility.
- **Type-Safe Validation Pipeline**: Strict input sanitization and schema contracts via Zod across all API endpoints, handling multipart form duplicate keys and whitespace trimming.

### 🎫 Helpdesk Workflow & Analytics
- **Deterministic Ticket State Machine**: Predictable lifecycle transitions (`OPEN` → `IN_PROGRESS` → `WAITING_ON_USER` → `RESOLVED` → `CLOSED`).
- **Timezone-Standardized Analytics**: Accurate server-side aggregation for daily, monthly, and yearly metrics standardized to Asia/Jakarta (WIB, UTC+7).
- **Threaded Communication & Multi-Attachments**: Centralized, audit-trailed comment threads with backward-compatible JSON-serialized attachment arrays.
- **CSAT Feedback System**: Automated post-resolution Customer Satisfaction scoring modal triggered upon reaching `RESOLVED` status.
- **Responsive Mobile UX**: Adaptive master ticket list and dashboard layout smoothly converting tables to responsive card stacks on mobile devices.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16.2.6 (App Router, Turbopack) |
| **Runtime** | Node.js >= 20.15.1 |
| **UI & Styling** | React 19, Tailwind CSS v4 (`@theme inline`, OKLCH colors), Radix UI, Lucide Icons, Sonner |
| **Data & ORM** | PostgreSQL (Supabase), Drizzle ORM |
| **Authentication** | Supabase Auth + Dual-Mode HMAC SHA-256 Signed Session Cookies |
| **Protection & Cache** | Upstash Redis (`@upstash/ratelimit`), In-Memory Sliding Window |
| **Schema Validation** | Zod v3 |
| **Keep-Alive & CI/CD**| GitHub Actions scheduled workflows (`.github/workflows/supabase-ping.yml`) |
| **Testing** | Node.js Test Runner via TypeScript (`tsx`) — **78 automated tests** (68 Restriction & Protection + 10 Edge Proxy RBAC) |

---

## 🚀 Getting Started

### 1. Clone Repository
```bash
git clone https://github.com/twiners212/PambantuLog.git
cd PambantuLog
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local` and populate the required credentials:
```bash
cp .env.example .env.local
```

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# PostgreSQL Connection (Drizzle ORM)
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres

# Session Secret (Optional - falls back to SUPABASE_SERVICE_ROLE_KEY)
SESSION_SECRET=your-32-char-minimum-random-secret

# Upstash Redis (Optional - falls back to In-Memory for dev)
UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token

# Optional Seed Passwords
SEED_ADMIN_PASSWORD=your_admin_password
SEED_USER_PASSWORD=your_user_password
```

### 4. Database Setup & Migrations
```bash
# Push Drizzle schema to Supabase database
npx drizzle-kit push

# Seed initial admin and demo user accounts (optional)
node scripts/seed.mjs
```

### 5. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🧪 Testing & Quality Assurance

```bash
# Run comprehensive automated test suite (78 test cases)
npm test

# Run TypeScript type check (0 errors)
npm run typecheck

# Run ESLint validation (0 warnings)
npm run lint

# Build production bundle with Turbopack
npm run build
```

---

## 📁 Project Structure

```text
PambantuLog/
├── .github/              # CI/CD Workflows (Supabase Keep-Alive Ping)
│   └── workflows/
│       └── supabase-ping.yml
├── docs/                 # System Documentation & Specifications
│   ├── architecture.md   # Detailed Architecture & Security Specs
│   ├── branding.md       # Official Brand Identity & Logo Guidelines
│   ├── HANDOFF.md        # Technical handoff & pending items
│   ├── prd.md            # Master Product Requirements Document
│   └── progress_report.md# Milestone tracking & audit logs
├── public/               # Static assets, official logos & live app previews
│   ├── preview-live.png  # Live application screenshot
│   ├── mockup.png        # Dashboard preview asset
│   └── pambantulog-*.svg # Official brand lockups & app icon
├── scripts/              # Automated test suites & DB maintenance
│   ├── test-suite.ts     # 68 test cases (restrictions, protections, batch 2)
│   └── test-middleware.ts# 10 test cases (Edge Proxy & RBAC routing)
└── src/
    ├── app/              # Next.js App Router (Pages, Layouts, API Routes)
    │   ├── (auth)/       # Authentication views (Login & Quick Access)
    │   ├── (dashboard)/  # Protected views (Admin, Agent, Employee)
    │   └── api/          # REST API endpoints (v1 routes, ping & health)
    ├── components/       # UI Component library & Layout navigation
    ├── db/               # Drizzle ORM schema & database client
    ├── hooks/            # Custom hooks (useDebounce, useTicketSearch, useRoleGuard)
    ├── lib/              # Core business logic, guards & utilities
    │   ├── validations/  # Zod schema definitions
    │   ├── auth-session.ts # HMAC SHA-256 session encoder/decoder
    │   ├── export-guard.ts # Report export rate limiter & validator
    │   ├── file-compression.ts # Canvas compression utility
    │   ├── idempotency.ts  # Submission deduplication engine
    │   ├── pagination.ts   # Hard-cap query pagination helper
    │   └── rate-limit.ts   # Dual-driver sliding window limiter
    ├── styles/           # Tailwind CSS v4 design tokens & theme inline
    ├── types/            # Shared TypeScript type definitions
    └── proxy.ts          # Next.js 16 Edge proxy & RBAC router
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
