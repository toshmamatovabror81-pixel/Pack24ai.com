import type { ReactNode } from 'react';

/**
 * Chop etiladigan A4 hujjat (hisob-faktura, shartnoma): oq varaq, brauzerning "Chop etish / PDF saqlash" tugmasi.
 * Sayt va admin layoutlaridan tashqarida, o'z uslublari bilan ishlaydi.
 */
export function PrintDoc({ title, children, backHref }: { title: string; children: ReactNode; backHref?: string }) {
  return (
    <div className="print-doc">
      <div className="print-toolbar">
        <span>{title}</span>
        <span className="print-toolbar-actions">
          {backHref && <a href={backHref}>← Orqaga</a>}
          <PrintButton />
        </span>
      </div>
      <article className="print-page">{children}</article>
      <style>{`
        .print-doc{min-height:100vh;background:#e5e7eb;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#111}
        .print-toolbar{max-width:800px;margin:0 auto 12px;display:flex;justify-content:space-between;align-items:center;font-size:14px;color:#334155}
        .print-toolbar-actions{display:flex;gap:12px;align-items:center}
        .print-toolbar a{color:#1d4ed8;text-decoration:none}
        .print-toolbar button{background:#102a45;color:#fff;border:0;border-radius:6px;padding:8px 14px;font-size:14px;cursor:pointer}
        .print-page{max-width:800px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 1px 4px rgba(0,0,0,.15);font-size:13px;line-height:1.5}
        .print-page h1{font-size:20px;margin:0 0 4px}
        .print-page h2{font-size:15px;margin:18px 0 6px}
        .print-page table{width:100%;border-collapse:collapse;margin:10px 0}
        .print-page th,.print-page td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
        .print-page th{background:#f1f5f9;font-weight:600}
        .print-page .num{text-align:right;white-space:nowrap}
        .print-page .muted{color:#64748b}
        .print-page .total{font-size:15px;font-weight:700}
        .print-page .sign{display:flex;justify-content:space-between;gap:24px;margin-top:36px}
        .print-page .sign div{flex:1}
        @media print{
          .print-doc{background:#fff;padding:0}
          .print-toolbar{display:none}
          .print-page{box-shadow:none;max-width:none;padding:0}
          @page{size:A4;margin:16mm}
        }
      `}</style>
    </div>
  );
}

function PrintButton() {
  // Server komponent ichida kichik inline skript: alohida client komponent talab qilmaydi
  return <button type="button" data-print="1">Chop etish / PDF</button>;
}

/** Hujjat sahifasi oxirida bir marta qo'shiladi: tugmani window.print ga ulaydi */
export function PrintScript() {
  return <script dangerouslySetInnerHTML={{ __html: "document.querySelectorAll('[data-print]').forEach(function(b){b.addEventListener('click',function(){window.print()})})" }} />;
}
