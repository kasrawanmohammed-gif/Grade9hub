import nodemailer from 'nodemailer';

export interface EmailSendResult {
  sent: boolean;
  configured: boolean;
  error?: string;
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_USER.trim().length > 0 &&
      process.env.SMTP_PASS.trim().length > 0
  );
}

export async function sendVerificationCodeEmail(
  recipientEmail: string,
  recipientName: string,
  code: string
): Promise<EmailSendResult> {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      configured: false,
      error:
        'Email delivery requires SMTP_USER and SMTP_PASS (Gmail App Password) in environment variables.',
    };
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || '465');
  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const fromAddress =
    process.env.SMTP_FROM || `Grade 9 Hub <${process.env.SMTP_USER}>`;

  try {
    await transporter.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: 'Grade 9 Hub — Password Reset Verification Code',
      text: `Hello ${recipientName},\n\nYour Grade 9 Hub password reset verification code is: ${code}\n\nThis code expires in 15 minutes. If you did not request a password reset, you can safely ignore this email.\n\nPowered by Mr. Kasrawan`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #FAF8F5; padding: 32px; border-radius: 12px; border: 1px solid #E6DFD5;">
          <div style="border-bottom: 2px solid #6B1118; padding-bottom: 16px; margin-bottom: 24px;">
            <h2 style="margin: 0; color: #6B1118; font-size: 20px;">Grade 9 Hub</h2>
            <p style="margin: 4px 0 0; color: #57534E; font-size: 13px;">Password Reset Verification</p>
          </div>
          <p style="color: #1C1917; font-size: 15px; line-height: 1.6;">Hello <strong>${recipientName}</strong>,</p>
          <p style="color: #1C1917; font-size: 15px; line-height: 1.6;">Use the verification code below to reset your password:</p>
          <div style="background: #FFFFFF; border: 1px solid #D9A62E; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #6B1118;">${code}</span>
          </div>
          <p style="color: #57534E; font-size: 13px; line-height: 1.5;">This verification code expires in 15 minutes. If you did not request this, please ignore this email.</p>
          <p style="color: #57534E; font-size: 12px; margin-top: 24px; border-top: 1px solid #E6DFD5; padding-top: 16px;">Powered by Mr. Kasrawan</p>
        </div>
      `,
    });

    return { sent: true, configured: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email.';
    return { sent: false, configured: true, error: message };
  }
}
