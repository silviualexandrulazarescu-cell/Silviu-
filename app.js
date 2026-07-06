/**
 * TimePilot OVB - Weekly Planner Application
 * Modern vanilla JavaScript weekly schedule manager with LocalStorage persistence
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    START_TIME: 8,
    END_TIME: 22,
    DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    STORAGE_KEY: 'timepilot_activities',
    CATEGORY_COLORS: {
        'Job': '#2563eb',                    // Blue
        'Free Time': '#a855f7',              // Purple
        'OVB Analysis': '#10b981',           // Green
        'OVB Consultation 1': '#f97316',     // Orange
        'OVB Consultation 2': '#eab308',     // Yellow
        'OVB Signing': '#ef4444',            // Red
    },
};

// ============================================
// STATE MANAGEMENT
// ============================================

const STATE = {
    activities: [],           // Store all activities with full data
    currentActivity: null,    // Track currently edited activity
    currentCell: null,        // Track currently selected cell
    activityIdCounter: 0,    // Counter for unique IDs
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
    modalHeader: document.querySelector('.modal-header h2'),
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeApplication();
});

/**
 * Initialize the application
 */
function initializeApplication() {
    loadActivitiesFromStorage();
    generatePlanner();
    renderActivitiesOnPlanner();
    attachEventListeners();
}

// ============================================
// LOCAL STORAGE MANAGEMENT
// ============================================

/**
 * Save activities to LocalStorage
 */
function saveActivitiesToStorage() {
    const data = STATE.activities.map(activity => ({
        ...activity,
    }));
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
}

/**
 * Load activities from LocalStorage
 */
function loadActivitiesFromStorage() {
    const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (stored) {
        try {
            STATE.activities = JSON.parse(stored);
            // Update counter to ensure new IDs are unique
            if (STATE.activities.length > 0) {
                STATE.activityIdCounter = Math.max(...STATE.activities.map(a => a.id)) + 1;
            }
        } catch (error) {
            console.error('Error loading activities from storage:', error);
            STATE.activities = [];
        }
    }
}

/**
 * Generate unique activity ID
 */
function generateActivityId() {
    return STATE.activityIdCounter++;
}

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
 * Generate a unique cell ID based on time and day
 */
function generateCellId(hour, dayIndex) {
    return `${String(hour).padStart(2, '0')}-${dayIndex}`;
}

/**
 * Find cell element by cell ID
 */
function findCellElement(cellId) {
    return document.querySelector(`[data-cell-id="${cellId}"]`);
}

// ============================================
// ACTIVITY RENDERING
// ============================================

/**
 * Render all activities on the planner
 */
function renderActivitiesOnPlanner() {
    // Clear all cells first
    document.querySelectorAll('.weekly-planner td.scheduled').forEach(cell => {
        cell.classList.remove('scheduled');
        cell.textContent = '';
        cell.title = '';
        cell.removeAttribute('data-activity-id');
        cell.style.backgroundColor = '';
    });

    // Render each activity
    STATE.activities.forEach(activity => {
        const cellId = generateCellId(activity.hour, activity.day);
        const cell = findCellElement(cellId);
        
        if (cell) {
            updateCellVisual(cell, activity);
        }
    });
}

/**
 * Update cell visual with activity data
 */
function updateCellVisual(cell, activity) {
    cell.classList.add('scheduled');
    cell.setAttribute('data-activity-id', activity.id);
    
    // Determine display text based on category
    let displayText = activity.category;
    if (activity.category === 'OVB' && activity.subtype) {
        displayText = `OVB\n${activity.subtype}`;
    }
    
    cell.textContent = displayText;
    cell.title = generateCellTooltip(activity);
    
    // Apply color based on full type
    const colorKey = getColorKeyForActivity(activity);
    const color = CONFIG.CATEGORY_COLORS[colorKey] || CONFIG.CATEGORY_COLORS['Job'];
    cell.style.backgroundColor = color;
}

/**
 * Get the color key for an activity
 */
function getColorKeyForActivity(activity) {
    if (activity.category === 'OVB') {
        return `OVB ${activity.subtype}`;
    }
    return activity.category;
}

/**
 * Generate tooltip text for a cell
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
        tooltip += `\nPhone: ${activity.phone}`;
    }
    if (activity.notes) {
        tooltip += `\nNotes: ${activity.notes}`;
    }
    return tooltip;
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

    // Check if there's an existing activity in this cell
    if (activityId) {
        const existingActivity = STATE.activities.find(a => a.id == activityId);
        if (existingActivity) {
            STATE.currentActivity = { ...existingActivity };
            populateFormWithData(STATE.currentActivity);
            DOM.modalHeader.textContent = 'Edit Activity';
            showDeleteButton();
        }
    } else {
        STATE.currentActivity = null;
        clearForm();
        DOM.modalHeader.textContent = 'Schedule Activity';
        hideDeleteButton();
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
        // Update existing activity
        const index = STATE.activities.findIndex(a => a.id === STATE.currentActivity.id);
        if (index !== -1) {
            STATE.activities[index] = activityData;
        }
    } else {
        // Add new activity
        STATE.activities.push(activityData);
    }

    // Save to localStorage
    saveActivitiesToStorage();

    // Re-render planner
    renderActivitiesOnPlanner();

    // Close modal
    closeModal();

    // Show confirmation message
    showAlert('Activity saved successfully!');
}

/**
 * Handle delete button click
 */
function handleDelete() {
    if (!STATE.currentActivity) return;

    if (confirm('Are you sure you want to delete this activity?')) {
        // Remove activity from state
        STATE.activities = STATE.activities.filter(a => a.id !== STATE.currentActivity.id);

        // Save to localStorage
        saveActivitiesToStorage();

        // Re-render planner
        renderActivitiesOnPlanner();

        // Close modal
        closeModal();

        // Show confirmation message
        showAlert('Activity deleted successfully!');
    }
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
    STATE.currentActivity = null;
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
        DOM.subcategorySelect.value = data.subtype || '';
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
 * Show delete button
 */
function showDeleteButton() {
    let deleteBtn = document.getElementById('deleteBtn');
    if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.id = 'deleteBtn';
        deleteBtn.className = 'btn btn-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', handleDelete);
        document.querySelector('.modal-footer').insertBefore(deleteBtn, DOM.saveBtn);
    }
    deleteBtn.style.display = 'block';
}

/**
 * Hide delete button
 */
function hideDeleteButton() {
    const deleteBtn = document.getElementById('deleteBtn');
    if (deleteBtn) {
        deleteBtn.style.display = 'none';
    }
}

// ============================================
// NOTIFICATIONS
// ============================================

/**
 * Show alert message
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
// UTILITIES
// ============================================

/**
 * Export schedule data
 */
function exportSchedules() {
    return JSON.parse(JSON.stringify(STATE.activities));
}

/**
 * Clear all schedules
 */
function clearAllSchedules() {
    if (confirm('Are you sure you want to clear all schedules? This cannot be undone.')) {
        STATE.activities = [];
        STATE.activityIdCounter = 0;
        saveActivitiesToStorage();
        renderActivitiesOnPlanner();
        showAlert('All activities cleared!');
    }
}

/**
 * Get activity by ID
 */
function getActivity(activityId) {
    return STATE.activities.find(a => a.id === activityId);
}

/**
 * Get all activities for a specific day
 */
function getActivitiesForDay(dayIndex) {
    return STATE.activities.filter(a => a.day === dayIndex);
}

/**
 * Get all activities for a specific hour
 */
function getActivitiesForHour(hour) {
    return STATE.activities.filter(a => a.hour === hour);
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
// ANIMATIONS & STYLES
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
