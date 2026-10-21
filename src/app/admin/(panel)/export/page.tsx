import { connection } from "next/server";
import { Download } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function ExportPage() {
  await connection();
  return (
    <>
      <PageHeader title="Export" description="CSV files open in Excel, Numbers or Google Sheets." />
      <div className="grid gap-6 lg:grid-cols-2">
        {[
          { title: "Bookings", action: "/api/admin/export/bookings", hint: "Filtered by start date." },
          {
            title: "Payments",
            action: "/api/admin/export/payments",
            hint: "Rentals, deposits charged, packages, group sessions and refunds — for your bookkeeping.",
          },
        ].map((e) => (
          <Panel key={e.title} title={e.title}>
            <form action={e.action} method="get" className="space-y-4">
              <p className="text-sm text-muted-foreground">{e.hint}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${e.title}-from`}>From</Label>
                  <Input id={`${e.title}-from`} type="date" name="from" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${e.title}-to`}>To</Label>
                  <Input id={`${e.title}-to`} type="date" name="to" />
                </div>
              </div>
              <Button type="submit">
                <Download /> Download {e.title.toLowerCase()}.csv
              </Button>
            </form>
          </Panel>
        ))}
      </div>
    </>
  );
}
