let saleItems = [];
let foundVariant = null;
let currentReceipt = null;

function loadSales() {
  apiFetch(`${API_BASE}/sales/`)
    .then(r => r.json())
    .then(data => {
      const tbody = document.getElementById("sales-tbody");
      if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted)">No sales yet.</td></tr>`;
        return;
      }
      tbody.innerHTML = data.map(s => `
        <tr>
          <td>${new Date(s.created_at).toLocaleString()}</td>
          <td>${escHtml(s.customer_name)}</td>
          <td>${s.items.length} item${s.items.length !== 1 ? "s" : ""}</td>
          <td>${escHtml(s.created_by || "—")}</td>
        </tr>
      `).join("");
    })
    .catch(() => {});
}

function openSaleModal() {
  saleItems = [];
  foundVariant = null;
  document.getElementById("sale-customer").value = "";
  document.getElementById("sale-code-input").value = "";
  document.getElementById("sale-qty-input").value = "1";
  document.getElementById("sale-variant-preview").innerHTML = "";
  document.getElementById("sale-error").textContent = "";
  renderSaleCart();
  document.getElementById("sale-modal").classList.add("open");
}

function closeSaleModal() {
  document.getElementById("sale-modal").classList.remove("open");
}

function searchSaleVariant() {
  const code = document.getElementById("sale-code-input").value.trim().toUpperCase();
  document.getElementById("sale-error").textContent = "";
  foundVariant = null;
  document.getElementById("sale-variant-preview").innerHTML = "";

  if (!code) return;

  const match = allItems
    .flatMap(item => item.variants.map(v => ({ ...v, item_name: item.name })))
    .find(v => v.code.toUpperCase() === code);

  if (!match) {
    document.getElementById("sale-variant-preview").innerHTML =
      `<div class="sale-preview-card sale-preview-notfound">No variant found for code <strong>${escHtml(code)}</strong>.</div>`;
    return;
  }

  foundVariant = match;
  document.getElementById("sale-variant-preview").innerHTML = `
    <div class="sale-preview-card">
      <span class="sale-preview-name">${escHtml(match.item_name)} — ${escHtml(match.name)}</span>
      <span class="sale-preview-stock ${match.quantity <= LOW_STOCK_THRESHOLD ? "low" : ""}">
        Stock: ${match.quantity}
      </span>
    </div>
  `;
}

function addSaleItem() {
  document.getElementById("sale-error").textContent = "";

  if (!foundVariant) {
    document.getElementById("sale-error").textContent = "Search for a variant first.";
    return;
  }

  const qty = parseInt(document.getElementById("sale-qty-input").value, 10);
  if (!qty || qty <= 0) {
    document.getElementById("sale-error").textContent = "Quantity must be at least 1.";
    return;
  }

  const alreadyInCart = saleItems.reduce((sum, i) => i.variant_id === foundVariant.id ? sum + i.quantity : sum, 0);
  if (alreadyInCart + qty > foundVariant.quantity) {
    document.getElementById("sale-error").textContent =
      `Only ${foundVariant.quantity - alreadyInCart} unit(s) available.`;
    return;
  }

  saleItems.push({
    variant_id: foundVariant.id,
    variant_code: foundVariant.code,
    variant_name: foundVariant.name,
    item_name: foundVariant.item_name,
    quantity: qty,
  });

  document.getElementById("sale-code-input").value = "";
  document.getElementById("sale-qty-input").value = "1";
  document.getElementById("sale-variant-preview").innerHTML = "";
  foundVariant = null;

  renderSaleCart();
}

function removeSaleItem(idx) {
  saleItems.splice(idx, 1);
  renderSaleCart();
}

function renderSaleCart() {
  const el = document.getElementById("sale-cart");
  if (!saleItems.length) {
    el.innerHTML = `<div class="sale-cart-empty">No items added yet.</div>`;
    return;
  }
  el.innerHTML = saleItems.map((item, i) => `
    <div class="sale-cart-row">
      <span class="sale-cart-code">${escHtml(item.variant_code)}</span>
      <span class="sale-cart-desc">${escHtml(item.item_name)} — ${escHtml(item.variant_name)}</span>
      <span class="sale-cart-qty">× ${item.quantity}</span>
      <button class="sale-cart-remove" onclick="removeSaleItem(${i})" title="Remove">✕</button>
    </div>
  `).join("");
}

function submitSale() {
  const customerName = document.getElementById("sale-customer").value.trim();
  document.getElementById("sale-error").textContent = "";

  if (!customerName) {
    document.getElementById("sale-error").textContent = "Client name is required.";
    return;
  }
  if (!saleItems.length) {
    document.getElementById("sale-error").textContent = "Add at least one item.";
    return;
  }

  const btn = document.getElementById("sale-submit-btn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  apiFetch(`${API_BASE}/sales/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_name: customerName,
      items: saleItems.map(i => ({ variant_id: i.variant_id, quantity: i.quantity })),
    }),
  })
    .then(r => r.json().then(data => ({ ok: r.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        document.getElementById("sale-error").textContent = data.error || "Failed to save sale.";
        return;
      }
      closeSaleModal();
      loadSales();
      loadInventory();
      currentReceipt = data;
      openReceiptModal(data);
    })
    .catch(() => {
      document.getElementById("sale-error").textContent = "Network error. Please try again.";
    })
    .finally(() => {
      btn.disabled = false;
      btn.textContent = "Complete Sale";
    });
}

function openReceiptModal(sale) {
  const d = new Date(sale.created_at);
  document.getElementById("receipt-sale-id").textContent = `#${sale.id}`;
  document.getElementById("receipt-date").textContent = d.toLocaleString();
  document.getElementById("receipt-customer").textContent = sale.customer_name;
  document.getElementById("receipt-by").textContent = sale.created_by || "—";

  const tbody = document.getElementById("receipt-items-tbody");
  tbody.innerHTML = sale.items.map(item => `
    <tr>
      <td>${escHtml(item.variant_code)}</td>
      <td>${escHtml(item.item_name)}</td>
      <td>${escHtml(item.variant_name)}</td>
      <td style="text-align:center">${item.quantity}</td>
    </tr>
  `).join("");

  document.getElementById("receipt-modal").classList.add("open");
}

function closeReceiptModal() {
  document.getElementById("receipt-modal").classList.remove("open");
}

function downloadReceiptPDF() {
  const sale = currentReceipt;
  if (!sale) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const w = doc.internal.pageSize.getWidth();
  let y = 14;

  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text("Sale Receipt", w / 2, y, { align: "center" });
  y += 8;

  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.text(`Sale #${sale.id}`, 14, y);
  doc.text(new Date(sale.created_at).toLocaleString(), w - 14, y, { align: "right" });
  y += 5;

  doc.text(`Client: ${sale.customer_name}`, 14, y);
  y += 5;
  doc.text(`Recorded by: ${sale.created_by || "—"}`, 14, y);
  y += 8;

  // Table header
  doc.setFont(undefined, "bold");
  doc.setFillColor(37, 99, 235);
  doc.setTextColor(255, 255, 255);
  doc.rect(14, y - 4, w - 28, 7, "F");
  doc.text("Code", 16, y);
  doc.text("Item", 40, y);
  doc.text("Variant", 90, y);
  doc.text("Qty", w - 16, y, { align: "right" });
  y += 5;

  doc.setFont(undefined, "normal");
  doc.setTextColor(0, 0, 0);

  sale.items.forEach((item, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(243, 244, 246);
      doc.rect(14, y - 4, w - 28, 6, "F");
    }
    doc.text(item.variant_code, 16, y);
    doc.text(item.item_name.substring(0, 22), 40, y);
    doc.text(item.variant_name.substring(0, 22), 90, y);
    doc.text(String(item.quantity), w - 16, y, { align: "right" });
    y += 6;
  });

  y += 4;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text("Generated by Stocky", w / 2, y, { align: "center" });

  doc.save(`receipt-${sale.id}.pdf`);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
