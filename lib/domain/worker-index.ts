import { prisma } from "@/lib/db";
import { sanitizeMetroInput, stationKey } from "@/lib/domain/metro-input";

/**
 * Поисковый слой профиля: город и станции в нормализованном виде.
 *
 * Показываем мы то, что написал человек («Москва», «Китай-город»), а ищем по
 * ключам: SQLite не сравнивает кириллицу без учёта регистра, поэтому фильтр
 * «город = москва» в SQL иначе просто не работает. Ключи пишутся здесь и
 * только здесь — чтобы поиск и показ не разъехались.
 */
export function cityKeyOf(city: string | null | undefined): string | null {
  const key = (city ?? "").trim().toLowerCase().replace(/ё/g, "е");
  return key || null;
}

export function metroKeysOf(metro: string | null | undefined): {
  stationKey: string;
  name: string;
}[] {
  return sanitizeMetroInput(metro ?? "").map((name) => ({
    stationKey: stationKey(name),
    name,
  }));
}

/** Приводит поисковый слой профиля к тому, что сейчас в его полях. */
export async function reindexWorker(
  userId: string,
  city: string | null,
  metro: string | null,
): Promise<void> {
  const stations = metroKeysOf(metro);

  await prisma.workerProfile.update({
    where: { userId },
    data: { cityKey: cityKeyOf(city) },
  });
  await prisma.workerMetro.deleteMany({ where: { workerId: userId } });
  if (stations.length > 0) {
    await prisma.workerMetro.createMany({
      data: stations.map((s) => ({ workerId: userId, ...s })),
    });
  }
}
