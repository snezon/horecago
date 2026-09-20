import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { cityKeyOf, metroKeysOf, reindexWorker } from "@/lib/domain/worker-index";

describe("ключи поиска", () => {
  it("город сводится к нижнему регистру без ё", () => {
    expect(cityKeyOf(" Москва ")).toBe("москва");
    expect(cityKeyOf("Королёв")).toBe("королев");
    expect(cityKeyOf("   ")).toBeNull();
    expect(cityKeyOf(null)).toBeNull();
  });

  it("станции разбираются в пары ключ + как показывать", () => {
    expect(metroKeysOf("м. Щёлковская, Тверская")).toEqual([
      { stationKey: "щелковская", name: "Щёлковская" },
      { stationKey: "тверская", name: "Тверская" },
    ]);
  });
});

describe("reindexWorker", () => {
  beforeEach(resetDb);

  async function makeWorker(city: string | null, metro: string | null) {
    const user = await prisma.user.create({
      data: { email: "w@example.com", role: "WORKER" },
    });
    await prisma.workerProfile.create({
      data: { userId: user.id, city, metro },
    });
    return user.id;
  }

  it("раскладывает город и станции по поисковым полям", async () => {
    const id = await makeWorker("Москва", "Тверская, Курская");

    await reindexWorker(id, "Москва", "Тверская, Курская");

    const profile = await prisma.workerProfile.findUnique({ where: { userId: id } });
    expect(profile?.cityKey).toBe("москва");
    const stations = await prisma.workerMetro.findMany({ where: { workerId: id } });
    expect(stations.map((s) => s.stationKey).sort()).toEqual(["курская", "тверская"]);
  });

  it("повторный прогон не плодит станции и убирает лишние", async () => {
    const id = await makeWorker("Москва", "Тверская, Курская");
    await reindexWorker(id, "Москва", "Тверская, Курская");

    await reindexWorker(id, "Казань", "Авиастроительная");

    const profile = await prisma.workerProfile.findUnique({ where: { userId: id } });
    expect(profile?.cityKey).toBe("казань");
    const stations = await prisma.workerMetro.findMany({ where: { workerId: id } });
    expect(stations.map((s) => s.stationKey)).toEqual(["авиастроительная"]);
  });

  it("пустые значения оставляют профиль без ключей", async () => {
    const id = await makeWorker(null, null);

    await reindexWorker(id, null, null);

    const profile = await prisma.workerProfile.findUnique({ where: { userId: id } });
    expect(profile?.cityKey).toBeNull();
    expect(await prisma.workerMetro.count({ where: { workerId: id } })).toBe(0);
  });
});
