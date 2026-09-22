import { NextRequest } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { quotationRejectSchema } from "@/lib/validation/quotation";
import { rejectQuotation } from "@/services/quotation.service";
import { apiRoute } from "@/lib/api/respond";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const { id } = await params;
    const body = quotationRejectSchema.parse(await request.json().catch(() => ({})));
    return rejectQuotation(session, id, body.reason);
  });
}
