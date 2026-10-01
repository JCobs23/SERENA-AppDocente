// Lista de estudiantes basada en el diseño
const studentsList = [
    "Ana García", "Carlos López", 
    "María Rodríguez", "Juan Martínez", 
    "Sofia Torres", "Diego Fernández", 
    "Valentina Cruz", "Lucas Ramirez", 
    "Isabella Santos", "Mateo Vargas", 
    "Camila Morales", "Santiago Ruiz"
];

const grid = document.getElementById('students-grid');
const counterText = document.getElementById('ready-counter');
const mainBtn = document.getElementById('main-status-btn');

// 1. Renderizar la lista inicial (Todos en rojo)
function renderStudents() {
    grid.innerHTML = '';
    studentsList.forEach((student, index) => {
        const div = document.createElement('div');
        div.className = 'student-item';
        // Asignamos un ID único al punto para poder cambiarlo a verde luego
        div.innerHTML = `<div class="dot" id="dot-${index}"></div> <span>${student}</span>`;
        grid.appendChild(div);
    });
}

// 2. Actualizar la interfaz gráfica según la cantidad de listos
function updateUI(readyCount) {
    const total = studentsList.length;
    counterText.textContent = `${readyCount}/${total} ready`;

    if (readyCount < total) {
        mainBtn.textContent = `Waiting for students (${readyCount}/${total})`;
        mainBtn.className = 'status-btn waiting';
    } else {
        mainBtn.textContent = `Students Ready!`;
        mainBtn.className = 'status-btn ready'; // Cambia a verde
    }
}

// Inicializar la vista
renderStudents();
updateUI(0);

// =====================================================================
// ⚠️ INICIO DE ZONA DE SIMULACIÓN (BORRAR CUANDO SE CONECTE A LA BD) ⚠️
// =====================================================================

let currentReadyCount = 0;

// Esta función simula que un estudiante se conecta cada 1 segundo (1000 ms)
const simulationInterval = setInterval(() => {
    if (currentReadyCount < studentsList.length) {
        // Obtenemos el punto del estudiante actual y le añadimos la clase 'ready' (verde)
        const dot = document.getElementById(`dot-${currentReadyCount}`);
        dot.classList.add('ready');
        
        currentReadyCount++;
        updateUI(currentReadyCount);
    } else {
        // Cuando todos están listos, detenemos el temporizador
        clearInterval(simulationInterval);
    }
}, 1000); 

// =====================================================================
// ⚠️ FIN DE ZONA DE SIMULACIÓN ⚠️
// =====================================================================


// --- Lógica del Modal (Instrucciones) ---
const modal = document.getElementById('controls-modal');
const btnHelp = document.getElementById('btn-help');
const btnClose = document.getElementById('close-modal');

// Abrir modal
btnHelp.addEventListener('click', () => {
    modal.classList.remove('hidden');
});

// Cerrar modal con la X
btnClose.addEventListener('click', () => {
    modal.classList.add('hidden');
});

// Cerrar modal haciendo clic afuera de la caja blanca
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.add('hidden');
    }
});