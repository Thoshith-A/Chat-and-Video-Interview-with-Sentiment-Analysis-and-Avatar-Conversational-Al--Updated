import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Server-side email delivery for candidate invites (Brevo/SMTP).
 *
 * Credentials live in env (never the client, never committed):
 *   SMTP_HOST  (default smtp-relay.brevo.com)
 *   SMTP_PORT  (default 587, STARTTLS)
 *   SMTP_USER  — the SMTP login (Brevo: your account login / SMTP user)
 *   SMTP_PASS  — the SMTP key (xsmtpsib-…)
 *   MAIL_FROM  — a VERIFIED sender, e.g. "TalbotIQ <talent@yourco.com>"
 *
 * Until every field is present the mailer runs in DRY-RUN mode: it logs what it
 * would send and returns { sent:false, dryRun:true } instead of throwing, so the
 * invite flow can be exercised safely before real delivery is switched on.
 */

const HOST = (process.env.SMTP_HOST || 'smtp-relay.brevo.com').trim()
const PORT = Number(process.env.SMTP_PORT || 587)
const USER = (process.env.SMTP_USER || '').trim()
const PASS = (process.env.SMTP_PASS || '').trim()
const FROM = (process.env.MAIL_FROM || '').trim()

/** True only when we have everything needed to actually send. */
export function mailerReady(): boolean {
  return Boolean(HOST && PORT && USER && PASS && FROM)
}

/** What's still missing, for a helpful status/health message (never leaks secrets). */
export function mailerStatus() {
  return {
    ready: mailerReady(),
    host: HOST,
    port: PORT,
    from: FROM || null,
    missing: [
      !USER && 'SMTP_USER',
      !PASS && 'SMTP_PASS',
      !FROM && 'MAIL_FROM',
    ].filter(Boolean) as string[],
  }
}

let cached: Transporter | null = null
function transport(): Transporter {
  if (!cached) {
    cached = nodemailer.createTransport({
      host: HOST,
      port: PORT,
      secure: PORT === 465, // 465 = implicit TLS; 587 = STARTTLS
      auth: { user: USER, pass: PASS },
    })
  }
  return cached
}

/** Verify the SMTP connection/credentials (used by a health check). */
export async function verifyMailer(): Promise<{ ok: boolean; error?: string }> {
  if (!mailerReady()) return { ok: false, error: `Mailer not configured (missing: ${mailerStatus().missing.join(', ') || 'nothing'})` }
  try {
    await transport().verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export interface SendResult {
  sent: boolean
  dryRun?: boolean
  messageId?: string
}

export interface MailInput {
  to: string
  subject: string
  html: string
  text?: string
}

/** Send one email, or dry-run+log if the mailer isn't fully configured yet. */
export async function sendMail(input: MailInput): Promise<SendResult> {
  if (!mailerReady()) {
    console.log(`[email:dry-run] would send to ${input.to} — "${input.subject}" (missing: ${mailerStatus().missing.join(', ')})`)
    return { sent: false, dryRun: true }
  }
  const info = await transport().sendMail({
    from: FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text ?? input.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  })
  return { sent: true, messageId: info.messageId }
}
