# Original admin catalog UI port

The standalone catalog now uses the original mylonex-nextjs catalog authoring components and catalog CSS, adapted for React/Vite and the authenticated Fastify API.

Included: collection creation, live buyer preview, quick-add specification/state/commercial/collection sections, shade editor and image uploads, publish checklist, woven technical form, capability product-line form, edit forms, and catalog listing cards. The four-step Excel wizard retains its existing validation, conversion math, row coordinates and bounded rendering.

The integration adapter translates the original UI requests to the standalone routes. Images use the authenticated JSON upload endpoint. Editing preserves collection identity, activation status and woven material family. Free-text weave remains supported. The reference Next.js project was not modified.

Validation: production frontend build, all 41 existing Playwright browser checks, and a new desktop/mobile authoring layout check. Screenshots: catalog-original-authoring-desktop.png and catalog-original-authoring-mobile.png.
