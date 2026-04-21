// ── Item Modal (add / edit item + variants) ──
let editingItemId = null;
let variantCount = 0;

function openItemModal(itemId = null) {
  editingItemId = itemId;
  variantCount = 0;

  const modal = document.getElementById("item-modal");
  const title = document.getElementById("item-modal-title");
  const form = document.getElementById("item-form");
  const variantsWrap = document.getElementById("variants-wrap");

  form.reset();
  variantsWrap.innerHTML = "";

  if (itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) return;
    title.textContent = "Edit Item";
    form.itemName.value = item.name;
    form.itemUnit.value = item.unit;
    item.variants.forEach(v => addVariantEditor(v));
    updateLengthVisibility();
  } else {
    title.textContent = "Add Item";
    addVariantEditor();
    updateLengthVisibility();
  }

  modal.classList.add("open");
}

function closeItemModal() {
  document.getElementById("item-modal").classList.remove("open");
}

function addVariantEditor(variant = null) {
  const idx = variantCount++;
  const wrap = document.getElementById("variants-wrap");
  const div = document.createElement("div");
  div.className = "variant-editor";
  div.dataset.idx = idx;

  const unit = document.getElementById("item-form").itemUnit.value;
  const showLength = unit === "meters";

  div.innerHTML = `
    <button type="button" class="remove-variant-btn" onclick="this.closest('.variant-editor').remove()">✕</button>
    <div class="variant-fields">
      <div class="form-group">
        <label>Color</label>
        <input type="text" name="color_${idx}" placeholder="e.g. Red" required
          value="${variant ? escHtml(variant.color) : ""}" />
      </div>
      <div class="form-group length-field" style="display:${showLength ? "block" : "none"}">
        <label>Length (m)</label>
        <input type="number" name="length_${idx}" step="0.01" min="0.01" placeholder="e.g. 5"
          value="${variant && variant.length !== null ? variant.length : ""}" />
      </div>
      <div class="form-group">
        <label>Quantity</label>
        <input type="number" name="qty_${idx}" min="0" placeholder="0" required
          value="${variant ? variant.quantity : "0"}" />
      </div>
      ${variant ? `<input type="hidden" name="variant_id_${idx}" value="${variant.id}" />` : ""}
    </div>`;
  wrap.appendChild(div);
}

function updateLengthVisibility() {
  const unit = document.getElementById("item-form").itemUnit.value;
  const show = unit === "meters";
  document.querySelectorAll(".length-field").forEach(el => {
    el.style.display = show ? "block" : "none";
    const input = el.querySelector("input");
    if (!show) { input.value = ""; input.removeAttribute("required"); }
    else input.setAttribute("required", "");
  });
}

async function submitItemForm(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.itemName.value.trim();
  const unit = form.itemUnit.value;
  const submitBtn = form.querySelector("button[type=submit]");
  submitBtn.disabled = true;

  try {
    // Save / update item
    let itemId = editingItemId;
    if (!editingItemId) {
      const res = await apiFetch("/api/items/", {
        method: "POST",
        body: JSON.stringify({ name, unit }),
      });
      if (!res || !res.ok) {
        const err = res ? await res.json() : {};
        showToast(err.name?.[0] || "Failed to create item", "error");
        return;
      }
      const item = await res.json();
      itemId = item.id;
    } else {
      const res = await apiFetch(`/api/items/${editingItemId}/`, {
        method: "PUT",
        body: JSON.stringify({ name, unit }),
      });
      if (!res || !res.ok) {
        showToast("Failed to update item", "error");
        return;
      }
    }

    // Collect variant editors
    const editors = document.querySelectorAll(".variant-editor");
    for (const editor of editors) {
      const idx = editor.dataset.idx;
      const color = form[`color_${idx}`]?.value.trim();
      const lengthVal = form[`length_${idx}`]?.value;
      const length = unit === "meters" && lengthVal ? parseFloat(lengthVal) : null;
      const quantity = parseInt(form[`qty_${idx}`]?.value || "0", 10);
      const variantId = form[`variant_id_${idx}`]?.value;

      if (!color) continue;

      const payload = { item: itemId, color, quantity };
      if (unit === "meters") payload.length = length;

      if (variantId) {
        await apiFetch(`/api/variants/${variantId}/`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/variants/", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
    }

    closeItemModal();
    showToast(editingItemId ? "Item updated" : "Item created", "success");
    lowStockAlertShown = false;
    loadInventory();
  } catch (err) {
    if (err.message === "NETWORK_ERROR") {
      // Queue offline
      const editors = document.querySelectorAll(".variant-editor");
      const variants = [];
      editors.forEach(editor => {
        const idx = editor.dataset.idx;
        const color = form[`color_${idx}`]?.value.trim();
        const lengthVal = form[`length_${idx}`]?.value;
        const length = unit === "meters" && lengthVal ? parseFloat(lengthVal) : null;
        const quantity = parseInt(form[`qty_${idx}`]?.value || "0", 10);
        if (color) variants.push({ color, length, quantity });
      });
      await queueAction("add_item", { name, unit, variants });
      closeItemModal();
      showToast("Saved offline — will sync when connected", "info");
    } else {
      showToast("An error occurred", "error");
    }
  } finally {
    submitBtn.disabled = false;
  }
}

// ── Stock Action Modal ──
let activeVariant = null;
let activeItem = null;
let stockAction = "add";

function openStockModal(item, variant) {
  activeItem = typeof item === "string" ? JSON.parse(item) : item;
  activeVariant = typeof variant === "string" ? JSON.parse(variant) : variant;

  const modal = document.getElementById("stock-modal");
  const itemInfo = document.getElementById("stock-item-info");
  const qtyInput = document.getElementById("stock-qty");

  const label = activeItem.unit === "meters"
    ? `${activeItem.name} · ${activeVariant.color} · ${activeVariant.length}m`
    : `${activeItem.name} · ${activeVariant.color}`;

  itemInfo.innerHTML = `
    <strong>${escHtml(label)}</strong>
    <span>Current stock: <b>${activeVariant.quantity}</b></span>`;

  qtyInput.value = 1;
  setStockAction("add");
  modal.classList.add("open");
}

function closeStockModal() {
  document.getElementById("stock-modal").classList.remove("open");
  activeVariant = null;
  activeItem = null;
}

function setStockAction(action) {
  stockAction = action;
  document.getElementById("btn-action-add").classList.toggle("btn-primary", action === "add");
  document.getElementById("btn-action-add").classList.toggle("btn-ghost", action !== "add");
  document.getElementById("btn-action-remove").classList.toggle("btn-danger", action === "remove");
  document.getElementById("btn-action-remove").classList.toggle("btn-ghost", action !== "remove");
}

function adjustQty(delta) {
  const input = document.getElementById("stock-qty");
  const val = Math.max(1, (parseInt(input.value, 10) || 1) + delta);
  input.value = val;
}

async function confirmStockAction() {
  const qty = parseInt(document.getElementById("stock-qty").value, 10);
  if (!qty || qty <= 0) {
    showToast("Enter a valid quantity", "error");
    return;
  }

  const btn = document.getElementById("confirm-stock-btn");
  btn.disabled = true;

  const endpoint = stockAction === "add" ? "/api/stock/add/" : "/api/stock/remove/";
  const payload = { variant_id: activeVariant.id, quantity: qty };

  try {
    const res = await apiFetch(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res) return;

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || "Stock update failed", "error");
      return;
    }

    closeStockModal();
    showToast(
      stockAction === "add"
        ? `Added ${qty} to stock`
        : `Removed ${qty} from stock`,
      "success"
    );
    lowStockAlertShown = false;
    loadInventory();
  } catch (err) {
    if (err.message === "NETWORK_ERROR") {
      const type = stockAction === "add" ? "add_stock" : "remove_stock";
      await queueAction(type, payload);
      // optimistically update cached display
      const cached = allItems.find(i => i.id === activeItem.id);
      if (cached) {
        const cv = cached.variants.find(v => v.id === activeVariant.id);
        if (cv) {
          cv.quantity = stockAction === "add"
            ? cv.quantity + qty
            : Math.max(0, cv.quantity - qty);
        }
      }
      closeStockModal();
      showToast("Saved offline — will sync when connected", "info");
      renderInventory(allItems);
    } else {
      showToast("An error occurred", "error");
    }
  } finally {
    btn.disabled = false;
  }
}
