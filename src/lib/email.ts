import nodemailer from "nodemailer";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function emailConfigured(): boolean {
  return smtpConfigured();
}

export async function sendMagicLink(email: string, link: string): Promise<void> {
  if (!smtpConfigured()) {
    throw new Error("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS).");
  }
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "info@laserraptor.eu";
  await transporter.sendMail({
    from: `Broomy <${from}>`,
    to: email,
    subject: "Sign in to Broomy",
    text: `Click this link to sign in to Broomy:\n\n${link}\n\nThe link expires in 15 minutes. If you did not request it, ignore this email.`,
    html: `<p>Click this link to sign in to Broomy:</p><p><a href="${link}">${link}</a></p><p>The link expires in 15 minutes. If you did not request it, ignore this email.</p>`,
  });
}
