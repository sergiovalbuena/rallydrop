import Image from "next/image";
import type { ReactNode } from "react";
import { Camera, PlayCircle } from "lucide-react";
import type { Media } from "@/config/photos";
import { cn } from "@/lib/utils";

/**
 * A place for a real photo (src/config/photos.ts). With a photo it renders
 * an optimised next/image; without one it renders `fallback`, or — when no
 * fallback is given — a labelled placeholder so it's clear what goes there.
 */
export function PhotoSlot({
  media,
  label,
  sizes,
  className,
  fallback,
  priority = false,
  kind = "photo",
}: {
  media: Media;
  /** What the photo should show, for the placeholder. */
  label: string;
  sizes: string;
  className?: string;
  fallback?: ReactNode;
  priority?: boolean;
  kind?: "photo" | "video";
}) {
  if (media && kind === "video") {
    return /youtube\.com|youtu\.be/.test(media.src) ? (
      <iframe
        src={media.src}
        title={media.alt}
        loading="lazy"
        allow="accelerometer; encrypted-media; picture-in-picture"
        allowFullScreen
        className={cn("aspect-video w-full rounded-xl border-0", className)}
      />
    ) : (
      <video src={media.src} controls preload="metadata" className={cn("aspect-video w-full rounded-xl", className)}>
        {media.alt}
      </video>
    );
  }
  if (media) {
    return (
      <div className={cn("relative overflow-hidden rounded-xl", className)}>
        <Image src={media.src} alt={media.alt} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  if (fallback !== undefined) return <>{fallback}</>;
  const Icon = kind === "video" ? PlayCircle : Camera;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/50 p-4 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-6" aria-hidden />
      <span>
        {kind === "video" ? "Video coming soon" : "Photo coming soon"}
        <span className="sr-only">: {label}</span>
      </span>
    </div>
  );
}
