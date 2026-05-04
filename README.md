# HoReCaGo

Сервис быстрого найма линейного персонала в отели и HoReCa-точки.

**Прод**: https://horecago.tech

## Идея

Соискатели и HR находят друг друга за минуты, а не недели:

- HR публикует вакансию с указанным числом мест (`headcount`)
- Соискатели откликаются одной кнопкой
- HR жмёт «Нанять» — счётчик уменьшается, при достижении headcount вакансия автоматически закрывается
- У уже откликнувшихся, но не нанятых, мягкий статус «Вакансия закрыта» — без жёсткого отказа

## Стек

- **Next.js 14** (App Router) + TypeScript + TailwindCSS
- **Prisma + SQLite** (`prisma/dev.db` локально, `/root/horecago-data/db/prod.db` на проде)
- **Magic-link auth** самописный (токен в URL, 15 мин TTL, sessions в куке 30 дней)
- **Nodemailer** через SMTP Mail.ru для бизнеса (`noreply@horecago.tech`)
- **Caddy 2** — reverse proxy + автоматический Let's Encrypt
- **systemd** — управление процессом
- **Ubuntu 24.04 LTS** на Timeweb VPS (`5.42.117.211`)

## Локальный запуск

```bash
npm ci
npx prisma migrate deploy
npx prisma db seed     # наполнит справочник из 13 позиций
npm run dev            # http://localhost:3100
```

В dev-режиме (без `SMTP_HOST` в `.env`) magic-link печатается в консоль и в UI после отправки формы — реальная почта не нужна.

`.env.example` (создай свой `.env`):
```
DATABASE_URL="file:./dev.db"
APP_URL="http://localhost:3100"
SESSION_SECRET="any-random-string"
```

## Архитектура

### Модели (Prisma)

- `User` — единый стол, разделён по `role` (`HR` / `WORKER`)
- `HRProfile` — название отеля, адрес
- `WorkerProfile` — описание, адрес, навыки, документы
- `Position` — справочник из 13 позиций (Горничная, Официант, Бармен, …)
- `WorkerSkill` — связь workers ↔ positions (на каких ролях работает)
- `Document` — паспорт / медкнижка / прочее, файлом
- `Vacancy` — `headcount`, `hiredCount`, `status: OPEN|CLOSED`
- `Application` — `status: PENDING|HIRED|REJECTED`
- `MagicLink`, `Session` — auth

### Страницы

| URL | Кто | Что |
|---|---|---|
| `/` | все | Лендинг с двумя CTA |
| `/login` | все | Magic-link форма |
| `/auth/verify` | callback | Обмен токена на сессию |
| `/onboarding/worker` | worker | Профиль соискателя |
| `/onboarding/hr` | hr | Профиль работодателя |
| `/feed` | worker | Лента открытых вакансий с фильтром по позициям |
| `/vacancy/[id]` | все | Детальная вакансия + кнопка «Откликнуться» |
| `/profile` | worker | Редактирование + загрузка документов |
| `/applications` | worker | Мои отклики |
| `/hr` | hr | Дашборд + список вакансий |
| `/hr/vacancies/new` | hr | Создание |
| `/hr/vacancies/[id]` | hr | Редактирование + список откликов с кнопками «Нанять»/«Отклонить» |

### Бизнес-правила

- **Контакты** видны обеим сторонам сразу после отклика (не после найма)
- **Документы** воркера видны HR в карточке отклика **до** найма
- **Найм** — HR жмёт «Нанять», `hiredCount += 1`, при `hiredCount === headcount` вакансия закрывается
- **PENDING-отклики на закрытой вакансии** остаются в БД, но воркеру показываются как «Вакансия закрыта» (мягкий статус, без жёсткого отказа)
- Один воркер не может откликнуться на одну и ту же вакансию дважды (`unique(vacancyId, workerId)`)

## Прод-инфра

### Сервер

- **Timeweb VPS** Ubuntu 24.04, 2GB RAM + 2GB swap, 38GB SSD
- IP: `5.42.117.211`
- SSH: только по ключу (`PasswordAuthentication no`)
- UFW: открыты порты 22, 80, 443

### Файловая раскладка

```
/root/horecago/                 # код (git-репо), деплой через rsync
/root/horecago-data/db/prod.db  # SQLite база (за пределами repo, не уносится при rsync)
/root/horecago-data/uploads/    # загруженные документы воркеров
```

`.env` на проде содержит `UPLOADS_DIR` и `DATABASE_URL` указывающие в `horecago-data/`, чтобы редеплой не трогал данные.

### systemd

`/etc/systemd/system/horecago.service` запускает `npm run start` (`next start -p 3100`) с `Restart=always`. Логи: `journalctl -u horecago -f`.

### Caddy

`/etc/caddy/Caddyfile`:
```
horecago.tech, www.horecago.tech {
    encode gzip zstd
    reverse_proxy localhost:3100
}
```

Caddy сам выпускает и продлевает Let's Encrypt сертификаты (за 30 дней до конца срока).

## DNS (reg.ru / ispmanager)

Записи на `horecago.tech`:
| Тип | Имя | Значение | Назначение |
|---|---|---|---|
| A | `@` | `5.42.117.211` | основной |
| A | `www` | `5.42.117.211` | редирект |
| MX | `@` | `emx.mail.ru` (prio 10) | Mail.ru |
| TXT | `@` | `mailru-domain: ...` | подтверждение Mail.ru |
| TXT | `@` | `v=spf1 redirect=_spf.mail.ru` | SPF |
| TXT | `mailru._domainkey` | `v=DKIM1; k=rsa; p=...` | DKIM |

**Важно**: AAAA-записи у домена удалены — иначе Let's Encrypt идёт по IPv6 на чужой сервер reg.ru-хостинга. **Не возвращать AAAA, пока не появится IPv6 на нашем VPS.**

## Email (Mail.ru для бизнеса)

- Подключён домен `horecago.tech`, ящик `noreply@horecago.tech`
- В настройках включён «SMTP по паролю» (отдельный пароль для приложений)
- В `.env` на проде: `SMTP_HOST=smtp.mail.ru`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER=noreply@horecago.tech`, `SMTP_PASS=...`, `SMTP_FROM=noreply@horecago.tech`

## Деплой

Из локали:

```bash
# Раскатать код
rsync -az \
  --exclude node_modules --exclude .next \
  --exclude prisma/dev.db --exclude prisma/dev.db-journal \
  --exclude uploads --exclude .env \
  ./ root@5.42.117.211:/root/horecago/

# Применить
ssh root@5.42.117.211 'cd /root/horecago && npm ci && npx prisma migrate deploy && npm run build && systemctl restart horecago'
```

Автоматики (CI/CD) пока нет — для MVP ручной rsync устраивает.

## Что было решено в первой сессии

- **Скоуп** — минимальный кликабельный MVP, без мультиучёток у HR, без карты, без верификации документов
- **БД** — SQLite (один файл, проще бэкап)
- **Дизайн** — нейтральный Tailwind с brand-палитрой `#0ea5e9` (sky), без копирования визуала Openslot
- **Найм** — HR жмёт «Нанять» (не автоматически), есть «Отклонить»
- **Закрытие вакансии** — мягкое: pending-отклики не помечаются REJECTED, воркеру показывается «Вакансия закрыта»
- **Документы** — простая загрузка файла без верификации, видны HR до принятия отклика
- **Контакты** — обе стороны видят друг друга сразу после отклика

## Бэклог (после MVP)

- Карта с пином отеля и гео-фильтр в ленте (Яндекс.Карты)
- SMS-логин для воркеров (магиклинк по email хуже работает с линейным персоналом)
- Уведомления HR о новых откликах (email / Telegram)
- Уведомления воркеру о найме / отказе
- Поиск вакансий по тексту
- Pagination в ленте
- Архив закрытых вакансий у HR
- Бэкапы SQLite (cron + rclone в облако)
- Sentry / health-чек / UptimeRobot
- CI: GitHub Actions → автодеплой на push в main
