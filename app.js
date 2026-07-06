/**
 * TimePilot OVB - Aplicație Planificator Săptămânal
 * Manager modern cu sincronizare LocalStorage
 * 
 * REWRITTEN RENDERING ENGINE:
 * - Uses Map for O(1) cell lookup
 * - No querySelector() in rendering loops
 * - Perfect day/hour isolation
 * - Immutable activity IDs via crypto.randomUUID() or counter
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
    DAY_NAMES: ['luni', 'marti', 'miercuri', 'joi', 'vineri', 'sambata', 'duminica'],
    STORAGE_KEY: 'timepilot_activities',
};

// ============================================
// GESTIONARE STARE
// ============================================

const STATE = {
    activities: [],           // Array of activity objects with immutable id
    currentActivity: null,    // Currently edited activity (copy)
    currentCell: null,        // Currently selected cell with explicit day and hour
    activityIdCounter: 0,     // Counter for unique immutable IDs
    plannerCells: new Map(),  // Map for O(1) cell lookup: key="${dayName}-${hour}:00" -> td element
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
 * Păstrează structura completă: id, category, subtype, day, hour, clientName, phone, notes
 */
function saveActivitiesToStorage() {
    const data = STATE.activities.map(activity => ({
        id: activity.id,
        category: activity.category,
        subtype: activity.subtype,
        day: activity.day,
        hour: activity.hour,
        clientName: activity.clientName,
        phone: activity.phone,
        notes: activity.notes,
    }));
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
}

/**
 * Încarcă activitățile din LocalStorage
 * Validează că fiecare activitate are id, day, hour explicit
 */
function loadActivitiesFromStorage() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (stored) {
        try {
            const loaded = JSON.parse(stored);
            
            // Validează și filtrează activitățile invalide
            STATE.activities = loaded.filter(activity => {
                // Verifică că fiecare activitate are ID unic și explicit
                if (typeof activity.id !== 'number' && typeof activity.id !== 'string') {
                    console.warn('Activitate cu ID invalid ignora:', activity);
                    return false;
                }
                
                // Verifică că day și hour sunt stocate explicit
                if (typeof activity.day !== 'number' || activity.day < 0 || activity.day > 6) {
                    console.warn('Activitate cu day invalid ignora:', activity);
                    return false;
                }
                if (typeof activity.hour !== 'number' || activity.hour < CONFIG.START_TIME || activity.hour > CONFIG.END_TIME) {
                    console.warn('Activitate cu hour invalid ignora:', activity);
                    return false;
                }
                
                return true;
            });
            
            // Actualizează contorul pentru a asigura ID-uri unice în viitor
            if (STATE.activities.length > 0) {
                const numericIds = STATE.activities
                    .filter(a => typeof a.id === 'number')
                    .map(a => a.id);
                if (numericIds.length > 0) {
                    STATE.activityIdCounter = Math.max(...numericIds) + 1;
                }
            }
            
            console.log(`Încărcate ${STATE.activities.length} activități din LocalStorage`);
        } catch (error) {
            console.error('Eroare la încărcarea activităților:', error);
            STATE.activities = [];
        }
    }
}

/**
 * Generează ID unic immutable pentru o nouă activitate
 * Folosește numeric counter (compatible cu localStorage)
 */
function generateActivityId() {
    return STATE.activityIdCounter++;
}

// ============================================
// GENERARE PLANIFICATOR
// ============================================

/**
 * Generează tabelul planificatorului săptămânal
 * 
 * CRITICAL NEW APPROACH:
 * 1. Creates cells with data-day (string name) and data-hour (formatted time)
 * 2. Builds STATE.plannerCells Map: key = "${dayName}-${hour}:00" -> td element
 * 3. Zero querySelector() calls in rendering
 */
function generatePlanner() {
    const fragment = document.createDocumentFragment();
    STATE.plannerCells.clear(); // Reset Map

    for (let hour = CONFIG.START_TIME; hour <= CONFIG.END_TIME; hour++) {
        const row = document.createElement('tr');
        const timeCell = document.createElement('td');

        // Formatează ora ca HH:00
        const timeString = `${String(hour).padStart(2, '0')}:00`;
        timeCell.className = 'time-cell';
        timeCell.textContent = timeString;
        row.appendChild(timeCell);

        // Creează celule pentru fiecare zi (0-6: Luni-Duminică)
        for (let dayIndex = 0; dayIndex < CONFIG.DAYS.length; dayIndex++) {
            const cell = document.createElement('td');
            const dayName = CONFIG.DAY_NAMES[dayIndex];
            
            // Set attributes with proper format
            cell.setAttribute('data-day', dayName);
            cell.setAttribute('data-hour', timeString);
            cell.addEventListener('click', handleCellClick);

            // BUILD THE MAP: key = "${dayName}-${hour}:00" -> td
            const cellKey = `${dayName}-${timeString}`;
            STATE.plannerCells.set(cellKey, cell);
            
            console.log(`Planifier cell registered: ${cellKey}`);

            row.appendChild(cell);
        }

        fragment.appendChild(row);
    }

    DOM.plannerBody.appendChild(fragment);
    console.log(`Planner generated with ${STATE.plannerCells.size} cells`);
}

// ============================================
// RANDARE ACTIVITĂȚI - MOTORUL RESCRIS
// ============================================

/**
 * Randează toate activitățile pe planificator
 * 
 * REWRITTEN ENGINE:
 * 1. Clears all cells
 * 2. For each activity, uses Map.get() - NO querySelector()
 * 3. Perfect day/hour isolation guaranteed
 */
function renderActivitiesOnPlanner() {
    // PASUL 1: Clear all cells via Map
    STATE.plannerCells.forEach(cell => {
        clearCell(cell);
    });

    // PASUL 2: Render each activity using Map lookup
    STATE.activities.forEach(activity => {
        // Validate activity
        if (!validateActivity(activity)) {
            return;
        }

        // BUILD KEY: day (0-6) to dayName, then "${dayName}-${hour}:00"
        const dayName = CONFIG.DAY_NAMES[activity.day];
        const hourString = `${String(activity.hour).padStart(2, '0')}:00`;
        const cellKey = `${dayName}-${hourString}`;

        // CRITICAL: Use Map.get() - NEVER querySelector() in loop
        const cell = STATE.plannerCells.get(cellKey);
        
        if (cell) {
            updateCellVisual(cell, activity);
            console.log(`✓ Rendered activity id=${activity.id} in cell key="${cellKey}"`);
        } else {
            console.error(`✗ Cell NOT found for activity id=${activity.id}, key="${cellKey}"`);
        }
    });
}

/**
 * Validează o activitate
 */
function validateActivity(activity) {
    if (!activity.id) {
        console.error('Activitate fără ID valid:', activity);
        return false;
    }
    if (typeof activity.day !== 'number' || activity.day < 0 || activity.day > 6) {
        console.error('Activitate cu day invalid:', activity);
        return false;
    }
    if (typeof activity.hour !== 'number' || activity.hour < CONFIG.START_TIME || activity.hour > CONFIG.END_TIME) {
        console.error('Activitate cu hour invalid:', activity);
        return false;
    }
    return true;
}

/**
 * Clears a cell back to empty state
 */
function clearCell(cell) {
    cell.classList.remove('scheduled');
    cell.textContent = '';
    cell.title = '';
    cell.removeAttribute('data-activity-id');
    cell.style.backgroundColor = '';
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
// MANIPULATORI EVENIMENTE
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

    // Read day (as name) and hour from cell attributes
    const dayName = cell.getAttribute('data-day');
    const hourString = cell.getAttribute('data-hour');
    const activityId = cell.getAttribute('data-activity-id');

    // Validate
    if (!dayName || !hourString) {
        console.error('Eroare: Celula nu are atributele data-day sau data-hour valide');
        return;
    }

    // Convert dayName back to dayIndex
    const dayIndex = CONFIG.DAY_NAMES.indexOf(dayName);
    const hour = parseInt(hourString);

    if (dayIndex < 0 || isNaN(hour)) {
        console.error('Eroare: Coordonate celulei invalide');
        return;
    }

    // Salvează informații explicite despre celula selectată
    STATE.currentCell = {
        element: cell,
        hour: hour,
        dayIndex: dayIndex,
        day: CONFIG.DAYS[dayIndex],
        dayName: dayName,
    };

    // Verifică dacă există o activitate existentă în această celulă
    if (activityId) {
        // Găsește activitatea după ID (nu după index!)
        const existingActivity = STATE.activities.find(a => String(a.id) === String(activityId));
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
 * 
 * REGULI STRICTE:
 * - day și hour vin ÎNTOTDEAUNA de la STATE.currentCell
 * - id rămâne IMMUTABLE
 * - Fiecare activitate are day și hour EXPLICIT
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

    // Validare: STATE.currentCell trebuie să fie setată
    if (!STATE.currentCell) {
        console.error('currentCell nu este setată!');
        showAlert('Eroare: Celula nu este selectată');
        return;
    }

    const activityData = {
        id: STATE.currentActivity ? STATE.currentActivity.id : generateActivityId(),
        category: category,
        subtype: category === 'OVB' ? DOM.subcategorySelect.value : null,
        clientName: DOM.clientName.value.trim(),
        phone: DOM.phone.value.trim(),
        notes: DOM.notes.value.trim(),
        day: STATE.currentCell.dayIndex,        // EXPLICIT de la celula selectată
        hour: STATE.currentCell.hour,           // EXPLICIT de la celula selectată
    };

    // Validare: day și hour sunt ÎNTOTDEAUNA valide
    if (typeof activityData.day !== 'number' || activityData.day < 0 || activityData.day > 6) {
        console.error('Activitate cu day invalid:', activityData);
        showAlert('Eroare: Ziua nu este validă');
        return;
    }
    if (typeof activityData.hour !== 'number' || activityData.hour < CONFIG.START_TIME || activityData.hour > CONFIG.END_TIME) {
        console.error('Activitate cu hour invalid:', activityData);
        showAlert('Eroare: Ora nu este validă');
        return;
    }

    if (STATE.currentActivity) {
        // EDITARE: Actualizează activitate existentă după ID
        const index = STATE.activities.findIndex(a => a.id === STATE.currentActivity.id);
        if (index !== -1) {
            STATE.activities[index] = activityData;
            console.log(`✓ Activity updated: id=${activityData.id}, day=${activityData.day}, hour=${activityData.hour}`);
        }
    } else {
        // CREARE: Adaugă activitate nouă
        STATE.activities.push(activityData);
        console.log(`✓ Activity created: id=${activityData.id}, day=${activityData.day}, hour=${activityData.hour}`);
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
 * 
 * CRITICAL: Delete ONLY by ID, never by index
 */
function handleDelete() {
    if (!STATE.currentActivity) return;

    if (confirm('Ești sigur că vrei să ștergi această activitate?')) {
        const idToDelete = STATE.currentActivity.id;
        
        // Delete ONLY the activity with matching ID
        const originalCount = STATE.activities.length;
        STATE.activities = STATE.activities.filter(a => a.id !== idToDelete);
        const deletedCount = originalCount - STATE.activities.length;
        
        console.log(`✓ Activity deleted: id=${idToDelete}, remaining=${STATE.activities.length}`);
        
        if (deletedCount === 0) {
            console.warn('⚠ Warning: No activities were deleted!');
        }

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
 * Obține activitate după ID (nu după index)
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
