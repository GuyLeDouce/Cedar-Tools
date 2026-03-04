const CedarApp = (() => {
  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(options.headers || {})
      },
      ...options
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json() : null;

    if (!response.ok) {
      const error = new Error(payload?.error || "Request failed.");
      error.status = response.status;
      throw error;
    }

    return payload;
  }

  async function getCurrentUser() {
    try {
      const data = await request("/api/me");
      if (data.user?.passwordResetRequired && window.location.pathname !== "/set-password") {
        window.location.href = `/set-password?next=${encodeURIComponent(window.location.pathname)}`;
      }
      return data.user;
    } catch (error) {
      if (error.status === 401) {
        return null;
      }

      throw error;
    }
  }

  function redirectToLogin(nextPath = window.location.pathname) {
    const target = `/login?next=${encodeURIComponent(nextPath)}`;
    window.location.href = target;
  }

  function setMessage(element, type, message) {
    if (!element) {
      return;
    }

    element.className = `notice ${type}`;
    element.textContent = message;
    element.hidden = false;
  }

  function clearMessage(element) {
    if (!element) {
      return;
    }

    element.hidden = true;
    element.textContent = "";
  }

  function formatDate(value) {
    if (!value) {
      return "No activity yet";
    }

    return new Date(value).toLocaleString();
  }

  function statusPill(status) {
    const safeStatus = status === "Available" ? "available" : "checked";
    return `<span class="pill ${safeStatus}">${status}</span>`;
  }

  return {
    request,
    getCurrentUser,
    redirectToLogin,
    setMessage,
    clearMessage,
    formatDate,
    statusPill
  };
})();
