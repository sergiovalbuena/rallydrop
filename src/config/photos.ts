/*
 * Real photos and videos for the site. Drop a file in public/photos (or use a
 * Vercel Blob / Pongbot CDN URL) and set its path here; until then each slot
 * shows its fallback (the illustration on the home hero, nothing on the
 * machine card, a labelled placeholder in the guide).
 */
export type Media = { src: string; alt: string } | null;

export const PHOTOS = {
  /** Home hero: someone rallying against the Aura S. Landscape, ~4:3. */
  hero: null as Media,
  /** Machine card: the Aura S set up on a court. Landscape, ~16:10. */
  machineOnCourt: null as Media,
};

/** Quick-start guide media, one per step id. Videos: an MP4 path or a YouTube embed URL. */
export const GUIDE_MEDIA: Record<string, { photo: Media; video: Media }> = {
  power: { photo: null, video: null },
  balls: { photo: null, video: null },
  app: { photo: null, video: null },
  drill: { photo: null, video: null },
  spotter: { photo: null, video: null },
  voice: { photo: null, video: null },
  jam: { photo: null, video: null },
  return: { photo: null, video: null },
};
