// dashboard.js

let inactivityTimer = null;

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);

  inactivityTimer = setTimeout(async () => {
    try {
      await window.sb?.auth?.signOut();
    } catch { }

    window.location.href = "login.html";
  }, 30 * 60 * 1000);
}

["click", "mousemove", "keydown", "scroll", "touchstart"].forEach((eventName) => {
  document.addEventListener(eventName, resetInactivityTimer, { passive: true });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) resetInactivityTimer();
});

window.addEventListener("focus", resetInactivityTimer);
window.addEventListener("pageshow", resetInactivityTimer);

resetInactivityTimer();

function isExpired(endDateStr) {
  if (!endDateStr) return true;

  const today = new Date();
  const end = new Date(endDateStr);

  if (Number.isNaN(end.getTime())) return true;

  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return end < today;
}

function pickText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeLower(value) {
  return String(value || "").toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractFileNameFromPath(path) {
  const raw = String(path || "").trim();
  if (!raw) return "—";
  const parts = raw.split("/");
  return parts[parts.length - 1] || raw;
}

function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDisplayDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "(none)";

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const monthIndex = Number(match[2]) - 1;
  return `${months[monthIndex] || match[2]} ${Number(match[3])}, ${match[1]}`;
}

function formatPlanExpiryDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return "—";

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;

  const month = d.toLocaleString("en-US", { month: "long" });
  return `${month}.${d.getDate()}.${d.getFullYear()}`;
}

function formatWeekLabel(weekName, createdAt) {
  const raw = String(weekName || "").trim();
  if (raw) return raw;

  if (!createdAt) return "This Week";

  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "This Week";

  return `Week of ${d.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`;
}

function normalizeWorkoutDay(value) {
  const raw = safeLower(value).trim();

  if (raw === "mon" || raw === "monday") return "Mon";
  if (raw === "tue" || raw === "tues" || raw === "tuesday") return "Tue";
  if (raw === "wed" || raw === "weds" || raw === "wednesday") return "Wed";
  if (raw === "thu" || raw === "thur" || raw === "thurs" || raw === "thursday") return "Thu";
  if (raw === "fri" || raw === "friday") return "Fri";
  if (raw === "sat" || raw === "saturday") return "Sat";
  if (raw === "sun" || raw === "sunday") return "Sun";

  return "";
}

function normalizeTrainingType(value) {
  const raw = safeLower(value).replace(/[\s_-]+/g, "");
  if (raw === "inperson") return "inperson";
  if (raw === "online") return "online";
  if (raw === "both" || raw === "onlineinperson" || raw === "inpersononline") return "both";
  return raw;
}

function planCodeToLabel(planCode) {
  const p = safeLower(planCode);

  if (p.includes("inperson_1x")) return "1x / Week";
  if (p.includes("inperson_3x")) return "3x / Week";
  if (p.includes("inperson_payg")) return "Pay-As-You-Go";

  if (p.includes("starter_monthly")) return "Starter Monthly";
  if (p.includes("starter_3")) return "Starter (3 Months)";
  if (p.includes("starter_6")) return "Starter (6 Months)";
  if (p.includes("pro_monthly")) return "Pro Monthly";
  if (p.includes("pro_3")) return "Pro (3 Months)";
  if (p.includes("starter")) return "Starter";
  if (p.includes("pro")) return "Pro";

  return planCode || "—";
}

function planMonths(planCode) {
  const p = safeLower(planCode);
  if (p.includes("starter_monthly")) return 1;
  if (p.includes("starter_3")) return 3;
  if (p.includes("starter_6")) return 6;
  if (p.includes("pro_monthly")) return 1;
  if (p.includes("pro_3")) return 3;
  return 1;
}

function getInPersonWeeklyLimit(planCode) {
  const p = safeLower(planCode);
  if (p.includes("inperson_3x")) return 3;
  if (p.includes("inperson_1x")) return 1;
  if (p.includes("inperson_payg")) return 0;
  return null;
}

function isApprovedLike(value) {
  const s = safeLower(value);
  return s === "approved" || s === "active" || s === "booked" || s === "confirmed";
}

function isPendingLike(value) {
  const s = safeLower(value);
  return s === "pending" || s === "submitted" || s === "awaiting_approval";
}

function isPaidLike(value) {
  const s = safeLower(value);
  return s === "paid" || s === "complete" || s === "completed";
}

function isDeniedLike(value) {
  const s = safeLower(value);
  return s === "denied" || s === "rejected" || s === "declined" || s === "cancelled" || s === "canceled";
}

// An approved pay-as-you-go booking holds a session slot, so it cannot sit
// unpaid forever. The client gets this long from the moment the coach approves;
// once the window closes the booking expires on its own and the slot is freed.
// Keep this in sync with coach-dashboard.js, create-checkout, and the
// window_hours default in supabase/inperson-payg-expiry.sql.
const PAYG_PAYMENT_WINDOW_HOURS = 48;

function isExpiredLike(value) {
  const s = safeLower(value);
  return s === "expired" || s === "lapsed";
}

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

function getPaygPaymentDueAt(row) {
  if (!row) return null;

  const stored = row.payment_due_at ? new Date(row.payment_due_at) : null;
  if (stored && !Number.isNaN(stored.getTime())) return stored;

  // payment_due_at is stamped at approval. Derive it for rows approved before
  // the column existed so older bookings still carry a deadline.
  if (!isApprovedLike(row.status)) return null;

  const approvedAt = new Date(row.approved_at || row.created_at || 0);
  if (Number.isNaN(approvedAt.getTime()) || !approvedAt.getTime()) return null;

  let due = new Date(approvedAt.getTime() + PAYG_PAYMENT_WINDOW_HOURS * 60 * 60 * 1000);

  // A session starting sooner than the window closes has to be paid before it
  // starts -- there is no point taking payment for a slot already gone.
  const sessionStart = parsePaygSessionStart(row.session_date, row.session_time);
  if (sessionStart && sessionStart > approvedAt && sessionStart < due) due = sessionStart;

  return due;
}

function isPaygPaid(row) {
  if (!row) return false;
  return !!row.paid_at || !!row.stripe_session_id || isPaidLike(row.status);
}

function isPaygExpired(row) {
  if (!row) return false;
  if (isPaygPaid(row)) return false;
  if (isExpiredLike(row.status)) return true;

  const due = getPaygPaymentDueAt(row);
  return !!due && due.getTime() <= Date.now();
}

function formatPaymentDeadline(due) {
  if (!due) return "";

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
  if (msLeft <= 0) return "expired";

  const hoursLeft = Math.floor(msLeft / (60 * 60 * 1000));
  if (hoursLeft >= 48) return `${Math.floor(hoursLeft / 24)} days left`;
  if (hoursLeft >= 1) return `${hoursLeft} hour${hoursLeft === 1 ? "" : "s"} left`;

  const minutesLeft = Math.max(1, Math.round(msLeft / (60 * 1000)));
  return `${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} left`;
}

function describePaymentDeadline(due) {
  if (!due) return "";
  return `Pay by ${formatPaymentDeadline(due)} (${formatTimeLeft(due)}) or this booking expires.`;
}

function getTrainingLabel(hasInPersonAccess, hasOnlineAccess) {
  if (hasInPersonAccess && hasOnlineAccess) return "InPerson+Online";
  if (hasInPersonAccess) return "InPerson";
  if (hasOnlineAccess) return "Online";
  return "No Active Plan";
}

function getExpiryLabel(inpersonSub, onlineSub, hasInPersonAccess, hasOnlineAccess) {
  if (hasInPersonAccess && hasOnlineAccess) {
    return `InPerson: ${formatPlanExpiryDate(inpersonSub?.end_date)} • Online: ${formatPlanExpiryDate(onlineSub?.end_date)}`;
  }
  if (hasInPersonAccess) return formatPlanExpiryDate(inpersonSub?.end_date);
  if (hasOnlineAccess) return formatPlanExpiryDate(onlineSub?.end_date);
  return "—";
}

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function buildVimeoEmbed(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  const match = raw.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (!match) return "";

  return `https://player.vimeo.com/video/${match[1]}`;
}

function isVimeoUrl(url) {
  return /vimeo\.com/i.test(String(url || ""));
}

function getBrowserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local Time";
  } catch {
    return "Local Time";
  }
}

function formatLoggedInStamp(fullName) {
  const now = new Date();
  const timezone = getBrowserTimezone();

  const datePart = new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    timeZone: timezone,
  }).format(now);

  const timePart = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
  }).format(now);

  const tzShortParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
  }).formatToParts(now);

  const tzShort =
    tzShortParts.find((part) => part.type === "timeZoneName")?.value || timezone;

  return `${fullName} Logged in at: ${datePart}, ${timePart} ${tzShort}`;
}

function normalizeLocationText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeLocationCompare(value) {
  return normalizeLocationText(value).toLowerCase();
}

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 3958.8;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

function formatTentativeSchedule(row) {
  if (!row) return "";

  const isPayg =
    safeLower(row.plan_code).includes("inperson_payg") ||
    row.session_date ||
    row.session_time ||
    row.location;

  if (isPayg) {
    const dateText = pickText(row.session_date || row.day_1, "—");
    const timeText = pickText(row.session_time || row.time_1, "—");
    const locationText = pickText(row.location || row.location_1, "—");
    return `Tentative session: ${formatDisplayDate(dateText)} • ${timeText} • ${locationText}`;
  }

  const parts = [];
  parts.push(`Session 1: ${pickText(row.day_1, "—")} • ${pickText(row.time_1, "—")} • ${pickText(row.location_1, "—")}`);

  if (pickText(row.day_2, "") || pickText(row.time_2, "") || pickText(row.location_2, "")) {
    parts.push(`Session 2: ${pickText(row.day_2, "—")} • ${pickText(row.time_2, "—")} • ${pickText(row.location_2, "—")}`);
  }

  if (pickText(row.day_3, "") || pickText(row.time_3, "") || pickText(row.location_3, "")) {
    parts.push(`Session 3: ${pickText(row.day_3, "—")} • ${pickText(row.time_3, "—")} • ${pickText(row.location_3, "—")}`);
  }

  return parts.join(" | ");
}

const GCAL_IFRAME_URL =
  "https://calendar.google.com/calendar/embed?src=info%40nori-fitness.com&ctz=America%2FNew_York";

const FORM_BUCKET = "form_videos";

const ONLINE_PRICE_MAP = {
  starter_monthly: { price_id: "price_1Tg8iV2UkFduvWwcVwLFXWdj", mode: "subscription" },
  starter_3: { price_id: "price_1TgANX2UkFduvWwct2Diq9Oc", mode: "payment" },
  starter_6: { price_id: "price_1TgAOm2UkFduvWwc2urhXCmV", mode: "payment" },
  pro_monthly: { price_id: "price_1Tg8k62UkFduvWwcgvyP0hYT", mode: "subscription" },
  pro_3: { price_id: "price_1Tg8r52UkFduvWwcnlFgaDZp", mode: "payment" },
};

const INPERSON_PRICE_MAP = {
  inperson_1x: { price_id: "price_1TuBcq2UkFduvWwcRQnEEu7E", mode: "subscription" },
  inperson_3x: { price_id: "price_1TuBeq2UkFduvWwcS7TbSEWK", mode: "subscription" },
  inperson_payg: { price_id: "price_1U7hrC2UkFduvWwci1qcOT3k", mode: "payment" },
};

const INPERSON_MAX_DISTANCE_MILES = 25;
const INPERSON_HOME_BASE_QUERY = "22312, Alexandria, VA, USA";
const INPERSON_PREFERRED_LOCATIONS = [
  "4620 Kenmore Ave, Alexandria, VA 22304",
  "6123 Backlick Rd, Springfield, VA 22150",
];

const POLL_MS = 5000;

function ensureOnlinePurchaseUI(checkoutHandler) {
  const onlineUnavailableBox = document.getElementById("onlineUnavailableBox");
  if (!onlineUnavailableBox) return;

  const onlineAddonPurchaseBox = document.getElementById("onlineAddonPurchaseBox");
  const onlineAddonActiveBox = document.getElementById("onlineAddonActiveBox");
  const onlineAddonPlanSelect = document.getElementById("onlineAddonPlanSelect");
  const onlineAddonBuyBtn = document.getElementById("onlineAddonBuyBtn");
  const onlineAddonStatus = document.getElementById("onlineAddonStatus");

  if (
    !onlineAddonPurchaseBox ||
    !onlineAddonActiveBox ||
    !onlineAddonPlanSelect ||
    !onlineAddonBuyBtn ||
    !onlineAddonStatus
  ) {
    return;
  }

  if (typeof checkoutHandler !== "function") return;
  if (onlineAddonBuyBtn.dataset.wired === "1") return;

  onlineAddonBuyBtn.dataset.wired = "1";

  onlineAddonBuyBtn.onclick = async () => {
    const planKey = onlineAddonPlanSelect.value;
    const config = ONLINE_PRICE_MAP[planKey];
    if (!config) return;

    onlineAddonStatus.textContent = "Redirecting...";

    try {
      await checkoutHandler({
        priceId: config.price_id,
        mode: config.mode,
        planLabel: planKey,
        source: planKey,
        months: planMonths(planKey),
      });
    } catch (err) {
      onlineAddonStatus.textContent = err?.message || "Checkout failed.";
    }
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  if (window.__dashboardPageBooted) return;
  window.__dashboardPageBooted = true;

  const statusEl = document.getElementById("status");
  const logoutBtn = document.getElementById("logoutBtn");

  const welcomeGreeting = document.getElementById("welcomeGreeting");
  const welcomeSubtext = document.getElementById("welcomeSubtext");

  const mainTabOverview = document.getElementById("mainTabOverview");
  const mainTabInperson = document.getElementById("mainTabInperson");
  const mainTabOnline = document.getElementById("mainTabOnline");
  const mainTabNutrition = document.getElementById("mainTabNutrition");
  const mainTabCalories = document.getElementById("mainTabCalories");
  const mainTabMessages = document.getElementById("mainTabMessages");
  const mainTabMessagesBadge = document.getElementById("mainTabMessagesBadge");

  const mainPanelOverview = document.getElementById("mainPanelOverview");
  const mainPanelInperson = document.getElementById("mainPanelInperson");
  const mainPanelOnline = document.getElementById("mainPanelOnline");
  const mainPanelNutrition = document.getElementById("mainPanelNutrition");
  const mainPanelCalories = document.getElementById("mainPanelCalories");
  const mainPanelMessages = document.getElementById("mainPanelMessages");

  const msgThread = document.getElementById("msgThread");
  const msgInput = document.getElementById("msgInput");
  const msgSendBtn = document.getElementById("msgSendBtn");
  const msgStatus = document.getElementById("msgStatus");

  const inpersonPaymentBanner = document.getElementById("inpersonPaymentBanner");
  let inpersonPaymentCards = document.getElementById("inpersonPaymentCards");

  const inpersonSection = document.getElementById("inpersonSection");
  const inpersonUnavailableBox = document.getElementById("inpersonUnavailableBox");
  const inpersonPlanStatus = document.getElementById("inpersonPlanStatus");
  const inpersonRules = document.getElementById("inpersonRules");
  const inpersonHint = document.getElementById("inpersonHint");

  const inpersonMsg = document.getElementById("inpersonMsg");
  const sendInpersonRequestBtn = document.getElementById("sendInpersonRequestBtn");

  const inpersonPlanGrid = document.getElementById("inpersonPlanGrid");
  const inpersonPlanChoice = document.getElementById("inpersonPlanChoice");

  let day1 = document.getElementById("day1");
  let day2 = document.getElementById("day2");
  let day3 = document.getElementById("day3");

  const time1 = document.getElementById("time1");
  const time2 = document.getElementById("time2");
  const time3 = document.getElementById("time3");

  const slot2 = document.getElementById("slot2");
  const slot3 = document.getElementById("slot3");

  const location1Preset = document.getElementById("location1Preset");
  const location2Preset = document.getElementById("location2Preset");
  const location3Preset = document.getElementById("location3Preset");

  const location1 = document.getElementById("location1");
  const location2 = document.getElementById("location2");
  const location3 = document.getElementById("location3");

  const inpersonScheduleBox = document.getElementById("inpersonScheduleBox");
  const schedRow2 = document.getElementById("schedRow2");
  const schedRow3 = document.getElementById("schedRow3");
  const schedDay1 = document.getElementById("schedDay1");
  const schedTime1 = document.getElementById("schedTime1");
  const schedLoc1 = document.getElementById("schedLoc1");
  const schedDay2 = document.getElementById("schedDay2");
  const schedTime2 = document.getElementById("schedTime2");
  const schedLoc2 = document.getElementById("schedLoc2");
  const schedDay3 = document.getElementById("schedDay3");
  const schedTime3 = document.getElementById("schedTime3");
  const schedLoc3 = document.getElementById("schedLoc3");

  const tabBooked = document.getElementById("tabBooked");
  const tabRequest = document.getElementById("tabRequest");
  const panelBooked = document.getElementById("panelBooked");
  const panelRequest = document.getElementById("panelRequest");
  const paygListEl = document.getElementById("paygList");
  const inpersonSessionLogCard = document.getElementById("inpersonSessionLogCard");
  const inpersonSessionListEl = document.getElementById("inpersonSessionList");

  const inpersonCalendarBox = document.getElementById("inpersonCalendarBox");
  const inpersonCalendarFrame = document.getElementById("inpersonCalendarFrame");

  const onlineSection = document.getElementById("onlineSection");
  const onlineUnavailableBox = document.getElementById("onlineUnavailableBox");

  let onlineAddonPurchaseBox = document.getElementById("onlineAddonPurchaseBox");
  let onlineAddonActiveBox = document.getElementById("onlineAddonActiveBox");
  let onlineAddonPlanSelect = document.getElementById("onlineAddonPlanSelect");
  let onlineAddonBuyBtn = document.getElementById("onlineAddonBuyBtn");
  let onlineAddonStatus = document.getElementById("onlineAddonStatus");

  const weekWelcomeSection = document.getElementById("weekWelcomeSection");
  const weekWelcomeText = document.getElementById("weekWelcomeText");
  const weekWelcomeVideoWrap = document.getElementById("weekWelcomeVideoWrap");

  const nutritionGuideSection = document.getElementById("nutritionGuideSection");
  const weekBannerChip = document.getElementById("weekBannerChip");
  const weekBannerTitle = document.getElementById("weekBannerTitle");
  const weekBannerText = document.getElementById("weekBannerText");
  const nutritionGuideEmbedShell = document.getElementById("nutritionGuideEmbedShell");

  const weekLabel = document.getElementById("weekLabel");
  const calendarEl = document.getElementById("calendar");
  const detailsEl = document.getElementById("workoutDetails");
  const videoSectionEl = document.getElementById("videoSection");
  const videoListEl = document.getElementById("videoList");

  const selectedExerciseLabel = document.getElementById("selectedExerciseLabel");
  const actualWeightEl = document.getElementById("actualWeight");
  const actualSetsEl = document.getElementById("actualSets");
  const actualRepsEl = document.getElementById("actualReps");
  const notesEl = document.getElementById("setsReps");
  const completedEl = document.getElementById("completedCheck");
  const saveBtn = document.getElementById("markCompleteBtn");
  const saveMsg = document.getElementById("saveMsg");

  const formCheckSection = document.getElementById("formCheckSection");
  const clientVideoFile = document.getElementById("clientVideoFile");
  const clientVideoNotes = document.getElementById("clientVideoNotes");
  const clientUploadBtn = document.getElementById("clientUploadBtn");
  const clientUploadMsg = document.getElementById("clientUploadMsg");
  const clientSubmissionsList = document.getElementById("clientSubmissionsList");
  const clientFeedbackList = document.getElementById("clientFeedbackList");
  const coachReviewPanel = document.getElementById("coachReviewPanel");
  const coachQueueList = document.getElementById("coachQueueList");
  const coachSelectedMeta = document.getElementById("coachSelectedMeta");
  const coachVideoFile = document.getElementById("coachVideoFile");
  const coachNotes = document.getElementById("coachNotes");
  const coachSendBtn = document.getElementById("coachSendBtn");
  const coachSendMsg = document.getElementById("coachSendMsg");

  const genderEl = document.getElementById("gender");
  const ageEl = document.getElementById("age");
  const heightFeetEl = document.getElementById("heightFeet");
  const heightInchesEl = document.getElementById("heightInches");
  const weightEl = document.getElementById("weight");
  const activityEl = document.getElementById("activity");
  const calculateBtn = document.getElementById("calculateBtn");
  const dailyCaloriesEl = document.getElementById("dailyCalories");
  const foodNameEl = document.getElementById("foodName");
  const foodCaloriesEl = document.getElementById("foodCalories");
  const addFoodBtn = document.getElementById("addFoodBtn");
  const foodListEl = document.getElementById("foodList");
  const consumedEl = document.getElementById("consumed");
  const remainingEl = document.getElementById("remaining");

  const videoModal = document.getElementById("videoModal");
  const videoModalClose = document.getElementById("videoModalClose");
  const videoModalTitle = document.getElementById("videoModalTitle");
  const videoModalPlayer = document.getElementById("videoModalPlayer");
  const videoModalSource = document.getElementById("videoModalSource");

  if (!statusEl || !logoutBtn || !window.sb) {
    if (statusEl) statusEl.textContent = "Supabase connection not found. Refresh and try again.";
    return;
  }

  let currentUserId = null;
  let currentUserEmail = "";
  let currentUserFullName = "";
  let currentProfile = null;
  let currentDailyTarget = 0;
  let calorieEntries = [];
  let currentWeeklyCalorieSeries = [];
  let calorieSyncTimer = null;
  let calorieSyncInFlight = false;
  let currentInpersonTab = "booked";
  let currentMainPanel = "overview";
  // Set once, the first time we move someone to the Request / Change tab because
  // they owe a payment. Stops it fighting the client's own tab clicks after that.
  let sentToPaymentTab = false;

  // Deep link support, e.g. dashboard.html?panel=inperson&tab=request -- used
  // right after signup to drop in-person clients straight into the schedule
  // request form. `?inperson=1` is the older form of the same thing.
  const requestedView = (() => {
    let params;

    try {
      params = new URLSearchParams(window.location.search);
    } catch {
      return { panel: "", tab: "" };
    }

    const allowedPanels = ["overview", "inperson", "online", "nutrition", "calories", "messages"];

    let panel = String(params.get("panel") || "").trim().toLowerCase();
    if (!allowedPanels.includes(panel)) panel = "";

    if (!panel && params.get("inperson") === "1") panel = "inperson";

    let tab = String(params.get("tab") || "").trim().toLowerCase();
    if (tab !== "booked" && tab !== "request") tab = "";

    return { panel, tab };
  })();

  function applyRequestedView() {
    if (requestedView.tab) currentInpersonTab = requestedView.tab;
    if (requestedView.panel) setMainPanel(requestedView.panel);
    if (requestedView.tab || requestedView.panel) setActiveInpersonTab(currentInpersonTab);
  }
  let onlineWorkoutsLoadedWeekId = null;
  let currentOnlineWorkoutState = null;
  let overviewWorkoutPreviewVideos = [];
  let homeBaseCoordsPromise = null;
  const geocodeCache = new Map();
  let coachSelectedReviewId = null;
  let coachSelectedUserId = null;

  function getOnlineWorkoutCounts() {
    if (!currentOnlineWorkoutState || !Array.isArray(currentOnlineWorkoutState.scheduleItems)) {
      return {
        completedCount: 0,
        totalCount: 0,
        incompleteCount: 0,
      };
    }

    const { scheduleItems, logsByWeekItemId } = currentOnlineWorkoutState;
    const totalCount = scheduleItems.length;
    let completedCount = 0;

    scheduleItems.forEach((item) => {
      if (logsByWeekItemId[item.id]?.completed) completedCount++;
    });

    return {
      completedCount,
      totalCount,
      incompleteCount: Math.max(totalCount - completedCount, 0),
    };
  }

  function refreshOnlineWorkoutViews(options = {}) {
    if (!currentOnlineWorkoutState) return;

    const { reopenSelectedDay = false, clearLogForm = false } = options;

    if (typeof currentOnlineWorkoutState.renderCalendar === "function") {
      currentOnlineWorkoutState.renderCalendar();
    }

    if (reopenSelectedDay && currentOnlineWorkoutState.selectedDay && typeof currentOnlineWorkoutState.openDay === "function") {
      currentOnlineWorkoutState.openDay(currentOnlineWorkoutState.selectedDay);
    } else if (clearLogForm && typeof currentOnlineWorkoutState.resetLogForm === "function") {
      currentOnlineWorkoutState.resetLogForm();
      if (detailsEl) {
        detailsEl.textContent = "Click a day box to view exercises. Then click an exercise row to load it into Log an Exercise.";
      }
    }

    renderOverviewPanel();
  }

  function injectDashboardTweaksStyles() {
    if (document.getElementById("dashboardTweaksStyles")) return;

    const style = document.createElement("style");
    style.id = "dashboardTweaksStyles";
    style.textContent = `
      .dashboard-main-tabs-shell{
        overflow-x:auto !important;
        overflow-y:hidden !important;
        -webkit-overflow-scrolling:touch !important;
      }

      .dashboard-main-tabs,
      .dashboard-main-tabs-updated{
        display:flex !important;
        flex-wrap:nowrap !important;
        justify-content:flex-start !important;
        align-items:center !important;
        gap:10px !important;
        width:max-content !important;
        min-width:max-content !important;
      }

      .dashboard-main-tab{
        flex:0 0 auto !important;
        width:auto !important;
        min-width:170px !important;
        white-space:nowrap !important;
        text-align:center !important;
      }

      .main-dashboard-panel{
        width:100% !important;
      }

      .priority-points{
        display:none !important;
      }

      .priority-banner{
        grid-template-columns:260px minmax(0,1fr) !important;
      }

      .tabsRow{
        display:flex !important;
        gap:14px !important;
        justify-content:center !important;
        flex-wrap:nowrap !important;
        overflow-x:auto !important;
        overflow-y:hidden !important;
        -webkit-overflow-scrolling:touch !important;
      }

      .tabBtn{
        flex:0 0 auto !important;
        width:auto !important;
        white-space:nowrap !important;
      }

      @media (max-width:980px){
        .priority-banner{
          grid-template-columns:1fr !important;
          text-align:center !important;
        }

        .priority-date-pill{
          margin:0 auto !important;
        }
      }

      @media (max-width:760px){
        .dashboard-main-tabs,
        .dashboard-main-tabs-updated{
          gap:8px !important;
          width:max-content !important;
          min-width:max-content !important;
        }

        .dashboard-main-tab{
          min-width:150px !important;
          min-height:50px !important;
          font-size:14px !important;
          padding:11px 14px !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function setWelcome(fullName) {
    const first = String(fullName || "").trim().split(/\s+/)[0] || "Client";
    if (welcomeGreeting) welcomeGreeting.textContent = `${getGreetingByTime()}, ${first}`;
    if (welcomeSubtext) {
      welcomeSubtext.textContent = "Select a section below to view your training, nutrition, and calorie tools.";
    }
  }

  function injectMembershipSummaryBar(trainingLabel, expiryLabel) {
    const existing = document.getElementById("membershipSummaryBar");
    if (existing) existing.remove();

    const welcomeBanner = document.getElementById("welcomeBanner");
    if (!welcomeBanner || !welcomeBanner.parentNode) return;

    const bar = document.createElement("div");
    bar.id = "membershipSummaryBar";
    bar.className = "section-card";
    bar.style.marginBottom = "14px";
    bar.innerHTML = `
      <div style="display:flex; flex-wrap:wrap; gap:14px; align-items:center; justify-content:space-between;">
        <div style="font-weight:900; color:var(--earth-ink); font-size:18px;">
          Training Type: <span style="color:var(--earth-olive-dark);">${escapeHtml(trainingLabel)}</span>
        </div>
        <div style="font-weight:900; color:var(--earth-ink); font-size:18px;">
          Plan Expires: <span style="color:var(--earth-olive-dark);">${escapeHtml(expiryLabel)}</span>
        </div>
      </div>
    `;

    welcomeBanner.parentNode.insertBefore(bar, welcomeBanner);
  }

  function setMainPanel(panelKey) {
    currentMainPanel = panelKey;

    const map = {
      overview: { btn: mainTabOverview, panel: mainPanelOverview },
      inperson: { btn: mainTabInperson, panel: mainPanelInperson },
      online: { btn: mainTabOnline, panel: mainPanelOnline },
      nutrition: { btn: mainTabNutrition, panel: mainPanelNutrition },
      calories: { btn: mainTabCalories, panel: mainPanelCalories },
      messages: { btn: mainTabMessages, panel: mainPanelMessages },
    };

    Object.keys(map).forEach((key) => {
      const item = map[key];
      if (!item) return;

      if (item.btn) {
        item.btn.classList.toggle("active", key === panelKey);
        item.btn.setAttribute("aria-selected", key === panelKey ? "true" : "false");
      }

      if (item.panel) {
        item.panel.style.display = key === panelKey ? "block" : "none";
      }
    });
  }

  function getTextById(id, fallback = "") {
    const el = document.getElementById(id);
    const text = String(el?.textContent || "").trim();
    return text || fallback;
  }

  // -------------------------------------------------------------------------
  // Messaging (online training clients <-> coach)
  // -------------------------------------------------------------------------
  let messagingEnabled = false;
  let lastMessageCount = 0;

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

  function renderMessages(rows) {
    if (!msgThread) return;

    if (!rows.length) {
      msgThread.innerHTML =
        `<div class="msg-empty">No messages yet. Say hello to your coach 👋</div>`;
      return;
    }

    const wasNearBottom =
      msgThread.scrollHeight - msgThread.scrollTop - msgThread.clientHeight < 80;

    msgThread.innerHTML = rows
      .map((m) => {
        const mine = m.sender_role === "client";
        const who = mine ? "You" : "Coach";
        return `
          <div class="msg-bubble ${mine ? "msg-mine" : "msg-theirs"}">
            <div>${escapeHtml(m.body)}</div>
            <span class="msg-meta">${who} · ${escapeHtml(formatMessageTime(m.created_at))}</span>
          </div>
        `;
      })
      .join("");

    if (wasNearBottom || rows.length !== lastMessageCount) {
      msgThread.scrollTop = msgThread.scrollHeight;
    }
    lastMessageCount = rows.length;
  }

  function setMessagesBadge(count) {
    if (!mainTabMessagesBadge) return;
    if (count > 0) {
      mainTabMessagesBadge.textContent = count > 99 ? "99+" : String(count);
      mainTabMessagesBadge.style.display = "inline-flex";
    } else {
      mainTabMessagesBadge.style.display = "none";
    }
  }

  async function markCoachMessagesRead() {
    if (!currentUserId) return;
    await window.sb
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("client_id", currentUserId)
      .eq("sender_role", "coach")
      .is("read_at", null);
  }

  async function refreshMessages(markRead = false) {
    if (!messagingEnabled || !currentUserId || !msgThread) return;

    const { data, error } = await window.sb
      .from("messages")
      .select("id, sender_role, body, read_at, created_at")
      .eq("client_id", currentUserId)
      .order("created_at", { ascending: true })
      .limit(500);

    if (error) {
      msgThread.innerHTML =
        `<div class="msg-empty">Could not load messages: ${escapeHtml(error.message)}</div>`;
      return;
    }

    const rows = data || [];
    renderMessages(rows);

    const viewingMessages = currentMainPanel === "messages";
    if ((markRead || viewingMessages) && rows.some((m) => m.sender_role === "coach" && !m.read_at)) {
      await markCoachMessagesRead();
      setMessagesBadge(0);
    } else {
      const unread = rows.filter((m) => m.sender_role === "coach" && !m.read_at).length;
      setMessagesBadge(viewingMessages ? 0 : unread);
    }
  }

  async function sendClientMessage() {
    if (!currentUserId || !msgInput || !msgSendBtn) return;

    const body = msgInput.value.trim();
    if (!body) return;

    msgSendBtn.disabled = true;
    if (msgStatus) msgStatus.textContent = "Sending...";

    const { error } = await window.sb.from("messages").insert([{
      client_id: currentUserId,
      sender_id: currentUserId,
      sender_role: "client",
      body,
    }]);

    msgSendBtn.disabled = false;

    if (error) {
      if (msgStatus) msgStatus.textContent = "Could not send: " + error.message;
      return;
    }

    msgInput.value = "";
    if (msgStatus) msgStatus.textContent = "";
    await refreshMessages(true);
  }

  function enableMessaging() {
    if (messagingEnabled) return;
    messagingEnabled = true;

    if (mainTabMessages) mainTabMessages.style.display = "";

    if (msgSendBtn && !msgSendBtn.dataset.wired) {
      msgSendBtn.dataset.wired = "1";
      msgSendBtn.onclick = () => sendClientMessage();
    }

    if (msgInput && !msgInput.dataset.wired) {
      msgInput.dataset.wired = "1";
      msgInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          sendClientMessage();
        }
      });
    }

    refreshMessages(false);

    if (!window.__messagesPollingStarted) {
      window.__messagesPollingStarted = true;
      setInterval(() => {
        refreshMessages(false);
      }, 15000);
    }
  }

  function buildOverviewBox(html) {
    return `<div class="summary-pill-box">${html}</div>`;
  }

  function extractWeekRangeDays(text) {
    const raw = String(text || "");
    const matches = [...raw.matchAll(/(\d{1,2})(?:st|nd|rd|th)?/gi)].map((m) => Number(m[1]));
    if (matches.length >= 2) {
      return { start: matches[0], end: matches[1] };
    }
    return null;
  }

  function renderOverviewCalendar() {
    const calendarMount = document.getElementById("overviewMiniCalendar");
    const titleEl = document.getElementById("overviewCalendarTitle");
    if (!calendarMount || !titleEl) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    titleEl.textContent = `${monthNames[month]} ${year}`;

    const markersByDay = {};

    function addMarker(day, type) {
      if (day < 1 || day > daysInMonth) return;
      if (!markersByDay[day]) markersByDay[day] = [];
      if (!markersByDay[day].includes(type)) markersByDay[day].push(type);
    }

    const range = extractWeekRangeDays(getTextById("weekLabel", ""));
    if (range) {
      for (let d = range.start; d <= range.end; d++) {
        addMarker(d, "online");
      }
    }

    const weekdayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    [
      getTextById("schedDay1", ""),
      getTextById("schedDay2", ""),
      getTextById("schedDay3", "")
    ].forEach((label) => {
      const targetDay = weekdayMap[safeLower(label)];
      if (typeof targetDay !== "number") return;

      for (let d = 1; d <= daysInMonth; d++) {
        if (new Date(year, month, d).getDay() === targetDay) {
          addMarker(d, "inperson");
        }
      }
    });

    const pendingText = [
      getTextById("inpersonPlanStatus", ""),
      getTextById("inpersonRules", ""),
      getTextById("inpersonHint", "")
    ].join(" ");

    if (/pending|awaiting|approval/i.test(pendingText)) {
      addMarker(Math.min(today + 1, daysInMonth), "pending");
    }

    let html = `<div class="overview-calendar-grid">`;

    weekdayNames.forEach((name) => {
      html += `<div class="overview-calendar-weekday">${name}</div>`;
    });

    for (let i = 0; i < firstDay; i++) {
      html += `<div class="overview-calendar-cell empty"></div>`;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const markers = markersByDay[day] || [];
      const markerHtml = markers.length
        ? `<div class="marker-stack">${markers.map((type) => `<span class="overview-calendar-marker ${type}"></span>`).join("")}</div>`
        : "";

      html += `
        <div class="overview-calendar-cell ${day === today ? "today" : ""}">
          ${markerHtml}
          <span>${day}</span>
        </div>
      `;
    }

    html += `</div>`;
    calendarMount.innerHTML = html;
  }

  function renderOverviewCards() {
    const todayChip = document.getElementById("overviewTodayChip");
    const inpersonStatus = document.getElementById("overviewInpersonStatus");
    const onlineStatus = document.getElementById("overviewOnlineStatus");
    const caloriesLeft = document.getElementById("overviewCaloriesLeft");

    const inpersonCard = document.getElementById("overviewInpersonCard");
    const onlineCard = document.getElementById("overviewOnlineCard");
    const nutritionCard = document.getElementById("overviewNutritionCard");
    const caloriesCard = document.getElementById("overviewCaloriesCard");

    const inpersonCardArticle = inpersonCard ? inpersonCard.closest(".overview-card.summary-card") : null;
    const onlineVisible = onlineSection && onlineSection.style.display !== "none";

    const hasActualInpersonPlan =
      getTextById("schedDay1", "—") !== "—" ||
      getTextById("schedDay2", "—") !== "—" ||
      getTextById("schedDay3", "—") !== "—";

    const shouldHideInpersonOverviewCard =
      safeLower(currentProfile?.training_type) === "online" && !hasActualInpersonPlan;

    const { completedCount, incompleteCount } = getOnlineWorkoutCounts();

    if (todayChip) {
      todayChip.textContent = new Date().toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }

    if (inpersonStatus) inpersonStatus.textContent = hasActualInpersonPlan ? "Active" : "No Plan";
    if (onlineStatus) onlineStatus.textContent = onlineVisible ? "Active" : "Inactive";
    if (caloriesLeft) caloriesLeft.textContent = `${getTextById("remaining", "0")} kcal`;

    const snapshotCard = document.querySelector(".snapshot-card");
    const existingSnapshotExtras = snapshotCard?.querySelector(".snapshot-extra-grid");
    if (existingSnapshotExtras) existingSnapshotExtras.remove();

    if (snapshotCard) {
      const snapshotExtras = document.createElement("div");
      snapshotExtras.className = "snapshot-extra-grid";
      snapshotExtras.innerHTML = `
        <div class="snapshot-extra-card">
          ${buildOverviewCaloriesChartHtml()}
        </div>
        <div class="snapshot-extra-card">
          <img
            class="snapshot-extra-image"
            src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80"
            alt="Fitness studio interior"
            loading="lazy"
          />
        </div>
      `;
      snapshotCard.appendChild(snapshotExtras);
    }

    if (inpersonCardArticle) {
      inpersonCardArticle.style.display = shouldHideInpersonOverviewCard ? "none" : "";
    }

    if (inpersonCard && !shouldHideInpersonOverviewCard) {
      const parts = [];

      if (getTextById("schedDay1", "—") !== "—") {
        parts.push(buildOverviewBox(
          `Session 1: ${escapeHtml(getTextById("schedDay1"))} • ${escapeHtml(getTextById("schedTime1"))} • ${escapeHtml(getTextById("schedLoc1"))}`
        ));
      }

      if (getTextById("schedDay2", "—") !== "—") {
        parts.push(buildOverviewBox(
          `Session 2: ${escapeHtml(getTextById("schedDay2"))} • ${escapeHtml(getTextById("schedTime2"))} • ${escapeHtml(getTextById("schedLoc2"))}`
        ));
      }

      if (getTextById("schedDay3", "—") !== "—") {
        parts.push(buildOverviewBox(
          `Session 3: ${escapeHtml(getTextById("schedDay3"))} • ${escapeHtml(getTextById("schedTime3"))} • ${escapeHtml(getTextById("schedLoc3"))}`
        ));
      }

      inpersonCard.innerHTML = `
        ${parts.length ? parts.join("") : buildOverviewBox("No Plan")}
        <div class="overview-inline-image-grid">
          <div class="overview-inline-image-card">
            <img
              class="overview-inline-image"
              src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80"
              alt="Commercial gym interior"
              loading="lazy"
            />
          </div>

          <div class="overview-inline-image-card">
            <img
              class="overview-inline-image"
              src="https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=1200&q=80"
              alt="Strength gym interior"
              loading="lazy"
            />
          </div>
        </div>
      `;
    }

    if (onlineCard) {
      const onlineRenderKey = JSON.stringify({
        completedCount,
        incompleteCount,
        weekLabel: getTextById("weekLabel", "No week loaded yet."),
        previews: overviewWorkoutPreviewVideos.slice(0, 2).map((item) => ({
          url: String(item.url || "").trim(),
          title: String(item.title || "").trim(),
        })),
      });

      if (onlineCard.dataset.renderKey !== onlineRenderKey) {
        onlineCard.dataset.renderKey = onlineRenderKey;

        let previewHtml = "";

        if (overviewWorkoutPreviewVideos.length) {
          previewHtml = `
            <div class="overview-video-strip">
              ${overviewWorkoutPreviewVideos.slice(0, 2).map((item, index) => `
                <button
                  type="button"
                  class="overview-video-tile overview-video-open-btn"
                  data-url="${escapeHtml(item.url || "")}"
                  data-title="${escapeHtml(item.title || `Workout Video ${index + 1}`)}"
                >
                  <div class="overview-video-thumb-live">
                    <video
                      class="overview-video-thumb-player"
                      muted
                      playsinline
                      preload="metadata"
                      webkit-playsinline
                      tabindex="-1"
                    >
                      <source src="${item.url || ""}">
                    </video>
                    <div class="overview-video-overlay">
                      <div class="overview-video-play-icon">▶</div>
                    </div>
                  </div>
                  <div class="overview-video-tile-caption">${escapeHtml(item.title || `Workout Video ${index + 1}`)}</div>
                </button>
              `).join("")}
            </div>
          `;
        }

        onlineCard.innerHTML = `
          ${buildOverviewBox(`<strong>Workouts:</strong> ${completedCount} completed • ${incompleteCount} incomplete`)}
          ${buildOverviewBox(escapeHtml(getTextById("weekLabel", "No week loaded yet.")))}
          ${previewHtml || buildOverviewBox("Workout video previews will appear here.")}
        `;

        onlineCard.querySelectorAll(".overview-video-open-btn").forEach((btn) => {
          btn.onclick = () => {
            const title = btn.getAttribute("data-title") || "Workout Video";
            const url = btn.getAttribute("data-url");
            if (!url) return;
            openVideo(title, url);
          };
        });

        onlineCard.querySelectorAll(".overview-video-thumb-player").forEach((videoEl) => {
          const freezeFrame = () => {
            try {
              videoEl.pause();
              videoEl.currentTime = 0.1;
            } catch { }
          };

          videoEl.addEventListener("loadedmetadata", freezeFrame, { once: true });
          videoEl.addEventListener("canplay", freezeFrame, { once: true });
          videoEl.addEventListener("play", freezeFrame);
        });
      }
    }

    if (nutritionCard) {
      nutritionCard.innerHTML = `
        <img
          class="summary-image"
          src="https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1200&q=80"
          alt="Healthy nutrition overview"
          loading="lazy"
        />
        ${buildOverviewBox(`<strong>${escapeHtml(getTextById("weekBannerTitle", "Nutrition"))}</strong>`)}
        ${buildOverviewBox(escapeHtml(getTextById("weekBannerText", "Eat Well | Train Strong")))}
      `;
    }

    if (caloriesCard) {
      caloriesCard.innerHTML = `
        <img
          class="summary-image"
          src="https://images.unsplash.com/photo-1467453678174-768ec283a940?auto=format&fit=crop&w=1200&q=80"
          alt="Calorie tracking overview"
          loading="lazy"
        />
        ${buildOverviewBox(`<strong>Daily Target:</strong> ${escapeHtml(getTextById("dailyCalories", "—"))} kcal`)}
        ${buildOverviewBox(`<strong>Consumed:</strong> ${escapeHtml(getTextById("consumed", "0"))} kcal`)}
        ${buildOverviewBox(`<strong>Remaining:</strong> ${escapeHtml(getTextById("remaining", "0"))} kcal`)}
      `;
    }
  }

  function renderOverviewPanel() {
    renderOverviewCalendar();
    renderOverviewCards();
  }

  function wireOverviewButtons() {
    const openInpersonBtn = document.getElementById("overviewOpenInpersonBtn");
    const openOnlineBtn = document.getElementById("overviewOpenOnlineBtn");
    const openNutritionBtn = document.getElementById("overviewOpenNutritionBtn");
    const openCaloriesBtn = document.getElementById("overviewOpenCaloriesBtn");

    if (openInpersonBtn && openInpersonBtn.dataset.wired !== "1") {
      openInpersonBtn.dataset.wired = "1";
      openInpersonBtn.onclick = () => setMainPanel("inperson");
    }

    if (openOnlineBtn && openOnlineBtn.dataset.wired !== "1") {
      openOnlineBtn.dataset.wired = "1";
      openOnlineBtn.onclick = () => setMainPanel("online");
    }

    if (openNutritionBtn && openNutritionBtn.dataset.wired !== "1") {
      openNutritionBtn.dataset.wired = "1";
      openNutritionBtn.onclick = () => setMainPanel("nutrition");
    }

    if (openCaloriesBtn && openCaloriesBtn.dataset.wired !== "1") {
      openCaloriesBtn.dataset.wired = "1";
      openCaloriesBtn.onclick = () => setMainPanel("calories");
    }
  }

  function wireMainTabs() {
    if (mainTabOverview) mainTabOverview.onclick = () => setMainPanel("overview");
    if (mainTabInperson) mainTabInperson.onclick = () => setMainPanel("inperson");
    if (mainTabOnline) mainTabOnline.onclick = () => setMainPanel("online");
    if (mainTabNutrition) mainTabNutrition.onclick = () => setMainPanel("nutrition");
    if (mainTabCalories) mainTabCalories.onclick = () => setMainPanel("calories");
    if (mainTabMessages) {
      mainTabMessages.onclick = () => {
        setMainPanel("messages");
        refreshMessages(true);
      };
    }

    const overviewOpenInpersonBtn = document.getElementById("overviewOpenInpersonBtn");
    const overviewOpenOnlineBtn = document.getElementById("overviewOpenOnlineBtn");
    const overviewOpenNutritionBtn = document.getElementById("overviewOpenNutritionBtn");
    const overviewOpenCaloriesBtn = document.getElementById("overviewOpenCaloriesBtn");

    if (overviewOpenInpersonBtn) overviewOpenInpersonBtn.onclick = () => setMainPanel("inperson");
    if (overviewOpenOnlineBtn) overviewOpenOnlineBtn.onclick = () => setMainPanel("online");
    if (overviewOpenNutritionBtn) overviewOpenNutritionBtn.onclick = () => setMainPanel("nutrition");
    if (overviewOpenCaloriesBtn) overviewOpenCaloriesBtn.onclick = () => setMainPanel("calories");
  }
  function setActiveInpersonTab(which) {
  if (which !== "booked" && which !== "request") {
    which = currentInpersonTab || "booked";
  }

  currentInpersonTab = which;

  if (tabBooked) tabBooked.classList.toggle("active", which === "booked");
  if (tabRequest) tabRequest.classList.toggle("active", which === "request");

  if (panelBooked) panelBooked.style.display = which === "booked" ? "block" : "none";
  if (panelRequest) panelRequest.style.display = which === "request" ? "block" : "none";

  if (which === "booked") {
    setupCalendarFrame(inpersonCalendarFrame);
  }
}

 function wireInpersonTabs() {
  if (tabBooked) {
    tabBooked.onclick = () => {
      currentInpersonTab = "booked";
      setActiveInpersonTab("booked");
    };
  }

  if (tabRequest) {
    tabRequest.onclick = () => {
      currentInpersonTab = "request";
      setActiveInpersonTab("request");
    };
  }
}

  function ensureInpersonPaymentCardsContainer() {
    if (inpersonPaymentCards || !inpersonPaymentBanner) return;

    const wrap = document.createElement("div");
    wrap.id = "inpersonPaymentCards";
    wrap.style.display = "grid";
    wrap.style.gap = "12px";
    inpersonPaymentBanner.appendChild(wrap);
    inpersonPaymentCards = wrap;
  }





  function setupCalendarFrame(iframe) {
    if (!iframe) return;
    if (iframe.dataset.loaded === "1") return;

    iframe.dataset.loaded = "1";
    iframe.src = GCAL_IFRAME_URL;
    iframe.setAttribute("loading", "lazy");
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.borderRadius = "14px";
  }

  function openVideo(title, url) {
    if (!videoModal || !videoModalPlayer || !videoModalSource || !url) return;

    if (videoModalTitle) videoModalTitle.textContent = title || "Workout Video";

    videoModalSource.src = url;
    videoModalPlayer.load();
    videoModal.style.display = "flex";
    videoModalPlayer.play().catch(() => { });
  }

  function closeVideo() {
    if (!videoModal || !videoModalPlayer || !videoModalSource) return;
    videoModal.style.display = "none";
    videoModalPlayer.pause();
    try {
      videoModalPlayer.currentTime = 0;
    } catch { }
    videoModalSource.removeAttribute("src");
    videoModalPlayer.load();

    document.querySelectorAll("#videoList .workoutPreviewVideo").forEach((videoEl) => {
      try {
        videoEl.pause();
        videoEl.currentTime = 0.1;
      } catch { }
    });

    document.querySelectorAll("#overviewOnlineCard .summary-video-preview video").forEach((videoEl) => {
      try {
        videoEl.pause();
        videoEl.currentTime = 0.1;
      } catch { }
    });

    document.querySelectorAll("#inpersonSessionList .inpersonPreviewVideo").forEach((videoEl) => {
      try {
        videoEl.pause();
        videoEl.currentTime = 0.1;
      } catch { }
    });
  }

  if (videoModalClose) videoModalClose.onclick = closeVideo;
  if (videoModal) {
    videoModal.onclick = (e) => {
      if (e.target === videoModal) closeVideo();
    };
  }

  logoutBtn.onclick = async () => {
    statusEl.textContent = "Logging out...";
    await window.sb.auth.signOut();
    window.location.href = "login.html";
  };
  function isPreferredLocation(value) {
    const normalized = normalizeLocationCompare(value);
    return INPERSON_PREFERRED_LOCATIONS.some((loc) => normalizeLocationCompare(loc) === normalized);
  }

  function attachPresetSync(presetEl, inputEl) {
    if (!presetEl || !inputEl || presetEl.dataset.wired === "1") return;
    presetEl.dataset.wired = "1";

    presetEl.addEventListener("change", () => {
      const selected = normalizeLocationText(presetEl.value);
      if (selected) inputEl.value = selected;
    });
  }

  async function geocodeAddress(query) {
    const normalizedQuery = normalizeLocationText(query);
    if (!normalizedQuery) throw new Error("Missing location.");

    const cacheKey = normalizeLocationCompare(normalizedQuery);
    if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey);

    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(normalizedQuery)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });

    if (!res.ok) throw new Error("Could not verify location right now.");

    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) {
      throw new Error(`Could not find "${normalizedQuery}".`);
    }

    const coords = {
      lat: Number(rows[0].lat),
      lon: Number(rows[0].lon),
      display_name: rows[0].display_name || normalizedQuery,
    };

    geocodeCache.set(cacheKey, coords);
    return coords;
  }

  async function getHomeBaseCoords() {
    if (!homeBaseCoordsPromise) {
      homeBaseCoordsPromise = geocodeAddress(INPERSON_HOME_BASE_QUERY);
    }
    return homeBaseCoordsPromise;
  }

  async function validateSingleLocation(locationValue, label) {
    const locationText = normalizeLocationText(locationValue);

    if (!locationText) {
      return { ok: false, message: `${label}: enter a location.` };
    }

    if (isPreferredLocation(locationText)) {
      return { ok: true, normalizedLocation: locationText };
    }

    try {
      const [homeBase, clientLocation] = await Promise.all([
        getHomeBaseCoords(),
        geocodeAddress(locationText),
      ]);

      const miles = haversineMiles(
        Number(homeBase.lat),
        Number(homeBase.lon),
        Number(clientLocation.lat),
        Number(clientLocation.lon)
      );

      if (miles > INPERSON_MAX_DISTANCE_MILES) {
        return {
          ok: false,
          message: `${label}: location must be within the DMV range, or use one of the two preferred locations.`,
        };
      }

      return { ok: true, normalizedLocation: locationText };
    } catch (err) {
      return {
        ok: false,
        message: `${label}: ${err?.message || "could not verify this location."}`,
      };
    }
  }

  async function validateInpersonRequestForm(planCode) {
    const isPayg = safeLower(planCode).includes("inperson_payg");
    const weeklyLimit = getInPersonWeeklyLimit(planCode);

    const sessionDefs = [
      { label: isPayg ? "Session" : "Session 1", dayEl: day1, timeEl: time1, locationEl: location1 },
    ];

    if (weeklyLimit === 3) {
      sessionDefs.push(
        { label: "Session 2", dayEl: day2, timeEl: time2, locationEl: location2 },
        { label: "Session 3", dayEl: day3, timeEl: time3, locationEl: location3 }
      );
    }

    for (const session of sessionDefs) {
      const dayValue = String(session.dayEl?.value || "").trim();
      const timeValue = String(session.timeEl?.value || "").trim();
      const locationValue = String(session.locationEl?.value || "").trim();

      if (!dayValue) {
        return { ok: false, message: `${session.label}: choose a ${isPayg ? "date" : "day"}.` };
      }

      if (!timeValue) {
        return { ok: false, message: `${session.label}: choose a time.` };
      }

      const locationCheck = await validateSingleLocation(locationValue, session.label);
      if (!locationCheck.ok) return locationCheck;

      session.locationEl.value = locationCheck.normalizedLocation;
    }

    return { ok: true };
  }

  function syncPaygDateMode(planCode) {
    const isPayg = safeLower(planCode).includes("inperson_payg");
    const requestBox = document.getElementById("inpersonRequestBox");
    if (!requestBox) return;

    requestBox.querySelectorAll("label").forEach((label) => {
      if (String(label.textContent || "").trim() === "Day") {
        label.textContent = isPayg ? "Date" : "Day";
      }
    });

    function swapInput(currentEl) {
      if (!currentEl) return currentEl;

      const tag = currentEl.tagName.toLowerCase();

      if (isPayg && tag === "select") {
        const input = document.createElement("input");
        input.type = "date";
        input.id = currentEl.id;
        input.className = currentEl.className;
        input.min = todayKey();
        currentEl.parentNode.replaceChild(input, currentEl);
        return input;
      }

      if (!isPayg && tag === "input") {
        const select = document.createElement("select");
        select.id = currentEl.id;
        select.className = currentEl.className;
        select.innerHTML = `
          <option value="">Select day</option>
          <option>Monday</option>
          <option>Tuesday</option>
          <option>Wednesday</option>
          <option>Thursday</option>
          <option>Friday</option>
          <option>Saturday</option>
          <option>Sunday</option>
        `;
        currentEl.parentNode.replaceChild(select, currentEl);
        return select;
      }

      return currentEl;
    }

    day1 = swapInput(day1);
    day2 = swapInput(day2);
    day3 = swapInput(day3);
  }

  function applyPlanUI(planCode) {
    const lim = getInPersonWeeklyLimit(planCode);
    const isPayg = safeLower(planCode).includes("inperson_payg");

    if (slot2) slot2.style.display = lim === 3 ? "block" : "none";
    if (slot3) slot3.style.display = lim === 3 ? "block" : "none";

    if (day2) day2.disabled = lim !== 3;
    if (day3) day3.disabled = lim !== 3;
    if (location2) location2.disabled = lim !== 3;
    if (location3) location3.disabled = lim !== 3;
    if (location2Preset) location2Preset.disabled = lim !== 3;
    if (location3Preset) location3Preset.disabled = lim !== 3;

    const stepText = document.getElementById("inpersonStepText");
    if (stepText) {
      stepText.textContent = isPayg
        ? "Choose Pay-As-You-Go, request one specific session date/time/location, then wait for approval before payment."
        : "Choose plan + times + location, then send request.";
    }

    syncPaygDateMode(planCode);
  }
  async function fetchProfile(authUserId) {
    let { data, error } = await window.sb
      .from("profiles")
      .select("*")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (!error && data) return data;

    ({ data, error } = await window.sb
      .from("profiles")
      .select("*")
      .eq("id", authUserId)
      .maybeSingle());

    return data || null;
  }

  async function fetchAllInpersonRequests(authUserId, profileRow) {
    const candidateIds = [authUserId, profileRow?.id, profileRow?.user_id].filter(Boolean);
    const seen = new Set();

    for (const candidate of candidateIds) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);

      const { data, error } = await window.sb
        .from("inperson_requests")
        .select(`
          id,
          user_id,
          plan_code,
          day_1,
          time_1,
          day_2,
          time_2,
          day_3,
          time_3,
          location_1,
          location_2,
          location_3,
          status,
          created_at,
          approved_at,
          paid_at,
          stripe_session_id
        `)
        .eq("user_id", candidate)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data) && data.length) return data;
    }

    return [];
  }

  async function fetchAllPaygBookings(authUserId, profileRow) {
    const candidateIds = [authUserId, profileRow?.id, profileRow?.user_id].filter(Boolean);
    const seen = new Set();

    await sweepExpiredPaygBookings();

    // The expiry columns are a later addition to inperson_bookings. If a
    // database has not had them added yet, asking for them fails the whole
    // query -- so drop them and retry rather than showing an empty list.
    let includeExpiryColumns = true;

    const runQuery = (candidate) => window.sb
      .from("inperson_bookings")
      .select(`
          id,
          user_id,
          session_date,
          session_time,
          location,
          status,
          created_at,
          paid_at,
          stripe_session_id,
          plan_code${includeExpiryColumns ? ",\n          approved_at,\n          payment_due_at,\n          expired_at" : ""}
        `)
      .eq("user_id", candidate)
      .order("created_at", { ascending: false });

    for (const candidate of candidateIds) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);

      let { data, error } = await runQuery(candidate);

      if (error && includeExpiryColumns && isMissingExpiryColumnError(error)) {
        includeExpiryColumns = false;
        ({ data, error } = await runQuery(candidate));
      }

      if (!error && Array.isArray(data) && data.length) return data;
    }

    return [];
  }

  function isMissingExpiryColumnError(error) {
    if (!error) return false;
    if (String(error.code || "") === "42703") return true;
    return /payment_due_at|approved_at|expired_at/i.test(String(error.message || ""));
  }

  // Closes every overdue unpaid booking server-side so the change sticks for the
  // coach and for exports, not just in this browser. The function is added by
  // supabase/inperson-payg-expiry.sql; until that runs the call simply fails and
  // the UI falls back to working the deadline out from payment_due_at itself.
  async function sweepExpiredPaygBookings() {
    try {
      await window.sb.rpc("expire_stale_payg_bookings");
    } catch (_err) {
      // Non-fatal: expiry is still enforced in the UI and at checkout.
    }
  }

  async function fetchInpersonSessions(authUserId, profileRow) {
    const candidateIds = [authUserId, profileRow?.id, profileRow?.user_id].filter(Boolean);
    const seen = new Set();

    // video_url is a later addition to inperson_session_exercises. If a database
    // has not had that column added yet, asking for it fails the whole query --
    // so drop it and retry rather than showing an empty session list.
    let includeVideoUrl = true;

    const runQuery = (candidate) => window.sb
      .from("inperson_sessions")
      .select(`
          id,
          session_date,
          session_time,
          location,
          session_title,
          duration_min,
          rpe,
          coach_notes,
          status,
          inperson_session_exercises (
            exercise_order,
            exercise_name,
            equipment,
            sets,
            reps,
            weight,
            rest_seconds,
            notes${includeVideoUrl ? ",\n            video_url" : ""}
          )
        `)
      .eq("user_id", candidate)
      .eq("status", "published")
      .order("session_date", { ascending: false })
      .limit(100);

    for (const candidate of candidateIds) {
      if (seen.has(candidate)) continue;
      seen.add(candidate);

      let { data, error } = await runQuery(candidate);

      if (error && includeVideoUrl && isMissingVideoColumnError(error)) {
        includeVideoUrl = false;
        ({ data, error } = await runQuery(candidate));
      }

      if (!error && Array.isArray(data) && data.length) return data;
    }

    return [];
  }

  function isMissingVideoColumnError(error) {
    if (!error) return false;
    if (String(error.code || "") === "42703") return true;
    return /video_url/i.test(String(error.message || ""));
  }

  async function fetchLatestInpersonSubscription(authUserId, profileRow) {
    const candidateIds = [authUserId, profileRow?.id, profileRow?.user_id].filter(Boolean);

    for (const candidate of candidateIds) {
      const { data, error } = await window.sb
        .from("inperson_subscriptions")
        .select(`
          user_id,
          sessions_per_week,
          status,
          start_date,
          end_date,
          plan_code,
          request_id,
          day_1,
          time_1,
          day_2,
          time_2,
          day_3,
          time_3,
          location_1,
          location_2,
          location_3,
          stripe_price_id,
          stripe_session_id,
          paid_at
        `)
        .eq("user_id", candidate)
        .maybeSingle();

      if (!error && data) return data;
    }

    return null;
  }

  async function fetchOnlineSubscription(authUserId, profileRow) {
    const candidateIds = [authUserId, profileRow?.id, profileRow?.user_id].filter(Boolean);

    for (const candidate of candidateIds) {
      const { data, error } = await window.sb
        .from("subscriptions")
        .select(`
          id,
          user_id,
          plan,
          status,
          start_date,
          end_date,
          stripe_customer_id,
          stripe_subscription_id,
          stripe_session_id
        `)
        .eq("user_id", candidate)
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) return data;
    }

    return null;
  }

  async function fetchLatestWeek(profileRow, authUserId) {
    const candidateIds = [profileRow?.id, authUserId, profileRow?.user_id].filter(Boolean);

    for (const candidate of candidateIds) {
      const { data, error } = await window.sb
        .from("client_weeks")
        .select(`
          id,
          user_id,
          week_name,
          created_at,
          welcome_video_url,
          nutrition_guide_url,
          nutrition_guide_label,
          nutrition_video_url
        `)
        .eq("user_id", candidate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) return data;
    }

    return null;
  }

  async function readFunctionError(error) {
    if (!error) return "";

    try {
      const body = await error?.context?.json?.();
      if (body?.error) return String(body.error);
    } catch (_err) {
      // Fall through to the SDK message.
    }

    return String(error?.message || "");
  }

  async function createCheckout({ priceId, mode, planLabel, source, requestId = "", bookingId = "", months = "" }) {
    if (!currentUserId) throw new Error("Missing user.");
    if (!currentUserEmail) throw new Error("Missing user email.");
    if (!priceId || !mode) throw new Error("Missing checkout config.");

    const body = {
      user_id: currentUserId,
      email: currentUserEmail,
      price_id: priceId,
      mode,
      plan_label: planLabel || "",
      months: months ? String(months) : "",
      source: source || "",
      request_id: requestId || "",
      booking_id: bookingId || "",
      full_name: currentUserFullName || "",
    };

    const { data, error } = await window.sb.functions.invoke("create-checkout", { body });

    if (error || !data?.url) {
      // create-checkout refuses expired / already-paid bookings with a 409 and a
      // readable reason in the body. Prefer that over the generic SDK message.
      throw new Error((await readFunctionError(error)) || "Checkout failed.");
    }

    window.location.href = data.url;
  }

  async function startInpersonCheckoutFromRequest(requestRow) {
    const config = INPERSON_PRICE_MAP[requestRow?.plan_code || ""];
    if (!config) throw new Error("Missing in-person price setup.");

    await createCheckout({
      priceId: config.price_id,
      mode: config.mode,
      planLabel: requestRow?.plan_code || "",
      source: requestRow?.plan_code || "",
      requestId: requestRow?.id || "",
    });
  }

  async function startInpersonCheckoutFromBooking(bookingRow) {
    // Guard a stale tab: the window can close between render and click.
    if (isPaygExpired(bookingRow)) {
      throw new Error("This booking's payment window has closed. Please send a new pay-as-you-go request.");
    }

    const config = INPERSON_PRICE_MAP.inperson_payg;
    await createCheckout({
      priceId: config.price_id,
      mode: config.mode,
      planLabel: "inperson_payg",
      source: "inperson_payg",
      bookingId: bookingRow?.id || "",
    });
  }

  function addMonthsToDateString(startDateStr, monthsToAdd) {
    const base = new Date(startDateStr);
    if (Number.isNaN(base.getTime())) return startDateStr;

    const originalDay = base.getDate();
    base.setMonth(base.getMonth() + Number(monthsToAdd || 1));

    if (base.getDate() < originalDay) {
      base.setDate(0);
    }

    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, "0");
    const d = String(base.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function getInpersonPlanMonths(planCode) {
    const p = safeLower(planCode);

    if (p.includes("inperson_1x")) return 1;
    if (p.includes("inperson_3x")) return 1;

    return 1;
  }

  async function ensureInpersonSubscriptionFromPaidRequest(requestRows, authUserId) {
    const paidSubscriberRequest = (requestRows || []).find((row) => {
      if (!row) return false;
      if (safeLower(row.plan_code).includes("inperson_payg")) return false;

      return (
        isPaidLike(row.status) ||
        !!row.paid_at ||
        !!row.stripe_session_id
      );
    });

    if (!paidSubscriberRequest) return null;

    const existingByRequest = await window.sb
      .from("inperson_subscriptions")
      .select(`
      user_id,
      sessions_per_week,
      status,
      start_date,
      end_date,
      plan_code,
      request_id,
      day_1,
      time_1,
      day_2,
      time_2,
      day_3,
      time_3,
      location_1,
      location_2,
      location_3,
      stripe_price_id,
      stripe_session_id,
      paid_at
    `)
      .eq("request_id", paidSubscriberRequest.id)
      .maybeSingle();

    if (!existingByRequest.error && existingByRequest.data) {
      const existing = existingByRequest.data;

      const updatePayload = {
        status: "active",
        paid_at: paidSubscriberRequest.paid_at || existing.paid_at || new Date().toISOString(),
        stripe_session_id: paidSubscriberRequest.stripe_session_id || existing.stripe_session_id || null,
        day_1: paidSubscriberRequest.day_1 || existing.day_1 || null,
        time_1: paidSubscriberRequest.time_1 || existing.time_1 || null,
        day_2: paidSubscriberRequest.day_2 || existing.day_2 || null,
        time_2: paidSubscriberRequest.time_2 || existing.time_2 || null,
        day_3: paidSubscriberRequest.day_3 || existing.day_3 || null,
        time_3: paidSubscriberRequest.time_3 || existing.time_3 || null,
        location_1: paidSubscriberRequest.location_1 || existing.location_1 || null,
        location_2: paidSubscriberRequest.location_2 || existing.location_2 || null,
        location_3: paidSubscriberRequest.location_3 || existing.location_3 || null,
      };

      await window.sb
        .from("inperson_subscriptions")
        .update(updatePayload)
        .eq("request_id", paidSubscriberRequest.id);

      return {
        ...existing,
        ...updatePayload,
      };
    }

    const startDate = todayKey();
    const endDate = addMonthsToDateString(
      startDate,
      getInpersonPlanMonths(paidSubscriberRequest.plan_code)
    );

    const insertPayload = {
      user_id: authUserId,
      sessions_per_week: getInPersonWeeklyLimit(paidSubscriberRequest.plan_code),
      status: "active",
      start_date: startDate,
      end_date: endDate,
      plan_code: paidSubscriberRequest.plan_code,
      request_id: paidSubscriberRequest.id,
      day_1: paidSubscriberRequest.day_1 || null,
      time_1: paidSubscriberRequest.time_1 || null,
      day_2: paidSubscriberRequest.day_2 || null,
      time_2: paidSubscriberRequest.time_2 || null,
      day_3: paidSubscriberRequest.day_3 || null,
      time_3: paidSubscriberRequest.time_3 || null,
      location_1: paidSubscriberRequest.location_1 || null,
      location_2: paidSubscriberRequest.location_2 || null,
      location_3: paidSubscriberRequest.location_3 || null,
      stripe_session_id: paidSubscriberRequest.stripe_session_id || null,
      paid_at: paidSubscriberRequest.paid_at || new Date().toISOString(),
    };

    const { data, error } = await window.sb
      .from("inperson_subscriptions")
      .insert([insertPayload])
      .select(`
      user_id,
      sessions_per_week,
      status,
      start_date,
      end_date,
      plan_code,
      request_id,
      day_1,
      time_1,
      day_2,
      time_2,
      day_3,
      time_3,
      location_1,
      location_2,
      location_3,
      stripe_price_id,
      stripe_session_id,
      paid_at
    `)
      .maybeSingle();

    if (error) {
      console.error("Failed to create inperson_subscriptions row:", error.message);
      return null;
    }

    return data || insertPayload;
  }
  function setScheduleUI(reqOrSub) {
    if (!inpersonScheduleBox) return;

    if (schedDay1) schedDay1.textContent = "—";
    if (schedTime1) schedTime1.textContent = "—";
    if (schedLoc1) schedLoc1.textContent = "—";

    if (schedDay2) schedDay2.textContent = "—";
    if (schedTime2) schedTime2.textContent = "—";
    if (schedLoc2) schedLoc2.textContent = "—";

    if (schedDay3) schedDay3.textContent = "—";
    if (schedTime3) schedTime3.textContent = "—";
    if (schedLoc3) schedLoc3.textContent = "—";

    if (schedRow2) schedRow2.style.display = "none";
    if (schedRow3) schedRow3.style.display = "none";

    if (!reqOrSub) {
      inpersonScheduleBox.style.display = "none";
      return;
    }

    inpersonScheduleBox.style.display = "block";

    if (schedDay1) schedDay1.textContent = pickText(reqOrSub.day_1 || reqOrSub.session_date, "—");
    if (schedTime1) schedTime1.textContent = pickText(reqOrSub.time_1 || reqOrSub.session_time, "—");
    if (schedLoc1) schedLoc1.textContent = pickText(reqOrSub.location_1 || reqOrSub.location, "—");

    const lim = getInPersonWeeklyLimit(reqOrSub.plan_code);
    if (schedRow2) schedRow2.style.display = lim === 3 ? "table-row" : "none";
    if (schedRow3) schedRow3.style.display = lim === 3 ? "table-row" : "none";

    if (schedDay2) schedDay2.textContent = pickText(reqOrSub.day_2, "—");
    if (schedTime2) schedTime2.textContent = pickText(reqOrSub.time_2, "—");
    if (schedLoc2) schedLoc2.textContent = pickText(reqOrSub.location_2, "—");

    if (schedDay3) schedDay3.textContent = pickText(reqOrSub.day_3, "—");
    if (schedTime3) schedTime3.textContent = pickText(reqOrSub.time_3, "—");
    if (schedLoc3) schedLoc3.textContent = pickText(reqOrSub.location_3, "—");
  }

  function buildPaymentItems({ requests, bookings }) {
    const items = [];

    (requests || []).forEach((req) => {
      if (isDeniedLike(req.status)) return;

      const approved = !!req.approved_at || isApprovedLike(req.status);
      const paid = !!req.paid_at || !!req.stripe_session_id || isPaidLike(req.status);

      if (paid) return;

      if (approved && INPERSON_PRICE_MAP[req.plan_code]) {
        items.push({
          title: `${planCodeToLabel(req.plan_code)} Approved`,
          text: "Complete payment to activate this in-person plan.",
          details: formatTentativeSchedule(req),
          pill: "Awaiting Payment",
          showPayButton: true,
          onPay: () => startInpersonCheckoutFromRequest(req),
        });
        return;
      }

      items.push({
        title: `${planCodeToLabel(req.plan_code)} Submitted`,
        text: "Tentative schedule received. Waiting for coach approval.",
        details: formatTentativeSchedule(req),
        pill: "Pending Approval",
        showPayButton: false,
        onPay: null,
      });
    });

    const latestPayg = (bookings || [])
      .filter((booking) => !isDeniedLike(booking.status))
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];

    if (latestPayg) {
      const paid = isPaygPaid(latestPayg);
      const expired = isPaygExpired(latestPayg);
      const approved = isApprovedLike(latestPayg.status);
      const dueAt = getPaygPaymentDueAt(latestPayg);

      if (!paid && expired) {
        items.push({
          title: "Pay-As-You-Go Expired",
          text: "This session was approved but not paid in time, so the slot was released. Send a new request to book again.",
          details: formatTentativeSchedule(latestPayg),
          pill: "Expired",
          showPayButton: false,
          onPay: null,
        });
      } else if (!paid) {
        items.push({
          title: approved ? "Pay-As-You-Go Approved" : "Pay-As-You-Go Submitted",
          text: approved
            ? `Complete payment to confirm this session. ${describePaymentDeadline(dueAt)}`.trim()
            : "Tentative session received. Waiting for coach approval.",
          details: formatTentativeSchedule(latestPayg),
          pill: approved ? "Awaiting Payment" : "Pending Approval",
          showPayButton: approved,
          onPay: approved ? () => startInpersonCheckoutFromBooking(latestPayg) : null,
        });
      }
    }

    return items;
  }

  function showInpersonPaymentCards(items) {
    if (!inpersonPaymentCards) {
      ensureInpersonPaymentCardsContainer();
    }

    if (!inpersonPaymentBanner || !inpersonPaymentCards) return;

    if (!items.length) {
      inpersonPaymentBanner.style.display = "none";
      inpersonPaymentCards.innerHTML = "";
      return;
    }

    inpersonPaymentBanner.style.display = "block";
    inpersonPaymentCards.innerHTML = items.map((item, index) => `
      <div class="section-card" style="padding:14px; background:var(--earth-card-2); box-shadow:none;">
        <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">
          <div style="min-width:240px; flex:1 1 320px;">
            <div style="font-weight:900; font-size:18px; color:var(--earth-ink);">${escapeHtml(item.title)}</div>
            <div style="margin-top:4px; font-weight:700; color:var(--earth-muted);">${escapeHtml(item.text)}</div>
            <div style="margin-top:4px; font-size:14px; font-weight:700; color:var(--earth-muted);">${escapeHtml(item.details || "")}</div>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
            <div style="padding:10px 14px; border-radius:999px; border:1px solid var(--earth-line); background:#fff; font-weight:900;">
              ${escapeHtml(item.pill || "Pending")}
            </div>
            ${item.showPayButton ? `<button type="button" class="payNowDynamicBtn" data-index="${index}" style="padding:14px 18px; border-radius:14px; border:0; cursor:pointer; font-weight:900; background:var(--earth-olive); color:#fff;">Pay Now</button>` : ""}
          </div>
        </div>
      </div>
    `).join("");

    inpersonPaymentCards.querySelectorAll(".payNowDynamicBtn").forEach((btn) => {
      btn.onclick = async () => {
        const index = Number(btn.getAttribute("data-index"));
        const item = items[index];
        if (!item?.onPay) return;

        const original = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Redirecting...";

        try {
          await item.onPay();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = original;
          alert(err?.message || "Checkout failed.");
        }
      };
    });
  }

  function renderPaygList(bookings) {
    if (!paygListEl) return;

    const paidBookings = (bookings || []).filter((row) => {
      if (isDeniedLike(row.status)) return false;
      return isPaidLike(row.status) || !!row.paid_at || !!row.stripe_session_id;
    });

    if (!paidBookings.length) {
      paygListEl.innerHTML = `
      <div style="font-weight:700; color:var(--earth-muted);">
        No pay-as-you-go bookings yet.
      </div>
    `;
      return;
    }

    paygListEl.innerHTML = paidBookings.map((row) => {
      return `
      <div style="padding:12px 14px; border:1px solid var(--earth-line); border-radius:14px; background:var(--earth-card-2); margin-top:10px;">
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
          <div style="font-weight:900; color:var(--earth-ink);">
            ${escapeHtml(formatDisplayDate(pickText(row.session_date, "—")))} • ${escapeHtml(pickText(row.session_time, "—"))}
          </div>
          <div style="padding:6px 10px; border-radius:999px; border:1px solid var(--earth-line); background:#fff; font-weight:900; color:var(--earth-ink);">
            Paid
          </div>
        </div>

        <div style="margin-top:8px; font-weight:700; color:var(--earth-muted); word-break:break-word; overflow-wrap:anywhere;">
          ${escapeHtml(pickText(row.location, "—"))}
        </div>
      </div>
    `;
    }).join("");
  }

  function renderInpersonSessions(sessions) {
    if (!inpersonSessionListEl) return;

    const rows = (sessions || []).slice().sort((a, b) => {
      const dateDiff = new Date(b.session_date || 0) - new Date(a.session_date || 0);
      if (dateDiff !== 0) return dateDiff;
      return String(a.session_time || "").localeCompare(String(b.session_time || ""));
    });

    if (!rows.length) {
      inpersonSessionListEl.innerHTML = `
      <div style="font-weight:700; color:var(--earth-muted);">
        No sessions logged yet. Your coach adds these after each session.
      </div>
    `;
      return;
    }

    inpersonSessionListEl.innerHTML = rows.map((row) => {
      const exercises = (row.inperson_session_exercises || [])
        .slice()
        .sort((a, b) => (a.exercise_order || 0) - (b.exercise_order || 0));

      const chips = [];
      if (row.duration_min) chips.push(`${escapeHtml(String(row.duration_min))} min`);
      if (row.rpe) chips.push(`RPE ${escapeHtml(String(row.rpe))}`);
      if (exercises.length) chips.push(`${exercises.length} exercise${exercises.length === 1 ? "" : "s"}`);

      const chipsHtml = chips.map((chip) => `
        <span style="padding:6px 10px; border-radius:999px; border:1px solid var(--earth-line); background:#fff; font-weight:900; color:var(--earth-ink);">
          ${chip}
        </span>
      `).join("");

      const exerciseRowsHtml = exercises.map((ex) => `
        <tr>
          <td style="padding:10px; border-bottom:1px solid var(--earth-soft-line); font-weight:900;">${escapeHtml(String(ex.exercise_order ?? "—"))}</td>
          <td style="padding:10px; border-bottom:1px solid var(--earth-soft-line); font-weight:900;">${escapeHtml(pickText(ex.exercise_name, "—"))}</td>
          <td style="padding:10px; border-bottom:1px solid var(--earth-soft-line);">${escapeHtml(pickText(ex.equipment, "—"))}</td>
          <td style="padding:10px; border-bottom:1px solid var(--earth-soft-line);">${escapeHtml(ex.sets == null ? "—" : String(ex.sets))}</td>
          <td style="padding:10px; border-bottom:1px solid var(--earth-soft-line);">${escapeHtml(pickText(ex.reps, "—"))}</td>
          <td style="padding:10px; border-bottom:1px solid var(--earth-soft-line);">${escapeHtml(pickText(ex.weight, "—"))}</td>
          <td style="padding:10px; border-bottom:1px solid var(--earth-soft-line);">${escapeHtml(ex.rest_seconds == null ? "—" : `${ex.rest_seconds}s`)}</td>
          <td style="padding:10px; border-bottom:1px solid var(--earth-soft-line); word-break:break-word; overflow-wrap:anywhere;">${escapeHtml(pickText(ex.notes, "—"))}</td>
        </tr>
      `).join("");

      const exercisesHtml = exercises.length
        ? `
        <div class="schedule-table-wrap" style="margin-top:12px;">
          <table class="schedule-table" style="width:100%; border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left; padding:10px; border-bottom:1px solid var(--earth-line);">#</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid var(--earth-line);">Exercise</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid var(--earth-line);">Equipment</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid var(--earth-line);">Sets</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid var(--earth-line);">Reps</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid var(--earth-line);">Weight</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid var(--earth-line);">Rest</th>
                <th style="text-align:left; padding:10px; border-bottom:1px solid var(--earth-line);">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${exerciseRowsHtml}
            </tbody>
          </table>
        </div>
      `
        : `
        <div style="margin-top:10px; font-weight:700; color:var(--earth-muted);">
          No exercises recorded for this session.
        </div>
      `;

      const videosHtml = renderInpersonSessionVideos(exercises);

      const notesHtml = pickText(row.coach_notes, "")
        ? `
        <div style="margin-top:12px; padding:10px 12px; border-radius:12px; border:1px solid var(--earth-soft-line); background:#fff;">
          <div style="font-weight:900; color:var(--earth-ink); margin-bottom:4px;">Coach notes</div>
          <div style="font-weight:700; color:var(--earth-muted); word-break:break-word; overflow-wrap:anywhere;">
            ${escapeHtml(row.coach_notes)}
          </div>
        </div>
      `
        : "";

      return `
      <div style="padding:12px 14px; border:1px solid var(--earth-line); border-radius:14px; background:var(--earth-card-2); margin-top:10px;">
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between;">
          <div style="font-weight:900; color:var(--earth-ink);">
            ${escapeHtml(formatDisplayDate(pickText(row.session_date, "—")))} • ${escapeHtml(pickText(row.session_time, "—"))}
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            ${chipsHtml}
          </div>
        </div>

        <div style="margin-top:8px; font-weight:900; color:var(--earth-olive-dark);">
          ${escapeHtml(pickText(row.session_title, "Session"))}
        </div>

        <div style="margin-top:4px; font-weight:700; color:var(--earth-muted); word-break:break-word; overflow-wrap:anywhere;">
          ${escapeHtml(pickText(row.location, "—"))}
        </div>

        ${exercisesHtml}
        ${videosHtml}
        ${notesHtml}
      </div>
    `;
    }).join("");

    wireInpersonSessionVideos();
  }

  // Videos the coach attaches to each logged exercise (inperson_session_exercises.video_url).
  // Direct files get a clickable tile that opens the shared video modal; Vimeo links are
  // embedded inline because the modal player only handles direct sources.
  function renderInpersonSessionVideos(exercises) {
    const videos = (exercises || [])
      .map((ex, index) => ({
        url: String(ex.video_url || "").trim(),
        title: pickText(ex.exercise_name, `Exercise ${index + 1}`),
      }))
      .filter((item) => item.url !== "");

    if (!videos.length) return "";

    const tiles = videos.filter((item) => !isVimeoUrl(item.url));
    const embeds = videos.filter((item) => isVimeoUrl(item.url));

    const tilesHtml = tiles.length
      ? `
      <div class="workout-video-row">
        ${tiles.map((item) => `
          <button
            type="button"
            class="videoTile inpersonVideoTile"
            data-title="${escapeHtml(item.title)}"
            data-url="${escapeHtml(item.url)}">
            <div class="videoThumb">
              <video class="inpersonPreviewVideo" muted preload="metadata" playsinline>
                ${getVideoSourceMarkup(escapeHtml(item.url))}
              </video>

              <div style="position:absolute; inset:auto 10px 10px 10px; background:rgba(0,0,0,0.55); padding:6px 8px; border-radius:10px; font-weight:900; font-size:12px; color:#fff;">
                ▶ Play
              </div>
            </div>

            <div class="videoLabel">${escapeHtml(item.title)}</div>
          </button>
        `).join("")}
      </div>
    `
      : "";

    const embedsHtml = embeds.map((item) => renderVideoBlock(item.title, item.url)).join("");

    return `
      <div style="margin-top:12px;">
        <div style="font-weight:900; color:var(--earth-ink); margin-bottom:8px;">Session Videos</div>
        ${tilesHtml}
        ${embedsHtml}
      </div>
    `;
  }

  function wireInpersonSessionVideos() {
    if (!inpersonSessionListEl) return;

    inpersonSessionListEl.querySelectorAll(".inpersonVideoTile").forEach((btn) => {
      btn.onclick = () => {
        const title = btn.getAttribute("data-title") || "Workout Video";
        const url = btn.getAttribute("data-url") || "";
        openVideo(title, url);
      };
    });

    inpersonSessionListEl.querySelectorAll(".inpersonPreviewVideo").forEach((videoEl) => {
      const freezeFrame = () => {
        try {
          videoEl.pause();
          videoEl.currentTime = 0.1;
        } catch { }
      };

      videoEl.addEventListener("loadedmetadata", freezeFrame, { once: true });
    });
  }

// The payment card is rendered once, so a deadline that passes while the tab is
// open would otherwise keep showing a live "Pay Now" button. Re-run the state
// pass at the exact moment the soonest deadline lapses so the card flips itself
// to Expired without the client reloading.
let paygDeadlineTimer = null;

function scheduleNextPaygDeadlineRefresh(bookings, state) {
  if (paygDeadlineTimer) {
    clearTimeout(paygDeadlineTimer);
    paygDeadlineTimer = null;
  }

  const nextDeadline = (bookings || [])
    .filter((row) => !isPaygPaid(row) && !isPaygExpired(row))
    .map((row) => getPaygPaymentDueAt(row))
    .filter((due) => due && due.getTime() > Date.now())
    .sort((a, b) => a - b)[0];

  if (!nextDeadline) return;

  // setTimeout tops out around 24.8 days; anything further out can wait for the
  // next page load.
  const msUntil = nextDeadline.getTime() - Date.now() + 1000;
  if (msUntil > 2147483647) return;

  paygDeadlineTimer = setTimeout(() => applyInpersonState(state), msUntil);
}

function applyInpersonState(state) {
  const { inpersonReq, inpersonSub, requestRows, bookingRows, sessionRows, hasInPersonAccess } = state || {};

  if (!inpersonSection) return;

  const visibleRequests = (requestRows || []).filter((row) => !isDeniedLike(row.status));
  const visibleBookings = (bookingRows || []).filter((row) => !isDeniedLike(row.status));

  const latestPayg = visibleBookings
    .slice()
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0] || null;

  const latestPaygIsPaid = isPaygPaid(latestPayg);
  const latestPaygIsExpired = isPaygExpired(latestPayg);

  const latestPaygIsUnpaid = latestPayg
    ? (!latestPaygIsPaid &&
       !latestPaygIsExpired &&
       (isPendingLike(latestPayg.status) || isApprovedLike(latestPayg.status)))
    : false;

  const paymentItems = buildPaymentItems({ requests: visibleRequests, bookings: visibleBookings });

  showInpersonPaymentCards(paymentItems);

  // Only a client with something to pay for gets dropped on the Request / Change
  // tab, and only once per page load. Everyone else stays on the overview page.
  const owesPayment = paymentItems.some((item) => item.showPayButton);

  const inpersonTabHidden = mainTabInperson && mainTabInperson.style.display === "none";

  if (
    owesPayment &&
    !sentToPaymentTab &&
    !inpersonTabHidden &&
    !requestedView.panel &&
    !requestedView.tab
  ) {
    sentToPaymentTab = true;
    setMainPanel("inperson");
    setActiveInpersonTab("request");
  }

  scheduleNextPaygDeadlineRefresh(visibleBookings, state);
  renderPaygList(visibleBookings);
  renderInpersonSessions(sessionRows);

  inpersonSection.style.display = "block";
  if (inpersonUnavailableBox) inpersonUnavailableBox.style.display = "none";

  if (hasInPersonAccess && inpersonSub) {
    if (inpersonPlanStatus) inpersonPlanStatus.textContent = `Active plan: ${planCodeToLabel(inpersonSub.plan_code)}`;
    if (inpersonRules) inpersonRules.textContent = "You can book additional Pay-As-You-Go sessions anytime.";
    if (inpersonHint) inpersonHint.textContent = "Use the Request / Change tab to add extra sessions.";

    setScheduleUI(inpersonSub);
    setActiveInpersonTab(currentInpersonTab);
    return;
  }

  if (latestPaygIsPaid && latestPayg) {
    if (inpersonPlanStatus) inpersonPlanStatus.textContent = "Paid Pay-As-You-Go Session";
    if (inpersonRules) inpersonRules.textContent = "Your paid pay-as-you-go session is confirmed.";
    if (inpersonHint) inpersonHint.textContent = "Pay-as-you-go sessions stay in the Pay-As-You-Go Bookings box only.";

    setScheduleUI(null);
    setActiveInpersonTab(currentInpersonTab);
    return;
  }

  if (latestPaygIsUnpaid && latestPayg) {
    const approvedPayg = isApprovedLike(latestPayg.status);
    const dueAt = getPaygPaymentDueAt(latestPayg);

    if (inpersonPlanStatus) {
      inpersonPlanStatus.textContent = approvedPayg
        ? "Approved Pay-As-You-Go Session"
        : "Pending Pay-As-You-Go Request";
    }

    if (inpersonRules) {
      inpersonRules.textContent = approvedPayg && dueAt
        ? describePaymentDeadline(dueAt)
        : "Booked / Approved Schedule stays blank for pay-as-you-go clients.";
    }

    if (inpersonHint) {
      inpersonHint.textContent = "Only the tentative payment banner above should show until this session is paid.";
    }

    setScheduleUI(null);
    setActiveInpersonTab(currentInpersonTab);
    return;
  }

  if (latestPaygIsExpired && latestPayg) {
    if (inpersonPlanStatus) inpersonPlanStatus.textContent = "Pay-As-You-Go Request Expired";

    if (inpersonRules) {
      inpersonRules.textContent = "The payment window closed, so the slot was released. Send a new request to book another session.";
    }

    if (inpersonHint) {
      inpersonHint.textContent = "Approved pay-as-you-go sessions must be paid within the payment window shown on the approval.";
    }

    setScheduleUI(null);
    setActiveInpersonTab(currentInpersonTab);
    return;
  }

  if (inpersonReq && !isDeniedLike(inpersonReq.status)) {
    if (inpersonPlanStatus) inpersonPlanStatus.textContent = `Latest request: ${planCodeToLabel(inpersonReq.plan_code)}`;
    if (inpersonRules) inpersonRules.textContent = "Booked Schedule stays blank until a request is approved.";
    if (inpersonHint) inpersonHint.textContent = "Your tentative selections appear in the card above while pending or awaiting payment.";

    setScheduleUI(null);
    setActiveInpersonTab(currentInpersonTab);
    return;
  }

  if (inpersonPlanStatus) inpersonPlanStatus.textContent = "No active in-person plan";
  if (inpersonRules) inpersonRules.textContent = "Choose a plan, submit your request, then wait for approval before payment.";
  if (inpersonHint) inpersonHint.textContent = "Subscribers use inperson_requests. Pay-As-You-Go requests go to inperson_bookings.";

  setScheduleUI(null);
  setActiveInpersonTab(currentInpersonTab);
}
  function getVideoSourceMarkup(url) {
    return url ? `<source src="${url}">` : "";
  }

  function renderVideoBlock(title, rawUrl) {
    const url = String(rawUrl || "").trim();
    if (!url) return "";

    if (isVimeoUrl(url)) {
      const embedUrl = buildVimeoEmbed(url);
      if (!embedUrl) return "";

      return `
      <div class="dashboard-video-block">
        <div class="dashboard-video-block-title">${escapeHtml(title)}</div>
        <div class="dashboard-responsive-video-frame">
          <iframe
            src="${embedUrl}?autoplay=0&muted=1&background=0&controls=1"
            title="${escapeHtml(title)}"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
      </div>
    `;
    }

    return `
    <div class="dashboard-video-block">
      <div class="dashboard-video-block-title">${escapeHtml(title)}</div>
      <video
        class="dashboard-responsive-video-player"
        controls
        playsinline
        preload="metadata"
        disablePictureInPicture
        controlsList="nodownload noplaybackrate">
        <source src="${url}">
      </video>
    </div>
  `;
  }

  function renderWeekWelcome(weekRow) {
    if (!weekWelcomeSection || !weekWelcomeText || !weekWelcomeVideoWrap) return;

    const url = String(weekRow?.welcome_video_url || "").trim();
    const renderKey = url || "__empty__";

    if (weekWelcomeSection.dataset.renderKey === renderKey) {
      return;
    }

    weekWelcomeSection.dataset.renderKey = renderKey;

    if (!url) {
      weekWelcomeSection.style.display = "none";
      weekWelcomeVideoWrap.innerHTML = "";
      return;
    }

    weekWelcomeSection.style.display = "block";
    weekWelcomeText.textContent = "Watch this week’s welcome video before starting your training.";
    weekWelcomeVideoWrap.innerHTML = renderVideoBlock("Welcome to the Week", url);
  }

  function renderNutritionTabFromGuideLink(weekRow) {
    if (!nutritionGuideEmbedShell) return;

    const weekLabelText = formatWeekLabel(weekRow?.week_name, weekRow?.created_at);
    const guideUrl = String(weekRow?.nutrition_guide_url || "").trim() || "nutrition.html";
    const guideLabel = pickText(weekRow?.nutrition_guide_label, "Open Nutrition Page");
    const nutritionVideoUrl = String(weekRow?.nutrition_video_url || "").trim();

    if (weekBannerChip) weekBannerChip.textContent = weekLabelText;
    if (weekBannerTitle) weekBannerTitle.textContent = "Nutrition";
    if (weekBannerText) weekBannerText.textContent = "Eat Well | Train Strong";

    const nutritionRenderKey = JSON.stringify({
      week: weekLabelText,
      guideUrl,
      guideLabel,
      nutritionVideoUrl,
    });

    if (nutritionGuideEmbedShell.dataset.renderKey === nutritionRenderKey) {
      return;
    }
    nutritionGuideEmbedShell.dataset.renderKey = nutritionRenderKey;

    let videoHTML = "";

    if (nutritionVideoUrl) {
      if (isVimeoUrl(nutritionVideoUrl)) {
        const embedUrl = buildVimeoEmbed(nutritionVideoUrl);

        videoHTML = `
        <div style="position:relative; width:100%; padding-top:56.25%; border-radius:16px; overflow:hidden; background:#000;">
          <iframe
            src="${embedUrl}"
            style="position:absolute; inset:0; width:100%; height:100%; border:0;"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen>
          </iframe>
        </div>
      `;
      } else {
        videoHTML = `
        <video
          controls
          playsinline
          preload="metadata"
          style="width:100%; max-height:620px; border-radius:16px; background:#000; display:block;">
          <source src="${nutritionVideoUrl}">
        </video>
      `;
      }
    } else {
      videoHTML = `
      <div style="font-weight:700; color:var(--earth-muted);">
        No Nutrition Video for This Week. Eat Well | Train Strong
      </div>
    `;
    }

    nutritionGuideEmbedShell.innerHTML = `
    <div style="display:grid; gap:18px;">

      <div class="section-card" style="display:grid; gap:14px;">
        <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between;">

          <div>
            <div style="font-weight:900; font-size:24px; color:var(--earth-ink);">
              Nutrition Page
            </div>
            <div style="margin-top:4px; color:var(--earth-muted); font-weight:700;">
              ${escapeHtml(weekLabelText)}
            </div>
          </div>

          <div style="display:grid; gap:8px; justify-items:end;">
            <a
              href="${guideUrl}"
              target="_blank"
              rel="noopener noreferrer"
              style="
                display:inline-flex;
                align-items:center;
                justify-content:center;
                padding:14px 18px;
                border-radius:14px;
                text-decoration:none;
                font-weight:900;
                background:var(--earth-olive);
                color:#fff;
              ">
              ${escapeHtml(guideLabel)}
            </a>

            <div style="font-size:14px; font-weight:800; color:var(--earth-muted); text-align:right;">
              Click this button to open your nutrition page
            </div>
          </div>

        </div>
      </div>

      <div class="section-card" style="display:grid; gap:14px;">
        <div style="font-weight:900; font-size:22px; color:var(--earth-ink);">
          Weekly Nutrition Video
        </div>
        ${videoHTML}
      </div>

    </div>
  `;
  }

  async function loadOnlineWorkouts(authUserId, profileRow) {
    if (!weekLabel || !calendarEl || !detailsEl) return;
    if (!selectedExerciseLabel || !actualWeightEl || !actualSetsEl || !actualRepsEl || !notesEl || !completedEl || !saveBtn || !saveMsg) return;

    const latestWeek = await fetchLatestWeek(profileRow, authUserId);

    renderNutritionTabFromGuideLink(latestWeek);
    renderWeekWelcome(latestWeek);

    if (nutritionGuideSection) {
      nutritionGuideSection.style.display = "none";
      nutritionGuideSection.innerHTML = "";
    }

    if (!latestWeek) {
      weekLabel.textContent = "No weekly plan uploaded yet.";
      detailsEl.textContent = "No weekly training plan found yet.";
      if (videoSectionEl) videoSectionEl.style.display = "none";
      return;
    }

    if (onlineWorkoutsLoadedWeekId === latestWeek.id) return;
    onlineWorkoutsLoadedWeekId = latestWeek.id;

    weekLabel.textContent = "Latest Plan: " + (latestWeek.week_name || "Week");

    const { data: items, error: itemsError } = await window.sb
      .from("week_items")
      .select(`
        id,
        week_id,
        day,
        workout_title,
        exercise_order,
        exercise_name,
        equipment,
        prescribed_weight,
        sets,
        reps,
        video_url
      `)
      .eq("week_id", latestWeek.id)
      .order("day", { ascending: true })
      .order("exercise_order", { ascending: true });

    if (itemsError) {
      detailsEl.textContent = "Could not load week items: " + itemsError.message;
      return;
    }

    const scheduleItems = (items || [])
      .filter((r) => String(r.exercise_name || "").trim() !== "")
      .map((r) => ({ ...r, normalized_day: normalizeWorkoutDay(r.day) }));

    overviewWorkoutPreviewVideos = scheduleItems
      .filter((r) => r.video_url && String(r.video_url).trim() !== "")
      .slice(0, 2)
      .map((r, index) => ({
        url: String(r.video_url || "").trim(),
        title: String(r.exercise_name || r.workout_title || `Workout Video ${index + 1}`).trim(),
      }));

    if (!scheduleItems.length) {
      overviewWorkoutPreviewVideos = [];
      calendarEl.innerHTML = "";
      detailsEl.textContent = "No exercises found for this week yet.";
      if (videoSectionEl) videoSectionEl.style.display = "none";
      renderOverviewPanel();
      return;
    }

    const ids = scheduleItems.map((r) => r.id);
    const logsByWeekItemId = {};

    if (ids.length) {
      const { data: logs } = await window.sb
        .from("week_item_logs")
        .select("id, user_id, week_item_id, completed, actual_weight, actual_sets, actual_reps, notes")
        .eq("user_id", authUserId)
        .in("week_item_id", ids);

      (logs || []).forEach((log) => {
        logsByWeekItemId[log.week_item_id] = log;
      });
    }

    let selectedWeekItemId = null;
    let selectedDayName = null;

    function resetLogForm() {
      selectedWeekItemId = null;
      selectedDayName = null;
      selectedExerciseLabel.textContent = "(none)";
      actualWeightEl.value = "";
      actualSetsEl.value = "";
      actualRepsEl.value = "";
      notesEl.value = "";
      completedEl.checked = false;
      saveMsg.textContent = "";
    }

    function showLogForItem(item) {
      selectedWeekItemId = item.id;
      selectedDayName = normalizeWorkoutDay(item.day);
      selectedExerciseLabel.textContent = `${item.day} — ${item.workout_title} — ${item.exercise_order}. ${item.exercise_name}`;

      const existing = logsByWeekItemId[selectedWeekItemId];
      actualWeightEl.value = existing?.actual_weight || "";
      actualSetsEl.value = existing?.actual_sets ?? "";
      actualRepsEl.value = existing?.actual_reps || "";
      notesEl.value = existing?.notes || "";
      completedEl.checked = !!existing?.completed;
      saveMsg.textContent = "";
    }

    if (videoSectionEl && videoListEl) {
      const videos = scheduleItems.filter((r) => r.video_url && r.video_url.trim() !== "");

      if (!videos.length) {
        videoSectionEl.style.display = "none";
      } else {
        videoSectionEl.style.display = "block";

        const grouped = {};
        videos.forEach((row) => {
          const title = row.workout_title || "Workout";
          if (!grouped[title]) grouped[title] = [];
          grouped[title].push(row);
        });

        videoListEl.innerHTML = Object.keys(grouped)
          .map((groupName) => {
            const groupItems = grouped[groupName];

            return `
              <div class="workout-video-group">
                <div class="workout-video-group-title">${escapeHtml(groupName)}</div>

                <div class="workout-video-row">
                  ${groupItems.map((item) => `
                    <button
                      type="button"
                      class="videoTile"
                      data-title="${escapeHtml(item.exercise_name || "Exercise")}"
                      data-url="${item.video_url}">
                      <div class="videoThumb">
                        <video class="workoutPreviewVideo" muted preload="metadata" playsinline>
                          ${getVideoSourceMarkup(item.video_url)}
                        </video>

                        <div style="position:absolute; inset:auto 10px 10px 10px; background:rgba(0,0,0,0.55); padding:6px 8px; border-radius:10px; font-weight:900; font-size:12px; color:#fff;">
                          ▶ Play
                        </div>
                      </div>

                      <div class="videoLabel">${escapeHtml(item.exercise_name || "Exercise")}</div>
                    </button>
                  `).join("")}
                </div>
              </div>
            `;
          })
          .join("");

        videoListEl.querySelectorAll(".videoTile").forEach((btn) => {
          btn.onclick = () => {
            const title = btn.getAttribute("data-title") || "Workout Video";
            const url = btn.getAttribute("data-url");
            if (!url) return;
            openVideo(title, url);
          };
        });

        videoListEl.querySelectorAll(".workoutPreviewVideo").forEach((videoEl) => {
          const freezeFrame = () => {
            try {
              videoEl.pause();
              videoEl.currentTime = 0.1;
            } catch { }
          };

          videoEl.addEventListener("loadedmetadata", freezeFrame, { once: true });
          videoEl.addEventListener("canplay", freezeFrame, { once: true });
          videoEl.addEventListener("play", freezeFrame);
        });
      }
    }

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const byDay = {};
    days.forEach((d) => { byDay[d] = []; });
    scheduleItems.forEach((row) => {
      if (byDay[row.normalized_day]) byDay[row.normalized_day].push(row);
    });

    calendarEl.innerHTML = "";
    calendarEl.style.display = "grid";
    calendarEl.style.gridTemplateColumns = "repeat(7, 1fr)";
    calendarEl.style.gap = "10px";

    function openDay(dayName, options = {}) {
      const { preserveSelection = false } = options;
      selectedDayName = dayName;

      if (!preserveSelection) {
        selectedWeekItemId = null;
        selectedExerciseLabel.textContent = "(none)";
        actualWeightEl.value = "";
        actualSetsEl.value = "";
        actualRepsEl.value = "";
        notesEl.value = "";
        completedEl.checked = false;
        saveMsg.textContent = "";
      }

      const dayRows = byDay[dayName] || [];

      if (!dayRows.length) {
        detailsEl.textContent = "Rest / No workout for " + dayName;
        return;
      }

      const groups = {};
      dayRows.forEach((row) => {
        const title = row.workout_title || "Workout";
        if (!groups[title]) groups[title] = [];
        groups[title].push(row);
      });

      let html = `<div style="font-weight:900; font-size:18px; margin-bottom:10px;">${dayName}</div>`;
      html += `<div style="opacity:0.9; margin-bottom:12px;">Click an exercise row to load it into Log an Exercise. Tap the video text only to open the workout video.</div>`;

      Object.keys(groups).forEach((title) => {
        html += `<div style="font-weight:900; margin:12px 0 6px;">${escapeHtml(title)}</div>`;

        groups[title].forEach((row) => {
          const log = logsByWeekItemId[row.id];
          const done = log?.completed ? "✅" : "";
          const hasVideo = !!(row.video_url && row.video_url.trim() !== "");

          html += `
            <div class="exerciseRow" data-id="${row.id}" style="margin:8px 0;">
              <div style="font-weight:900;">${done} ${row.exercise_order}. ${escapeHtml(row.exercise_name)}</div>
              <div style="opacity:0.95; margin-top:6px;">
                ${escapeHtml(row.equipment || "")} | ${escapeHtml(row.prescribed_weight || "")} | ${escapeHtml(row.sets || "")} sets x ${escapeHtml(row.reps || "")} reps
              </div>
              ${hasVideo ? `<div class="exerciseVideoHint" data-video-url="${row.video_url}" data-video-title="${escapeHtml(row.exercise_name || "Workout Video")}" style="cursor:pointer;">Tap to open workout video</div>` : ""}
            </div>
          `;
        });
      });

      detailsEl.innerHTML = html;

      detailsEl.querySelectorAll(".exerciseRow").forEach((rowEl) => {
        rowEl.onclick = () => {
          const id = rowEl.getAttribute("data-id");
          const item = scheduleItems.find((x) => String(x.id) === String(id));
          if (!item) return;
          showLogForItem(item);
        };

        const hint = rowEl.querySelector(".exerciseVideoHint");
        if (hint) {
          hint.onclick = (e) => {
            e.stopPropagation();
            const url = hint.getAttribute("data-video-url");
            const title = hint.getAttribute("data-video-title") || "Workout Video";
            if (!url) return;
            openVideo(title, url);
          };
        }
      });
    }

    function renderCalendarGrid() {
      calendarEl.innerHTML = "";

      days.forEach((dayName) => {
        const box = document.createElement("div");
        box.className = "online-daybox";
        box.style.minHeight = "140px";

        const header = document.createElement("div");
        header.style.fontWeight = "900";
        header.style.marginBottom = "8px";
        header.textContent = dayName;
        box.appendChild(header);

        const dayRows = byDay[dayName] || [];
        if (!dayRows.length) {
          const rest = document.createElement("div");
          rest.textContent = "Rest / No workout";
          box.appendChild(rest);
        } else {
          const titles = [];
          dayRows.forEach((row) => {
            if (row.workout_title && !titles.includes(row.workout_title)) titles.push(row.workout_title);
          });

          titles.forEach((title) => {
            const tDiv = document.createElement("div");
            tDiv.style.fontWeight = "800";
            tDiv.style.marginBottom = "6px";
            tDiv.textContent = title;
            box.appendChild(tDiv);
          });

          const countDiv = document.createElement("div");
          countDiv.style.opacity = "0.9";
          countDiv.textContent = `${dayRows.length} exercises`;
          box.appendChild(countDiv);

          let completedCountForDay = 0;
          dayRows.forEach((row) => {
            if (logsByWeekItemId[row.id]?.completed) completedCountForDay++;
          });

          const doneDiv = document.createElement("div");
          doneDiv.style.opacity = "0.9";
          doneDiv.textContent = `${completedCountForDay} completed`;
          box.appendChild(doneDiv);
        }

        box.onclick = () => openDay(dayName);
        calendarEl.appendChild(box);
      });
    }

    currentOnlineWorkoutState = {
      scheduleItems,
      logsByWeekItemId,
      byDay,
      days,
      selectedDay: null,
      resetLogForm,
      openDay: (dayName) => {
        currentOnlineWorkoutState.selectedDay = dayName;
        openDay(dayName, { preserveSelection: false });
      },
      renderCalendar: renderCalendarGrid,
    };

    renderCalendarGrid();
    resetLogForm();
    detailsEl.textContent = "Click a day box to view exercises. Then click an exercise row to load it into Log an Exercise.";

    if (saveBtn.dataset.wired !== "1") {
      saveBtn.dataset.wired = "1";
      saveBtn.onclick = async () => {
        saveMsg.textContent = "";
        if (!selectedWeekItemId) {
          saveMsg.textContent = "Click an exercise first.";
          return;
        }

        saveMsg.textContent = "Saving...";

        const payload = {
          user_id: authUserId,
          week_item_id: selectedWeekItemId,
          completed: completedEl.checked,
          actual_weight: actualWeightEl.value.trim() || null,
          actual_sets: actualSetsEl.value === "" ? null : Number(actualSetsEl.value),
          actual_reps: actualRepsEl.value.trim() || null,
          notes: notesEl.value.trim() || null,
          updated_at: new Date().toISOString(),
        };

        const { data: savedRow, error: saveError } = await window.sb
          .from("week_item_logs")
          .upsert(payload, { onConflict: "user_id,week_item_id" })
          .select("id, user_id, week_item_id, completed, actual_weight, actual_sets, actual_reps, notes")
          .maybeSingle();

        if (saveError) {
          saveMsg.textContent = "Save failed: " + saveError.message;
          return;
        }

        logsByWeekItemId[selectedWeekItemId] = savedRow || payload;

        saveMsg.textContent = "Saved ✅";

        refreshOnlineWorkoutViews({ clearLogForm: true });
      };
    }

    renderOverviewPanel();
  }
  function hashReviews(rows) {
    return JSON.stringify(
      (rows || []).map((r) => [
        r.id,
        r.user_id,
        r.client_video_path,
        r.client_notes,
        r.status,
        r.coach_video_path,
        r.coach_notes,
        r.updated_at,
      ])
    );
  }

  async function getPublicUrl(path) {
    if (!path) return "";
    const { data } = window.sb.storage.from(FORM_BUCKET).getPublicUrl(path);
    return data?.publicUrl || "";
  }

  async function loadClientFormReviews(authUserId) {
    if (!clientSubmissionsList) return;

    const { data, error } = await window.sb
      .from("form_video_reviews")
      .select("id, user_id, client_video_path, client_notes, status, coach_video_path, coach_notes, created_at, updated_at")
      .eq("user_id", authUserId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      clientSubmissionsList.textContent = "Could not load submissions.";
      if (clientFeedbackList) clientFeedbackList.textContent = "Could not load coach feedback.";
      return;
    }

    const rows = data || [];
    const hash = hashReviews(rows);

    if (clientSubmissionsList.dataset.lastHash === hash) return;
    clientSubmissionsList.dataset.lastHash = hash;

    if (!rows.length) {
      clientSubmissionsList.innerHTML = `<div style="opacity:0.9;">No uploads yet.</div>`;
      if (clientFeedbackList) clientFeedbackList.innerHTML = `<div style="opacity:0.9;">No coach feedback yet.</div>`;
      return;
    }

    const submissionHtml = await Promise.all(
      rows.map(async (r) => {
        const clientUrl = await getPublicUrl(r.client_video_path);
        const badge = safeLower(r.status) === "reviewed"
          ? `<span class="pill pill-green">Reviewed</span>`
          : `<span class="pill pill-yellow">Submitted</span>`;

        return `
          <div class="reviewCard">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
              <div style="font-weight:900;">Submission</div>
              ${badge}
            </div>
            <div style="margin-top:10px;" class="noteBox">
              <div><strong>Submitted:</strong> ${formatDisplayDate(r.created_at)}</div>
              <div><strong>File:</strong> ${pickText(extractFileNameFromPath(r.client_video_path), "—")}</div>
              <div><strong>Your note:</strong> ${pickText(r.client_notes, "—")}</div>
            </div>
            <div style="margin-top:10px;">
              ${clientUrl
            ? `
                    <video controls playsinline class="miniVideo">
                      <source src="${clientUrl}">
                    </video>
                  `
            : `<div style="opacity:0.85;">(missing video)</div>`
          }
            </div>
          </div>
        `;
      })
    );

    clientSubmissionsList.innerHTML = submissionHtml.join("");

    if (clientFeedbackList) {
      const feedbackHtml = await Promise.all(
        rows.map(async (r) => {
          const coachUrl = r.coach_video_path ? await getPublicUrl(r.coach_video_path) : "";
          const reviewed = safeLower(r.status) === "reviewed" || coachUrl || String(r.coach_notes || "").trim();

          return `
            <div class="reviewCard">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
                <div style="font-weight:900;">Feedback for ${formatDisplayDate(r.created_at)}</div>
                ${reviewed ? `<span class="pill pill-green">Reviewed</span>` : `<span class="pill pill-yellow">Pending</span>`}
              </div>
              <div style="margin-top:10px;" class="noteBox">
                <div><strong>Coach note:</strong> ${pickText(r.coach_notes, "No written feedback yet.")}</div>
                <div><strong>Coach file:</strong> ${pickText(extractFileNameFromPath(r.coach_video_path), "—")}</div>
              </div>
              <div style="margin-top:10px;">
                ${coachUrl
              ? `
                      <video controls playsinline class="miniVideo">
                        <source src="${coachUrl}">
                      </video>
                    `
              : `<div style="opacity:0.85;">No coach video yet.</div>`
            }
              </div>
            </div>
          `;
        })
      );

      clientFeedbackList.innerHTML = feedbackHtml.join("");
    }
  }

  async function loadCoachQueue() {
    if (!coachQueueList) return;

    const { data, error } = await window.sb
      .from("form_video_reviews")
      .select("id, user_id, status, client_uploaded_at, client_notes, client_video_path, coach_video_path")
      .order("client_uploaded_at", { ascending: false })
      .limit(50);

    if (error) {
      coachQueueList.textContent = "Could not load coach queue.";
      return;
    }

    const rows = data || [];
    if (!rows.length) {
      coachQueueList.innerHTML = `<div style="opacity:0.9;">No submissions yet.</div>`;
      return;
    }

    const html = await Promise.all(
      rows.map(async (r) => {
        const clientUrl = await getPublicUrl(r.client_video_path);
        const coachUrl = r.coach_video_path ? await getPublicUrl(r.coach_video_path) : "";
        const badge = safeLower(r.status) === "reviewed"
          ? `<span class="pill pill-green">Reviewed</span>`
          : `<span class="pill pill-yellow">Submitted</span>`;

        return `
          <div class="queueItem" data-review="${r.id}" data-user="${r.user_id}">
            <div style="display:flex; justify-content:space-between; gap:10px; align-items:center;">
              <div style="font-weight:900;">${r.user_id}</div>
              ${badge}
            </div>
            <div style="opacity:0.9; margin-top:6px; font-weight:800;">
              ${r.client_uploaded_at ? new Date(r.client_uploaded_at).toLocaleString() : ""}
            </div>
            <div style="opacity:0.85; margin-top:8px;">${pickText(r.client_notes, "No client notes")}</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
              <button class="selectSubmissionBtn" type="button" data-review="${r.id}" data-user="${r.user_id}" style="padding:10px 14px; border-radius:12px; border:0; cursor:pointer; font-weight:900;">
                Select Submission
              </button>
              ${clientUrl ? `<button class="openSubmissionVideoBtn" type="button" data-url="${clientUrl}" data-title="Client Submission" style="padding:10px 14px; border-radius:12px; border:0; cursor:pointer; font-weight:900;">Open Client Video</button>` : ""}
              ${coachUrl ? `<button class="openSubmissionCoachVideoBtn" type="button" data-url="${coachUrl}" data-title="Coach Feedback" style="padding:10px 14px; border-radius:12px; border:0; cursor:pointer; font-weight:900;">Open Coach Video</button>` : ""}
            </div>
          </div>
        `;
      })
    );

    coachQueueList.innerHTML = html.join("");

    const cards = coachQueueList.querySelectorAll(".queueItem");

    coachQueueList.querySelectorAll(".selectSubmissionBtn").forEach((btn) => {
      btn.onclick = () => {
        coachSelectedReviewId = btn.getAttribute("data-review");
        coachSelectedUserId = btn.getAttribute("data-user");

        cards.forEach((card) => {
          card.classList.toggle("selected", card.getAttribute("data-review") === coachSelectedReviewId);
        });

        if (coachSelectedMeta) {
          coachSelectedMeta.textContent = `Selected submission: ${coachSelectedReviewId || "(none)"} | Client: ${coachSelectedUserId || "(none)"}`;
        }
      };
    });

    coachQueueList.querySelectorAll(".openSubmissionVideoBtn").forEach((btn) => {
      btn.onclick = () => openVideo(btn.getAttribute("data-title") || "Client Submission", btn.getAttribute("data-url"));
    });

    coachQueueList.querySelectorAll(".openSubmissionCoachVideoBtn").forEach((btn) => {
      btn.onclick = () => openVideo(btn.getAttribute("data-title") || "Coach Feedback", btn.getAttribute("data-url"));
    });
  }
  async function uploadToBucket(path, file) {
    const { error } = await window.sb.storage.from(FORM_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "application/octet-stream",
    });

    if (error) throw error;
  }

  async function createClientSubmission(authUserId) {
    if (!clientVideoFile || !clientVideoNotes || !clientUploadMsg) return;

    const file = clientVideoFile.files?.[0];
    if (!file) {
      clientUploadMsg.textContent = "Please select a video file.";
      return;
    }

    clientUploadMsg.textContent = "Uploading...";

    const { data: inserted, error: insertError } = await window.sb
      .from("form_video_reviews")
      .insert([{
        user_id: authUserId,
        client_video_path: "pending",
        client_notes: clientVideoNotes.value.trim() || null,
        status: "submitted",
      }])
      .select("id")
      .maybeSingle();

    if (insertError || !inserted?.id) {
      clientUploadMsg.textContent = insertError?.message || "Could not create submission. Try again.";
      return;
    }

    const originalFileName = file.name || "video";
    const ext = (originalFileName.split(".").pop() || "mp4").toLowerCase();
    const safeName = originalFileName.replace(/[^\w.\-]+/g, "_");
    const path = `client/${authUserId}/${inserted.id}__${safeName || `upload.${ext}`}`;

    try {
      await uploadToBucket(path, file);

      const { error: updateError } = await window.sb
        .from("form_video_reviews")
        .update({
          client_video_path: path,
          client_uploaded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", inserted.id)
        .eq("user_id", authUserId);

      if (updateError) {
        clientUploadMsg.textContent = updateError.message || "Uploaded, but could not finalize record.";
        return;
      }

      clientVideoFile.value = "";
      clientVideoNotes.value = "";
      clientUploadMsg.textContent = "Uploaded ✅";
      await loadClientFormReviews(authUserId);
    } catch (err) {
      clientUploadMsg.textContent = err?.message || "Upload failed. Try again.";
    }
  }

  async function sendCoachFeedback() {
    if (!coachSelectedReviewId || !coachSelectedUserId) {
      if (coachSendMsg) coachSendMsg.textContent = "Select a submission first.";
      return;
    }

    if (!coachSendMsg) return;
    coachSendMsg.textContent = "Sending...";

    const file = coachVideoFile?.files?.[0];
    let coachPath = null;

    try {
      if (file) {
        const originalFileName = file.name || "coach_video";
        const ext = (originalFileName.split(".").pop() || "mp4").toLowerCase();
        const safeName = originalFileName.replace(/[^\w.\-]+/g, "_");
        coachPath = `coach/${coachSelectedUserId}/${coachSelectedReviewId}__${safeName || `feedback.${ext}`}`;
        await uploadToBucket(coachPath, file);
      }

      const payload = {
        coach_notes: coachNotes?.value?.trim() || null,
        status: "reviewed",
        updated_at: new Date().toISOString(),
      };

      if (coachPath) payload.coach_video_path = coachPath;

      const { error } = await window.sb
        .from("form_video_reviews")
        .update(payload)
        .eq("id", coachSelectedReviewId);

      if (error) {
        coachSendMsg.textContent = error.message || "Failed to send feedback.";
        return;
      }

      if (coachVideoFile) coachVideoFile.value = "";
      if (coachNotes) coachNotes.value = "";
      coachSendMsg.textContent = "Feedback sent ✅";

      await loadCoachQueue();
      await loadClientFormReviews(coachSelectedUserId);
    } catch (err) {
      coachSendMsg.textContent = err?.message || "Failed to send feedback.";
    }
  }

  function calculateCalories() {
    if (!genderEl || !ageEl || !heightFeetEl || !heightInchesEl || !weightEl || !activityEl || !dailyCaloriesEl) return;

    const gender = safeLower(genderEl.value);
    const age = Number(ageEl.value);
    const heightFeet = Number(heightFeetEl.value);
    const heightInches = Number(heightInchesEl.value);
    const weightLb = Number(weightEl.value);
    const activity = Number(activityEl.value);

    if (!age || !weightLb || (!heightFeet && !heightInches) || !activity) {
      currentDailyTarget = 0;
      dailyCaloriesEl.textContent = "—";
      updateCalorieSummary();
      return;
    }

    const totalInches = heightFeet * 12 + heightInches;
    const heightCm = totalInches * 2.54;
    const weightKg = weightLb * 0.45359237;

    let bmr = 0;
    if (gender === "female") {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
    } else {
      bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    }

    currentDailyTarget = Math.round(bmr * activity);
    dailyCaloriesEl.textContent = currentDailyTarget.toLocaleString();
    updateCalorieSummary();
  }

  function updateCalorieSummary() {
    const consumed = calorieEntries.reduce((sum, entry) => sum + Number(entry.calories || 0), 0);
    const remaining = currentDailyTarget > 0 ? currentDailyTarget - consumed : 0;

    if (consumedEl) consumedEl.textContent = String(consumed);
    if (remainingEl) remainingEl.textContent = String(remaining);
  }

  function getLast7DateKeys() {
    const out = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");

      out.push({
        key: `${y}-${m}-${day}`,
        shortLabel: d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
      });
    }

    return out;
  }

  async function loadWeeklyCalorieSeries(authUserId) {
    if (!authUserId) {
      currentWeeklyCalorieSeries = [];
      return;
    }

    const last7 = getLast7DateKeys();
    const startKey = last7[0]?.key;
    const endKey = last7[last7.length - 1]?.key;

    const { data, error } = await window.sb
      .from("calorie_food_logs")
      .select("log_date, calories")
      .eq("user_id", authUserId)
      .gte("log_date", startKey)
      .lte("log_date", endKey)
      .order("log_date", { ascending: true });

    if (error) {
      currentWeeklyCalorieSeries = last7.map((item) => ({
        key: item.key,
        label: item.shortLabel,
        total: 0,
      }));
      return;
    }

    const totalsByDate = {};
    (data || []).forEach((row) => {
      const key = String(row.log_date || "").trim();
      if (!key) return;
      totalsByDate[key] = (totalsByDate[key] || 0) + Number(row.calories || 0);
    });

    currentWeeklyCalorieSeries = last7.map((item) => ({
      key: item.key,
      label: item.shortLabel,
      total: Number(totalsByDate[item.key] || 0),
    }));
  }

  function buildOverviewCaloriesChartHtml() {
    const series = Array.isArray(currentWeeklyCalorieSeries) ? currentWeeklyCalorieSeries : [];
    if (!series.length) {
      return `
        <div class="overview-chart-wrap">
          <div class="overview-chart-head">
            <div class="overview-chart-title">7-Day Calorie Intake</div>
            <div class="overview-chart-subtitle">No data yet</div>
          </div>
          <div class="summary-pill-box">Start logging food to populate the chart.</div>
        </div>
      `;
    }

    const maxValue = Math.max(
      currentDailyTarget || 0,
      ...series.map((item) => Number(item.total || 0)),
      1
    );

    return `
      <div class="overview-chart-wrap">
        <div class="overview-chart-head">
          <div class="overview-chart-title">7-Day Calorie Intake</div>
          <div class="overview-chart-subtitle">Daily consumed calories</div>
        </div>

        <div class="overview-chart-bars">
          ${series.map((item) => {
      const total = Number(item.total || 0);
      const heightPct = Math.max(8, Math.round((total / maxValue) * 100));
      const hitTarget = currentDailyTarget > 0 && total >= currentDailyTarget;

      return `
              <div class="overview-chart-col">
                <div class="overview-chart-value">${total}</div>
                <div class="overview-chart-bar">
                  <div
                    class="overview-chart-fill ${hitTarget ? "hit-target" : ""}"
                    style="height:${heightPct}%;"
                  ></div>
                </div>
                <div class="overview-chart-day">${escapeHtml(item.label)}</div>
              </div>
            `;
    }).join("")}
        </div>
      </div>
    `;
  }

  function renderFoodList() {
    if (!foodListEl) return;

    if (!calorieEntries.length) {
      foodListEl.innerHTML = `<div class="food-item-empty">No foods added yet.</div>`;
      updateCalorieSummary();
      return;
    }

    foodListEl.innerHTML = calorieEntries.map((item) => `
      <div class="food-item">
        <div class="food-item-main">
          <span class="food-item-name">${escapeHtml(item.name)}</span>
          <span class="food-item-meta">${escapeHtml(String(item.calories))} kcal</span>
        </div>
        <div class="food-item-right">
          <button type="button" class="food-delete-btn" data-id="${item.id}">Delete</button>
        </div>
      </div>
    `).join("");

    foodListEl.querySelectorAll(".food-delete-btn").forEach((btn) => {
      btn.onclick = async () => {
        const id = btn.getAttribute("data-id");
        if (!id) return;

        const { error } = await window.sb
          .from("calorie_food_logs")
          .delete()
          .eq("id", id)
          .eq("user_id", currentUserId);

        if (!error) {
          calorieEntries = calorieEntries.filter((entry) => String(entry.id) !== String(id));
          renderFoodList();
        }
      };
    });

    updateCalorieSummary();
  }
  async function loadCaloriesFromSupabase(authUserId) {
    const today = todayKey();

    const { data: settings } = await window.sb
      .from("calorie_user_settings")
      .select("*")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (settings) {
      if (genderEl) genderEl.value = settings.gender || "male";
      if (ageEl) ageEl.value = settings.age ?? "";
      if (heightFeetEl) heightFeetEl.value = settings.height_feet ?? "";
      if (heightInchesEl) heightInchesEl.value = settings.height_inches ?? "";
      if (weightEl) weightEl.value = settings.weight_lb ?? settings.weight_pounds ?? "";
      if (activityEl) activityEl.value = settings.activity_level ?? "1.2";
      currentDailyTarget = Number(settings.daily_calories || 0);
    }

    const { data: daily } = await window.sb
      .from("calorie_daily_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .eq("log_date", today)
      .maybeSingle();

    if (daily) {
      if (genderEl) genderEl.value = daily.gender || genderEl.value;
      if (ageEl) ageEl.value = daily.age ?? ageEl.value;
      if (heightFeetEl) heightFeetEl.value = daily.height_feet ?? heightFeetEl.value;
      if (heightInchesEl) heightInchesEl.value = daily.height_inches ?? heightInchesEl.value;
      if (weightEl) weightEl.value = daily.weight_lb ?? daily.weight_pounds ?? weightEl.value;
      if (activityEl) activityEl.value = daily.activity_level ?? activityEl.value;
      currentDailyTarget = Number(daily.daily_calories || currentDailyTarget || 0);
    }

    const { data: foods } = await window.sb
      .from("calorie_food_logs")
      .select("*")
      .eq("user_id", authUserId)
      .eq("log_date", today)
      .order("created_at", { ascending: true });

    calorieEntries = (foods || []).map((row) => ({
      id: row.id,
      name: String(row.food_name || "").trim(),
      calories: Number(row.calories || 0),
    }));

    if (dailyCaloriesEl) {
      dailyCaloriesEl.textContent = currentDailyTarget > 0 ? currentDailyTarget.toLocaleString() : "—";
    }

    await loadWeeklyCalorieSeries(authUserId);
    renderFoodList();
  }

  async function syncCaloriesToSupabase() {
    if (!currentUserId || calorieSyncInFlight) return;
    calorieSyncInFlight = true;

    try {
      const today = todayKey();
      const nowIso = new Date().toISOString();
      const weightValue = weightEl?.value === "" ? null : Number(weightEl?.value);

      const settingsPayload = {
        user_id: currentUserId,
        gender: genderEl?.value || "male",
        age: ageEl?.value === "" ? null : Number(ageEl?.value),
        height_feet: heightFeetEl?.value === "" ? null : Number(heightFeetEl?.value),
        height_inches: heightInchesEl?.value === "" ? 0 : Number(heightInchesEl?.value),
        weight_lb: weightValue,
        activity_level: activityEl?.value === "" ? 1.2 : Number(activityEl?.value),
        daily_calories: Number(currentDailyTarget || 0),
        updated_at: nowIso,
      };

      await window.sb.from("calorie_user_settings").upsert(settingsPayload, { onConflict: "user_id" });

      const dailyPayload = {
        user_id: currentUserId,
        log_date: today,
        gender: genderEl?.value || "male",
        age: ageEl?.value === "" ? null : Number(ageEl?.value),
        height_feet: heightFeetEl?.value === "" ? null : Number(heightFeetEl?.value),
        height_inches: heightInchesEl?.value === "" ? 0 : Number(heightInchesEl?.value),
        weight_lb: weightValue,
        weight_pounds: weightValue,
        activity_level: activityEl?.value === "" ? 1.2 : Number(activityEl?.value),
        daily_calories: Number(currentDailyTarget || 0),
        updated_at: nowIso,
      };

      await window.sb.from("calorie_daily_profiles").upsert(dailyPayload, { onConflict: "user_id,log_date" });
    } finally {
      calorieSyncInFlight = false;
    }
  }

  function scheduleCalorieSync() {
    if (!currentUserId) return;
    if (calorieSyncTimer) clearTimeout(calorieSyncTimer);

    calorieSyncTimer = setTimeout(() => {
      syncCaloriesToSupabase().catch(() => { });
    }, 300);
  }

  async function addFoodEntry() {
    if (!foodNameEl || !foodCaloriesEl || !currentUserId) return;

    const name = String(foodNameEl.value || "").trim();
    const calories = Number(foodCaloriesEl.value);

    if (!name || !calories || calories <= 0) return;

    const { data, error } = await window.sb
      .from("calorie_food_logs")
      .insert([{
        user_id: currentUserId,
        log_date: todayKey(),
        food_name: name,
        calories,
        source_type: "manual",
      }])
      .select("*")
      .maybeSingle();

    if (error) return;

    if (data) {
      calorieEntries.push({
        id: data.id,
        name: String(data.food_name || "").trim(),
        calories: Number(data.calories || 0),
      });
    }

    foodNameEl.value = "";
    foodCaloriesEl.value = "";
    renderFoodList();
  }

  attachPresetSync(location1Preset, location1);
  attachPresetSync(location2Preset, location2);
  attachPresetSync(location3Preset, location3);

  injectDashboardTweaksStyles();
  wireMainTabs();
  wireInpersonTabs();
  wireOverviewButtons();
  ensureOnlinePurchaseUI(createCheckout);

  onlineAddonPurchaseBox = document.getElementById("onlineAddonPurchaseBox");
  onlineAddonActiveBox = document.getElementById("onlineAddonActiveBox");
  onlineAddonPlanSelect = document.getElementById("onlineAddonPlanSelect");
  onlineAddonBuyBtn = document.getElementById("onlineAddonBuyBtn");
  onlineAddonStatus = document.getElementById("onlineAddonStatus");

  if (!inpersonPaymentCards) {
    ensureInpersonPaymentCardsContainer();
  }

  if (currentInpersonTab === "booked") {
    setupCalendarFrame(inpersonCalendarFrame);
  }

  setMainPanel("overview");
  setActiveInpersonTab(currentInpersonTab);
  applyRequestedView();
  renderOverviewPanel();

  if (clientUploadBtn) {
    clientUploadBtn.onclick = async () => {
      if (!currentUserId) return;
      await createClientSubmission(currentUserId);
    };
  }

  if (coachSendBtn) coachSendBtn.onclick = sendCoachFeedback;
  if (calculateBtn) calculateBtn.onclick = async () => { calculateCalories(); await syncCaloriesToSupabase(); };
  if (addFoodBtn) addFoodBtn.onclick = addFoodEntry;

  [genderEl, ageEl, heightFeetEl, heightInchesEl, weightEl, activityEl].filter(Boolean).forEach((el) => {
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
      calculateCalories();
      scheduleCalorieSync();
    });
  });

  if (inpersonPlanGrid && inpersonPlanChoice) {
    const cards = inpersonPlanGrid.querySelectorAll(".plan-card");
    cards.forEach((card) => {
      card.onclick = () => {
        cards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        inpersonPlanChoice.value = card.getAttribute("data-plan") || "inperson_1x";
        applyPlanUI(inpersonPlanChoice.value);
      };
    });
    applyPlanUI(inpersonPlanChoice.value);
  }

  statusEl.textContent = "Checking login...";

  const { data: authData } = await window.sb.auth.getUser();
  const user = authData?.user;

  if (!user) {
    statusEl.textContent = "Not logged in.";
    setTimeout(() => { window.location.href = "login.html"; }, 800);
    return;
  }

  currentUserId = user.id;
  currentProfile = await fetchProfile(user.id);
  currentUserEmail = currentProfile?.email || user.email || "";
  currentUserFullName =
    currentProfile?.full_name ||
    currentProfile?.name ||
    currentProfile?.first_name ||
    currentUserEmail ||
    "Client";

  setWelcome(currentUserFullName);
  statusEl.textContent = formatLoggedInStamp(currentUserFullName);

  const trainingType = normalizeTrainingType(currentProfile?.training_type);
  const requestRows = await fetchAllInpersonRequests(user.id, currentProfile);
  const bookingRows = await fetchAllPaygBookings(user.id, currentProfile);
  const sessionRows = await fetchInpersonSessions(user.id, currentProfile);

  let inpersonSub = await fetchLatestInpersonSubscription(user.id, currentProfile);
  const syncedInpersonSub = await ensureInpersonSubscriptionFromPaidRequest(requestRows, user.id);
  if (!inpersonSub && syncedInpersonSub) {
    inpersonSub = syncedInpersonSub;
  }

  const onlineSub = await fetchOnlineSubscription(user.id, currentProfile);
  const latestWeek = await fetchLatestWeek(currentProfile, user.id);

  const hasInPersonAccess =
    !!inpersonSub &&
    isApprovedLike(inpersonSub.status) &&
    !isExpired(inpersonSub.end_date);

  const hasOnlineAccess =
    !!onlineSub &&
    isApprovedLike(onlineSub.status) &&
    !isExpired(onlineSub.end_date);

  injectMembershipSummaryBar(
    getTrainingLabel(hasInPersonAccess, hasOnlineAccess),
    getExpiryLabel(inpersonSub, onlineSub, hasInPersonAccess, hasOnlineAccess)
  );

  if (mainTabInperson && trainingType === "online" && !hasInPersonAccess) {
    mainTabInperson.style.display = "none";
    if (mainPanelInperson) mainPanelInperson.style.display = "none";

    if (currentMainPanel === "inperson") {
      setMainPanel("overview");
    }
  } else if (mainTabInperson) {
    mainTabInperson.style.display = "";
  }
  applyInpersonState({
    inpersonReq: requestRows[0] || null,
    inpersonSub,
    requestRows,
    bookingRows,
    sessionRows,
    hasInPersonAccess,
  });

  renderNutritionTabFromGuideLink(latestWeek);
  renderWeekWelcome(latestWeek);
  await loadCaloriesFromSupabase(user.id);
  renderOverviewPanel();

  // ensure UI exists before toggling anything


  if (hasOnlineAccess) {
    if (onlineUnavailableBox) onlineUnavailableBox.style.display = "none";
    if (onlineAddonPurchaseBox) onlineAddonPurchaseBox.style.display = "none";
    if (onlineAddonActiveBox) onlineAddonActiveBox.style.display = "block";
    if (onlineSection) onlineSection.style.display = "block";

    await loadOnlineWorkouts(user.id, currentProfile);
    enableMessaging();
  } else {
    if (onlineUnavailableBox) {
      onlineUnavailableBox.style.display = "block";
      onlineUnavailableBox.innerHTML = `
        <div class="section-title">Online Training</div>
        <div class="section-subtitle">
          ${hasInPersonAccess || trainingType === "both" || trainingType === "inperson"
          ? "Online training is not active on your account. Choose a plan below to add it."
          : "Online training is not active on your account right now."}
        </div>
      `;
    }

    if (onlineAddonPurchaseBox) onlineAddonPurchaseBox.style.display = "block";
    if (onlineAddonActiveBox) onlineAddonActiveBox.style.display = "none";
    if (onlineSection) onlineSection.style.display = "none";

    if (mainTabMessages) mainTabMessages.style.display = "none";
    if (currentMainPanel === "messages") setMainPanel("overview");
  }

  if (sendInpersonRequestBtn) {
    sendInpersonRequestBtn.onclick = async () => {
      const plan = inpersonPlanChoice?.value || "inperson_1x";
      const isPayg = safeLower(plan).includes("inperson_payg");

      if (inpersonMsg) inpersonMsg.textContent = "Checking location...";

      const validation = await validateInpersonRequestForm(plan);
      if (!validation.ok) {
        if (inpersonMsg) inpersonMsg.textContent = validation.message;
        return;
      }

      if (inpersonMsg) inpersonMsg.textContent = "Sending...";

      if (isPayg) {
        const { error } = await window.sb.from("inperson_bookings").insert([{
          user_id: user.id,
          plan_code: "inperson_payg",
          session_date: day1?.value || null,
          session_time: time1?.value || null,
          location: normalizeLocationText(location1?.value || ""),
          status: "pending",
        }]);

        if (error) {
          if (inpersonMsg) inpersonMsg.textContent = error.message;
          return;
        }

        if (inpersonMsg) inpersonMsg.textContent = "Pay-as-you-go request sent ✅ Awaiting approval.";
        return;
      }

      const { error } = await window.sb.from("inperson_requests").insert([{
        user_id: user.id,
        plan_code: plan,
        day_1: day1?.value || null,
        time_1: time1?.value || null,
        location_1: normalizeLocationText(location1?.value || ""),
        day_2: day2?.value || null,
        time_2: time2?.value || null,
        location_2: normalizeLocationText(location2?.value || ""),
        day_3: day3?.value || null,
        time_3: time3?.value || null,
        location_3: normalizeLocationText(location3?.value || ""),
        status: "pending",
      }]);

      if (error) {
        if (inpersonMsg) inpersonMsg.textContent = error.message;
        return;
      }

      if (inpersonMsg) inpersonMsg.textContent = "Request sent ✅ Awaiting approval.";
    };
  }

  if (safeLower(onlineSub?.plan).includes("pro")) {
    if (formCheckSection) formCheckSection.style.display = "block";
    if (safeLower(currentProfile?.role) === "coach" && coachReviewPanel) {
      coachReviewPanel.style.display = "block";
      await loadCoachQueue();
    }
    await loadClientFormReviews(user.id);
  } else if (formCheckSection) {
    formCheckSection.style.display = "none";
  }

  if (!window.__dashboardPollingStarted) {
    window.__dashboardPollingStarted = true;

    setInterval(async () => {
      if (!currentUserId) return;

      await loadCaloriesFromSupabase(currentUserId);
      await loadClientFormReviews(currentUserId);

      const refreshedProfile = await fetchProfile(currentUserId);
      const refreshedTrainingType = normalizeTrainingType(refreshedProfile?.training_type);

      const refreshedRequestRows = await fetchAllInpersonRequests(currentUserId, refreshedProfile);
      const refreshedBookingRows = await fetchAllPaygBookings(currentUserId, refreshedProfile);
      const refreshedSessionRows = await fetchInpersonSessions(currentUserId, refreshedProfile);

      let refreshedInpersonSub = await fetchLatestInpersonSubscription(currentUserId, refreshedProfile);
      const syncedRefreshedInpersonSub = await ensureInpersonSubscriptionFromPaidRequest(
        refreshedRequestRows,
        currentUserId
      );
      if (!refreshedInpersonSub && syncedRefreshedInpersonSub) {
        refreshedInpersonSub = syncedRefreshedInpersonSub;
      }

      const refreshedOnlineSub = await fetchOnlineSubscription(currentUserId, refreshedProfile);
      const refreshedWeek = await fetchLatestWeek(refreshedProfile, currentUserId);

      const refreshedHasInPersonAccess =
        !!refreshedInpersonSub &&
        isApprovedLike(refreshedInpersonSub.status) &&
        !isExpired(refreshedInpersonSub.end_date);

      const refreshedHasOnlineAccess =
        !!refreshedOnlineSub &&
        isApprovedLike(refreshedOnlineSub.status) &&
        !isExpired(refreshedOnlineSub.end_date);

      currentProfile = refreshedProfile;

      injectMembershipSummaryBar(
        getTrainingLabel(refreshedHasInPersonAccess, refreshedHasOnlineAccess),
        getExpiryLabel(
          refreshedInpersonSub,
          refreshedOnlineSub,
          refreshedHasInPersonAccess,
          refreshedHasOnlineAccess
        )
      );

      if (mainTabInperson && refreshedTrainingType === "online" && !refreshedHasInPersonAccess) {
        mainTabInperson.style.display = "none";
        if (mainPanelInperson) mainPanelInperson.style.display = "none";

        if (currentMainPanel === "inperson") {
          setMainPanel("overview");
        }
      } else if (mainTabInperson) {
        mainTabInperson.style.display = "";
      }

      applyInpersonState({
        inpersonReq: refreshedRequestRows[0] || null,
        inpersonSub: refreshedInpersonSub,
        requestRows: refreshedRequestRows,
        bookingRows: refreshedBookingRows,
        sessionRows: refreshedSessionRows,
        hasInPersonAccess: refreshedHasInPersonAccess,
      });

      renderNutritionTabFromGuideLink(refreshedWeek);
      renderWeekWelcome(refreshedWeek);

      ensureOnlinePurchaseUI(createCheckout);

      onlineAddonPurchaseBox = document.getElementById("onlineAddonPurchaseBox");
      onlineAddonActiveBox = document.getElementById("onlineAddonActiveBox");
      onlineAddonPlanSelect = document.getElementById("onlineAddonPlanSelect");
      onlineAddonBuyBtn = document.getElementById("onlineAddonBuyBtn");
      onlineAddonStatus = document.getElementById("onlineAddonStatus");

      if (refreshedHasOnlineAccess) {
        if (onlineUnavailableBox) onlineUnavailableBox.style.display = "none";
        if (onlineAddonPurchaseBox) onlineAddonPurchaseBox.style.display = "none";
        if (onlineAddonActiveBox) onlineAddonActiveBox.style.display = "block";
        if (onlineSection) onlineSection.style.display = "block";

        if (currentMainPanel === "online") {
          await loadOnlineWorkouts(currentUserId, refreshedProfile);
        }
      } else {
        if (onlineUnavailableBox) {
          onlineUnavailableBox.style.display = "block";
          onlineUnavailableBox.innerHTML = `
            <div class="section-title">Online Training</div>
            <div class="section-subtitle">
              ${refreshedHasInPersonAccess || refreshedTrainingType === "both" || refreshedTrainingType === "inperson"
              ? "Online training is not active on your account. Choose a plan below to add it."
              : "Online training is not active on your account right now."}
            </div>
          `;
        }

        if (onlineAddonPurchaseBox) onlineAddonPurchaseBox.style.display = "block";
        if (onlineAddonActiveBox) onlineAddonActiveBox.style.display = "none";
        if (onlineSection) onlineSection.style.display = "none";
      }

      if (safeLower(refreshedOnlineSub?.plan).includes("pro")) {
        if (formCheckSection) formCheckSection.style.display = "block";

        if (safeLower(refreshedProfile?.role) === "coach" && coachReviewPanel) {
          coachReviewPanel.style.display = "block";
          await loadCoachQueue();
        }
      } else {
        if (formCheckSection) formCheckSection.style.display = "none";
        if (coachReviewPanel) coachReviewPanel.style.display = "none";
      }
    }, POLL_MS);
  }
});