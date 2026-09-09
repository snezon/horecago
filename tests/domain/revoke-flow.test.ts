import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg } from "@/lib/domain/orgs";
import {
  activateRepresentation,
  revokeRepresentation,
  isRepresented,
  representingAgencies,
} from "@/lib/domain/representation";

describe("отзыв представительства", () => {
  beforeEach(resetDb);

  it("после отзыва работник больше не считается представленным", async () => {
    const worker = await prisma.user.create({
      data: { email: "w@example.com", role: "WORKER" },
    });
    await prisma.workerProfile.create({ data: { userId: worker.id } });
    const owner = await prisma.user.create({
      data: { email: "o@example.com", role: "AGENCY" },
    });
    const agency = await createOrg({
      type: "AGENCY", name: "Кадры", ownerUserId: owner.id,
    });
    await activateRepresentation(worker.id, agency.id);
    expect(await isRepresented(worker.id)).toBe(true);

    await revokeRepresentation(worker.id, agency.id);

    expect(await isRepresented(worker.id)).toBe(false);
    expect((await representingAgencies([worker.id])).get(worker.id) ?? []).toEqual([]);
    // История сохраняется: запись не удалена
    expect(await prisma.representation.count()).toBe(1);
  });
});
