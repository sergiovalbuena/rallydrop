import { connection } from "next/server";
import Link from "next/link";
import { Download, Search } from "lucide-react";
import { Empty, PageHeader, STATUS_LABEL, StatusBadge } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/lib/db";
import { bookingWhere, type BookingFilters } from "@/lib/admin/queries";
import { formatCents } from "@/lib/money";
import { formatLocal } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

const PAGE_SIZE = 50;

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  await connection();
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const filters: BookingFilters = { q: one("q"), status: one("status"), machine: one("machine"), from: one("from"), to: one("to") };
  const page = Math.max(1, Number(one("page") ?? 1));
  const where = bookingWhere(filters);
  const [bookings, total, machines] = await Promise.all([
    db.booking.findMany({
      where,
      include: { customer: true, machine: true, product: true, deposit: true },
      orderBy: { startsAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.booking.count({ where }),
    db.machine.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const qs = new URLSearchParams(Object.entries(filters).filter((e): e is [string, string] => !!e[1]));

  return (
    <>
      <PageHeader
        title="Bookings"
        description={`${total} booking${total === 1 ? "" : "s"}`}
        actions={
          <Button asChild variant="outline">
            <a href={`/api/admin/export/bookings?${qs}`}>
              <Download /> CSV
            </a>
          </Button>
        }
      />
      <form className="mb-4 grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <div className="relative lg:col-span-2">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input name="q" defaultValue={filters.q} placeholder="Code, name, email, phone" className="pl-9" aria-label="Search" />
        </div>
        <NativeSelect name="status" defaultValue={filters.status ?? "ALL"} aria-label="Status">
          <option value="ALL">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="machine" defaultValue={filters.machine ?? ""} aria-label="Machine">
          <option value="">All machines</option>
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </NativeSelect>
        <Input type="date" name="from" defaultValue={filters.from} aria-label="From" />
        <div className="flex gap-2">
          <Input type="date" name="to" defaultValue={filters.to} aria-label="To" />
          <Button type="submit">Filter</Button>
        </div>
      </form>

      {bookings.length === 0 ? (
        <Empty>No bookings match these filters.</Empty>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Machine · Product</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold text-primary hover:underline">
                      {b.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{b.customer.name}</div>
                    <div className="text-xs text-muted-foreground">{b.customer.email ?? b.customer.phone}</div>
                  </TableCell>
                  <TableCell>
                    <span className="mr-1.5 inline-block size-2.5 rounded-full" style={{ background: b.machine.calendarColor }} aria-hidden />
                    {b.machine.name} · {b.product.name}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatLocal(b.startsAt, "EEE MMM d, h:mm a")}</TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(b.totalCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex justify-between">
          <Button asChild variant="outline" disabled={page <= 1}>
            <Link href={`?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page - 1) })}`}>Previous</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <Button asChild variant="outline" disabled={page * PAGE_SIZE >= total}>
            <Link href={`?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(page + 1) })}`}>Next</Link>
          </Button>
        </div>
      )}
    </>
  );
}
