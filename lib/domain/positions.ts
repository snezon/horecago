import { prisma } from "@/lib/db";

export type MergeResult = {
  shifts: number;
  skills: number;
  duplicates: number;
};

/**
 * Убирает позицию из справочника, перенося всё, что на неё ссылается, на
 * другую. Просто удалить нельзя: на позиции висят смены и навыки работников,
 * и потерять их значило бы стереть историю и умения людей.
 *
 * Навык, который у работника уже есть, не дублируется — пара
 * (работник, позиция) уникальна.
 */
export async function mergePosition(
  fromId: number,
  intoId: number,
): Promise<MergeResult> {
  if (fromId === intoId) throw new Error("Позиция не может заменять саму себя");

  const shifts = await prisma.shift.updateMany({
    where: { positionId: fromId },
    data: { positionId: intoId },
  });

  const skills = await prisma.workerSkill.findMany({ where: { positionId: fromId } });
  const already = await prisma.workerSkill.findMany({
    where: { positionId: intoId, workerId: { in: skills.map((s) => s.workerId) } },
  });
  const alreadyIds = new Set(already.map((s) => s.workerId));

  const moved = skills.filter((s) => !alreadyIds.has(s.workerId));
  for (const skill of moved) {
    await prisma.workerSkill.update({
      where: { workerId_positionId: { workerId: skill.workerId, positionId: fromId } },
      data: { positionId: intoId },
    });
  }
  await prisma.workerSkill.deleteMany({ where: { positionId: fromId } });
  await prisma.position.delete({ where: { id: fromId } });

  return {
    shifts: shifts.count,
    skills: moved.length,
    duplicates: skills.length - moved.length,
  };
}
