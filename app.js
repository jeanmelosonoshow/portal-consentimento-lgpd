(() => {
  "use strict";

  const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxeFxtsiKVvtIP6FTisNZCZITp32TrlEKDiZLjpoCYMshJR1YSKBWOeprH1_FJ8pC0H/exec";
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

  consentForm.action = BACKEND_URL;

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
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  }

  function jsonp(params, timeout = REQUEST_TIMEOUT) {
    return new Promise((resolve, reject) => {
      const callbackName = `__sonoShow_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timer = window.setTimeout(() => finish(new Error("Tempo de resposta excedido.")), timeout);

      function finish(error, data) {
        window.clearTimeout(timer);
        script.remove();
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        if (error) reject(error);
        else resolve(data);
      }

      window[callbackName] = data => finish(null, data);
      script.onerror = () => finish(new Error("Não foi possível acessar o serviço de consentimento."));
      const url = new URL(BACKEND_URL);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      url.searchParams.set("callback", callbackName);
      script.src = url.toString();
      document.head.appendChild(script);
    });
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
      const result = await jsonp({ action: "check", pairHash });
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
      showError(emailError, "Não foi possível verificar agora. Confira sua conexão e tente novamente.");
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

  consentForm.addEventListener("submit", event => {
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
    HTMLFormElement.prototype.submit.call(consentForm);
    window.setTimeout(pollResult, 800);
  });

  async function pollResult() {
    stopPolling();
    if (Date.now() > resultDeadline) {
      setButtonLoading(submitButton, false, "");
      showError(consentError, "O processamento está demorando mais que o esperado. Aguarde um momento e tente verificar novamente.");
      return;
    }

    try {
      const result = await jsonp({ action: "status", token: verificationToken }, 15000);
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
