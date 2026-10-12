# 🛠️ PambantuLog

**Enterprise-Grade Internal Helpdesk & Ticketing System with Built-in Serverless Protection**

[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.4-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth%20%2F%20Postgres-3ECF8E?logo=supabase)](https://supabase.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle)](https://orm.drizzle.team/)
[![Upstash](https://img.shields.io/badge/Upstash-Redis%20Rate%20Limit-00E599?logo=redis)](https://upstash.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

[**Live Demo**](https://pambantulog.vercel.app) • [**Architecture Docs**](./docs/architecture.md) • [**Progress Report**](./docs/progress_report.md)

<br />

<p align="center">
  <img src="./public/mockup.png" alt="PambantuLog Helpdesk Dashboard Preview" width="760" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);" />
</p>

---

## 📌 Overview

**PambantuLog** is a full-stack, enterprise-ready internal helpdesk and ticketing platform built for cross-department incident tracking and technical support. Engineered on Next.js 16 (App Router) and deployed to serverless infrastructure, the application implements zero-trust security, strict serverless workload protection, dual-driver rate limiting, and client-side media optimization.

---

## ✨ Key Features

### 🛡️ Serverless Workload Protection & Restrictions
- **Client-Side Image Compression**: Lossless/adaptive HTML5 Canvas compression (max 1920px, 0.8 quality, WebP/JPEG, target size 300–600 KB) before hitting storage buckets.
- **Strict File Upload Whitelist**: Enforces MIME and extension validation (`.png`, `.jpg`, `.jpeg`, `.webp`, `.pdf`, `.log`) with a hard cap of 5 attachments per ticket. Rejects executables (`.exe`, `.bat`, `.sh`).
- **Distributed & In-Memory Rate Limiting**: Dual-driver rate limiter (Upstash Redis sliding window with memory fallback for development):
  - *Ticket Creation*: Max 5 tickets / 10 minutes per IP/User.
  - *Comments*: Max 15 comments / minute per User.
  - *Authentication*: Max 5 failed attempts / 15 minutes per identifier.
- **Idempotency Protection**: Token-based anti-double submission guard preventing duplicate ticket submissions during network lag or concurrent user clicks.
- **Strict Pagination & Query Hard-Cap**: Prevents database Denial-of-Service with a hard cap of 50 records per request (`Math.min(limit, 50)`), sanitized positive page indexing, and 350ms debounced search hooks.
- **Export Guard & Cooldown**: Protected CSV data exporter with a mandatory 30-day date range cap, 1,000 records maximum output, and a 2-minute user cooldown.

### 🔐 Security & Access Control
- **Next.js 16 Edge Proxy RBAC**: Server-side route interception protecting `/(dashboard)` segments according to user roles (`ADMIN`, `AGENT`, `EMPLOYEE`).
- **PostgreSQL Row Level Security (RLS)**: Enforced database-level isolation ensuring employees only access their own tickets while agents/admins maintain elevated visibility.
- **Type-Safe Validation Pipeline**: Strict input sanitization and schema contracts via Zod across all API endpoints and server actions.

### 🎫 Helpdesk Workflow & Analytics
- **Deterministic Ticket State Machine**: Predictable lifecycle transitions (`OPEN` → `IN_PROGRESS` → `WAITING_ON_USER` → `RESOLVED` → `CLOSED`).
- **Threaded Communication**: Centralized, audit-trailed comment threads between employees and assigned technicians.
- **CSAT Feedback System**: Automated post-resolution Customer Satisfaction scoring.
- **Executive Analytics Dashboard**: Real-time aggregation of resolution times, incident categories, and technician workloads.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16.2.6 (App Router, Turbopack) |
| **UI & Styling** | React 19, Tailwind CSS v4, Radix UI, Lucide Icons, Sonner |
| **Data & ORM** | PostgreSQL (Supabase), Drizzle ORM |
| **Authentication** | Supabase Auth (SSR Cookie-based session validation) |
| **Protection & Cache** | Upstash Redis (`@upstash/ratelimit`), In-Memory Sliding Window |
| **Schema Validation** | Zod v3 |
| **Testing** | Node.js Test Runner via TypeScript (`tsx`) — 65 automated tests |

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

# Upstash Redis (Optional - falls back to In-Memory for dev)
UPSTASH_REDIS_REST_URL=https://your-endpoint.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 🧪 Testing & Quality Assurance

```bash
# Run comprehensive test suite (Restrictions, Zod, Rate Limiting, Proxy RBAC)
npm test

# Run TypeScript type check
npm run typecheck

# Run ESLint validation
npm run lint

# Build production bundle
npm run build
```

---

## 📁 Project Structure

```text
PambantuLog/
├── .github/              # CI/CD Workflows (Supabase Keep-Alive)
├── docs/                 # System Architecture & Progress Reports
│   ├── architecture.md   # Detailed Architecture & Security Specs
│   └── progress_report.md# Milestone tracking & Test audit logs
├── public/               # Static assets & SVG icons
├── scripts/              # Automated test suites & DB migration scripts
│   ├── test-suite.ts     # 55 test cases for restrictions & security
│   └── test-middleware.ts# 10 test cases for Edge Proxy RBAC
└── src/
    ├── app/              # Next.js App Router (Pages, Layouts, API Routes)
    │   ├── (auth)/       # Authentication views (Login)
    │   ├── (dashboard)/  # Protected views (Admin, Agent, Employee)
    │   └── api/          # REST API endpoints (v1 routes & health checks)
    ├── components/       # UI Component library & Layout headers
    ├── db/               # Drizzle ORM schema & database connections
    ├── hooks/            # Custom hooks (useDebounce, useTicketSearch)
    ├── lib/              # Core business logic, guards & utilities
    │   ├── validations/  # Zod schema definitions
    │   ├── file-compression.ts # Canvas compression utility
    │   ├── rate-limit.ts # Dual-driver sliding window limiter
    │   ├── idempotency.ts# Submission deduplication engine
    │   ├── pagination.ts # Hard-cap query pagination helper
    │   └── export-guard.ts# Report export rate limiter & validator
    ├── styles/           # Tailwind CSS v4 design tokens
    ├── types/            # Shared TypeScript type definitions
    └── proxy.ts          # Next.js 16 Edge proxy & RBAC router
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
