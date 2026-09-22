import { requireSession } from "@/lib/auth/guards";
import { getWorkspaceContext } from "@/services/workspace.service";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const workspace = await getWorkspaceContext(session);

  return (
    <SidebarProvider>
      <AppSidebar organizationName={workspace.organization.name} role={workspace.role} />
      <SidebarInset>
        <Topbar
          user={{ name: workspace.user.name, email: workspace.user.email, role: workspace.role }}
        />
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
