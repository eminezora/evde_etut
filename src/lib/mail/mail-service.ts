// Provider-based e-mail sending. Server-only; configuration comes from environment variables:
//   MAIL_PROVIDER = resend | memory   (optional; default: resend when RESEND_API_KEY is set)
//   RESEND_API_KEY, MAIL_FROM          (e.g. "Evde Etüt <bildirim@alanadiniz.com>")
// "memory" keeps messages in an in-process outbox (tests / local development only, never production).
// Message bodies may contain one-time links, so they are never logged.

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailProvider {
  readonly name: string;
  send(message: MailMessage): Promise<void>;
}

export class MailError extends Error {}

/** Messages "sent" with the memory provider (tests read them from here). */
export const memoryOutbox: MailMessage[] = [];

class MemoryProvider implements MailProvider {
  readonly name = "memory";
  async send(message: MailMessage) {
    memoryOutbox.push(message);
  }
}

class ResendProvider implements MailProvider {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: MailMessage) {
    let res: Response;
    try {
      res = await this.fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new MailError("E-posta servisine bağlanılamadı.");
    }
    if (!res.ok) throw new MailError(`E-posta gönderilemedi (HTTP ${res.status}).`);
  }
}

export function getMailProvider(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof fetch): MailProvider | null {
  const provider = env.MAIL_PROVIDER?.trim().toLowerCase();
  if (provider === "memory") return env.NODE_ENV === "production" ? null : new MemoryProvider();
  const key = env.RESEND_API_KEY?.trim();
  const from = env.MAIL_FROM?.trim();
  if ((!provider || provider === "resend") && key && from) return new ResendProvider(key, from, fetchImpl);
  return null;
}

/** Public base URL for links in e-mails: APP_URL, else the request's own origin. */
export function appBaseUrl(env: NodeJS.ProcessEnv = process.env, requestOrigin?: string) {
  const fromEnv = env.APP_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  return (requestOrigin ?? "http://localhost:3000").replace(/\/+$/, "");
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function passwordResetEmail(to: string, name: string, link: string): MailMessage {
  const safeName = escapeHtml(name);
  const safeLink = escapeHtml(link);
  return {
    to,
    subject: "Evde Etüt – Şifre Sıfırlama",
    text: [
      `Merhaba ${name},`,
      "",
      "Evde Etüt hesabınız için şifre sıfırlama talebi aldık. Yeni şifrenizi belirlemek için aşağıdaki bağlantıyı açın:",
      link,
      "",
      "Bu bağlantı 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir.",
      "Bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz; şifreniz değişmez.",
      "",
      "Evde Etüt",
    ].join("\n"),
    html: `<!doctype html><html lang="tr"><body style="margin:0;background:#f6f8fb;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:32px">
<tr><td>
<p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1e293b">Evde Etüt</p>
<p style="margin:0 0 12px;font-size:16px">Merhaba ${safeName},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.6">Evde Etüt hesabınız için şifre sıfırlama talebi aldık. Yeni şifrenizi belirlemek için aşağıdaki butona tıklayın.</p>
<p style="margin:0 0 24px"><a href="${safeLink}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px">Şifremi Sıfırla</a></p>
<p style="margin:0 0 8px;font-size:14px;color:#475569">Bu bağlantı <strong>30 dakika</strong> geçerlidir ve yalnızca bir kez kullanılabilir.</p>
<p style="margin:0 0 20px;font-size:14px;color:#475569">Bu talebi siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz; şifreniz değişmez.</p>
<p style="margin:0;font-size:12px;color:#94a3b8;word-break:break-all">Buton çalışmazsa bu adresi tarayıcınıza yapıştırın:<br>${safeLink}</p>
</td></tr></table></td></tr></table></body></html>`,
  };
}
