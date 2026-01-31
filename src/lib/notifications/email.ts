type EmailPayload = {
  to: string;
  subject: string;
  html: string;
};

function getEnv(value: string) {
  return process.env[value] ?? "";
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  const resendKey = getEnv("RESEND_API_KEY");
  const from = getEnv("SENTIMENT_ALERT_EMAIL_FROM");
  const to = payload.to || getEnv("SENTIMENT_ALERT_EMAIL_TO");

  if (!resendKey || !from || !to) {
    console.log("[Email] Missing RESEND_API_KEY or SENTIMENT_ALERT_EMAIL_FROM/TO; skipping email.");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: payload.subject,
      html: payload.html,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[Email] Send failed:", response.status, text);
    return false;
  }

  return true;
}
