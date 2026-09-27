const POST_LOGIN_REDIRECT_KEY = "nf_post_login_redirect";
const INPERSON_REQUEST_URL = "dashboard.html?panel=inperson&tab=request";

// Set by signup.js, and by the ?next= marker on the confirmation link for the
// case where the client confirms in a different browser than they signed up in.
function takePostLoginRedirect() {
  let stored = "";

  try {
    stored = window.localStorage.getItem(POST_LOGIN_REDIRECT_KEY) || "";
    window.localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    stored = "";
  }

  let next = "";
  try {
    next = new URLSearchParams(window.location.search).get("next") || "";
  } catch {
    next = "";
  }

  if (next === "inperson-request") return INPERSON_REQUEST_URL;

  // Only ever hand back a same-site relative path.
  if (stored && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(stored)) return stored;

  return "";
}

document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("loginForm");
  const message = document.getElementById("message");

  const emailEl = document.getElementById("email");
  const passwordEl = document.getElementById("password");
  const togglePasswordBtn = document.getElementById("togglePassword");
  const forgotPasswordBtn = document.getElementById("forgotPasswordBtn");
  const resendConfirmBtn = document.getElementById("resendConfirmBtn");

  if (!form || !message || !emailEl || !passwordEl) return;

  function setMsg(text) {
    message.textContent = text || "";
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
  }

  function setEyeState(inputEl, btnEl) {
    if (!inputEl || !btnEl) return;
    const isHidden = inputEl.type === "password";
    btnEl.setAttribute("aria-label", isHidden ? "Show password" : "Hide password");
    btnEl.setAttribute("title", isHidden ? "Show password" : "Hide password");
  }

  async function getProfileRole(userId) {
    let profile = null;

    {
      const { data, error } = await window.sb
        .from("profiles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) profile = data;
    }

    if (!profile) {
      const { data, error } = await window.sb
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (!error && data) profile = data;
    }

    return String(profile?.role || "").toLowerCase();
  }

  async function sendUserToCorrectDashboard() {
    const {
      data: { session },
    } = await window.sb.auth.getSession();

    if (!session?.user) return false;

    const userId = session.user.id;
    const role = await getProfileRole(userId);

    if (role === "coach") {
      window.location.href = "coach-dashboard.html";
      return true;
    }

    const destination = takePostLoginRedirect();

    if (destination) {
      window.location.href = destination;
      return true;
    }

    // Everyone else lands on the main overview page. The dashboard itself moves
    // an in-person client to the Request / Change tab only when that client
    // actually owes a payment -- it has the payment info loaded, this page does
    // not. Sending people here based on "has no schedule request yet" bounced
    // pay-as-you-go clients to that tab on every single login.

    window.location.href = "dashboard.html";
    return true;
  }

  setMsg("Ready.");
  setEyeState(passwordEl, togglePasswordBtn);

  // If user already has a valid Supabase session, skip login page
  try {
    setMsg("Checking session...");
    const redirected = await sendUserToCorrectDashboard();
    if (redirected) return;
    setMsg("Ready.");
  } catch {
    setMsg("Ready.");
  }

  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener("click", () => {
      passwordEl.type = passwordEl.type === "password" ? "text" : "password";
      setEyeState(passwordEl, togglePasswordBtn);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg("Logging in...");

    const email = emailEl.value.trim();
    const password = passwordEl.value;

    const { error } = await window.sb.auth.signInWithPassword({ email, password });

    if (error) {
      setMsg(error.message);
      return;
    }

    try {
      const redirected = await sendUserToCorrectDashboard();

      if (!redirected) {
        setMsg("Logged in. Sending you to dashboard...");
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 800);
      }
    } catch {
      setMsg("Logged in. Sending you to dashboard...");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 800);
    }
  });

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const email = emailEl.value.trim();

      if (!isValidEmail(email)) {
        setMsg("Enter your email above first, then click Forgot Password.");
        return;
      }

      setMsg("Sending reset email...");

      const { error } = await window.sb.auth.resetPasswordForEmail(email, {
        redirectTo: "https://nori-fitness.com/reset-password.html",
      });

      if (error) {
        setMsg(error.message || "Could not send reset email.");
        return;
      }

      setMsg("Password reset email sent. Check your inbox.");
    });
  }

  if (resendConfirmBtn) {
    resendConfirmBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      const email = emailEl.value.trim();

      if (!isValidEmail(email)) {
        setMsg("Enter your email above first, then click Resend Confirmation Email.");
        return;
      }

      setMsg("Resending confirmation email...");

      // Supabase Auth sends this from its "Confirm signup" template through the
      // project's Resend SMTP settings, and minting the link here keeps it the
      // only valid one. Asking a second sender for its own link is what used to
      // leave clients with a dead confirm button.
      const { error } = await window.sb.auth.resend({
        type: "signup",
        email: email,
        options: {
          emailRedirectTo: "https://nori-fitness.com/login.html",
        },
      });

      if (error) {
        setMsg(error.message || "Could not resend confirmation email.");
        return;
      }

      setMsg("Confirmation email sent. Check your inbox.");
    });
  }
});