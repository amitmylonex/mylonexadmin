# Old catalog UI inspection

Inspected the signed-in Chrome page supplied by the user on 2026-11-18:
http://localhost:3000/admin/suppliers/5645ee52-c5f6-4d8f-bcec-2d81e22d6a39/catalog

The separate in-app browser redirected to sign-in, so the inspection used the existing signed-in Chrome window accessibility tree plus the supplied screenshots and original React/CSS source. Chrome reports 75% zoom; reference CSS dimensions were preserved rather than treating screenshot pixels as CSS pixels.

Observed hierarchy: Back to Supplier Catalog Control; ADMIN CONSOLE; Catalog Control: supplier name; supplier status. No overview tabs or moderation toolbar on the catalog page. Collection creation and buyer preview share the first row. Collection width uses minmax(320px,380px), not a percentage. Quick-add occupies the next full-width card, followed by import, then woven/capability cards side by side. Lists follow in Collections, Fabric Listings, Capabilities order.

Corrected frontend: catalog header matches this hierarchy; material/composition use two columns, construction/weave/GSM use three; fabric name and buyer notes span full width. Replaced previous miniature dimensions with reference label/input/section sizing: 13px labels, 15px field text, 44px inputs, 96px notes, 32px/28px section padding. Added unit suffixes and original placeholders, GSM 100 / width 58 initial preview values, and reference collection/preview borders, padding and radii. Capability controls continue to use the original option values and chip component. Existing backend contracts, validation and database files are unchanged.

Frontend TypeScript and Vite build passed. Native Chrome automation could inspect the old page but could not reliably activate the new tab because an overlapping desktop window intercepted the click and the subsequent raise reported changed window bounds. No save/upload/status controls were invoked. A final visual comparison of the updated authenticated page remains unverified; this report does not claim pixel-perfect parity.
