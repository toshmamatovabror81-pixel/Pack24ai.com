'use client';

/** Xavfli amal tugmasi: bosilganda tasdiq so'raydi (forma ichida ishlatiladi) */
export function ConfirmButton({ children, message, className = 'btn-ghost px-3 py-1.5 text-sm' }: { children: React.ReactNode; message: string; className?: string }) {
  return (
    <button type="submit" className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
