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

function revealPage() {
  document.body.style.visibility = "visible";
}

function safeLower(v) {
  return String(v || "").toLowerCase();
}

function pickText(v, fallback = "") {
  const s = String(v ?? "").trim();
  return s ? s : fallback;
}

document.addEventListener("DOMContentLoaded", async () => {
  if (!window.sb) {
    alert("Site connection not found. Refresh and try again.");
    window.location.href = "login.html";
    return;
  }

  const weekBannerChip = document.getElementById("weekBannerChip");
  const weekBannerTitle = document.getElementById("weekBannerTitle");
  const weekBannerText = document.getElementById("weekBannerText");

  const weekWelcomeSection = document.getElementById("weekWelcomeSection");
  const weekWelcomeText = document.getElementById("weekWelcomeText");
  const weekWelcomeVideoWrap = document.getElementById("weekWelcomeVideoWrap");

  const nutritionGuideSection = document.getElementById("nutritionGuideSection");
  const nutritionGuideText = document.getElementById("nutritionGuideText");
  const nutritionGuideLink = document.getElementById("nutritionGuideLink");
  const nutritionBlogBody = document.getElementById("nutritionBlogBody");
  const nutritionFocusTitle = document.getElementById("nutritionFocusTitle");
  const nutritionFocusText = document.getElementById("nutritionFocusText");

  const groceryFocusBox = document.getElementById("groceryFocusBox");
  const easyCarbsBox = document.getElementById("easyCarbsBox");
  const substitutionsBox = document.getElementById("substitutionsBox");

  const mealPlanTableBody = document.querySelector(".meal-plan tbody");

  const videoModal = document.getElementById("videoModal");
  const videoModalClose = document.getElementById("videoModalClose");
  const videoModalTitle = document.getElementById("videoModalTitle");
  const videoModalPlayer = document.getElementById("videoModalPlayer");
  const videoModalSource = document.getElementById("videoModalSource");

  function redirectToLogin() {
    window.location.href = "login.html";
  }

  function redirectCoach() {
    window.location.href = "coach-dashboard.html";
  }

  function openVideo(title, url) {
    if (!videoModal || !videoModalPlayer || !videoModalSource || !url) return;

    if (videoModalTitle) {
      videoModalTitle.textContent = title || "Nutrition Video";
    }

    videoModalPlayer.pause();
    videoModalSource.removeAttribute("src");
    videoModalPlayer.load();

    videoModalSource.src = url;
    videoModalPlayer.load();
    videoModal.style.display = "flex";

    videoModalPlayer.play().catch(() => {});
  }

  function closeVideo() {
    if (!videoModal || !videoModalPlayer || !videoModalSource) return;
    videoModal.style.display = "none";
    videoModalPlayer.pause();
    videoModalSource.removeAttribute("src");
    videoModalPlayer.load();
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

  async function fetchProfile(userId) {
    const { data, error } = await window.sb
      .from("profiles")
      .select("id, full_name, email, role, training_type")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  }

  async function fetchLatestNutritionWeek(userId) {
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
        nutrition_title,
        nutrition_intro,
        nutrition_blog_title,
        nutrition_blog_intro,
        nutrition_blog_body,
        nutrition_focus_title,
        nutrition_focus_text,
        nutrition_side_title,
        nutrition_side_text,
        nutrition_grocery_focus,
        nutrition_easy_carbs,
        nutrition_substitutions,
        nutrition_banner_title,
        nutrition_banner_text,
        nutrition_meal_plan_json
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Could not load nutrition content:", error.message);
      return null;
    }

    return data || null;
  }

  function formatWeekLabel(weekName, createdAt) {
    const trimmed = String(weekName || "").trim();
    if (trimmed) return trimmed;

    if (!createdAt) return "This Week";

    const d = new Date(createdAt);
    if (Number.isNaN(d.getTime())) return "This Week";

    return `Week of ${d.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric"
    })}`;
  }

  function parseMealPlan(value) {
    if (!value) return null;

    if (Array.isArray(value)) return value;

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  function renderMealPlanRows(rows) {
    if (!mealPlanTableBody || !Array.isArray(rows) || !rows.length) return;

    const normalized = rows
      .map((row) => ({
        day: pickText(row.day, "—"),
        breakfast: pickText(row.breakfast, "—"),
        mid_morning_snack: pickText(
          row.mid_morning_snack || row.morning_snack || row.snack_1,
          "—"
        ),
        lunch: pickText(row.lunch, "—"),
        mid_day_snack: pickText(
          row.mid_day_snack || row.afternoon_snack || row.snack_2 || row.snack,
          "—"
        ),
        dinner: pickText(row.dinner, "—"),
      }))
      .filter((row) => row.day !== "—");

    if (!normalized.length) return;

    mealPlanTableBody.innerHTML = normalized
      .map(
        (row) => `
          <tr>
            <td class="day-cell">${row.day}</td>
            <td class="meal-cell">${row.breakfast}</td>
            <td class="meal-cell">${row.mid_morning_snack}</td>
            <td class="meal-cell">${row.lunch}</td>
            <td class="meal-cell">${row.mid_day_snack}</td>
            <td class="meal-cell">${row.dinner}</td>
          </tr>
        `
      )
      .join("");
  }

  function renderSubstitutions(boxEl, substitutions) {
    if (!boxEl) return;

    if (Array.isArray(substitutions) && substitutions.length) {
      boxEl.innerHTML = `
        <h3>Simple Substitutions</h3>
        <ul>
          ${substitutions.map((item) => `<li>${pickText(item, "")}</li>`).join("")}
        </ul>
      `;
      return;
    }

    if (typeof substitutions === "string" && substitutions.trim()) {
      const items = substitutions
        .split("\n")
        .map((x) => x.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean);

      if (items.length) {
        boxEl.innerHTML = `
          <h3>Simple Substitutions</h3>
          <ul>
            ${items.map((item) => `<li>${item}</li>`).join("")}
          </ul>
        `;
      }
    }
  }

  function renderWeekWelcome(weekRow) {
    if (!weekWelcomeSection || !weekWelcomeText || !weekWelcomeVideoWrap) return;

    const url = pickText(weekRow?.welcome_video_url);

    if (!url) {
      weekWelcomeSection.style.display = "none";
      weekWelcomeVideoWrap.innerHTML = "";
      return;
    }

    weekWelcomeSection.style.display = "block";
    weekWelcomeText.textContent =
      "Watch this week’s welcome video before starting your training.";

    const isVimeo =
      url.includes("vimeo.com") || url.includes("player.vimeo.com");

    if (isVimeo) {
      let embedUrl = url;

      if (!embedUrl.includes("player.vimeo.com")) {
        const match = embedUrl.match(/vimeo\.com\/(\d+)/);
        if (match?.[1]) {
          embedUrl = `https://player.vimeo.com/video/${match[1]}?title=0&byline=0&portrait=0`;
        }
      }

      weekWelcomeVideoWrap.innerHTML = `
        <iframe
          src="${embedUrl}"
          frameborder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowfullscreen
          title="Welcome to the Week">
        </iframe>

        <div class="week-video-actions">
          <a
            href="${url}"
            target="_blank"
            rel="noopener noreferrer"
            class="nutrition-guide-link">
            Open Full Video
          </a>
          <div class="week-video-caption">
            Coach video message for the week.
          </div>
        </div>
      `;
      return;
    }

    weekWelcomeVideoWrap.innerHTML = `
      <video controls playsinline preload="metadata">
        <source src="${url}">
      </video>

      <div class="week-video-actions">
        <button
          id="openWeekWelcomeVideoBtn"
          type="button"
          class="week-video-btn">
          Open Full Video
        </button>
        <div class="week-video-caption">
          Coach video message for the week.
        </div>
      </div>
    `;

    const openBtn = document.getElementById("openWeekWelcomeVideoBtn");
    if (openBtn) {
      openBtn.onclick = () => openVideo("Welcome to the Week", url);
    }
  }

  function renderNutritionContent(weekRow) {
    if (!weekRow) return;

    if (weekBannerChip) {
      weekBannerChip.textContent = formatWeekLabel(weekRow.week_name, weekRow.created_at);
    }

    if (weekBannerTitle && pickText(weekRow.nutrition_banner_title || weekRow.nutrition_title)) {
      weekBannerTitle.textContent = weekRow.nutrition_banner_title || weekRow.nutrition_title;
    }

    if (weekBannerText && pickText(weekRow.nutrition_banner_text || weekRow.nutrition_intro)) {
      weekBannerText.textContent = weekRow.nutrition_banner_text || weekRow.nutrition_intro;
    }

    renderWeekWelcome(weekRow);

    if (nutritionGuideSection) {
      nutritionGuideSection.style.display = "block";
    }

    if (nutritionGuideText && pickText(weekRow.nutrition_blog_intro || weekRow.nutrition_intro)) {
      nutritionGuideText.textContent =
        weekRow.nutrition_blog_intro || weekRow.nutrition_intro;
    }

    if (nutritionBlogBody && pickText(weekRow.nutrition_blog_body)) {
      const paragraphs = weekRow.nutrition_blog_body
        .split("\n")
        .map((p) => p.trim())
        .filter(Boolean);

      if (paragraphs.length) {
        nutritionBlogBody.innerHTML = paragraphs.map((p) => `<p>${p}</p>`).join("");
      }
    }

    if (nutritionFocusTitle && pickText(weekRow.nutrition_focus_title)) {
      nutritionFocusTitle.textContent = weekRow.nutrition_focus_title;
    }

    if (nutritionFocusText && pickText(weekRow.nutrition_focus_text)) {
      nutritionFocusText.textContent = weekRow.nutrition_focus_text;
    }

    if (nutritionGuideLink && pickText(weekRow.nutrition_guide_url)) {
      nutritionGuideLink.href = weekRow.nutrition_guide_url;
      nutritionGuideLink.textContent =
        pickText(weekRow.nutrition_guide_label, "Open This Week’s Nutrition Guide");
    }

    if (groceryFocusBox && pickText(weekRow.nutrition_grocery_focus)) {
      groceryFocusBox.innerHTML = `
        <h3>Grocery Focus</h3>
        <p>${weekRow.nutrition_grocery_focus}</p>
      `;
    }

    if (easyCarbsBox && pickText(weekRow.nutrition_easy_carbs)) {
      easyCarbsBox.innerHTML = `
        <h3>Easy Carb Options</h3>
        <p>${weekRow.nutrition_easy_carbs}</p>
      `;
    }

    if (substitutionsBox && weekRow.nutrition_substitutions) {
      renderSubstitutions(substitutionsBox, weekRow.nutrition_substitutions);
    }

    const mealPlanRows = parseMealPlan(weekRow.nutrition_meal_plan_json);
    if (mealPlanRows) {
      renderMealPlanRows(mealPlanRows);
    }
  }

  try {
    const { data: userResult, error: userError } = await window.sb.auth.getUser();

    if (userError || !userResult?.user) {
      redirectToLogin();
      return;
    }

    const user = userResult.user;
    const profile = await fetchProfile(user.id);

    if (!profile) {
      redirectToLogin();
      return;
    }

    if (safeLower(profile.role) === "coach") {
      redirectCoach();
      return;
    }

    if (safeLower(profile.role) !== "client") {
      redirectToLogin();
      return;
    }

    const weekRow = await fetchLatestNutritionWeek(user.id);
    renderNutritionContent(weekRow);
    revealPage();
  } catch (err) {
    console.error("Nutrition page error:", err);
    redirectToLogin();
  }
});