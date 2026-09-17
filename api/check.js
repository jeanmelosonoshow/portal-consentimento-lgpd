const { fetchBackend, getBackendUrl, methodAllowed, readJson, sendJson } = require('../lib/vercel-backend');

module.exports = async function check(req, res) {
  if (!methodAllowed(req, 'POST')) return sendJson(res, 405, { ok: false, message: 'Método não permitido.' });
  try {
    const body = await readJson(req);
    const pairHash = String(body.pairHash || '').toLowerCase();
    const cpfHash = String(body.cpfHash || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(pairHash) || !/^[a-f0-9]{64}$/.test(cpfHash)) {
      return sendJson(res, 400, { ok: false, code: 'invalid', message: 'Identificação inválida.' });
    }
    const url = new URL(getBackendUrl());
    url.searchParams.set('action', 'check');
    url.searchParams.set('pairHash', pairHash);
    url.searchParams.set('cpfHash', cpfHash);
    const result = await fetchBackend(url, { method: 'GET' });
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 502, { ok: false, code: 'backend', message: 'Não foi possível verificar agora. Tente novamente em instantes.' });
  }
};
