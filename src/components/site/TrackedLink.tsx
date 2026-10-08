'use client';

import { track } from './track';

export function TrackedLink({ event, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { event: string }) {
  return (
    <a {...props} onClick={(e) => { track(event); props.onClick?.(e); }}>
      {children}
    </a>
  );
}
