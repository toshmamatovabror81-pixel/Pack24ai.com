'use client';

import { useFormStatus } from 'react-dom';

/** Forma yuborilayotganda tugmani bloklaydi (telefonda ikki marta bosishdan saqlaydi) */
export function SubmitButton({ children, className = 'btn-primary w-full', pendingText = '…', name, value }: { children: React.ReactNode; className?: string; pendingText?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}
