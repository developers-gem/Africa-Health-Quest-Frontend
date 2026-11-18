import { expect, test } from "@playwright/test";

/** Runs in both the desktop and the mobile project: no horizontal scrolling, navigation reachable. */
const PUBLIC = [
  "/",
  "/about",
  "/how-to-play",
  "/learn",
  "/countries",
  "/countries/GH",
  "/login",
  "/register",
  "/forgot-password",
];
const PLAYER = [
  "/play",
  "/play/story",
  "/play/challenge",
  "/play/missions",
  "/play/commander",
  "/play/countries",
  "/play/profile",
  "/play/achievements",
  "/play/history",
  "/play/settings",
];

async function noHorizontalScroll(page: import("@playwright/test").Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll, "page must not scroll horizontally").toBeLessThanOrEqual(width);
}

test("public pages fit the screen", async ({ page }) => {
  for (const path of PUBLIC) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    await noHorizontalScroll(page);
  }
});

test("player screens fit the screen and the game navigation is reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start playing — free" }).first().click();
  await expect(page).toHaveURL(/\/play$/);
  for (const path of PLAYER) {
    await page.goto(path);
    await expect(page.locator("main h1").first()).toBeVisible();
    await noHorizontalScroll(page);
  }
  // Phones (< 768px) use a bottom tab bar; tablets and desktops show the links in the header.
  const phone = page.viewportSize()!.width < 768;
  const nav = page.getByRole("navigation", { name: "Game" }).filter({ visible: true });
  await expect(nav).toHaveCount(1);
  await nav.getByRole("link", { name: "Commander" }).click();
  await expect(page).toHaveURL(/\/play\/commander$/);
  if (phone) {
    const box = await nav.boundingBox();
    expect(box!.y + box!.height).toBeGreaterThan((page.viewportSize()!.height ?? 0) - 5);
  }
});

test("the public menu works on small screens", async ({ page }) => {
  test.skip(
    page.viewportSize()!.width >= 768,
    "phones only — tablets and desktops show the full header",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "How to play" }).click();
  await expect(page).toHaveURL(/how-to-play/);
});
