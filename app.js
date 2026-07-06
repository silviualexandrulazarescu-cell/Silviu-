/**
 * TimePilot OVB - Weekly Planner Application
 * Modern vanilla JavaScript weekly schedule manager
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    START_TIME: 8,
    END_TIME: 22,
    DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
};

// ============================================
// STATE MANAGEMENT
// ============================================

const STATE = {
    schedules: new Map(), // Store scheduled activities
    currentCell: null, // Track currently selected cell
};

// ============================================
// DOM ELEMENTS CACHE
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
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    generatePlanner();
    attachEventListeners();
});

// ============================================
// PLANNER GENERATION
// ============================================

/**
 * Generate the weekly planner table dynamically
 */
function generatePlanner() {
    const fragment = document.createDocumentFragment();

    for (let hour = CONFIG.START_TIME; hour <= CONFIG.END_TIME; hour++) {
        const row = document.createElement('tr');
        const timeCell = document.createElement('td');

        // Format time as HH:00
        const timeString = `${String(hour).padStart(2, '0')}:00`;
        timeCell.className = 'time-cell';
        timeCell.textContent = timeString;
        row.appendChild(timeCell);

        // Create cells for each day
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
 * Generate a unique cell ID
 */
function generateCellId(hour, dayIndex) {
    return `${String(hour).padStart(2, '0')}-${dayIndex}`;
}

// ============================================
// EVENT HANDLERS
// ============================================

/**
 * Handle cell click to open modal
 */
function handleCellClick(event) {
    if (event.target.classList.contains('time-cell')) {
        return;
    }

    const cell = event.target;
    const hour = parseInt(cell.getAttribute('data-time'));
    const dayIndex = parseInt(cell.getAttribute('data-day'));
    const cellId = cell.getAttribute('data-cell-id');

    STATE.currentCell = {
        element: cell,
        cellId: cellId,
        hour: hour,
        dayIndex: dayIndex,
        day: CONFIG.DAYS[dayIndex],
    };

    // Load existing data if available
    const existingData = STATE.schedules.get(cellId);
    if (existingData) {
        populateFormWithData(existingData);
    } else {
        clearForm();
    }

    // Update time info
    updateTimeInfo(hour, CONFIG.DAYS[dayIndex]);

    // Open modal
    openModal();
}

/**
 * Attach event listeners to modal controls
 */
function attachEventListeners() {
    DOM.categorySelect.addEventListener('change', handleCategoryChange);
    DOM.saveBtn.addEventListener('click', handleSave);
    DOM.cancelBtn.addEventListener('click', closeModal);
    DOM.modalClose.addEventListener('click', closeModal);
    DOM.modalOverlay.addEventListener('click', closeModal);
}

/**
 * Handle category selection change
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
 * Handle save button click
 */
function handleSave() {
    const category = DOM.categorySelect.value;

    if (!category) {
        showAlert('Please select a category');
        return;
    }

    if (category === 'OVB' && !DOM.subcategorySelect.value) {
        showAlert('Please select an OVB type');
        return;
    }

    const data = {
        category: category,
        subcategory: category === 'OVB' ? DOM.subcategorySelect.value : null,
        clientName: DOM.clientName.value.trim(),
        phone: DOM.phone.value.trim(),
        notes: DOM.notes.value.trim(),
    };

    // Save to state
    STATE.schedules.set(STATE.currentCell.cellId, data);

    // Update cell visual
    updateCellVisual(STATE.currentCell.element, data);

    // Close modal
    closeModal();

    // Optional: Show confirmation message
    console.log('Schedule saved:', data);
}

// ============================================
// MODAL MANAGEMENT
// ============================================

/**
 * Open the modal with animation
 */
function openModal() {
    DOM.modal.classList.add('active');
    DOM.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Close the modal with animation
 */
function closeModal() {
    DOM.modal.classList.remove('active');
    DOM.modalOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
    STATE.currentCell = null;
}

/**
 * Clear form fields
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
 * Populate form with existing data
 */
function populateFormWithData(data) {
    DOM.categorySelect.value = data.category;
    
    if (data.category === 'OVB') {
        DOM.subcategoryGroup.style.display = 'block';
        DOM.subcategorySelect.value = data.subcategory;
    } else {
        DOM.subcategoryGroup.style.display = 'none';
    }

    DOM.clientName.value = data.clientName || '';
    DOM.phone.value = data.phone || '';
    DOM.notes.value = data.notes || '';
}

/**
 * Update time information display
 */
function updateTimeInfo(hour, day) {
    const timeString = `${String(hour).padStart(2, '0')}:00`;
    DOM.timeInfo.innerHTML = `<strong>${day}</strong> at <strong>${timeString}</strong>`;
}

/**
 * Update cell visual after saving
 */
function updateCellVisual(cell, data) {
    cell.classList.add('scheduled');
    cell.textContent = data.category === 'OVB' 
        ? data.subcategory 
        : data.category;
    cell.title = generateCellTooltip(data);
}

/**
 * Generate tooltip text for a cell
 */
function generateCellTooltip(data) {
    let tooltip = `${data.category}`;
    if (data.subcategory) {
        tooltip += ` - ${data.subcategory}`;
    }
    if (data.clientName) {
        tooltip += `\nClient: ${data.clientName}`;
    }
    if (data.phone) {
        tooltip += `\nPhone: ${data.phone}`;
    }
    if (data.notes) {
        tooltip += `\nNotes: ${data.notes}`;
    }
    return tooltip;
}

/**
 * Show alert message (simple implementation)
 */
function showAlert(message) {
    // Create a simple toast-like notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #dc3545;
        color: white;
        padding: 15px 20px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================
// UTILITIES
// ============================================

/**
 * Export schedule data (for future API integration)
 */
function exportSchedules() {
    const data = {};
    STATE.schedules.forEach((value, key) => {
        data[key] = value;
    });
    return data;
}

/**
 * Clear all schedules
 */
function clearAllSchedules() {
    if (confirm('Are you sure you want to clear all schedules?')) {
        STATE.schedules.clear();
        document.querySelectorAll('.weekly-planner td.scheduled').forEach(cell => {
            cell.classList.remove('scheduled');
            cell.textContent = '';
            cell.title = '';
        });
    }
}

/**
 * Get schedule for a specific cell
 */
function getSchedule(cellId) {
    return STATE.schedules.get(cellId);
}

/**
 * Update schedule for a specific cell
 */
function updateSchedule(cellId, data) {
    if (data) {
        STATE.schedules.set(cellId, data);
    } else {
        STATE.schedules.delete(cellId);
    }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (event) => {
    // Close modal on Escape
    if (event.key === 'Escape' && DOM.modal.classList.contains('active')) {
        closeModal();
    }
});

// ============================================
// OPTIONAL: Add animation styles to document
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