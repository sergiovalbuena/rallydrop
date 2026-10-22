"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  CalendarDays,
  ClipboardList,
  Download,
  Gauge,
  Settings,
  ShoppingBag,
  TicketPercent,
  BellRing,
  FileText,
  Star,
  Users,
  UsersRound,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: Gauge, exact: true },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/bookings", label: "Bookings", icon: ClipboardList },
  { href: "/admin/machines", label: "Machines", icon: Wrench },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/groups", label: "Group sessions", icon: UsersRound },
  { href: "/admin/products", label: "Prices & products", icon: ShoppingBag },
  { href: "/admin/promo-codes", label: "Promo codes", icon: TicketPercent },
  { href: "/admin/waitlist", label: "Waitlist", icon: BellRing },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/legal", label: "Terms & waiver", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/export", label: "Export", icon: Download },
];

export function AdminNav() {
  return (
    <Suspense fallback={<Nav pathname={null} />}>
      <ActiveNav />
    </Suspense>
  );
}

function ActiveNav() {
  return <Nav pathname={usePathname()} />;
}

function Nav({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : !!pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary",
              active && "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
