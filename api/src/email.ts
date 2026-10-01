import nodemailer, { type Transporter } from 'nodemailer';
import type { BillingOffer } from '../../web/src/data/billing';

const SMTP_USER = 'contact.desidhun@gmail.com';
const FROM = `Desi Dhun <${SMTP_USER}>`;

let transport: Transporter | undefined;

function smtpPassword(): string | undefined {
  const raw = process.env.SMTP_APP_PASSWORD;
  if (!raw) return undefined;
  // Gmail app passwords are often pasted with spaces or a trailing newline from Secret Manager.
  const password = raw.replace(/\s+/g, '').trim();
  return password || undefined;
}

function mailer(): Transporter | undefined {
  const password = smtpPassword();
  if (!password) {
    console.warn('Transactional email is disabled because SMTP_APP_PASSWORD is not configured.');
    return undefined;
  }
  transport ??= nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: password },
  });
  return transport;
}

/** Drop placeholder PayU/Firebase emails that can never be delivered. */
export function usableEmail(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (!email || !email.includes('@') || email.endsWith('@firebase.local')) return null;
  return email;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}

function layout(title: string, content: string): string {
  return `<!doctype html>
<html><body style="margin:0;background:#17111f;color:#f7f2ff;font-family:Arial,sans-serif">
  <main style="max-width:600px;margin:0 auto;padding:32px 24px">
    <h1 style="margin:0 0 20px;color:#d9a441;font-size:26px">Desi Dhun</h1>
    <section style="padding:24px;background:#211a3d;border:1px solid #493a67;border-radius:12px">
      <h2 style="margin:0 0 16px;color:#f7f2ff;font-size:20px">${escapeHtml(title)}</h2>
      ${content}
    </section>
    <p style="margin:18px 0 0;color:#c0b8d0;font-size:12px;line-height:1.5">
      Questions? Contact <a style="color:#d9a441" href="mailto:contact.yscholar@gmail.com">contact.yscholar@gmail.com</a>.
    </p>
  </main>
</body></html>`;
}

async function send(to: string | null | undefined, subject: string, html: string): Promise<boolean> {
  const recipient = usableEmail(to);
  if (!recipient) {
    console.warn('Transactional email skipped because no usable recipient was available.', { subject, to });
    return false;
  }
  const client = mailer();
  if (!client) return false;
  try {
    const info = await client.sendMail({
      from: FROM,
      replyTo: 'contact.yscholar@gmail.com',
      to: recipient,
      subject,
      html,
    });
    console.info('Transactional email sent', {
      to: recipient,
      subject,
      messageId: info.messageId,
      response: info.response,
    });
    return true;
  } catch (error) {
    // Email delivery must never undo an already-completed payment or cancellation.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Transactional email could not be sent to=${recipient} subject=${subject} error=${message}`);
    return false;
  }
}

export async function sendWelcomeEmail(email: string | null | undefined, name: string | null | undefined): Promise<void> {
  const greeting = name?.trim() ? `Hi ${escapeHtml(name.trim())},` : 'Hi,';
  await send(
    email,
    'Welcome to Desi Dhun — your account is ready',
    layout(
      'Welcome to Desi Dhun',
      `<p style="line-height:1.6">${greeting}</p>
       <p style="line-height:1.6">Your Desi Dhun account is ready. Create lyrics, compose a prompt, and generate your first original song at <a style="color:#d9a441" href="https://desidhun.net">desidhun.net</a>.</p>`,
    ),
  );
}

export async function sendPaymentReceipt(
  email: string | null | undefined,
  name: string | null | undefined,
  offer: BillingOffer,
  provider: 'Stripe' | 'PayU',
  transactionId: string,
): Promise<boolean> {
  const greeting = name?.trim() ? `Hi ${escapeHtml(name.trim())},` : 'Hi,';
  const amount = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(offer.amountPaise / 100);
  const kind = offer.kind === 'subscription' ? 'Membership subscription' : 'One-time credit pack';
  return send(
    email,
    `Payment receipt — ${offer.id}`,
    layout(
      'Payment receipt',
      `<p style="line-height:1.6">${greeting}</p>
       <p style="line-height:1.6">Thank you for your payment. Your Desi Dhun purchase is confirmed.</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px">
         <tr><td style="padding:8px 0;color:#c0b8d0">Purchase</td><td style="padding:8px 0;text-align:right">${escapeHtml(kind)}</td></tr>
         <tr><td style="padding:8px 0;color:#c0b8d0">Plan / pack</td><td style="padding:8px 0;text-align:right">${escapeHtml(offer.id)}</td></tr>
         <tr><td style="padding:8px 0;color:#c0b8d0">Amount</td><td style="padding:8px 0;text-align:right;font-weight:700">${amount}</td></tr>
         <tr><td style="padding:8px 0;color:#c0b8d0">Payment provider</td><td style="padding:8px 0;text-align:right">${provider}</td></tr>
         <tr><td style="padding:8px 0;color:#c0b8d0">Transaction ID</td><td style="padding:8px 0;text-align:right;word-break:break-all">${escapeHtml(transactionId)}</td></tr>
       </table>`,
    ),
  );
}

export async function sendCancellationEmail(
  email: string | null | undefined,
  name: string | null | undefined,
  periodEnd: Date | undefined,
): Promise<void> {
  const greeting = name?.trim() ? `Hi ${escapeHtml(name.trim())},` : 'Hi,';
  const accessEnds = periodEnd
    ? periodEnd.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'the end of your current paid period';
  await send(
    email,
    'Your Desi Dhun membership is cancelled',
    layout('Membership cancellation confirmed', `<p style="line-height:1.6">${greeting}</p><p style="line-height:1.6">Your recurring membership has been cancelled. You will keep access until ${escapeHtml(accessEnds)} and will not be charged again.</p>`),
  );
}
