async function generatePDFReport() {
  const btn = document.getElementById("generate-report-btn");
  btn.disabled = true;
  btn.textContent = "Generating…";

  try {
    if (!window.jspdf) {
      showToast("PDF library not loaded — check your connection", "error");
      return;
    }
    const res = await apiFetch("/api/report/daily/");
    if (!res || !res.ok) { showToast("Failed to fetch report data", "error"); return; }
    const data = await res.json();
    buildPDF(data);
    showToast("Report downloaded", "success");
  } catch (err) {
    console.error("Report error:", err);
    showToast(err.message === "NETWORK_ERROR" ? "Cannot generate report while offline" : `Report error: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Download PDF Report";
  }
}

function buildPDF(data) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  function checkPage(needed = 8) {
    if (y + needed > 280) { doc.addPage(); y = margin; }
  }
  function heading(text, size = 13) {
    checkPage(10);
    doc.setFontSize(size); doc.setFont("helvetica", "bold");
    doc.setTextColor(0); doc.text(text, margin, y); y += size * 0.5 + 2;
  }
  function subtext(text, size = 10) {
    checkPage(6);
    doc.setFontSize(size); doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139); doc.text(text, margin, y);
    doc.setTextColor(0); y += size * 0.5 + 1;
  }
  function hr() {
    checkPage(4);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y); y += 4;
  }
  function tableRow(cols, widths, isBold = false, bg = null) {
    checkPage(7);
    if (bg) { doc.setFillColor(...bg); doc.rect(margin, y - 4, pageW - margin * 2, 7, "F"); }
    doc.setFont("helvetica", isBold ? "bold" : "normal"); doc.setFontSize(9);
    let x = margin;
    cols.forEach((col, i) => { doc.text(String(col ?? "—"), x, y); x += widths[i]; });
    y += 7;
  }

  // ── Header ──
  doc.setFontSize(22); doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235); doc.text("Stocky", margin, y);
  doc.setTextColor(0); y += 8;
  subtext(`End-of-Day Report — ${data.date}`);
  subtext(`Generated at ${new Date().toLocaleTimeString()}`);
  y += 4; hr();

  const moveCols  = ["Item", "Code", "Description", "Qty", "By", "Time"];
  const moveWidths = [35, 18, 58, 14, 24, 24];

  // ── Stock Added ──
  const adds = data.logs.filter(l => l.action === "ADD");
  heading("Stock Added Today");
  y += 2;
  if (!adds.length) {
    subtext("No stock was added today."); y += 2;
  } else {
    tableRow(moveCols, moveWidths, true, [235, 245, 255]);
    adds.forEach(log => {
      const vd = log.variant_detail;
      const time = new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      tableRow([vd?.item_name ?? "—", vd?.code ?? "—", vd?.name ?? "—", `+${log.quantity_changed}`, log.user ?? "—", time], moveWidths);
    });
  }

  y += 6; hr();

  // ── Stock Removed ──
  const removals = data.logs.filter(l => l.action === "REMOVE");
  heading("Stock Removed Today");
  y += 2;
  if (!removals.length) {
    subtext("No stock was removed today."); y += 2;
  } else {
    tableRow(moveCols, moveWidths, true, [255, 242, 242]);
    removals.forEach(log => {
      const vd = log.variant_detail;
      const time = new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      tableRow([vd?.item_name ?? "—", vd?.code ?? "—", vd?.name ?? "—", `${log.quantity_changed}`, log.user ?? "—", time], moveWidths);
    });
  }

  y += 6; hr();

  // ── Current Inventory ──
  heading("Current Inventory");
  y += 2;

  const items = data.items || [];
  if (!items.length) {
    subtext("No inventory data.");
  } else {
    items.forEach(item => {
      checkPage(18);
      doc.setFontSize(10); doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235); doc.text(item.name, margin, y);
      doc.setTextColor(0); y += 6;
      tableRow(["Code", "Description", "Qty", "Status"], [28, 90, 16, 30], true, [248, 250, 252]);
      item.variants.forEach(v => {
        const low = v.quantity <= (window.LOW_STOCK_THRESHOLD || 5);
        if (low) doc.setTextColor(220, 38, 38);
        tableRow([v.code, v.name, v.quantity, low ? "Low Stock" : "OK"], [28, 90, 16, 30]);
        doc.setTextColor(0);
      });
      y += 4;
    });
  }

  doc.save(`stocky-report-${data.date}.pdf`);
}

async function loadLogs(dateFilter = "") {
  const tbody = document.getElementById("logs-tbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">Loading…</td></tr>`;

  const url = dateFilter ? `/api/logs/?date=${dateFilter}` : "/api/logs/";
  try {
    const res = await apiFetch(url);
    if (!res || !res.ok) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--danger)">Failed to load logs.</td></tr>`;
      return;
    }
    const logs = await res.json();
    if (!logs.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted)">No logs found.</td></tr>`;
      return;
    }
    tbody.innerHTML = logs.map(log => {
      const vd = log.variant_detail;
      const qty = log.quantity_changed > 0 ? `+${log.quantity_changed}` : log.quantity_changed;
      const time = new Date(log.timestamp).toLocaleString();
      return `<tr>
        <td><span class="action-chip ${log.action}">${log.action}</span></td>
        <td>${vd ? escHtml(vd.item_name ?? "—") : "—"}</td>
        <td>${vd ? `<code class="variant-code-badge">${escHtml(vd.code)}</code>` : "—"}</td>
        <td>${qty}</td>
        <td>${escHtml(log.user ?? "—")}</td>
        <td>${time}</td>
      </tr>`;
    }).join("");
  } catch (err) {
    if (err.message === "NETWORK_ERROR") {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--warning)">Offline — logs unavailable.</td></tr>`;
    }
  }
}
