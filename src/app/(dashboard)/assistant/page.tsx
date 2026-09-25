import { requireSession } from "@/lib/auth/guards";
import { AssistantShell } from "@/components/assistant/assistant-shell";

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  await requireSession();
  const { q } = await searchParams;
  const initialInput = typeof q === "string" ? q.slice(0, 500) : "";
  return <AssistantShell key={initialInput} conversationId={null} initialMessages={[]} initialInput={initialInput} />;
}
