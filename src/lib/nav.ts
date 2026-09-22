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
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { title: "AI Assistant", href: "/assistant", icon: Sparkles },
  { title: "Inventory", href: "/inventory", icon: Boxes },
  { title: "Customers", href: "/customers", icon: Users },
  { title: "Suppliers", href: "/suppliers", icon: Truck },
  { title: "Quotations", href: "/quotations", icon: FileText },
  { title: "Invoices", href: "/invoices", icon: Receipt },
  { title: "Knowledge Base", href: "/knowledge", icon: BookOpen },
  { title: "Settings", href: "/settings", icon: Settings },
];

/** Visible only to admin+ roles (gated in AppSidebar via roleAtLeast). */
export const ADMIN_NAV_ITEMS: NavItem[] = [
  { title: "AI Usage", href: "/admin/ai-usage", icon: Gauge },
  { title: "AI Activity", href: "/admin/ai-activity", icon: History },
];
