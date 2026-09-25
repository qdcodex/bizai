import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { createTeamMemberSchema } from "@/lib/validation/auth";
import { createTeamMember } from "@/services/workspace.service";
import { apiRoute } from "@/lib/api/respond";

export async function POST(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const body = createTeamMemberSchema.parse(await request.json());
    return createTeamMember(session, body);
  }, 201);
}
