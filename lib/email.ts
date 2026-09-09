import nodemailer, { Transporter } from "nodemailer";

let cached: Transporter | null = null;

function getTransport(): Transporter | null {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? "true") === "true",
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
  });
  return cached;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string,
): Promise<{ ok: boolean; error?: string }> {
  const transport = getTransport();
  const from = process.env.SMTP_FROM ?? "noreply@horecago.tech";
  if (!transport) {
    console.log("\n=== EMAIL (dev, no SMTP) ===");
    console.log(`From: ${from}`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text ?? html);
    console.log("============================\n");
    return { ok: true };
  }
  try {
    await transport.sendMail({ from, to, subject, html, text });
    return { ok: true };
  } catch (e) {
    console.error("Не удалось отправить письмо:", to, e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
