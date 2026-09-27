// supabase.js
const SUPABASE_URL = "https://rsogerenyorczxbpyzmb.supabase.co";
const SUPABASE_KEY = "sb_publishable_gd-5K8F8H48YIYM1XKIkVQ_Yu5qwdvI";

if (!window.supabase) {
  console.error("Supabase library did not load.");
} else {
  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
    },
  });

  console.log("Supabase client initialized.");
}