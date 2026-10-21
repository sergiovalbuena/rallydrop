"use client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <Accordion type="single" collapsible className="rounded-2xl border bg-card px-6">
      {items.map((item, i) => (
        <AccordionItem key={item.q} value={`q${i}`}>
          <AccordionTrigger>{item.q}</AccordionTrigger>
          <AccordionContent>{item.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
