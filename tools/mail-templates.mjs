// Lumière - E-Mail-Vorlagen fuer Supabase (Build 31), im selben Nacht-und-
// Gold-Look wie die Brevo-Mails der Edge Function (dieselbe layout()-Hülle,
// hier nur ohne TypeScript). Erzeugt supabase/templates/*.html zum Einfügen
// unter Supabase -> Authentication -> Email Templates, dazu eine
// Vorschau-Seite mit allen Mails (tools/mail-preview.html).
//   node tools/mail-templates.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
const SITE = 'https://vokabeln.stoneuniverse.de';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(title, intro, rows, note, cta, opts = {}) {
  const url = opts.url || SITE;
  const table = rows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 4px;border:1px solid #4a3d22;border-radius:14px;background:#0f131c;">
        ${rows.map(([k, v], i) => `<tr><td style="padding:13px 18px;${i ? "border-top:1px solid #232834;" : ""}font:11px/1.4 Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#a79c88;">${esc(k)}</td><td align="right" style="padding:13px 18px;${i ? "border-top:1px solid #232834;" : ""}font:600 15px/1.4 Georgia,'Times New Roman',serif;color:#f6e7c1;">${esc(v)}</td></tr>`).join("")}
      </table>`
    : "";
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#07090e;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07090e;background-image:radial-gradient(ellipse at top,#1a1830 0%,#07090e 60%);padding:36px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;">
      <tr><td align="center" style="padding:0 0 18px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" width="58" height="58" style="width:58px;height:58px;border-radius:50%;background:#d9a548;background-image:linear-gradient(135deg,#ffe3a1,#d69a45 55%,#8a5a1c);border:1px solid #f6d58a;box-shadow:0 0 24px rgba(246,195,92,.45);font:italic 600 28px/58px Georgia,'Times New Roman',serif;color:#1c1207;">L</td></tr></table>
        <div style="margin:12px 0 0;font:italic 600 30px/1 Georgia,'Times New Roman',serif;color:#f2c878;letter-spacing:-.01em;">Lumière</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px auto 0;"><tr>
          <td width="70" style="border-top:1px solid #7a6030;font-size:0;line-height:0;">&nbsp;</td>
          <td style="padding:0 10px;font:10px/1 Georgia,serif;color:#f2c878;">&#9670;</td>
          <td width="70" style="border-top:1px solid #7a6030;font-size:0;line-height:0;">&nbsp;</td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#121722;background-image:linear-gradient(180deg,#171d2b 0%,#10141d 100%);border:1px solid #3d321c;border-radius:22px;padding:34px 32px 34px;">
        ${opts.kicker ? `<p style="margin:0 0 10px;font:11px/1.4 Menlo,Consolas,monospace;letter-spacing:.3em;text-transform:uppercase;color:#f2c878;">${esc(opts.kicker)}</p>` : ""}
        <h1 style="margin:0 0 14px;font:italic 600 27px/1.2 Georgia,'Times New Roman',serif;color:#fbf3e1;">${esc(title)}</h1>
        <p style="margin:0;font:15px/1.7 Helvetica,Arial,sans-serif;color:#ddd4c3;">${intro}</p>
        ${table}
        ${note ? `<p style="margin:18px 0 0;font:13.5px/1.65 Helvetica,Arial,sans-serif;color:#a79c88;">${note}</p>` : ""}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;"><tr><td style="border-radius:999px;background:#f0c469;background-image:linear-gradient(180deg,#ffe0a0,#e2a94c);box-shadow:0 6px 22px rgba(240,196,105,.35);">
          <a href="${url}" style="display:inline-block;padding:14px 30px;font:700 12.5px Helvetica,Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#1a1406;text-decoration:none;">${esc(cta)}</a>
        </td></tr></table>
      </td></tr>
      <tr><td align="center" style="padding:22px 10px 0;">
        <p style="margin:0;font:11px/1.7 Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;color:#6d6555;">Lumière · Deutsch ↔ Französisch</p>
        <p style="margin:6px 0 0;font:12px/1.6 Helvetica,Arial,sans-serif;color:#5d5648;">Du bekommst diese Mail, weil du ein Konto bei <a href="${SITE}" style="color:#a0874f;text-decoration:none;">vokabeln.stoneuniverse.de</a> hast.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}


const T = {
  confirmation: {
    subject: 'Bestätige deine E-Mail für Lumière',
    html: layout('Bestätige deine E-Mail', 'Schön, dass du da bist! Ein Klick noch, dann ist dein Konto bereit – deine Lernsets wandern ab dann von selbst auf alle deine Geräte.',
      [], 'Du hast dich nicht bei Lumière registriert? Dann ignoriere diese Mail einfach, es passiert nichts.', 'E-Mail bestätigen',
      { kicker: 'Willkommen', url: '{{ .ConfirmationURL }}' }),
  },
  invite: {
    subject: 'Du bist zu Lumière eingeladen',
    html: layout('Du bist eingeladen', 'Jemand hat dich zu Lumière eingeladen – dem Vokabeltrainer für Deutsch und Französisch, den du mit deinem eigenen Stoff füllst.',
      [], 'Über den Knopf legst du dein Passwort fest und kannst sofort loslegen.', 'Einladung annehmen',
      { kicker: 'Einladung', url: '{{ .ConfirmationURL }}' }),
  },
  magic_link: {
    subject: 'Dein Anmelde-Link für Lumière',
    html: layout('Dein Anmelde-Link', 'Mit diesem Knopf meldest du dich ohne Passwort bei Lumière an. Der Link gilt nur kurz und nur einmal.',
      [], 'Du wolltest dich gar nicht anmelden? Dann ignoriere diese Mail – dein Konto bleibt sicher.', 'Jetzt anmelden',
      { kicker: 'Anmelden', url: '{{ .ConfirmationURL }}' }),
  },
  email_change: {
    subject: 'Bestätige deine neue E-Mail-Adresse',
    html: layout('Neue E-Mail-Adresse bestätigen', 'Du möchtest die Adresse deines Lumière-Kontos ändern. Bitte bestätige den Wechsel mit einem Klick.',
      [['Bisher', '{{ .Email }}'], ['Neu', '{{ .NewEmail }}']], 'Das warst nicht du? Dann ignoriere diese Mail und ändere zur Sicherheit dein Passwort in „Mein Konto“.', 'Wechsel bestätigen',
      { kicker: 'E-Mail ändern', url: '{{ .ConfirmationURL }}' }),
  },
  recovery: {
    subject: 'Neues Passwort für Lumière',
    html: layout('Neues Passwort wählen', 'Du hast ein neues Passwort angefordert. Über den Knopf legst du es fest – dein bisheriges Passwort gilt so lange weiter.',
      [], 'Der Link gilt nur kurz. Ist er abgelaufen, fordere auf der Anmeldeseite einfach einen neuen an. Du hast nichts angefordert? Dann ignoriere diese Mail.', 'Passwort festlegen',
      { kicker: 'Passwort', url: '{{ .ConfirmationURL }}' }),
  },
  reauthentication: {
    subject: 'Dein Bestätigungscode für Lumière',
    html: layout('Dein Bestätigungscode', 'Gib diesen Code in Lumière ein, um die Änderung zu bestätigen:',
      [['Code', '{{ .Token }}']], 'Der Code gilt nur kurz. Du hast nichts angefordert? Dann ignoriere diese Mail.', 'Zu Lumière',
      { kicker: 'Sicherheit' }),
  },
};
mkdirSync('supabase/templates', { recursive: true });
let subjects = '';
for (const [k, v] of Object.entries(T)) {
  writeFileSync(`supabase/templates/${k}.html`, v.html);
  subjects += `${k}: ${v.subject}\n`;
}
writeFileSync('supabase/templates/BETREFFZEILEN.txt', subjects);
// Vorschau aller Mails (inkl. der drei Brevo-Mails mit Beispielwerten).
const until = '28. Oktober 2026';
const brevo = {
  'Tarif freigeschaltet (Brevo)': layout('Plus ist freigeschaltet', 'Hallo Léa, deine Anfrage ist durch – ab sofort hast du mehr KI-Anfragen für Beispielsätze, Erklärungen und die Grammatik-Hilfe.',
    [['Tarif', 'Plus'], ['KI-Anfragen', '200 pro Tag'], ['Laufzeit', '1 Monat'], ['Gültig bis', until], ['Betrag', '2,99 €']],
    'Kurz vor Ablauf erinnern wir dich per E-Mail. Danach gilt automatisch wieder der Gratis-Tarif – nichts verlängert sich ohne deine Zustimmung.', 'Zu Lumière', { kicker: 'Tarif freigeschaltet' }),
  'Tarif abgelehnt (Brevo)': layout('Deine Anfrage für Plus', 'Hallo Léa, danke für dein Interesse an Plus.', [], 'Leider können wir deine Anfrage gerade nicht freischalten. Dein Konto bleibt unverändert im Gratis-Tarif – du kannst jederzeit erneut anfragen.', 'Zu Lumière', { kicker: 'Deine Anfrage' }),
  'Tarif läuft bald ab (Brevo)': layout('Plus läuft bald ab', `Hallo Léa, dein Tarif Plus gilt noch bis <strong style="color:#f2c878;">${until}</strong>. Danach gilt automatisch wieder der Gratis-Tarif.`,
    [['Tarif', 'Plus'], ['Gültig bis', until]], 'Möchtest du verlängern? Frag in „Mein Konto“ einfach erneut an – wir melden uns.', 'Zu Mein Konto', { kicker: 'Erinnerung' }),
};
const all = { ...brevo, ...Object.fromEntries(Object.entries(T).map(([k, v]) => [v.subject + ' (Supabase)', v.html])) };
writeFileSync('tools/mail-preview.html', '<!doctype html><meta charset="utf-8"><title>Mail-Vorschau</title><body style="margin:0;background:#222;font:14px sans-serif;color:#ccc">' +
  Object.entries(all).map(([n, h]) => `<h2 style="padding:18px 20px 6px;margin:0">${esc(n)}</h2><iframe style="width:100%;height:760px;border:0" srcdoc="${esc(h)}"></iframe>`).join('') + '</body>');
console.log('ok', Object.keys(T).length, 'Vorlagen');
