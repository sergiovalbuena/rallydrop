import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CalendarDays, CircleCheckBig, MapPin } from "lucide-react";
import { ContactPayFlow } from "@/components/booking/contact-pay-flow";
import { Section } from "@/components/marketing/section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCentsShort } from "@/lib/money";
import { upcomingGroupSessions } from "@/lib/services/catalog";
import { formatLocal } from "@/lib/time";
import { startGroupAction } from "../../extra-actions";

export const metadata: Metadata = { title: "Join a group session" };

export default function GroupJoinPage({ params, searchParams }: PageProps<"/book/group/[id]">) {
  return (
    <Section className="max-w-xl pt-8">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Join params={params} searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}

async function Join({
  params,
  searchParams,
}: {
  params: PageProps<"/book/group/[id]">["params"];
  searchParams: PageProps<"/book/group/[id]">["searchParams"];
}) {
  await connection();
  const { id } = await params;
  const sp = await searchParams;
  const t = await getTranslations("groups");
  const tb = await getTranslations("book");
  const session = (await upcomingGroupSessions(new Date())).find((s) => s.id === id);
  if (!session) notFound();

  if (sp.done) {
    return (
      <div className="rounded-3xl border bg-card p-8 text-center">
        <CircleCheckBig className="mx-auto size-12 text-success" />
        <h1 className="mt-4 font-display text-4xl font-extrabold uppercase">{tb("confirmedTitle")}</h1>
        <p className="mt-2 text-muted-foreground">
          {session.title} · {formatLocal(session.startsAt, "EEE, MMM d · h:mm a")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="court-lines rounded-2xl bg-court p-6 text-white">
        <h1 className="font-display text-4xl font-extrabold uppercase">{session.title}</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-white/85">
          <CalendarDays className="size-4" /> {formatLocal(session.startsAt, "EEEE, MMM d · h:mm a")}
        </p>
        <p className="mt-1 flex items-center gap-2 text-sm text-white/85">
          <MapPin className="size-4" /> {session.court.name}
        </p>
        <p className="mt-3 font-display text-2xl font-bold text-optic">
          {t("spotsLeft", { count: session.spotsLeft })}
        </p>
      </div>
      {session.spotsLeft > 0 ? (
        <ContactPayFlow
          targetId={session.id}
          start={startGroupAction}
          successPath={`/book/group/${session.id}?done=1`}
          cta={t("join", { price: formatCentsShort(session.priceCents) })}
        />
      ) : (
        <p className="text-center text-muted-foreground">{t("full")}</p>
      )}
    </div>
  );
}
