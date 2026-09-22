import { connectToDatabase } from "@/lib/db/connect";
import { Supplier, type SupplierDocument } from "@/models/Supplier";
import { AppError } from "@/lib/errors";
import { buildPagination, type PaginatedResult } from "@/lib/validation/pagination";
import type { SupplierCreateInput, SupplierUpdateInput, SupplierQueryInput } from "@/lib/validation/supplier";
import { escapeRegex } from "@/services/inventory.service";

export async function countActiveSuppliers(organizationId: string): Promise<number> {
  await connectToDatabase();
  return Supplier.countDocuments({ organizationId, isActive: true });
}

export async function createSupplier(
  organizationId: string,
  input: SupplierCreateInput,
): Promise<SupplierDocument> {
  await connectToDatabase();

  const existing = await Supplier.exists({ organizationId, supplierCode: input.supplierCode });
  if (existing) {
    throw new AppError(
      "DUPLICATE_SUPPLIER_CODE",
      `Supplier code "${input.supplierCode}" is already in use.`,
      409,
    );
  }

  return Supplier.create({ ...input, organizationId });
}

export async function updateSupplier(
  organizationId: string,
  supplierId: string,
  input: SupplierUpdateInput,
): Promise<SupplierDocument> {
  await connectToDatabase();

  const supplier = await Supplier.findOne({ _id: supplierId, organizationId });
  if (!supplier) {
    throw new AppError("SUPPLIER_NOT_FOUND", "Supplier not found.", 404);
  }

  if (input.supplierCode && input.supplierCode !== supplier.supplierCode) {
    const existing = await Supplier.exists({
      organizationId,
      supplierCode: input.supplierCode,
      _id: { $ne: supplier._id },
    });
    if (existing) {
      throw new AppError(
        "DUPLICATE_SUPPLIER_CODE",
        `Supplier code "${input.supplierCode}" is already in use.`,
        409,
      );
    }
  }

  Object.assign(supplier, input);
  await supplier.save();
  return supplier;
}

export async function deactivateSupplier(
  organizationId: string,
  supplierId: string,
): Promise<SupplierDocument> {
  await connectToDatabase();
  const supplier = await Supplier.findOneAndUpdate(
    { _id: supplierId, organizationId },
    { $set: { isActive: false } },
    { new: true },
  );
  if (!supplier) {
    throw new AppError("SUPPLIER_NOT_FOUND", "Supplier not found.", 404);
  }
  return supplier;
}

export async function reactivateSupplier(
  organizationId: string,
  supplierId: string,
): Promise<SupplierDocument> {
  await connectToDatabase();
  const supplier = await Supplier.findOneAndUpdate(
    { _id: supplierId, organizationId },
    { $set: { isActive: true } },
    { new: true },
  );
  if (!supplier) {
    throw new AppError("SUPPLIER_NOT_FOUND", "Supplier not found.", 404);
  }
  return supplier;
}

/** AI-ready: also backs the `getSupplier` tool in Phase 3. */
export async function getSupplier(
  organizationId: string,
  supplierId: string,
): Promise<SupplierDocument> {
  await connectToDatabase();
  const supplier = await Supplier.findOne({ _id: supplierId, organizationId });
  if (!supplier) {
    throw new AppError("SUPPLIER_NOT_FOUND", "Supplier not found.", 404);
  }
  return supplier;
}

export async function listSuppliers(
  organizationId: string,
  query: SupplierQueryInput,
): Promise<PaginatedResult<SupplierDocument>> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { organizationId };
  if (query.status !== "all") filter.isActive = query.status === "active";
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [
      { supplierCode: regex },
      { name: regex },
      { companyName: regex },
      { email: regex },
      { phone: regex },
    ];
  }

  const skip = (query.page - 1) * query.limit;
  const [data, total] = await Promise.all([
    Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(query.limit),
    Supplier.countDocuments(filter),
  ]);

  return { data, pagination: buildPagination(query.page, query.limit, total) };
}

export interface SupplierSearchResult {
  supplierId: string;
  supplierCode: string;
  name: string;
  companyName: string;
}

/** AI-ready: also backs the `searchSuppliers` tool in Phase 3. */
export async function searchSuppliers(
  organizationId: string,
  q: string,
  limit = 10,
): Promise<SupplierSearchResult[]> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { organizationId, isActive: true };
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ supplierCode: regex }, { name: regex }, { companyName: regex }, { email: regex }];
  }

  const suppliers = await Supplier.find(filter)
    .sort({ name: 1 })
    .limit(limit)
    .select("supplierCode name companyName");

  return suppliers.map((s) => ({
    supplierId: s._id.toString(),
    supplierCode: s.supplierCode,
    name: s.name,
    companyName: s.companyName,
  }));
}
