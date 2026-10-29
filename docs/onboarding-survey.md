# Onboarding survey

`/onboarding` lets visitors explore club interests and signed-in users save, skip, or update their preferences. The sidebar and Explore provide links back to My preferences. This collects preferences for future recommendations; it does not implement a recommendation algorithm.

## Experience

1. Interests: choose up to five broad topics, any number of their optional detailed interests, and an optional major (100 characters).
2. Your pace: choose up to two main reasons for joining and an optional weekly time preference.
3. Review: check answers, save to the account, or return to edit.

Each selected detailed interest has an optional priority: **1 Prioritize**, **2 Interested** (default), or **3 Try sometime**. Ties are allowed across all categories. Review groups details by priority. Deselecting a detail or its parent removes its priority; reselecting starts at 2. The controls support native radio keyboard navigation.

All questions can be left blank. An empty saved submission is distinct from a skipped survey. Anonymous visitors may fill the form and sign in without losing the current-page draft, or skip directly to Explore. When an existing account and an anonymous draft both have answers, the user chooses which to edit. Unsaved drafts are held in memory and reset on navigation or refresh. Signing out or changing accounts clears the previous form.

Saved answers are loaded before editing. Read failure blocks saving until retried; save failure retains the draft and offers retry, without reporting success. Expired sessions offer reauthentication. A completed profile remains completed when skipped and its saved answers are preserved.

The removed club-type question remains as a legacy `club_category_ids` field in the JSON payload. Database updates preserve its existing value atomically, including when an anonymous draft or stale client sends an empty or different list. It is not displayed or editable in the new survey. The existing Explore organization-category filters are unchanged.

## Deployment

The existing Google login and PostgreSQL connection are reused. Apply **migration 009** to the same database after migrations 001–008 before using the new API. No existing user or subscription rows are rewritten.

From `web/`, with the existing `DATABASE_URL` and `GOOGLE_CLIENT_ID` configured in `.env.local`:

```sh
node --env-file=.env.local --import tsx scripts/migrate-survey.ts
npm run dev
```

The migration script applies 009 in a transaction. In hosted environments configure the same variables through the hosting provider and apply the migration through the database's normal deployment process. Never commit `.env.local` or credentials.

For local Google sign-in, the web OAuth client must authorize the origin being used. Google recommends `http://localhost` and `http://localhost:3000` for this setup. Use a standalone supported browser when an embedded browser is rejected. See [Google Identity Services setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

## API

All methods use `/api/profile/survey`, resolve the account from the existing HTTP-only session cookie, and respond with `{ "profile": { "status", "answers", "completed_at", "skipped_at", "updated_at" } }`. Timestamps are ISO strings or null. Responses are private and not cached.

- **GET** returns the current user's saved preferences. No row means `not_started` with null answers and timestamps.
- **PUT** replaces visible preferences and preserves any previously stored legacy club categories. All core fields must be present; arrays/null express no preference. Successful saves mark the profile `completed`. `completed_at` is the first successful submission; `updated_at` is the latest write. Concurrent saves use the last successful write for visible preferences.
- **POST** accepts exactly `{ "action": "skip" }`, recording skip time without clearing any saved answers. New profiles become `skipped`; completed profiles remain completed.

Example PUT body:

```json
{
  "survey_version": 2,
  "topic_ids": ["technology", "arts"],
  "subtopic_ids": ["technology:ai-data", "arts:music"],
  "subtopic_priorities": { "technology:ai-data": 1, "arts:music": 1 },
  "major_text": null,
  "club_category_ids": [],
  "goal_ids": ["friends", "career"],
  "weekly_commitment": "1-3"
}
```

`subtopic_priorities` is an optional additive v2 field. Older payloads/rows are accepted and missing selected-interest entries default to 2 on read or submission. No historical data backfill is required. Priority entries must refer to selected details and have numeric values 1–3. Unknown IDs, duplicate selections, unknown/missing core fields, unsupported versions, orphaned details and excessive topic/goal selections are rejected. Weekly time is `under-1`, `1-3`, `4-6`, `7-plus`, or null. Detailed interests have no artificial count limit.

Errors: **400** invalid JSON/answers or a body exceeding 8192 bytes; **401** no valid session; **403** cross-site writes; **415** non-JSON writes; **503** temporary storage/auth lookup failure. Responses and logs do not expose answers or database credentials. The table has one row per user and is deleted when that user is deleted.

## Validation

From `web/`:

```sh
node --import tsx --test lib/survey.test.ts lib/server/survey.integration.test.ts
npx tsc --noEmit --incremental false
npm run build
```

Unit/API tests exercise optional answers, option/parent validation, priorities/defaults/ties, authentication ownership, malformed requests and failure responses. The isolated PostgreSQL test skips unless `SURVEY_TEST_DATABASE_URL` explicitly points to a disposable database; it creates and removes its own schema.

The real-storage verification script uses the configured database inside a rollback-only transaction with temporary test accounts. It covers save/read/update, isolation, skip preservation, legacy categories and priority compatibility, and confirms temporary users are not retained:

```sh
node --env-file=.env.local --import tsx scripts/verify-survey.ts
```

The browser test uses mocked API responses and mocked Google sign-in; it never accesses a real account or database. Start the app, then run `node scripts/check-survey-browser.cjs` with Playwright available and Chrome installed. If needed, set `SURVEY_PLAYWRIGHT_PATH` to an installed Playwright package, `SURVEY_BROWSER_BASE_URL` to the local app URL, and `SURVEY_BROWSER_ARTIFACTS` to a screenshot folder. It covers seven desktop/mobile scenarios including save/reload, failures/retry, expired sessions, guest drafts, account changes, law/education options, unlimited details, priorities, grouped review and cleanup. Mobile checks use 390×844; these are simulated viewport checks, not physical-device validation.
