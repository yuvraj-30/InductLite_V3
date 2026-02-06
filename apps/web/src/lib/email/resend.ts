import { Resend } from "resend";

let client: Resend | null = null;

function getClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY || "";
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is required for email delivery");
    }
    client = new Resend(apiKey);
  }
  return client;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const from = process.env.RESEND_FROM || "";
  if (!from) {
    throw new Error("RESEND_FROM is required for email delivery");
  }

  const resend = getClient();
  await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
