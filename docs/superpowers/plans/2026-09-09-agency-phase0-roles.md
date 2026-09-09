# Фаза 0: ядро ролей (организации, членства, представительства)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ввести в HoReCaGo три стороны — работник, агентство, заказчик — так, чтобы
агентство представляло работника, но не владело им.

**Architecture:** Появляется `Org` (CLIENT | AGENCY) и `Membership` вместо роли `HR`
на пользователе. `WorkerProfile` остаётся самостоятельной сущностью; связь с
агентством выносится в `Representation` со статусами PENDING / ACTIVE / REVOKED.
Доменная логика переезжает в `lib/domain/*`, чтобы её можно было тестировать без
Next.js: серверные экшены становятся тонкой обёрткой над ней.

**Tech Stack:** Next.js 14 (app router, server actions), TypeScript, Prisma 5,
SQLite, Tailwind, Vitest (добавляется этим планом).

**Spec:** `docs/superpowers/specs/2026-09-09-agency-marketplace-design.md`

## Global Constraints

- Весь интерфейс и тексты писем — на русском языке.
- База — SQLite. Массивов нет: списки хранить строкой с разделителем.
- Работник не принадлежит агентству: `WorkerProfile` не получает поля `agencyId`
  ни при каких обстоятельствах. Связь только через `Representation`.
- Агентство не может создать учётную запись работника напрямую — только
  приглашение, которое активирует сам человек (152-ФЗ).
- Новые зависимости — только `vitest`. Ничего тяжёлого не добавлять.
- Доменные модули в `lib/domain/` не импортируют `next/headers`, `next/navigation`
  и `lib/auth.ts` — иначе их нельзя протестировать вне Next.
- Существующие magic-link и демо-вход не ломать: они работают на всём протяжении.
- Коммит после каждой задачи, сообщения на русском.

---

### Task 1: Тестовая инфраструктура

Тестов в проекте нет. Эта задача поднимает Vitest на отдельной SQLite-базе и даёт
хелпер очистки, на который опираются все последующие задачи.

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/global-setup.ts`
- Create: `tests/helpers/db.ts`
- Create: `tests/helpers/db.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: ничего.
- Produces: `resetDb(): Promise<void>` из `tests/helpers/db.ts` — очищает все
  таблицы; `npm test` запускает Vitest.

- [ ] **Step 1: Установить Vitest**

```bash
npm install -D vitest@^2.1.0
```

- [ ] **Step 2: Добавить скрипт в package.json**

В блок `"scripts"` добавить:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Создать конфиг Vitest**

Создать `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

const TEST_DB = path.resolve(__dirname, "tests/.tmp/test.db");
const TEST_DB_URL = `file:${TEST_DB}`;

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    // SQLite не любит параллельную запись из нескольких процессов
    fileParallelism: false,
    env: {
      DATABASE_URL: TEST_DB_URL,
      SMTP_HOST: "",
      APP_URL: "http://localhost:3100",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 4: Создать global setup, который поднимает схему**

Создать `tests/global-setup.ts`:

```ts
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export default function setup() {
  const dir = path.resolve(__dirname, ".tmp");
  fs.mkdirSync(dir, { recursive: true });
  const url = `file:${path.join(dir, "test.db")}`;

  execSync("npx prisma db push --force-reset --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}
```

- [ ] **Step 5: Создать хелпер очистки базы**

Создать `tests/helpers/db.ts`. Порядок удаления важен: сначала зависимые таблицы.

```ts
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
```

- [ ] **Step 6: Написать падающий тест на хелпер**

Создать `tests/helpers/db.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "./db";

describe("resetDb", () => {
  beforeEach(resetDb);

  it("удаляет пользователей, оставшихся от прошлого теста", async () => {
    await prisma.user.create({
      data: { email: "leftover@example.com", role: "WORKER" },
    });
    expect(await prisma.user.count()).toBe(1);

    await resetDb();

    expect(await prisma.user.count()).toBe(0);
  });
});
```

- [ ] **Step 7: Запустить тест и убедиться, что он проходит**

Run: `npm test`
Expected: PASS, 1 тест. Если падает на «Environment variable not found: DATABASE_URL» —
значит `test.env` в конфиге не применился, проверить Step 3.

- [ ] **Step 8: Добавить тестовую базу в .gitignore**

Дописать в `.gitignore`:

```
tests/.tmp/
```

- [ ] **Step 9: Коммит**

```bash
git add vitest.config.ts tests package.json package-lock.json .gitignore
git commit -m "Тесты: vitest на отдельной SQLite-базе и хелпер очистки"
```

---

### Task 2: Схема организаций и членств

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/db.ts`
- Create: `lib/domain/orgs.ts`
- Create: `tests/domain/orgs.test.ts`
- Modify: `tests/helpers/db.ts`

**Interfaces:**
- Consumes: `resetDb`, `prisma` из `tests/helpers/db.ts`.
- Produces:
  - `createOrg(input: { type: "CLIENT" | "AGENCY"; name: string; legalName?: string; inn?: string; ownerUserId: string }): Promise<Org>`
  - `addMember(orgId: string, userId: string, role: "OWNER" | "MANAGER" | "SUPERVISOR"): Promise<void>`

- [ ] **Step 1: Добавить модели в схему**

В `prisma/schema.prisma` добавить:

```prisma
model Org {
  id        String   @id @default(cuid())
  type      String   // "CLIENT" | "AGENCY"
  name      String
  legalName String?
  inn       String?
  verified  Boolean  @default(false)
  createdAt DateTime @default(now())

  memberships Membership[]
}

model Membership {
  userId    String
  orgId     String
  role      String   // "OWNER" | "MANAGER" | "SUPERVISOR"
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  org  Org  @relation(fields: [orgId], references: [id], onDelete: Cascade)

  @@id([userId, orgId])
  @@index([orgId])
}
```

В модель `User` дописать связь:

```prisma
  memberships Membership[]
```

Обратной связи на `Representation` здесь намеренно нет: этой модели ещё не
существует, схема с ней не пройдёт валидацию. Связь добавляется в Task 4.

- [ ] **Step 2: Создать миграцию**

Run: `npx prisma migrate dev --name add_orgs_and_memberships`
Expected: миграция создана, `prisma generate` отработал.

- [ ] **Step 3: Включить WAL для конкурентной записи**

Спека требует режим WAL: писать будут несколько агентств одновременно.
Заменить содержимое `lib/db.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  walEnabled?: boolean;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// SQLite по умолчанию блокирует базу целиком на запись.
// WAL позволяет читать во время записи — при нескольких агентствах это обязательно.
if (!globalForPrisma.walEnabled) {
  globalForPrisma.walEnabled = true;
  prisma.$executeRawUnsafe("PRAGMA journal_mode=WAL;").catch((e) => {
    console.error("Не удалось включить WAL:", e);
  });
}
```

- [ ] **Step 4: Дополнить хелпер очистки**

В `tests/helpers/db.ts` в начало `resetDb` (до `prisma.user.deleteMany()`) добавить:

```ts
  await prisma.membership.deleteMany();
  await prisma.org.deleteMany();
```

Порядок: членства до организаций, организации до пользователей.

- [ ] **Step 5: Написать падающие тесты**

Создать `tests/domain/orgs.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg, addMember } from "@/lib/domain/orgs";

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, role: "WORKER" } });
}

describe("createOrg", () => {
  beforeEach(resetDb);

  it("создаёт организацию и делает создателя владельцем", async () => {
    const user = await makeUser("owner@example.com");

    const org = await createOrg({
      type: "AGENCY",
      name: "Кадры-Сервис",
      inn: "7712345678",
      ownerUserId: user.id,
    });

    expect(org.type).toBe("AGENCY");
    expect(org.name).toBe("Кадры-Сервис");

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("OWNER");
  });

  it("создаёт агентство неверифицированным", async () => {
    const user = await makeUser("agency@example.com");

    const org = await createOrg({
      type: "AGENCY",
      name: "Новое агентство",
      ownerUserId: user.id,
    });

    expect(org.verified).toBe(false);
  });
});

describe("addMember", () => {
  beforeEach(resetDb);

  it("добавляет супервайзера в организацию заказчика", async () => {
    const owner = await makeUser("hr@example.com");
    const supervisor = await makeUser("super@example.com");
    const org = await createOrg({
      type: "CLIENT",
      name: "Отель Заря",
      ownerUserId: owner.id,
    });

    await addMember(org.id, supervisor.id, "SUPERVISOR");

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: supervisor.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("SUPERVISOR");
  });

  it("повторное добавление меняет роль, а не падает", async () => {
    const owner = await makeUser("hr2@example.com");
    const person = await makeUser("person@example.com");
    const org = await createOrg({
      type: "CLIENT",
      name: "Отель Восток",
      ownerUserId: owner.id,
    });

    await addMember(org.id, person.id, "SUPERVISOR");
    await addMember(org.id, person.id, "MANAGER");

    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: person.id, orgId: org.id } },
    });
    expect(membership?.role).toBe("MANAGER");
    expect(await prisma.membership.count({ where: { orgId: org.id } })).toBe(2);
  });
});
```

- [ ] **Step 6: Запустить тесты и убедиться, что падают**

Run: `npm test`
Expected: FAIL — «Failed to resolve import "@/lib/domain/orgs"».

- [ ] **Step 7: Реализовать доменный модуль**

Создать `lib/domain/orgs.ts`:

```ts
import { prisma } from "@/lib/db";

export type OrgType = "CLIENT" | "AGENCY";
export type MemberRole = "OWNER" | "MANAGER" | "SUPERVISOR";

export async function createOrg(input: {
  type: OrgType;
  name: string;
  legalName?: string;
  inn?: string;
  ownerUserId: string;
}) {
  const org = await prisma.org.create({
    data: {
      type: input.type,
      name: input.name,
      legalName: input.legalName ?? null,
      inn: input.inn ?? null,
    },
  });

  await addMember(org.id, input.ownerUserId, "OWNER");

  return org;
}

export async function addMember(
  orgId: string,
  userId: string,
  role: MemberRole,
) {
  await prisma.membership.upsert({
    where: { userId_orgId: { userId, orgId } },
    update: { role },
    create: { userId, orgId, role },
  });
}
```

- [ ] **Step 8: Запустить тесты и убедиться, что проходят**

Run: `npm test`
Expected: PASS, все тесты.

- [ ] **Step 9: Коммит**

```bash
git add prisma lib tests
git commit -m "Организации и членства: модель, домен, WAL для SQLite"
```

---

### Task 3: Перенос существующих HR-профилей в организации

Нынешние заказчики живут в `HRProfile`. Их нужно перевести в `Org(CLIENT)`, не
ломая работающий прод. `HRProfile` пока остаётся — удалим его в фазе 1, когда все
экраны переедут.

**Files:**
- Create: `lib/domain/migrate-hr-to-org.ts`
- Create: `tests/domain/migrate-hr-to-org.test.ts`
- Create: `scripts/migrate-hr-to-org.ts`

**Interfaces:**
- Consumes: `createOrg` из `lib/domain/orgs.ts`.
- Produces: `migrateHrProfilesToOrgs(): Promise<{ created: number; skipped: number }>`

- [ ] **Step 1: Написать падающие тесты**

Создать `tests/domain/migrate-hr-to-org.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { migrateHrProfilesToOrgs } from "@/lib/domain/migrate-hr-to-org";

async function makeHr(email: string, hotelName: string) {
  const user = await prisma.user.create({ data: { email, role: "HR" } });
  await prisma.hRProfile.create({
    data: { userId: user.id, hotelName, address: "Москва, Тверская, 1" },
  });
  return user;
}

describe("migrateHrProfilesToOrgs", () => {
  beforeEach(resetDb);

  it("создаёт организацию-заказчика и делает HR владельцем", async () => {
    const user = await makeHr("hr@example.com", "Отель Заря");

    const result = await migrateHrProfilesToOrgs();

    expect(result.created).toBe(1);
    const org = await prisma.org.findFirst({ where: { name: "Отель Заря" } });
    expect(org?.type).toBe("CLIENT");
    const membership = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: user.id, orgId: org!.id } },
    });
    expect(membership?.role).toBe("OWNER");
  });

  it("организация заказчика сразу верифицирована", async () => {
    await makeHr("hr2@example.com", "Отель Восток");

    await migrateHrProfilesToOrgs();

    const org = await prisma.org.findFirst({ where: { name: "Отель Восток" } });
    expect(org?.verified).toBe(true);
  });

  it("повторный запуск не создаёт дублей", async () => {
    await makeHr("hr3@example.com", "Отель Север");

    await migrateHrProfilesToOrgs();
    const second = await migrateHrProfilesToOrgs();

    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(await prisma.org.count()).toBe(1);
  });
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npm test tests/domain/migrate-hr-to-org.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать миграцию**

Создать `lib/domain/migrate-hr-to-org.ts`:

```ts
import { prisma } from "@/lib/db";
import { createOrg } from "./orgs";

/**
 * Переводит существующие HRProfile в Org(CLIENT) + Membership(OWNER).
 * Идемпотентна: HR, у которого уже есть членство в организации-заказчике, пропускается.
 */
export async function migrateHrProfilesToOrgs() {
  const profiles = await prisma.hRProfile.findMany();
  let created = 0;
  let skipped = 0;

  for (const profile of profiles) {
    const existing = await prisma.membership.findFirst({
      where: { userId: profile.userId, org: { type: "CLIENT" } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const org = await createOrg({
      type: "CLIENT",
      name: profile.hotelName,
      ownerUserId: profile.userId,
    });
    // Заказчиков, заведённых до появления модерации, считаем проверенными.
    await prisma.org.update({
      where: { id: org.id },
      data: { verified: true },
    });
    created++;
  }

  return { created, skipped };
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что проходят**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Создать скрипт запуска на проде**

Создать `scripts/migrate-hr-to-org.ts`:

```ts
import { migrateHrProfilesToOrgs } from "../lib/domain/migrate-hr-to-org";

migrateHrProfilesToOrgs()
  .then((r) => {
    console.log(`Создано организаций: ${r.created}, пропущено: ${r.skipped}`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
```

Запускается на сервере как `npx tsx scripts/migrate-hr-to-org.ts` после деплоя.

- [ ] **Step 6: Коммит**

```bash
git add lib/domain/migrate-hr-to-org.ts tests/domain/migrate-hr-to-org.test.ts scripts
git commit -m "Перенос HR-профилей в организации-заказчики"
```

---

### Task 4: Представительство работника агентством

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `lib/domain/representation.ts`
- Create: `tests/domain/representation.test.ts`
- Modify: `tests/helpers/db.ts`

**Interfaces:**
- Consumes: `createOrg` из `lib/domain/orgs.ts`.
- Produces:
  - `inviteWorker(agencyId: string, email: string): Promise<{ representationId: string; url: string }>`
  - `activateRepresentation(workerUserId: string, agencyId: string): Promise<void>`
  - `revokeRepresentation(workerUserId: string, agencyId: string): Promise<void>`
  - `activeAgencyIds(workerUserId: string): Promise<string[]>`

- [ ] **Step 1: Добавить модель в схему**

В `prisma/schema.prisma` добавить:

```prisma
model Representation {
  id          String    @id @default(cuid())
  workerId    String
  agencyId    String
  status      String    @default("PENDING") // "PENDING" | "ACTIVE" | "REVOKED"
  createdAt   DateTime  @default(now())
  activatedAt DateTime?
  revokedAt   DateTime?

  worker WorkerProfile @relation(fields: [workerId], references: [userId], onDelete: Cascade)
  agency Org           @relation("AgencyRepresentations", fields: [agencyId], references: [id], onDelete: Cascade)

  @@unique([workerId, agencyId])
  @@index([agencyId, status])
}
```

Вернуть в модель `Org` строку, убранную в Task 2:

```prisma
  representations Representation[] @relation("AgencyRepresentations")
```

В модель `WorkerProfile` дописать:

```prisma
  representations Representation[]
```

В модель `MagicLink` дописать поле — по нему приглашение связывается с агентством:

```prisma
  agencyId String?
```

- [ ] **Step 2: Создать миграцию**

Run: `npx prisma migrate dev --name add_representation`
Expected: миграция создана.

- [ ] **Step 3: Дополнить хелпер очистки**

В `tests/helpers/db.ts` добавить строку перед удалением `workerProfile`:

```ts
  await prisma.representation.deleteMany();
```

- [ ] **Step 4: Написать падающие тесты**

Создать `tests/domain/representation.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg } from "@/lib/domain/orgs";
import {
  inviteWorker,
  activateRepresentation,
  revokeRepresentation,
  activeAgencyIds,
} from "@/lib/domain/representation";

async function makeAgency(name: string) {
  const owner = await prisma.user.create({
    data: { email: `${name}@example.com`, role: "WORKER" },
  });
  return createOrg({ type: "AGENCY", name, ownerUserId: owner.id });
}

async function makeWorker(email: string) {
  const user = await prisma.user.create({ data: { email, role: "WORKER" } });
  await prisma.workerProfile.create({ data: { userId: user.id } });
  return user;
}

describe("inviteWorker", () => {
  beforeEach(resetDb);

  it("создаёт magic-link, привязанный к агентству", async () => {
    const agency = await makeAgency("Кадры");

    const result = await inviteWorker(agency.id, "Nina@Example.COM");

    const link = await prisma.magicLink.findFirst({
      where: { email: "nina@example.com" },
    });
    expect(link?.agencyId).toBe(agency.id);
    expect(link?.role).toBe("WORKER");
    expect(result.url).toContain(link!.token);
  });

  it("не создаёт представительство до активации аккаунта", async () => {
    const agency = await makeAgency("Кадры2");

    await inviteWorker(agency.id, "new@example.com");

    expect(await prisma.representation.count()).toBe(0);
  });

  it("для уже существующего работника создаёт представительство в статусе PENDING", async () => {
    const agency = await makeAgency("Кадры3");
    const worker = await makeWorker("known@example.com");

    await inviteWorker(agency.id, "known@example.com");

    const rep = await prisma.representation.findUnique({
      where: {
        workerId_agencyId: { workerId: worker.id, agencyId: agency.id },
      },
    });
    expect(rep?.status).toBe("PENDING");
  });
});

describe("activateRepresentation", () => {
  beforeEach(resetDb);

  it("переводит представительство в ACTIVE и ставит дату", async () => {
    const agency = await makeAgency("Кадры4");
    const worker = await makeWorker("w1@example.com");

    await activateRepresentation(worker.id, agency.id);

    const rep = await prisma.representation.findUnique({
      where: {
        workerId_agencyId: { workerId: worker.id, agencyId: agency.id },
      },
    });
    expect(rep?.status).toBe("ACTIVE");
    expect(rep?.activatedAt).toBeInstanceOf(Date);
  });

  it("повторный вызов не создаёт дубль", async () => {
    const agency = await makeAgency("Кадры5");
    const worker = await makeWorker("w2@example.com");

    await activateRepresentation(worker.id, agency.id);
    await activateRepresentation(worker.id, agency.id);

    expect(await prisma.representation.count()).toBe(1);
  });
});

describe("revokeRepresentation", () => {
  beforeEach(resetDb);

  it("ставит статус REVOKED и дату отзыва", async () => {
    const agency = await makeAgency("Кадры6");
    const worker = await makeWorker("w3@example.com");
    await activateRepresentation(worker.id, agency.id);

    await revokeRepresentation(worker.id, agency.id);

    const rep = await prisma.representation.findUnique({
      where: {
        workerId_agencyId: { workerId: worker.id, agencyId: agency.id },
      },
    });
    expect(rep?.status).toBe("REVOKED");
    expect(rep?.revokedAt).toBeInstanceOf(Date);
  });

  it("не удаляет запись — история работника остаётся при нём", async () => {
    const agency = await makeAgency("Кадры7");
    const worker = await makeWorker("w4@example.com");
    await activateRepresentation(worker.id, agency.id);

    await revokeRepresentation(worker.id, agency.id);

    expect(await prisma.representation.count()).toBe(1);
  });
});

describe("activeAgencyIds", () => {
  beforeEach(resetDb);

  it("возвращает только активные представительства", async () => {
    const a1 = await makeAgency("Первое");
    const a2 = await makeAgency("Второе");
    const worker = await makeWorker("w5@example.com");

    await activateRepresentation(worker.id, a1.id);
    await activateRepresentation(worker.id, a2.id);
    await revokeRepresentation(worker.id, a2.id);

    expect(await activeAgencyIds(worker.id)).toEqual([a1.id]);
  });

  it("для работника без агентств возвращает пустой список", async () => {
    const worker = await makeWorker("w6@example.com");

    expect(await activeAgencyIds(worker.id)).toEqual([]);
  });
});
```

- [ ] **Step 5: Запустить тесты и убедиться, что падают**

Run: `npm test tests/domain/representation.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 6: Реализовать доменный модуль**

Создать `lib/domain/representation.ts`:

```ts
import { prisma } from "@/lib/db";
import { createMagicLink } from "@/lib/auth-token";

/**
 * Агентство приглашает работника. Учётную запись за человека мы не заводим:
 * передача нам его контактов третьей стороной без согласия запрещена (152-ФЗ).
 * Поэтому агентство отправляет приглашение, а профиль создаёт сам работник.
 */
export async function inviteWorker(agencyId: string, email: string) {
  const normalized = email.toLowerCase().trim();

  const { url, token } = await createMagicLink(normalized, "WORKER", agencyId);

  // Если человек уже зарегистрирован — представительство заводим сразу,
  // но в статусе PENDING: подтвердит он сам, перейдя по ссылке.
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    include: { workerProfile: true },
  });

  let representationId = "";
  if (user?.workerProfile) {
    const rep = await prisma.representation.upsert({
      where: { workerId_agencyId: { workerId: user.id, agencyId } },
      update: {},
      create: { workerId: user.id, agencyId, status: "PENDING" },
    });
    representationId = rep.id;
  }

  return { representationId, url, token };
}

export async function activateRepresentation(
  workerUserId: string,
  agencyId: string,
) {
  await prisma.representation.upsert({
    where: { workerId_agencyId: { workerId: workerUserId, agencyId } },
    update: { status: "ACTIVE", activatedAt: new Date(), revokedAt: null },
    create: {
      workerId: workerUserId,
      agencyId,
      status: "ACTIVE",
      activatedAt: new Date(),
    },
  });
}

export async function revokeRepresentation(
  workerUserId: string,
  agencyId: string,
) {
  await prisma.representation.updateMany({
    where: { workerId: workerUserId, agencyId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
}

export async function activeAgencyIds(workerUserId: string) {
  const rows = await prisma.representation.findMany({
    where: { workerId: workerUserId, status: "ACTIVE" },
    select: { agencyId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.agencyId);
}
```

- [ ] **Step 7: Вынести создание magic-link из lib/auth.ts**

`lib/auth.ts` импортирует `next/headers`, поэтому в тестах не грузится.
Создать `lib/auth-token.ts` и перенести туда `generateToken`, `createMagicLink`,
`consumeMagicLink` из `lib/auth.ts` — они не работают с куками. Добавить в
`createMagicLink` третий параметр:

```ts
import { randomBytes } from "crypto";
import { prisma } from "./db";
import { sendEmail } from "./email";

const MAGIC_TTL_MIN = 15;

export function generateToken() {
  return randomBytes(32).toString("hex");
}

// "HR" остаётся в объединении, пока Task 5 не переведёт вызовы на "CLIENT":
// без него сборка сломается между задачами.
export async function createMagicLink(
  email: string,
  role?: "WORKER" | "AGENCY" | "CLIENT" | "HR",
  agencyId?: string,
) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MIN * 60_000);
  await prisma.magicLink.create({
    data: {
      email: email.toLowerCase().trim(),
      token,
      role,
      agencyId: agencyId ?? null,
      expiresAt,
    },
  });
  const url = `${process.env.APP_URL ?? "http://localhost:3100"}/auth/verify?token=${token}`;
  const html = `
    <p>Здравствуйте,</p>
    <p>Чтобы войти в HoReCaGo, перейдите по ссылке (действует 15 минут):</p>
    <p><a href="${url}">${url}</a></p>
    <p>Если вы не запрашивали ссылку — просто проигнорируйте письмо.</p>
  `;
  await sendEmail(email, "Вход в HoReCaGo", html, `Войти: ${url}`);
  if (!process.env.SMTP_HOST) {
    console.log("\n=== MAGIC LINK ===");
    console.log(`To: ${email}`);
    console.log(`URL: ${url}`);
    console.log("==================\n");
  }
  return { token, url };
}

export async function consumeMagicLink(token: string) {
  const link = await prisma.magicLink.findUnique({ where: { token } });
  if (!link || link.used || link.expiresAt < new Date()) return null;
  await prisma.magicLink.update({ where: { token }, data: { used: true } });
  return link;
}
```

В `lib/auth.ts` удалить перенесённые функции и добавить реэкспорт, чтобы
существующие импорты не сломались:

```ts
export { generateToken, createMagicLink, consumeMagicLink } from "./auth-token";
```

- [ ] **Step 8: Запустить тесты и убедиться, что проходят**

Run: `npm test`
Expected: PASS, все файлы.

- [ ] **Step 9: Проверить, что приложение собирается**

Run: `npm run build`
Expected: сборка без ошибок. Если TypeScript ругается на импорт
`createMagicLink` — проверить реэкспорт из Step 7.

- [ ] **Step 10: Коммит**

```bash
git add prisma lib tests
git commit -m "Представительство: агентство представляет работника, не владеет им"
```

---

### Task 5: Три входа при регистрации

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/auth/verify/route.ts`
- Create: `app/onboarding/agency/page.tsx`
- Create: `app/onboarding/agency/actions.ts`
- Create: `tests/domain/signup-role.test.ts`
- Create: `lib/domain/signup.ts`

**Interfaces:**
- Consumes: `activateRepresentation` из `lib/domain/representation.ts`,
  `createOrg` из `lib/domain/orgs.ts`, `consumeMagicLink` из `lib/auth-token.ts`.
- Produces: `resolveSignupTarget(link: { role: string | null; agencyId: string | null }, isNewUser: boolean): string`
  — возвращает путь, куда отправить человека после перехода по ссылке.

- [ ] **Step 1: Написать падающие тесты на выбор маршрута**

Создать `tests/domain/signup-role.test.ts`:

```ts
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
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npm test tests/domain/signup-role.test.ts`
Expected: FAIL — модуль `@/lib/domain/signup` не найден.

- [ ] **Step 3: Реализовать выбор маршрута**

Создать `lib/domain/signup.ts`:

```ts
export type SignupRole = "WORKER" | "AGENCY" | "CLIENT";

export function resolveSignupTarget(
  link: { role: string | null; agencyId: string | null },
  isNewUser: boolean,
): string {
  if (!isNewUser) return "/";

  switch (link.role) {
    case "AGENCY":
      return "/onboarding/agency";
    case "CLIENT":
      return "/onboarding/hr";
    case "WORKER":
      return "/onboarding/worker";
    default:
      return "/";
  }
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что проходят**

Run: `npm test tests/domain/signup-role.test.ts`
Expected: PASS, 6 тестов.

- [ ] **Step 5: Прочитать текущие роуты входа**

Run: `cat app/login/page.tsx app/api/auth/login/route.ts app/auth/verify/route.ts`

Задача следующих шагов: там, где сейчас выбор из двух ролей `HR` / `WORKER`,
сделать три — работник, агентство, заказчик, — и применить `resolveSignupTarget`
после `consumeMagicLink`. Старое значение `HR` продолжает приходить со
существующих ссылок: трактовать его как `CLIENT`.

- [ ] **Step 6: Обновить форму входа на три роли**

В `app/login/page.tsx` заменить переключатель ролей на три варианта. Подписи:

- «Ищу работу» → значение `WORKER`
- «Кадровое агентство» → значение `AGENCY`
- «Отель или ресторан» → значение `CLIENT`

Значение уходит в существующий POST на `/api/auth/login` тем же полем `role`.

- [ ] **Step 7: Разрешить новые роли в API входа**

В `app/api/auth/login/route.ts` в месте, где роль валидируется, разрешить
значения `WORKER`, `AGENCY`, `CLIENT`, а пришедшее `HR` привести к `CLIENT`:

```ts
const raw = String(body.role ?? "");
const role =
  raw === "HR" ? "CLIENT" :
  raw === "AGENCY" || raw === "CLIENT" || raw === "WORKER" ? raw :
  undefined;
```

- [ ] **Step 8: Применить маршрутизацию после перехода по ссылке**

В `app/auth/verify/route.ts` после `consumeMagicLink` и создания пользователя:

```ts
import { resolveSignupTarget } from "@/lib/domain/signup";
import { activateRepresentation } from "@/lib/domain/representation";

// ...после того как пользователь найден или создан, где isNewUser — признак создания:
if (link.agencyId && link.role === "WORKER") {
  await activateRepresentation(user.id, link.agencyId);
}

const target = resolveSignupTarget(
  { role: link.role, agencyId: link.agencyId },
  isNewUser,
);
return NextResponse.redirect(new URL(target, request.url));
```

Активация представительства происходит именно здесь: человек перешёл по ссылке
и тем самым подтвердил связь с агентством сам.

- [ ] **Step 9: Создать онбординг агентства**

Создать `app/onboarding/agency/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createOrg } from "@/lib/domain/orgs";

export async function saveAgencyOnboarding(formData: FormData) {
  const user = await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  const contactName = String(formData.get("contactName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const legalName = String(formData.get("legalName") ?? "").trim() || undefined;
  const inn = String(formData.get("inn") ?? "").trim() || undefined;

  if (!name) redirect("/onboarding/agency?error=name");

  await prisma.user.update({
    where: { id: user.id },
    data: { name: contactName, phone },
  });

  await createOrg({ type: "AGENCY", name, legalName, inn, ownerUserId: user.id });

  redirect("/agency");
}
```

Создать `app/onboarding/agency/page.tsx` — форма по образцу
`app/onboarding/hr/page.tsx`, поля: название агентства (`name`), контактное лицо
(`contactName`), телефон (`phone`), юридическое лицо (`legalName`), ИНН (`inn`).
Под формой — строка: «После заполнения мы проверим агентство. Заявки заказчиков
станут видны после проверки.»

Страница `/agency` появится в Task 6; до этого редирект приведёт на 404 — это
ожидаемо и чинится следующей задачей.

- [ ] **Step 10: Проверить сборку и тесты**

Run: `npm test && npm run build`
Expected: тесты PASS, сборка без ошибок.

- [ ] **Step 11: Коммит**

```bash
git add app lib tests
git commit -m "Три входа при регистрации: работник, агентство, заказчик"
```

---

### Task 6: Кабинет агентства и верификация в админке

**Files:**
- Create: `app/agency/page.tsx`
- Create: `app/agency/actions.ts`
- Create: `app/admin/orgs/page.tsx`
- Create: `app/admin/orgs/actions.ts`
- Create: `lib/domain/access.ts`
- Create: `tests/domain/access.test.ts`

**Interfaces:**
- Consumes: `activeAgencyIds`, `inviteWorker` из `lib/domain/representation.ts`.
- Produces:
  - `agencyIdsOf(userId: string): Promise<string[]>` — агентства, где пользователь состоит
  - `clientOrgIdsOf(userId: string): Promise<string[]>`
  - `isAdmin(email: string): boolean`

- [ ] **Step 1: Написать падающие тесты на доступы**

Создать `tests/domain/access.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma, resetDb } from "../helpers/db";
import { createOrg, addMember } from "@/lib/domain/orgs";
import { agencyIdsOf, clientOrgIdsOf, isAdmin } from "@/lib/domain/access";

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, role: "WORKER" } });
}

describe("agencyIdsOf", () => {
  beforeEach(resetDb);

  it("возвращает агентства, где пользователь состоит", async () => {
    const user = await makeUser("a@example.com");
    const agency = await createOrg({
      type: "AGENCY",
      name: "Кадры",
      ownerUserId: user.id,
    });

    expect(await agencyIdsOf(user.id)).toEqual([agency.id]);
  });

  it("не возвращает организации заказчиков", async () => {
    const user = await makeUser("b@example.com");
    await createOrg({ type: "CLIENT", name: "Отель", ownerUserId: user.id });

    expect(await agencyIdsOf(user.id)).toEqual([]);
  });
});

describe("clientOrgIdsOf", () => {
  beforeEach(resetDb);

  it("возвращает организации заказчиков, включая роль супервайзера", async () => {
    const owner = await makeUser("owner@example.com");
    const supervisor = await makeUser("sup@example.com");
    const org = await createOrg({
      type: "CLIENT",
      name: "Отель Заря",
      ownerUserId: owner.id,
    });
    await addMember(org.id, supervisor.id, "SUPERVISOR");

    expect(await clientOrgIdsOf(supervisor.id)).toEqual([org.id]);
  });
});

describe("isAdmin", () => {
  it("узнаёт администратора по списку из переменной окружения", () => {
    process.env.ADMIN_EMAILS = "boss@example.com, second@example.com";

    expect(isAdmin("boss@example.com")).toBe(true);
    expect(isAdmin("BOSS@example.com")).toBe(true);
    expect(isAdmin("second@example.com")).toBe(true);
    expect(isAdmin("stranger@example.com")).toBe(false);
  });

  it("при пустом списке не пускает никого", () => {
    process.env.ADMIN_EMAILS = "";

    expect(isAdmin("boss@example.com")).toBe(false);
  });
});
```

- [ ] **Step 2: Запустить тесты и убедиться, что падают**

Run: `npm test tests/domain/access.test.ts`
Expected: FAIL — модуль не найден.

- [ ] **Step 3: Реализовать модуль доступов**

Создать `lib/domain/access.ts`:

```ts
import { prisma } from "@/lib/db";

async function orgIdsOf(userId: string, type: "CLIENT" | "AGENCY") {
  const rows = await prisma.membership.findMany({
    where: { userId, org: { type } },
    select: { orgId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.orgId);
}

export function agencyIdsOf(userId: string) {
  return orgIdsOf(userId, "AGENCY");
}

export function clientOrgIdsOf(userId: string) {
  return orgIdsOf(userId, "CLIENT");
}

export function isAdmin(email: string) {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
```

- [ ] **Step 4: Запустить тесты и убедиться, что проходят**

Run: `npm test tests/domain/access.test.ts`
Expected: PASS, 5 тестов.

- [ ] **Step 5: Создать действия кабинета агентства**

Создать `app/agency/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { agencyIdsOf } from "@/lib/domain/access";
import { inviteWorker } from "@/lib/domain/representation";

export async function sendWorkerInvite(formData: FormData) {
  const user = await requireUser();
  const [agencyId] = await agencyIdsOf(user.id);
  if (!agencyId) return;

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return;

  await inviteWorker(agencyId, email);
  revalidatePath("/agency");
}
```

- [ ] **Step 6: Создать страницу кабинета агентства**

Создать `app/agency/page.tsx`. Серверный компонент, оформление — как на
существующих страницах (`app/hr/page.tsx` как образец). Содержимое:

- Заголовок с названием агентства.
- Если `org.verified === false` — жёлтая плашка: «Агентство на проверке. Заявки
  заказчиков станут видны после неё — обычно в течение рабочего дня.»
- Форма приглашения работника: одно поле `email` и кнопка «Пригласить».
  Под формой пояснение: «Мы отправим человеку ссылку. Профиль он заполнит сам —
  передавать нам чужие контакты списком закон не позволяет.»
- Список представительств: таблица «работник — статус — дата». Статусы выводить
  по-русски: PENDING → «Ждём подтверждения», ACTIVE → «Работает с вами»,
  REVOKED → «Отозвано».

Данные брать так:

```ts
const [agencyId] = await agencyIdsOf(user.id);
const org = await prisma.org.findUnique({ where: { id: agencyId } });
const reps = await prisma.representation.findMany({
  where: { agencyId },
  include: { worker: { include: { user: true } } },
  orderBy: { createdAt: "desc" },
});
```

- [ ] **Step 7: Создать действие верификации в админке**

Создать `app/admin/orgs/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/domain/access";

export async function setOrgVerified(formData: FormData) {
  const user = await requireUser();
  if (!isAdmin(user.email)) return;

  const orgId = String(formData.get("orgId"));
  const verified = String(formData.get("verified")) === "true";

  await prisma.org.update({ where: { id: orgId }, data: { verified } });
  revalidatePath("/admin/orgs");
}
```

- [ ] **Step 8: Создать страницу админки**

Создать `app/admin/orgs/page.tsx`. Серверный компонент:

```ts
const user = await requireUser();
if (!isAdmin(user.email)) redirect("/");

const orgs = await prisma.org.findMany({
  orderBy: [{ verified: "asc" }, { createdAt: "desc" }],
  include: { memberships: { include: { user: true }, where: { role: "OWNER" } } },
});
```

Таблица: название, тип («Заказчик» / «Агентство»), ИНН, владелец (имя и почта),
статус. У непроверенных — кнопка «Проверено», у проверенных — «Снять проверку».
Обе отправляют форму в `setOrgVerified` с полями `orgId` и `verified`.

- [ ] **Step 9: Добавить переменную окружения**

Дописать в `.env` и в `.env.example` (создать, если его нет):

```
ADMIN_EMAILS=snezon@gmail.com
```

На проде переменную добавить в окружение systemd-юнита `horecago.service`.

- [ ] **Step 10: Проверить тесты и сборку**

Run: `npm test && npm run build`
Expected: тесты PASS, сборка без ошибок.

- [ ] **Step 11: Проверить руками**

Run: `npm run dev`

Пройти путь целиком:
1. Открыть `/login`, выбрать «Кадровое агентство», ввести почту.
2. Взять ссылку из консоли, перейти, заполнить онбординг агентства.
3. Убедиться, что на `/agency` висит плашка «на проверке».
4. Войти под администратором, на `/admin/orgs` нажать «Проверено».
5. Вернуться в кабинет агентства, пригласить работника по почте.
6. Взять ссылку приглашения из консоли, перейти в другом браузере,
   заполнить профиль работника.
7. Убедиться, что в кабинете агентства представительство стало «Работает с вами».

- [ ] **Step 12: Коммит**

```bash
git add app lib tests .env.example
git commit -m "Кабинет агентства, приглашения работников и верификация в админке"
```

---

## Что остаётся за пределами фазы 0

- `HRProfile` не удаляется: экраны заказчика переезжают на `Org` в фазе 1.
- `User.role` продолжает использоваться существующими экранами. Источником истины
  он перестанет быть в фазе 1, когда `Requirement` и `Assignment` будут работать
  через членства.
- Потребности, смены, назначения, карантин 45 дней, автоподтверждение — фаза 1,
  отдельный план.
