import { requireSession } from "@/lib/auth/guards";
import { getWorkspaceContext } from "@/services/workspace.service";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { QuickAction } from "@/components/layout/command-menu";
import { can } from "@/lib/auth/permissions";
import { isModuleVisible } from "@/lib/auth/modules";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const workspace = await getWorkspaceContext(session);
  const { role } = workspace;
  const visibility = workspace.organization.moduleVisibility;

  const quickActions: QuickAction[] = [];
  if (isModuleVisible(visibility, role, "quotations") && can(role, "quotations.create")) {
    quickActions.push({ label: "New Quotation", href: "/quotations/new", icon: "quotation" });
  }
  if (can(role, "products.create")) {
    quickActions.push({ label: "New Product", href: "/products/new", icon: "product" });
  }
  if (isModuleVisible(visibility, role, "customers") && can(role, "customers.create")) {
    quickActions.push({ label: "New Customer", href: "/customers/new", icon: "customer" });
  }

  return (
    <SidebarProvider>
      <AppSidebar
        organizationName={workspace.organization.name}
        role={workspace.role}
        moduleVisibility={workspace.organization.moduleVisibility}
      />
      <SidebarInset>
        <Topbar
          user={{ name: workspace.user.name, email: workspace.user.email, role }}
          moduleVisibility={visibility}
          quickActions={quickActions}
        />
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
