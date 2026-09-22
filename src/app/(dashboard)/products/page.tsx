import Link from "next/link";
import { Plus, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money";
import { EmptyState } from "@/components/empty-state";
import { ProductRowActions } from "@/components/products/product-row-actions";
import { requirePagePermission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { productQuerySchema } from "@/lib/validation/product";
import { flattenSearchParams } from "@/lib/validation/pagination";
import { listProducts, listCategories } from "@/services/product.service";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission("products.read");
  const rawParams = flattenSearchParams(await searchParams);
  const query = productQuerySchema.parse(rawParams);

  const [{ data: products, pagination }, categories] = await Promise.all([
    listProducts(session.organizationId, query),
    listCategories(session.organizationId),
  ]);

  const canManage = can(session.role, "products.create");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage your product catalog and pricing.</p>
        </div>
        {canManage && (
          <Button render={<Link href="/products/new" />}>
            <Plus />
            Add Product
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Search by name, code, part number..." />
        <FilterSelect
          paramName="category"
          placeholder="Category"
          defaultValue="all"
          options={[{ label: "All Categories", value: "all" }, ...categories.map((c) => ({ label: c, value: c }))]}
        />
        <FilterSelect
          paramName="stockStatus"
          placeholder="Stock Status"
          options={[
            { label: "All Stock", value: "all" },
            { label: "In Stock", value: "IN_STOCK" },
            { label: "Low Stock", value: "LOW_STOCK" },
            { label: "Out of Stock", value: "OUT_OF_STOCK" },
          ]}
        />
        <FilterSelect
          paramName="status"
          placeholder="Status"
          defaultValue="active"
          options={[
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
            { label: "All", value: "all" },
          ]}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {products.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No products found"
              description="Try adjusting your filters, or add your first product to get started."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Part Number</TableHead>
                    <TableHead>UOM</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.productId}>
                      <TableCell className="font-mono text-xs">{product.itemCode}</TableCell>
                      <TableCell className="font-medium">{product.itemName}</TableCell>
                      <TableCell className="text-muted-foreground">{product.category || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{product.partNumber || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{product.uom}</TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay value={product.costPrice} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay value={product.sellingPrice} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={product.isActive ? "ACTIVE" : "INACTIVE"} />
                        <StatusBadge status={product.stockStatus} className="ml-1" />
                      </TableCell>
                      <TableCell>
                        <ProductRowActions
                          productId={product.productId}
                          itemName={product.itemName}
                          isActive={product.isActive}
                          canManage={canManage}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar pagination={pagination} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
