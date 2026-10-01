const serverUrl = document.querySelector('#server-url');
const createButton = document.querySelector('#create-session');
const refreshButton = document.querySelector('#refresh-students');
const resultPanel = document.querySelector('#session-result');
const codeOutput = document.querySelector('#session-code');
const message = document.querySelector('#session-message');
const studentCount = document.querySelector('#student-count');
const studentList = document.querySelector('#student-list');
let activeCode = '';

function apiUrl(path) {
  return `${serverUrl.value.trim().replace(/\/$/, '')}${path}`;
}

createButton.addEventListener('click', async () => {
  message.textContent = '';
  createButton.disabled = true;
  createButton.textContent = 'Creando…';
  try {
    const response = await fetch(apiUrl('/api/sessions'), { method: 'POST', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('server');
    const session = await response.json();
    activeCode = session.code;
    codeOutput.textContent = activeCode;
    resultPanel.hidden = false;
    studentList.replaceChildren();
    studentCount.textContent = 'Aún no se han conectado estudiantes.';
    message.textContent = 'Sesión creada. Ingresa el código en la aplicación Unity.';
    message.classList.add('success');
  } catch {
    message.classList.remove('success');
    message.textContent = 'No se pudo conectar con el servidor. Inícialo y verifica la dirección.';
  } finally {
    createButton.disabled = false;
    createButton.textContent = 'Crear sesión';
  }
});

refreshButton.addEventListener('click', async () => {
  if (!activeCode) return;
  refreshButton.disabled = true;
  try {
    const response = await fetch(apiUrl(`/api/sessions/${activeCode}/students`), { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('server');
    const result = await response.json();
    studentList.replaceChildren(...result.students.map((student) => {
      const item = document.createElement('li');
      item.textContent = student.name;
      return item;
    }));
    studentCount.textContent = result.count === 1 ? '1 estudiante conectado' : `${result.count} estudiantes conectados`;
  } catch {
    message.classList.remove('success');
    message.textContent = 'No se pudo actualizar la lista de estudiantes.';
  } finally {
    refreshButton.disabled = false;
  }
});
