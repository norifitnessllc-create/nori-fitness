document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("resetPasswordForm");
  const message = document.getElementById("message");

  const newPasswordEl = document.getElementById("newPassword");
  const confirmNewPasswordEl = document.getElementById("confirmNewPassword");
  const toggleNewPasswordBtn = document.getElementById("toggleNewPassword");
  const toggleConfirmNewPasswordBtn = document.getElementById("toggleConfirmNewPassword");

  if (!form || !message || !newPasswordEl || !confirmNewPasswordEl) return;

  function setMsg(text) {
    message.textContent = text || "";
  }

  function setEyeState(inputEl, btnEl) {
    if (!inputEl || !btnEl) return;
    const isHidden = inputEl.type === "password";
    btnEl.setAttribute("aria-label", isHidden ? "Show password" : "Hide password");
    btnEl.setAttribute("title", isHidden ? "Show password" : "Hide password");
  }

  setMsg("Enter your new password.");
  setEyeState(newPasswordEl, toggleNewPasswordBtn);
  setEyeState(confirmNewPasswordEl, toggleConfirmNewPasswordBtn);

  if (toggleNewPasswordBtn) {
    toggleNewPasswordBtn.addEventListener("click", () => {
      newPasswordEl.type = newPasswordEl.type === "password" ? "text" : "password";
      setEyeState(newPasswordEl, toggleNewPasswordBtn);
    });
  }

  if (toggleConfirmNewPasswordBtn) {
    toggleConfirmNewPasswordBtn.addEventListener("click", () => {
      confirmNewPasswordEl.type =
        confirmNewPasswordEl.type === "password" ? "text" : "password";
      setEyeState(confirmNewPasswordEl, toggleConfirmNewPasswordBtn);
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newPassword = String(newPasswordEl.value || "");
    const confirmNewPassword = String(confirmNewPasswordEl.value || "");

    if (!newPassword || !confirmNewPassword) {
      setMsg("Enter and confirm your new password.");
      return;
    }

    if (newPassword.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMsg("Passwords do not match.");
      return;
    }

    setMsg("Saving new password...");

    const { error } = await window.sb.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setMsg(error.message || "Could not update password.");
      return;
    }

    setMsg("Password updated successfully. Sending you to login...");

    setTimeout(() => {
      window.location.href = "login.html";
    }, 1200);
  });
});