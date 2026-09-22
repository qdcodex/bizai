import Link from "next/link";
import { ArrowLeft, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterSelect } from "@/components/shared/filter-select";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { EmptyState } from "@/components/empty-state";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { stockMovementQuerySchema } from "@/lib/validation/inventory";
import { flattenSearchParams } from "@/lib/validation/pagination";
import { listStockMovements } from "@/services/stock-movement.service";
import { STOCK_MOVEMENT_TYPES } from "@/models/StockMovement";

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePagePermission("inventory.read");
  const rawParams = flattenSearchParams(await searchParams);
  const query = stockMovementQuerySchema.parse(rawParams);

  const { data: movements, pagination } = await listStockMovements(session.organizationId, query);
  const canAdjust = can(session.role, "inventory.adjust");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" render={<Link href="/inventory" />}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Stock Movements</h1>
            <p className="text-sm text-muted-foreground">Full audit trail of every stock change.</p>
          </div>
        </div>
        {canAdjust && <StockAdjustmentDialog />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          paramName="type"
          placeholder="Movement Type"
          options={[
            { label: "All Types", value: "all" },
            ...STOCK_MOVEMENT_TYPES.map((t) => ({ label: t.replace("_", " "), value: t })),
          ]}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {movements.length === 0 ? (
            <EmptyState
              icon={History}
              title="No stock movements yet"
              description="Purchases, sales, and manual adjustments will appear here."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Previous</TableHead>
                    <TableHead className="text-right">New</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => (
                    <TableRow key={movement.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(movement.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Link href={`/inventory/${movement.productId}`} className="hover:underline">
                          {movement.itemName}
                        </Link>
                        <div className="font-mono text-xs text-muted-foreground">{movement.itemCode}</div>
                      </TableCell>
                      <TableCell>{movement.type}</TableCell>
                      <TableCell className="text-right">{movement.quantity}</TableCell>
                      <TableCell className="text-right">{movement.previousStock}</TableCell>
                      <TableCell className="text-right">{movement.newStock}</TableCell>
                      <TableCell className="text-muted-foreground">{movement.referenceType}</TableCell>
                      <TableCell className="text-muted-foreground">{movement.createdByName}</TableCell>
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
