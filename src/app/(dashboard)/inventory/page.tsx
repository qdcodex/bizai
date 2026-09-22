import Link from "next/link";
import { Boxes, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/shared/search-input";
import { FilterSelect } from "@/components/shared/filter-select";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money";
import { EmptyState } from "@/components/empty-state";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { inventoryQuerySchema } from "@/lib/validation/inventory";
import { flattenSearchParams } from "@/lib/validation/pagination";
import { listInventory } from "@/services/inventory.service";
import { listCategories } from "@/services/product.service";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission("inventory.read");
  const rawParams = flattenSearchParams(await searchParams);
  const query = inventoryQuerySchema.parse(rawParams);

  const [{ data: rows, pagination }, categories] = await Promise.all([
    listInventory(session.organizationId, query),
    listCategories(session.organizationId),
  ]);

  const canAdjust = can(session.role, "inventory.adjust");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Track stock levels across your catalog.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/inventory/movements" />}>
            <History />
            Movement History
          </Button>
          {canAdjust && <StockAdjustmentDialog />}
        </div>
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
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="No inventory to show"
              description="Products you add will appear here with their current stock levels."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Minimum Stock</TableHead>
                    <TableHead>Available Status</TableHead>
                    <TableHead className="text-right">Cost Price</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead>Last Movement</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell>
                        <div className="font-medium">{row.itemName}</div>
                        <div className="font-mono text-xs text-muted-foreground">{row.itemCode}</div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{row.currentStock}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {row.lowStockThreshold}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.stockStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay value={row.costPrice} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyDisplay value={row.sellingPrice} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.lastMovementAt ? new Date(row.lastMovementAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" render={<Link href={`/inventory/${row.productId}`} />}>
                            View
                          </Button>
                          {canAdjust && (
                            <StockAdjustmentDialog
                              fixedProduct={{ productId: row.productId, itemName: row.itemName }}
                              trigger={
                                <Button variant="ghost" size="sm">
                                  Adjust
                                </Button>
                              }
                            />
                          )}
                        </div>
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
