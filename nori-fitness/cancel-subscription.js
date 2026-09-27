const CANCEL_SUBSCRIPTION_URL =
  "https://rsogerenyorczxbpyzmb.supabase.co/functions/v1/cancel-subscription";

async function cancelClientSubscription(type) {
  if (!window.sb) {
    alert("Site connection not found. Refresh and try again.");
    return;
  }

  const ok = window.confirm(
    type === "inperson"
      ? "Are you sure you want to cancel your in-person subscription at the end of the current billing period?"
      : "Are you sure you want to cancel your online subscription at the end of the current billing period?"
  );

  if (!ok) return;

  try {
    const {
      data: { session },
      error: sessionError,
    } = await window.sb.auth.getSession();

    if (sessionError || !session?.access_token) {
      alert("Could not verify your session. Please log in again.");
      return;
    }

    const res = await fetch(CANCEL_SUBSCRIPTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ type }),
    });

    const raw = await res.text();
    let data = {};

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      data = { error: raw };
    }

    if (!res.ok) {
      alert(data.error || "Could not cancel subscription.");
      return;
    }

    alert(
      type === "inperson"
        ? "Your in-person subscription is set to end at the end of the current billing period."
        : "Your online subscription is set to end at the end of the current billing period."
    );

    window.location.reload();
  } catch (err) {
    alert(err?.message || "Could not cancel subscription.");
  }
}