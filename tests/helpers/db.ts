import { prisma } from "@/lib/db";

export { prisma };

export async function resetDb() {
  await prisma.application.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.document.deleteMany();
  await prisma.workerSkill.deleteMany();
  await prisma.workerProfile.deleteMany();
  await prisma.hRProfile.deleteMany();
  await prisma.session.deleteMany();
  await prisma.magicLink.deleteMany();
  await prisma.user.deleteMany();
  await prisma.position.deleteMany();
}
