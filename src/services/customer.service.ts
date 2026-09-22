import { connectToDatabase } from "@/lib/db/connect";
import { Customer, type CustomerDocument } from "@/models/Customer";
import { Quotation } from "@/models/Quotation";
import { AppError } from "@/lib/errors";
import { buildPagination, type PaginatedResult } from "@/lib/validation/pagination";
import type { CustomerCreateInput, CustomerUpdateInput, CustomerQueryInput } from "@/lib/validation/customer";
import { escapeRegex } from "@/services/inventory.service";

export async function countActiveCustomers(organizationId: string): Promise<number> {
  await connectToDatabase();
  return Customer.countDocuments({ organizationId, isActive: true });
}

export async function createCustomer(
  organizationId: string,
  input: CustomerCreateInput,
): Promise<CustomerDocument> {
  await connectToDatabase();

  const existing = await Customer.exists({ organizationId, customerCode: input.customerCode });
  if (existing) {
    throw new AppError(
      "DUPLICATE_CUSTOMER_CODE",
      `Customer code "${input.customerCode}" is already in use.`,
      409,
    );
  }

  return Customer.create({ ...input, organizationId });
}

export async function updateCustomer(
  organizationId: string,
  customerId: string,
  input: CustomerUpdateInput,
): Promise<CustomerDocument> {
  await connectToDatabase();

  const customer = await Customer.findOne({ _id: customerId, organizationId });
  if (!customer) {
    throw new AppError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }

  if (input.customerCode && input.customerCode !== customer.customerCode) {
    const existing = await Customer.exists({
      organizationId,
      customerCode: input.customerCode,
      _id: { $ne: customer._id },
    });
    if (existing) {
      throw new AppError(
        "DUPLICATE_CUSTOMER_CODE",
        `Customer code "${input.customerCode}" is already in use.`,
        409,
      );
    }
  }

  Object.assign(customer, input);
  await customer.save();
  return customer;
}

export async function deactivateCustomer(
  organizationId: string,
  customerId: string,
): Promise<CustomerDocument> {
  await connectToDatabase();
  const customer = await Customer.findOneAndUpdate(
    { _id: customerId, organizationId },
    { $set: { isActive: false } },
    { new: true },
  );
  if (!customer) {
    throw new AppError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }
  return customer;
}

export async function reactivateCustomer(
  organizationId: string,
  customerId: string,
): Promise<CustomerDocument> {
  await connectToDatabase();
  const customer = await Customer.findOneAndUpdate(
    { _id: customerId, organizationId },
    { $set: { isActive: true } },
    { new: true },
  );
  if (!customer) {
    throw new AppError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }
  return customer;
}

/** AI-ready: also backs the `getCustomer` tool in Phase 3. */
export async function getCustomer(
  organizationId: string,
  customerId: string,
): Promise<CustomerDocument> {
  await connectToDatabase();
  const customer = await Customer.findOne({ _id: customerId, organizationId });
  if (!customer) {
    throw new AppError("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }
  return customer;
}

export async function listCustomers(
  organizationId: string,
  query: CustomerQueryInput,
): Promise<PaginatedResult<CustomerDocument>> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { organizationId };
  if (query.status !== "all") filter.isActive = query.status === "active";
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [
      { customerCode: regex },
      { name: regex },
      { companyName: regex },
      { email: regex },
      { phone: regex },
    ];
  }

  const skip = (query.page - 1) * query.limit;
  const [data, total] = await Promise.all([
    Customer.find(filter).sort({ name: 1 }).skip(skip).limit(query.limit),
    Customer.countDocuments(filter),
  ]);

  return { data, pagination: buildPagination(query.page, query.limit, total) };
}

export interface CustomerSearchResult {
  customerId: string;
  customerCode: string;
  name: string;
  companyName: string;
}

/** AI-ready: also backs the `searchCustomers` tool in Phase 3, and the quotation customer selector today. */
export async function searchCustomers(
  organizationId: string,
  q: string,
  limit = 10,
): Promise<CustomerSearchResult[]> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { organizationId, isActive: true };
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ customerCode: regex }, { name: regex }, { companyName: regex }, { email: regex }];
  }

  const customers = await Customer.find(filter)
    .sort({ name: 1 })
    .limit(limit)
    .select("customerCode name companyName");

  return customers.map((c) => ({
    customerId: c._id.toString(),
    customerCode: c.customerCode,
    name: c.name,
    companyName: c.companyName,
  }));
}

export interface CustomerPurchaseHistoryRow {
  quotationId: string;
  quotationNumber: string;
  status: string;
  total: number;
  createdAt: string;
}

/** AI-ready: also backs the `getCustomerPurchaseHistory` tool in Phase 3. Sourced from quotations until Invoices ship. */
export async function getCustomerPurchaseHistory(
  organizationId: string,
  customerId: string,
  limit = 20,
): Promise<CustomerPurchaseHistoryRow[]> {
  await connectToDatabase();

  const quotations = await Quotation.find({ organizationId, customerId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("quotationNumber status total createdAt");

  return quotations.map((q) => ({
    quotationId: q._id.toString(),
    quotationNumber: q.quotationNumber,
    status: q.status,
    total: q.total,
    createdAt: q.createdAt.toISOString(),
  }));
}
