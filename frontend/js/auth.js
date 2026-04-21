const TOKEN_KEY = "stocky_access";
const REFRESH_KEY = "stocky_refresh";
const ROLE_KEY = "stocky_role";
const USER_KEY = "stocky_username";

function getAccess() { return localStorage.getItem(TOKEN_KEY); }
function getRefresh() { return localStorage.getItem(REFRESH_KEY); }
function getRole() { return localStorage.getItem(ROLE_KEY); }
function getUsername() { return localStorage.getItem(USER_KEY); }

function saveTokens({ access, refresh, role, username }) {
  localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  if (role) localStorage.setItem(ROLE_KEY, role);
  if (username) localStorage.setItem(USER_KEY, username);
}

function clearTokens() {
  [TOKEN_KEY, REFRESH_KEY, ROLE_KEY, USER_KEY].forEach(k => localStorage.removeItem(k));
}

async function refreshAccessToken() {
  const refresh = getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${window.API_BASE}/api/auth/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    saveTokens({ access: data.access, refresh: data.refresh });
    return true;
  } catch {
    return false;
  }
}

async function apiFetch(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  const access = getAccess();
  if (access) headers["Authorization"] = `Bearer ${access}`;

  let res;
  try {
    res = await fetch(`${window.API_BASE}${url}`, { ...options, headers });
  } catch {
    throw new Error("NETWORK_ERROR");
  }

  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${getAccess()}`;
      try {
        res = await fetch(`${window.API_BASE}${url}`, { ...options, headers });
      } catch {
        throw new Error("NETWORK_ERROR");
      }
    } else {
      clearTokens();
      window.location.href = "/index.html";
      return;
    }
  }

  return res;
}

function requireAuth() {
  if (!getAccess()) {
    window.location.href = "/index.html";
    return false;
  }
  return true;
}

function requireAdmin() {
  if (!requireAuth()) return false;
  if (getRole() !== "admin") {
    window.location.href = "/dashboard.html";
    return false;
  }
  return true;
}

async function logout() {
  try {
    const refresh = getRefresh();
    if (refresh) {
      await apiFetch("/api/auth/logout/", {
        method: "POST",
        body: JSON.stringify({ refresh }),
      });
    }
  } catch {}
  clearTokens();
  window.location.href = "/index.html";
}

// ── Login page handler ──
function initLoginPage() {
  if (getAccess()) {
    window.location.href = "/dashboard.html";
    return;
  }

  const form = document.getElementById("login-form");
  const errEl = document.getElementById("login-error");
  const submitBtn = form.querySelector("button[type=submit]");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.classList.remove("visible");
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in…";

    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      const res = await fetch(`${window.API_BASE}/api/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        errEl.textContent = data.detail || "Invalid username or password.";
        errEl.classList.add("visible");
        return;
      }

      saveTokens(data);
      window.location.href = "/dashboard.html";
    } catch {
      errEl.textContent = "Cannot reach server. Check your connection.";
      errEl.classList.add("visible");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign in";
    }
  });
}
