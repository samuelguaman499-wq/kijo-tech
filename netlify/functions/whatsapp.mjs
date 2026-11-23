// KIJO Tech: avisos de pedido por la API de WhatsApp Cloud. Variables en Netlify: WHATSAPP_TOKEN, PHONE_NUMBER_ID
const SITE = 'https://kijo-tech.netlify.app';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const out = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const clean = (s) => String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/ {4,}/g, '   ').trim().slice(0, 900) || '-';
const TEMPLATES = { pedido: { name: 'pedido_kijo', fields: ['name', 'code', 'items', 'total', 'link'] }, estado: { name: 'estado_pedido_kijo', fields: ['name', 'code', 'status', 'link'] } };
export default async (req) => {
  if (req.method === 'OPTIONS') return out({ ok: true });
  if (req.method !== 'POST') return out({ ok: false, error: 'Usa POST' }, 405);
  const rawToken = String(process.env.WHATSAPP_TOKEN || ''), token = (rawToken.match(/EAA[A-Za-z0-9]+/) || [rawToken.replace(/[\s"']/g, '')])[0], phoneId = String(process.env.PHONE_NUMBER_ID || '').trim();
  if (!token || !phoneId) return out({ ok: false, error: 'Falta configurar WHATSAPP_TOKEN o PHONE_NUMBER_ID' }, 500);
  const data = await req.json().catch(() => ({}));
  const digits = String(data.phone || '').replace(/\D/g, '');
  if (!/^09\d{8}$/.test(digits)) return out({ ok: false, error: 'Numero invalido' }, 400);
  if (!String(data.link || '').startsWith(SITE)) return out({ ok: false, error: 'Link invalido' }, 400);
  const tpl = TEMPLATES[data.kind] || TEMPLATES.pedido;
  const to = '593' + digits.slice(1);
  const api = 'https://graph.facebook.com/v25.0/' + phoneId + '/messages';
  const send = (payload) => fetch(api, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload }) }).then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }));
  const r = await send({ type: 'template', template: { name: tpl.name, language: { code: 'es_EC' }, components: [{ type: 'body', parameters: tpl.fields.map((f) => ({ type: 'text', text: clean(data[f]) })) }] } });
  if (r.ok) return out({ ok: true, via: 'template', id: r.body?.messages?.[0]?.id });
  const text = String(data.text || '').slice(0, 4000);
  const t = text ? await send({ type: 'text', text: { body: text, preview_url: true } }) : null;
  if (t && t.ok) return out({ ok: true, via: 'text', id: t.body?.messages?.[0]?.id });
  return out({ ok: false, error: r.body?.error?.message || 'No se pudo enviar', clave: { largo: token.length, eaa: token.startsWith('EAA') } }, 502);
};
