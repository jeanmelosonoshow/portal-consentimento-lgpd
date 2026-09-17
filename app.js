(() => {
  "use strict";

  const REQUEST_TIMEOUT = 60000;
  const RESULT_TIMEOUT = 60000;

  const emailStage = document.querySelector("#email-stage");
  const consentStage = document.querySelector("#consent-stage");
  const successStage = document.querySelector("#success-stage");
  const emailForm = document.querySelector("#email-form");
  const consentForm = document.querySelector("#consent-form");
  const emailInput = document.querySelector("#email");
  const nameInput = document.querySelector("#name");
  const cpfInput = document.querySelector("#cpf");
  const phoneInput = document.querySelector("#phone");
  const consentCheckbox = document.querySelector("#consent-checkbox");
  const checkButton = document.querySelector("#check-button");
  const submitButton = document.querySelector("#submit-button");
  const emailError = document.querySelector("#email-error");
  const consentError = document.querySelector("#consent-error");
  const liveStatus = document.querySelector("#live-status");

  let verifiedEmail = "";
  let verifiedCpf = "";
  let verificationToken = "";
  let pollTimer = 0;
  let resultDeadline = 0;

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function cpfDigits(value) {
    return String(value || "").replace(/\D/g, "").slice(0, 11);
  }

  function formatCpf(value) {
    return cpfDigits(value)
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  function maskCpf(value) {
    const digits = cpfDigits(value);
    return digits.length === 11 ? `***.***.***-${digits.slice(-2)}` : "CPF informado";
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  }

  async function sha256(value) {
    if (window.isSecureContext && window.crypto?.subtle && window.TextEncoder) {
      const bytes = new TextEncoder().encode(value);
      const digest = await window.crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    }
    return sha256Fallback(value);
  }

  function sha256Fallback(value) {
    const rightRotate = (number, amount) => (number >>> amount) | (number << (32 - amount));
    const maxWord = 2 ** 32;
    const words = [];
    const hash = [];
    const constants = [];
    const bytes = [];

    for (const character of String(value)) {
      const codePoint = character.codePointAt(0);
      if (codePoint < 0x80) bytes.push(codePoint);
      else if (codePoint < 0x800) {
        bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
      } else if (codePoint < 0x10000) {
        bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f));
      } else {
        bytes.push(
          0xf0 | (codePoint >> 18),
          0x80 | ((codePoint >> 12) & 0x3f),
          0x80 | ((codePoint >> 6) & 0x3f),
          0x80 | (codePoint & 0x3f)
        );
      }
    }

    for (let candidate = 2, primeCount = 0; primeCount < 64; candidate += 1) {
      let isPrime = true;
      for (let divisor = 2; divisor * divisor <= candidate; divisor += 1) {
        if (candidate % divisor === 0) {
          isPrime = false;
          break;
        }
      }
      if (!isPrime) continue;
      if (primeCount < 8) hash[primeCount] = (Math.sqrt(candidate) * maxWord) | 0;
      constants[primeCount] = (Math.cbrt(candidate) * maxWord) | 0;
      primeCount += 1;
    }

    const bitLength = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let shift = 56; shift >= 0; shift -= 8) bytes.push(Math.floor(bitLength / (2 ** shift)) & 0xff);
    for (let index = 0; index < bytes.length; index += 4) {
      words.push((bytes[index] << 24) | (bytes[index + 1] << 16) | (bytes[index + 2] << 8) | bytes[index + 3]);
    }

    for (let chunk = 0; chunk < words.length; chunk += 16) {
      const oldHash = hash.slice();
      const schedule = words.slice(chunk, chunk + 16);
      for (let round = 0; round < 64; round += 1) {
        if (round >= 16) {
          const w15 = schedule[round - 15];
          const w2 = schedule[round - 2];
          const sigma0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
          const sigma1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
          schedule[round] = (schedule[round - 16] + sigma0 + schedule[round - 7] + sigma1) | 0;
        }
        const a = hash[0];
        const e = hash[4];
        const choice = (e & hash[5]) ^ (~e & hash[6]);
        const majority = (a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]);
        const sum0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const sum1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const temp1 = (hash[7] + sum1 + choice + constants[round] + schedule[round]) | 0;
        const temp2 = (sum0 + majority) | 0;
        hash.unshift((temp1 + temp2) | 0);
        hash[4] = (hash[4] + temp1) | 0;
        hash.pop();
      }
      hash.forEach((item, index) => { hash[index] = (item + oldHash[index]) | 0; });
    }

    return hash.map(item => (item >>> 0).toString(16).padStart(8, "0")).join("");
  }

  async function apiRequest(path, options = {}, timeout = REQUEST_TIMEOUT) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(path, {
        ...options,
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        signal: controller.signal,
        credentials: "same-origin",
        cache: "no-store"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || "Serviço indisponível.");
      return result;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function setButtonLoading(button, loading, loadingText) {
    const label = button.querySelector("span");
    if (!button.dataset.defaultLabel) button.dataset.defaultLabel = label.textContent;
    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
    label.textContent = loading ? loadingText : button.dataset.defaultLabel;
  }

  function showError(element, message) {
    element.textContent = message;
    element.hidden = false;
    liveStatus.textContent = message;
    requestResize();
  }

  function clearError(element) {
    element.hidden = true;
    element.textContent = "";
  }

  function setStep(activeStep) {
    document.querySelectorAll(".step").forEach((step, index) => {
      const number = index + 1;
      step.classList.toggle("is-active", number === activeStep);
      step.classList.toggle("is-complete", number < activeStep);
    });
  }

  function showStage(stage) {
    [emailStage, consentStage, successStage].forEach(item => { item.hidden = item !== stage; });
    setStep(stage === emailStage ? 1 : stage === consentStage ? 2 : 3);
    requestAnimationFrame(() => {
      stage.querySelector("h2")?.focus?.({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      requestResize();
    });
  }

  function requestResize() {
    if (window.parent === window) return;
    window.parent.postMessage({
      source: "sono-show-consent",
      type: "resize",
      height: Math.ceil(document.documentElement.scrollHeight)
    }, "*");
  }

  emailForm.addEventListener("submit", async event => {
    event.preventDefault();
    clearError(emailError);
    const email = normalizeEmail(emailInput.value);
    const cpf = cpfDigits(cpfInput.value);
    emailInput.value = email;
    emailInput.removeAttribute("aria-invalid");
    cpfInput.removeAttribute("aria-invalid");

    if (!isValidEmail(email)) {
      emailInput.setAttribute("aria-invalid", "true");
      showError(emailError, "Digite um e-mail válido para continuar.");
      emailInput.focus();
      return;
    }

    if (!isValidCpf(cpf)) {
      cpfInput.setAttribute("aria-invalid", "true");
      showError(emailError, "Informe um CPF válido para continuar.");
      cpfInput.focus();
      return;
    }

    setButtonLoading(checkButton, true, "Verificando…");
    liveStatus.textContent = "Verificando o par de e-mail e CPF informado.";
    try {
      const pairHash = await sha256(`${email}|${cpf}`);
      const cpfHash = await sha256(cpf);
      const result = await apiRequest("/api/check", {
        method: "POST",
        body: JSON.stringify({ pairHash, cpfHash })
      });
      if (!result || !result.ok) {
        showError(emailError, result?.message || "Não foi possível verificar o e-mail.");
        return;
      }

      verifiedEmail = email;
      verifiedCpf = cpf;
      verificationToken = result.token;
      document.querySelector("#verified-email").textContent = email;
      document.querySelector("#verified-cpf").textContent = maskCpf(cpf);
      document.querySelector("#submission-email").value = email;
      document.querySelector("#submission-cpf").value = cpf;
      document.querySelector("#submission-token").value = verificationToken;
      clearError(consentError);
      showStage(consentStage);
      nameInput.focus({ preventScroll: true });
      liveStatus.textContent = "Identificação disponível. Preencha os dados e revise o termo.";
    } catch (error) {
      console.error("Falha ao verificar a identificação:", error);
      const timedOut = String(error?.message || "").includes("Tempo de resposta");
      showError(emailError, timedOut
        ? "O serviço demorou mais que o esperado. Aguarde alguns segundos e tente novamente."
        : "Não foi possível verificar agora. Confira sua conexão e tente novamente.");
    } finally {
      setButtonLoading(checkButton, false, "");
    }
  });

  document.querySelector("#change-email").addEventListener("click", () => {
    stopPolling();
    verifiedEmail = "";
    verifiedCpf = "";
    verificationToken = "";
    consentForm.reset();
    clearError(consentError);
    showStage(emailStage);
    liveStatus.textContent = "Informe o e-mail e o CPF que ficarão vinculados ao consentimento.";
    emailInput.focus({ preventScroll: true });
  });

  cpfInput.addEventListener("input", () => {
    cpfInput.value = formatCpf(cpfInput.value);
  });

  phoneInput.addEventListener("input", () => {
    const digits = phoneInput.value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      phoneInput.value = digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    } else {
      phoneInput.value = digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
    }
  });

  function isValidCpf(value) {
    const cpf = cpfDigits(value);
    if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
    for (let stage = 9; stage <= 10; stage += 1) {
      let sum = 0;
      for (let index = 0; index < stage; index += 1) {
        sum += Number(cpf[index]) * (stage + 1 - index);
      }
      let digit = (sum * 10) % 11;
      if (digit === 10) digit = 0;
      if (digit !== Number(cpf[stage])) return false;
    }
    return true;
  }

  consentForm.addEventListener("submit", async event => {
    event.preventDefault();
    clearError(consentError);

    const name = nameInput.value.replace(/\s+/g, " ").trim();
    const phone = phoneInput.value.replace(/\D/g, "");
    const firstInvalid = [];

    if (name.length < 5 || name.split(" ").length < 2) firstInvalid.push([nameInput, "Informe seu nome completo."]);
    else if (!/^\d{10,11}$/.test(phone)) firstInvalid.push([phoneInput, "Informe um telefone com DDD válido."]);
    else if (!consentCheckbox.checked) firstInvalid.push([consentCheckbox, "É necessário aceitar a declaração de consentimento."]);

    document.querySelectorAll("#consent-form [aria-invalid='true']").forEach(input => input.removeAttribute("aria-invalid"));
    if (firstInvalid.length) {
      const [input, message] = firstInvalid[0];
      input.setAttribute("aria-invalid", "true");
      showError(consentError, message);
      input.focus();
      return;
    }

    if (!verifiedEmail || !verifiedCpf || !verificationToken) {
      showError(consentError, "A verificação da identificação expirou. Verifique novamente.");
      showStage(emailStage);
      return;
    }

    nameInput.value = name;
    setButtonLoading(submitButton, true, "Registrando…");
    liveStatus.textContent = "Registrando o consentimento e criando o comprovante.";
    resultDeadline = Date.now() + RESULT_TIMEOUT;
    try {
      const result = await apiRequest("/api/submit", {
        method: "POST",
        body: JSON.stringify({ email: verifiedEmail, cpf: verifiedCpf, token: verificationToken, name, phone })
      });
      if (!result?.ok) throw new Error(result?.message || "Não foi possível registrar o consentimento.");
      window.setTimeout(pollResult, 800);
    } catch (error) {
      setButtonLoading(submitButton, false, "");
      showError(consentError, error.name === "AbortError"
        ? "O serviço demorou mais que o esperado. Tente novamente."
        : (error.message || "Não foi possível registrar agora. Tente novamente."));
    }
  });

  async function pollResult() {
    stopPolling();
    if (Date.now() > resultDeadline) {
      setButtonLoading(submitButton, false, "");
      showError(consentError, "O processamento está demorando mais que o esperado. Aguarde um momento e tente verificar novamente.");
      return;
    }

    try {
      const result = await apiRequest(`/api/status?token=${encodeURIComponent(verificationToken)}`, {}, 15000);
      if (result?.pending) {
        pollTimer = window.setTimeout(pollResult, 1200);
        return;
      }
      if (!result?.ok) {
        setButtonLoading(submitButton, false, "");
        showError(consentError, result?.message || "Não foi possível concluir o registro.");
        return;
      }

      document.querySelector("#success-email").textContent = verifiedEmail;
      liveStatus.textContent = "Consentimento registrado e comprovante enviado por e-mail.";
      showStage(successStage);
    } catch (_) {
      pollTimer = window.setTimeout(pollResult, 1500);
    }
  }

  function stopPolling() {
    window.clearTimeout(pollTimer);
    pollTimer = 0;
  }

  window.addEventListener("pagehide", stopPolling);
  new ResizeObserver(requestResize).observe(document.body);
  requestResize();
})();
