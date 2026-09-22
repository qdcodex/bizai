# AI Service Layer

This directory holds the AI architecture described in the BizAI spec, kept separate
from UI code and from direct database access. It is intentionally empty in Phase 1.

- `models/` — LLM provider/model configuration (Phase 3)
- `prompts/` — reusable system/task prompt modules (Phase 3)
- `tools/` — server-side tool implementations the LLM can call (Phase 3–4)
- `schemas/` — Zod schemas validating tool inputs/outputs (Phase 3–4)
- `services/` — orchestration between the LLM, tools, and business services (Phase 3)
- `types/` — shared AI-layer TypeScript types (Phase 3)

The LLM never talks to MongoDB directly: `tools/` call `src/services/*`, which are the
only code paths allowed to query the database, and every tool call is scoped to the
authenticated user's organization.
