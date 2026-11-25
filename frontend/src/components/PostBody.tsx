import { Fragment, type ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';

const URL_RE = /(https?:\/\/[^\s<>"'）】]+|www\.[^\s<>"'）】]+)/g;

function renderText(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  URL_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const value = match[0];
    const href = value.startsWith('www.') ? `https://${value}` : value;
    nodes.push(
      <a key={`${keyPrefix}-${match.index}`} href={href} target="_blank" rel="noreferrer noopener">
        {value}<ExternalLink className="icon-trailing" aria-hidden="true" />
      </a>,
    );
    last = match.index + value.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/** Text-only renderer: auto-links URLs, keeps ``` code blocks, never injects HTML. */
export function PostBody({ body, className = '' }: { body: string; className?: string }) {
  const parts = body.split(/(```[\s\S]*?```)/g);
  return (
    <div
      className={`hp-post-body fs-sm ${className}`}
      style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
    >
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const code = part.slice(3, -3).replace(/^\r?\n/, '');
          return (
            <pre
              key={index}
              className="p-3 rounded my-2"
              style={{ background: 'var(--surface-2)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
            >
              <code>{code}</code>
            </pre>
          );
        }
        return <Fragment key={index}>{renderText(part, String(index))}</Fragment>;
      })}
    </div>
  );
}
