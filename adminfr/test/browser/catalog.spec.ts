function templateWorkbook() {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Fabric Name", "Weave", "GSM"], ["Cotton", "plain", 180]]), "Catalog");
  return book;
}
import { test, expect, type Page } from "@playwright/test";
import * as XLSX from "xlsx";
import { seedAdminSession } from "./admin-session";
const id = "11111111-1111-4111-8111-111111111111";
const weave = "Novel Ottoman 2/1";
async function catalogApi(page: Page) {
  await seedAdminSession(page);
  const posts: Array<{ path: string; method: string; body: any }> = [];
  let counter = 41;
  const entries: any[] = [{ id: "22222222-2222-4222-8222-222222222222", fabricName: "Existing", weaveType: weave, gsm: 210, isActive: true, mylonexCode: "MYLO0041", minimumOrderQuantity: 1000, pricePerMeter: 145 }];
  const supplier = { id, companyName: "Catalog Test Mill", status: "APPROVED", city: "Surat", fulfillmentRegions: [], phone: null, whatsappConsent: false, createdAt: "2026-11-01T00:00:00Z",
    user: { email: "supplier@example.invalid", fullName: "Contact", createdAt: "2026-11-01T00:00:00Z" }, _count: { supplierCatalogEntries: entries.length, wovenProducts: 0, fabricCollections: 0, capabilities: 0, communicationRequestMatches: 0 } };
  await page.route("http://127.0.0.1:4184/**", route => route.fulfill({ json: {} }));
  await page.route("http://127.0.0.1:4183/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const send = (body: any, status = 200) => route.fulfill({ status, headers: { "access-control-allow-origin": "*" }, json: { success: true, ...body } });
    if (path.endsWith("/auth/me")) return send({ user: { id: "admin", role: "ADMIN", email: "admin@example.invalid" } });
    if (path.endsWith("/excel-template")) return route.fulfill({ contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", body: XLSX.write(templateWorkbook(), { type: "buffer", bookType: "xlsx" }), headers: { "access-control-allow-origin": "*" } });
    if (request.method() !== "GET") {
      const body = request.postDataJSON(); posts.push({ path, method: request.method(), body });
      if (path.endsWith("/excel-import")) {
        // Browser tests exercise the API contract, while persistence/math are tested in adminbr.
        const row = body.rows[0];
        entries.push({ ...row, id: "33333333-3333-4333-8333-333333333333", mylonexCode: `MYLO${String(++counter).padStart(4,"0")}`, isActive: true });
        const identity = (index: number) => ({ rowNumber: body.rows[index].sourceRowNumber, fabricName: body.rows[index].fabricName });
        return send({ createdCount: 1, importedCount: 1, skippedCount: 1, failedCount: 1, totalRows: 3,
          skipped: [{ ...identity(1), reason: "Duplicate fabric (already exists in active supplier catalog)" }],
          failures: [{ ...identity(2), reason: "Could not save this row. Retry or contact support." }] });
      }
      if (path.includes("/products/")) { entries[0].isActive = body.isActive; return send({ item: entries[0] }); }
      return send({ item: { id: "44444444-4444-4444-8444-444444444444" } }, 201);
    }
    if (path.endsWith("/catalog")) return send({ supplier, fabricCollections: [], catalogEntries: entries, wovenProducts: [], capabilities: [], totalPages: 1 });
    if (path === `/api/v1/admin/suppliers/${id}`) return send({ supplier });
    return send({ items: [], totalPages: 1 });
  });
  return { posts, entries };
}
async function openImporter(page: Page) {
  await page.goto(`/admin/suppliers/${id}/catalog`);
  // Opening is lazy until the importer comes near the viewport.
  const launch = page.getByRole("button", { name: "Open importer", exact: true });
  if (await launch.count()) await launch.click();
  const title = page.getByRole("heading", { name: "Import Fabrics from Excel", exact: true });
  await title.scrollIntoViewIfNeeded();
  const section = title.locator("..");
  return section.locator("..", { has: page.getByRole("button", { name: "1. Upload", exact: true }) });
}
function workbookFile() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Empty");
  const headers = ["Fabric Name", "Composition", "GLM", "Width (cm)", "Warp", "Weft", "Construction", "Weave", "Price", "Sample Availability", "Color"];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Supplier workbook"], headers,
    ...["", "Existing", "Failure"].map(name => [name, "100% Cotton", 310, 147.32, "40s", "30s", "96 x 72", weave, 145, "Available", "Blue"])]), "Catalog");
  return { name: "supplier.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) };
}
test("official template downloads through authenticated API as XLSX", async ({ page }) => {
  await catalogApi(page); const importer = await openImporter(page);
  const download = page.waitForEvent("download");
  await importer.getByRole("button", { name: "Download official template (.xlsx)" }).click();
  expect((await download).suggestedFilename()).toBe("mylonex_supplier_catalog_template.xlsx");
});
test("workbook mapping, defaults and import show created/skipped/failure results without losing the wizard", async ({ page }) => {
  const { posts, entries } = await catalogApi(page); const importer = await openImporter(page);
  await importer.locator('input[type="file"]').setInputFiles(workbookFile());
  await expect(importer.getByRole("combobox", { name: "Worksheet", exact: true })).toHaveValue("Catalog");
  await expect(importer.getByRole("combobox", { name: "Header row", exact: true })).toHaveValue("1");
  await importer.getByRole("combobox", { name: "Fabric Name source column", exact: true }).selectOption("10");
  await expect(importer.getByRole("alert")).toContainText("Color/Shade columns cannot be mapped");
  await importer.getByRole("combobox", { name: "Fabric Name source column", exact: true }).selectOption("0");
  await importer.getByRole("button", { name: "Continue to Edit & Review Data" }).click();
  await importer.getByText("Review proposed defaults", { exact: true }).click();
  await importer.getByRole("button", { name: "Confirm listed defaults for all rows" }).click();
  const grid = importer.getByRole("table", { name: "Editable fabric catalog" });
  await expect(grid.getByRole("textbox", { name: "weaveType", exact: true }).first()).toHaveValue(weave);
  await expect(grid.getByText("Catalog · Excel row 3", { exact: true })).toBeVisible();
  await grid.scrollIntoViewIfNeeded();
  await grid.screenshot({ path: "docs/screenshots/phase3-review-grid.png", animations: "disabled" });
  await importer.getByRole("button", { name: /^Buyer Preview/ }).click();
  await expect(importer.getByText("Blank (allowed)", { exact: false })).toBeVisible();
  await importer.getByRole("button", { name: "Review publish", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Confirm catalog publish" });
  await dialog.getByRole("button", { name: "Publish catalog", exact: true }).click();
  const results = page.getByRole("dialog", { name: "Import results", exact: true });
  await expect(results.getByText("1 fabrics created successfully", { exact: true })).toBeVisible();
  await expect(results.getByText("1 skipped as duplicates · 1 failed", { exact: true })).toBeVisible();
  await expect(results.getByText(/Row 5:.*Failure/)).toBeVisible();
  await expect(results.getByText(/Row 4:.*Existing/)).toBeVisible();
  await results.screenshot({ path: "docs/screenshots/phase3-import-results.png", animations: "disabled" });
  const payload = posts.find(post => post.path.endsWith("/excel-import"))!.body;
  expect(payload.rows[0].fabricName).toBe(""); expect(payload.rows[0].sourceRowNumber).toBe(3);
  expect(Number(payload.rows[0].weightValue)).toBe(310);
  expect(payload.rows[0].weightUnit).toBe("GLM");
  expect(Number(payload.rows[0].widthValue)).toBe(147.32);
  expect(payload.rows[0].widthUnit).toBe("cm");
  await results.getByRole("button", { name: "Done & Return to Catalog" }).click();
  await expect(page.getByText("MYLO0042", { exact: true }).first()).toBeVisible();
});
test("review edits recalculate GLM/OZ and preserve physical coordinates after row operations", async ({ page }) => {
  await catalogApi(page); const importer = await openImporter(page);
  await importer.locator('input[type="file"]').setInputFiles(workbookFile());
  await importer.getByRole("button", { name: "Continue to Edit & Review Data" }).click();
  await importer.getByText("Review proposed defaults", { exact: true }).click();
  await importer.getByRole("button", { name: "Confirm listed defaults for all rows" }).click();
  let grid = importer.getByRole("table", { name: "Editable fabric catalog" });
  await grid.getByRole("button", { name: "Remove row", exact: true }).first().click();
  await expect(grid.getByText("Catalog · Excel row 4", { exact: true })).toBeVisible();
  await grid.getByRole("button", { name: "Duplicate", exact: true }).first().click();
  await expect(grid.getByRole("textbox", { name: "fabricName", exact: true }).last()).toHaveValue("Existing (Copy)");
  await grid.getByRole("button", { name: "Remove row", exact: true }).last().click();
  await importer.getByRole("button", { name: "+ Row", exact: true }).click();
  await grid.getByRole("button", { name: "Remove row", exact: true }).last().click();
  await grid.getByRole("textbox", { name: "widthValue", exact: true }).first().fill("100");
  await grid.getByRole("textbox", { name: "widthValue", exact: true }).first().press("Enter");
  await expect(grid.getByRole("textbox", { name: "widthValue", exact: true }).nth(1)).toBeFocused();
  await importer.getByRole("button", { name: /^Buyer Preview/ }).click();
  await expect(importer.getByText("310 GSM", { exact: true })).toBeVisible();
  await importer.getByRole("button", { name: "Back to edit", exact: true }).click();
  grid = importer.getByRole("table", { name: "Editable fabric catalog" });
  await grid.getByRole("combobox", { name: "Weight unit", exact: true }).first().selectOption("OZ");
  await grid.getByRole("textbox", { name: "weightValue", exact: true }).first().fill("6");
  await importer.getByRole("button", { name: /^Buyer Preview/ }).click();
  await expect(importer.getByText("203 GSM", { exact: true })).toBeVisible();
  await expect(importer.getByText("Catalog · Excel row 4", { exact: true })).toBeVisible();
});
test("manual quick-add and listing publication use their canonical API routes", async ({ page }) => {
  const { posts } = await catalogApi(page); await page.goto(`/admin/suppliers/${id}/catalog`);
  const form = page.getByRole("region", { name: "Create Quick-add fabric", exact: true });
  await form.getByLabel("Fabric name", { exact: false }).fill("Manual Custom Fabric");
  await form.getByLabel("Weave", { exact: false }).fill("Novel custom weave");
  await form.getByLabel("MOQ", { exact: false }).fill("1000");
  await form.getByLabel("Lead time", { exact: false }).fill("21");
  await form.getByLabel("Base price / m", { exact: false }).fill("145");
  await form.getByRole("button", { name: "Publish fabric", exact: true }).click();
  await expect(form.getByRole("status")).toContainText("published");
  expect(posts.find(post => post.path.endsWith("/quick-add"))!.body.weaveType).toBe("Novel custom weave");
  await page.getByRole("button", { name: "Deactivate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Activate", exact: true })).toBeVisible();
  expect(posts.find(post => post.path.includes("/products/"))!.method).toBe("PATCH");
});

test("woven editor submits commercial values and all four technical specifications", async ({ page }) => {
  const { posts } = await catalogApi(page); await page.goto(`/admin/suppliers/${id}/catalog`);
  const form = page.getByRole("region", { name: "Create Woven listing", exact: true });
  await form.getByLabel("Composition", { exact: false }).fill("100% Cotton");
  await form.getByLabel("GSM", { exact: false }).fill("180");
  await form.getByLabel("Width (in)", { exact: false }).fill("58");
  await form.getByLabel("Price INR/m", { exact: false }).fill("145");
  await form.getByLabel("MOQ (m)", { exact: false }).fill("1000");
  await form.getByLabel("Lead Time", { exact: false }).fill("21");
  await form.getByLabel("Warp Count / Ply", { exact: false }).fill("2/60s");
  await form.getByLabel("Weft Count / Ply", { exact: false }).fill("40s");
  await form.getByLabel("EPI", { exact: true }).fill("132");
  await form.getByLabel("PPI", { exact: true }).fill("72");
  await form.getByRole("button", { name: "Create Woven Listing", exact: true }).click();
  await expect(form.getByRole("status")).toContainText("created");
  const saved = posts.find(post => post.path.endsWith("/manage/woven"))!.body;
  expect(saved.specs).toHaveLength(4); expect(saved.specs.find((spec: any) => spec.specKey === "epi").valueNum).toBe(132);
});

test("upload rejects unsupported/oversize files and accepts legacy XLS and CSV", async ({ page }) => {
  await catalogApi(page); const importer = await openImporter(page);
  const input = importer.locator('input[type="file"]');
  await input.setInputFiles({ name: "wrong.pdf", mimeType: "application/pdf", buffer: Buffer.from("wrong") });
  await expect(importer.getByRole("alert")).toContainText("valid spreadsheet");
  await input.setInputFiles({ name: "oversize.csv", mimeType: "text/csv", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(importer.getByRole("alert")).toContainText("10MB limit");
  const workbook = XLSX.read(workbookFile().buffer, { type: "buffer" });
  await input.setInputFiles({ name: "legacy.xls", mimeType: "application/vnd.ms-excel", buffer: XLSX.write(workbook, { type: "buffer", bookType: "biff8" }) });
  await expect(importer.getByRole("combobox", { name: "Worksheet", exact: true })).toHaveValue("Catalog");
  await importer.getByRole("button", { name: "Upload Different File", exact: true }).click();
  await importer.locator('input[type="file"]').setInputFiles({ name: "supplier.csv", mimeType: "text/csv", buffer: Buffer.from(XLSX.utils.sheet_to_csv(workbook.Sheets.Catalog)) });
  await expect(importer.getByRole("button", { name: "Continue to Edit & Review Data" })).toBeVisible();
});

test("review bounds rendered rows and rejects oversized batches before editing", async ({ page }) => {
  await catalogApi(page); const importer = await openImporter(page);
  const headers = "Fabric Name,Composition,GSM,Width (inches),Construction,Weave,Price,Sample Availability";
  const csv = (count: number) => Buffer.from([headers, ...Array.from({ length: count }, (_, index) => `Row ${index + 1},100% Cotton,180,58,96x72,Novel weave,145,Available`)].join("\n"));
  await importer.locator('input[type="file"]').setInputFiles({ name: "too-many.csv", mimeType: "text/csv", buffer: csv(501) });
  await expect(importer.getByRole("alert")).toContainText("more than 500 data rows");
  await importer.locator('input[type="file"]').setInputFiles({ name: "bounded.csv", mimeType: "text/csv", buffer: csv(26) });
  await importer.getByRole("button", { name: "Continue to Edit & Review Data" }).click();
  const grid = importer.getByRole("table", { name: "Editable fabric catalog" });
  await expect(grid.getByRole("textbox", { name: "fabricName", exact: true })).toHaveCount(25);
  await importer.getByRole("button", { name: "Next rows", exact: true }).click();
  await expect(grid.getByRole("textbox", { name: "fabricName", exact: true })).toHaveCount(1);
  await grid.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(grid.getByRole("textbox", { name: "fabricName", exact: true }).last()).toHaveValue("Row 26 (Copy)");
  await importer.getByRole("button", { name: "+ Row", exact: true }).click();
  await expect(grid.getByRole("textbox", { name: "fabricName", exact: true })).toHaveCount(3);
  await expect(grid.getByText("Sheet1 · Excel row 27", { exact: true })).toBeVisible();
});

test("review grid follows the original admin spreadsheet layout and keeps overflow inside the table", async ({page}) => {
  await catalogApi(page);await page.setViewportSize({width:1600,height:900});const importer=await openImporter(page);
  const workbook=XLSX.utils.book_new();XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([
    ["fabric_name","composition_text","gsm","width_inches","weave_type","price","sample_availability","construction"],
    ...["colourless bamboo","filla bamboo","gold bamboo","tornado","silver bamboo","soft bamboo","summer bamboo"].map((name,index)=>[name,["70% poly - 30% bamboo","55% poly - 45% bamboo","45% poly - 55% bamboo","60% poly - 40% bamboo"][index%4],[126,118,129,110][index%4],58,"",145,"Available","96 x 72"])
  ]),"Catalog");
  await importer.locator('input[type="file"]').setInputFiles({name:"bamboo-catalog.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:XLSX.write(workbook,{type:"buffer",bookType:"xlsx"})});
  await importer.getByRole("button",{name:"Continue to Edit & Review Data"}).click();
  const defaults=importer.getByText("Review proposed defaults",{exact:true});if(await defaults.count()){await defaults.click();await importer.getByRole("button",{name:"Confirm listed defaults for all rows"}).click();}
  const grid=importer.getByRole("table",{name:"Editable fabric catalog"});
  await expect(grid.getByRole("textbox",{name:"fabricName",exact:true}).first()).toHaveValue("colourless bamboo");
  await expect(grid.getByRole("combobox",{name:"Weight unit",exact:true}).first()).toHaveValue("GSM");
  await expect(grid.getByRole("combobox",{name:"Width unit",exact:true}).first()).toHaveValue("inches");
  await expect(page.getByRole("heading",{name:"Admin Management Console",exact:true})).toHaveCount(0);
  await expect(page.locator("#admin-sidebar").getByRole("link",{name:/^Suppliers/})).toHaveAttribute("aria-current","page");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  expect(await grid.evaluate(table=>table.scrollWidth>table.parentElement!.clientWidth)).toBe(true);
  expect(await grid.locator("tbody tr").first().evaluate(row=>row.getBoundingClientRect().height)).toBeGreaterThanOrEqual(136);
  await importer.locator(".catalog-review-toolbar").evaluate(el=>el.scrollIntoView({block:"start"}));
  await page.screenshot({path:"docs/screenshots/catalog-review-reference-desktop.png",animations:"disabled"});
  await page.setViewportSize({width:390,height:844});
  await expect(grid).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await importer.locator(".catalog-review-toolbar").scrollIntoViewIfNeeded();
  await page.screenshot({path:"docs/screenshots/catalog-review-reference-mobile.png",animations:"disabled"});
});
test("original catalog authoring layout stays within desktop and mobile viewports", async ({ page }) => {
  await catalogApi(page); await page.goto(`/admin/suppliers/${id}/catalog`);
  await expect(page.getByRole("heading", { name: "Create Quick-Add Fabric", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fabric specification", exact: true })).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/catalog-original-authoring-desktop.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/screenshots/catalog-original-authoring-mobile.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

 test("catalog import header precedes the remaining authoring forms", async ({ page }) => {
  await catalogApi(page); await page.goto(`/admin/suppliers/${id}/catalog`);
  const header = page.getByRole("heading", { name: "Import Fabrics from Excel", exact: true });
  const quickAdd = page.getByRole("heading", { name: "Create Quick-Add Fabric", exact: true });
  await expect(header).toBeVisible();
  const headerBox = await header.boundingBox(), formBox = await quickAdd.boundingBox();
  expect(headerBox!.y).toBeLessThan(formBox!.y);
 });
