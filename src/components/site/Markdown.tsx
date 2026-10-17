import { Fragment } from 'react';

/** Admin yozgan matn uchun xavfsiz kichik Markdown: sarlavha, ro'yxat, **qalin**, *kursiv*, [havola](url). HTML qabul qilinmaydi. */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith('**')) out.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('*')) out.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      const href = lm[2];
      const safe = /^(https?:\/\/|\/|mailto:|tel:)/.test(href) ? href : '#';
      const external = safe.startsWith('http');
      out.push(
        <a key={key} href={safe} {...(external ? { target: '_blank', rel: 'noopener nofollow' } : {})}>
          {lm[1]}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className = '' }: { source: string; className?: string }) {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return (
    <div className={`prose prose-slate max-w-none ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim());
        if (!lines.length) return null;
        const h = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
        if (h && lines.length === 1) {
          const level = h[1].length;
          const Tag = (level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
          return <Tag key={bi}>{inline(h[2], `h${bi}`)}</Tag>;
        }
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return <ul key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ''), `u${bi}-${li}`)}</li>)}</ul>;
        }
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return <ol key={bi}>{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*\d+[.)]\s+/, ''), `o${bi}-${li}`)}</li>)}</ol>;
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, `p${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
