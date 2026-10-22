import { Fragment, type ReactNode } from "react";

/*
 * Renders the stored legal texts (a small Markdown subset: "## " and "### "
 * headings, "- " lists, blank-line paragraphs, **bold** and [text](url)).
 * Plain function component: works on the server and inside client modals.
 */

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={i++}>{m[1]}</strong>);
    else
      out.push(
        <a key={i++} href={m[3]} className="text-primary underline">
          {m[2]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function LegalText({ body, className }: { body: string; className?: string }) {
  const blocks = body.trim().split(/\n{2,}/);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (block.startsWith("### ")) return <h3 key={i}>{inline(block.slice(4))}</h3>;
        if (block.startsWith("## ")) return <h2 key={i}>{inline(block.slice(3))}</h2>;
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        // A lead-in line followed by a list ("You agree to:\n- …").
        const firstList = lines.findIndex((l) => l.startsWith("- "));
        if (firstList > 0) {
          return (
            <Fragment key={i}>
              <p>{inline(lines.slice(0, firstList).join(" "))}</p>
              <ul>
                {lines.slice(firstList).map((l, j) => (
                  <li key={j}>{inline(l.replace(/^- /, ""))}</li>
                ))}
              </ul>
            </Fragment>
          );
        }
        return <p key={i}>{inline(lines.join(" "))}</p>;
      })}
    </div>
  );
}
