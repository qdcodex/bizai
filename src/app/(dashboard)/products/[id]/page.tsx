import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money";
import { EmptyState } from "@/components/empty-state";
import { History } from "lucide-react";
import { requirePagePermission } from "@/lib/auth/permissions";
import { can } from "@/lib/auth/permissions";
import { getInventoryDetail } from "@/services/inventory.service";
import { AppError } from "@/lib/errors";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePagePermission("products.read");
  const { id } = await params;

  let detail;
  try {
    detail = await getInventoryDetail(session.organizationId, id);
  } catch (error) {
    if (error instanceof AppError && error.code === "PRODUCT_NOT_FOUND") notFound();
    throw error;
  }

  const { product, currentStock, stockStatus, recentMovements } = detail;
  const canManage = can(session.role, "products.update");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" render={<Link href="/products" />}>
            <ArrowLeft />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{product.itemName}</h1>
            <p className="font-mono text-sm text-muted-foreground">{product.itemCode}</p>
          </div>
        </div>
        {canManage && (
          <Button variant="outline" render={<Link href={`/products/${id}/edit`} />}>
            <Pencil />
            Edit
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" value={product.category || "—"} />
            <Field label="Brand" value={product.brand || "—"} />
            <Field label="Part Number" value={product.partNumber || "—"} />
            <Field label="Unit of Measure" value={product.uom} />
            <Field label="Cost Price" value={<MoneyDisplay value={product.costPrice} />} />
            <Field label="Selling Price" value={<MoneyDisplay value={product.sellingPrice} />} />
            <Field label="Minimum Selling Price" value={<MoneyDisplay value={product.minSellingPrice} />} />
            <Field label="Low Stock Threshold" value={String(product.lowStockThreshold)} />
            {product.description && (
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm">{product.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stock</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Current Stock</p>
              <p className="text-2xl font-semibold">{currentStock}</p>
            </div>
            <div className="flex gap-2">
              <StatusBadge status={product.isActive ? "ACTIVE" : "INACTIVE"} />
              <StatusBadge status={stockStatus} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Stock Movements</CardTitle>
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
