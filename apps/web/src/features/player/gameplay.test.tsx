import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, mockApi, renderRoute, signIn } from "@/test/render";
import { AttemptPage } from "./gameplay";

afterEach(() => vi.unstubAllGlobals());

const step1 = {
  stepId: "s1",
  index: 0,
  prompt: "What is your first step?",
  choices: [
    { choiceId: "s1c2", text: "Give paracetamol" },
    { choiceId: "s1c1", text: "Do a malaria test" },
  ],
};
const step2 = {
  stepId: "s2",
  index: 1,
  prompt: "The test is positive. Next?",
  choices: [
    { choiceId: "s2c1", text: "Give ACT" },
    { choiceId: "s2c2", text: "Send home" },
  ],
};
const attempt = {
  id: "a1",
  missionKey: "malaria",
  title: "Fever in the Rainy Season",
  icon: "🦟",
  mode: "story",
  status: "in_progress",
  story: "Mama Ngozi carries her son into your clinic.",
  stepCount: 2,
  steps: [step1],
  currentStepIndex: 0,
  startedAt: "2026-11-04T08:00:00.000Z",
  completedAt: null,
  result: null,
};
const reveal = (stepId: string, choiceId: string, feedback: string) => ({
  choiceId,
  correct: true,
  correctChoiceId: choiceId,
  feedback,
  critical: false,
  reasoning: null,
  answeredAt: "2026-11-04T08:01:00.000Z",
});
const progress = {
  hp: 50,
  funding: 125,
  tier: { index: 0, key: "village_clinic", name: "Village Clinic", icon: "🛖", hpRequired: 0 },
  nextTier: null,
  hpToNextTier: null,
  unlockedCountryCodes: ["NG"],
  missions: {},
  achievements: [],
  stats: {},
  version: 3,
  updatedAt: "",
};

function api() {
  return mockApi({
    "GET /api/v1/attempts/a1": () => json(200, attempt),
    "POST /api/v1/attempts/a1/answers": (body) => {
      const b = body as { stepId: string; choiceId: string };
      if (b.stepId === "s1")
        return json(200, {
          step: { ...step1, answer: reveal("s1", b.choiceId, "Test before treating.") },
          next: step2,
          result: null,
        });
      return json(200, {
        step: { ...step2, answer: reveal("s2", b.choiceId, "ACT is first-line.") },
        next: null,
        result: {
          score: 50,
          maxScore: 50,
          correctCount: 2,
          passed: true,
          criticalError: false,
          firstPass: true,
          rewards: { hp: 50, funding: 25 },
          progress,
          newlyUnlocked: { tiers: [], countries: [] },
          achievements: [],
          verification: {
            reviewerName: "Dr Kwame Asante",
            credentials: "MBChB",
            approvedAt: "",
            references: [],
          },
        },
      });
    },
    "GET /api/v1/ai/status": () =>
      json(200, { enabled: true, consentRequired: true, limit: 10, used: 0, resetsAt: "" }),
    "GET /api/v1/players/me/profile": () =>
      json(200, {
        learnerLevel: "medical_student",
        institution: null,
        homeCountryCode: null,
        locale: "en",
        notificationPrefs: { push: true, email: false },
        onboardingCompletedAt: null,
        updatedAt: "x",
      }),
    "GET /api/v1/attempts/a1/debriefs": () => json(200, { items: [] }),
    "GET /api/v1/players/me/progress": () => json(200, progress),
  });
}

describe("clinical gameplay", () => {
  it("plays step by step with reasoning, reveals feedback only after answering, and shows the result", async () => {
    signIn();
    const { calls } = api();
    renderRoute(<AttemptPage />, { path: "/play/attempts/:id", url: "/play/attempts/a1" });

    expect(await screen.findByText(/Step 1\/2: What is your first step\?/)).toBeInTheDocument();
    expect(screen.queryByText("Test before treating.")).not.toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText(/Your clinical reasoning/),
      "Fever in a malaria area",
    );
    await userEvent.click(screen.getByRole("button", { name: "Do a malaria test" }));

    expect(await screen.findByText("Test before treating.")).toBeInTheDocument();
    const answerCall = calls.find((c) => c.method === "POST")!;
    expect(answerCall.body).toEqual({
      stepId: "s1",
      choiceId: "s1c1",
      reasoning: "Fever in a malaria area",
    });
    // Choices for the next step only appear after "Next step".
    expect(screen.queryByRole("button", { name: "Give ACT" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Next step →" }));
    await userEvent.click(await screen.findByRole("button", { name: "Give ACT" }));

    expect(await screen.findByText("Patient saved!")).toBeInTheDocument();
    expect(screen.getByText("+50 Health Points")).toBeInTheDocument();
    expect(screen.getByText(/Case approved by Dr Kwame Asante/)).toBeInTheDocument();
    expect(screen.getByTestId("debrief-panel")).toBeInTheDocument();
  });

  it("asks for AI consent before the first debrief", async () => {
    signIn();
    api();
    renderRoute(<AttemptPage />, { path: "/play/attempts/:id", url: "/play/attempts/a1" });
    await userEvent.click(await screen.findByRole("button", { name: "Do a malaria test" }));
    await userEvent.click(await screen.findByRole("button", { name: "Next step →" }));
    await userEvent.click(await screen.findByRole("button", { name: "Give ACT" }));
    const btn = await screen.findByRole("button", { name: /Get debrief/ });
    await waitFor(() => expect(btn).toBeEnabled()); // level comes from the profile
    await userEvent.click(btn);
    expect(await screen.findByText("Before your first debrief")).toBeInTheDocument();
    expect(screen.getByText(/never your name, email or account details/)).toBeInTheDocument();
  });
});
