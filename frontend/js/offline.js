const DB_NAME = "stocky-offline";
const DB_VERSION = 1;
const STORE_PENDING = "pending_actions";
const STORE_CACHE = "cached_inventory";

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: "id" });
      }
    };
    req.onsuccess = e => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
}

function idbPut(storeName, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function idbGetAll(storeName) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function idbDelete(storeName, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

function idbClear(storeName) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

// ── Public API ──

async function queueAction(type, payload) {
  await idbPut(STORE_PENDING, {
    type,
    payload,
    created_at: new Date().toISOString(),
  });
}

async function cacheInventory(items) {
  await idbClear(STORE_CACHE);
  for (const item of items) {
    await idbPut(STORE_CACHE, item);
  }
}

async function readCachedInventory() {
  return idbGetAll(STORE_CACHE);
}

async function syncPending() {
  if (!navigator.onLine) return;

  let pending;
  try {
    pending = await idbGetAll(STORE_PENDING);
  } catch {
    return;
  }

  if (!pending.length) return;

  for (const action of pending) {
    try {
      let res;
      switch (action.type) {
        case "add_stock":
          res = await apiFetch("/api/stock/add/", {
            method: "POST",
            body: JSON.stringify(action.payload),
          });
          break;
        case "remove_stock":
          res = await apiFetch("/api/stock/remove/", {
            method: "POST",
            body: JSON.stringify(action.payload),
          });
          break;
        case "edit_item":
          res = await apiFetch(`/api/items/${action.payload.item_id}/`, {
            method: "PUT",
            body: JSON.stringify({
              name: action.payload.name,
              unit: action.payload.unit,
            }),
          });
          break;
        case "add_item": {
          const itemRes = await apiFetch("/api/items/", {
            method: "POST",
            body: JSON.stringify({
              name: action.payload.name,
              unit: action.payload.unit,
            }),
          });
          if (!itemRes || !itemRes.ok) break;
          const item = await itemRes.json();
          for (const v of action.payload.variants || []) {
            const vPayload = { item: item.id, color: v.color, quantity: v.quantity };
            if (action.payload.unit === "meters" && v.length) vPayload.length = v.length;
            await apiFetch("/api/variants/", {
              method: "POST",
              body: JSON.stringify(vPayload),
            });
          }
          res = { ok: true };
          break;
        }
        default:
          res = { ok: true };
      }

      if (res && res.ok) {
        await idbDelete(STORE_PENDING, action.id);
      }
    } catch {
      // Stop on network error; retry next time online
      break;
    }
  }
}
