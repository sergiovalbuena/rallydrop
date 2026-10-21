import { connection } from "next/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function MachinesPage() {
  await connection();
  const machines = await db.machine.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          bookings: {
            where: { status: { in: ["CONFIRMED", "CHECKED_OUT", "RETURNED_OK", "RETURNED_DAMAGED", "COMPLETED"] } },
          },
        },
      },
    },
  });
  return (
    <>
      <PageHeader
        title="Machines"
        actions={
          <Button asChild>
            <Link href="/admin/machines/new">
              <Plus /> Add machine
            </Link>
          </Button>
        }
      />
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Machine</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Bookable online</TableHead>
              <TableHead>Deposit</TableHead>
              <TableHead className="text-right">Rentals</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {machines.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <Link
                    href={`/admin/machines/${m.id}`}
                    className="flex items-center gap-2 font-semibold hover:underline"
                  >
                    <span className="size-3 rounded-full" style={{ background: m.calendarColor }} aria-hidden />
                    {m.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={m.status === "AVAILABLE" ? "success" : m.status === "RENTED" ? "accent" : "warning"}>
                    {m.status.toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell>{m.bookable ? "Yes" : "Coming soon"}</TableCell>
                <TableCell>{formatCents(m.depositCents)}</TableCell>
                <TableCell className="text-right">{m._count.bookings}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
