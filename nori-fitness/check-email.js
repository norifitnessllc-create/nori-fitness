// check-email.js
// Drives the "thanks for signing up / check your email" page that signup.js
// sends new clients to. Reads the training type and email that signup.js
// stashed so the page can show in-person pricing and offer a resend without
// asking the client to type their address again.

const SIGNUP_EMAIL_KEY = "nf_signup_email";
const SIGNUP_TYPE_KEY = "nf_signup_training_type";

function readStored(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

document.addEventListener("DOMContentLoaded", () => {
  const message = document.getElementById("message");
  const sentToLine = document.getElementById("sentToLine");
  const pricingSection = document.getElementById("inpersonPricing");
  const stepDestinationText = document.getElementById("stepDestinationText");
  const heroIntroText = document.getElementById("heroIntroText");
  const stepOpenEmailText = document.getElementById("stepOpenEmailText");
  const stepActionText = document.getElementById("stepActionText");
  const resendBtn = document.getElementById("resendConfirmBtn");

  function setMsg(text) {
    if (message) message.textContent = text || "";
  }

  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    params = new URLSearchParams("");
  }

  // The query string wins so the page still works if storage is blocked, but
  // signup.js normally only passes the training type there -- the email address
  // travels through localStorage rather than the URL.
  const trainingType =
    String(params.get("type") || readStored(SIGNUP_TYPE_KEY) || "online")
      .trim()
      .toLowerCase() === "inperson"
      ? "inperson"
      : "online";

  const email = String(params.get("email") || readStored(SIGNUP_EMAIL_KEY) || "").trim();

  // Every new signup now gets exactly one email -- Supabase Auth's "Confirm
  // signup" template, delivered through the project's Resend SMTP settings --
  // so the steps below can always point at the confirm button.
  if (heroIntroText) {
    heroIntroText.innerHTML =
      "Your Nori-Fitness account is created. Check your inbox for a message from " +
      "<strong>info@nori-fitness.com</strong> \u2014 it has the button that confirms your " +
      "email and signs you straight in.";
  }

  if (stepOpenEmailText) {
    stepOpenEmailText.innerHTML =
      "Open the email titled <strong>\u201CConfirm Your Account\u201D</strong>. The link " +
      "works once and expires after an hour.";
  }

  if (stepActionText) {
    stepActionText.innerHTML =
      "Press <strong>Confirm Your Email</strong> \u2014 that activates your account and " +
      "opens your dashboard.";
  }

  if (email && sentToLine) {
    sentToLine.textContent = `Sent to ${email}`;
    sentToLine.style.display = "block";
  }

  if (trainingType === "inperson") {
    if (pricingSection) pricingSection.style.display = "block";

    if (stepDestinationText) {
      stepDestinationText.innerHTML =
        "You land straight on your <strong>In-Person &rarr; Request / Change</strong> page, " +
        "where you pick your plan, days, times, and location.";
    }
  }

  if (resendBtn) {
    resendBtn.addEventListener("click", async () => {
      if (!isValidEmail(email)) {
        setMsg("Use “Resend Confirmation Email” on the login page to send it again.");
        setTimeout(() => {
          window.location.href = "login.html";
        }, 1500);
        return;
      }

      resendBtn.disabled = true;
      setMsg("Resending your confirmation email...");

      let sent = false;

      // Supabase Auth sends it from the "Confirm signup" template through the
      // project's Resend SMTP settings. Only this sender mints the link, so the
      // one in the client's inbox is always the one that still works.
      if (window.sb) {
        const { error } = await window.sb.auth.resend({
          type: "signup",
          email: email,
          options: {
            emailRedirectTo:
              trainingType === "inperson"
                ? "https://nori-fitness.com/login.html?next=inperson-request"
                : "https://nori-fitness.com/login.html",
          },
        });

        if (error) console.error("Resend confirmation failed:", error);
        else sent = true;
      }

      resendBtn.disabled = false;

      setMsg(
        sent
          ? "Your confirmation email has been sent. Check your inbox."
          : "Could not resend right now. Try “Resend Confirmation Email” on the login page."
      );
    });
  }
});
