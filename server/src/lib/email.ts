export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  if (!host) return false;
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to,
      subject: 'Password reset request',
      text: `You requested a password reset. Open this link to choose a new password:\n\n${base}/reset-password?token=${resetToken}\n\nIf you did not request this, you can safely ignore this email.`,
    });
    return true;
  } catch (err) {
    console.error('[EMAIL] Failed to send password reset email:', err);
    return false;
  }
}
