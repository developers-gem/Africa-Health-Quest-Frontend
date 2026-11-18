import { expect, test, type Browser, type Page } from "@playwright/test";
import { grantAdmin, login, PASSWORD, registerAndVerify, setUpMfa } from "./support";

/**
 * The whole platform through the UI, as three different people:
 * an administrator, a clinician reviewer and a guest player.
 */
// Serial user journeys share accounts in one database, so a retry would re-register the same people.
test.describe.configure({ mode: "serial", retries: 0 });

let admin: Page;
let clinician: Page;
let player: Page;
const officialAnswers: string[] = [];

/** Optional visual-review screenshots (set SHOTS_DIR); full page at desktop and phone widths. */
async function shot(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (!dir) return;
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${name}-desktop.png`, fullPage: true });
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}/${name}-mobile.png`, fullPage: true });
  await page.setViewportSize(size);
}

async function newPage(browser: Browser) {
  const ctx = await browser.newContext();
  return ctx.newPage();
}
async function pick(page: Page, label: string, option: string) {
  await page.getByLabel(label).click();
  await page.getByRole("option", { name: option }).click();
}

test("an administrator bootstraps the platform and sets up two-factor authentication", async ({
  browser,
}) => {
  admin = await newPage(browser);
  await registerAndVerify(admin, "ada.admin@e2e.test", "Ada Admin");
  grantAdmin("ada.admin@e2e.test");
  await login(admin, "ada.admin@e2e.test");
  await expect(admin).toHaveURL(/\/admin$/);
  await setUpMfa(admin);
  await expect(admin.getByRole("heading", { name: "Admin overview" })).toBeVisible();
  await expect(admin.getByText("Awaiting clinician review")).toBeVisible();
  await shot(admin, "admin-overview");
});

test("players see no cases until a clinician approves one", async ({ browser }) => {
  player = await newPage(browser);
  await player.goto("/");
  await player.getByRole("button", { name: "Start playing — free" }).first().click();
  await expect(player).toHaveURL(/\/play$/);
  await expect(player.getByTestId("hp-pill")).toHaveText(/0/);
  await expect(player.getByTestId("funding-pill")).toHaveText(/₵100/);
  await shot(player, "player-dashboard");
  await player.getByRole("link", { name: /Story Mode/ }).click();
  await expect(player.getByText("No cases are published yet")).toBeVisible();
});

test("a clinician applies, is verified by the admin and given the reviewer role", async ({
  browser,
}) => {
  clinician = await newPage(browser);
  await registerAndVerify(clinician, "kwame.clinician@e2e.test", "Dr Kwame");
  await login(clinician, "kwame.clinician@e2e.test");
  await expect(clinician).toHaveURL(/\/play$/);
  await clinician.goto("/review/profile");
  await clinician.getByLabel("Full name (as registered)").fill("Dr Kwame Asante");
  await clinician.getByLabel("Credentials").fill("MBChB");
  await pick(clinician, "Profession", "Doctor");
  await pick(clinician, "Country of registration", "Ghana");
  await clinician.getByLabel("Registration body").fill("Medical and Dental Council of Ghana");
  await clinician.getByLabel("Registration number").fill("MDC/RN/12345");
  await clinician.getByRole("button", { name: "Submit application" }).click();
  await expect(clinician.getByText("Awaiting verification")).toBeVisible();

  // The clinician can't reach the review console yet.
  await clinician.goto("/review");
  await expect(clinician.getByText("You don't have access to this area")).toBeVisible();

  await admin.goto("/admin/clinicians");
  await admin
    .getByRole("row", { name: /Dr Kwame Asante/ })
    .getByRole("link", { name: "Open" })
    .click();
  await expect(admin.getByText("MDC/RN/12345")).toBeVisible(); // decrypted for verifiers only
  await admin.getByRole("button", { name: "Verify credentials" }).click();
  await admin.getByLabel("How did you verify it?").fill("Checked the MDC public register");
  await admin.getByRole("button", { name: "Verify", exact: true }).click();
  await expect(admin.getByText("Credentials verified")).toBeVisible();

  await admin.getByRole("link", { name: "Open user" }).click();
  await admin.getByRole("button", { name: "Change roles" }).click();
  await admin.getByRole("checkbox").nth(1).click(); // reviewer
  await admin.getByRole("button", { name: "Save roles" }).click();
  await expect(admin.getByText(/Roles updated/)).toBeVisible();
  await expect(admin.getByText("Roles: player, reviewer")).toBeVisible();
});

test("the reviewer adds a reference, inspects the case and approves it", async () => {
  // Role changes sign the user out everywhere; signing in again lands in the review console.
  await login(clinician, "kwame.clinician@e2e.test");
  await expect(clinician).toHaveURL(/\/review$/);
  await setUpMfa(clinician);
  await expect(clinician.getByRole("heading", { name: "Reviewer dashboard" })).toBeVisible();

  await clinician.getByRole("link", { name: "References" }).click();
  await clinician.getByRole("button", { name: "Add reference" }).click();
  await clinician.getByLabel("Title").fill("WHO Guidelines for malaria");
  await clinician.getByLabel(/Organisation/).fill("World Health Organization");
  await clinician.getByLabel(/^Year/).fill("2024");
  await clinician
    .getByLabel(/Link/)
    .fill("https://www.who.int/publications/i/item/guidelines-for-malaria");
  await clinician.getByRole("button", { name: "Save" }).click();
  await expect(clinician.getByText("Reference saved")).toBeVisible();

  await clinician.getByRole("link", { name: "Review queue" }).click();
  await clinician
    .getByRole("row", { name: /Fever in the Rainy Season/ })
    .getByRole("link", { name: "Open" })
    .click();
  await expect(clinician.getByText(/Mama Ngozi/)).toBeVisible();
  await clinician.getByRole("tab", { name: "2. Treatment" }).click();
  // The reviewer sees the official answers; remember them so the player can save the patient.
  const official = clinician.locator("div.border-success");
  await expect(official).toHaveCount(2);
  await shot(clinician, "review-treatment");
  for (const t of await official.locator("div.font-bold").allTextContents())
    officialAnswers.push(t.replace("Official answer", "").trim());

  const decision = clinician.getByTestId("decision-card");
  await expect(decision.getByRole("button", { name: "Approve and publish" })).toBeDisabled();
  for (const box of await decision.getByRole("checkbox").all()) await box.check();
  await decision.getByRole("button", { name: "Choose references" }).click();
  await clinician.getByRole("dialog").getByText("WHO Guidelines for malaria").click();
  await clinician.getByRole("button", { name: "Done" }).click();
  await decision.getByRole("button", { name: "Approve and publish" }).click();
  await expect(clinician.getByText("Approved and published")).toBeVisible();
});

test("the guest plays the approved case with reasoning, saves the patient and gets an AI debrief", async () => {
  expect(officialAnswers).toHaveLength(2);
  await player.goto("/play/story");
  await player.getByTestId("mission-malaria").click();
  await expect(player.getByText(/Approved by Dr Kwame Asante/)).toBeVisible();
  await player.getByRole("button", { name: "Start story case" }).click();
  await expect(player.getByTestId("case-story")).toContainText("Mama Ngozi");
  await shot(player, "gameplay-step1");

  await player
    .getByLabel(/Your clinical reasoning/)
    .fill("Fever in a malaria area — test before treating");
  await player.getByTestId("choice").filter({ hasText: officialAnswers[0]! }).click();
  await expect(player.getByTestId("answered-step").first()).toContainText("Correct");
  await shot(player, "gameplay-feedback");
  await player.getByRole("button", { name: "Next step →" }).click();
  await player.getByTestId("choice").filter({ hasText: officialAnswers[1]! }).click();

  await expect(player.getByText("Patient saved!")).toBeVisible();
  await expect(player.getByText("+50 Health Points")).toBeVisible();
  await expect(player.getByTestId("hp-pill")).toHaveText(/50/);
  await expect(player.getByTestId("funding-pill")).toHaveText(/₵125/);

  const panel = player.getByTestId("debrief-panel");
  await panel.getByLabel("Your level").click();
  await player.getByRole("option", { name: "Medical student" }).click();
  await panel.getByRole("button", { name: "Get debrief" }).click();
  await expect(player.getByText("Before your first debrief")).toBeVisible();
  await player.getByRole("button", { name: "I agree — get my debrief" }).click();
  const debrief = player.getByTestId("debrief");
  await expect(debrief).toContainText("[Test output — not generated by AI]");
  await expect(debrief).toContainText("Decision by decision");
  await expect(debrief).toContainText("WHO Guidelines for malaria"); // only approved references are cited
  await expect(debrief.getByTestId("ai-label")).toContainText("AI-generated educational feedback");
  await expect(debrief).toContainText(
    "does not replace teaching from qualified clinical instructors",
  );
  await expect(debrief).toContainText("Strengths");
  await shot(player, "gameplay-result-debrief");
});

test("the guest runs a Hospital Commander shift and sees it in their history", async () => {
  await player.goto("/play/commander");
  await player.getByRole("button", { name: "More Staff" }).click();
  await player.getByRole("button", { name: "More Staff" }).click();
  await expect(player.getByTestId("alloc-staff")).toHaveText("2");
  await player.getByRole("button", { name: /Start Shift \(₵20\)/ }).click();
  await expect(player.getByTestId("shift-result")).toBeVisible();
  await shot(player, "commander-result");
  await expect(player.getByText(/needs/).first()).toBeVisible();

  await player.goto("/play/history");
  await expect(player.getByTestId("history-item").first()).toContainText(
    "Fever in the Rainy Season",
  );
  await player.getByRole("tab", { name: "Rewards ledger" }).click();
  await expect(player.getByRole("cell", { name: "Mission Attempt" })).toBeVisible();
  await expect(player.getByRole("cell", { name: "Hospital Run" })).toBeVisible();
});

test("players cannot open staff areas", async () => {
  await player.goto("/admin");
  await expect(player.getByText("You don't have access to this area")).toBeVisible();
  await player.goto("/review");
  await expect(player.getByText("You don't have access to this area")).toBeVisible();
});

test("the guest saves their progress by creating an account", async () => {
  await player.goto("/register");
  await expect(player.getByRole("heading", { name: "Save your progress" })).toBeVisible();
  await player.getByLabel("Display name").fill("Amina");
  await player.getByLabel("Email").fill("amina.player@e2e.test");
  await player.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await player.getByLabel("Confirm password").fill(PASSWORD);
  await player.getByRole("button", { name: "Create account and keep progress" }).click();
  await expect(player.getByText(/Your progress is already saved/)).toBeVisible();
  await player.getByRole("link", { name: "Back to the game" }).click();
  await expect(player.getByTestId("hp-pill")).toHaveText(/\d/);
  await player.goto("/play/profile");
  await expect(player.getByRole("heading", { name: "Amina" })).toBeVisible();
});

test("the administrator sees the published mission, analytics, AI usage and the audit trail", async () => {
  await admin.goto("/admin/missions");
  await expect(admin.getByRole("row", { name: /Fever in the Rainy Season/ })).toContainText(
    "Published",
  );
  await admin.goto("/admin/analytics");
  await expect(admin.getByText("Pass rate by mission")).toBeVisible();
  await expect(admin.getByRole("listitem", { name: /malaria v1: 100%/ })).toBeVisible();
  await shot(admin, "admin-analytics");
  await admin.goto("/admin/ai");
  await expect(admin.getByText("Debrief generation")).toBeVisible();
  await expect(admin.getByText(/deterministic test provider/)).toBeVisible();
  await admin.goto("/admin/audit");
  await expect(admin.getByText("user.roles.update").first()).toBeVisible();
  await expect(admin.getByText("clinician.verified").first()).toBeVisible();
  await admin.goto("/admin/reports");
  const download = admin.waitForEvent("download");
  await admin.getByRole("button", { name: "Download CSV" }).first().click();
  expect((await download).suggestedFilename()).toMatch(/^ahq-mission-performance-30d-.*\.csv$/);
});
