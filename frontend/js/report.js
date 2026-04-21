async function generatePDFReport() {
  const btn = document.getElementById("generate-report-btn");
  btn.disabled = true;
  btn.textContent = "Generating…";

  try {
    const res = await apiFetch("/api/report/daily/");
    if (!res || !res.ok) { showToast("Failed to fetch report data", "error"); return; }
    const data = await res.json();
    buildPDF(data);
    showToast("Report downloaded", "success");
  } catch (err) {
    showToast(err.message === "NETWORK_ERROR" ? "Cannot generate report while offline" : "Failed to generate report", "error");
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
  function heading(text, size = 14) {
    checkPage(10);
    doc.setFontSize(size); doc.setFont("helvetica", "bold");
    doc.text(text, margin, y); y += size * 0.5 + 2;
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

  // Header
  doc.setFontSize(22); doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235); doc.text("Stocky", margin, y);
  doc.setTextColor(0); y += 8;
  subtext(`End-of-Day Report — ${data.date}`);
  subtext(`Generated at ${new Date().toLocaleTimeString()}`);
  y += 4; hr();

  // Activity
  heading("Today's Activity");
  y += 2;
  if (!data.logs.length) {
    subtext("No stock actions recorded today."); y += 2;
  } else {
    const logCols = ["Action", "Item", "Code", "Description", "Qty", "User", "Time"];
    const logWidths = [18, 35, 18, 40, 14, 24, 24];
    tableRow(logCols, logWidths, true, [248, 250, 252]);
    data.logs.forEach(log => {
      const vd = log.variant_detail;
      const time = new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const qty = log.quantity_changed > 0 ? `+${log.quantity_changed}` : `${log.quantity_changed}`;
      tableRow([log.action, vd?.item ?? "—", vd?.code ?? "—", vd?.name ?? "—", qty, log.user ?? "—", time], logWidths);
    });
  }

  y += 6; hr();

  // Inventory snapshot grouped by item
  heading("Full Inventory Snapshot");
  y += 2;

  const grouped = {};
  data.inventory_snapshot.forEach(v => {
    const key = String(v.item);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(v);
  });

  Object.values(grouped).forEach(variants => {
    checkPage(14);
    tableRow(["Code", "Description", "Qty", "Status"], [30, 80, 20, 30], true, [248, 250, 252]);
    variants.forEach(v => {
      const status = v.quantity <= (window.LOW_STOCK_THRESHOLD || 5) ? "Low Stock" : "OK";
      tableRow([v.code, v.name, v.quantity, status], [30, 80, 20, 30]);
    });
    y += 4;
  });

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
        <td>${vd ? escHtml(String(vd.item ?? "—")) : "—"}</td>
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
