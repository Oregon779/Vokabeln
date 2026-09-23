// Lumière - Mails zu Tarif-Anfragen (Build 23), verschickt ueber die Brevo-API.
//
//   { kind: "decision", request_id }  -> Mail "angenommen" bzw. "abgelehnt".
//                                        Nur fuer Admins (Bearer-Token der Sitzung).
//   { kind: "reminders" }             -> Erinnerung 3 Tage vor Ablauf. Kommt taeglich
//                                        per pg_cron, geschuetzt ueber x-cron-secret.
//
// Secrets (Supabase -> Edge Functions -> Secrets):
//   BREVO_API_KEY  xkeysib-...           (Pflicht)
//   CRON_SECRET    lange Zufallszeichenkette, dieselbe wie im SQL (Pflicht)
//   MAIL_FROM      noreply@stoneuniverse.de (optional, das ist der Standard)
//   MAIL_REPLY_TO  Adresse fuer Antworten (optional)
// "Verify JWT" fuer diese Funktion AUS - sie prueft selbst.

import { createClient } from "npm:@supabase/supabase-js@2";

const SITE = "https://vokabeln.stoneuniverse.de";
const PLANS: Record<string, { name: string; limit: number; cents: number }> = {
  plus: { name: "Plus", limit: 200, cents: 299 },
  pro: { name: "Pro", limit: 1000, cents: 599 },
};
const DEFAULT_REJECT =
  "Leider können wir deine Anfrage gerade nicht freischalten. Dein Konto bleibt unverändert im Gratis-Tarif – du kannst jederzeit erneut anfragen.";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-cron-secret",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const date = (iso: string) =>
  new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Berlin" });
const euro = (cents: number) => (cents / 100).toFixed(2).replace(".", ",") + " €";

// Dunkel/Gold wie die Seite. Tabellen + Inline-Styles, damit es auch in
// Outlook und Gmail steht.
function layout(title: string, intro: string, rows: [string, string][], note: string, cta: string) {
  const table = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;border:1px solid #3a3222;border-radius:12px;background:#11151d;">
        ${rows.map(([k, v], i) => `<tr><td style="padding:12px 16px;${i ? "border-top:1px solid #262a33;" : ""}font:12px/1.4 Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:#a79c88;">${esc(k)}</td><td align="right" style="padding:12px 16px;${i ? "border-top:1px solid #262a33;" : ""}font:600 15px/1.4 Helvetica,Arial,sans-serif;color:#f6f2e9;">${esc(v)}</td></tr>`).join("")}
      </table>`
    : "";
  return `<!doctype html><html lang="de"><body style="margin:0;padding:0;background:#0b0e14;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0e14;padding:32px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141922;border:1px solid #2c2618;border-radius:20px;">
      <tr><td style="padding:30px 30px 0;text-align:center;font:italic 600 26px Georgia,'Times New Roman',serif;color:#f6c35c;">Lumière</td></tr>
      <tr><td style="padding:6px 30px 0;text-align:center;"><div style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#f6c35c;"></div></td></tr>
      <tr><td style="padding:22px 30px 30px;">
        <h1 style="margin:0 0 12px;font:600 24px/1.25 Georgia,'Times New Roman',serif;color:#f6f2e9;">${esc(title)}</h1>
        <p style="margin:0;font:15px/1.6 Helvetica,Arial,sans-serif;color:#d9d3c7;">${intro}</p>
        ${table}
        ${note ? `<p style="margin:16px 0 0;font:14px/1.6 Helvetica,Arial,sans-serif;color:#a79c88;">${note}</p>` : ""}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 0;"><tr><td style="border-radius:999px;background:#f0c469;">
          <a href="${SITE}" style="display:inline-block;padding:13px 26px;font:700 13px Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#1a1406;text-decoration:none;">${esc(cta)}</a>
        </td></tr></table>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;font:11px/1.6 Menlo,Consolas,monospace;letter-spacing:.1em;text-transform:uppercase;color:#6d6555;">Lumière · Deutsch ↔ Französisch</p>
  </td></tr></table></body></html>`;
}

async function send(to: string, name: string | null, subject: string, html: string, text: string) {
  const key = Deno.env.get("BREVO_API_KEY");
  if (!key) throw new Error("BREVO_API_KEY fehlt in den Secrets der Funktion");
  const body: Record<string, unknown> = {
    sender: { name: "Lumière", email: Deno.env.get("MAIL_FROM") || "noreply@stoneuniverse.de" },
    to: [{ email: to, ...(name ? { name } : {}) }],
    subject,
    htmlContent: html,
    textContent: text,
  };
  const reply = Deno.env.get("MAIL_REPLY_TO");
  if (reply) body.replyTo = { email: reply };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

async function decisionMail(requestId: string) {
  const { data: r, error } = await admin.from("upgrade_requests").select("*").eq("id", requestId).single();
  if (error || !r) throw new Error("Anfrage nicht gefunden");
  const plan = PLANS[r.plan];
  const { data: p } = await admin.from("profiles").select("email, display_name, plan_until").eq("user_id", r.user_id).single();
  const to = r.email || p?.email;
  if (!to) throw new Error("Keine E-Mail-Adresse zu diesem Konto");
  const who = r.display_name || p?.display_name;
  const hi = who ? `Hallo ${esc(who)}` : "Hallo";

  if (r.status === "erledigt") {
    const until = p?.plan_until ? date(p.plan_until) : "–";
    const rows: [string, string][] = [
      ["Tarif", plan.name],
      ["KI-Anfragen", `${plan.limit} pro Tag`],
      ["Laufzeit", `${r.months || 1} Monat${(r.months || 1) === 1 ? "" : "e"}`],
      ["Gültig bis", until],
    ];
    if (r.price_cents) rows.push(["Betrag", euro(r.price_cents)]);
    const html = layout(
      `${plan.name} ist freigeschaltet`,
      `${hi}, deine Anfrage ist durch – ab sofort hast du mehr KI-Anfragen für Beispielsätze, Erklärungen und die Grammatik-Hilfe.`,
      rows,
      "Kurz vor Ablauf erinnern wir dich per E-Mail. Danach gilt automatisch wieder der Gratis-Tarif – nichts verlängert sich ohne deine Zustimmung.",
      "Zu Lumière",
    );
    const text = `${plan.name} ist freigeschaltet.\n${plan.limit} KI-Anfragen pro Tag, gültig bis ${until}.\n${SITE}`;
    await send(to, r.display_name, `Dein Tarif ${plan.name} ist freigeschaltet`, html, text);
  } else if (r.status === "abgelehnt") {
    const reason = (r.reason || "").trim() || DEFAULT_REJECT;
    const html = layout(
      `Deine Anfrage für ${plan.name}`,
      `${hi}, danke für dein Interesse an ${plan.name}.`,
      [],
      esc(reason).replace(/\n/g, "<br>"),
      "Zu Lumière",
    );
    await send(to, r.display_name, `Deine Anfrage für ${plan.name}`, html, `${reason}\n${SITE}`);
  } else {
    throw new Error("Anfrage ist noch offen");
  }
  await admin.from("upgrade_requests").update({ mail_sent_at: new Date().toISOString(), mail_error: null }).eq("id", requestId);
}

async function reminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 86400000);
  const { data, error } = await admin
    .from("profiles")
    .select("user_id, email, display_name, plan, plan_until, plan_reminded_for")
    .not("plan", "is", null)
    .gt("plan_until", now.toISOString())
    .lte("plan_until", soon.toISOString());
  if (error) throw error;
  let sent = 0;
  for (const p of data || []) {
    if (!p.email || (p.plan_reminded_for && p.plan_reminded_for === p.plan_until)) continue;
    const plan = PLANS[p.plan];
    if (!plan) continue;
    const until = date(p.plan_until);
    const html = layout(
      `${plan.name} läuft bald ab`,
      `${p.display_name ? `Hallo ${esc(p.display_name)}` : "Hallo"}, dein Tarif ${plan.name} gilt noch bis <strong style="color:#f6c35c;">${until}</strong>. Danach gilt automatisch wieder der Gratis-Tarif.`,
      [["Tarif", plan.name], ["Gültig bis", until]],
      "Möchtest du verlängern? Frag in „Mein Konto“ einfach erneut an – wir melden uns.",
      "Zu Mein Konto",
    );
    try {
      await send(p.email, p.display_name, `Dein Tarif ${plan.name} läuft am ${until} ab`, html, `${plan.name} gilt noch bis ${until}.\n${SITE}`);
      await admin.from("profiles").update({ plan_reminded_for: p.plan_until }).eq("user_id", p.user_id);
      sent++;
    } catch (e) {
      console.error("Erinnerung fehlgeschlagen", p.user_id, e);
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST erwartet" }, 405);
  let body: { kind?: string; request_id?: string } = {};
  try { body = await req.json(); } catch { /* leer */ }

  try {
    if (body.kind === "reminders") {
      const secret = Deno.env.get("CRON_SECRET");
      if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "nicht erlaubt" }, 401);
      return json({ ok: true, sent: await reminders() });
    }

    if (body.kind === "decision" && body.request_id) {
      const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const { data: u } = await admin.auth.getUser(token);
      if (!u?.user) return json({ error: "nicht angemeldet" }, 401);
      const { data: me } = await admin.from("profiles").select("is_admin").eq("user_id", u.user.id).single();
      if (!me?.is_admin) return json({ error: "nur für Admins" }, 403);
      try {
        await decisionMail(body.request_id);
      } catch (e) {
        await admin.from("upgrade_requests").update({ mail_error: String((e as Error).message).slice(0, 300) }).eq("id", body.request_id);
        throw e;
      }
      return json({ ok: true });
    }

    return json({ error: "unbekannter Auftrag" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
