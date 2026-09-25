import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { moduleVisibilitySchema } from "@/lib/validation/organization";
import { updateModuleVisibility } from "@/services/workspace.service";
import { apiRoute } from "@/lib/api/respond";

export async function PUT(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const body = moduleVisibilitySchema.parse(await request.json());
    return updateModuleVisibility(session, body);
  });
}
