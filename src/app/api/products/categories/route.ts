import { requireApiSession } from "@/lib/auth/guards";
import { requirePermission } from "@/lib/auth/permissions";
import { listCategories } from "@/services/product.service";
import { apiRoute } from "@/lib/api/respond";

export async function GET() {
  return apiRoute(async () => {
    const session = await requireApiSession();
    requirePermission(session, "products.read");
    return listCategories(session.organizationId);
  });
}
