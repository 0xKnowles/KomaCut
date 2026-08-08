/**
 * Contrast stretch strength a converter starts on, 0 to disable.
 *
 * Every type now starts at the same strength, but the seam is kept because the
 * per-type default is exactly the kind of thing that diverges again.
 *
 * PDFs used to default to 0, on the assumption they were text documents whose
 * scans had already been processed and where a stretch only clips what is left.
 * That is the wrong bet for this tool: a large share of manga arrives as a PDF
 * of raw scans, which want the same treatment as the identical scans inside a
 * CBZ. Someone converting an actual text document turns it back down — the PDF
 * page says so — whereas the old default quietly under-processed every manga
 * PDF with no hint that a knob existed.
 */
export function getDefaultContrast(_fileType: string): number {
  return 4
}
