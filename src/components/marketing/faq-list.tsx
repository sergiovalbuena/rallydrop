import { ChevronDown } from "lucide-react";

/**
 * FAQ as native <details>: answers are in the HTML (search engines, no-JS,
 * find-in-page) and it still opens and closes like an accordion.
 */
export function FaqList({ items }: { items: { id?: string; q: string; a: string }[] }) {
  return (
    <div className="divide-y rounded-2xl border bg-card px-6">
      {items.map((item) => (
        <details key={item.q} id={item.id ? `faq-${item.id}` : undefined} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="pb-4 text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
