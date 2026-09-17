const { fetchBackendText, getBackendUrl, methodAllowed, readJson, sendJson } = require('../lib/vercel-backend');

module.exports = async function submit(req, res) {
  if (!methodAllowed(req, 'POST')) return sendJson(res, 405, { ok: false, message: 'Método não permitido.' });
  try {
    const body = await readJson(req);
    const token = String(body.token || '');
    const email = String(body.email || '').trim().toLowerCase();
    const cpf = String(body.cpf || '').replace(/\D/g, '');
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').replace(/\D/g, '');
    if (!/^[a-f0-9-]{20,80}$/i.test(token) || !email || !/^\d{11}$/.test(cpf) || !name || !/^\d{10,11}$/.test(phone)) {
      return sendJson(res, 400, { ok: false, code: 'validation', message: 'Dados do consentimento inválidos.' });
    }

    const form = new URLSearchParams({ email, cpf, token, name, phone, consent: 'true' });
    await fetchBackendText(getBackendUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: form.toString()
    });
    // O doPost legado retorna texto; o resultado final é consultado por token.
    return sendJson(res, 200, { ok: true, accepted: true });
  } catch (error) {
    return sendJson(res, 502, { ok: false, code: 'backend', message: 'Não foi possível registrar agora. Tente novamente em instantes.' });
  }
};
