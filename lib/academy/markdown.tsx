import type { ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const token = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = token.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const key = `${keyPrefix}-${tokenIndex}`;
    if (match[2] !== undefined && match[3] !== undefined) {
      const label = match[2];
      const href = match[3].trim();
      if (href.startsWith("https://")) {
        nodes.push(
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-violet-700 underline decoration-violet-300 underline-offset-4"
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(label);
      }
    } else if (match[4] !== undefined) {
      nodes.push(<strong key={key}>{match[4]}</strong>);
    } else if (match[5] !== undefined) {
      nodes.push(<em key={key}>{match[5]}</em>);
    }

    cursor = match.index + match[0].length;
    tokenIndex += 1;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function isUnorderedList(lines: string[]): boolean {
  return lines.length > 0 && lines.every((line) => /^-\s+/.test(line));
}

function isOrderedList(lines: string[]): boolean {
  return lines.length > 0 && lines.every((line) => /^\d+\.\s+/.test(line));
}

export function AcademyMarkdown({ markdown }: { markdown: string }) {
  const blocks = markdown
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5 text-base leading-7 text-slate-700">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
        const first = lines[0] ?? "";
        const key = `academy-markdown-${blockIndex}`;

        if (lines.length === 1 && first.startsWith("### ")) {
          return (
            <h3 key={key} className="text-xl font-black tracking-tight text-slate-950">
              {renderInline(first.slice(4), `${key}-heading`)}
            </h3>
          );
        }

        if (lines.length === 1 && first.startsWith("## ")) {
          return (
            <h2 key={key} className="text-2xl font-black tracking-tight text-slate-950">
              {renderInline(first.slice(3), `${key}-heading`)}
            </h2>
          );
        }

        if (isUnorderedList(lines)) {
          return (
            <ul key={key} className="list-disc space-y-2 pl-6">
              {lines.map((line, lineIndex) => (
                <li key={`${key}-${lineIndex}`}>
                  {renderInline(line.replace(/^-\s+/, ""), `${key}-${lineIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (isOrderedList(lines)) {
          return (
            <ol key={key} className="list-decimal space-y-2 pl-6">
              {lines.map((line, lineIndex) => (
                <li key={`${key}-${lineIndex}`}>
                  {renderInline(line.replace(/^\d+\.\s+/, ""), `${key}-${lineIndex}`)}
                </li>
              ))}
            </ol>
          );
        }

        const paragraph = lines.join(" ");
        return (
          <p key={key}>
            {renderInline(paragraph, `${key}-paragraph`)}
          </p>
        );
      })}
    </div>
  );
}
