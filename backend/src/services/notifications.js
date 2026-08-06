const SENDGRID_URL = 'https://api.sendgrid.com/v3/mail/send';

export function emailEnabled() {
  return Boolean(process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL);
}

export function smsEnabled() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM_NUMBER,
  );
}

export async function sendEmail({ to, subject, text }) {
  if (!emailEnabled()) {
    console.info(`[notificaciones:email:fallback] Para: ${to} | ${subject} — ${text}`);
    return { delivered: false, channel: 'email', reason: 'no_configurado' };
  }

  try {
    const res = await fetch(SENDGRID_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: process.env.SENDGRID_FROM_EMAIL },
        subject,
        content: [{ type: 'text/plain', value: text }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`SendGrid respondió ${res.status}`);
    return { delivered: true, channel: 'email' };
  } catch (e) {
    console.warn(`[notificaciones:email] fallo enviando a ${to}: ${e.message}`);
    return { delivered: false, channel: 'email', reason: e.message };
  }
}

export async function sendSms({ to, text }) {
  if (!smsEnabled()) {
    console.info(`[notificaciones:sms:fallback] Para: ${to} — ${text}`);
    return { delivered: false, channel: 'sms', reason: 'no_configurado' };
  }

  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
    const body = new URLSearchParams({
      To: to,
      From: process.env.TWILIO_FROM_NUMBER,
      Body: text,
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Twilio respondió ${res.status}`);
    return { delivered: true, channel: 'sms' };
  } catch (e) {
    console.warn(`[notificaciones:sms] fallo enviando a ${to}: ${e.message}`);
    return { delivered: false, channel: 'sms', reason: e.message };
  }
}

export async function notifyHighRisk(supabase, { student, prediction }) {
  try {
    const { data: recipients } = await supabase
      .from('usuarios')
      .select('correo, nombre_completo, rol')
      .eq('institucion_id', student.institucion_id)
      .eq('activo', true)
      .in('rol', ['admin', 'coordinador']);

    if (!recipients?.length) return;

    const pct = (Number(prediction.puntaje_riesgo) * 100).toFixed(1);
    const subject = `Riesgo alto de abandono: ${student.nombre_completo}`;
    const matricula = student.matricula ?? 's/matrícula';
    const text =
      `El estudiante ${student.nombre_completo} (${matricula}) ` +
      `alcanzó un riesgo de ${pct}% (nivel ${prediction.nivel_riesgo}). ` +
      `Se recomienda intervención del tutor.`;

    await Promise.all(
      recipients.filter((r) => r.correo).map((r) => sendEmail({ to: r.correo, subject, text })),
    );
  } catch (e) {
    console.error('[notificaciones:notifyHighRisk] error:', e.message);
  }
}
