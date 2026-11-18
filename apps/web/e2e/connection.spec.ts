import { expect, test } from "@playwright/test";

test("web app reaches the backend, database and authenticated API", async ({ page }) => {
  await page.goto("/status");
  await expect(page.getByTestId("api-status")).toContainText("online");
  await expect(page.getByTestId("db-status")).toHaveText("connected");
  await expect(page.getByTestId("session-status")).toHaveText("anonymous");

  await page.getByRole("button", { name: "Start a guest session" }).click();
  await expect(page.getByTestId("session-status")).toHaveText("Guest healer (guest)");
  await expect(page.getByTestId("user-id")).toHaveText(/^[a-f0-9]{24}$/);

  // The session survives a reload via the httpOnly refresh cookie (no token in storage).
  const userId = await page.getByTestId("user-id").textContent();
  await page.reload();
  await expect(page.getByTestId("user-id")).toHaveText(userId!);
  expect(
    await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage)),
  ).not.toMatch(/eyJ/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByTestId("session-status")).toHaveText("anonymous");
});
