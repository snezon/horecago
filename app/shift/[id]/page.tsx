import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, MapPin, Users, Wallet, Building2, Phone, Mail,
  CheckCircle2, XCircle, Clock, Calendar,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { applyToShift } from "./actions";
import { shiftLabel, formatRub } from "@/lib/datetime";

export default async function ShiftPage({ params }: { params: { id: string } }) {
  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: { position: true, hr: { include: { hrProfile: true } } },
  });
  if (!shift) notFound();

  const user = await getCurrentUser();
  const myApp = user
    ? await prisma.application.findUnique({
        where: { shiftId_workerId: { shiftId: shift.id, workerId: user.id } },
      })
    : null;

  const slotsLeft = shift.headcount - shift.hiredCount;
  const isClosed = shift.status === "CLOSED";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/feed" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="w-4 h-4" /> К ленте
      </Link>

      <article className="card">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div className="flex flex-wrap gap-2">
            <span className="badge-neutral">{shift.position.name}</span>
            {isClosed ? (
              <span className="badge-muted">Смена закрыта</span>
            ) : (
              <span className="badge-warning">
                <Users className="w-3 h-3" />
                {slotsLeft} {slotsLeft === 1 ? "место" : "мест"}
              </span>
            )}
          </div>
        </div>

        <h1 className="text-3xl font-bold text-ink-900 leading-tight mb-2">{shift.title}</h1>
        <div className="flex items-center gap-2 text-ink-600 mb-6">
          <Building2 className="w-4 h-4 text-ink-400" />
          {shift.hr.hrProfile?.hotelName}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <InfoRow
            icon={<Calendar className="w-4 h-4 text-accent-500" />}
            label="Когда"
            value={shiftLabel(shift.shiftStart, shift.shiftEnd)}
            bold
          />
          <InfoRow
            icon={<Wallet className="w-4 h-4 text-accent-500" />}
            label="Оплата за смену"
            value={`${formatRub(shift.payment)} ₽${shift.paymentNote ? " " + shift.paymentNote : ""}`}
            bold
          />
          <InfoRow icon={<MapPin className="w-4 h-4 text-ink-400" />} label="Адрес" value={shift.address} />
        </div>

        <div className="border-t border-ink-200/70 pt-6">
          <h2 className="section-title mb-3">Описание</h2>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-ink-700 leading-relaxed">
            {shift.description}
          </div>
        </div>
      </article>

      {myApp ? (
        <ApplicationStatus app={myApp} shift={shift} isClosed={isClosed} />
      ) : !user ? (
        <Link href="/login?role=WORKER" className="btn-primary w-full !py-3.5 text-base">
          Войти и взять смену
        </Link>
      ) : user.role !== "WORKER" ? (
        <div className="card text-sm text-ink-500 text-center">
          Брать смены могут только соискатели
        </div>
      ) : isClosed ? (
        <div className="card text-sm text-ink-500 text-center">Смена закрыта</div>
      ) : (
        <form action={applyToShift}>
          <input type="hidden" name="shiftId" value={shift.id} />
          <button className="btn-accent w-full !py-3.5 text-base">Взять смену</button>
        </form>
      )}
    </div>
  );
}

function InfoRow({ icon, label, value, bold }: { icon: React.ReactNode; label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-ink-50/70">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="text-xs text-ink-500">{label}</div>
        <div className={`text-sm ${bold ? "font-semibold text-ink-900" : "text-ink-800"}`}>{value}</div>
      </div>
    </div>
  );
}

function ApplicationStatus({ app, shift, isClosed }: { app: { status: string }; shift: any; isClosed: boolean }) {
  if (app.status === "HIRED") {
    return (
      <div className="card border-emerald-200 bg-emerald-50/50">
        <div className="flex items-start gap-3">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500 text-white shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-emerald-900">Смена подтверждена!</div>
            <p className="text-sm text-emerald-800 mt-1">Свяжитесь с работодателем для деталей.</p>
            <ContactBlock hr={shift.hr} />
          </div>
        </div>
      </div>
    );
  }
  if (app.status === "REJECTED") {
    return (
      <div className="card text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-ink-100 text-ink-500 mb-2">
          <XCircle className="w-5 h-5" />
        </div>
        <p className="text-sm text-ink-600">Работодатель не подтвердил вашу заявку</p>
      </div>
    );
  }
  if (isClosed) {
    return (
      <div className="card text-center">
        <p className="text-sm text-ink-600">
          Смена закрыта — все места набраны. <Link href="/feed" className="text-ink-900 font-medium underline">Открыть ленту</Link>
        </p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-accent-100 text-accent-700 shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold">Заявка отправлена</div>
          <p className="text-sm text-ink-600 mt-1">Ждите подтверждения. Контакты для связи:</p>
          <ContactBlock hr={shift.hr} />
        </div>
      </div>
    </div>
  );
}

function ContactBlock({ hr }: { hr: { phone: string | null; email: string } }) {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-sm">
      {hr.phone && (
        <a href={`tel:${hr.phone}`} className="inline-flex items-center gap-1.5 text-ink-900 hover:text-ink-700">
          <Phone className="w-4 h-4 text-ink-400" /> {hr.phone}
        </a>
      )}
      <a href={`mailto:${hr.email}`} className="inline-flex items-center gap-1.5 text-ink-900 hover:text-ink-700">
        <Mail className="w-4 h-4 text-ink-400" /> {hr.email}
      </a>
    </div>
  );
}
