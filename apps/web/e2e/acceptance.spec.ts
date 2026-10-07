/** ROADMAP §3.9 UI acceptance scenarios. Run against a production build: `pnpm build && pnpm e2e`. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const panelTitle = (page: Page) => page.locator("[data-panel]:visible h2");
const panel = (page: Page) => page.locator("[data-panel]:visible");

async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.getByRole("listbox")).toBeVisible();
}

function reagentIds(server: string): Set<string> {
  const file = join(__dirname, "../public/data", server, "reagents.json");
  return new Set(JSON.parse(readFileSync(file, "utf8")).reagents.map((r: { id: string }) => r.id));
}

test("1. search with the palette opens the panel", async ({ page }) => {
  await ready(page, "/upstream");
  await page.keyboard.press("Control+k");
  await page.keyboard.type("bica");
  await expect(page.getByRole("option").first()).toContainText("Bicaridine");
  await page.keyboard.press("Enter");
  await expect(panelTitle(page)).toHaveText("Bicaridine");
  await expect(page).toHaveURL(/open=reagent:Bicaridine/);
});

test("2. drilling into an ingredient stacks breadcrumbs; Back pops", async ({ page }) => {
  await ready(page, "/upstream?open=reagent:Bicaridine");
  await panel(page).getByRole("button", { name: "Inaprovaline" }).first().click();
  await expect(panelTitle(page)).toHaveText("Inaprovaline");
  const crumbs = page.getByRole("navigation", { name: "Panel history" });
  await expect(crumbs).toContainText("Bicaridine");
  await expect(crumbs).toContainText("Inaprovaline");
  await page.goBack();
  await expect(panelTitle(page)).toHaveText("Bicaridine");
});

test("3. the calculator matches the engine and survives a reload", async ({ page }) => {
  await ready(page, "/upstream?open=reagent:Bicaridine&tab=calc");
  await page.getByLabel("Make").fill("30");
  await expect(page).toHaveURL(/amt=30/);
  // 30u = 15 batches: 15 Inaprovaline (5 batches: 5 O, 5 C, 5 sugar) + 15 C.
  const list = panel(page).locator("table");
  await expect(list.locator("tr", { hasText: "Carbon" })).toContainText("20");
  await expect(list.locator("tr", { hasText: "Oxygen" })).toContainText("5");
  await expect(list.locator("tr", { hasText: "Sugar" })).toContainText("5");
  await page.reload();
  await expect(panel(page).locator("table tr", { hasText: "Carbon" })).toContainText("20");
});

test("4. pinning persists across reloads", async ({ page }) => {
  await ready(page, "/upstream?open=reagent:Bicaridine");
  await panelTitle(page).focus();
  await page.keyboard.press("p");
  const pinned = page.locator("section", { hasText: "Pinned" }).first();
  await expect(pinned.getByRole("button", { name: "Bicaridine", exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator("section", { hasText: "Pinned" })
      .first()
      .getByRole("button", { name: "Bicaridine", exact: true }),
  ).toBeVisible();
});

test("5. switching servers keeps the subject when it exists", async ({ page }) => {
  await ready(page, "/upstream?open=reagent:Bicaridine");
  await page.getByRole("button", { name: /^Server:/ }).click();
  await page.getByRole("menuitem", { name: /Starlight/ }).click();
  await expect(page).toHaveURL(/\/starlight\?open=reagent:Bicaridine/);
  await expect(panelTitle(page)).toHaveText("Bicaridine");

  const starlight = reagentIds("starlight");
  const upstreamOnly = [...reagentIds("upstream")].find((id) => !starlight.has(id));
  test.skip(!upstreamOnly, "every upstream reagent exists on Starlight");
  await ready(page, `/upstream?open=reagent:${upstreamOnly}`);
  await page.getByRole("button", { name: /^Server:/ }).click();
  await page.getByRole("menuitem", { name: /Starlight/ }).click();
  await expect(page).toHaveURL(/\/starlight$/);
  await expect(page.getByRole("status")).toContainText(`isn't on Starlight`);
  await expect(panel(page)).toHaveCount(0);
});

test("6. phones: full-width list, bottom sheet, drag down to close", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await ready(page, "/upstream");
  const box = await page.getByRole("listbox").boundingBox();
  expect(box!.width).toBeGreaterThan(360);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

  await page.getByRole("option").first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  const handle = sheet.locator(".cursor-grab");
  const h = (await handle.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + 250, { steps: 8 });
  await page.mouse.up();
  await expect(sheet).toHaveCount(0);
});

test("7. medicine + heat filter shows only heated reactions with an n / total count", async ({
  page,
}) => {
  await ready(page, "/upstream?cat=chemistry/medicine");
  const total = await page.getByRole("option").count();
  await page.getByRole("button", { name: "Heat", exact: true }).click();
  await expect(page).toHaveURL(/f=heat/);
  const rows = page.getByRole("option");
  const n = await rows.count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThanOrEqual(total);
  for (let i = 0; i < n; i++) await expect(rows.nth(i).locator("text=/needs ≥/")).toHaveCount(1);
  await expect(page.locator("h1 + span")).toHaveText(new RegExp(`^${n} / \\d+$`));
});

test("no-JS fallback: subject pages are server-rendered", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/upstream/reagent/Bicaridine");
  await expect(page.locator("article h1")).toHaveText("Bicaridine");
  await expect(page.locator("article")).toContainText("Inaprovaline");
  await context.close();
});
