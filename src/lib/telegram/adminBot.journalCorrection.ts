/**
 * Tarixiy yo'l — endi `handlers/admin/journalCorrection.ts` da yashaydi.
 * Eski importlar uchun qisqa re-export (P1.1 audit).
 *
 * Domain logikasi `@/lib/domain/recycling/journalCorrections` da.
 */
export {
    JOURNAL_CORRECTION_REPLY_BUTTON,
    journalCorrectionSessions,
    correctionFilterDayKeyboard,
    correctionNewDateKeyboard,
    tryJournalCorrectionCallback,
    handleJournalCorrectionText,
} from './handlers/admin/journalCorrection';
export type { JournalCorrectionSession } from './handlers/admin/journalCorrection';
