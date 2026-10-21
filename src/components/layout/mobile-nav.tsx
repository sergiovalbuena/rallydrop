"use client";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "./nav-links";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const t = useTranslations();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("common.openMenu")}>
          <Menu className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <Logo />
        <NavLinks className="mt-4 flex flex-col items-start gap-1 text-lg" onNavigate={() => setOpen(false)} />
        <div className="mt-auto flex flex-col gap-3">
          <Button asChild variant="outline" size="lg" onClick={() => setOpen(false)}>
            <Link href="/account">{t("nav.myBookings")}</Link>
          </Button>
          <Button asChild size="lg" onClick={() => setOpen(false)}>
            <Link href="/book">{t("common.bookNow")}</Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
