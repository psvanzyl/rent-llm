import nodemailer from "nodemailer";

function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function emailConfigured(): boolean {
  return smtpConfigured();
}

function transport() {
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function fromAddress(): string {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "info@laserraptor.eu";
}

export async function sendMagicLink(email: string, link: string): Promise<void> {
  if (!smtpConfigured()) {
    throw new Error("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS).");
  }
  await transport().sendMail({
    from: `Broomy <${fromAddress()}>`,
    to: email,
    subject: "Sign in to Broomy",
    text: `Click this link to sign in to Broomy:\n\n${link}\n\nThe link expires in 15 minutes. If you did not request it, ignore this email.`,
    html: `<p>Click this link to sign in to Broomy:</p><p><a href="${link}">${link}</a></p><p>The link expires in 15 minutes. If you did not request it, ignore this email.</p>`,
  });
}

export async function sendPasswordReset(email: string, link: string): Promise<void> {
  if (!smtpConfigured()) {
    throw new Error("SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS).");
  }
  await transport().sendMail({
    from: `Broomy <${fromAddress()}>`,
    to: email,
    subject: "Reset your Broomy password",
    text:
      `You asked to reset your Broomy password.\n\n` +
      `Open this link to choose a new password:\n\n${link}\n\n` +
      `The link is valid for 30 minutes and can be used once.\n` +
      `If you did not request this, ignore the email — your password stays unchanged.`,
    html:
      `<p>You asked to reset your Broomy password.</p>` +
      `<p><a href="${link}">Choose a new password</a></p>` +
      `<p>The link is valid for 30 minutes and can be used once.<br>` +
      `If you did not request this, ignore the email — your password stays unchanged.</p>`,
  });
}
