import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Sparkles,
  Boxes,
  Users,
  Truck,
  FileText,
  Receipt,
  BookOpen,
  Settings,
  Gauge,
  History,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Gated module this nav item belongs to (see src/lib/auth/modules.ts). Omit for core nav that's never hideable. */
  moduleKey?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "AI Assistant", href: "/assistant", icon: Sparkles },
  { title: "Inventory", href: "/inventory", icon: Boxes, moduleKey: "inventory" },
  { title: "Customers", href: "/customers", icon: Users, moduleKey: "customers" },
  { title: "Suppliers", href: "/suppliers", icon: Truck, moduleKey: "suppliers" },
  { title: "Quotations", href: "/quotations", icon: FileText, moduleKey: "quotations" },
  { title: "Invoices", href: "/invoices", icon: Receipt, moduleKey: "quotations" },
  { title: "Knowledge Base", href: "/knowledge", icon: BookOpen, moduleKey: "knowledge" },
  { title: "Settings", href: "/settings", icon: Settings },
];

/** Visible only to admin+ roles (gated in AppSidebar via roleAtLeast). */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { title: "AI Usage", href: "/admin/ai-usage", icon: Gauge },
  { title: "AI Activity", href: "/admin/ai-activity", icon: History },
];
