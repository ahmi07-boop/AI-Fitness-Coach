# Enterprise remediation — AI Fitness Coach

## Root cause confirmed

The persistent `/analysis` failure was not a MediaPipe landmarking failure. The browser was carrying the four `File` objects only inside React Router navigation state:

- Onboarding stored `{ file, url }` in component state.
- `/analysis` read those `File` objects only from `location.state`.
- A refresh, direct navigation, history transition, or state loss removed the `File` objects.
- The analysis page then failed before MediaPipe could process the images and displayed `Your uploaded images are no longer available`.

The implementation also used browser object URLs as a preview transport. Those URLs are intentionally ephemeral and are not a durable source of truth.

Google's MediaPipe API explicitly supports still-image pose detection through image running mode and `detect`, which matches this application's intended workflow. The failure shown in the supplied screenshot occurs before that stage. 

## Remediation

### Durable body-image draft storage

Added `client/src/services/imageDraftStore.js`.

Uploaded body images are now persisted as Blobs in IndexedDB with:

- a per-draft ID
- authenticated-user ownership key
- 24-hour stale-draft cleanup
- sessionStorage only as a convenience pointer
- restoration into real `File` objects after refresh/navigation
- no image bytes placed into URLs, React Router state, or localStorage

The onboarding flow keeps its existing UI/settings and now saves the draft whenever an image is added or removed.

### Analysis hydration barrier

`Analysis.jsx` now waits for both:

1. authentication/profile hydration
2. durable image-draft hydration

Only then does the one-shot MediaPipe analysis start. This removes the race between route loading and image restoration.

MediaPipe's PoseLandmarker is still initialized in `IMAGE` running mode with the existing CPU delegate and thresholds, preserving the working analysis configuration.

### Object URL lifecycle

Temporary URLs used only for MediaPipe decoding are now revoked immediately after detection. Result-screen URLs remain backed by the original files and are revoked on page cleanup.

### Admin moderation stale-file handling

The supplied video/screenshots also showed repeated `404` requests from the admin Image Moderation page for stored file IDs that no longer exist.

The backend now performs a batch GridFS availability check while loading the moderation queue and returns `imageAvailability` per position. The admin UI skips preview requests for known-missing files instead of deliberately generating repeated 404s.

This does not silently delete moderation records: stale records remain visible, while unavailable media is treated as unavailable.

## Security / packaging

The updated deliverable does **not** package:

- `.git`
- runtime `server/uploads`
- generated `client/dist`
- real `.env` files or secret values

Safe `.env.example` files are included instead. This prevents deployment secrets, historical runtime uploads, and generated artifacts from being redistributed.

## Validation performed

- Source inspection of the supplied ZIP and Git-era source layout.
- Screenshot inspection of the `/analysis` failure and admin moderation console.
- Video frame inspection of the repeated admin moderation `404` behavior.
- Static JavaScript syntax validation of changed server/storage and draft-store modules.
- Existing server test suite was attempted, but the sandbox could not complete dependency installation; the test runner then failed because `mongoose` was not installed. No claim of a passing full test suite is made.

## Research basis

MediaPipe's current PoseLandmarker documentation confirms that `IMAGE` running mode is intended for single-image detection and that `detect` is the synchronous API for that mode. This supports retaining the existing browser-side still-image architecture while fixing the actual persistence/lifecycle defect.
