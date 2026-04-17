"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Wrench,
  AlertTriangle,
  ClipboardList,
  Package,
  ClipboardCheck,
  CheckCircle,
  Calendar,
  BarChart2,
  Users,
  Building2,
  Layers,
  CreditCard,
  Shield,
  X,
  FileText,
  ScrollText,
  BookOpen,
  ScanLine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui-store";
import type { Role } from "@/lib/auth/roles";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Role[];
}

const mainNavItems: NavItem[] = [
  { label: "Pano", href: "/panel", icon: LayoutDashboard, roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
  { label: "Makineler", href: "/makineler", icon: Wrench, roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
  { label: "Departmanlar", href: "/departmanlar", icon: Layers, roles: ["FACTORY_ADMIN"] },
  { label: "Arızalar", href: "/arizalar", icon: AlertTriangle, roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
  { label: "Görevlerim", href: "/gorevlerim", icon: ClipboardList, roles: ["TECHNICIAN"] },
  { label: "Yedek Parça", href: "/parcalar", icon: Package, roles: ["FACTORY_ADMIN", "ENGINEER"] },
  { label: "Otonom Bakım", href: "/otonom-bakim", icon: ClipboardCheck, roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
  { label: "Aksiyonlar", href: "/aksiyonlar", icon: CheckCircle, roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
  { label: "Planlı Bakım", href: "/planli-bakim", icon: Calendar, roles: ["FACTORY_ADMIN", "ENGINEER"] },
  { label: "İş Emirleri", href: "/is-emirleri", icon: FileText, roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
  { label: "Raporlar", href: "/raporlar", icon: BarChart2, roles: ["FACTORY_ADMIN", "ENGINEER"] },
  { label: "Kullanıcılar", href: "/kullanicilar", icon: Users, roles: ["FACTORY_ADMIN"] },
  { label: "Denetim Kayıtları", href: "/denetim-kayitlari", icon: ScrollText, roles: ["FACTORY_ADMIN"] },
  { label: "QR Okut", href: "/qr-okut", icon: ScanLine, roles: ["FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
  { label: "Kullanım Kılavuzu", href: "/kilavuz", icon: BookOpen, roles: ["SUPER_ADMIN", "FACTORY_ADMIN", "ENGINEER", "TECHNICIAN"] },
];

const superAdminNavItems: NavItem[] = [
  { label: "Yönetim Paneli", href: "/super-admin", icon: Shield, roles: ["SUPER_ADMIN"] },
  { label: "Fabrikalar", href: "/super-admin/fabrikalar", icon: Building2, roles: ["SUPER_ADMIN"] },
  { label: "Abonelikler", href: "/super-admin/abonelikler", icon: CreditCard, roles: ["SUPER_ADMIN"] },
];

interface SidebarProps {
  user: {
    role: Role;
    name: string;
    factoryName: string | null;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const filteredMain = mainNavItems.filter((item) => item.roles.includes(user.role));

  function renderNavItem(item: NavItem) {
    const Icon = item.icon;
    // For /super-admin exactly, only match the exact path; for others allow prefix match
    const isActive =
      item.href === "/super-admin"
        ? pathname === "/super-admin"
        : pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent/60 text-sidebar-foreground/80 hover:text-sidebar-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    );
  }

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          <span className="text-lg font-bold">MaintainPro</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded hover:bg-sidebar-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {user.factoryName && (
          <div className="px-4 py-2 text-xs text-sidebar-foreground/60 border-b border-sidebar-border truncate">
            {user.factoryName}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <div className="space-y-1">
            {filteredMain.map(renderNavItem)}
          </div>

          {isSuperAdmin && (
            <div className="mt-4">
              <div className="px-3 py-2">
                <p className="text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
                  Süper Admin
                </p>
              </div>
              <div className="space-y-1">
                {superAdminNavItems.map(renderNavItem)}
              </div>
            </div>
          )}
        </nav>
      </aside>
    </>
  );
}
