// signup.js (REPLACE THIS ENTIRE FILE)

const SUPABASE_URL = "https://rsogerenyorczxbpyzmb.supabase.co";
const SUPABASE_KEY = "sb_publishable_gd-5K8F8H48YIYM1XKIkVQ_Yu5qwdvI";

window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CREATE_CHECKOUT_URL =
  "https://rsogerenyorczxbpyzmb.supabase.co/functions/v1/create-checkout";

const NEW_PROFILE_NOTIFY_URL =
  "https://rsogerenyorczxbpyzmb.supabase.co/functions/v1/new-profile-notify";

// Where to send the client once they are actually logged in. In-person clients
// start by requesting a schedule, so they go straight to that tab. Read and
// cleared by login.js after the confirmation link signs them in.
const POST_LOGIN_REDIRECT_KEY = "nf_post_login_redirect";
const INPERSON_REQUEST_URL = "dashboard.html?panel=inperson&tab=request";

// The "thanks for signing up, go check your email" page. Read by check-email.js
// so it can show the right next step and offer a resend without making the
// client retype their address.
const CHECK_EMAIL_URL = "check-email.html";
const SIGNUP_EMAIL_KEY = "nf_signup_email";
const SIGNUP_TYPE_KEY = "nf_signup_training_type";

// ONLINE price map (LIVE)
const PRICE_MAP = {
starter_intro: {
  price_id: "price_1TY8aV2UkFduvWwcVQE0v4gf",
  mode: "payment",
  plan_label: "Starter Intro",
  months: 1,
  selected_service: "Online Training - Starter Intro Offer",
  service_type: "Online Training",
  cost: "$75 First Month",
  length: "1 Month Intro",
  billing_structure: "One-Time",
  promo_offer: "first_month_75",
},

  starter_monthly: {
    price_id: "price_1Tg8iV2UkFduvWwcVwLFXWdj",
    mode: "subscription",
    plan_label: "Starter",
    months: 1,
    selected_service: "Online Training - Starter Monthly",
    service_type: "Online Training",
    cost: "$150 / month",
    length: "Monthly",
    billing_structure: "Recurring",
  },

  starter_3: {
    price_id: "price_1TgANX2UkFduvWwct2Diq9Oc",
    mode: "payment",
    plan_label: "Starter",
    months: 3,
    selected_service: "Online Training - Starter (3 Months)",
    service_type: "Online Training",
    cost: "$375",
    length: "3 Months",
    billing_structure: "One-Time",
  },

  starter_6: {
    price_id: "price_1TgAOm2UkFduvWwc2urhXCmV",
    mode: "payment",
    plan_label: "Starter",
    months: 6,
    selected_service: "Online Training - Starter (6 Months)",
    service_type: "Online Training",
    cost: "$750",
    length: "6 Months",
    billing_structure: "One-Time",
  },

  pro_monthly: {
    price_id: "price_1Tg8k62UkFduvWwcgvyP0hYT",
    mode: "subscription",
    plan_label: "Pro",
    months: 1,
    selected_service: "Online Training - Pro Monthly",
    service_type: "Online Training",
    cost: "$300 / month",
    length: "Monthly",
    billing_structure: "Recurring",
  },

  pro_3: {
    price_id: "price_1Tg8r52UkFduvWwcnlFgaDZp",
    mode: "payment",
    plan_label: "Pro",
    months: 3,
    selected_service: "Online Training - Pro (3 Months)",
    service_type: "Online Training",
    cost: "$850",
    length: "3 Months",
    billing_structure: "One-Time",
  },
};
function setMsg(el, text) {
  if (el) el.textContent = text || "";
}

function rememberPostLoginRedirect(url) {
  try {
    window.localStorage.setItem(POST_LOGIN_REDIRECT_KEY, url);
  } catch {
    // Private browsing can block storage -- login.js falls back to the dashboard.
  }
}

function rememberSignupDetails(email, trainingType) {
  try {
    window.localStorage.setItem(SIGNUP_EMAIL_KEY, email);
    window.localStorage.setItem(SIGNUP_TYPE_KEY, trainingType);
  } catch {
    // check-email.html also reads the training type from its query string.
  }
}

// Sends the client to the thank-you / check-your-email page. The training type
// rides along in the URL so the page is correct even when storage is blocked.
// The confirmation email itself always comes from Supabase Auth's "Confirm
// signup" template, delivered through the project's Resend SMTP settings, so
// the page can always point the client at a confirm button.
function goToCheckEmailPage(trainingType) {
  window.location.href = `${CHECK_EMAIL_URL}?type=${encodeURIComponent(trainingType)}`;
}

// Tells the coach a new client signed up. The client's own confirmation email
// is sent by Supabase Auth, not from here -- sending a second one from this
// site replaced Supabase's single-use confirm link and broke it.
async function notifyCoachOfNewAccount(payload) {
  try {
    const res = await fetch(NEW_PROFILE_NOTIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || result?.ok === false) {
      console.error("Coach notification failed:", res.status, result);
      return { sent: false };
    }

    return { sent: true };
  } catch (err) {
    console.error("Coach notification request failed:", err);
    return { sent: false };
  }
}

function norm(str) {
  return String(str || "").trim();
}

function pad2(n) {
  const x = String(n || "");
  return x.length === 1 ? "0" + x : x;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function buildDobISO(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return "";

  const dt = new Date(Date.UTC(y, m - 1, d));
  const ok = dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  if (!ok) return "";

  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function calcAgeFromDobISO(dobISO) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dobISO || ""));
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  const now = new Date();
  let age = now.getFullYear() - y;
  const birthdayPassed =
    now.getMonth() + 1 > mo || (now.getMonth() + 1 === mo && now.getDate() >= d);
  if (!birthdayPassed) age -= 1;
  return age;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  const message = document.getElementById("message");

  const passwordEl = document.getElementById("password");
  const confirmPasswordEl = document.getElementById("confirmPassword");
  const toggleSignupPasswordBtn = document.getElementById("toggleSignupPassword");
  const toggleConfirmPasswordBtn = document.getElementById("toggleConfirmPassword");

  const dobMonthEl = document.getElementById("dobMonth");
  const dobDayEl = document.getElementById("dobDay");
  const dobYearEl = document.getElementById("dobYear");

  const ackTermsEl = document.getElementById("ackTerms");
  const ack18El = document.getElementById("ack18");
  const ackParqEl = document.getElementById("ackParq");

  const trainingTypeInput = document.getElementById("trainingType");
  const typeButtons = document.querySelectorAll("#typeGrid .plan-card");

  const planChoiceInput = document.getElementById("planChoice");
  const planButtons = document.querySelectorAll("#planGrid .plan-card");

  const planGrid = document.getElementById("planGrid");
  const onlinePlansTitle = document.getElementById("onlinePlansTitle");
  const planPickMsg = document.getElementById("planPickMsg");

  if (!form) return;

  function setEyeState(inputEl, btnEl) {
    if (!inputEl || !btnEl) return;
    const isHidden = inputEl.type === "password";
    btnEl.setAttribute("aria-label", isHidden ? "Show password" : "Hide password");
    btnEl.setAttribute("title", isHidden ? "Show password" : "Hide password");
  }

  setMsg(message, "Ready.");
  setEyeState(passwordEl, toggleSignupPasswordBtn);
  setEyeState(confirmPasswordEl, toggleConfirmPasswordBtn);

  if (toggleSignupPasswordBtn && passwordEl) {
    toggleSignupPasswordBtn.addEventListener("click", () => {
      passwordEl.type = passwordEl.type === "password" ? "text" : "password";
      setEyeState(passwordEl, toggleSignupPasswordBtn);
    });
  }

  if (toggleConfirmPasswordBtn && confirmPasswordEl) {
    toggleConfirmPasswordBtn.addEventListener("click", () => {
      confirmPasswordEl.type = confirmPasswordEl.type === "password" ? "text" : "password";
      setEyeState(confirmPasswordEl, toggleConfirmPasswordBtn);
    });
  }

  if (ack18El) ack18El.required = true;
  if (ackTermsEl) ackTermsEl.required = true;
  if (ackParqEl) ackParqEl.required = true;

  if (dobDayEl && dobDayEl.options.length <= 1) {
    for (let i = 1; i <= 31; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = String(i);
      dobDayEl.appendChild(opt);
    }
  }

  if (dobYearEl && dobYearEl.options.length <= 1) {
    const now = new Date();
    const maxYear = now.getFullYear() - 18;
    const minYear = now.getFullYear() - 100;
    for (let y = maxYear; y >= minYear; y--) {
      const opt = document.createElement("option");
      opt.value = String(y);
      opt.textContent = String(y);
      dobYearEl.appendChild(opt);
    }
  }

  function setTrainingType(typeValue) {
    if (!trainingTypeInput) return;

    trainingTypeInput.value = typeValue;

    const isInPerson = String(typeValue).toLowerCase() === "inperson";
    if (planGrid) planGrid.style.display = isInPerson ? "none" : "grid";
    if (onlinePlansTitle) onlinePlansTitle.style.display = isInPerson ? "none" : "block";
    if (planPickMsg) planPickMsg.style.display = isInPerson ? "none" : "block";
  }

  if (typeButtons && typeButtons.length > 0) {
    typeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        typeButtons.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        const t = btn.getAttribute("data-type") || "online";
        setTrainingType(t);
      });
    });

    const defaultTypeBtn = document.querySelector('#typeGrid .plan-card[data-type="online"]');
    if (defaultTypeBtn) defaultTypeBtn.classList.add("selected");
    setTrainingType("online");
  }

  if (planButtons && planButtons.length > 0 && planChoiceInput) {
    planButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        planButtons.forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        const plan = btn.getAttribute("data-plan") || "starter_monthly";
        planChoiceInput.value = plan;
      });
    });
const defaultPlanBtn = document.querySelector(
  '#planGrid .plan-card[data-plan="starter_intro"]'
);

if (defaultPlanBtn) {
  planButtons.forEach((b) => b.classList.remove("selected"));
  defaultPlanBtn.classList.add("selected");
}

planChoiceInput.value = "starter_intro";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (typeof form.reportValidity === "function" && !form.reportValidity()) {
      return;
    }

    setMsg(message, "Creating account...");

    const email = norm(document.getElementById("email")?.value);
    const confirmEmail = norm(document.getElementById("confirmEmail")?.value);
    const password = String(passwordEl?.value || "");
    const confirmPassword = String(confirmPasswordEl?.value || "");
    const fullName = norm(document.getElementById("fullName")?.value);
    const phone = norm(document.getElementById("phone")?.value);

    const address = norm(document.getElementById("address")?.value);
    const cityStateZip = norm(document.getElementById("cityStateZip")?.value);

    const dobMonth = norm(dobMonthEl?.value);
    const dobDay = norm(dobDayEl?.value);
    const dobYear = norm(dobYearEl?.value);
    const dobISO = buildDobISO(dobYear, dobMonth, dobDay);

    if (!email || !confirmEmail || !password || !confirmPassword || !fullName || !phone) {
      setMsg(message, "Please fill in Full Name, Date of Birth, Phone, Email, Confirm Email, Password, and Confirm Password.");
      return;
    }

    if (!isValidEmail(email)) {
      setMsg(message, "Please enter a valid email address.");
      return;
    }

    if (email.toLowerCase() !== confirmEmail.toLowerCase()) {
      setMsg(message, "Email and Confirm Email do not match.");
      return;
    }

    if (!dobISO) {
      setMsg(message, "Please select a valid Date of Birth (month, day, year).");
      return;
    }

    if (password.length < 6) {
      setMsg(message, "Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMsg(message, "Password and Confirm Password do not match.");
      return;
    }

    const ack18 = !!ack18El?.checked;
    const ackTerms = !!ackTermsEl?.checked;
    const ackParq = !!ackParqEl?.checked;

    if (!ack18 || !ackTerms || !ackParq) {
      setMsg(message, "Please check all required boxes before creating your account.");
      return;
    }

    const age = calcAgeFromDobISO(dobISO);
    if (age === null || age < 18) {
      setMsg(message, "You must be at least 18 years old to create an account.");
      return;
    }

    const trainingType = String(trainingTypeInput?.value || "online").toLowerCase();

 let chosenPlan = "starter_intro";

if (trainingType === "online") {
  chosenPlan = String(planChoiceInput?.value || "starter_intro");

  if (!PRICE_MAP[chosenPlan]) {
    setMsg(message, "Please choose an online plan.");
    return;
  }
}

    const signupMetadata = {
      full_name: fullName,
      phone: phone,
      address: address || "",
      city_state_zip: cityStateZip || "",
      training_type: trainingType,
      dob: dobISO,
      ack_terms: ackTerms,
      ack_age_18: ack18,
      ack_parq: ackParq,
      acked_at: new Date().toISOString(),
    };

    const { data, error } = await window.sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          trainingType === "inperson"
            ? "https://nori-fitness.com/login.html?next=inperson-request"
            : "https://nori-fitness.com/login.html",
        data: signupMetadata,
      },
    });

    if (error) {
      const msg = error?.message || "Signup failed.";
      setMsg(message, msg);
      alert("Signup failed: " + msg);
      return;
    }

    // Supabase returns a user with an empty identities array (and no session) when the
    // email already has an account -- email-enumeration protection. No account was created
    // and no confirmation email is sent, so do not tell the user to go check their inbox.
    if (Array.isArray(data?.user?.identities) && data.user.identities.length === 0) {
      setMsg(
        message,
        "An account with that email already exists. Try logging in, or use Forgot Password."
      );
      alert("An account with that email already exists. Try logging in, or use Forgot Password.");
      window.location.href = "login.html";
      return;
    }

    const newUserId = data?.user?.id || null;

    rememberSignupDetails(email, trainingType);

    if (!newUserId) {
      // Nothing else can be driven from this page without a user id. In-person
      // clients get the thank-you page; online clients need a session to pay,
      // so they log in and start checkout from the dashboard instead.
      if (trainingType === "inperson") {
        setMsg(message, "Account created. Check your email for your next step.");
        goToCheckEmailPage(trainingType);
        return;
      }

      setMsg(message, "Account created. Please log in to finish your payment.");
      window.location.href = "login.html";
      return;
    }

    if (trainingType === "inperson") {
      rememberPostLoginRedirect(INPERSON_REQUEST_URL);
    }

    setMsg(message, "Account created. Check your email to confirm it...");

    await notifyCoachOfNewAccount({
      user_id: newUserId,
      email: email,
      full_name: fullName,
      phone: phone,
      training_type: trainingType,
    });

    // In-person clients stop here -- they have nothing to pay for on this page,
    // so they get the thank-you page and come back in through the confirmation
    // email Supabase sent. Any session signUp() handed back is thrown away
    // deliberately so nobody is dropped into the dashboard straight off the
    // form. login.js picks the schedule request back up from the redirect
    // stashed above, and the confirm link carries ?next= as a backup.
    if (trainingType === "inperson") {
      setMsg(message, "Account created. Check your email for your next step.");

      try {
        await window.sb.auth.signOut();
      } catch (err) {
        console.error("Could not clear the signup session:", err);
      }

      goToCheckEmailPage(trainingType);
      return;
    }

    // Online from here down. The session signUp() created is what lets this page
    // start Stripe checkout, so it is kept and the client goes straight to pay.
    const { data: sessionData } = await window.sb.auth.getSession();
    const hasSession = !!sessionData?.session;

    if (!hasSession) {
      // Checkout needs an account to attach the payment to. Without a session
      // the client logs in first and pays from the dashboard -- the welcome
      // email already carries a login button.
      setMsg(message, "Account created. Please log in to finish your payment.");
      window.location.href = "login.html";
      return;
    }

    const cfg = PRICE_MAP[chosenPlan];

    setMsg(message, "Starting payment...");

    const res = await fetch(CREATE_CHECKOUT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
  user_id: newUserId,
  email: email,
  full_name: fullName,

  price_id: cfg.price_id,
  mode: cfg.mode,

  plan_label: cfg.plan_label,
  months: cfg.months,

  source: "online",

  selected_service: cfg.selected_service,
  service_type: cfg.service_type,

  cost: cfg.cost,
  length: cfg.length,
  billing_structure: cfg.billing_structure,

  promo_offer: cfg.promo_offer || null,
}),
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok || !result.url) {
      setMsg(message, "Payment did not start. Please try again.");
      alert("Payment did not start. Please try again.");
      return;
    }

    window.location.href = result.url;
  });
});