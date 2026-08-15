# Fixes Applied

## Security and distribution

- Preserved the supplied `server/.env` unchanged to keep the working environment settings intact.
- Removed all captured `server/uploads` content.
- Removed stale `client/dist`.
- Removed the unused duplicate server MediaPipe model.
- Kept `.env.example` files with placeholders only.
- Added explicit shared timezone configuration.

## Server

- Fixed `saveTodayNutrition` route import/export.
- Preserved habits during weight updates.
- Made workout plan queries compatible with Mongoose and enterprise test doubles.
- Enforced authoritative workout exercise IDs and exercise/set totals.
- Made nutrition calorie/macronutrient totals authoritative from the saved MongoDB plan.
- Persisted AI token/latency usage on generated plans.
- Fixed Admin AI moderation persistence.
- Removed the false Admin Modified status change on simple AI approval.
- Kept Banned and Inactive as separate account statuses.
- Protected the last active administrator.
- Used detected image format from `sharp` for image moderation.
- Standardized server reporting/day aggregation on `APP_TIMEZONE`.

## Client

- Fixed Auth error cause preservation.
- Fixed Dashboard weekly Monday-Sunday calculations.
- Removed unused Dashboard helper.
- Removed the manual Progress workout +/- counter.
- Removed hardcoded Progress `+7` and `+2 this week` indicators.
- Progress workout/water/sleep counts now come from persisted MongoDB progress.
- Removed browser `localStorage`/`sessionStorage` application state and replaced JWT persistence with an HttpOnly auth cookie.
- Removed local photo and analysis caches.
- Water tracking now persists through the API.
- Removed the unused workout localStorage completion record.
- Fixed React hook dependency issues from the supplied lint report.
- Added missing `useAuth`, `Minus`, and `Plus` imports reported by ESLint.
- Removed unused `.demo-button` styling.
- Admin sidebars now display the authenticated admin identity.
- Workout overview now displays the actual plan workout title.

## Tests

The enterprise contract suite now covers:

1. Weight updates preserve habits.
2. Invalid workout exercise IDs are rejected.
3. Workout exercise/set totals are authoritative.
4. Last active admin cannot be deactivated.
5. Profile name/email persistence.
6. AI plan moderation persistence.
7. Nutrition totals are authoritative from the saved plan.
