import { connection } from "next/server";
import Link from "next/link";
import { Search } from "lucide-react";
import { Empty, PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { formatLocal } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await connection();
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim();
  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q.replace(/\D/g, "") || q } },
        ],
      }
    : {};
  const customers = await db.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      _count: { select: { bookings: { where: { status: { notIn: ["EXPIRED", "PENDING_PAYMENT"] } } } } },
      subscriptions: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });
  return (
    <>
      <PageHeader
        title="Customers"
        description={`${customers.length}${customers.length === 100 ? "+" : ""} customers`}
      />
      <form className="mb-4 flex max-w-md gap-2" role="search">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Name, email or phone"
            className="pl-9"
            aria-label="Search customers"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>
      {customers.length === 0 ? (
        <Empty>No customers found.</Empty>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link href={`/admin/customers/${c.id}`} className="font-semibold hover:underline">
                      {c.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {c.email}
                    {c.email && c.phone && <br />}
                    {c.phone}
                  </TableCell>
                  <TableCell>{c._count.bookings}</TableCell>
                  <TableCell className="space-x-1">
                    {c.trusted && <Badge variant="success">trusted</Badge>}
                    {c.blocked && <Badge variant="destructive">blocked</Badge>}
                    {c.subscriptions.length > 0 && <Badge variant="accent">package</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLocal(c.createdAt, "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
