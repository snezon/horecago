import { describe, it, expect } from "vitest";
import { resolveSignupTarget } from "@/lib/domain/signup";

describe("resolveSignupTarget", () => {
  it("нового работника ведёт на онбординг работника", () => {
    const target = resolveSignupTarget(
      { role: "WORKER", agencyId: null },
      true,
    );
    expect(target).toBe("/onboarding/worker");
  });

  it("новое агентство ведёт на онбординг агентства", () => {
    const target = resolveSignupTarget(
      { role: "AGENCY", agencyId: null },
      true,
    );
    expect(target).toBe("/onboarding/agency");
  });

  it("нового заказчика ведёт на онбординг заказчика", () => {
    const target = resolveSignupTarget({ role: "CLIENT", agencyId: null }, true);
    expect(target).toBe("/onboarding/hr");
  });

  it("работника по приглашению агентства ведёт на онбординг работника", () => {
    const target = resolveSignupTarget(
      { role: "WORKER", agencyId: "agency-1" },
      true,
    );
    expect(target).toBe("/onboarding/worker");
  });

  it("вернувшегося пользователя ведёт на главную", () => {
    const target = resolveSignupTarget(
      { role: "WORKER", agencyId: null },
      false,
    );
    expect(target).toBe("/");
  });

  it("ссылку без роли считает входом существующего пользователя", () => {
    const target = resolveSignupTarget({ role: null, agencyId: null }, false);
    expect(target).toBe("/");
  });
});
