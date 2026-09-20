import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { appUrl } from "@/lib/app-url";
import { shiftLabel } from "@/lib/datetime";

/**
 * Письмо нанятому. Особенно важно при авто-найме: человека взяли на смену без
 * чьего-либо клика, и узнать об этом, случайно зайдя на сайт, он не должен.
 * Ошибка отправки найм не отменяет — почта чинится, смена нет.
 */
export async function notifyHired(applicationId: string): Promise<boolean> {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { shift: { include: { position: true } }, worker: true },
  });
  if (!application || application.status !== "HIRED") return false;

  const { shift, worker } = application;
  const when = shiftLabel(shift.shiftStart, shift.shiftEnd);
  const link = appUrl(`/shift/${shift.id}`).toString();
  const html = `
    <p>Здравствуйте!</p>
    <p>Вас взяли на смену «${shift.title}» (${shift.position.name}).</p>
    <p>Когда: ${when}<br>Где: ${shift.address}<br>Оплата: ${shift.payment} ₽ за смену</p>
    <p><a href="${link}">Открыть смену</a></p>
    <p>Если планы изменились — предупредите работодателя заранее, его контакты есть на странице смены.</p>
  `;
  const text = `Вас взяли на смену «${shift.title}». ${when}. ${shift.address}. ${link}`;

  const delivery = await sendEmail(worker.email, "Вас взяли на смену", html, text);
  return delivery.ok;
}
