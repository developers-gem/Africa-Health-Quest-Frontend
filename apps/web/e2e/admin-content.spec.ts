import { expect, test, type Page } from "@playwright/test";
import { grantAdmin, login, registerAndVerify, setUpMfa } from "./support";

/** Administrator content tools against the real API (runs in its own browser session). */
// Serial user journeys share accounts in one database, so a retry would re-register the same people.
test.describe.configure({ mode: "serial", retries: 0 });
let admin: Page;
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("an administrator signs in with two-factor authentication", async ({ browser }) => {
  admin = await (await browser.newContext()).newPage();
  await registerAndVerify(admin, "olu.admin@e2e.test", "Olu Admin");
  grantAdmin("olu.admin@e2e.test");
  await login(admin, "olu.admin@e2e.test");
  await setUpMfa(admin);
  await expect(admin.getByRole("heading", { name: "Admin overview" })).toBeVisible();
});

test("authors a new mission, saves the draft and submits it for clinician review", async () => {
  await admin.goto("/admin/missions");
  await admin.getByRole("link", { name: "New mission" }).click();
  await admin.getByLabel("Key").fill("persistent-cough");
  await admin.getByLabel("Icon (emoji)").fill("😷");
  await admin.getByLabel("Topics").fill("tuberculosis, respiratory");
  await admin.getByLabel("Title").fill("A Cough That Won't Go Away");
  await admin.getByLabel("Country", { exact: true }).click();
  await admin.getByRole("option", { name: /Kenya/ }).click();
  await admin
    .getByLabel("Patient story")
    .fill(
      "Baraka, 34, has coughed for five weeks and lost weight. He comes to your clinic in Kisumu.",
    );
  await admin.getByLabel("Question").fill("What do you do first?");
  const choices = [
    ["Request sputum testing for TB", "Correct: a cough over two weeks needs TB testing."],
    ["Give cough syrup and send home", "This misses a likely TB diagnosis."],
    ["Start TB treatment immediately", "Confirm the diagnosis before starting treatment."],
  ];
  for (const [i, [text, feedback]] of choices.entries()) {
    await admin.getByLabel(`Step 1 choice ${i + 1} text`).fill(text!);
    await admin.getByLabel(`Step 1 choice ${i + 1} feedback`).fill(feedback!);
  }
  await admin.getByRole("button", { name: "Create draft" }).click();
  await expect(admin.getByText("Draft created")).toBeVisible();
  await expect(
    admin.getByRole("heading", { name: /A Cough That Won't Go Away — v1/ }),
  ).toBeVisible();

  // Edit and save the draft (optimistic concurrency), then submit it — content is frozen and hashed.
  await admin
    .getByLabel("Step 1 choice 2 feedback")
    .fill("Cough syrup misses a likely TB diagnosis.");
  await admin.getByRole("button", { name: "Save draft" }).click();
  await expect(admin.getByText("Draft saved")).toBeVisible();
  await admin.getByRole("button", { name: "Submit for review" }).click();
  await admin.getByLabel("Change summary for the reviewer").fill("New TB case for Kenya");
  await admin.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(admin.getByText("Sent to clinician review")).toBeVisible();
  await expect(admin.getByText(/can't be edited/)).toBeVisible();

  await admin.goto("/admin/publishing");
  await expect(admin.getByRole("row", { name: /A Cough That Won't Go Away/ })).toBeVisible();
  // Not visible to players until a clinician approves it.
  const res = await admin.request.get("http://localhost:4000/api/v1/missions/persistent-cough");
  expect(res.status()).toBe(404);
});

test("edits a country with an uploaded flag image and activates it", async () => {
  await admin.goto("/admin/countries");
  await admin.getByLabel("Search countries").fill("Rwanda");
  await admin
    .getByRole("row", { name: /Rwanda/ })
    .getByRole("link", { name: "Edit" })
    .click();
  await admin.getByLabel("Focus (one line)").fill("Community health workers and maternal care");
  await admin
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "flag.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(admin.locator("img").first()).toBeVisible();
  await admin.getByLabel("Status").click();
  await admin.getByRole("option", { name: "Active" }).click();
  await admin.getByLabel("Minimum HP").fill("400");
  await admin.getByRole("button", { name: "Save country" }).click();
  await expect(admin.getByText("Country saved")).toBeVisible();

  const res = await admin.request.get("http://localhost:4000/api/v1/countries/RW");
  const body = await res.json();
  expect(body).toMatchObject({
    status: "active",
    focus: "Community health workers and maternal care",
    unlock: { minHp: 400 },
  });
  expect(body.flagUrl).toMatch(/^\/media\//);
});

test("publishes a new version of a game setting with an audited change note", async () => {
  await admin.goto("/admin/configuration");
  await admin.getByLabel("Replay funding factor").fill("0.1");
  await admin.getByRole("button", { name: "Publish changes" }).click();
  await admin.getByLabel(/Change note/).fill("Small funding reward for replays");
  await admin.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(admin.getByText("Saved as version 2")).toBeVisible();
  await admin.getByText("Version history").click();
  await expect(admin.getByText(/Small funding reward for replays/).first()).toBeVisible();
});

test("adds an emergency event and an achievement", async () => {
  await admin.goto("/admin/configuration");
  await admin.getByRole("tab", { name: "Emergencies" }).click();
  await admin.getByRole("button", { name: "New emergency" }).click();
  await admin.getByLabel("Key").fill("dust_storm");
  await admin
    .getByLabel("Text shown to players")
    .fill("A dust storm brings many breathing emergencies!");
  await admin.getByRole("button", { name: "Save" }).click();
  await expect(admin.getByRole("cell", { name: /dust storm brings/ })).toBeVisible();

  await admin.getByRole("tab", { name: "Achievements" }).click();
  await admin.getByRole("button", { name: "New achievement" }).click();
  await admin.getByLabel("Key").fill("five_saves");
  await admin.getByLabel("Name").fill("Five lives saved");
  await admin.getByLabel("Description").fill("Pass five story cases");
  await admin.getByLabel("Threshold").fill("5");
  await admin.getByRole("button", { name: "Save" }).click();
  await expect(admin.getByText("Five lives saved")).toBeVisible();
});

test("finds users and opens the role catalogue-backed user page", async () => {
  await admin.goto("/admin/users");
  await admin.getByLabel("Search users").fill("olu");
  await admin
    .getByRole("row", { name: /olu.admin@e2e.test/ })
    .getByRole("link", { name: "Manage" })
    .click();
  await expect(
    admin.getByText("You can't change your own roles or suspend yourself."),
  ).toBeVisible();
  await expect(admin.getByRole("button", { name: "Change roles" })).toBeDisabled();
});

test("makes a mission available offline and sends an announcement", async () => {
  await admin.goto("/admin/missions/malaria");
  await expect(admin.getByText(/offline: not available/)).toBeVisible();
  await admin.getByRole("button", { name: "Edit" }).click();
  await admin.getByRole("checkbox", { name: "Available offline" }).check();
  await admin.getByRole("button", { name: "Save", exact: true }).click();
  await expect(admin.getByText(/offline: available/)).toBeVisible();

  await admin.getByRole("link", { name: "Announcements" }).click();
  await admin.getByLabel("Title").fill("New offline cases");
  await admin.getByLabel("Message").fill("Download cases to play without a connection.");
  await admin.getByLabel(/Open in the app/).fill("/play/story");
  await admin.getByRole("button", { name: "Send announcement" }).click();
  await admin.getByRole("button", { name: "Send", exact: true }).click();
  await expect(admin.getByText(/Delivered to \d+ inboxes/)).toBeVisible();
});
