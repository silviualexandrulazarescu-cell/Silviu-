/**
 * TimePilot OVB - Aplicație Planificator Săptămânal
 * Manager modern cu sincronizare LocalStorage
 */

// ============================================
// CONFIGURAȚIE CULORI CENTRALIZATĂ
// ============================================

const ACTIVITY_COLORS = {
    // Categorii principale
    'Job': '#6B7280',              // Gri Modern
    'Timp liber': '#3B82F6',       // Albastru
    
    // Subtipuri OVB
    'OVB Analiză': '#F97316',      // Portocaliu
    'OVB Consultanță 1': '#38BDF8', // Albastru Deschis
    'OVB Consultanță 2': '#8B5CF6', // Violet
    'OVB Semnare': '#22C55E',       // Verde
};

// ============================================
// CONSTANTE SISTEM DESIGN
// ============================================

const DESIGN = {
    BORDER_RADIUS: '12px',
    SOFT_SHADOW: '0 4px 12px rgba(0, 0, 0, 0.1)',
    FONT_WEIGHT: '600',
    PADDING: '12px',
    TRANSITION_DURATION: '0.2s',
    HOVER_SCALE: '1.02',
    HOVER_BRIGHTNESS: '0.95',
};

// ============================================
// CONFIGURAȚIE
// ============================================

const CONFIG = {
    START_TIME: 8,
    END_TIME: 22,
    DAYS: ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'],
    STORAGE_KEY: 'timepilot_activities',
};

// ============================================
// GESTIONARE STARE
// ============================================

const STATE = {
    activities: [],           // Stochează toate activitățile cu date complete
    currentActivity: null,    // Urmărește activitatea editată curent
    currentCell: null,        // Urmărește celula selectată curent
    activityIdCounter: 0,     // Contor pentru ID-uri unice
};

// ============================================
// CACHE ELEMENTE DOM
// ============================================

const DOM = {
    plannerBody: document.getElementById('plannerBody'),
    modal: document.getElementById('scheduleModal'),
    modalOverlay: document.getElementById('modalOverlay'),
    categorySelect: document.getElementById('categorySelect'),
    subcategoryGroup: document.getElementById('subcategoryGroup'),
    subcategorySelect: document.getElementById('subcategorySelect'),
    clientName: document.getElementById('clientName'),
    phone: document.getElementById('phone'),
    notes: document.getElementById('notes'),
    timeInfo: document.getElementById('timeInfo'),
    saveBtn: document.getElementById('saveBtn'),
    cancelBtn: document.getElementById('cancelBtn'),
    modalClose: document.getElementById('modalClose'),
    modalHeader: document.querySelector('.modal-header h2'),
};

// ============================================
// INIȚIALIZARE
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApplication();
});

/**
 * Inițializează aplicația
 */
function initializeApplication() {
    loadActivitiesFromStorage();
    generatePlanner();
    renderActivitiesOnPlanner();
    attachEventListeners();
    injectActivityCardStyles();
}

// ============================================
// GESTIONARE STOCARE LOCALĂ
// ============================================

/**
 * Salvează activitățile în LocalStorage
 */
function saveActivitiesToStorage() {
    const data = STATE.activities.map(activity => ({
        ...activity,
    }));
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
}

/**
 * Încarcă activitățile din LocalStorage
 */
function loadActivitiesFromStorage() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (stored) {
        try {
            STATE.activities = JSON.parse(stored);
            // Actualizează contorul pentru a asigura ID-uri unice
            if (STATE.activities.length > 0) {
                STATE.activityIdCounter = Math.max(...STATE.activities.map(a => a.id)) + 1;
            }
        } catch (error) {
            console.error('Eroare la încărcarea activităților:', error);
            STATE.activities = [];
        }
    }
}

/**
 * Generează ID unic pentru activitate
 */
function generateActivityId() {
    return STATE.activityIdCounter++;
}

// ============================================
// GENERARE PLANIFICATOR
// ============================================

/**
 * Generează tabelul planificatorului săptămânal dinamic
 */
function generatePlanner() {
    const fragment = document.createDocumentFragment();

    for (let hour = CONFIG.START_TIME; hour <= CONFIG.END_TIME; hour++) {
        const row = document.createElement('tr');
        const timeCell = document.createElement('td');

        // Formatează ora ca HH:00
        const timeString = `${String(hour).padStart(2, '0')}:00`;
        timeCell.className = 'time-cell';
        timeCell.textContent = timeString;
        row.appendChild(timeCell);

        // Creează celule pentru fiecare zi
        for (let dayIndex = 0; dayIndex < CONFIG.DAYS.length; dayIndex++) {
            const cell = document.createElement('td');
            const cellId = generateCellId(hour, dayIndex);
            cell.setAttribute('data-time', hour);
            cell.setAttribute('data-day', dayIndex);
            cell.setAttribute('data-cell-id', cellId);
            cell.addEventListener('click', handleCellClick);

            row.appendChild(cell);
        }

        fragment.appendChild(row);
    }

    DOM.plannerBody.appendChild(fragment);
}

/**
 * Generează ID unic pentru celulă pe baza orei și zilei
 */
function generateCellId(hour, dayIndex) {
    return `${String(hour).padStart(2, '0')}-${dayIndex}`;
}

/**
 * Găsește element de celulă după ID
 */
function findCellElement(cellId) {
    return document.querySelector(`[data-cell-id="${cellId}"]`);
}

// ============================================
// RANDARE ACTIVITĂȚI
// ============================================

/**
 * Randează toate activitățile pe planificator
 */
function renderActivitiesOnPlanner() {
    // Șterge mai întâi toate celulele
    document.querySelectorAll('.weekly-planner td.scheduled').forEach(cell => {
        cell.classList.remove('scheduled');
        cell.textContent = '';
        cell.title = '';
        cell.removeAttribute('data-activity-id');
        cell.style.backgroundColor = '';
    });

    // Randează fiecare activitate
    STATE.activities.forEach(activity => {
        const cellId = generateCellId(activity.hour, activity.day);
        const cell = findCellElement(cellId);
        
        if (cell) {
            updateCellVisual(cell, activity);
        }
    });
}

/**
 * Obține culoarea pentru o activitate pe baza categoriei și subtipului
 */
function getActivityColor(activity) {
    if (activity.category === 'OVB' && activity.subtype) {
        const colorKey = `OVB ${activity.subtype}`;
        return ACTIVITY_COLORS[colorKey] || ACTIVITY_COLORS['Job'];
    }
    return ACTIVITY_COLORS[activity.category] || ACTIVITY_COLORS['Job'];
}

/**
 * Actualizează aspectul vizual al celulei cu date de activitate
 */
function updateCellVisual(cell, activity) {
    cell.classList.add('scheduled');
    cell.setAttribute('data-activity-id', activity.id);
    
    // Determină textul afișat pe baza categoriei
    let displayText = activity.category;
    if (activity.category === 'OVB' && activity.subtype) {
        displayText = `OVB\n${activity.subtype}`;
    }
    
    cell.textContent = displayText;
    cell.title = generateCellTooltip(activity);
    
    // Aplică culoarea din configurația centralizată
    const color = getActivityColor(activity);
    cell.style.backgroundColor = color;
}

/**
 * Generează textul sfatului pentru o celulă
 */
function generateCellTooltip(activity) {
    let tooltip = activity.category;
    if (activity.subtype) {
        tooltip += ` - ${activity.subtype}`;
    }
    if (activity.clientName) {
        tooltip += `\nClient: ${activity.clientName}`;
    }
    if (activity.phone) {
        tooltip += `\nTelefon: ${activity.phone}`;
    }
    if (activity.notes) {
        tooltip += `\nObservații: ${activity.notes}`;
    }
    return tooltip;
}

// ============================================
// MANIPULATORI Evenimente
// ============================================

/**
 * Gestionează clic pe celulă pentru a deschide modalul
 */
function handleCellClick(event) {
    if (event.target.classList.contains('time-cell')) {
        return;
    }

    const cell = event.target.closest('td');
    if (!cell) return;

    const hour = parseInt(cell.getAttribute('data-time'));
    const dayIndex = parseInt(cell.getAttribute('data-day'));
    const cellId = cell.getAttribute('data-cell-id');
    const activityId = cell.getAttribute('data-activity-id');

    STATE.currentCell = {
        element: cell,
        cellId: cellId,
        hour: hour,
        dayIndex: dayIndex,
        day: CONFIG.DAYS[dayIndex],
    };

    // Verifică dacă există o activitate existentă în această celulă
    if (activityId) {
        const existingActivity = STATE.activities.find(a => a.id == activityId);
        if (existingActivity) {
            STATE.currentActivity = { ...existingActivity };
            populateFormWithData(STATE.currentActivity);
            DOM.modalHeader.textContent = 'Editare Activitate';
            showDeleteButton();
        }
    } else {
        STATE.currentActivity = null;
        clearForm();
        DOM.modalHeader.textContent = 'Activitate';
        hideDeleteButton();
    }

    // Actualizează informații despre oră
    updateTimeInfo(hour, CONFIG.DAYS[dayIndex]);

    // Deschide modalul
    openModal();
}

/**
 * Atașează ascultători de evenimente la controalele modale
 */
function attachEventListeners() {
    DOM.categorySelect.addEventListener('change', handleCategoryChange);
    DOM.saveBtn.addEventListener('click', handleSave);
    DOM.cancelBtn.addEventListener('click', closeModal);
    DOM.modalClose.addEventListener('click', closeModal);
    DOM.modalOverlay.addEventListener('click', closeModal);
}

/**
 * Gestionează schimbarea selecției de categorie
 */
function handleCategoryChange(event) {
    const category = event.target.value;

    if (category === 'OVB') {
        DOM.subcategoryGroup.style.display = 'block';
    } else {
        DOM.subcategoryGroup.style.display = 'none';
    }
}

/**
 * Gestionează clic pe butonul de salvare
 */
function handleSave() {
    const category = DOM.categorySelect.value;

    if (!category) {
        showAlert('Te rog să selectezi o categorie');
        return;
    }

    if (category === 'OVB' && !DOM.subcategorySelect.value) {
        showAlert('Te rog să selectezi un tip de activitate');
        return;
    }

    const activityData = {
        id: STATE.currentActivity ? STATE.currentActivity.id : generateActivityId(),
        category: category,
        subtype: category === 'OVB' ? DOM.subcategorySelect.value : null,
        clientName: DOM.clientName.value.trim(),
        phone: DOM.phone.value.trim(),
        notes: DOM.notes.value.trim(),
        day: STATE.currentCell.dayIndex,
        hour: STATE.currentCell.hour,
    };

    if (STATE.currentActivity) {
        // Actualizează activitate existentă
        const index = STATE.activities.findIndex(a => a.id === STATE.currentActivity.id);
        if (index !== -1) {
            STATE.activities[index] = activityData;
        }
    } else {
        // Adaugă activitate nouă
        STATE.activities.push(activityData);
    }

    // Salvează în localStorage
    saveActivitiesToStorage();

    // Re-randează planificatorul
    renderActivitiesOnPlanner();

    // Închide modalul
    closeModal();

    // Afișează mesajul de confirmare
    showAlert('Activitate salvată cu succes!');
}

/**
 * Gestionează clic pe butonul de ștergere
 */
function handleDelete() {
    if (!STATE.currentActivity) return;

    if (confirm('Ești sigur că vrei să ștergi această activitate?')) {
        // Elimină activitate din stare
        STATE.activities = STATE.activities.filter(a => a.id !== STATE.currentActivity.id);

        // Salvează în localStorage
        saveActivitiesToStorage();

        // Re-randează planificatorul
        renderActivitiesOnPlanner();

        // Închide modalul
        closeModal();

        // Afișează mesajul de confirmare
        showAlert('Activitate ștearsă cu succes!');
    }
}

// ============================================
// GESTIONARE MODAL
// ============================================

/**
 * Deschide modalul cu animație
 */
function openModal() {
    DOM.modal.classList.add('active');
    DOM.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Închide modalul cu animație
 */
function closeModal() {
    DOM.modal.classList.remove('active');
    DOM.modalOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
    STATE.currentCell = null;
    STATE.currentActivity = null;
}

/**
 * Șterge câmpurile formularului
 */
function clearForm() {
    DOM.categorySelect.value = '';
    DOM.subcategorySelect.value = '';
    DOM.subcategoryGroup.style.display = 'none';
    DOM.clientName.value = '';
    DOM.phone.value = '';
    DOM.notes.value = '';
}

/**
 * Completează formularul cu date existente
 */
function populateFormWithData(data) {
    DOM.categorySelect.value = data.category;

    if (data.category === 'OVB') {
        DOM.subcategoryGroup.style.display = 'block';
        DOM.subcategorySelect.value = data.subtype || '';
    } else {
        DOM.subcategoryGroup.style.display = 'none';
    }

    DOM.clientName.value = data.clientName || '';
    DOM.phone.value = data.phone || '';
    DOM.notes.value = data.notes || '';
}

/**
 * Actualizează afișajul informațiilor despre oră
 */
function updateTimeInfo(hour, day) {
    const timeString = `${String(hour).padStart(2, '0')}:00`;
    DOM.timeInfo.innerHTML = `<strong>${day}</strong> la <strong>${timeString}</strong>`;
}

/**
 * Afișează butonul de ștergere
 */
function showDeleteButton() {
    let deleteBtn = document.getElementById('deleteBtn');
    if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.id = 'deleteBtn';
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Șterge';
        deleteBtn.addEventListener('click', handleDelete);
        document.querySelector('.modal-footer').insertBefore(deleteBtn, DOM.saveBtn);
    }
    deleteBtn.style.display = 'block';
}

/**
 * Ascunde butonul de ștergere
 */
function hideDeleteButton() {
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
}

// ============================================
// NOTIFICĂRI
// ============================================

/**
 * Afișează mesaj de alertă
 */
function showAlert(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #10b981;
        color: white;
        padding: 15px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 2000;
        animation: slideIn 0.3s ease;
        font-weight: 500;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// UTILITARE
// ============================================

/**
 * Exportă date de planificare
 */
function exportSchedules() {
    return JSON.parse(JSON.stringify(STATE.activities));
}

/**
 * Șterge toate planificările
 */
function clearAllSchedules() {
    if (confirm('Ești sigur că vrei să ștergi toate activitățile? Aceasta nu poate fi anulată.')) {
        STATE.activities = [];
        STATE.activityIdCounter = 0;
        saveActivitiesToStorage();
        renderActivitiesOnPlanner();
        showAlert('Toate activitățile au fost șterse!');
    }
}

/**
 * Obține activitate după ID
 */
function getActivity(activityId) {
    return STATE.activities.find(a => a.id === activityId);
}

/**
 * Obține toate activitățile pentru o zi specifică
 */
function getActivitiesForDay(dayIndex) {
    return STATE.activities.filter(a => a.day === dayIndex);
}

/**
 * Obține toate activitățile pentru o oră specifică
 */
function getActivitiesForHour(hour) {
    return STATE.activities.filter(a => a.hour === hour);
}

// ============================================
// STILIZARE CARDURI ACTIVITATE
// ============================================

/**
 * Injectează stiluri pentru cardurile de activitate cu reguli sistem design
 */
function injectActivityCardStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .weekly-planner td.scheduled {
            border-radius: ${DESIGN.BORDER_RADIUS} !important;
            box-shadow: ${DESIGN.SOFT_SHADOW} !important;
            font-weight: ${DESIGN.FONT_WEIGHT} !important;
            padding: ${DESIGN.PADDING} !important;
            transition: all ${DESIGN.TRANSITION_DURATION} ease !important;
            white-space: pre-wrap;
            word-wrap: break-word;
            color: white;
            cursor: pointer;
        }

        .weekly-planner td.scheduled:hover {
            transform: scale(${DESIGN.HOVER_SCALE});
            filter: brightness(${DESIGN.HOVER_BRIGHTNESS});
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
        }

        .btn-danger {
            background-color: #ef4444;
            color: white;
            order: -1;
        }

        .btn-danger:hover:not(:disabled) {
            background-color: #dc2626;
            box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.3);
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// COMENZI TASTATURĂ
// ============================================

document.addEventListener('keydown', (event) => {
    // Închide modalul pe Escape
    if (event.key === 'Escape' && DOM.modal.classList.contains('active')) {
        closeModal();
    }
});

// ============================================
// ANIMAȚII
// ============================================

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
