/**
 * Shared print rules for receipts and statements.
 *
 * Injected per page rather than added globally so only documents meant to be
 * printed carry pagination rules. `.no-print` hides chrome; `.print-sheet`
 * becomes the page body; tables avoid breaking a row across pages, which is
 * what makes a printed statement readable.
 */
export const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
  .print-sheet {
    box-shadow: none !important;
    border: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    max-width: none !important;
  }
  main { padding: 0 !important; margin: 0 !important; }
  aside { display: none !important; }
  tr, .avoid-break { break-inside: avoid; page-break-inside: avoid; }
  thead { display: table-header-group; }
  a { text-decoration: none !important; color: inherit !important; }
  @page { margin: 14mm; }
}
`;
