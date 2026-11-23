# BugBoard QA (Playwright)

Автотести для https://bugboard.xyz: API і браузер (Chromium).

## 1. Перший запуск

```
npm install
npx playwright install chromium
```

Файл `.env` прихований. Відкрийте його через `code .env` або через дерево файлів редактора, не через
Finder. Там уже стоять `BASE_URL`, `WEB_URL` і `OPENAPI_SOURCE`. Паролі не потрібні: тести самі
реєструють користувача `admin` (з приватним workspace) один раз за прогін.

## 2. Команди

| Що | Команда |
|---|---|
| Усі тести | `npm test` |
| Лише API | `npm run test:api` |
| Один домен | `npx playwright test --project=api-health` (`api-<домен>` з'являється з першим тестом домену) |
| Smoke | `npm run test:smoke` |
| Юніт-тести утиліт | `npm run test:unit` |
| Відкрити HTML-звіт | `npm run report` |
| Перевірка типів | `npm run typecheck` |
| Перевірка стилю (ESLint) | `npm run lint` |
| Оновити типи з OpenAPI | `npm run types:api` |

Зірочку в назві проєкту пишіть у лапках: `--project="api-*"`.

## 3. Як читати червоний прогін

- Перший рядок помилки це причина.
- «did not run» означає, що впав `setup`: спочатку читайте його помилку. Проєкт `api-health` від
  `setup` не залежить і працює завжди.
- `Missing in .env: ...` називає, що треба заповнити.

## 4. Проблеми з логіном

Видаліть папку `.auth/` і запустіть знову. Тоді `admin` зареєструється наново, а старий акаунт
залишиться на сервері (його email починається з `qa-pw-admin-`). Логін має ліміт (429): якщо його
досягли, зачекайте кілька секунд.

## 5. ESLint

Він читає код без запуску і зупиняє зміну, яка ламає правила з `eslint.config.mjs` (без
`waitForTimeout`, без кліків у спеках, імпорти через `@/fixtures`). `npm run lint` показує те саме,
що й CI.

## 6. CI

GitHub Actions (`.github/workflows/qa.yml`): ручний запуск із полями `project` і `grep`
(за замовчуванням `@smoke`) та запуск на кожен push у `main` (усі тести). Секрети не потрібні:
адреси записані в workflow, акаунт тести створюють самі. Сайт публічний, тож hosted runner його
бачить. HTML-звіт зберігається як артефакт `playwright-report` на 14 днів.

## 7. Публікація на GitHub

```
gh auth login
gh repo create <назва> --private --source . --push
```

Push запускає перший прогін CI.

## 8. Далі

Викличте `api-contract-writer` з ендпоінтом (наприклад `POST /auth/login`) або `e2e-writer` зі
сценарієм.
