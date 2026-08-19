# Enterprise Moderation Storage Remediation

## Evidence reviewed

- `18.08.2026_07.42.23_REC.png`
- `18.08.2026_07.44.53_REC.mp4`
- `18.08.2026_07.43.38_REC.mp4`
- `ai-fitness-coach.zip`

The recordings repeatedly show the Image Moderation page with browser-console resource failures while the Railway network log shows repeated requests for moderation image files, including successful cached `304` responses and persistent `404` responses for missing file identifiers.

## Root cause

The moderation queue was treating MongoDB `BodyAnalysis` records as queue items even after the Delete action had removed their GridFS objects. The queue endpoint also returned every historical record, including `Deleted` records. The browser then had to infer which image reference to preview. This created a stale-reference loop where old records could keep producing image-file requests even though the underlying object no longer existed.

A second lifecycle issue was that a file could disappear between the queue availability check and the preview request. The preview endpoint previously returned an ordinary `404`, which encouraged the client/browser to treat the resource like a normal failed fetch rather than a permanently gone object.

## Remediation

- Active moderation queue excludes `Deleted` records.
- Queue response reports `imageAvailability`, `availablePositions`, `missingPositions`, and `storageState`.
- Client requests only positions explicitly marked available.
- Missing GridFS objects return `410 FILE_GONE` with `Cache-Control: no-store`.
- Queue responses are `no-store` so stale moderation metadata is not cached.
- Existing analysis-ID image endpoint remains for backward compatibility.
- Image moderation now runs before MediaPipe, so flagged content does not enter the fitness-analysis workflow.
- Flagged uploads are retained in GridFS as moderation records so an administrator can review or delete them.
- MediaPipe posture settings and deterministic scoring logic remain unchanged.
- Production secrets and runtime uploads are excluded from the release archive.

## Research basis

Railway documents that deployment filesystems are ephemeral and recommends persistent storage such as volumes or object storage for data that must survive deployments. This project uses MongoDB GridFS for new image uploads.

OpenAI documents `omni-moderation-latest` as supporting text and image inputs through the Moderations API and recommends using moderation results to enforce application policy, route content for review, or intervene before downstream actions.

## Verification

- Node syntax checks passed for the changed server controllers and storage/moderation services.
- Full npm lint/test execution was not possible in the sandbox because project dependencies are not installed.
- The source was reviewed against the uploaded recording and screenshot behavior.

## Security packaging

The release archive intentionally excludes:

- production `.env` files;
- local runtime upload files;
- `.git` metadata/history;
- generated frontend `dist`;
- installed dependency directories.

Safe `.env.example` templates are included.

If any production credentials have previously been exposed in a ZIP, screenshot, log, or other shared artifact, rotate those credentials immediately.

# Release notes — moderation image rendering fix

## Root cause

The moderation queue contained legacy `server/uploads` references after the application moved body-image storage to MongoDB GridFS. Railway's filesystem is not durable across deployments. The frontend therefore received valid moderation records but no renderable image object for many historical records.

## Remediation

- Automatic legacy body-image migration to GridFS when legacy files are present.
- Atomic reference replacement to prevent duplicate migration races.
- Stronger GridFS image MIME handling for legacy objects.
- Exclusion of deleted moderation records from the active queue.
- Explicit `availablePositions`, `missingPositions`, and `storageState` in the moderation API.
- `Cache-Control: no-store` on the moderation queue response.
- Frontend rendering now distinguishes loading, unavailable, and failed image states.
- Existing MediaPipe, moderation, authentication, plans, billing, and other application settings are preserved.
