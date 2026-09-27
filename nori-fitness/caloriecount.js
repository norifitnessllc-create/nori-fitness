let dailyCalories = 0;
let consumedCalories = 0;
let foods = [];
let selectedFoodLibraryItem = null;
let currentUserId = null;
let currentDateKey = getLocalDateKey();
let foodSearchTimer = null;

let resolvedProfileDateColumn = null;
let resolvedFoodDateColumn = null;
let resolvedFoodLibraryCaloriesColumn = null;
let resolvedFoodLibraryBrandColumn = null;
let resolvedFoodLibraryCategoryColumn = null;
let resolvedFoodLibraryFdcIdColumn = null;

const genderEl = document.getElementById("gender");
const ageEl = document.getElementById("age");
const heightFeetEl = document.getElementById("heightFeet");
const heightInchesEl = document.getElementById("heightInches");
const weightEl = document.getElementById("weight");
const activityEl = document.getElementById("activity");
const calculateBtn = document.getElementById("calculateBtn");
const dailyCaloriesEl = document.getElementById("dailyCalories");

const foodSearchEl = document.getElementById("foodSearch");
const foodSearchResultsEl = document.getElementById("foodSearchResults");
const foodNameEl = document.getElementById("foodName");
const foodCaloriesEl = document.getElementById("foodCalories");
const addFoodBtn = document.getElementById("addFoodBtn");
const foodListEl = document.getElementById("foodList");
const consumedEl = document.getElementById("consumed");
const remainingEl = document.getElementById("remaining");

document.addEventListener("DOMContentLoaded", async function () {
  wireEvents();
  renderFoods();
  updateRemaining();
  await startTracker();
});

function wireEvents() {
  calculateBtn.addEventListener("click", calculateCalories);
  addFoodBtn.addEventListener("click", addFood);

  if (foodSearchEl && foodSearchResultsEl) {
    foodSearchEl.addEventListener("input", function () {
      clearTimeout(foodSearchTimer);

      const query = foodSearchEl.value.trim();

      if (!query) {
        foodSearchResultsEl.innerHTML = "";
        return;
      }

      foodSearchTimer = setTimeout(function () {
        searchFoodLibrary(query);
      }, 150);
    });
  }

  foodNameEl.addEventListener("input", function () {
    selectedFoodLibraryItem = null;
  });

  foodCaloriesEl.addEventListener("input", function () {
    selectedFoodLibraryItem = null;
  });

  foodCaloriesEl.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addFood();
    }
  });

  foodNameEl.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      addFood();
    }
  });

  genderEl.addEventListener("change", autoSaveCalculatorIfReady);
  ageEl.addEventListener("input", autoSaveCalculatorIfReady);
  heightFeetEl.addEventListener("input", autoSaveCalculatorIfReady);
  heightInchesEl.addEventListener("input", autoSaveCalculatorIfReady);
  weightEl.addEventListener("input", autoSaveCalculatorIfReady);
  activityEl.addEventListener("change", autoSaveCalculatorIfReady);
}

async function startTracker() {
  currentUserId = await getCurrentUserId();
  await resolveSchema();
  await loadSavedCalculator();
  await loadSavedFoods();
}

async function getCurrentUserId() {
  try {
    if (!window.sb || !window.sb.auth) return null;
    const result = await window.sb.auth.getUser();
    return result?.data?.user?.id || null;
  } catch (error) {
    console.error("Could not get user:", error);
    return null;
  }
}

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toNumber(value) {
  return Number(value || 0);
}

function getCalculatorState() {
  return {
    gender: genderEl.value,
    age: toNumber(ageEl.value),
    height_feet: toNumber(heightFeetEl.value),
    height_inches: toNumber(heightInchesEl.value),
    weight_lb: toNumber(weightEl.value),
    activity_level: Number(activityEl.value || 1.2),
    daily_calories: Number(dailyCalories || 0)
  };
}

function calculatorIsReadyForSave() {
  const age = toNumber(ageEl.value);
  const heightFeet = toNumber(heightFeetEl.value);
  const weightLb = toNumber(weightEl.value);
  return age > 0 && heightFeet > 0 && weightLb > 0;
}

function autoSaveCalculatorIfReady() {
  if (!calculatorIsReadyForSave()) return;
  calculateCalories(true);
}

function calculateCalories(isAutoSave = false) {
  const gender = genderEl.value;
  const age = toNumber(ageEl.value);
  const heightFeet = toNumber(heightFeetEl.value);
  const heightInches = toNumber(heightInchesEl.value);
  const weightPounds = toNumber(weightEl.value);
  const activity = Number(activityEl.value || 1.2);

  if (!age || !heightFeet || !weightPounds) {
    dailyCalories = 0;
    dailyCaloriesEl.innerText = "Enter client details";
    updateRemaining();
    return;
  }

  const totalInches = (heightFeet * 12) + heightInches;
  const heightCm = totalInches * 2.54;
  const weightKg = weightPounds * 0.453592;

  let bmr = 0;

  if (gender === "male") {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) + 5;
  } else {
    bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age) - 161;
  }

  dailyCalories = Math.round(bmr * activity);
  dailyCaloriesEl.innerText = dailyCalories + " kcal";
  updateRemaining();

  saveCalculatorProfile();

  if (!isAutoSave) {
    saveCalculatorToLocalBackup();
  }
}

async function resolveSchema() {
  if (!window.sb) return;

  resolvedProfileDateColumn = await detectExistingColumn("calorie_daily_profiles", ["log_date", "day_date"]);
  resolvedFoodDateColumn = await detectExistingColumn("calorie_food_logs", ["log_date", "day_date"]);

  if (foodSearchEl && foodSearchResultsEl) {
    resolvedFoodLibraryCaloriesColumn = await detectExistingColumn("calorie_food_library", ["calories_per_100g", "calories"]);
    resolvedFoodLibraryBrandColumn = await detectExistingColumn("calorie_food_library", ["brand"]);
    resolvedFoodLibraryCategoryColumn = await detectExistingColumn("calorie_food_library", ["category"]);
    resolvedFoodLibraryFdcIdColumn = await detectExistingColumn("calorie_food_library", ["fdc_id"]);
  }
}

async function detectExistingColumn(tableName, columnNames) {
  for (const columnName of columnNames) {
    try {
      const result = await window.sb
        .from(tableName)
        .select(columnName)
        .limit(1);

      if (!result?.error) {
        return columnName;
      }
    } catch (error) {
      console.error(`Column test failed for ${tableName}.${columnName}:`, error);
    }
  }

  return null;
}

function buildDatePayload(columnName, value) {
  if (!columnName) return {};
  return { [columnName]: value };
}

async function saveCalculatorProfile() {
  saveCalculatorToLocalBackup();

  if (!window.sb || !currentUserId) return;

  const state = getCalculatorState();
  const dateColumn = resolvedProfileDateColumn || "log_date";

  try {
    const result = await window.sb
      .from("calorie_daily_profiles")
      .upsert(
        {
          user_id: currentUserId,
          gender: state.gender,
          age: state.age,
          height_feet: state.height_feet,
          height_inches: state.height_inches,
          weight_lb: state.weight_lb,
          activity_level: state.activity_level,
          daily_calories: state.daily_calories,
          updated_at: new Date().toISOString(),
          ...buildDatePayload(dateColumn, currentDateKey)
        },
        {
          onConflict: `user_id,${dateColumn}`
        }
      )
      .select();

    if (result?.error) {
      console.error("Save calculator error:", result.error);
    }
  } catch (error) {
    console.error("Save calculator error:", error);
  }
}

async function loadSavedCalculator() {
  let loadedFromSupabase = false;
  const dateColumn = resolvedProfileDateColumn || "log_date";

  if (window.sb && currentUserId) {
    try {
      const result = await window.sb
        .from("calorie_daily_profiles")
        .select(`gender, age, height_feet, height_inches, weight_lb, activity_level, daily_calories, ${dateColumn}, updated_at`)
        .eq("user_id", currentUserId)
        .order(dateColumn, { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result?.error) {
        console.error("Load calculator error:", result.error);
      }

      const profile = result?.data;

      if (profile) {
        applyCalculatorState({
          gender: profile.gender,
          age: profile.age,
          height_feet: profile.height_feet,
          height_inches: profile.height_inches,
          weight_lb: profile.weight_lb,
          activity_level: profile.activity_level,
          daily_calories: profile.daily_calories
        });
        loadedFromSupabase = true;
      }
    } catch (error) {
      console.error("Load calculator error:", error);
    }
  }

  if (!loadedFromSupabase) {
    loadCalculatorFromLocalBackup();
  }
}

function applyCalculatorState(state) {
  genderEl.value = state.gender || "male";
  ageEl.value = state.age ?? "";
  heightFeetEl.value = state.height_feet ?? "";
  heightInchesEl.value = state.height_inches ?? "";
  weightEl.value = state.weight_lb ?? "";
  activityEl.value = String(state.activity_level ?? "1.2");
  dailyCalories = Number(state.daily_calories || 0);

  if (dailyCalories > 0) {
    dailyCaloriesEl.innerText = dailyCalories + " kcal";
  } else {
    dailyCaloriesEl.innerText = "—";
  }

  updateRemaining();
}

function getLocalCalculatorKey() {
  return "nori_calculator_profile_latest";
}

function saveCalculatorToLocalBackup() {
  try {
    localStorage.setItem(getLocalCalculatorKey(), JSON.stringify(getCalculatorState()));
  } catch (error) {
    console.error("Local calculator save error:", error);
  }
}

function loadCalculatorFromLocalBackup() {
  try {
    const raw = localStorage.getItem(getLocalCalculatorKey());
    if (!raw) return;

    const saved = JSON.parse(raw);
    if (!saved) return;

    applyCalculatorState(saved);
  } catch (error) {
    console.error("Local calculator load error:", error);
  }
}

function getLocalFoodsKey() {
  return "nori_food_logs_" + currentDateKey;
}

function saveFoodsToLocalBackup() {
  try {
    localStorage.setItem(getLocalFoodsKey(), JSON.stringify(foods));
  } catch (error) {
    console.error("Local foods save error:", error);
  }
}

function loadFoodsFromLocalBackup() {
  try {
    const raw = localStorage.getItem(getLocalFoodsKey());
    if (!raw) return false;

    const savedFoods = JSON.parse(raw);
    if (!Array.isArray(savedFoods)) return false;

    foods = savedFoods.map(function (item) {
      return {
        id: item.id || makeTempId(),
        food_name: item.food_name || "",
        calories: Number(item.calories || 0),
        source_type: item.source_type || "manual",
        synced: Boolean(item.synced),
        fdc_id: item.fdc_id || null
      };
    });

    consumedCalories = foods.reduce(function (sum, item) {
      return sum + Number(item.calories || 0);
    }, 0);

    renderFoods();
    updateRemaining();
    return true;
  } catch (error) {
    console.error("Local foods load error:", error);
    return false;
  }
}

async function searchFoodLibrary(query) {
  if (!foodSearchEl || !foodSearchResultsEl) return;

  if (!window.sb || !resolvedFoodLibraryCaloriesColumn) {
    foodSearchResultsEl.innerHTML = "";
    return;
  }

  try {
    const safeQuery = query.replace(/,/g, " ").trim();

    const selectColumns = [
      "id",
      "food_name",
      resolvedFoodLibraryCaloriesColumn
    ];

    if (resolvedFoodLibraryBrandColumn) {
      selectColumns.push(resolvedFoodLibraryBrandColumn);
    }

    if (resolvedFoodLibraryCategoryColumn) {
      selectColumns.push(resolvedFoodLibraryCategoryColumn);
    }

    if (resolvedFoodLibraryFdcIdColumn) {
      selectColumns.push(resolvedFoodLibraryFdcIdColumn);
    }

    const orParts = [`food_name.ilike.%${safeQuery}%`];

    if (resolvedFoodLibraryBrandColumn) {
      orParts.push(`${resolvedFoodLibraryBrandColumn}.ilike.%${safeQuery}%`);
    }

    if (resolvedFoodLibraryCategoryColumn) {
      orParts.push(`${resolvedFoodLibraryCategoryColumn}.ilike.%${safeQuery}%`);
    }

    const result = await window.sb
      .from("calorie_food_library")
      .select(selectColumns.join(","))
      .or(orParts.join(","))
      .order("food_name", { ascending: true })
      .limit(20);

    if (result?.error) {
      console.error("Food library search error:", result.error);
      foodSearchResultsEl.innerHTML = "";
      return;
    }

    const rows = result?.data || [];

    if (!rows.length) {
      foodSearchResultsEl.innerHTML = `<div class="food-search-empty">No matches found.</div>`;
      return;
    }

    foodSearchResultsEl.innerHTML = rows.map(function (item) {
      const caloriesValue = Number(item[resolvedFoodLibraryCaloriesColumn] || 0);
      const brandValue = resolvedFoodLibraryBrandColumn ? item[resolvedFoodLibraryBrandColumn] : "";
      const categoryValue = resolvedFoodLibraryCategoryColumn ? item[resolvedFoodLibraryCategoryColumn] : "";

      const brandText = brandValue ? ` | ${escapeHtml(brandValue)}` : "";
      const categoryText = categoryValue ? ` | ${escapeHtml(categoryValue)}` : "";

      return `
        <div class="food-search-item" data-id="${item.id}">
          ${escapeHtml(item.food_name)}${brandText}${categoryText} — ${caloriesValue} kcal
        </div>
      `;
    }).join("");

    const itemButtons = foodSearchResultsEl.querySelectorAll(".food-search-item");

    itemButtons.forEach(function (itemEl, index) {
      itemEl.addEventListener("click", function () {
        const item = rows[index];
        selectedFoodLibraryItem = item;

        if (foodSearchEl) {
          foodSearchEl.value = item.food_name;
        }

        foodNameEl.value = item.food_name;
        foodCaloriesEl.value = Number(item[resolvedFoodLibraryCaloriesColumn] || 0);
        foodSearchResultsEl.innerHTML = "";
      });
    });
  } catch (error) {
    console.error("Food library search error:", error);
    foodSearchResultsEl.innerHTML = "";
  }
}

async function addFood() {
  const name = String(foodNameEl.value || "").trim();
  const calories = Number(foodCaloriesEl.value || 0);

  if (!name || !calories) return;

  const newFood = {
    id: makeTempId(),
    food_name: name,
    calories: calories,
    source_type: selectedFoodLibraryItem ? "library" : "manual",
    synced: false,
    fdc_id: selectedFoodLibraryItem && resolvedFoodLibraryFdcIdColumn
      ? selectedFoodLibraryItem[resolvedFoodLibraryFdcIdColumn] || null
      : null
  };

  foods.push(newFood);
  consumedCalories += calories;

  renderFoods();
  updateRemaining();
  saveFoodsToLocalBackup();

  await saveFoodLog(newFood);

  if (foodSearchEl) {
    foodSearchEl.value = "";
  }

  foodNameEl.value = "";
  foodCaloriesEl.value = "";
  selectedFoodLibraryItem = null;

  if (foodSearchResultsEl) {
    foodSearchResultsEl.innerHTML = "";
  }
}

function makeTempId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return "temp_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
}

async function saveFoodLog(food) {
  if (!window.sb || !currentUserId) {
    saveFoodsToLocalBackup();
    return;
  }

  const dateColumn = resolvedFoodDateColumn || "log_date";

  try {
    const insertPayload = {
      user_id: currentUserId,
      food_name: food.food_name,
      calories: food.calories,
      source_type: food.source_type,
      ...buildDatePayload(dateColumn, currentDateKey)
    };

    const result = await window.sb
      .from("calorie_food_logs")
      .insert(insertPayload)
      .select("id")
      .single();

    if (result?.error) {
      console.error("Save food error:", result.error);
      saveFoodsToLocalBackup();
      return;
    }

    if (result?.data?.id) {
      food.id = result.data.id;
      food.synced = true;
      saveFoodsToLocalBackup();
      renderFoods();
    }
  } catch (error) {
    console.error("Save food error:", error);
    saveFoodsToLocalBackup();
  }
}

async function syncUnsyncedLocalFoods() {
  if (!window.sb || !currentUserId) return;

  const dateColumn = resolvedFoodDateColumn || "log_date";

  const unsyncedFoods = foods.filter(function (food) {
    return !food.synced;
  });

  for (const food of unsyncedFoods) {
    try {
      const insertPayload = {
        user_id: currentUserId,
        food_name: food.food_name,
        calories: food.calories,
        source_type: food.source_type,
        ...buildDatePayload(dateColumn, currentDateKey)
      };

      const result = await window.sb
        .from("calorie_food_logs")
        .insert(insertPayload)
        .select("id")
        .single();

      if (result?.error) {
        console.error("Unsynced food save error:", result.error);
        continue;
      }

      if (result?.data?.id) {
        food.id = result.data.id;
        food.synced = true;
      }
    } catch (error) {
      console.error("Unsynced food save error:", error);
    }
  }

  saveFoodsToLocalBackup();
  renderFoods();
}

async function loadSavedFoods() {
  const hadLocalFoods = loadFoodsFromLocalBackup();
  const dateColumn = resolvedFoodDateColumn || "log_date";

  if (!window.sb || !currentUserId) {
    if (!hadLocalFoods) {
      foods = [];
      consumedCalories = 0;
      renderFoods();
      updateRemaining();
    }
    return;
  }

  try {
    const result = await window.sb
      .from("calorie_food_logs")
      .select("id, food_name, calories, source_type")
      .eq("user_id", currentUserId)
      .eq(dateColumn, currentDateKey)
      .order("created_at", { ascending: true });

    if (result?.error) {
      console.error("Load foods error:", result.error);
      return;
    }

    const rows = result?.data || [];

    if (rows.length > 0) {
      foods = rows.map(function (row) {
        return {
          id: row.id,
          food_name: row.food_name,
          calories: Number(row.calories || 0),
          source_type: row.source_type || "manual",
          synced: true,
          fdc_id: null
        };
      });

      consumedCalories = foods.reduce(function (sum, item) {
        return sum + Number(item.calories || 0);
      }, 0);

      saveFoodsToLocalBackup();
      renderFoods();
      updateRemaining();
    } else if (!hadLocalFoods) {
      foods = [];
      consumedCalories = 0;
      renderFoods();
      updateRemaining();
      saveFoodsToLocalBackup();
    } else {
      await syncUnsyncedLocalFoods();
    }
  } catch (error) {
    console.error("Load foods error:", error);
  }
}

async function removeFood(foodId) {
  const match = foods.find(function (item) {
    return String(item.id) === String(foodId);
  });

  if (!match) return;

  foods = foods.filter(function (item) {
    return String(item.id) !== String(foodId);
  });

  consumedCalories = foods.reduce(function (sum, item) {
    return sum + Number(item.calories || 0);
  }, 0);

  renderFoods();
  updateRemaining();
  saveFoodsToLocalBackup();

  if (!window.sb || !currentUserId) return;
  if (!match.synced) return;

  try {
    const result = await window.sb
      .from("calorie_food_logs")
      .delete()
      .eq("id", match.id);

    if (result?.error) {
      console.error("Delete food error:", result.error);
    }
  } catch (error) {
    console.error("Delete food error:", error);
  }
}

function renderFoods() {
  if (!foods.length) {
    foodListEl.innerHTML = `<div class="food-item-empty">No foods logged yet.</div>`;
    consumedEl.innerText = "0";
    return;
  }

  foodListEl.innerHTML = foods.map(function (food) {
    const sourceLabel = food.source_type === "library" ? "Food Library" : "Manual Entry";

    return `
      <div class="food-item">
        <div class="food-item-main">
          <span class="food-item-name">${escapeHtml(food.food_name)}</span>
          <span class="food-item-meta">${sourceLabel}</span>
        </div>
        <div class="food-item-right">
          <span>${Number(food.calories || 0)} kcal</span>
          <button type="button" class="food-delete-btn" data-food-id="${escapeHtml(String(food.id))}">Delete</button>
        </div>
      </div>
    `;
  }).join("");

  const deleteButtons = foodListEl.querySelectorAll(".food-delete-btn");

  deleteButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const foodId = button.getAttribute("data-food-id");
      removeFood(foodId);
    });
  });

  consumedEl.innerText = String(consumedCalories);
}

function updateRemaining() {
  const remaining = Math.max(dailyCalories - consumedCalories, 0);
  remainingEl.innerText = String(remaining);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}