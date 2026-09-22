import { requireSession } from "@/lib/auth/guards";
import { AssistantShell } from "@/components/assistant/assistant-shell";

export default async function AssistantPage() {
  await requireSession();
  return <AssistantShell conversationId={null} initialMessages={[]} />;
}
