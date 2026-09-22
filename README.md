# BizAI — AI Business & Inventory Assistant

An AI-powered business assistant that lets business users query and act on their
inventory, customers, suppliers, quotations, invoices, and documents in natural
language. Built as a multi-tenant SaaS with Next.js, MongoDB, and the Vercel AI SDK.

This is **Phase 1**: project setup, authentication, organizations, roles, and the
dashboard shell. Business modules (inventory, customers, quotations, ...) and the AI
Assistant are placeholders until later phases — see `src/ai/README.md` and the phase
plan in the project brief.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · MongoDB + Mongoose ·
Zustand · Vercel AI SDK · Google Gemini · Zod

## Getting started

1. Copy `.env.example` to `.env.local` and fill in the values:
   - `MONGODB_URI` — a MongoDB connection string (Atlas or local, e.g.
     `mongodb://localhost:27017/ai`)
   - `AUTH_SECRET` — a random secret used to sign session cookies, e.g.
     `openssl rand -base64 32`
   - `GEMINI_API_KEY` — required for the AI Assistant (get one at https://aistudio.google.com/apikey)
2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000). You'll be redirected to
   `/register` to create the first organization and owner account.

## Scripts

```bash
npm run dev     # start the dev server
npm run build   # production build (also runs the TypeScript check)
npm run start   # run the production build
npm run lint    # ESLint
```

## Architecture

```
src/
├── ai/            # LLM/tool/prompt layer — isolated from UI and DB access (Phase 3+)
├── app/           # Next.js App Router routes
│   ├── (auth)/    # /login, /register
│   ├── (dashboard)/ # authenticated app shell + all business modules
│   └── api/       # route handlers (auth today; business APIs from Phase 2)
├── components/    # UI components (shadcn/ui primitives in components/ui)
├── lib/           # auth, db connection, env validation, error types, nav config
├── models/        # Mongoose schemas (User, Organization, Membership)
└── services/      # business logic used by route handlers and server components
```

Every business record is scoped to an `organizationId` resolved from the
authenticated session — never trusted from client input. Roles (`owner`, `admin`,
`manager`, `staff`, `viewer`) are enforced server-side via `requireRole()`.

## Deploy on Vercel

The easiest way to deploy is via the [Vercel Platform](https://vercel.com/new). Set
the same environment variables as `.env.example` in your Vercel project settings.
