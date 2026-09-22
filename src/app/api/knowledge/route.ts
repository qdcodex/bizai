import { NextRequest, after } from "next/server";
import { requireApiSession } from "@/lib/auth/guards";
import { documentQuerySchema } from "@/lib/validation/document";
import { listDocuments, uploadDocument, processDocument } from "@/services/document.service";
import { apiRoute, searchParamsToObject } from "@/lib/api/respond";
import { AppError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();
    const query = documentQuerySchema.parse(searchParamsToObject(request.nextUrl.searchParams));
    return listDocuments(session, query);
  });
}

export async function POST(request: NextRequest) {
  return apiRoute(async () => {
    const session = await requireApiSession();

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "A file is required.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const summary = await uploadDocument(session, {
      fileName: file.name,
      mimeType: file.type,
      buffer,
    });

    // Process after the response is sent — keeps the upload request fast
    // while the extraction/chunking/embedding pipeline runs in the
    // background. Kept as a standalone function (document.service.ts) so it
    // can move to a real background worker later without touching this route.
    after(() => processDocument(summary.id));

    return summary;
  }, 201);
}
