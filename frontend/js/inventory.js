let allItems = [];
let lowStockAlertShown = false;

async function loadInventory(searchQuery = "") {
  const grid = document.getElementById("inventory-grid");
  grid.innerHTML = `<div class="loader"><div class="spinner"></div><p>Loading inventory…</p></div>`;

  let items;
  try {
    const url = searchQuery
      ? `/api/items/?search=${encodeURIComponent(searchQuery)}`
      : "/api/items/";
    const res = await apiFetch(url);
    if (!res) return;
    if (!res.ok) throw new Error("fetch_failed");
    items = await res.json();
    allItems = items;
    await cacheInventory(items);
  } catch (err) {
    if (err.message === "NETWORK_ERROR") {
      items = await readCachedInventory();
      if (!items.length) {
        grid.innerHTML = `<div class="empty-state"><p>You're offline and no cached data is available.</p></div>`;
        return;
      }
      showToast("Showing cached data (offline)", "info");
    } else {
      grid.innerHTML = `<div class="empty-state"><p>Failed to load inventory.</p></div>`;
      return;
    }
  }

  renderInventory(items);
}

function renderInventory(items) {
  const grid = document.getElementById("inventory-grid");
  const role = getRole();

  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M20 7l-8-4-8 4m16 0v10l-8 4m0-14L4 17m8-4v10"/>
      </svg>
      <p>No items found. Add your first item!</p>
    </div>`;
    return;
  }

  const lowStockItems = [];

  grid.innerHTML = items.map(item => {
    const hasLowStock = item.variants.some(v => v.quantity <= window.LOW_STOCK_THRESHOLD);
    if (hasLowStock) lowStockItems.push(item);

    const variantsHtml = item.variants.length
      ? item.variants.map(v => {
          const low = v.quantity <= window.LOW_STOCK_THRESHOLD;
          const label = item.unit === "meters"
            ? `${v.color} · ${v.length}m`
            : v.color;
          return `
            <div class="variant-row ${low ? "low-stock" : ""}"
                 onclick="openStockModal(${JSON.stringify(item).replace(/"/g,"&quot;")}, ${JSON.stringify(v).replace(/"/g,"&quot;")})">
              <div class="variant-info">
                <div class="color-dot" style="background:${cssColor(v.color)}"></div>
                <span class="variant-label">${escHtml(label)}</span>
              </div>
              <span class="variant-qty ${low ? "low" : ""}">${v.quantity}</span>
            </div>`;
        }).join("")
      : `<p style="font-size:13px;color:var(--text-muted);padding:4px 0">No variants yet.</p>`;

    return `
      <div class="item-card ${hasLowStock ? "low-stock" : ""}" id="item-${item.id}">
        <div class="item-header">
          <span class="item-name">${escHtml(item.name)}</span>
          <span class="item-unit">${item.unit}</span>
        </div>
        <div class="variant-list">${variantsHtml}</div>
        <div class="item-actions">
          <button class="btn btn-ghost btn-sm" onclick="openItemModal(${item.id})">Edit</button>
          ${role === "admin" ? `<button class="btn btn-danger btn-sm" onclick="deleteItem(${item.id})">Delete</button>` : ""}
        </div>
      </div>`;
  }).join("");

  checkLowStock(lowStockItems);
}

function checkLowStock(lowStockItems) {
  if (!lowStockItems.length || lowStockAlertShown) return;
  lowStockAlertShown = true;

  const list = lowStockItems.flatMap(item =>
    item.variants
      .filter(v => v.quantity <= window.LOW_STOCK_THRESHOLD)
      .map(v => {
        const label = item.unit === "meters"
          ? `${item.name} — ${v.color} (${v.length}m): ${v.quantity} left`
          : `${item.name} — ${v.color}: ${v.quantity} left`;
        return `<li>${escHtml(label)}</li>`;
      })
  ).join("");

  document.getElementById("alert-items-list").innerHTML = list;
  document.getElementById("low-stock-alert").classList.add("open");
}

async function deleteItem(itemId) {
  if (!confirm("Delete this item and all its variants? This cannot be undone.")) return;
  try {
    const res = await apiFetch(`/api/items/${itemId}/`, { method: "DELETE" });
    if (res && res.ok) {
      showToast("Item deleted", "success");
      lowStockAlertShown = false;
      loadInventory();
    } else {
      showToast("Failed to delete item", "error");
    }
  } catch {
    showToast("Cannot delete while offline", "error");
  }
}

// ── Utility ──
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cssColor(name) {
  const map = {
    red: "#ef4444", blue: "#3b82f6", green: "#22c55e", yellow: "#eab308",
    orange: "#f97316", purple: "#a855f7", pink: "#ec4899", brown: "#92400e",
    black: "#1e293b", white: "#f1f5f9", gray: "#94a3b8", grey: "#94a3b8",
  };
  return map[name.toLowerCase()] || "#94a3b8";
}

// ── Toast ──
function showToast(msg, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}
