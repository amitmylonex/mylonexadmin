# Catalog Review & Edit — reference UI alignment

Updated the supplier catalog Review & Edit screen against the supplied original-admin screenshot.

- The supplier-specific catalog page uses the sidebar-only layout, with Suppliers active and no extra desktop top header. Other admin pages retain their existing shell.
- The review sheet has 208px parameter columns, 136px minimum-height rows, alternating white/slate backgrounds, compact mapping dropdowns and aligned weight/width unit selectors.
- Existing compact search/filter/action toolbar and issue banner are retained. Validation highlights, traceability, proposed-default confirmation and row actions remain functional.
- Horizontal overflow stays in the sheet. Catalog grid tracks are constrained, and hidden image-upload inputs are excluded from full-width text-field styling.
- The mobile review cards, keyboard navigation and bounded 25-row rendering remain available.

Validation: full browser suite 41 passed; frontend production build and TypeScript lint passed. The dedicated reference-layout test also checks field/unit values, sidebar context, desktop row height, contained overflow and mobile adaptation. All data in screenshots is synthetic. No backend or database changes were made for this UI update.

Evidence: catalog-ui-browser-results.txt, catalog-ui-visual-results.txt, catalog-ui-build-results.txt, catalog-review-reference-desktop.png and catalog-review-reference-mobile.png.
