import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Quotation, type QuotationDocument, type QuotationItem, type QuotationStatus } from "@/models/Quotation";
import { Customer } from "@/models/Customer";
import { Product } from "@/models/Product";
import { Organization } from "@/models/Organization";
import { nextSequence } from "@/models/Counter";
import { AppError } from "@/lib/errors";
import { can, type Permission } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";
import { buildPagination, type PaginatedResult } from "@/lib/validation/pagination";
import {
  quotationCreateSchema,
  quotationUpdateSchema,
  type QuotationCreateInput,
  type QuotationUpdateInput,
  type QuotationQueryInput,
} from "@/lib/validation/quotation";
import type { z } from "zod";
import { computeQuotationTotals, assertMinSellingPrice, requiresApproval } from "@/services/quotation-calculations";
import { recordStockMovement } from "@/services/stock-movement.service";
import { escapeRegex } from "@/services/inventory.service";

async function generateQuotationNumber(organizationId: string): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`${organizationId}:quotation:${year}`);
  return `QT-${year}-${String(seq).padStart(6, "0")}`;
}

function requirePermissionOrThrow(session: SessionPayload, permission: Permission): void {
  if (!can(session.role, permission)) {
    throw new AppError("FORBIDDEN", "You do not have permission to perform this action.", 403);
  }
}

async function resolveQuotationItems(
  organizationId: string,
  rawItems: QuotationCreateInput["items"],
  overrideRequested: boolean,
  overrideAuthorized: boolean,
): Promise<QuotationItem[]> {
  const items: QuotationItem[] = [];

  for (const raw of rawItems) {
    const product = await Product.findOne({ _id: raw.productId, organizationId, isActive: true });
    if (!product) {
      throw new AppError("PRODUCT_NOT_FOUND", "One of the selected products was not found.", 404);
    }

    const unitPrice = raw.unitPrice ?? product.sellingPrice;
    assertMinSellingPrice({
      itemName: product.itemName,
      unitPrice,
      minSellingPrice: product.minSellingPrice,
      overrideRequested,
      overrideAuthorized,
    });

    const discount = raw.discount ?? 0;
    const tax = raw.tax ?? 0;
    const lineTotal = Math.max(0, raw.quantity * unitPrice - discount + tax);

    items.push({
      productId: product._id,
      itemCode: product.itemCode,
      itemName: product.itemName,
      quantity: raw.quantity,
      uom: product.uom,
      unitPrice,
      discount,
      tax,
      lineTotal: Math.round((lineTotal + Number.EPSILON) * 100) / 100,
    });
  }

  return items;
}

async function assertCustomerExists(organizationId: string, customerId: string): Promise<void> {
  const exists = await Customer.exists({ _id: customerId, organizationId });
  if (!exists) {
    throw new AppError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }
}

export async function createQuotation(
  session: SessionPayload,
  rawInput: z.input<typeof quotationCreateSchema>,
): Promise<QuotationDocument> {
  requirePermissionOrThrow(session, "quotations.create");
  await connectToDatabase();

  const input: QuotationCreateInput = quotationCreateSchema.parse(rawInput);
  await assertCustomerExists(session.organizationId, input.customerId);

  const overrideAuthorized = can(session.role, "quotations.approve");
  const items = await resolveQuotationItems(
    session.organizationId,
    input.items,
    input.overrideMinPrice,
    overrideAuthorized,
  );

  const totals = computeQuotationTotals(
    items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, tax: i.tax })),
  );

  const quotationNumber = await generateQuotationNumber(session.organizationId);

  const quotation = await Quotation.create({
    organizationId: session.organizationId,
    quotationNumber,
    customerId: input.customerId,
    items,
    ...totals,
    status: "DRAFT",
    validUntil: input.validUntil ?? null,
    notes: input.notes,
    createdBy: session.userId,
    approvedBy: null,
  });

  return quotation;
}

export interface QuotationPreviewItem {
  productId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  minSellingPrice: number;
  belowMinPrice: boolean;
  discount: number;
  tax: number;
  lineTotal: number;
}

export interface QuotationPreview {
  customer: { id: string; name: string; customerCode: string };
  items: QuotationPreviewItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  requiresApproval: boolean;
  approvalThreshold: number;
  hasItemsBelowMinPrice: boolean;
  canOverrideMinPrice: boolean;
}

/**
 * Computes a full quotation preview — same pricing/total logic as
 * createQuotation — WITHOUT persisting anything. Used by the AI assistant
 * (and could be reused by a "preview" UI step) to show the user exactly what
 * would be created before they confirm the write action.
 */
export async function previewQuotation(
  session: SessionPayload,
  rawInput: z.input<typeof quotationCreateSchema>,
): Promise<QuotationPreview> {
  await connectToDatabase();

  const input: QuotationCreateInput = quotationCreateSchema.parse(rawInput);

  const customer = await Customer.findOne({ _id: input.customerId, organizationId: session.organizationId });
  if (!customer) {
    throw new AppError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }

  const items: QuotationPreviewItem[] = [];
  for (const raw of input.items) {
    const product = await Product.findOne({
      _id: raw.productId,
      organizationId: session.organizationId,
      isActive: true,
    });
    if (!product) {
      throw new AppError("PRODUCT_NOT_FOUND", "One of the selected products was not found.", 404);
    }

    const unitPrice = raw.unitPrice ?? product.sellingPrice;
    const discount = raw.discount ?? 0;
    const tax = raw.tax ?? 0;
    const lineTotal = Math.max(0, raw.quantity * unitPrice - discount + tax);

    items.push({
      productId: product._id.toString(),
      itemCode: product.itemCode,
      itemName: product.itemName,
      quantity: raw.quantity,
      uom: product.uom,
      unitPrice,
      minSellingPrice: product.minSellingPrice,
      belowMinPrice: unitPrice < product.minSellingPrice,
      discount,
      tax,
      lineTotal: Math.round((lineTotal + Number.EPSILON) * 100) / 100,
    });
  }

  const totals = computeQuotationTotals(items);
  const organization = await Organization.findById(session.organizationId);
  const approvalThreshold = organization?.settings.quotationApprovalThreshold ?? 1000;

  return {
    customer: { id: customer._id.toString(), name: customer.name, customerCode: customer.customerCode },
    items,
    ...totals,
    requiresApproval: requiresApproval(totals.total, approvalThreshold),
    approvalThreshold,
    hasItemsBelowMinPrice: items.some((i) => i.belowMinPrice),
    canOverrideMinPrice: can(session.role, "quotations.approve"),
  };
}

export async function updateQuotation(
  session: SessionPayload,
  quotationId: string,
  rawInput: z.input<typeof quotationUpdateSchema>,
): Promise<QuotationDocument> {
  requirePermissionOrThrow(session, "quotations.update");
  await connectToDatabase();

  const input: QuotationUpdateInput = quotationUpdateSchema.parse(rawInput);
  const quotation = await Quotation.findOne({ _id: quotationId, organizationId: session.organizationId });
  if (!quotation) {
    throw new AppError("QUOTATION_NOT_FOUND", "Quotation not found.", 404);
  }
  if (quotation.status !== "DRAFT") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      "Only draft quotations can be edited.",
      409,
    );
  }

  if (input.customerId) {
    await assertCustomerExists(session.organizationId, input.customerId);
    quotation.customerId = new Types.ObjectId(input.customerId);
  }

  if (input.items) {
    const overrideAuthorized = can(session.role, "quotations.approve");
    const items = await resolveQuotationItems(
      session.organizationId,
      input.items,
      input.overrideMinPrice ?? false,
      overrideAuthorized,
    );
    const totals = computeQuotationTotals(
      items.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice, discount: i.discount, tax: i.tax })),
    );
    quotation.items = items;
    quotation.subtotal = totals.subtotal;
    quotation.discount = totals.discount;
    quotation.tax = totals.tax;
    quotation.total = totals.total;
  }

  if (input.validUntil !== undefined) quotation.validUntil = input.validUntil;
  if (input.notes !== undefined) quotation.notes = input.notes;

  await quotation.save();
  return quotation;
}

export async function deleteQuotation(
  session: SessionPayload,
  quotationId: string,
): Promise<{ deleted: true }> {
  requirePermissionOrThrow(session, "quotations.delete");
  await connectToDatabase();

  const quotation = await Quotation.findOne({ _id: quotationId, organizationId: session.organizationId });
  if (!quotation) {
    throw new AppError("QUOTATION_NOT_FOUND", "Quotation not found.", 404);
  }
  if (quotation.status !== "DRAFT") {
    throw new AppError("INVALID_STATUS_TRANSITION", "Only draft quotations can be deleted.", 409);
  }

  await quotation.deleteOne();
  return { deleted: true };
}

/** Moves a DRAFT to PENDING_APPROVAL (over the org's threshold) or straight to APPROVED. */
export async function submitQuotation(
  session: SessionPayload,
  quotationId: string,
): Promise<QuotationDocument> {
  requirePermissionOrThrow(session, "quotations.update");
  await connectToDatabase();

  const quotation = await Quotation.findOne({ _id: quotationId, organizationId: session.organizationId });
  if (!quotation) {
    throw new AppError("QUOTATION_NOT_FOUND", "Quotation not found.", 404);
  }
  if (quotation.status !== "DRAFT") {
    throw new AppError("INVALID_STATUS_TRANSITION", "Only draft quotations can be submitted.", 409);
  }

  const organization = await Organization.findById(session.organizationId);
  const threshold = organization?.settings.quotationApprovalThreshold ?? 1000;

  quotation.status = requiresApproval(quotation.total, threshold) ? "PENDING_APPROVAL" : "APPROVED";
  await quotation.save();
  return quotation;
}

export async function approveQuotation(
  session: SessionPayload,
  quotationId: string,
): Promise<QuotationDocument> {
  requirePermissionOrThrow(session, "quotations.approve");
  await connectToDatabase();

  const quotation = await Quotation.findOne({ _id: quotationId, organizationId: session.organizationId });
  if (!quotation) {
    throw new AppError("QUOTATION_NOT_FOUND", "Quotation not found.", 404);
  }
  if (quotation.status !== "PENDING_APPROVAL") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      "Only quotations pending approval can be approved.",
      409,
    );
  }

  quotation.status = "APPROVED";
  quotation.approvedBy = new Types.ObjectId(session.userId);
  await quotation.save();
  return quotation;
}

export async function rejectQuotation(
  session: SessionPayload,
  quotationId: string,
  reason: string,
): Promise<QuotationDocument> {
  requirePermissionOrThrow(session, "quotations.approve");
  await connectToDatabase();

  const quotation = await Quotation.findOne({ _id: quotationId, organizationId: session.organizationId });
  if (!quotation) {
    throw new AppError("QUOTATION_NOT_FOUND", "Quotation not found.", 404);
  }
  if (quotation.status !== "PENDING_APPROVAL") {
    throw new AppError(
      "INVALID_STATUS_TRANSITION",
      "Only quotations pending approval can be rejected.",
      409,
    );
  }

  quotation.status = "REJECTED";
  quotation.approvedBy = new Types.ObjectId(session.userId);
  if (reason) quotation.notes = quotation.notes ? `${quotation.notes}\n\nRejected: ${reason}` : `Rejected: ${reason}`;
  await quotation.save();
  return quotation;
}

/** Converts an APPROVED quotation to CONVERTED, deducting stock for every line atomically. */
export async function convertQuotation(
  session: SessionPayload,
  quotationId: string,
): Promise<QuotationDocument> {
  requirePermissionOrThrow(session, "quotations.update");
  await connectToDatabase();

  const quotation = await Quotation.findOne({ _id: quotationId, organizationId: session.organizationId });
  if (!quotation) {
    throw new AppError("QUOTATION_NOT_FOUND", "Quotation not found.", 404);
  }
  if (quotation.status !== "APPROVED") {
    throw new AppError("INVALID_STATUS_TRANSITION", "Only approved quotations can be converted.", 409);
  }

  const dbSession = await mongoose.startSession();
  try {
    await dbSession.withTransaction(async () => {
      for (const item of quotation.items) {
        await recordStockMovement({
          organizationId: session.organizationId,
          productId: item.productId.toString(),
          type: "SALE",
          quantity: item.quantity,
          referenceType: "QUOTATION",
          referenceId: quotation._id.toString(),
          notes: `Converted from ${quotation.quotationNumber}`,
          createdBy: session.userId,
        });
      }
      quotation.status = "CONVERTED";
      await quotation.save({ session: dbSession });
    });
  } finally {
    await dbSession.endSession();
  }

  return quotation;
}

export interface QuotationDetail {
  id: string;
  quotationNumber: string;
  customer:
    | {
        id: string;
        name: string;
        customerCode: string;
        companyName: string;
        email: string;
        phone: string;
        address: string;
        city: string;
        state: string;
        country: string;
        postalCode: string;
      }
    | null;
  items: QuotationItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: QuotationStatus;
  validUntil: string | null;
  notes: string;
  createdBy: { id: string; name: string } | null;
  approvedBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

/** AI-ready: also backs the `getQuotation` tool in Phase 3. */
export async function getQuotation(
  organizationId: string,
  quotationId: string,
): Promise<QuotationDetail> {
  await connectToDatabase();

  const quotation = await Quotation.findOne({ _id: quotationId, organizationId })
    .populate<{
      customerId: {
        _id: Types.ObjectId;
        name: string;
        customerCode: string;
        companyName: string;
        email: string;
        phone: string;
        address: string;
        city: string;
        state: string;
        country: string;
        postalCode: string;
      } | null;
    }>("customerId", "name customerCode companyName email phone address city state country postalCode")
    .populate<{ createdBy: { _id: Types.ObjectId; name: string } | null }>("createdBy", "name")
    .populate<{ approvedBy: { _id: Types.ObjectId; name: string } | null }>("approvedBy", "name");

  if (!quotation) {
    throw new AppError("QUOTATION_NOT_FOUND", "Quotation not found.", 404);
  }

  const customer = quotation.customerId;
  const createdBy = quotation.createdBy;
  const approvedBy = quotation.approvedBy;

  return {
    id: quotation._id.toString(),
    quotationNumber: quotation.quotationNumber,
    customer: customer
      ? {
          id: customer._id.toString(),
          name: customer.name,
          customerCode: customer.customerCode,
          companyName: customer.companyName,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          city: customer.city,
          state: customer.state,
          country: customer.country,
          postalCode: customer.postalCode,
        }
      : null,
    items: quotation.items,
    subtotal: quotation.subtotal,
    discount: quotation.discount,
    tax: quotation.tax,
    total: quotation.total,
    status: quotation.status,
    validUntil: quotation.validUntil ? quotation.validUntil.toISOString() : null,
    notes: quotation.notes,
    createdBy: createdBy ? { id: createdBy._id.toString(), name: createdBy.name } : null,
    approvedBy: approvedBy ? { id: approvedBy._id.toString(), name: approvedBy.name } : null,
    createdAt: quotation.createdAt.toISOString(),
    updatedAt: quotation.updatedAt.toISOString(),
  };
}

export interface QuotationListRow {
  quotationId: string;
  quotationNumber: string;
  customerName: string;
  status: QuotationStatus;
  total: number;
  validUntil: string | null;
  createdAt: string;
}

export async function listQuotations(
  organizationId: string,
  query: QuotationQueryInput,
): Promise<PaginatedResult<QuotationListRow>> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { organizationId };
  if (query.status) filter.status = query.status;
  if (query.customerId) filter.customerId = query.customerId;
  if (query.search) {
    filter.quotationNumber = new RegExp(escapeRegex(query.search), "i");
  }
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: query.from } : {}),
      ...(query.to ? { $lte: query.to } : {}),
    };
  }

  const skip = (query.page - 1) * query.limit;
  const [quotations, total] = await Promise.all([
    Quotation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .populate<{ customerId: { name: string } | null }>("customerId", "name"),
    Quotation.countDocuments(filter),
  ]);

  const data: QuotationListRow[] = quotations.map((q) => ({
    quotationId: q._id.toString(),
    quotationNumber: q.quotationNumber,
    customerName: (q.customerId as unknown as { name: string } | null)?.name ?? "Unknown customer",
    status: q.status,
    total: q.total,
    validUntil: q.validUntil ? q.validUntil.toISOString() : null,
    createdAt: q.createdAt.toISOString(),
  }));

  return { data, pagination: buildPagination(query.page, query.limit, total) };
}

export interface SearchQuotationsOptions {
  q?: string;
  status?: QuotationStatus;
  customerId?: string;
  limit?: number;
}

/** AI-ready: also backs the `searchQuotations` tool in Phase 3. */
export async function searchQuotations(
  organizationId: string,
  options: SearchQuotationsOptions = {},
): Promise<QuotationListRow[]> {
  await connectToDatabase();

  const { q, status, customerId, limit = 10 } = options;
  const filter: Record<string, unknown> = { organizationId };
  if (q) filter.quotationNumber = new RegExp(escapeRegex(q), "i");
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;

  const quotations = await Quotation.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate<{ customerId: { name: string } | null }>("customerId", "name");

  return quotations.map((q2) => ({
    quotationId: q2._id.toString(),
    quotationNumber: q2.quotationNumber,
    customerName: (q2.customerId as unknown as { name: string } | null)?.name ?? "Unknown customer",
    status: q2.status,
    total: q2.total,
    validUntil: q2.validUntil ? q2.validUntil.toISOString() : null,
    createdAt: q2.createdAt.toISOString(),
  }));
}

export interface QuotationDashboardSummary {
  pendingApprovalCount: number;
  approvedCount: number;
  monthlySales: number;
}

/** Backs the dashboard's quotation cards with real, organization-scoped data. */
export async function getQuotationDashboardSummary(
  organizationId: string,
): Promise<QuotationDashboardSummary> {
  await connectToDatabase();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [pendingApprovalCount, approvedCount, monthlySalesResult] = await Promise.all([
    Quotation.countDocuments({ organizationId, status: "PENDING_APPROVAL" }),
    Quotation.countDocuments({ organizationId, status: "APPROVED" }),
    Quotation.aggregate([
      {
        $match: {
          organizationId: new Types.ObjectId(organizationId),
          status: "CONVERTED",
          updatedAt: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);

  return {
    pendingApprovalCount,
    approvedCount,
    monthlySales: monthlySalesResult[0]?.total ?? 0,
  };
}
