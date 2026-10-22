/** Plain-language description of how the machine gets to and from the customer. */

export const HUB_LABEL = "our downtown Victoria spot";

type LogisticsInput = {
  fulfillment: "PICKUP" | "DELIVERY_COURT" | "DELIVERY_ADDRESS";
  dropoff: boolean;
  collection: boolean;
  court?: { name: string } | null;
  deliveryAddress?: string | null;
};

export function servicePlace(b: LogisticsInput): string | null {
  if (b.fulfillment === "DELIVERY_COURT") return b.court?.name ?? "the court";
  if (b.fulfillment === "DELIVERY_ADDRESS") return b.deliveryAddress ?? "your address";
  return null;
}

export function logistics(b: LogisticsInput) {
  const place = servicePlace(b);
  const start = b.dropoff && place ? `We drop it off at ${place}` : `You collect it at ${HUB_LABEL}`;
  const end = b.collection && place ? `We collect it from ${place}` : `You return it to ${HUB_LABEL}`;
  const short =
    b.dropoff && b.collection
      ? `Drop-off & collection · ${place}`
      : b.dropoff
        ? `Drop-off only · ${place}`
        : b.collection
          ? `Collection only · ${place}`
          : "Self-serve (hub)";
  return { place, start, end, short };
}
