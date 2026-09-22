import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money";
import { EmptyState } from "@/components/empty-state";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { requirePagePermission, can } from "@/lib/auth/permissions";
import { getInventoryDetail } from "@/services/inventory.service";
import { AppError } from "@/lib/errors";

export default async function InventoryDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const session = await requirePagePermission("inventory.read");
  const { productId } = await params;

  let detail;
  try {
    detail = await getInventoryDetail(session.organizationId, productId);
  } catch (error) {
    if (error instanceof AppError && error.code === "PRODUCT_NOT_FOUND") notFound();
    throw error;
  }

  const { product, currentStock, stockStatus, recentMovements } = detail;
  const canAdjust = can(session.role, "inventory.adjust");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" render={<Link href="/inventory" />}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{product.itemName}</h1>
            <p className="font-mono text-sm text-muted-foreground">{product.itemCode}</p>
          </div>
        </div>
        {canAdjust && (
          <StockAdjustmentDialog fixedProduct={{ productId, itemName: product.itemName }} />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Current Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{currentStock}</p>
            <StatusBadge status={stockStatus} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Minimum Stock</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{product.lowStockThreshold}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Selling Price</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              <MoneyDisplay value={product.sellingPrice} />
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Movement History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentMovements.length === 0 ? (
            <EmptyState
              icon={History}
              title="No movements yet"
              description="Stock movements for this product will appear here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead className="text-right">New</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMovements.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="text-muted-foreground">
                      {new Date(movement.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>{movement.type}</TableCell>
                    <TableCell className="text-right">{movement.quantity}</TableCell>
                    <TableCell className="text-right">{movement.previousStock}</TableCell>
                    <TableCell className="text-right">{movement.newStock}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {movement.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
