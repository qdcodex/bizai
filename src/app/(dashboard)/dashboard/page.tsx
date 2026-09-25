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
  Plus,
  ArrowRight,
  ShieldAlert,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { MoneyDisplay } from "@/components/shared/money";
import { requireSession } from "@/lib/auth/guards";
import { can } from "@/lib/auth/permissions";
import { isModuleVisible } from "@/lib/auth/modules";
import { getWorkspaceContext } from "@/services/workspace.service";
import { getInventorySummary, getLowStockProducts } from "@/services/inventory.service";
import { countActiveCustomers } from "@/services/customer.service";
import { countActiveSuppliers } from "@/services/supplier.service";
import { listQuotations, getQuotationDashboardSummary } from "@/services/quotation.service";
import { getOrganizationUsageReport } from "@/ai/services/usage-service";
import { roleAtLeast } from "@/models/roles";

const REDIRECT_NOTICES: Record<string, { icon: typeof ShieldAlert; message: string }> = {
  forbidden: { icon: ShieldAlert, message: "Your role doesn't have access to that page." },
  "module-disabled": { icon: EyeOff, message: "That module has been turned off for your role by an admin." },
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const workspace = await getWorkspaceContext(session);
  const { error } = await searchParams;
  const notice = typeof error === "string" ? REDIRECT_NOTICES[error] : undefined;

  const visibility = workspace.organization.moduleVisibility;
  const role = workspace.role;
  const showInventory = isModuleVisible(visibility, role, "inventory");
  const showCustomers = isModuleVisible(visibility, role, "customers");
  const showSuppliers = isModuleVisible(visibility, role, "suppliers");
  const showQuotations = isModuleVisible(visibility, role, "quotations");
  const canViewAiUsage = roleAtLeast(role, "admin");
  const canCreateQuotation = showQuotations && can(role, "quotations.create");
  const canCreateProduct = showInventory && can(role, "products.create");

  const [inventorySummary, customerCount, supplierCount, quotationSummary, lowStockProducts, recentQuotations, aiUsage] =
    await Promise.all([
      showInventory ? getInventorySummary(session.organizationId) : null,
      showCustomers ? countActiveCustomers(session.organizationId) : null,
      showSuppliers ? countActiveSuppliers(session.organizationId) : null,
      showQuotations ? getQuotationDashboardSummary(session.organizationId) : null,
      showInventory ? getLowStockProducts(session.organizationId, 5) : null,
      showQuotations ? listQuotations(session.organizationId, { page: 1, limit: 5 }) : null,
      canViewAiUsage ? getOrganizationUsageReport(session.organizationId, 30) : null,
    ]);

  return (
    <div className="flex flex-col gap-6">
      {notice && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <notice.icon className="size-4 shrink-0" />
          {notice.message}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {workspace.user.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening at {workspace.organization.name} today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/assistant" />}>
            <Sparkles />
            Ask AI
          </Button>
          {canCreateProduct && (
            <Button variant="outline" render={<Link href="/products/new" />}>
              <Plus />
              Add Product
            </Button>
          )}
          {canCreateQuotation && (
            <Button render={<Link href="/quotations/new" />}>
              <Plus />
              New Quotation
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {inventorySummary && (
          <StatCard icon={Boxes} label="Products" value={String(inventorySummary.totalProducts)} href="/products" />
        )}
        {customerCount !== null && (
          <StatCard icon={Users} label="Customers" value={String(customerCount)} href="/customers" />
        )}
        {supplierCount !== null && (
          <StatCard icon={Truck} label="Suppliers" value={String(supplierCount)} href="/suppliers" />
        )}
        {inventorySummary && (
          <StatCard
            icon={AlertTriangle}
            label="Low / Out of Stock"
            value={String(inventorySummary.lowStockCount + inventorySummary.outOfStockCount)}
            hint={`${inventorySummary.outOfStockCount} out of stock`}
            href="/inventory"
          />
        )}
        {quotationSummary && (
          <StatCard
            icon={FileText}
            label="Pending Approval"
            value={String(quotationSummary.pendingApprovalCount)}
            href="/quotations?status=PENDING_APPROVAL"
          />
        )}
        {quotationSummary && (
          <StatCard
            icon={IndianRupee}
            label="Sales This Month"
            value={<MoneyDisplay value={quotationSummary.monthlySales} />}
            href="/invoices"
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {recentQuotations && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Quotations</CardTitle>
                <ViewAllLink href="/quotations" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentQuotations.data.length === 0 ? (
                <EmptyState icon={Receipt} title="No quotations yet" description="Quotations you create will appear here." />
              ) : (
                <div className="divide-y border-t">
                  {recentQuotations.data.map((quotation) => (
                    <Link
                      key={quotation.quotationId}
                      href={`/quotations/${quotation.quotationId}`}
                      className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
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
        )}

        {lowStockProducts && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Low Stock Products</CardTitle>
                <ViewAllLink href="/inventory" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {lowStockProducts.length === 0 ? (
                <EmptyState icon={Boxes} title="All stocked up" description="No products are currently low or out of stock." />
              ) : (
                <div className="divide-y border-t">
                  {lowStockProducts.map((product) => (
                    <Link
                      key={product.productId}
                      href={`/inventory/${product.productId}`}
                      className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div>
                        <p className="text-sm font-medium">{product.itemName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{product.itemCode}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground tabular-nums">
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
        )}

        {quotationSummary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quotation Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <PipelineStep
                label="Awaiting approval"
                count={quotationSummary.pendingApprovalCount}
                href="/quotations?status=PENDING_APPROVAL"
              />
              <PipelineStep
                label="Approved — ready to convert"
                count={quotationSummary.approvedCount}
                href="/quotations?status=APPROVED"
              />
            </CardContent>
          </Card>
        )}

        {canViewAiUsage && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">AI Usage</CardTitle>
                <ViewAllLink href="/admin/ai-usage" label="Details" />
              </div>
            </CardHeader>
            <CardContent>
              {!aiUsage || aiUsage.summary.totalRequests === 0 ? (
                <EmptyState
                  icon={Sparkles}
                  title="No AI activity yet"
                  description="Token usage and request history will appear here once the AI Assistant is used."
                />
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <Metric label="Requests (30d)" value={String(aiUsage.summary.totalRequests)} />
                  <Metric label="Tokens" value={aiUsage.summary.totalTokens.toLocaleString()} />
                  <Metric label="Est. Cost" value={`$${aiUsage.summary.estimatedCostUsd.toFixed(4)}`} />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ViewAllLink({ href, label = "View all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
    >
      {label}
      <ArrowRight className="size-3" />
    </Link>
  );
}

function PipelineStep({ label, count, href }: { label: string; count: number; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-1 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="text-2xl font-semibold tracking-tight tabular-nums">{count}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate text-xl font-semibold tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
