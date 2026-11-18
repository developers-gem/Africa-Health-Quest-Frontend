import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, mockApi, renderRoute, signIn } from "@/test/render";
import { CommanderPage } from "./pages";

afterEach(() => vi.unstubAllGlobals());

const state = {
  budget: 30,
  hospitalLevel: { index: 0, key: "v", name: "Village Clinic", icon: "🛖", hpRequired: 0 },
  unitCost: 10,
  maxUnitsPerResource: 10,
  maxAffordableUnits: 3,
  resources: [
    { key: "staff", name: "Staff", icon: "👩🏾‍⚕️" },
    { key: "beds", name: "Beds", icon: "🛏️" },
    { key: "ambulances", name: "Ambulances", icon: "🚑" },
    { key: "supplies", name: "Supplies", icon: "💊" },
  ],
  rewardsPerNeedMet: { hp: 15, funding: 8 },
  recent: { shifts: 0, averageNeedsMet: null, averageEfficiencyPercent: null },
};

describe("Hospital Commander", () => {
  it("never lets the allocation exceed the budget and sends it to the server", async () => {
    signIn();
    const { calls } = mockApi({
      "GET /api/v1/hospital/state": () => json(200, state),
      "GET /api/v1/hospital/runs": () => json(200, { items: [], page: 1, pageSize: 5, total: 0 }),
      "POST /api/v1/hospital/runs": () =>
        json(201, {
          id: "r1",
          allocation: { staff: 2, beds: 1, ambulances: 0, supplies: 0 },
          cost: 30,
          event: {
            key: "rush",
            text: "Maternity rush!",
            needs: { staff: 2, beds: 1, ambulances: 0, supplies: 1 },
          },
          needsMet: 3,
          outcomes: [],
          performance: {
            coveragePercent: 75,
            efficiencyPercent: 100,
            wastedUnits: 0,
            rating: "good",
          },
          rewards: { hp: 45, funding: 24 },
          netFundingChange: -6,
          summary: "Maternity rush! You covered 3/4 needs. +45 HP.",
          createdAt: "",
          progress: {},
          achievements: [],
        }),
    });
    renderRoute(<CommanderPage />);
    const moreStaff = await screen.findByRole("button", { name: "More Staff" });
    const start = screen.getByRole("button", { name: /Start Shift/ });
    expect(start).toBeDisabled();
    await userEvent.click(moreStaff);
    await userEvent.click(moreStaff);
    await userEvent.click(screen.getByRole("button", { name: "More Beds" }));
    expect(screen.getByRole("button", { name: /Start Shift \(₵30\)/ })).toBeEnabled();
    expect(moreStaff).toBeDisabled(); // a 4th unit would cost ₵40 > budget
    await userEvent.click(screen.getByRole("button", { name: /Start Shift/ }));
    expect(await screen.findByText(/You covered 3\/4 needs/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")!.body).toEqual({
      allocation: { staff: 2, beds: 1, ambulances: 0, supplies: 0 },
    });
  });
});
