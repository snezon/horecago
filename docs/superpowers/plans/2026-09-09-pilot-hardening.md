# Подготовка к пилоту: доверие, вход, целостность, эксплуатация

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть находки проверки готовности, из-за которых пилот с сетевым отелем
сорвался бы в первую неделю.

**Architecture:** Доменная логика в `lib/domain/*` (тестируется без Next), серверные
действия — тонкие обёртки. Приглашение агентства становится самостоятельной сущностью
`AgencyInvite`, а не состоянием внутри ссылки из письма. Права на просмотр документов
и запрет прямого найма агентских работников выражены доменными функциями, а не
проверками в разметке.

**Tech Stack:** Next.js 14 (app router, server actions), TypeScript, Prisma 5, SQLite,
Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-agency-marketplace-design.md` (разделы 2 и 5)

## Global Constraints

- Весь интерфейс и тексты писем — на русском.
- База SQLite, массивов нет: списки строкой с разделителем.
- Новых npm-зависимостей не добавлять вообще.
- `lib/domain/*` не импортируют `next/headers`, `next/navigation`, `lib/auth.ts`.
  Разрешены `@/lib/db`, `@/lib/auth-token`, соседние `lib/domain/*`.
- Работник не принадлежит агентству: поля `agencyId` в `WorkerProfile` нет и не будет.
- `User.role` для заказчиков остаётся `"HR"` — переименование это отдельная фаза.
- Прод: `prisma/dev.db` содержит демо-данные, не сбрасывать. При предложении Prisma
  сбросить базу — прервать и вернуть BLOCKED.
- Вёрстка в стиле существующих страниц, новых UI-подходов не приносить.
- Коммит-сообщения на русском.

## Продуктовые решения, принятые до плана

- Агентские работники **видны** заказчику в каталоге с пометкой «Представлен агентством
  «Название»», но кнопка прямого приглашения им недоступна.
- Срок жизни ссылки: приглашение агентства — **7 дней**, обычный вход — **60 минут**.
- Согласие на обработку ПД: черновик политики пишем сами, механику фиксации делаем.
- Sentry не подключаем (внешний сервис). Делаем страницу ошибки и логирование.

---

### Task 1: Право видеть документы работника

Сейчас файл отдаётся любому, кто просто вошёл. Паспорта и медкнижки доступны всем
заказчикам площадки.

**Files:**
- Create: `lib/domain/documents.ts`
- Create: `tests/domain/documents.test.ts`
- Modify: `app/uploads/[file]/route.ts`

**Interfaces:**
- Consumes: `prisma` из `@/lib/db`.
- Produces: `canViewDocumentUrl(viewerUserId: string, url: string): Promise<boolean>`

- [ ] **Step 1: Написать падающие тесты**

Создать `tests/domain/documents.test.ts`. Хелперы создают пользователей, профиль
работника, документ, смену и отклик.

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg } from "@/lib/domain/orgs";
import { activateRepresentation } from "@/lib/domain/representation";
import { canViewDocumentUrl } from "@/lib/domain/documents";

const URL = "/uploads/abc123.pdf";

async function makeWorkerWithDoc(email = "w@example.com") {
  const user = await prisma.user.create({ data: { email, role: "WORKER" } });
  await prisma.workerProfile.create({ data: { userId: user.id } });
  await prisma.document.create({
    data: { workerId: user.id, kind: "PASSPORT", filename: "p.pdf", url: URL },
  });
  return user;
}

async function makeHr(email: string) {
  return prisma.user.create({ data: { email, role: "HR" } });
}

async function makeShiftWithApplication(hrId: string, workerId: string) {
  const position = await prisma.position.create({ data: { name: `Позиция ${hrId}` } });
  const shift = await prisma.shift.create({
    data: {
      hrId, positionId: position.id, title: "Смена", description: "",
      payment: 3000, address: "Москва", headcount: 1,
      shiftStart: new Date("2026-10-01T08:00:00"),
      shiftEnd: new Date("2026-10-01T20:00:00"),
    },
  });
  await prisma.application.create({ data: { shiftId: shift.id, workerId } });
  return shift;
}

describe("canViewDocumentUrl", () => {
  beforeEach(resetDb);

  it("работник видит свой документ", async () => {
    const worker = await makeWorkerWithDoc();
    expect(await canViewDocumentUrl(worker.id, URL)).toBe(true);
  });

  it("заказчик видит документ кандидата, откликнувшегося на его смену", async () => {
    const worker = await makeWorkerWithDoc();
    const hr = await makeHr("hr@example.com");
    await makeShiftWithApplication(hr.id, worker.id);
    expect(await canViewDocumentUrl(hr.id, URL)).toBe(true);
  });

  it("посторонний заказчик документ не видит", async () => {
    const worker = await makeWorkerWithDoc();
    const hr = await makeHr("hr@example.com");
    await makeShiftWithApplication(hr.id, worker.id);
    const stranger = await makeHr("stranger@example.com");
    expect(await canViewDocumentUrl(stranger.id, URL)).toBe(false);
  });

  it("агентство видит документ своего представленного работника", async () => {
    const worker = await makeWorkerWithDoc();
    const owner = await prisma.user.create({
      data: { email: "owner@example.com", role: "AGENCY" },
    });
    const agency = await createOrg({
      type: "AGENCY", name: "Кадры", ownerUserId: owner.id,
    });
    await activateRepresentation(worker.id, agency.id);
    expect(await canViewDocumentUrl(owner.id, URL)).toBe(true);
  });

  it("чужое агентство документ не видит", async () => {
    const worker = await makeWorkerWithDoc();
    const owner = await prisma.user.create({
      data: { email: "other@example.com", role: "AGENCY" },
    });
    await createOrg({ type: "AGENCY", name: "Другое", ownerUserId: owner.id });
    expect(await canViewDocumentUrl(owner.id, URL)).toBe(false);
  });

  it("другой работник документ не видит", async () => {
    await makeWorkerWithDoc();
    const other = await prisma.user.create({
      data: { email: "other-worker@example.com", role: "WORKER" },
    });
    expect(await canViewDocumentUrl(other.id, URL)).toBe(false);
  });

  it("для несуществующего документа возвращает false", async () => {
    const worker = await makeWorkerWithDoc();
    expect(await canViewDocumentUrl(worker.id, "/uploads/нет.pdf")).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что падают**

Run: `npm test tests/domain/documents.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

Создать `lib/domain/documents.ts`:

```ts
import { prisma } from "@/lib/db";

/**
 * Кто вправе открыть документ работника:
 * — сам работник;
 * — сотрудник агентства, которое его представляет (статус ACTIVE);
 * — заказчик, к смене которого работник имеет отношение (отклик или приглашение).
 * Всем остальным — нет, включая прочих заказчиков площадки.
 */
export async function canViewDocumentUrl(viewerUserId: string, url: string) {
  const doc = await prisma.document.findFirst({ where: { url } });
  if (!doc) return false;

  if (doc.workerId === viewerUserId) return true;

  const agencyLink = await prisma.representation.findFirst({
    where: {
      workerId: doc.workerId,
      status: "ACTIVE",
      agency: { memberships: { some: { userId: viewerUserId } } },
    },
  });
  if (agencyLink) return true;

  const application = await prisma.application.findFirst({
    where: { workerId: doc.workerId, shift: { hrId: viewerUserId } },
  });
  return Boolean(application);
}
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Применить в выдаче файла**

В `app/uploads/[file]/route.ts` после проверки сессии добавить проверку прав.
URL документа в базе хранится как `/uploads/<имя>` — восстанавливать его из
`params.file` через `path.basename`, чтобы не пускать обход каталога:

```ts
import { canViewDocumentUrl } from "@/lib/domain/documents";

// ...после `if (!user) return new Response("Unauthorized", { status: 401 });`
const filename = path.basename(params.file);
const allowed = await canViewDocumentUrl(user.id, `/uploads/${filename}`);
if (!allowed) return new Response("Forbidden", { status: 403 });
```

Существующую строку с `path.basename` не дублировать — использовать одну.

- [ ] **Step 6: Проверить сборку и закоммитить**

Run: `npm test && npm run build`

```bash
git add lib app tests
git commit -m "Документы работника: доступ только своим, агентству и заказчику по отклику"
```

---

### Task 2: Происхождение работника видно заказчику, прямой найм закрыт

Заказчик не видит, что кандидат представлен агентством, и может пригласить его напрямую.

**Files:**
- Modify: `lib/domain/representation.ts`
- Create: `tests/domain/representing-agencies.test.ts`
- Modify: `app/worker/[id]/actions.ts`
- Modify: `app/workers/page.tsx`
- Modify: `app/worker/[id]/page.tsx`
- Modify: `app/hr/shifts/[id]/page.tsx`

**Interfaces:**
- Produces:
  - `representingAgencies(workerUserIds: string[]): Promise<Map<string, { id: string; name: string }[]>>`
  - `isRepresented(workerUserId: string): Promise<boolean>`

- [ ] **Step 1: Написать падающие тесты**

Создать `tests/domain/representing-agencies.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg } from "@/lib/domain/orgs";
import {
  activateRepresentation,
  revokeRepresentation,
  representingAgencies,
  isRepresented,
} from "@/lib/domain/representation";

async function makeWorker(email: string) {
  const user = await prisma.user.create({ data: { email, role: "WORKER" } });
  await prisma.workerProfile.create({ data: { userId: user.id } });
  return user;
}

async function makeAgency(name: string) {
  const owner = await prisma.user.create({
    data: { email: `${name}@example.com`, role: "AGENCY" },
  });
  return createOrg({ type: "AGENCY", name, ownerUserId: owner.id });
}

describe("representingAgencies", () => {
  beforeEach(resetDb);

  it("возвращает агентства по каждому работнику", async () => {
    const w1 = await makeWorker("w1@example.com");
    const w2 = await makeWorker("w2@example.com");
    const agency = await makeAgency("Кадры");
    await activateRepresentation(w1.id, agency.id);

    const map = await representingAgencies([w1.id, w2.id]);

    expect(map.get(w1.id)?.[0]).toEqual({ id: agency.id, name: "Кадры" });
    expect(map.get(w2.id) ?? []).toEqual([]);
  });

  it("не возвращает отозванные представительства", async () => {
    const worker = await makeWorker("w3@example.com");
    const agency = await makeAgency("Отозванное");
    await activateRepresentation(worker.id, agency.id);
    await revokeRepresentation(worker.id, agency.id);

    const map = await representingAgencies([worker.id]);

    expect(map.get(worker.id) ?? []).toEqual([]);
  });

  it("на пустом списке не падает", async () => {
    expect((await representingAgencies([])).size).toBe(0);
  });
});

describe("isRepresented", () => {
  beforeEach(resetDb);

  it("true, если есть активное представительство", async () => {
    const worker = await makeWorker("w4@example.com");
    const agency = await makeAgency("Активное");
    await activateRepresentation(worker.id, agency.id);
    expect(await isRepresented(worker.id)).toBe(true);
  });

  it("false, если представительств нет", async () => {
    const worker = await makeWorker("w5@example.com");
    expect(await isRepresented(worker.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить и убедиться, что падают**

Run: `npm test tests/domain/representing-agencies.test.ts`
Expected: FAIL — функции не экспортируются.

- [ ] **Step 3: Реализовать в `lib/domain/representation.ts`**

Дописать в конец файла:

```ts
/** Активные представительства пачкой: работник → список агентств. */
export async function representingAgencies(workerUserIds: string[]) {
  const result = new Map<string, { id: string; name: string }[]>();
  if (workerUserIds.length === 0) return result;

  const rows = await prisma.representation.findMany({
    where: { workerId: { in: workerUserIds }, status: "ACTIVE" },
    include: { agency: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  for (const row of rows) {
    const list = result.get(row.workerId) ?? [];
    list.push({ id: row.agency.id, name: row.agency.name });
    result.set(row.workerId, list);
  }
  return result;
}

export async function isRepresented(workerUserId: string) {
  const row = await prisma.representation.findFirst({
    where: { workerId: workerUserId, status: "ACTIVE" },
    select: { id: true },
  });
  return Boolean(row);
}
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Закрыть прямое приглашение агентского работника**

В `app/worker/[id]/actions.ts` в функции `inviteWorker` после проверки смены добавить:

```ts
import { isRepresented } from "@/lib/domain/representation";

// ...после проверки shift
if (await isRepresented(workerId)) {
  redirect(`/worker/${workerId}?error=represented`);
}
```

- [ ] **Step 6: Показать происхождение в каталоге**

В `app/workers/page.tsx` после выборки работников получить карту агентств:

```ts
import { representingAgencies } from "@/lib/domain/representation";

const agencyMap = await representingAgencies(workers.map((w) => w.id));
```

В карточке каждого работника, если у него есть агентства, вывести строку в том же
стиле, что и прочие мета-строки карточки: «Представлен агентством «Название»»
(при нескольких — перечислить через запятую). Оформить как badge/подпись, не как
заголовок.

- [ ] **Step 7: Показать происхождение в карточке работника и убрать кнопку**

В `app/worker/[id]/page.tsx`:
- получить `const agencies = (await representingAgencies([workerId])).get(workerId) ?? []`;
- если список не пуст — вместо формы приглашения на смену показать пояснение:
  «Работник представлен агентством «Название». Приглашение оформляется через агентство.»
- если пуст — оставить существующую форму без изменений;
- если в query есть `error=represented` — показать то же пояснение как предупреждение.

- [ ] **Step 8: Показать происхождение в отклике**

В `app/hr/shifts/[id]/page.tsx` рядом с именем кандидата вывести ту же пометку,
получив карту через `representingAgencies` по списку id откликнувшихся.

- [ ] **Step 9: Проверить и закоммитить**

Run: `npm test && npm run build`

```bash
git add lib app tests
git commit -m "Заказчик видит, что работник представлен агентством; прямое приглашение закрыто"
```

---

### Task 3: Согласие на обработку персональных данных

Согласия нет ни в каком виде, а мы собираем паспорта и медкнижки.

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/domain/consent.ts`
- Create: `tests/domain/consent.test.ts`
- Create: `app/privacy/page.tsx`
- Modify: `app/onboarding/worker/page.tsx`
- Modify: `app/onboarding/worker/actions.ts`

**Interfaces:**
- Produces: `CONSENT_VERSION: string`, `recordConsent(userId: string): Promise<void>`,
  `hasConsent(userId: string): Promise<boolean>`

- [ ] **Step 1: Добавить поля в схему**

В модель `User` добавить:

```prisma
  consentedAt      DateTime?
  consentVersion   String?
```

Создать миграцию: `npx prisma migrate dev --name add_consent_fields`
При предложении сбросить базу — прервать и вернуть BLOCKED.

- [ ] **Step 2: Написать падающие тесты**

Создать `tests/domain/consent.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { recordConsent, hasConsent, CONSENT_VERSION } from "@/lib/domain/consent";

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, role: "WORKER" } });
}

describe("recordConsent", () => {
  beforeEach(resetDb);

  it("проставляет дату и версию согласия", async () => {
    const user = await makeUser("a@example.com");

    await recordConsent(user.id);

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.consentedAt).toBeInstanceOf(Date);
    expect(fresh?.consentVersion).toBe(CONSENT_VERSION);
  });

  it("повторный вызов обновляет дату", async () => {
    const user = await makeUser("b@example.com");
    await recordConsent(user.id);
    const first = (await prisma.user.findUnique({ where: { id: user.id } }))!.consentedAt!;

    await recordConsent(user.id);
    const second = (await prisma.user.findUnique({ where: { id: user.id } }))!.consentedAt!;

    expect(second.getTime()).toBeGreaterThanOrEqual(first.getTime());
  });
});

describe("hasConsent", () => {
  beforeEach(resetDb);

  it("false до согласия", async () => {
    const user = await makeUser("c@example.com");
    expect(await hasConsent(user.id)).toBe(false);
  });

  it("true после согласия текущей версии", async () => {
    const user = await makeUser("d@example.com");
    await recordConsent(user.id);
    expect(await hasConsent(user.id)).toBe(true);
  });

  it("false, если согласие было на другую версию", async () => {
    const user = await makeUser("e@example.com");
    await prisma.user.update({
      where: { id: user.id },
      data: { consentedAt: new Date(), consentVersion: "устаревшая" },
    });
    expect(await hasConsent(user.id)).toBe(false);
  });
});
```

- [ ] **Step 3: Запустить и убедиться, что падают**

Run: `npm test tests/domain/consent.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 4: Реализовать**

Создать `lib/domain/consent.ts`:

```ts
import { prisma } from "@/lib/db";

/** Версия текста согласия. Меняется вместе с текстом на /privacy. */
export const CONSENT_VERSION = "2026-09-09";

export async function recordConsent(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { consentedAt: new Date(), consentVersion: CONSENT_VERSION },
  });
}

export async function hasConsent(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { consentVersion: true },
  });
  return user?.consentVersion === CONSENT_VERSION;
}
```

- [ ] **Step 5: Запустить тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Страница политики**

Создать `app/privacy/page.tsx` — статическая страница в стиле проекта, заголовок
«Обработка персональных данных». Содержание (рабочий черновик, отметить это в начале
страницы курсивом одной строкой):

- кто оператор: название сервиса и контакт `noreply@horecago.tech`;
- какие данные собираем: имя, телефон, адрес электронной почты, район проживания,
  сведения о квалификации, загруженные документы (паспорт, медицинская книжка);
- зачем: подбор смен, подтверждение допуска к работе, связь между работником,
  заказчиком и агентством;
- кому передаём: заказчику, к смене которого работник проявил интерес, и агентству,
  которое его представляет; иным лицам — нет;
- сколько храним: пока учётная запись активна;
- права: отозвать согласие, потребовать удаления, отозвать представительство
  агентства в личном кабинете;
- как отозвать: письмом на указанный адрес.

Ссылку на страницу добавить в подвал `app/layout.tsx`.

- [ ] **Step 7: Чекбокс в онбординге работника**

В `app/onboarding/worker/page.tsx` добавить обязательный чекбокс `consent` перед
кнопкой отправки: «Я согласен на обработку персональных данных» со ссылкой на
`/privacy`, открывающейся в новой вкладке. Атрибут `required` обязателен.

В `app/onboarding/worker/actions.ts` в начале обработки:

```ts
import { recordConsent } from "@/lib/domain/consent";

const consent = formData.get("consent");
if (!consent) redirect("/onboarding/worker?error=consent");
```

и после успешного сохранения профиля — `await recordConsent(user.id);`

Если в query есть `error=consent`, страница показывает пояснение, что без согласия
профиль сохранить нельзя.

- [ ] **Step 8: Проверить и закоммитить**

Run: `npm test && npm run build`

```bash
git add prisma lib app tests
git commit -m "Согласие на обработку персональных данных: страница, чекбокс, отметка в профиле"
```

---

### Task 4: Работник отзывает представительство сам

Функция отзыва есть в коде, но недоступна из интерфейса — а это прямое право
субъекта персональных данных.

**Files:**
- Modify: `app/profile/page.tsx`
- Modify: `app/profile/actions.ts`
- Create: `tests/domain/revoke-flow.test.ts`

**Interfaces:**
- Consumes: `revokeRepresentation`, `representingAgencies` из `lib/domain/representation.ts`.

- [ ] **Step 1: Написать падающий тест**

Создать `tests/domain/revoke-flow.test.ts` — проверяет, что после отзыва работник
пропадает из выборки агентства и снова доступен для прямого приглашения:

```ts
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
```

- [ ] **Step 2: Запустить, убедиться что проходит**

Run: `npm test tests/domain/revoke-flow.test.ts`
Expected: PASS — это регрессионный тест на уже существующее поведение домена.
Если падает — остановиться и сообщить, ничего не подгоняя.

- [ ] **Step 3: Действие отзыва**

В `app/profile/actions.ts` добавить:

```ts
import { revokeRepresentation } from "@/lib/domain/representation";

export async function revokeMyRepresentation(formData: FormData) {
  const user = await requireUser();
  const agencyId = String(formData.get("agencyId"));
  if (!agencyId) return;
  await revokeRepresentation(user.id, agencyId);
  revalidatePath("/profile");
}
```

Идентификатор работника берётся из сессии, из формы приходит только агентство —
иначе можно было бы отозвать чужое представительство.

- [ ] **Step 4: Раздел в профиле**

В `app/profile/page.tsx` добавить блок «Кто вас представляет» со списком активных
агентств (через `representingAgencies`), у каждого — кнопка «Отозвать» в форме,
отправляющей `agencyId` в `revokeMyRepresentation`. Если список пуст — блок не
показывать вовсе. Под списком пояснение: «Отзыв не удаляет историю ваших смен.»

- [ ] **Step 5: Проверить и закоммитить**

Run: `npm test && npm run build`

```bash
git add app tests
git commit -m "Работник может отозвать представительство агентства в своём профиле"
```

---

### Task 5: Приглашение как сущность, а не состояние ссылки

Сейчас связь с агентством живёт внутри magic-link. Просрочилась ссылка — человек
входит сам и становится «ничьим», а агентство теряет приведённого работника.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/auth-token.ts`
- Modify: `lib/domain/representation.ts`
- Create: `tests/domain/agency-invite.test.ts`
- Modify: `app/auth/verify/route.ts`
- Modify: `tests/helpers/db.ts`

**Interfaces:**
- Produces:
  - `createMagicLink(email, role?, agencyId?, ttlMinutes?)` — новый четвёртый параметр
  - `acceptPendingInvites(userId: string, email: string): Promise<number>` — сколько
    приглашений принято

- [ ] **Step 1: Добавить модель в схему**

```prisma
model AgencyInvite {
  id             String    @id @default(cuid())
  agencyId       String
  email          String
  status         String    @default("PENDING") // "PENDING" | "ACCEPTED" | "CANCELLED"
  deliveryStatus String    @default("SENT")    // "SENT" | "FAILED"
  deliveryError  String?
  createdAt      DateTime  @default(now())
  acceptedAt     DateTime?

  agency Org @relation("AgencyInvites", fields: [agencyId], references: [id], onDelete: Cascade)

  @@unique([agencyId, email])
  @@index([email, status])
  @@index([agencyId, createdAt])
}
```

Составной уникальный ключ `@@unique([agencyId, email])` обязателен: по нему идёт
`upsert` в `inviteWorker`, иначе повторное приглашение того же адреса создаст дубль.

В модель `Org` дописать одну строку обратной связи:

```prisma
  invites AgencyInvite[] @relation("AgencyInvites")
```

Миграция: `npx prisma migrate dev --name add_agency_invite`
При предложении сбросить базу — прервать, вернуть BLOCKED.

- [ ] **Step 2: Дополнить хелпер очистки**

В `tests/helpers/db.ts` добавить `await prisma.agencyInvite.deleteMany();` сразу после
строки с `representation.deleteMany()`.

- [ ] **Step 3: Написать падающие тесты**

Создать `tests/domain/agency-invite.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg } from "@/lib/domain/orgs";
import { inviteWorker, acceptPendingInvites } from "@/lib/domain/representation";

async function makeAgency(name: string) {
  const owner = await prisma.user.create({
    data: { email: `${name}@example.com`, role: "AGENCY" },
  });
  return createOrg({ type: "AGENCY", name, ownerUserId: owner.id });
}

describe("inviteWorker", () => {
  beforeEach(resetDb);

  it("создаёт приглашение для незнакомого адреса", async () => {
    const agency = await makeAgency("Кадры");

    await inviteWorker(agency.id, "Nina@Example.COM");

    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.email).toBe("nina@example.com");
    expect(invite?.agencyId).toBe(agency.id);
    expect(invite?.status).toBe("PENDING");
  });

  it("повторное приглашение не плодит дублей", async () => {
    const agency = await makeAgency("Кадры2");

    await inviteWorker(agency.id, "dup@example.com");
    await inviteWorker(agency.id, "dup@example.com");

    expect(await prisma.agencyInvite.count()).toBe(1);
  });
});

describe("acceptPendingInvites", () => {
  beforeEach(resetDb);

  it("активирует представительство при входе, даже если ссылка была другой", async () => {
    const agency = await makeAgency("Кадры3");
    await inviteWorker(agency.id, "late@example.com");

    const user = await prisma.user.create({
      data: { email: "late@example.com", role: "WORKER" },
    });

    const accepted = await acceptPendingInvites(user.id, "late@example.com");

    expect(accepted).toBe(1);
    const rep = await prisma.representation.findUnique({
      where: { workerId_agencyId: { workerId: user.id, agencyId: agency.id } },
    });
    expect(rep?.status).toBe("ACTIVE");
    const invite = await prisma.agencyInvite.findFirst();
    expect(invite?.status).toBe("ACCEPTED");
  });

  it("не активирует представительство для не-работника", async () => {
    const agency = await makeAgency("Кадры4");
    await inviteWorker(agency.id, "boss@example.com");
    const user = await prisma.user.create({
      data: { email: "boss@example.com", role: "HR" },
    });

    const accepted = await acceptPendingInvites(user.id, "boss@example.com");

    expect(accepted).toBe(0);
    expect(await prisma.representation.count()).toBe(0);
  });

  it("принятое приглашение повторно не срабатывает", async () => {
    const agency = await makeAgency("Кадры5");
    await inviteWorker(agency.id, "once@example.com");
    const user = await prisma.user.create({
      data: { email: "once@example.com", role: "WORKER" },
    });

    await acceptPendingInvites(user.id, "once@example.com");
    const second = await acceptPendingInvites(user.id, "once@example.com");

    expect(second).toBe(0);
  });

  it("без приглашений возвращает ноль", async () => {
    const user = await prisma.user.create({
      data: { email: "nobody@example.com", role: "WORKER" },
    });
    expect(await acceptPendingInvites(user.id, "nobody@example.com")).toBe(0);
  });
});
```

- [ ] **Step 4: Запустить и убедиться, что падают**

Run: `npm test tests/domain/agency-invite.test.ts`
Expected: FAIL.

- [ ] **Step 5: Срок жизни ссылки параметром**

В `lib/auth-token.ts` заменить константу на две и добавить параметр:

```ts
const LOGIN_TTL_MIN = 60;
export const INVITE_TTL_MIN = 60 * 24 * 7; // приглашение агентства живёт неделю

export async function createMagicLink(
  email: string,
  role?: "WORKER" | "AGENCY" | "CLIENT" | "HR",
  agencyId?: string,
  ttlMinutes: number = LOGIN_TTL_MIN,
) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
  // ...остальное без изменений
}
```

В письме заменить текст «действует 15 минут» на расчёт по факту: если срок больше
суток — «действует 7 дней», иначе «действует 60 минут». Проще всего передать готовую
строку в шаблон, вычислив её из `ttlMinutes`.

- [ ] **Step 6: Переписать `inviteWorker` и добавить `acceptPendingInvites`**

В `lib/domain/representation.ts`:

```ts
import { createMagicLink, INVITE_TTL_MIN } from "@/lib/auth-token";

export async function inviteWorker(agencyId: string, email: string) {
  const normalized = email.toLowerCase().trim();

  // Приглашение живёт в базе, а не только внутри ссылки: если письмо потеряется
  // или ссылка истечёт, связь с агентством всё равно подхватится при входе.
  const invite = await prisma.agencyInvite.upsert({
    where: { agencyId_email: { agencyId, email: normalized } },
    update: {},
    create: { agencyId, email: normalized, status: "PENDING" },
  });

  const { url, token } = await createMagicLink(
    normalized, "WORKER", agencyId, INVITE_TTL_MIN,
  );

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  let representationId = "";
  if (user && user.role === "WORKER") {
    const rep = await prisma.representation.upsert({
      where: { workerId_agencyId: { workerId: user.id, agencyId } },
      update: {},
      create: { workerId: user.id, agencyId, status: "PENDING" },
    });
    representationId = rep.id;
  }

  return { inviteId: invite.id, representationId, url, token };
}

/**
 * Принимает все ожидающие приглашения на этот адрес. Вызывается при каждом входе,
 * поэтому работает и когда ссылка приглашения истекла, а человек зашёл сам.
 */
export async function acceptPendingInvites(userId: string, email: string) {
  const normalized = email.toLowerCase().trim();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== "WORKER") return 0;

  const invites = await prisma.agencyInvite.findMany({
    where: { email: normalized, status: "PENDING" },
  });

  for (const invite of invites) {
    await activateRepresentation(userId, invite.agencyId);
    await prisma.agencyInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  }
  return invites.length;
}
```

- [ ] **Step 7: Подключить приём приглашений при входе**

В `app/auth/verify/route.ts` заменить блок активации на вызов, который работает для
любого входа, а не только по ссылке-приглашению:

```ts
import { acceptPendingInvites } from "@/lib/domain/representation";

// вместо прежнего `if (link.agencyId && link.role === "WORKER") ...`
await acceptPendingInvites(user.id, user.email);
```

- [ ] **Step 8: Запустить тесты и сборку**

Run: `npm test && npm run build`
Expected: PASS, сборка без ошибок. Существующие тесты представительства должны
продолжать проходить.

- [ ] **Step 9: Коммит**

```bash
git add prisma lib app tests
git commit -m "Приглашение агентства живёт в базе: связь подхватывается при любом входе"
```

---

### Task 6: Пакетные приглашения, отчёт о доставке, внятные ошибки входа

**Files:**
- Modify: `lib/email.ts`
- Modify: `lib/auth-token.ts`
- Modify: `lib/domain/representation.ts`
- Create: `lib/domain/emails.ts`
- Create: `tests/domain/emails.test.ts`
- Modify: `app/agency/actions.ts`
- Modify: `app/agency/page.tsx`
- Modify: `app/login/page.tsx`
- Modify: `app/api/auth/login/route.ts`

**Interfaces:**
- Produces: `parseEmailList(raw: string): { emails: string[]; invalid: string[] }`,
  `MAX_INVITES_PER_BATCH = 20`

- [ ] **Step 1: Написать падающие тесты разбора списка**

Создать `tests/domain/emails.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseEmailList, MAX_INVITES_PER_BATCH } from "@/lib/domain/emails";

describe("parseEmailList", () => {
  it("разбирает адреса через перенос строки, запятую и точку с запятой", () => {
    const { emails } = parseEmailList("a@x.ru\nb@x.ru, c@x.ru; d@x.ru");
    expect(emails).toEqual(["a@x.ru", "b@x.ru", "c@x.ru", "d@x.ru"]);
  });

  it("приводит к нижнему регистру и убирает пробелы", () => {
    const { emails } = parseEmailList("  Nina@Example.COM  ");
    expect(emails).toEqual(["nina@example.com"]);
  });

  it("убирает повторы", () => {
    const { emails } = parseEmailList("a@x.ru\na@x.ru");
    expect(emails).toEqual(["a@x.ru"]);
  });

  it("отделяет непохожее на адрес", () => {
    const { emails, invalid } = parseEmailList("a@x.ru\nне-адрес\nb@x.ru");
    expect(emails).toEqual(["a@x.ru", "b@x.ru"]);
    expect(invalid).toEqual(["не-адрес"]);
  });

  it("пустая строка даёт пустые списки", () => {
    expect(parseEmailList("   ")).toEqual({ emails: [], invalid: [] });
  });

  it("ограничение пачки задано и разумно", () => {
    expect(MAX_INVITES_PER_BATCH).toBe(20);
  });
});
```

- [ ] **Step 2: Запустить, убедиться что падают**

Run: `npm test tests/domain/emails.test.ts`
Expected: FAIL.

- [ ] **Step 3: Реализовать**

Создать `lib/domain/emails.ts`:

```ts
/** За одну отправку — не больше, чем успевает уйти в пределах запроса. */
export const MAX_INVITES_PER_BATCH = 20;

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseEmailList(raw: string) {
  const parts = raw
    .split(/[\n,;]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const emails: string[] = [];
  const invalid: string[] = [];
  for (const part of parts) {
    if (!LOOKS_LIKE_EMAIL.test(part)) {
      if (!invalid.includes(part)) invalid.push(part);
    } else if (!emails.includes(part)) {
      emails.push(part);
    }
  }
  return { emails, invalid };
}
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Отправка письма перестаёт ронять запрос**

В `lib/email.ts` изменить `sendEmail`, чтобы она не бросала, а сообщала результат:

```ts
export async function sendEmail(
  to: string, subject: string, html: string, text?: string,
): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransport();
  const from = process.env.SMTP_FROM ?? "noreply@horecago.ru";
  if (!transport) {
    // dev: печать в консоль, как было
    // ...существующий блок...
    return { ok: true };
  }
  try {
    await transport.sendMail({ from, to, subject, html, text });
    return { ok: true };
  } catch (e) {
    console.error("Не удалось отправить письмо:", to, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

В `lib/auth-token.ts` `createMagicLink` вернуть результат отправки наружу:
добавить в возвращаемый объект поле `delivery` со значением из `sendEmail`.

- [ ] **Step 6: Записывать результат доставки в приглашение**

В `lib/domain/representation.ts` в `inviteWorker` после `createMagicLink` обновить
приглашение результатом доставки:

```ts
await prisma.agencyInvite.update({
  where: { id: invite.id },
  data: {
    deliveryStatus: delivery.ok ? "SENT" : "FAILED",
    deliveryError: delivery.ok ? null : (delivery.error ?? "неизвестная ошибка"),
  },
});
```

и вернуть `delivery` из функции.

- [ ] **Step 7: Пакетная форма в кабинете агентства**

`app/agency/actions.ts` — заменить `sendWorkerInvite` на обработку списка:

```ts
export async function sendWorkerInvites(formData: FormData) {
  const user = await requireUser();
  const [agencyId] = await agencyIdsOf(user.id);
  if (!agencyId) return;

  const { emails, invalid } = parseEmailList(String(formData.get("emails") ?? ""));
  const list = emails.slice(0, MAX_INVITES_PER_BATCH);

  let sent = 0;
  let failed = 0;
  for (const email of list) {
    const result = await inviteWorker(agencyId, email);
    if (result.delivery.ok) sent++;
    else failed++;
  }

  const skipped = emails.length - list.length;
  revalidatePath("/agency");
  redirect(
    `/agency?sent=${sent}&failed=${failed}&invalid=${invalid.length}&skipped=${skipped}`,
  );
}
```

`app/agency/page.tsx`:
- заменить одиночное поле на `textarea name="emails"` с подписью «По одному адресу
  в строке, до 20 за раз»;
- показать итог отправки из query: сколько отправлено, сколько не удалось, сколько
  строк не похожи на адрес, сколько не поместилось в пачку;
- в таблице представительств добавить колонку состояния доставки: для приглашений со
  статусом `FAILED` показать «Письмо не доставлено» с текстом ошибки в подсказке.
  Данные брать из `AgencyInvite` по адресу.

- [ ] **Step 8: Сообщения об ошибках входа**

`app/login/page.tsx` — читать `searchParams.error` и показывать понятный текст:
- `expired` — «Ссылка устарела. Введите почту ещё раз, мы пришлём новую.»
- `used` — «Ссылка уже использована. Введите почту ещё раз.»
- `mail` — «Не удалось отправить письмо. Попробуйте ещё раз через минуту.»

`app/auth/verify/route.ts` — при неуспешном `consumeMagicLink` различать причины:
если запись найдена и `used` — редирект с `error=used`, иначе `error=expired`.
Для этого в `consumeMagicLink` вернуть не только `null`, но и причину: изменить
её так, чтобы возвращала `{ link: null, reason: "expired" | "used" | "unknown" }`
либо `{ link, reason: null }`, и поправить обоих вызывающих.

`app/api/auth/login/route.ts` — если отправка не удалась, вернуть ответ с признаком
ошибки, а страница входа показывает текст про `mail`.

- [ ] **Step 9: Проверить и закоммитить**

Run: `npm test && npm run build`

```bash
git add lib app tests
git commit -m "Пакетные приглашения, отчёт о доставке писем и понятные ошибки входа"
```

---

### Task 7: Найм без гонки

Два одновременных найма на последнее место берут обоих: счётчик читается до
транзакции и записывается готовым числом.

**Files:**
- Create: `lib/domain/hiring.ts`
- Create: `tests/domain/hiring.test.ts`
- Modify: `app/hr/shifts/actions.ts`
- Modify: `app/applications/actions.ts`
- Modify: `lib/db.ts`

**Interfaces:**
- Produces: `hireApplication(applicationId: string, expectHrId?: string): Promise<"HIRED" | "NO_SEATS" | "NOT_FOUND" | "ALREADY">`

- [ ] **Step 1: Написать падающие тесты**

Создать `tests/domain/hiring.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { hireApplication } from "@/lib/domain/hiring";

async function setup(headcount: number) {
  const hr = await prisma.user.create({ data: { email: "hr@example.com", role: "HR" } });
  const position = await prisma.position.create({ data: { name: "Горничная" } });
  const shift = await prisma.shift.create({
    data: {
      hrId: hr.id, positionId: position.id, title: "Смена", description: "",
      payment: 3000, address: "Москва", headcount,
      shiftStart: new Date("2026-10-01T08:00:00"),
      shiftEnd: new Date("2026-10-01T20:00:00"),
    },
  });
  return { hr, shift };
}

async function addApplicant(shiftId: string, email: string) {
  const worker = await prisma.user.create({ data: { email, role: "WORKER" } });
  await prisma.workerProfile.create({ data: { userId: worker.id } });
  return prisma.application.create({ data: { shiftId, workerId: worker.id } });
}

describe("hireApplication", () => {
  beforeEach(resetDb);

  it("нанимает и увеличивает счётчик", async () => {
    const { shift } = await setup(2);
    const app = await addApplicant(shift.id, "a@example.com");

    expect(await hireApplication(app.id)).toBe("HIRED");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(1);
    expect(fresh?.status).toBe("OPEN");
  });

  it("закрывает смену на последнем месте", async () => {
    const { shift } = await setup(1);
    const app = await addApplicant(shift.id, "b@example.com");

    expect(await hireApplication(app.id)).toBe("HIRED");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.status).toBe("CLOSED");
  });

  it("не превышает количество мест", async () => {
    const { shift } = await setup(1);
    const first = await addApplicant(shift.id, "c@example.com");
    const second = await addApplicant(shift.id, "d@example.com");

    expect(await hireApplication(first.id)).toBe("HIRED");
    expect(await hireApplication(second.id)).toBe("NO_SEATS");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(1);
    const hired = await prisma.application.count({ where: { status: "HIRED" } });
    expect(hired).toBe(1);
  });

  it("повторный найм того же отклика не меняет счётчик", async () => {
    const { shift } = await setup(3);
    const app = await addApplicant(shift.id, "e@example.com");

    await hireApplication(app.id);
    expect(await hireApplication(app.id)).toBe("ALREADY");

    const fresh = await prisma.shift.findUnique({ where: { id: shift.id } });
    expect(fresh?.hiredCount).toBe(1);
  });

  it("чужую смену нанять нельзя", async () => {
    const { shift } = await setup(2);
    const app = await addApplicant(shift.id, "f@example.com");
    const stranger = await prisma.user.create({
      data: { email: "stranger@example.com", role: "HR" },
    });

    expect(await hireApplication(app.id, stranger.id)).toBe("NOT_FOUND");
  });

  it("несуществующий отклик", async () => {
    expect(await hireApplication("нет-такого")).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Запустить, убедиться что падают**

Run: `npm test tests/domain/hiring.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать**

Создать `lib/domain/hiring.ts`. Ключ решения — условный `updateMany`: место занимается
только если счётчик не изменился с момента чтения. Это оптимистическая блокировка,
она работает и на SQLite, где сравнить две колонки в `where` нельзя.

```ts
import { prisma } from "@/lib/db";

export type HireResult = "HIRED" | "NO_SEATS" | "NOT_FOUND" | "ALREADY";

/**
 * Нанимает по отклику. Место занимается условным обновлением: если счётчик
 * изменился между чтением и записью, обновление не проходит и мы пробуем снова.
 * Без этого два одновременных найма на последнее место брали обоих.
 */
export async function hireApplication(
  applicationId: string,
  expectHrId?: string,
): Promise<HireResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { shift: true },
    });
    if (!application) return "NOT_FOUND";
    if (expectHrId && application.shift.hrId !== expectHrId) return "NOT_FOUND";
    if (application.status === "HIRED") return "ALREADY";
    if (application.status !== "PENDING") return "NOT_FOUND";

    const shift = application.shift;
    if (shift.status === "CLOSED" || shift.hiredCount >= shift.headcount) {
      return "NO_SEATS";
    }

    const nextCount = shift.hiredCount + 1;
    const claimed = await prisma.shift.updateMany({
      where: { id: shift.id, hiredCount: shift.hiredCount, status: "OPEN" },
      data: {
        hiredCount: nextCount,
        status: nextCount >= shift.headcount ? "CLOSED" : "OPEN",
      },
    });

    if (claimed.count === 0) continue; // счётчик увели — перечитываем и пробуем снова

    const marked = await prisma.application.updateMany({
      where: { id: applicationId, status: "PENDING" },
      data: { status: "HIRED" },
    });

    if (marked.count === 0) {
      // отклик увели параллельно — возвращаем место обратно
      await prisma.shift.updateMany({
        where: { id: shift.id },
        data: { hiredCount: { decrement: 1 }, status: "OPEN" },
      });
      return "ALREADY";
    }
    return "HIRED";
  }
  return "NO_SEATS";
}
```

- [ ] **Step 4: Запустить тесты**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Перевести оба места найма на общую функцию**

В `app/hr/shifts/actions.ts` функция `hireApplicant`: заменить чтение-счёт-транзакцию
на вызов `hireApplication(appId, user.id)`. Результат `NO_SEATS` — вернуть пользователя
на страницу смены с пометкой, что мест не осталось; прочие результаты — просто
`revalidatePath`, как и раньше.

В `app/applications/actions.ts` функция `acceptInvitation`: заменить тот же паттерн на
`hireApplication(appId)` — здесь проверка владельца не нужна, принимает сам работник,
но обязательно сохранить существующую проверку, что отклик принадлежит этому
работнику.

Дублирующийся код подсчёта из обоих файлов удалить — он больше не нужен.

- [ ] **Step 6: Ожидание при блокировке базы**

В `lib/db.ts` рядом с включением WAL добавить ожидание вместо мгновенной ошибки:

```ts
prisma.$executeRawUnsafe("PRAGMA busy_timeout=5000;").catch((e) => {
  console.error("Не удалось задать busy_timeout:", e);
});
```

- [ ] **Step 7: Проверить и закоммитить**

Run: `npm test && npm run build`

```bash
git add lib app tests
git commit -m "Найм без гонки: место занимается условным обновлением счётчика"
```

---

### Task 8: Эксплуатация — лимиты, страница ошибки, бэкап, демо-вход

**Files:**
- Modify: `app/workers/page.tsx`, `app/feed/page.tsx`, `app/applications/page.tsx`,
  `app/hr/page.tsx`, `app/agency/page.tsx`, `app/hr/shifts/[id]/page.tsx`
- Create: `app/error.tsx`
- Create: `app/global-error.tsx`
- Create: `scripts/backup-db.sh`
- Modify: `app/api/demo/login/route.ts`
- Modify: `README.md`

- [ ] **Step 1: Лимиты в выборках**

Добавить `take` в перечисленные `findMany`, сохранив существующую сортировку:
`app/workers/page.tsx` — 200; `app/feed/page.tsx` — 200; `app/applications/page.tsx` — 100;
`app/hr/page.tsx` — 100; `app/agency/page.tsx` — 200;
`app/hr/shifts/[id]/page.tsx` — отклики 200.

Там, где список может быть обрезан, под списком показать строку вида
«Показаны первые 200 — уточните фильтр». Показывать её только когда получено ровно
столько записей, сколько лимит.

- [ ] **Step 2: Страницы ошибок**

Создать `app/error.tsx` — клиентский компонент с `"use client"`, принимает `error` и
`reset`. Текст на русском: «Что-то пошло не так», пояснение «Мы уже знаем о проблеме.
Попробуйте обновить страницу», кнопка «Обновить» вызывает `reset()`. В обработчике
вызвать `console.error(error)` — это попадёт в системный журнал.

Создать `app/global-error.tsx` по тому же образцу, с собственными `<html>` и `<body>`,
как требует Next.js.

- [ ] **Step 3: Скрипт резервного копирования**

Создать `scripts/backup-db.sh`:

```bash
#!/usr/bin/env bash
# Резервная копия боевой базы. Обычный cp при включённом WAL теряет
# последние транзакции, поэтому копируем средствами самого SQLite.
set -euo pipefail

DB="${DB_PATH:-/root/horecago-data/db/prod.db}"
DEST="${BACKUP_DIR:-/root/horecago-data/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

mkdir -p "$DEST"
STAMP=$(date +%F-%H%M)
sqlite3 "$DB" ".backup '$DEST/prod-$STAMP.db'"
gzip -f "$DEST/prod-$STAMP.db"
find "$DEST" -name 'prod-*.db.gz' -mtime "+$KEEP_DAYS" -delete
echo "Копия готова: $DEST/prod-$STAMP.db.gz"
```

Сделать исполняемым: `chmod +x scripts/backup-db.sh`

- [ ] **Step 4: Закрыть демонстрационный вход на проде**

В `app/api/demo/login/route.ts` в начале обработчика добавить:

```ts
// Демо-вход пускает без пароля, поэтому в проде он доступен только
// при явно включённом флаге.
if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEMO !== "1") {
  return new Response("Not found", { status: 404 });
}
```

Ту же проверку добавить на страницу `app/demo/page.tsx` — при выключенном демо
делать `notFound()`.

- [ ] **Step 5: README**

Дописать в README:
- раздел про резервное копирование: запуск `scripts/backup-db.sh`, пример строки
  crontab для ежедневного запуска в 4 утра, напоминание про восстановление;
- в раздел про почту — DNS-запись DMARC:
  `_dmarc.horecago.tech TXT "v=DMARC1; p=none; rua=mailto:noreply@horecago.tech"`
  с пояснением, что без неё крупные почтовые службы складывают массовые письма в спам,
  и что через месяц наблюдения политику можно ужесточить до `p=quarantine`;
- в раздел про переменные окружения — `ENABLE_DEMO` и `ADMIN_EMAILS`.

- [ ] **Step 6: Проверить и закоммитить**

Run: `npm test && npm run build`

```bash
git add app scripts README.md
git commit -m "Эксплуатация: лимиты выборок, страницы ошибок, скрипт бэкапа, демо-вход только по флагу"
```

---

## Что остаётся за пределами этого плана

- Участие агентства в сменах: витрина заявок, предложение своего работника,
  происхождение отклика, статус выходов — это фаза 1, её содержание зависит от
  ответов человека в отеле.
- Связь «одобренные агентства заказчика» — там же.
- Подключение внешнего мониторинга ошибок — отдельное решение владельца.
- Вход по телефону вместо почты — отдельная работа, в бэклоге README.
