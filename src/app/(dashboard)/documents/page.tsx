import { redirect } from "next/navigation";

/** Business documents live in the Knowledge Base (Phase 4) — no separate document library. */
export default function DocumentsPage() {
  redirect("/knowledge");
}
