let inactivityTimer;

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(async () => {
    try {
      await window.sb.auth.signOut();
    } catch {}

    window.location.href = "login.html";
  }, 30 * 60 * 1000);
}

["click","mousemove","keydown","scroll","touchstart"].forEach((event) => {
  document.addEventListener(event, resetInactivityTimer);
});

resetInactivityTimer();
function safeLower(v) {
  return String(v || "").toLowerCase();
}

function pickText(v, fallback = "—") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDisplayDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "—";

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  const day = match[3];
  const monthName = months[monthIndex] || match[2];

  return `${year}-${monthName}-${day}`;
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function getTodayLocalDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// An approved pay-as-you-go booking holds a session slot, so it cannot sit
// unpaid forever. The client gets this long from approval to pay; after that the
// booking expires on its own and the slot is freed. Keep this in sync with
// dashboard.js, create-checkout, and supabase/inperson-payg-expiry.sql.
const PAYG_PAYMENT_WINDOW_HOURS = 48;

// session_time is free text on the booking row -- "07:30", "7:30 AM", "7 pm".
// Anything we cannot read falls back to the start of the session day.
function parsePaygSessionStart(sessionDate, sessionTime) {
  const dateStr = String(sessionDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;

  const [year, month, day] = dateStr.split("-").map(Number);
  const match = String(sessionTime || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i);

  let hours = 0;
  let minutes = 0;

  if (match) {
    hours = Number(match[1]) || 0;
    minutes = Number(match[2] || 0);

    const meridiem = safeLower(match[3] || "").replace(/\./g, "");
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
  }

  const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(start.getTime()) ? null : start;
}

// The deadline the client is held to: PAYG_PAYMENT_WINDOW_HOURS from approval,
// pulled earlier if the session itself starts before that.
function computePaygDueAt(approvedAt, sessionDate, sessionTime) {
  const base = approvedAt instanceof Date ? approvedAt : new Date(approvedAt || Date.now());
  const start = Number.isNaN(base.getTime()) ? new Date() : base;

  let due = new Date(start.getTime() + PAYG_PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);

  const sessionStart = parsePaygSessionStart(sessionDate, sessionTime);
  if (sessionStart && sessionStart > start && sessionStart < due) due = sessionStart;

  return due;
}

function getPaygPaymentDueAt(row) {
  if (!row) return null;

  const stored = row.payment_due_at ? new Date(row.payment_due_at) : null;
  if (stored && !Number.isNaN(stored.getTime())) return stored;

  // payment_due_at is stamped at approval. Derive it for rows approved before
  // the column existed so older bookings still carry a deadline.
  const statusLower = safeLower(row.status);
  if (statusLower !== "approved" && statusLower !== "confirmed" && statusLower !== "booked") return null;

  const approvedAt = new Date(row.approved_at || row.created_at || 0);
  if (Number.isNaN(approvedAt.getTime()) || !approvedAt.getTime()) return null;

  return computePaygDueAt(approvedAt, row.session_date, row.session_time);
}

function isPaygPaid(row) {
  if (!row) return false;
  const statusLower = safeLower(row.status);
  return !!row.paid_at || !!row.stripe_session_id || statusLower === "paid" || statusLower === "completed";
}

function isPaygExpired(row) {
  if (!row) return false;
  if (isPaygPaid(row)) return false;
  if (safeLower(row.status) === "expired") return true;

  const due = getPaygPaymentDueAt(row);
  return !!due && due.getTime() <= Date.now();
}

function formatPaymentDeadline(due) {
  if (!due) return "—";

  return due.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeLeft(due) {
  if (!due) return "";

  const msLeft = due.getTime() - Date.now();
  if (msLeft <= 0) return "overdue";

  const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
  if (hoursLeft >= 48) return `${Math.floor(hoursLeft / 24)} days left`;
  if (hoursLeft >= 1) return `${hoursLeft}h left`;

  return `${Math.max(1, Math.round(msLeft / (60 * 1000)))}m left`;
}

function humanPlanName(plan) {
  const p = safeLower(plan);
  if (!p) return "—";
  if (p.includes("starter")) return "Starter";
  if (p.includes("pro")) return "Pro";
  if (p.includes("inperson_1x")) return "In-Person 1x / Week";
  if (p.includes("inperson_3x")) return "In-Person 3x / Week";
  if (p.includes("inperson_payg")) return "Pay-As-You-Go";
  return plan;
}

function humanBootcampName(code) {
  const c = safeLower(code);
  if (c.includes("2w")) return "2-Week Bootcamp";
  if (c.includes("4w")) return "4-Week Bootcamp";
  if (c.includes("6w")) return "6-Week Bootcamp";
  return code || "Bootcamp";
}

function csvEscape(value) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

const FORM_BUCKET = "form_videos";

document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const logoutBtn = document.getElementById("logoutBtn");
  const coachDashboard = document.getElementById("coachDashboard");

  const clientOverviewBox = document.getElementById("clientOverviewBox");
  const coachCalorieBox = document.getElementById("coachCalorieBox");
  const coachCalorieDate = document.getElementById("coachCalorieDate");
  const refreshCalorieBtn = document.getElementById("refreshCalorieBtn");
  const exportCalorieBtn = document.getElementById("exportCalorieBtn");
  const inpersonRequestsBox = document.getElementById("inpersonRequestsBox");
  const coachQueueList = document.getElementById("coachQueueList");
  const coachSelectedMeta = document.getElementById("coachSelectedMeta");
  const coachVideoFile = document.getElementById("coachVideoFile");
  const coachNotes = document.getElementById("coachNotes");
  const coachSendBtn = document.getElementById("coachSendBtn");
  const coachSendMsg = document.getElementById("coachSendMsg");
  const onlineWaitlistBox = document.getElementById("onlineWaitlistBox");
  const inpersonWaitlistBox = document.getElementById("inpersonWaitlistBox");
  const bootcampSignupsBox = document.getElementById("bootcampSignupsBox");

  const coachMsgClientList = document.getElementById("coachMsgClientList");
  const coachMsgThread = document.getElementById("coachMsgThread");
  const coachMsgSelectedMeta = document.getElementById("coachMsgSelectedMeta");
  const coachMsgInput = document.getElementById("coachMsgInput");
  const coachMsgSendBtn = document.getElementById("coachMsgSendBtn");
  const coachMsgStatus = document.getElementById("coachMsgStatus");

  const videoModal = document.getElementById("videoModal");
  const videoModalClose = document.getElementById("videoModalClose");
  const videoModalTitle = document.getElementById("videoModalTitle");
  const videoModalPlayer = document.getElementById("videoModalPlayer");
  const videoModalSource = document.getElementById("videoModalSource");

  if (!window.sb || !statusEl || !logoutBtn) return;

  let coachSelectedReviewId = null;
  let coachSelectedUserId = null;
  let lastClientRowsForExport = [];
  let lastCalorieRowsForExport = [];
  let profileMap = new Map();

  let coachUserId = null;
  let coachMsgSelectedClientId = null;

  function openVideo(title, url) {
    if (!videoModal || !videoModalPlayer || !videoModalSource) return;
    if (!url) return;

    if (videoModalTitle) videoModalTitle.textContent = title || "Video";

    videoModalPlayer.pause();
    videoModalPlayer.removeAttribute("src");
    videoModalSource.removeAttribute("src");

    videoModalSource.src = url;
    videoModalSource.type = "";
    videoModalPlayer.load();

    videoModal.style.display = "flex";
    videoModalPlayer.play().catch(() => {});
  }

  function closeVideo() {
    if (!videoModal || !videoModalPlayer || !videoModalSource) return;
    videoModal.style.display = "none";
    videoModalPlayer.pause();
    videoModalSource.removeAttribute("src");
    videoModalSource.type = "";
    videoModalPlayer.load();
  }

  function getClientDisplay(userId) {
    const prof = profileMap.get(userId);
    if (!prof) {
      return {
        name: userId,
        email: "",
        label: userId,
      };
    }

    const name = pickText(prof.full_name, userId);
    const email = pickText(prof.email, "");
    const label = email ? `${name} | ${email}` : name;

    return { name, email, label };
  }

  function getRequestBadge(status) {
    const statusLower = safeLower(status);

    if (statusLower === "approved") {
      return `<span class="pill pill-green">Approved</span>`;
    }

    if (statusLower === "paid") {
      return `<span class="pill pill-blue">Paid</span>`;
    }

    if (statusLower === "denied") {
      return `<span class="pill" style="background:rgba(180,80,80,0.12); border-color:rgba(180,80,80,0.22); color:#8b2f2f;">Denied</span>`;
    }

    return `<span class="pill pill-yellow">${pickText(status, "requested")}</span>`;
  }

  function getBookingBadge(status, paidAt, expired) {
    const statusLower = safeLower(status);

    if (paidAt || statusLower === "paid") {
      return `<span class="pill pill-blue">Paid</span>`;
    }

    if (expired || statusLower === "expired") {
      return `<span class="pill" style="background:rgba(120,110,100,0.14); border-color:rgba(120,110,100,0.24); color:#5c5147;">Expired</span>`;
    }

    if (statusLower === "approved" || statusLower === "confirmed" || statusLower === "booked") {
      return `<span class="pill pill-green">Approved</span>`;
    }

    if (statusLower === "denied") {
      return `<span class="pill" style="background:rgba(180,80,80,0.12); border-color:rgba(180,80,80,0.22); color:#8b2f2f;">Denied</span>`;
    }

    return `<span class="pill pill-yellow">${pickText(status, "pending")}</span>`;
  }

  if (videoModalClose && !videoModalClose.dataset.wired) {
    videoModalClose.dataset.wired = "1";
    videoModalClose.onclick = closeVideo;
  }

  if (videoModal && !videoModal.dataset.wired) {
    videoModal.dataset.wired = "1";
    videoModal.onclick = (e) => {
      if (e.target === videoModal) closeVideo();
    };
  }

  logoutBtn.addEventListener("click", async () => {
    statusEl.textContent = "Logging out...";
    await window.sb.auth.signOut();
    window.location.href = "login.html";
  });

  async function getPublicUrl(path) {
    if (!path) return "";
    const { data } = window.sb.storage.from(FORM_BUCKET).getPublicUrl(path);
    return data?.publicUrl || "";
  }

  async function uploadToBucket(path, file) {
    const { error } = await window.sb.storage.from(FORM_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "video/mp4",
    });
    if (error) throw error;
  }

  async function loadProfilesMap() {
    const { data, error } = await window.sb
      .from("profiles")
      .select("id, full_name, email, training_type, role, created_at")
      .order("full_name", { ascending: true });

    if (error) return { data: [], error };

    profileMap = new Map((data || []).map((p) => [p.id, p]));
    return { data: data || [], error: null };
  }

  async function approveInpersonRequest(requestId) {
    statusEl.textContent = "Approving in-person request...";

    const { error } = await window.sb
      .from("inperson_requests")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    if (error) {
      statusEl.textContent = "Could not approve request: " + error.message;
      return;
    }

    statusEl.textContent = "In-person request approved ✅";
    await loadInpersonRequests();
  }

  async function denyInpersonRequest(requestId) {
    statusEl.textContent = "Denying in-person request...";

    const { error } = await window.sb
      .from("inperson_requests")
      .update({
        status: "denied",
      })
      .eq("id", requestId);

    if (error) {
      statusEl.textContent = "Could not deny request: " + error.message;
      return;
    }

    statusEl.textContent = "In-person request denied ✅";
    await loadInpersonRequests();
  }

  // Approving starts the payment clock. `booking` carries the session date/time
  // so the deadline can be pulled in when the session starts sooner than the
  // window would otherwise close.
  async function approvePaygBooking(bookingId, booking) {
    statusEl.textContent = "Approving pay-as-you-go booking...";

    const approvedAt = new Date();
    const dueAt = computePaygDueAt(approvedAt, booking?.session_date, booking?.session_time);

    const fullPatch = {
      status: "approved",
      approved_at: approvedAt.toISOString(),
      payment_due_at: dueAt.toISOString(),
      expired_at: null,
    };

    let { error } = await window.sb
      .from("inperson_bookings")
      .update(fullPatch)
      .eq("id", bookingId);

    // The expiry columns are a later addition to inperson_bookings. Approving
    // must still work on a database that has not had them added yet.
    if (error && isMissingExpiryColumnError(error)) {
      ({ error } = await window.sb
        .from("inperson_bookings")
        .update({ status: "approved" })
        .eq("id", bookingId));
    }

    if (error) {
      statusEl.textContent = "Could not approve booking: " + error.message;
      return;
    }

    statusEl.textContent = `Pay-as-you-go booking approved ✅ Client must pay by ${formatPaymentDeadline(dueAt)}.`;
    await loadInpersonRequests();
  }

  function isMissingExpiryColumnError(error) {
    if (!error) return false;
    if (String(error.code || "") === "42703") return true;
    return /payment_due_at|approved_at|expired_at/i.test(String(error.message || ""));
  }

  // Closes every overdue unpaid booking server-side. Added by
  // supabase/inperson-payg-expiry.sql; until that runs the call just fails and
  // the table falls back to working the deadline out from the row itself.
  async function sweepExpiredPaygBookings() {
    try {
      await window.sb.rpc("expire_stale_payg_bookings");
    } catch (_err) {
      // Non-fatal: expiry is still shown here and enforced at checkout.
    }
  }

  async function denyPaygBooking(bookingId) {
    statusEl.textContent = "Denying pay-as-you-go booking...";

    const { error } = await window.sb
      .from("inperson_bookings")
      .update({
        status: "denied",
      })
      .eq("id", bookingId);

    if (error) {
      statusEl.textContent = "Could not deny booking: " + error.message;
      return;
    }

    statusEl.textContent = "Pay-as-you-go booking denied ✅";
    await loadInpersonRequests();
  }

  async function updateWaitlistStatus(waitlistId, newStatus) {
    statusEl.textContent = "Updating waitlist...";

    const { error } = await window.sb
      .from("waitlist")
      .update({
        status: newStatus,
      })
      .eq("id", waitlistId);

    if (error) {
      statusEl.textContent = "Could not update waitlist: " + error.message;
      return;
    }

    statusEl.textContent = "Waitlist updated ✅";
    await Promise.all([
      loadWaitlist("online", onlineWaitlistBox),
      loadWaitlist("inperson", inpersonWaitlistBox),
      loadClientOverview(),
    ]);
  }

  function renderClientsExportButton() {
    return `
      <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
        <button id="exportClientsBtn" type="button" class="mini-action-btn">
          Export Client List
        </button>
      </div>
    `;
  }

  async function loadClientOverview() {
    if (!clientOverviewBox) return;

    clientOverviewBox.textContent = "Loading...";

    const [
      { data: profiles, error: profilesError },
      { data: onlineSubs },
      { data: inpersonSubs },
    ] = await Promise.all([
      loadProfilesMap(),
      window.sb
        .from("subscriptions")
        .select("user_id, plan, status, start_date, end_date")
        .order("start_date", { ascending: false }),
      window.sb
        .from("inperson_subscriptions")
        .select("user_id, plan_code, status, start_date, end_date"),
    ]);

    if (profilesError) {
      clientOverviewBox.textContent = "Could not load clients: " + profilesError.message;
      return;
    }

    const onlineMap = new Map();
    (onlineSubs || []).forEach((row) => {
      if (!onlineMap.has(row.user_id)) onlineMap.set(row.user_id, row);
    });

    const inpersonMap = new Map();
    (inpersonSubs || []).forEach((row) => {
      if (!inpersonMap.has(row.user_id)) inpersonMap.set(row.user_id, row);
    });

    const filteredProfiles = (profiles || []).filter((p) => safeLower(p.role) !== "coach");

    lastClientRowsForExport = filteredProfiles.map((p) => {
      const online = onlineMap.get(p.id);
      const inperson = inpersonMap.get(p.id);

      return {
        full_name: pickText(p.full_name, ""),
        email: pickText(p.email, ""),
        training_type: pickText(p.training_type, ""),
        online_plan: pickText(humanPlanName(online?.plan), ""),
        online_status: pickText(online?.status, ""),
        online_end: online?.end_date ? formatDisplayDate(online.end_date) : "",
        inperson_plan: pickText(humanPlanName(inperson?.plan_code), ""),
        inperson_status: pickText(inperson?.status, ""),
        inperson_end: inperson?.end_date ? formatDisplayDate(inperson.end_date) : "",
      };
    });

    const rows = filteredProfiles.map((p) => {
      const online = onlineMap.get(p.id);
      const inperson = inpersonMap.get(p.id);

      return `
        <tr>
          <td>${pickText(p.full_name)}</td>
          <td>${pickText(p.email)}</td>
          <td>${pickText(p.training_type)}</td>
          <td>${pickText(humanPlanName(online?.plan), "—")}</td>
          <td>${pickText(online?.status, "—")}</td>
          <td>${online?.end_date ? formatDisplayDate(online.end_date) : "—"}</td>
          <td>${pickText(humanPlanName(inperson?.plan_code), "—")}</td>
          <td>${pickText(inperson?.status, "—")}</td>
          <td>${inperson?.end_date ? formatDisplayDate(inperson.end_date) : "—"}</td>
        </tr>
      `;
    });

    if (!rows.length) {
      clientOverviewBox.innerHTML = `
        ${renderClientsExportButton()}
        <div>No clients found.</div>
      `;
    } else {
      clientOverviewBox.innerHTML = `
        ${renderClientsExportButton()}
        <div class="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Email</th>
                <th>Training Type</th>
                <th>Online Plan</th>
                <th>Online Status</th>
                <th>Online Ends</th>
                <th>In-Person Plan</th>
                <th>In-Person Status</th>
                <th>In-Person Ends</th>
              </tr>
            </thead>
            <tbody>
              ${rows.join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    const exportBtn = document.getElementById("exportClientsBtn");
    if (exportBtn) {
      exportBtn.onclick = () => {
        const csvRows = [
          [
            "Client",
            "Email",
            "Training Type",
            "Online Plan",
            "Online Status",
            "Online Ends",
            "In-Person Plan",
            "In-Person Status",
            "In-Person Ends",
          ],
          ...lastClientRowsForExport.map((r) => [
            r.full_name,
            r.email,
            r.training_type,
            r.online_plan,
            r.online_status,
            r.online_end,
            r.inperson_plan,
            r.inperson_status,
            r.inperson_end,
          ]),
        ];

        downloadCsv("nori-clients.csv", csvRows);
      };
    }
  }

  async function loadCalorieTrackerSection() {
    if (!coachCalorieBox || !coachCalorieDate) return;

    const selectedDate = coachCalorieDate.value || getTodayLocalDateString();
    coachCalorieBox.textContent = "Loading...";

    await loadProfilesMap();

    const { data, error } = await window.sb
      .from("coach_calorie_dashboard_rows")
      .select(`
        profile_id,
        full_name,
        email,
        user_id,
        profile_log_date,
        gender,
        age,
        height_feet,
        height_inches,
        weight_lb,
        activity_level,
        daily_calories,
        profile_updated_at,
        log_date,
        consumed_calories,
        remaining_calories,
        foods_logged,
        foods
      `)
      .or(`log_date.eq.${selectedDate},log_date.is.null`)
      .order("full_name", { ascending: true });

    if (error) {
      coachCalorieBox.textContent = "Could not load calorie information: " + error.message;
      return;
    }

    const rows = data || [];

    if (!rows.length) {
      lastCalorieRowsForExport = [];
      coachCalorieBox.innerHTML = `<div>No calorie tracker data found for ${formatDisplayDate(selectedDate)}.</div>`;
      return;
    }

    const rowsHtml = [];
    lastCalorieRowsForExport = [];

    rows.forEach((row) => {
      const clientName = pickText(row.full_name, getClientDisplay(row.user_id).name);
      const clientEmail = pickText(row.email, getClientDisplay(row.user_id).email || "—");
      const consumed = Number(row.consumed_calories || 0);
      const dailyTarget = Number(row.daily_calories || 0);
      const remaining = row.daily_calories == null ? "" : Number(row.remaining_calories || 0);

      const foodsText = String(row.foods || "").trim();
      const foodsArray = foodsText
        ? foodsText.split(" | ").filter(Boolean)
        : [];

      const foodsHtml = foodsArray.length
        ? `
          <div class="foods-mini-list">
            ${foodsArray.slice(0, 6).map((item) => `
              <div class="foods-mini-item">${pickText(item)}</div>
            `).join("")}
            ${foodsArray.length > 6 ? `<div class="foods-mini-item">+ ${foodsArray.length - 6} more</div>` : ""}
          </div>
        `
        : "—";

      rowsHtml.push(`
        <tr>
          <td>${clientName}</td>
          <td>${clientEmail}</td>
          <td>${formatDisplayDate(selectedDate)}</td>
          <td>${pickText(row.gender)}</td>
          <td>${pickText(row.age)}</td>
          <td>${row.height_feet != null || row.height_inches != null ? `${pickText(row.height_feet, "0")} ft ${pickText(row.height_inches, "0")} in` : "—"}</td>
          <td>${row.weight_lb != null ? `${pickText(row.weight_lb)} lb` : "—"}</td>
          <td>${pickText(row.activity_level)}</td>
          <td>${dailyTarget ? `${dailyTarget} kcal` : "—"}</td>
          <td>${consumed} kcal</td>
          <td>${row.daily_calories != null ? `${remaining} kcal` : "—"}</td>
          <td>${Number(row.foods_logged || 0)}</td>
          <td>${foodsHtml}</td>
          <td>${row.profile_updated_at ? formatDateTime(row.profile_updated_at) : "—"}</td>
        </tr>
      `);

      lastCalorieRowsForExport.push({
        client: clientName,
        email: clientEmail === "—" ? "" : clientEmail,
        log_date: selectedDate,
        gender: row.gender || "",
        age: row.age || "",
        height_feet: row.height_feet || "",
        height_inches: row.height_inches || "",
        weight_lb: row.weight_lb || "",
        activity_level: row.activity_level || "",
        daily_calories: dailyTarget || "",
        consumed_calories: consumed,
        remaining_calories: row.daily_calories != null ? remaining : "",
        foods_logged: Number(row.foods_logged || 0),
        foods: foodsText,
        profile_updated_at: row.profile_updated_at || "",
      });
    });

    coachCalorieBox.innerHTML = `
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Email</th>
              <th>Date</th>
              <th>Gender</th>
              <th>Age</th>
              <th>Height</th>
              <th>Weight</th>
              <th>Activity</th>
              <th>Daily Target</th>
              <th>Consumed</th>
              <th>Remaining</th>
              <th>Foods</th>
              <th>Food List</th>
              <th>Last Profile Save</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  async function loadInpersonRequests() {
    if (!inpersonRequestsBox) return;

    inpersonRequestsBox.textContent = "Loading...";

    await loadProfilesMap();
    await sweepExpiredPaygBookings();

    const bookingColumnsWithExpiry =
      "id, user_id, session_date, session_time, location, status, created_at, paid_at, plan_code, approved_at, payment_due_at, expired_at";
    const bookingColumnsBase =
      "id, user_id, session_date, session_time, location, status, created_at, paid_at, plan_code";

    const [requestRes, firstBookingRes] = await Promise.all([
      window.sb
        .from("inperson_requests")
        .select("id, user_id, full_name, email, plan_code, status, created_at, approved_at, paid_at, day_1, time_1, location_1, day_2, time_2, location_2, day_3, time_3, location_3")
        .order("created_at", { ascending: false })
        .limit(100),
      window.sb
        .from("inperson_bookings")
        .select(bookingColumnsWithExpiry)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    // The expiry columns are a later addition to inperson_bookings. Fall back to
    // the original column list so the table still loads before the migration.
    let bookingRes = firstBookingRes;
    if (bookingRes.error && isMissingExpiryColumnError(bookingRes.error)) {
      bookingRes = await window.sb
        .from("inperson_bookings")
        .select(bookingColumnsBase)
        .order("created_at", { ascending: false })
        .limit(100);
    }

    if (requestRes.error) {
      inpersonRequestsBox.textContent = "Could not load in-person requests: " + requestRes.error.message;
      return;
    }

    if (bookingRes.error) {
      inpersonRequestsBox.textContent = "Could not load pay-as-you-go bookings: " + bookingRes.error.message;
      return;
    }

    const requests = requestRes.data || [];
    const bookings = bookingRes.data || [];

    const requestRowsHtml = requests.map((r) => {
      const profileDisplay = getClientDisplay(r.user_id);
      const clientName = pickText(r.full_name, profileDisplay.name);
      const clientEmail = pickText(r.email, profileDisplay.email || "—");

      const scheduleParts = [
        [r.day_1, r.time_1, r.location_1].filter(Boolean).join(" — "),
        [r.day_2, r.time_2, r.location_2].filter(Boolean).join(" — "),
        [r.day_3, r.time_3, r.location_3].filter(Boolean).join(" — "),
      ].filter(Boolean);

      const statusLower = safeLower(r.status);
      let actionHtml = "—";

      if (statusLower === "requested" || statusLower === "pending" || statusLower === "submitted") {
        actionHtml = `
          <div class="action-row">
            <button class="approveRequestBtn mini-action-btn" data-id="${r.id}" type="button">
              Approve
            </button>
            <button class="denyRequestBtn mini-action-btn" data-id="${r.id}" type="button">
              Deny
            </button>
          </div>
        `;
      }

      return `
        <tr>
          <td>${clientName}</td>
          <td>${clientEmail}</td>
          <td>${pickText(humanPlanName(r.plan_code), r.plan_code)}</td>
          <td>${getRequestBadge(r.status)}</td>
          <td>${formatDisplayDate(r.created_at)}</td>
          <td>${scheduleParts.length ? scheduleParts.join("<br>") : "—"}</td>
          <td>${actionHtml}</td>
        </tr>
      `;
    });

    const bookingRowsHtml = bookings.map((b) => {
      const profileDisplay = getClientDisplay(b.user_id);
      const clientName = profileDisplay.name;
      const clientEmail = pickText(profileDisplay.email, "—");

      const statusLower = safeLower(b.status);
      const paid = isPaygPaid(b);
      const expired = isPaygExpired(b);
      const dueAt = getPaygPaymentDueAt(b);

      let actionHtml = "—";

      if (statusLower === "requested" || statusLower === "pending" || statusLower === "submitted") {
        actionHtml = `
          <div class="action-row">
            <button class="approveBookingBtn mini-action-btn" data-id="${b.id}" type="button">
              Approve
            </button>
            <button class="denyBookingBtn mini-action-btn" data-id="${b.id}" type="button">
              Deny
            </button>
          </div>
        `;
      } else if (expired) {
        // Re-approving restarts the payment clock from now.
        actionHtml = `
          <div class="action-row">
            <button class="approveBookingBtn mini-action-btn" data-id="${b.id}" type="button">
              Re-approve
            </button>
          </div>
        `;
      } else if (!paid && statusLower !== "denied" && statusLower !== "cancelled" && statusLower !== "canceled") {
        // Approved and still inside the payment window -- Extend restarts the clock.
        actionHtml = `
          <div class="action-row">
            <button class="approveBookingBtn mini-action-btn" data-id="${b.id}" type="button">
              Extend
            </button>
            <button class="denyBookingBtn mini-action-btn" data-id="${b.id}" type="button">
              Deny
            </button>
          </div>
        `;
      }

      let dueHtml = "—";
      if (paid) {
        dueHtml = "Paid";
      } else if (expired) {
        dueHtml = dueAt
          ? `${formatPaymentDeadline(dueAt)}<br><span style="color:#8b2f2f; font-weight:900;">Not paid in time</span>`
          : `<span style="color:#8b2f2f; font-weight:900;">Not paid in time</span>`;
      } else if (dueAt) {
        dueHtml = `${formatPaymentDeadline(dueAt)}<br><span style="font-weight:900;">${formatTimeLeft(dueAt)}</span>`;
      }

      return `
        <tr>
          <td>${clientName}</td>
          <td>${clientEmail}</td>
          <td>${pickText(humanPlanName(b.plan_code || "inperson_payg"), "Pay-As-You-Go")}</td>
          <td>${getBookingBadge(b.status, b.paid_at, expired)}</td>
          <td>${formatDisplayDate(b.created_at)}</td>
          <td>${formatDisplayDate(b.session_date)}<br>${pickText(b.session_time)}${b.location ? `<br>${pickText(b.location)}` : ""}</td>
          <td>${dueHtml}</td>
          <td>${actionHtml}</td>
        </tr>
      `;
    });

    inpersonRequestsBox.innerHTML = `
      <div style="display:grid; gap:20px;">
        <div>
          <div style="font-weight:900; font-size:18px; margin-bottom:10px; color:#2c221c;">Subscription Requests</div>
          ${
            requestRowsHtml.length
              ? `
                <div class="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Email</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Requested</th>
                        <th>Requested Schedule</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${requestRowsHtml.join("")}
                    </tbody>
                  </table>
                </div>
              `
              : `<div>No subscription requests found.</div>`
          }
        </div>

        <div>
          <div style="font-weight:900; font-size:18px; margin-bottom:10px; color:#2c221c;">Pay-As-You-Go Requests</div>
          ${
            bookingRowsHtml.length
              ? `
                <div class="tableWrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Email</th>
                        <th>Plan</th>
                        <th>Status</th>
                        <th>Requested</th>
                        <th>Requested Session</th>
                        <th>Payment Due</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${bookingRowsHtml.join("")}
                    </tbody>
                  </table>
                </div>
              `
              : `<div>No pay-as-you-go requests found.</div>`
          }
        </div>
      </div>
    `;

    inpersonRequestsBox.querySelectorAll(".approveRequestBtn").forEach((btn) => {
      btn.onclick = async () => {
        const requestId = btn.getAttribute("data-id");
        if (!requestId) return;
        await approveInpersonRequest(requestId);
      };
    });

    inpersonRequestsBox.querySelectorAll(".denyRequestBtn").forEach((btn) => {
      btn.onclick = async () => {
        const requestId = btn.getAttribute("data-id");
        if (!requestId) return;
        await denyInpersonRequest(requestId);
      };
    });

    inpersonRequestsBox.querySelectorAll(".approveBookingBtn").forEach((btn) => {
      btn.onclick = async () => {
        const bookingId = btn.getAttribute("data-id");
        if (!bookingId) return;
        await approvePaygBooking(bookingId, bookings.find((row) => String(row.id) === String(bookingId)));
      };
    });

    inpersonRequestsBox.querySelectorAll(".denyBookingBtn").forEach((btn) => {
      btn.onclick = async () => {
        const bookingId = btn.getAttribute("data-id");
        if (!bookingId) return;
        await denyPaygBooking(bookingId);
      };
    });
  }

  async function loadCoachQueue() {
    if (!coachQueueList) return;

    coachQueueList.textContent = "Loading...";

    await loadProfilesMap();

    const { data, error } = await window.sb
      .from("form_video_reviews")
      .select("id, user_id, status, client_uploaded_at, client_notes, client_video_path, coach_video_path, coach_notes")
      .order("client_uploaded_at", { ascending: false })
      .limit(100);

    if (error) {
      coachQueueList.textContent = "Could not load coach queue: " + error.message;
      return;
    }

    const rows = data || [];
    if (rows.length === 0) {
      coachQueueList.innerHTML = `<div style="opacity:0.9;">No submissions yet.</div>`;
      return;
    }

    const html = await Promise.all(
      rows.map(async (r) => {
        const clientUrl = await getPublicUrl(r.client_video_path);
        const coachUrl = r.coach_video_path ? await getPublicUrl(r.coach_video_path) : "";
        const badge =
          safeLower(r.status) === "reviewed"
            ? `<span class="pill pill-green">Reviewed</span>`
            : `<span class="pill pill-yellow">Submitted</span>`;

        const clientDisplay = getClientDisplay(r.user_id);

        return `
          <div class="queueItem"
            data-review="${r.id}"
            data-user="${r.user_id}">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
              <div>
                <div style="font-weight:900;">${clientDisplay.name}</div>
                <div style="opacity:0.82; font-size:13px; margin-top:4px;">${clientDisplay.email || r.user_id}</div>
              </div>
              ${badge}
            </div>

            <div style="opacity:0.9; margin-top:8px; font-weight:800;">
              ${r.client_uploaded_at ? new Date(r.client_uploaded_at).toLocaleString() : ""}
            </div>

            <div style="opacity:0.85; margin-top:8px;">
              ${pickText(r.client_notes, "No client notes")}
            </div>

            <div style="margin-top:10px;" class="action-row">
              <button class="selectReviewBtn video-link-btn" data-review="${r.id}" data-user="${r.user_id}" type="button">
                Select Submission
              </button>
              ${
                clientUrl
                  ? `<button class="openClientVideoBtn video-link-btn" data-url="${clientUrl}" data-title="${clientDisplay.name} - Client Submission" type="button">
                      Open Client Video
                    </button>`
                  : ``
              }
              ${
                coachUrl
                  ? `<button class="openCoachVideoBtn video-link-btn" data-url="${coachUrl}" data-title="${clientDisplay.name} - Coach Feedback" type="button">
                      Open Coach Video
                    </button>`
                  : ``
              }
            </div>

            <div style="margin-top:10px;">
              ${
                clientUrl
                  ? `<video class="queueVideo" muted preload="metadata" playsinline>
                      <source src="${clientUrl}">
                    </video>`
                  : `<div style="opacity:0.85;">No client video found.</div>`
              }
            </div>

            ${
              r.coach_notes
                ? `<div style="margin-top:10px; opacity:0.92;"><strong>Coach notes:</strong><br>${pickText(r.coach_notes)}</div>`
                : ``
            }
          </div>
        `;
      })
    );

    coachQueueList.innerHTML = html.join("");

    const itemEls = coachQueueList.querySelectorAll(".queueItem");
    const selectBtns = coachQueueList.querySelectorAll(".selectReviewBtn");
    const clientVideoBtns = coachQueueList.querySelectorAll(".openClientVideoBtn");
    const coachVideoBtns = coachQueueList.querySelectorAll(".openCoachVideoBtn");

    function setSelected(reviewId, userId) {
      coachSelectedReviewId = reviewId;
      coachSelectedUserId = userId;

      const clientDisplay = getClientDisplay(userId);

      itemEls.forEach((x) => {
        const rid = x.getAttribute("data-review");
        if (rid === reviewId) x.classList.add("selected");
        else x.classList.remove("selected");
      });

      if (coachSelectedMeta) {
        coachSelectedMeta.textContent =
          "Selected submission: " +
          reviewId +
          " | Client: " +
          clientDisplay.name +
          (clientDisplay.email ? " | " + clientDisplay.email : "");
      }

      if (coachSendMsg) coachSendMsg.textContent = "";
    }

    selectBtns.forEach((btn) => {
      btn.onclick = () => {
        const rid = btn.getAttribute("data-review");
        const uid = btn.getAttribute("data-user");
        if (!rid || !uid) return;
        setSelected(rid, uid);
      };
    });

    clientVideoBtns.forEach((btn) => {
      btn.onclick = () => {
        const url = btn.getAttribute("data-url");
        const title = btn.getAttribute("data-title") || "Client Video";
        if (!url) return;
        openVideo(title, url);
      };
    });

    coachVideoBtns.forEach((btn) => {
      btn.onclick = () => {
        const url = btn.getAttribute("data-url");
        const title = btn.getAttribute("data-title") || "Coach Video";
        if (!url) return;
        openVideo(title, url);
      };
    });
  }

  async function coachSendFeedback() {
    if (!coachSendMsg || !coachVideoFile || !coachNotes) return;

    if (!coachSelectedReviewId || !coachSelectedUserId) {
      coachSendMsg.textContent = "Select a submission first.";
      return;
    }

    const file = coachVideoFile.files?.[0];
    const notes = coachNotes.value.trim() || null;

    if (!file && !notes) {
      coachSendMsg.textContent = "Add a feedback video and/or written notes.";
      return;
    }

    coachSendMsg.textContent = "Sending...";

    let coachPath = null;

    try {
      if (file) {
        const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
        coachPath = `coach/${coachSelectedUserId}/${coachSelectedReviewId}.${ext}`;
        await uploadToBucket(coachPath, file);
      }

      const payload = {
        status: "reviewed",
        coach_notes: notes,
        coach_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (coachPath) payload.coach_video_path = coachPath;

      const { error } = await window.sb
        .from("form_video_reviews")
        .update(payload)
        .eq("id", coachSelectedReviewId);

      if (error) {
        coachSendMsg.textContent = "Could not save feedback: " + error.message;
        return;
      }

      const clientDisplay = getClientDisplay(coachSelectedUserId);

      coachSendMsg.textContent = "Sent ✅";
      coachVideoFile.value = "";
      coachNotes.value = "";

      if (coachSelectedMeta) {
        coachSelectedMeta.textContent =
          "Selected submission: " +
          coachSelectedReviewId +
          " | Client: " +
          clientDisplay.name +
          (clientDisplay.email ? " | " + clientDisplay.email : "");
      }

      await loadCoachQueue();
    } catch (err) {
      coachSendMsg.textContent = "Failed. Try again.";
      console.error(err);
    }
  }

  async function loadWaitlist(trainingType, targetEl) {
    if (!targetEl) return;

    targetEl.textContent = "Loading...";

    const { data, error } = await window.sb
      .from("waitlist")
      .select("id, created_at, full_name, email, phone, position, status, training_type")
      .eq("training_type", trainingType)
      .order("position", { ascending: true });

    if (error) {
      targetEl.textContent = "Could not load waitlist: " + error.message;
      return;
    }

    const rows = (data || []).filter((r) => safeLower(r.status) === "waiting");

    if (rows.length === 0) {
      targetEl.textContent = "No one on this waitlist yet.";
      return;
    }

    targetEl.innerHTML = `
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Position</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Date Joined</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (r) => `
              <tr>
                <td>#${pickText(r.position)}</td>
                <td>${pickText(r.full_name)}</td>
                <td>${pickText(r.email)}</td>
                <td>${pickText(r.phone)}</td>
                <td>${formatDisplayDate(r.created_at)}</td>
                <td>
                  <div class="action-row">
                    <button class="waitlistInviteBtn mini-action-btn" data-id="${r.id}" type="button">
                      Mark Invited
                    </button>
                    <button class="waitlistConvertBtn mini-action-btn" data-id="${r.id}" type="button">
                      Mark Active
                    </button>
                    <button class="waitlistRemoveBtn mini-action-btn" data-id="${r.id}" type="button">
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    const inviteBtns = targetEl.querySelectorAll(".waitlistInviteBtn");
    inviteBtns.forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        await updateWaitlistStatus(id, "invited");
      };
    });

    const convertBtns = targetEl.querySelectorAll(".waitlistConvertBtn");
    convertBtns.forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        await updateWaitlistStatus(id, "converted");
      };
    });

    const removeBtns = targetEl.querySelectorAll(".waitlistRemoveBtn");
    removeBtns.forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        await updateWaitlistStatus(id, "removed");
      };
    });
  }

  async function loadBootcampSignups() {
    if (!bootcampSignupsBox) return;

    bootcampSignupsBox.textContent = "Loading...";

    const { data, error } = await window.sb
      .from("bootcamp_signups")
      .select("bootcamp_code, full_name, email, phone, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      bootcampSignupsBox.textContent = "Could not load bootcamp signups: " + error.message;
      return;
    }

    if (!data || data.length === 0) {
      bootcampSignupsBox.textContent = "No bootcamp signups found.";
      return;
    }

    bootcampSignupsBox.innerHTML = `
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Bootcamp</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            ${data
              .map(
                (r) => `
              <tr>
                <td>${humanBootcampName(r.bootcamp_code)}</td>
                <td>${pickText(r.full_name)}</td>
                <td>${pickText(r.email)}</td>
                <td>${pickText(r.phone)}</td>
                <td>${formatDisplayDate(r.paid_at || r.created_at)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function formatMessageTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // -------------------------------------------------------------------------
  // Client messaging
  // -------------------------------------------------------------------------
  async function loadMessagingClients() {
    if (!coachMsgClientList) return;

    coachMsgClientList.textContent = "Loading...";

    await loadProfilesMap();

    const [onlineRes, msgRes] = await Promise.all([
      window.sb.from("subscriptions").select("user_id"),
      window.sb
        .from("messages")
        .select("client_id, sender_role, body, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
    ]);

    if (msgRes.error) {
      coachMsgClientList.textContent =
        "Could not load messages: " + msgRes.error.message;
      return;
    }

    const messages = msgRes.data || [];

    // Build per-client summary: last message + unread (from client) count.
    const summary = new Map();
    messages.forEach((m) => {
      let entry = summary.get(m.client_id);
      if (!entry) {
        entry = { last: m, unread: 0 };
        summary.set(m.client_id, entry);
      }
      if (m.sender_role === "client" && !m.read_at) entry.unread += 1;
    });

    // Conversation list = every online client, plus anyone who has messaged.
    const clientIds = new Set();
    (onlineRes.data || []).forEach((r) => r.user_id && clientIds.add(r.user_id));
    messages.forEach((m) => clientIds.add(m.client_id));

    const items = [...clientIds]
      .filter((id) => safeLower(profileMap.get(id)?.role) !== "coach")
      .map((id) => {
        const prof = profileMap.get(id);
        const entry = summary.get(id);
        return {
          clientId: id,
          name: pickText(prof?.full_name, prof?.email || id),
          email: pickText(prof?.email, ""),
          last: entry?.last || null,
          unread: entry?.unread || 0,
        };
      })
      .sort((a, b) => {
        const at = a.last ? new Date(a.last.created_at).getTime() : 0;
        const bt = b.last ? new Date(b.last.created_at).getTime() : 0;
        return bt - at;
      });

    if (!items.length) {
      coachMsgClientList.innerHTML =
        `<div style="opacity:0.9;">No online clients yet.</div>`;
      return;
    }

    coachMsgClientList.innerHTML = items
      .map((it) => {
        const preview = it.last
          ? `${it.last.sender_role === "coach" ? "You: " : ""}${pickText(it.last.body, "")}`
          : "No messages yet";
        const previewShort =
          preview.length > 60 ? preview.slice(0, 57) + "..." : preview;

        return `
          <button class="coach-convo-item ${it.clientId === coachMsgSelectedClientId ? "selected" : ""}"
            type="button" data-client="${escapeHtml(it.clientId)}">
            <span style="display:block; min-width:0;">
              <span style="display:block; font-weight:900;">${escapeHtml(it.name)}</span>
              <span style="display:block; opacity:0.8; font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${escapeHtml(previewShort)}
              </span>
            </span>
            ${it.unread ? `<span class="coach-convo-unread">${it.unread}</span>` : ""}
          </button>
        `;
      })
      .join("");

    coachMsgClientList.querySelectorAll(".coach-convo-item").forEach((btn) => {
      btn.onclick = () => {
        const clientId = btn.getAttribute("data-client");
        if (clientId) selectConversation(clientId);
      };
    });
  }

  async function selectConversation(clientId) {
    coachMsgSelectedClientId = clientId;

    const prof = profileMap.get(clientId);
    if (coachMsgSelectedMeta) {
      const name = pickText(prof?.full_name, clientId);
      const email = pickText(prof?.email, "");
      coachMsgSelectedMeta.textContent =
        "Selected client: " + name + (email ? " | " + email : "");
    }

    coachMsgClientList?.querySelectorAll(".coach-convo-item").forEach((el) => {
      el.classList.toggle("selected", el.getAttribute("data-client") === clientId);
    });

    await loadConversationThread();
  }

  async function loadConversationThread() {
    if (!coachMsgThread || !coachMsgSelectedClientId) return;

    const { data, error } = await window.sb
      .from("messages")
      .select("id, sender_role, body, read_at, created_at")
      .eq("client_id", coachMsgSelectedClientId)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      coachMsgThread.innerHTML =
        `<div class="coach-msg-empty">Could not load thread: ${escapeHtml(error.message)}</div>`;
      return;
    }

    const rows = data || [];

    if (!rows.length) {
      coachMsgThread.innerHTML =
        `<div class="coach-msg-empty">No messages with this client yet.</div>`;
    } else {
      coachMsgThread.innerHTML = rows
        .map((m) => {
          const mine = m.sender_role === "coach";
          const who = mine ? "You" : "Client";
          return `
            <div class="coach-msg-bubble ${mine ? "coach-msg-mine" : "coach-msg-theirs"}">
              <div>${escapeHtml(m.body)}</div>
              <span class="coach-msg-meta">${who} · ${escapeHtml(formatMessageTime(m.created_at))}</span>
            </div>
          `;
        })
        .join("");
      coachMsgThread.scrollTop = coachMsgThread.scrollHeight;
    }

    // Mark the client's messages in this thread as read.
    if (rows.some((m) => m.sender_role === "client" && !m.read_at)) {
      await window.sb
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("client_id", coachMsgSelectedClientId)
        .eq("sender_role", "client")
        .is("read_at", null);
      await loadMessagingClients();
    }
  }

  async function sendCoachMessage() {
    if (!coachMsgInput || !coachMsgSendBtn) return;

    if (!coachMsgSelectedClientId) {
      if (coachMsgStatus) coachMsgStatus.textContent = "Select a client first.";
      return;
    }

    const body = coachMsgInput.value.trim();
    if (!body) return;

    coachMsgSendBtn.disabled = true;
    if (coachMsgStatus) coachMsgStatus.textContent = "Sending...";

    const { error } = await window.sb.from("messages").insert([{
      client_id: coachMsgSelectedClientId,
      sender_id: coachUserId,
      sender_role: "coach",
      body,
    }]);

    coachMsgSendBtn.disabled = false;

    if (error) {
      if (coachMsgStatus) coachMsgStatus.textContent = "Could not send: " + error.message;
      return;
    }

    coachMsgInput.value = "";
    if (coachMsgStatus) coachMsgStatus.textContent = "Sent ✅";
    await loadConversationThread();
    await loadMessagingClients();
  }

  try {
    statusEl.textContent = "Checking login...";

    const { data: userResult, error: userError } = await window.sb.auth.getUser();
    if (userError || !userResult?.user) {
      window.location.href = "login.html";
      return;
    }

    const userId = userResult.user.id;
    coachUserId = userId;

    const { data: prof, error: profError } = await window.sb
      .from("profiles")
      .select("id, full_name, email, role")
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .limit(1)
      .maybeSingle();

    if (profError || !prof) {
      statusEl.textContent = "Could not verify coach access.";
      return;
    }

    if (safeLower(prof.role) !== "coach") {
      statusEl.textContent = "Access denied. Coach account required.";
      return;
    }

    statusEl.textContent =
      "Logged in as: " +
      pickText(prof.full_name, "Coach") +
      " | " +
      pickText(prof.email);

    if (coachDashboard) coachDashboard.style.display = "block";

    if (coachCalorieDate) {
      coachCalorieDate.value = getTodayLocalDateString();
    }

    if (coachSendBtn && !coachSendBtn.dataset.wired) {
      coachSendBtn.dataset.wired = "1";
      coachSendBtn.onclick = async () => {
        await coachSendFeedback();
      };
    }

    if (coachMsgSendBtn && !coachMsgSendBtn.dataset.wired) {
      coachMsgSendBtn.dataset.wired = "1";
      coachMsgSendBtn.onclick = async () => {
        await sendCoachMessage();
      };
    }

    if (coachMsgInput && !coachMsgInput.dataset.wired) {
      coachMsgInput.dataset.wired = "1";
      coachMsgInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendCoachMessage();
        }
      });
    }

    if (refreshCalorieBtn && !refreshCalorieBtn.dataset.wired) {
      refreshCalorieBtn.dataset.wired = "1";
      refreshCalorieBtn.onclick = async () => {
        await loadCalorieTrackerSection();
      };
    }

    if (coachCalorieDate && !coachCalorieDate.dataset.wired) {
      coachCalorieDate.dataset.wired = "1";
      coachCalorieDate.onchange = async () => {
        await loadCalorieTrackerSection();
      };
    }

    if (exportCalorieBtn && !exportCalorieBtn.dataset.wired) {
      exportCalorieBtn.dataset.wired = "1";
      exportCalorieBtn.onclick = () => {
        const selectedDate = coachCalorieDate?.value || getTodayLocalDateString();

        const csvRows = [
          [
            "Client",
            "Email",
            "Date",
            "Gender",
            "Age",
            "Height Feet",
            "Height Inches",
            "Weight lb",
            "Activity Level",
            "Daily Calories",
            "Consumed Calories",
            "Remaining Calories",
            "Foods Logged",
            "Food List",
            "Last Profile Save"
          ],
          ...lastCalorieRowsForExport.map((r) => [
            r.client,
            r.email,
            r.log_date,
            r.gender,
            r.age,
            r.height_feet,
            r.height_inches,
            r.weight_lb,
            r.activity_level,
            r.daily_calories,
            r.consumed_calories,
            r.remaining_calories,
            r.foods_logged,
            r.foods,
            r.profile_updated_at
          ]),
        ];

        downloadCsv(`coach-calorie-tracker-${selectedDate}.csv`, csvRows);
      };
    }

    await Promise.all([
      loadProfilesMap(),
      loadClientOverview(),
      loadCalorieTrackerSection(),
      loadInpersonRequests(),
      loadCoachQueue(),
      loadWaitlist("online", onlineWaitlistBox),
      loadWaitlist("inperson", inpersonWaitlistBox),
      loadBootcampSignups(),
      loadMessagingClients(),
    ]);

    if (!window.__coachMessagesPollingStarted) {
      window.__coachMessagesPollingStarted = true;
      setInterval(async () => {
        await loadMessagingClients();
        if (coachMsgSelectedClientId) await loadConversationThread();
      }, 15000);
    }
  } catch (err) {
    statusEl.textContent = "Coach dashboard error: " + (err?.message || String(err));
    console.error(err);
  }
});