async function loadStaff() {
  const list = document.getElementById("staff-list");
  list.innerHTML = `<div class="loader"><div class="spinner"></div><p>Loading…</p></div>`;

  try {
    const res = await apiFetch("/api/staff/");
    if (!res || !res.ok) {
      list.innerHTML = `<p style="color:var(--danger)">Failed to load staff.</p>`;
      return;
    }
    const staff = await res.json();
    renderStaff(staff);
  } catch {
    list.innerHTML = `<p style="color:var(--warning)">Offline — staff list unavailable.</p>`;
  }
}

function renderStaff(staff) {
  const list = document.getElementById("staff-list");
  const currentUsername = getUsername();

  if (!staff.length) {
    list.innerHTML = `<p style="color:var(--text-muted);padding:20px 0">No staff members found.</p>`;
    return;
  }

  list.innerHTML = staff.map(u => `
    <div class="staff-card">
      <div class="staff-info">
        <div class="staff-avatar">${u.username.charAt(0).toUpperCase()}</div>
        <div>
          <div class="staff-name">${escHtml(u.username)}
            ${u.username === currentUsername ? '<span class="you-badge">You</span>' : ""}
          </div>
          <div class="staff-meta">
            <span class="role-badge ${u.role === "staff" ? "staff" : ""}">${u.role}</span>
            <span style="color:var(--text-muted);font-size:12px">Joined ${formatDate(u.date_joined)}</span>
          </div>
        </div>
      </div>
      ${u.username !== currentUsername ? `
        <button class="btn btn-danger btn-sm" onclick="deleteStaff(${u.id}, '${escHtml(u.username)}')">Delete</button>
      ` : ""}
    </div>`).join("");
}

async function deleteStaff(id, username) {
  if (!confirm(`Delete account "${username}"? This cannot be undone.`)) return;
  try {
    const res = await apiFetch(`/api/staff/${id}/`, { method: "DELETE" });
    if (res && res.ok) {
      showToast(`${username} deleted`, "success");
      loadStaff();
    } else {
      const err = await res.json();
      showToast(err.error || "Failed to delete", "error");
    }
  } catch {
    showToast("Cannot delete while offline", "error");
  }
}

function openAddStaffModal() {
  document.getElementById("staff-form").reset();
  document.getElementById("staff-error").classList.remove("visible");
  document.getElementById("staff-modal").classList.add("open");
}

function closeAddStaffModal() {
  document.getElementById("staff-modal").classList.remove("open");
}

async function submitAddStaff(e) {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById("staff-error");
  const submitBtn = form.querySelector("button[type=submit]");
  errEl.classList.remove("visible");
  submitBtn.disabled = true;

  const payload = {
    username: form.username.value.trim(),
    password: form.password.value,
    role: form.role.value,
  };

  try {
    const res = await apiFetch("/api/staff/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.username?.[0] || data.password?.[0] || "Failed to create account.";
      errEl.classList.add("visible");
      return;
    }
    closeAddStaffModal();
    showToast(`${payload.username} added`, "success");
    loadStaff();
  } catch {
    errEl.textContent = "Cannot create account while offline.";
    errEl.classList.add("visible");
  } finally {
    submitBtn.disabled = false;
  }
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
