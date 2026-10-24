import { permanentRedirect } from "next/navigation";

/** The guide moved to /guide (public, linked from emails); old links keep working. */
export default function OldGuidePage() {
  permanentRedirect("/guide");
}
