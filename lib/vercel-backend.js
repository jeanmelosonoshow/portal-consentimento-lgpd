const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

function methodAllowed(req, method) {
  return String(req.method || '').toUpperCase() === method;
}

function getBackendUrl() {
  if (!APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL não configurada.');
  return APPS_SCRIPT_URL;
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  return JSON.parse(raw);
}

async function fetchBackend(url, options) {
  const response = await fetch(url, {
    redirect: 'follow',
    ...options,
    headers: { Accept: 'application/json', ...(options && options.headers) }
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Apps Script respondeu ${response.status}.`);
  let payload;
  try { payload = JSON.parse(text); } catch (_) { throw new Error(`Resposta JSON inválida do Apps Script (${response.status}).`); }
  return payload;
}

async function fetchBackendText(url, options) {
  const response = await fetch(url, { redirect: 'follow', ...options });
  const text = await response.text();
  if (!response.ok) throw new Error(`Apps Script respondeu ${response.status}.`);
  return text;
}

module.exports = { fetchBackend, fetchBackendText, getBackendUrl, methodAllowed, readJson, sendJson };
