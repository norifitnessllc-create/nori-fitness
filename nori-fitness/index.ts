import Stripe from "stripe";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!stripeSecretKey) throw new Error("Missing STRIPE_SECRET_KEY");
if (!supabaseUrl) throw new Error("Missing SUPABASE_URL");
if (!serviceRoleKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-12-15.clover" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://nori-fitness.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type OnlineSubscriptionRow = {
  user_id: string;
  plan: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  commitment_end_date: string | null;
  stripe_subscription_id: string | null;
  stripe_session_id?: string | null;
  cancel_at_period_end?: boolean | null;
  cancel_requested_at?: string | null;
  canceled_effective_date?: string | null;
};

type InpersonSubscriptionRow = {
  user_id: string;
  sessions_per_week: number | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  commitment_end_date: string | null;
  plan_code: string | null;
  stripe_subscription_id: string | null;
  stripe_session_id?: string | null;
  cancel_at_period_end?: boolean | null;
  cancel_requested_at?: string | null;
  canceled_effective_date?: string | null;
};

function safeLower(v: unknown) {
  return String(v ?? "").toLowerCase().trim();
}

function stripeIdFrom(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value !== null && "id" in (value as any)) {
    return String((value as any).id || "").trim();
  }
  return "";
}

// Basil/Clover moved current_period_end off the subscription and onto each
// subscription item. Fall back to the root field for older API versions.
function currentPeriodEndUnix(sub: any) {
  const item = sub?.items?.data?.[0];
  const end = Number(item?.current_period_end ?? sub?.current_period_end ?? 0);
  return Number.isFinite(end) && end > 0 ? end : 0;
}

// Subscriptions created before the webhook started storing
// stripe_subscription_id can still be recovered from the checkout session that
// created them.
async function subscriptionIdFromCheckoutSession(sessionId: string) {
  if (!sessionId) return "";

  try {
    const cs = await stripe.checkout.sessions.retrieve(sessionId);
    return stripeIdFrom((cs as any).subscription);
  } catch (err) {
    console.error("Could not resolve subscription from checkout session:", err);
    return "";
  }
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isISODateString(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
}

function todayISO() {
  return toISODate(new Date());
}

function isBeforeCommitmentEnd(today: string, commitmentEnd: string | null | undefined) {
  if (!commitmentEnd || !isISODateString(commitmentEnd)) return false;
  return today < commitmentEnd;
}

async function sbGet(path: string) {
  return await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
}

async function sbPatch(path: string, body: unknown, prefer = "return=minimal") {
  return await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: JSON.stringify(body),
  });
}

async function getAuthedUser(authorization: string) {
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: authorization,
    },
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Auth failed: ${res.status} ${txt}`);
  }

  return await res.json();
}

async function getLatestOnlineSubscription(userId: string): Promise<OnlineSubscriptionRow | null> {
  const res = await sbGet(
    `subscriptions?select=user_id,plan,status,start_date,end_date,commitment_end_date,stripe_subscription_id,stripe_session_id,cancel_at_period_end,cancel_requested_at,canceled_effective_date&user_id=eq.${userId}&order=start_date.desc&limit=1`
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Could not load online subscription: ${res.status} ${txt}`);
  }

  const rows = (await res.json()) as OnlineSubscriptionRow[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function getInpersonSubscription(userId: string): Promise<InpersonSubscriptionRow | null> {
  const res = await sbGet(
    `inperson_subscriptions?select=user_id,sessions_per_week,status,start_date,end_date,commitment_end_date,plan_code,stripe_subscription_id,stripe_session_id,cancel_at_period_end,cancel_requested_at,canceled_effective_date&user_id=eq.${userId}&limit=1`
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Could not load in-person subscription: ${res.status} ${txt}`);
  }

  const rows = (await res.json()) as InpersonSubscriptionRow[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function cancelStripeSubscriptionAtPeriodEnd(subscriptionId: string) {
  const sub = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });

  return sub;
}

async function patchOnlineCancellation(userId: string, endDate: string | null) {
  const res = await sbPatch(
    `subscriptions?user_id=eq.${userId}`,
    {
      status: "canceling",
      cancel_at_period_end: true,
      cancel_requested_at: new Date().toISOString(),
      canceled_effective_date: endDate || null,
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Could not update online subscription row: ${res.status} ${txt}`);
  }
}

async function patchInpersonCancellation(userId: string, endDate: string | null) {
  const res = await sbPatch(
    `inperson_subscriptions?user_id=eq.${userId}`,
    {
      status: "canceling",
      cancel_at_period_end: true,
      cancel_requested_at: new Date().toISOString(),
      canceled_effective_date: endDate || null,
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Could not update in-person subscription row: ${res.status} ${txt}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("POST only", {
        status: 405,
        headers: corsHeaders,
      });
    }

    const authorization = req.headers.get("authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization header." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Bad JSON body." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const kind = safeLower(body.kind || body.type || "");
    if (kind !== "online" && kind !== "inperson") {
      return new Response(JSON.stringify({ error: 'kind must be "online" or "inperson".' }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = await getAuthedUser(authorization);
    const userId = String(user?.id || "").trim();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Could not identify user." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = todayISO();

    if (kind === "online") {
      const row = await getLatestOnlineSubscription(userId);

      if (!row) {
        return new Response(JSON.stringify({ error: "No online subscription found." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isBeforeCommitmentEnd(today, row.commitment_end_date)) {
        return new Response(
          JSON.stringify({
            error: `You cannot cancel yet. Your minimum commitment ends on ${row.commitment_end_date}.`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      let stripeSubscriptionId = String(row.stripe_subscription_id || "").trim();

      if (!stripeSubscriptionId) {
        stripeSubscriptionId = await subscriptionIdFromCheckoutSession(
          String(row.stripe_session_id || "").trim()
        );

        if (stripeSubscriptionId) {
          await sbPatch(`subscriptions?user_id=eq.${userId}`, {
            stripe_subscription_id: stripeSubscriptionId,
          });
        }
      }

      if (!stripeSubscriptionId) {
        return new Response(JSON.stringify({ error: "No Stripe subscription found for this plan." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updated = await cancelStripeSubscriptionAtPeriodEnd(stripeSubscriptionId);
      const periodEndUnix = currentPeriodEndUnix(updated as any);
      const effectiveDate = periodEndUnix
        ? toISODate(new Date(periodEndUnix * 1000))
        : row.end_date || null;

      await patchOnlineCancellation(userId, effectiveDate);

      return new Response(
        JSON.stringify({
          ok: true,
          kind: "online",
          message: effectiveDate
            ? `Your online subscription will end on ${effectiveDate}.`
            : "Your online subscription will end at the end of the current billing period.",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const row = await getInpersonSubscription(userId);

    if (!row) {
      return new Response(JSON.stringify({ error: "No in-person subscription found." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (isBeforeCommitmentEnd(today, row.commitment_end_date)) {
      return new Response(
        JSON.stringify({
          error: `You cannot cancel yet. Your minimum commitment ends on ${row.commitment_end_date}.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let stripeSubscriptionId = String(row.stripe_subscription_id || "").trim();

    if (!stripeSubscriptionId) {
      stripeSubscriptionId = await subscriptionIdFromCheckoutSession(
        String(row.stripe_session_id || "").trim()
      );

      if (stripeSubscriptionId) {
        await sbPatch(`inperson_subscriptions?user_id=eq.${userId}`, {
          stripe_subscription_id: stripeSubscriptionId,
        });
      }
    }

    if (!stripeSubscriptionId) {
      return new Response(JSON.stringify({ error: "No Stripe subscription found for this plan." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updated = await cancelStripeSubscriptionAtPeriodEnd(stripeSubscriptionId);
    const periodEndUnix = currentPeriodEndUnix(updated as any);
    const effectiveDate = periodEndUnix
      ? toISODate(new Date(periodEndUnix * 1000))
      : row.end_date || null;

    await patchInpersonCancellation(userId, effectiveDate);

    return new Response(
      JSON.stringify({
        ok: true,
        kind: "inperson",
        message: effectiveDate
          ? `Your in-person subscription will end on ${effectiveDate}.`
          : "Your in-person subscription will end at the end of the current billing period.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});