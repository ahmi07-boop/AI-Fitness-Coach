# Image Moderation

## Purpose

Image moderation is the safety gate for user-uploaded body-analysis photos. It is separate from MediaPipe pose analysis.

The service uses OpenAI's `omni-moderation-latest` model through the Moderations API. That model accepts text and image inputs. The application sends each normalized WebP image as a base64 data URL and reads the returned `flagged` result plus category names.

## Current workflow

1. The user uploads four body views.
2. The server validates dimensions and decodes the images with `sharp`.
3. Images are normalized to WebP and EXIF metadata is stripped.
4. Each normalized image is submitted to the moderation service before MediaPipe runs.
5. If any image is flagged, the normalized files are retained in GridFS as a moderation record and the fitness workflow stops with a review-required response.
6. If all images pass automatic moderation, MediaPipe performs pose detection and posture analysis.
7. The resulting record stores moderation status alongside the fitness-analysis results; administrators can explicitly approve, flag, or delete queued content.
8. MediaPipe remains responsible for pose landmarks and posture metrics; moderation does not replace pose analysis.

`omni-moderation-latest` is a safety classifier, not a body-quality, medical, or posture model. A moderation pass therefore means the image passed the application's content-safety policy; it does not mean that the pose is valid or that the person is healthy.

## Persistent-file failure handled in this release

The moderation console previously retained historical `BodyAnalysis` rows after the Delete action removed their GridFS objects. Those rows could then point at nonexistent file IDs. The UI also used a permissive availability check and could attempt a preview request for a stale identifier.

The hardened flow now:

- excludes `Deleted` rows from the active moderation queue;
- checks GridFS availability in the queue response;
- sends only positions explicitly marked available to the browser;
- labels records with `available`, `partial`, or `missing` storage state;
- returns HTTP 410 `FILE_GONE` for a referenced GridFS object that no longer exists;
- uses `Cache-Control: no-store` for the moderation queue and gone-file response;
- keeps the old image-by-analysis endpoint for backward compatibility.

This makes missing storage a deterministic state instead of an endless browser 404/retry loop.

## Railway storage requirement

Railway deployment filesystems are ephemeral. Persistent user uploads must remain in MongoDB GridFS, a Railway Volume, or an S3-compatible/Railway Bucket. This project uses MongoDB GridFS for new image uploads. The checked-in/source archive must not contain production `.env` files or real user uploads.

## Operational note

If historical records are already missing their underlying objects, code cannot reconstruct those bytes. Those records should be treated as unavailable and re-uploaded if the images are required. Do not repeatedly retry a missing object ID.

