# Enterprise file-storage hardening

## Problem fixed

The previous implementation stored uploaded images in `server/uploads`. Railway containers are ephemeral, so MongoDB could retain a path while the physical image disappeared after a deployment/restart. That produced:

- `/api/progress/:id/photo/before` → 404
- `/api/admin/moderation/images/:id/file/:position` → 400/404
- profile-avatar retrieval failures

## New design

All new user uploads use MongoDB GridFS:

- `server/services/storageService.js` is the single file-storage abstraction.
- Profile avatars, progress photos and body-analysis/moderation images all use the same storage layer.
- MongoDB stores a GridFS file ID as the reference.
- The file itself is persisted in MongoDB's GridFS bucket.
- New images are normalized to WebP and EXIF metadata is stripped.
- Download endpoints validate the requested file ID and stream the file with its stored MIME type and length.
- Legacy local paths are supported only as a backwards-compatible fallback when the file still exists under `server/uploads`.

## Existing records

If an older deployment still has the original files, run:

```bash
cd server
npm run migrate:file-storage
```

The migration uploads legacy files into GridFS and replaces the stored path with the new GridFS ID. It does not invent or recreate files that no longer exist.

If an old MongoDB record points to a file that is already gone, that particular image must be uploaded again. The application cannot recover a file that no longer exists.

## Railway variables

Add:

```text
MONGO_FILE_BUCKET=fitcoach_files
```

No separate object-storage account is required for this implementation because GridFS uses the existing MongoDB connection.

Keep `MONGODB_URI`, `JWT_SECRET`, Stripe keys, OpenAI keys and other secrets in Railway Variables only.
