const form = document.querySelector('#login-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#docenteId');
const toggleButton = document.querySelector('#password-toggle');
const submitButton = document.querySelector('#submit-button');
const formMessage = document.querySelector('#form-message');

toggleButton.addEventListener('click', () => {
  const reveal = passwordInput.type === 'password';
  passwordInput.type = reveal ? 'text' : 'password';
  toggleButton.setAttribute('aria-pressed', String(reveal));
  toggleButton.setAttribute('aria-label', reveal ? 'Ocultar contraseña' : 'Mostrar contraseña');
  passwordInput.focus();
});

function setFieldError(input, message) {
  input.setAttribute('aria-invalid', String(Boolean(message)));
  document.querySelector(`#${input.id}-error`).textContent = message;
}

function validate() {
  const email = emailInput.value.trim();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const gmailAddress = /^[^\s@]+@gmail\.com$/i.test(email);
  setFieldError(emailInput, !email ? 'Ingresa tu correo institucional.' : !validEmail ? 'Ingresa un correo electrónico válido.' : !gmailAddress ? 'Usa un correo que termine en @gmail.com.' : '');
  setFieldError(passwordInput, !passwordInput.value ? 'Ingresa tu ID de docente.' : '');
  return validEmail && gmailAddress && passwordInput.value.length > 0;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formMessage.textContent = '';
  formMessage.classList.remove('success');
  if (!validate()) return;

  // No imprimir ni persistir las credenciales. El backend debe autenticar por HTTPS.
  submitButton.disabled = true;
  submitButton.setAttribute('aria-busy', 'true');
  document.querySelector('.button-label').textContent = 'Validando…';
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ email: emailInput.value.trim(), docenteId: passwordInput.value }),
    });

    if (response.ok) {
      // No se guarda la contraseña ni el token en localStorage/sessionStorage.
      passwordInput.value = '';
      formMessage.textContent = 'Inicio de sesión exitoso.';
      formMessage.classList.add('success');
      return;
    }
    if (response.status === 401 || response.status === 403) {
      formMessage.textContent = 'Correo o contraseña incorrectos.';
    } else {
      formMessage.textContent = 'No fue posible iniciar sesión. Inténtalo de nuevo.';
    }
  } catch {
    formMessage.textContent = 'No se pudo conectar con el servidor. Verifica la conexión e inténtalo de nuevo.';
  } finally {
    submitButton.disabled = false;
    submitButton.removeAttribute('aria-busy');
    document.querySelector('.button-label').textContent = 'Iniciar sesión';
  }
});

for (const input of [emailInput, passwordInput]) {
  input.addEventListener('input', () => {
    if (input === emailInput && input.value.trim()) {
      const gmailAddress = /^[^\s@]+@gmail\.com$/i.test(input.value.trim());
      setFieldError(input, gmailAddress ? '' : 'Usa un correo que termine en @gmail.com.');
    } else if (input.getAttribute('aria-invalid') === 'true') {
      setFieldError(input, '');
    }
  });
}
