import Link from "next/link";
import {
  Boxes,
  Users,
  AlertTriangle,
  FileText,
  IndianRupee,
  Sparkles,
  Truck,
  Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money";
import { requireSession } from "@/lib/auth/guards";
import { getWorkspaceContext } from "@/services/workspace.service";
import { getInventorySummary, getLowStockProducts } from "@/services/inventory.service";
import { countActiveCustomers } from "@/services/customer.service";
import { countActiveSuppliers } from "@/services/supplier.service";
import { listQuotations, getQuotationDashboardSummary } from "@/services/quotation.service";

export default async function DashboardPage() {
  const session = await requireSession();
  const workspace = await getWorkspaceContext(session);

  const [inventorySummary, customerCount, supplierCount, quotationSummary, lowStockProducts, recentQuotations] =
    await Promise.all([
      getInventorySummary(session.organizationId),
      countActiveCustomers(session.organizationId),
      countActiveSuppliers(session.organizationId),
      getQuotationDashboardSummary(session.organizationId),
      getLowStockProducts(session.organizationId, 5),
      listQuotations(session.organizationId, { page: 1, limit: 5 }),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome back, {workspace.user.name.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening at {workspace.organization.name} today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={Boxes} label="Products" value={String(inventorySummary.totalProducts)} />
        <StatCard icon={Users} label="Customers" value={String(customerCount)} />
        <StatCard icon={Truck} label="Suppliers" value={String(supplierCount)} />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock"
          value={String(inventorySummary.lowStockCount + inventorySummary.outOfStockCount)}
        />
        <StatCard
          icon={FileText}
          label="Pending Quotations"
          value={String(quotationSummary.pendingApprovalCount)}
        />
        <StatCard
          icon={IndianRupee}
          label="Monthly Sales"
          value={<MoneyDisplay value={quotationSummary.monthlySales} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Quotations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentQuotations.data.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No quotations yet"
                description="Quotations you create will appear here."
              />
            ) : (
              <div className="divide-y">
                {recentQuotations.data.map((quotation) => (
                  <Link
                    key={quotation.quotationId}
                    href={`/quotations/${quotation.quotationId}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                  >
                    <div>
                      <p className="font-mono text-xs font-medium">{quotation.quotationNumber}</p>
                      <p className="text-xs text-muted-foreground">{quotation.customerName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <MoneyDisplay value={quotation.total} className="text-sm font-medium" />
                      <StatusBadge status={quotation.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low Stock Products</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lowStockProducts.length === 0 ? (
              <EmptyState
                icon={Boxes}
                title="All stocked up"
                description="No products are currently low or out of stock."
              />
            ) : (
              <div className="divide-y">
                {lowStockProducts.map((product) => (
                  <Link
                    key={product.productId}
                    href={`/inventory/${product.productId}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/50"
                  >
                    <div>
                      <p className="text-sm font-medium">{product.itemName}</p>
                      <p className="font-mono text-xs text-muted-foreground">{product.itemCode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {product.currentStock} / {product.lowStockThreshold}
                      </span>
                      <StatusBadge status={product.stockStatus} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Approved Quotations</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{quotationSummary.approvedCount}</p>
            <p className="text-xs text-muted-foreground">Awaiting conversion to a sale.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">AI Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Sparkles}
              title="No AI activity yet"
              description="Token usage and request history will appear once the AI Assistant ships in Phase 3."
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
