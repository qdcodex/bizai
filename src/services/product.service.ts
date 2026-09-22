import { Types, type PipelineStage } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product, type ProductDocument } from "@/models/Product";
import { AppError } from "@/lib/errors";
import { buildPagination, type PaginatedResult } from "@/lib/validation/pagination";
import type { ProductCreateInput, ProductUpdateInput, ProductQueryInput } from "@/lib/validation/product";
import { ensureInventoryItem, stockJoinStages, escapeRegex, type StockStatus } from "@/services/inventory.service";

function assertPriceRule(sellingPrice: number, minSellingPrice: number) {
  if (sellingPrice < minSellingPrice) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Selling price cannot be lower than the minimum selling price.",
      400,
    );
  }
}

export async function createProduct(
  organizationId: string,
  input: ProductCreateInput,
): Promise<ProductDocument> {
  await connectToDatabase();
  assertPriceRule(input.sellingPrice, input.minSellingPrice);

  const existing = await Product.exists({ organizationId, itemCode: input.itemCode });
  if (existing) {
    throw new AppError("DUPLICATE_ITEM_CODE", `Item code "${input.itemCode}" is already in use.`, 409);
  }

  const product = await Product.create({ ...input, organizationId });
  await ensureInventoryItem(organizationId, product._id.toString());
  return product;
}

export async function updateProduct(
  organizationId: string,
  productId: string,
  input: ProductUpdateInput,
): Promise<ProductDocument> {
  await connectToDatabase();

  const product = await Product.findOne({ _id: productId, organizationId });
  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND", "Product not found.", 404);
  }

  if (input.itemCode && input.itemCode !== product.itemCode) {
    const existing = await Product.exists({
      organizationId,
      itemCode: input.itemCode,
      _id: { $ne: product._id },
    });
    if (existing) {
      throw new AppError("DUPLICATE_ITEM_CODE", `Item code "${input.itemCode}" is already in use.`, 409);
    }
  }

  const nextSellingPrice = input.sellingPrice ?? product.sellingPrice;
  const nextMinSellingPrice = input.minSellingPrice ?? product.minSellingPrice;
  assertPriceRule(nextSellingPrice, nextMinSellingPrice);

  Object.assign(product, input);
  await product.save();
  return product;
}

export async function deactivateProduct(
  organizationId: string,
  productId: string,
): Promise<ProductDocument> {
  await connectToDatabase();
  const product = await Product.findOneAndUpdate(
    { _id: productId, organizationId },
    { $set: { isActive: false } },
    { new: true },
  );
  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND", "Product not found.", 404);
  }
  return product;
}

export async function reactivateProduct(
  organizationId: string,
  productId: string,
): Promise<ProductDocument> {
  await connectToDatabase();
  const product = await Product.findOneAndUpdate(
    { _id: productId, organizationId },
    { $set: { isActive: true } },
    { new: true },
  );
  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND", "Product not found.", 404);
  }
  return product;
}

/** AI-ready: also backs the `getProduct` tool in Phase 3. */
export async function getProduct(
  organizationId: string,
  productId: string,
): Promise<ProductDocument> {
  await connectToDatabase();
  const product = await Product.findOne({ _id: productId, organizationId });
  if (!product) {
    throw new AppError("PRODUCT_NOT_FOUND", "Product not found.", 404);
  }
  return product;
}

export interface ProductListRow {
  productId: string;
  itemCode: string;
  itemName: string;
  category: string;
  partNumber: string;
  uom: string;
  costPrice: number;
  sellingPrice: number;
  minSellingPrice: number;
  isActive: boolean;
  currentStock: number;
  stockStatus: StockStatus;
}

export async function listProducts(
  organizationId: string,
  query: ProductQueryInput,
): Promise<PaginatedResult<ProductListRow>> {
  await connectToDatabase();

  const match: Record<string, unknown> = { organizationId: new Types.ObjectId(organizationId) };
  if (query.status !== "all") match.isActive = query.status === "active";
  if (query.category) match.category = query.category;
  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search), "i");
    match.$or = [{ itemName: regex }, { itemCode: regex }, { partNumber: regex }, { category: regex }];
  }

  const skip = (query.page - 1) * query.limit;
  const sortField = query.sortBy;
  const sortDirection = query.sortOrder === "asc" ? 1 : -1;

  const pipeline: PipelineStage[] = [
    { $match: match },
    ...stockJoinStages(),
    ...(query.stockStatus !== "all"
      ? [{ $match: { stockStatus: query.stockStatus } } as PipelineStage]
      : []),
    {
      $facet: {
        data: [
          { $sort: { [sortField]: sortDirection } },
          { $skip: skip },
          { $limit: query.limit },
          {
            $project: {
              itemCode: 1,
              itemName: 1,
              category: 1,
              partNumber: 1,
              uom: 1,
              costPrice: 1,
              sellingPrice: 1,
              minSellingPrice: 1,
              isActive: 1,
              currentStock: 1,
              stockStatus: 1,
            },
          },
        ],
        totalCount: [{ $count: "total" }],
      },
    },
  ];

  const [result] = await Product.aggregate(pipeline);
  const rows = (result?.data ?? []) as Array<Record<string, unknown>>;
  const total = result?.totalCount?.[0]?.total ?? 0;

  const data: ProductListRow[] = rows.map((row) => ({
    productId: String(row._id),
    itemCode: row.itemCode as string,
    itemName: row.itemName as string,
    category: row.category as string,
    partNumber: row.partNumber as string,
    uom: row.uom as string,
    costPrice: row.costPrice as number,
    sellingPrice: row.sellingPrice as number,
    minSellingPrice: row.minSellingPrice as number,
    isActive: row.isActive as boolean,
    currentStock: row.currentStock as number,
    stockStatus: row.stockStatus as StockStatus,
  }));

  return { data, pagination: buildPagination(query.page, query.limit, total) };
}

export interface ProductSearchResult {
  productId: string;
  itemCode: string;
  itemName: string;
  uom: string;
  sellingPrice: number;
  minSellingPrice: number;
  currentStock: number;
}

/** AI-ready: also backs the `searchProducts` tool in Phase 3, and the quotation product selector today. */
export async function searchProducts(
  organizationId: string,
  q: string,
  limit = 10,
): Promise<ProductSearchResult[]> {
  await connectToDatabase();

  const match: Record<string, unknown> = {
    organizationId: new Types.ObjectId(organizationId),
    isActive: true,
  };
  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    match.$or = [{ itemName: regex }, { itemCode: regex }, { partNumber: regex }];
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    ...stockJoinStages(),
    { $sort: { itemName: 1 } },
    { $limit: limit },
    {
      $project: {
        itemCode: 1,
        itemName: 1,
        uom: 1,
        sellingPrice: 1,
        minSellingPrice: 1,
        currentStock: 1,
      },
    },
  ];

  const rows = await Product.aggregate(pipeline);
  return rows.map((row) => ({
    productId: String(row._id),
    itemCode: row.itemCode,
    itemName: row.itemName,
    uom: row.uom,
    sellingPrice: row.sellingPrice,
    minSellingPrice: row.minSellingPrice,
    currentStock: row.currentStock,
  }));
}

export async function listCategories(organizationId: string): Promise<string[]> {
  await connectToDatabase();
  const categories = await Product.distinct("category", {
    organizationId,
    category: { $ne: "" },
  });
  return (categories as string[]).sort((a, b) => a.localeCompare(b));
}
