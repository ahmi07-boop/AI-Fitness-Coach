# Image moderation storage repair

## What was fixed

The moderation page previously treated the MongoDB moderation record as sufficient evidence that an image could be rendered. Older records still pointed at `server/uploads`, while current uploads use MongoDB GridFS. On Railway, the legacy filesystem is ephemeral, so those records could render as empty cards or repeatedly request missing files.

This release makes the moderation path durable:

1. Active moderation records exclude `Deleted` entries.
2. When an older local image still exists under an allowed legacy upload root, the admin image-list request transparently migrates it into GridFS using the detected image MIME type.
3. The migration uses an atomic compare-and-set update so concurrent admin loads do not create competing references.
4. The image endpoint validates and repairs common legacy MIME metadata from the stored filename extension.
5. The frontend uses the server's explicit storage availability state and reports an unavailable image instead of silently rendering an empty card.
6. The moderation list is `no-store` so stale queue metadata is not reused.

## One-time Railway recovery

The migration-ready release intentionally retains the legacy `server/uploads` directory from the supplied project. Deploy this release while those files are still present in the deployment artifact. Open `/admin/moderation` once while authenticated as an administrator. The backend will migrate available legacy body images to GridFS automatically.

After the migration is verified, remove `server/uploads` from the repository and deploy the clean production artifact. Future uploads are already stored in GridFS and do not require the Railway filesystem.

If the Railway deployment no longer contains the legacy files, they cannot be reconstructed from MongoDB references alone. In that case, restore the original legacy files from a trusted backup and run `npm run migrate:file-storage` against the production database before removing them.

## Verification

After deployment, the browser network log should show:

- `GET /api/admin/moderation/images` -> `200`
- one or more image file requests -> `200`
- `Content-Type: image/webp`, `image/jpeg`, `image/png`, or another supported `image/*` type
- no repeated `404` requests for deleted/missing moderation files

A record whose underlying object is genuinely gone will be reported as unavailable rather than being fabricated or silently replaced.
