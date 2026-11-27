import { headers } from "next/headers";

/**
 * Envoi d'e-mails transactionnels (vérification d'adresse, mot de passe oublié).
 * Fournisseur choisi par la variable présente : RESEND_API_KEY ou BREVO_API_KEY.
 * Sans fournisseur : en développement le lien est écrit dans la console du serveur,
 * en production rien n'est envoyé (et la vérification n'est pas exigée, voir requireVerified).
 */
export type EmailMessage = { to: string; subject: string; text: string; html: string };

export function emailProvider(): "resend" | "brevo" | "console" | "none" {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.BREVO_API_KEY) return "brevo";
  return process.env.NODE_ENV === "production" ? "none" : "console";
}

function sender() {
  const from = process.env.EMAIL_FROM ?? "Upclose <onboarding@resend.dev>";
  const m = from.match(/^(.*)<(.+)>$/);
  return m ? { name: m[1].trim() || "Upclose", email: m[2].trim() } : { name: "Upclose", email: from.trim() };
}

/** Pour les tests : derniers messages « envoyés » quand le fournisseur est la console. */
export const outbox: EmailMessage[] = [];

export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const provider = emailProvider();
  try {
    if (provider === "resend") {
      const from = sender();
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: `${from.name} <${from.email}>`, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
      });
      if (!res.ok) {
        // Le message de Resend (ex. « testing emails only to your own address ») aide à comprendre ; il ne contient pas le destinataire.
        const body = (await res.json().catch(() => ({}))) as { name?: string; message?: string };
        throw new Error(`Resend ${res.status} ${body.name ?? ""} ${(body.message ?? "").replace(/[^\s@]+@[^\s@]+/g, "<adresse>")}`.trim());
      }
      return true;
    }
    if (provider === "brevo") {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY!, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ sender: sender(), to: [{ email: msg.to }], subject: msg.subject, textContent: msg.text, htmlContent: msg.html }),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}`);
      return true;
    }
    if (provider === "console") {
      outbox.push(msg);
      if (outbox.length > 20) outbox.shift();
      if (process.env.NODE_ENV !== "test") console.info(`[email] À ${msg.to} — ${msg.subject}\n${msg.text}`);
      return true;
    }
    return false;
  } catch (e) {
    // Jamais l'adresse ni le jeton dans les journaux.
    console.error("[email] envoi en échec", (e as Error).message);
    return false;
  }
}

/** URL publique de l'app, pour les liens envoyés par e-mail. */
/**
 * Adresse utilisée dans les liens : celle de la requête si elle fait partie des adresses connues
 * (APP_URL, upclose-en.vercel.app, ou la liste PUBLIC_HOSTS), sinon APP_URL.
 * Jamais un hôte arbitraire : un lien de réinitialisation ne doit pas pointer vers un autre site.
 */
export async function publicBaseUrl(): Promise<string> {
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const allowed = new Set(["upclose.world", "upclose-en.vercel.app", "en.upclose.world", ...(process.env.PUBLIC_HOSTS ?? "").split(",").map((x) => x.trim()).filter(Boolean)]);
    if (appUrl) allowed.add(new URL(appUrl).host);
    if (!appUrl || allowed.has(host)) return `${proto}://${host}`;
    return appUrl;
  } catch {
    return appUrl ?? "http://localhost:3000";
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Logo des e-mails : PNG (beaucoup de messageries n'affichent pas le SVG), toujours sur l'adresse principale. */
const EMAIL_LOGO_URL = "https://upclose.world/brand/upclose-logo-email.png";
const EMAIL_LOGO_W = 128;

/** Gabarit simple et lisible partout (clients mail sans CSS compris). */
export function actionEmail(opts: {
  to: string;
  subject: string;
  greeting: string;
  intro: string;
  cta: string;
  url: string;
  outro: string;
  fallback?: string;
  lang?: string;
}): EmailMessage {
  const fallback = opts.fallback ?? "Si le bouton ne marche pas, copie ce lien :";
  const text = `${opts.greeting}\n\n${opts.intro}\n\n${opts.cta} : ${opts.url}\n\n${opts.outro}\n\n— Upclose`;
  const html = `<!doctype html><html lang="${opts.lang ?? "fr"}"><body style="margin:0;background:#FAF6F0;font-family:Helvetica,Arial,sans-serif;color:#1D1626">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;padding:32px">
<tr><td style="padding-bottom:20px"><img src="${EMAIL_LOGO_URL}" width="${EMAIL_LOGO_W}" height="36" alt="Upclose" style="display:block;border:0"></td></tr>
<tr><td style="font-size:16px;line-height:1.5;padding-bottom:8px">${escapeHtml(opts.greeting)}</td></tr>
<tr><td style="font-size:16px;line-height:1.5;padding-bottom:24px">${escapeHtml(opts.intro)}</td></tr>
<tr><td style="padding-bottom:24px"><a href="${escapeHtml(opts.url)}" style="display:inline-block;background:#D93D74;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:999px">${escapeHtml(opts.cta)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#6E6578">${escapeHtml(opts.outro)}<br><br>${escapeHtml(fallback)} ${escapeHtml(opts.url)}</td></tr>
</table></td></tr></table></body></html>`;
  return { to: opts.to, subject: opts.subject, text, html };
}
