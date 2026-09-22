"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Sparkles } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NAV_ITEMS, ADMIN_NAV_ITEMS, type NavItem } from "@/lib/nav";
import { roleAtLeast, type Role } from "@/models/roles";

function NavItems({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <SidebarMenu>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton isActive={isActive} tooltip={item.title} render={<Link href={item.href} />}>
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

export function AppSidebar({ organizationName, role }: { organizationName: string; role: Role }) {
  const pathname = usePathname();
  const isAdmin = roleAtLeast(role, "admin");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Sparkles />
          </div>
          <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">BizAI</span>
            <span className="truncate text-xs text-muted-foreground">{organizationName}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <NavItems items={NAV_ITEMS} pathname={pathname} />
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <NavItems items={ADMIN_NAV_ITEMS} pathname={pathname} />
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          <Building2 className="size-3.5 shrink-0" />
          <span className="truncate">{organizationName}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
