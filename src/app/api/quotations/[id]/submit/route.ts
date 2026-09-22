import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { submitQuotation } from "@/services/quotation.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    return submitQuotation(session, id);
  });
}
