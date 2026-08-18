const DB_NAME = "fitcoach-drafts";
const DB_VERSION = 1;
const STORE_NAME = "analysis-image-drafts";
export const ANALYSIS_DRAFT_KEY = "fitcoach.analysisDraftId";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

function openDraftDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Persistent browser storage is unavailable."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "draftId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open persistent image storage."));
  });
}

function runTransaction(mode, operation) {
  return openDraftDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;

    try {
      result = operation(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }

    transaction.oncomplete = () => {
      db.close();
      resolve(result && typeof result === "object" && "result" in result ? result.result : result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("Persistent image storage transaction failed."));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error || new Error("Persistent image storage transaction was aborted."));
    };
  }));
}

function makeDraftId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeImageRecord(image) {
  if (!image?.file) return null;

  return {
    blob: image.file instanceof Blob ? image.file : new Blob([image.file], { type: image.file.type || "application/octet-stream" }),
    name: image.file.name || `${image.position || "body"}.webp`,
    type: image.file.type || "application/octet-stream",
    lastModified: Number(image.file.lastModified) || Date.now(),
  };
}

export async function saveAnalysisDraft(images, existingDraftId = "", ownerKey = "") {
  const draftId = existingDraftId || makeDraftId();
  const storedImages = {};

  for (const [position, image] of Object.entries(images || {})) {
    const normalized = normalizeImageRecord(image);
    if (normalized) storedImages[position] = normalized;
  }

  if (Object.keys(storedImages).length === 0) {
    throw new Error("At least one body image is required.");
  }

  await runTransaction("readwrite", (store) => {
    store.put({
      draftId,
      ownerKey: String(ownerKey || ""),
      updatedAt: Date.now(),
      images: storedImages,
    });
  });

  try {
    sessionStorage.setItem(ANALYSIS_DRAFT_KEY, draftId);
  } catch {
    // Session storage is an optimization; IndexedDB remains the source of truth.
  }

  await cleanupAnalysisDrafts(draftId);
  return draftId;
}

export async function loadAnalysisDraft(draftId = "", ownerKey = "") {
  let resolvedDraftId = draftId;

  if (!resolvedDraftId) {
    try {
      resolvedDraftId = sessionStorage.getItem(ANALYSIS_DRAFT_KEY) || "";
    } catch {
      resolvedDraftId = "";
    }
  }

  if (!resolvedDraftId) return null;

  const record = await runTransaction("readonly", (store) => store.get(resolvedDraftId));
  if (!record?.images) return null;
  if (ownerKey && record.ownerKey && String(record.ownerKey) !== String(ownerKey)) {
    return null;
  }

  const images = {};
  for (const [position, image] of Object.entries(record.images)) {
    if (!image?.blob) continue;
    images[position] = {
      file: new File([image.blob], image.name || `${position}.image`, {
        type: image.type || image.blob.type || "application/octet-stream",
        lastModified: image.lastModified || Date.now(),
      }),
    };
  }

  return Object.keys(images).length ? { draftId: record.draftId, images } : null;
}

export async function deleteAnalysisDraft(draftId = "") {
  let resolvedDraftId = draftId;

  if (!resolvedDraftId) {
    try {
      resolvedDraftId = sessionStorage.getItem(ANALYSIS_DRAFT_KEY) || "";
    } catch {
      resolvedDraftId = "";
    }
  }

  if (!resolvedDraftId) return;

  await runTransaction("readwrite", (store) => store.delete(resolvedDraftId));

  try {
    if (sessionStorage.getItem(ANALYSIS_DRAFT_KEY) === resolvedDraftId) {
      sessionStorage.removeItem(ANALYSIS_DRAFT_KEY);
    }
  } catch {
    // Best-effort cleanup only.
  }
}

async function cleanupAnalysisDrafts(currentDraftId) {
  const cutoff = Date.now() - DRAFT_TTL_MS;

  const records = await runTransaction("readonly", (store) => store.getAll());
  const staleIds = records
    .filter((record) => record.draftId !== currentDraftId && Number(record.updatedAt) < cutoff)
    .map((record) => record.draftId);

  if (!staleIds.length) return;

  await runTransaction("readwrite", (store) => {
    staleIds.forEach((id) => store.delete(id));
  });
}
