const { fetchBackend, getBackendUrl, methodAllowed, sendJson } = require('../lib/vercel-backend');

module.exports = async function status(req, res) {
  if (!methodAllowed(req, 'GET')) return sendJson(res, 405, { ok: false, message: 'Método não permitido.' });
  try {
    const token = String(req.query?.token || '');
    if (!/^[a-f0-9-]{20,80}$/i.test(token)) {
      return sendJson(res, 400, { ok: false, code: 'invalid', message: 'Identificador inválido.' });
    }
    const url = new URL(getBackendUrl());
    url.searchParams.set('action', 'status');
    url.searchParams.set('token', token);
    const result = await fetchBackend(url, { method: 'GET' });
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 502, { pending: true });
  }
};
