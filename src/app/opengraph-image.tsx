import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "RallyDrop — AI tennis ball machine rental in Victoria, BC";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NAVY = "#0E2350";
const OPTIC = "#D9F23F";

/** Share image for links on social media and chats (all pages without their own). */
export default async function OpengraphImage() {
  const photo = await readFile(join(process.cwd(), "public/machines/pongbot-aura-s.png"));
  const src = `data:image/png;base64,${photo.toString("base64")}`;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: NAVY,
        color: "white",
        padding: "64px 72px",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 14, background: OPTIC }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 44, fontWeight: 800 }}>
          <div style={{ width: 30, height: 30, borderRadius: 15, background: OPTIC, marginRight: 14 }} />
          <span>rally</span>
          {/* Satori adds a word gap between inline siblings; pull "drop" back. */}
          <span style={{ color: OPTIC, marginLeft: -8 }}>drop</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1, letterSpacing: -2, textTransform: "uppercase" }}>
            AI tennis ball machine rental
          </div>
          <div style={{ marginTop: 22, fontSize: 32, color: "rgba(255,255,255,0.85)" }}>
            PONGBOT Aura S with a built-in AI coach · Victoria, BC
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: OPTIC, fontWeight: 700 }}>
          Day · Weekend · Week · Month — balls included
        </div>
      </div>
      <img src={src} width={380} height={456} alt="" style={{ alignSelf: "center", marginLeft: 24 }} />
    </div>,
    size,
  );
}
