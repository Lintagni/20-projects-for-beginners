/* ===== Habit Tracker App ===== */

// ---- Data Model ----
// habits: [{ id, name, createdAt (YYYY-MM-DD), completions: [YYYY-MM-DD, ...] }]
// theme: 'light' | 'dark'

const STORAGE_KEY = 'habitTracker_v1';

const ACHIEVEMENTS = [
  { id: 'first_habit',  icon: '🌱', name: 'First Step',      desc: 'Add your first habit',               type: 'global',  condition: (habits) => habits.length >= 1,                            streakReq: 0 },
  { id: 'five_habits',  icon: '🌿', name: 'Multi-tasker',    desc: 'Track 5 habits at once',              type: 'global',  condition: (habits) => habits.length >= 5,                            streakReq: 0 },
  { id: 'streak_3',     icon: '🔥', name: 'On Fire',         desc: 'Reach a 3-day streak on any habit',   type: 'streak',  streakReq: 3  },
  { id: 'streak_7',     icon: '⚡', name: 'Week Warrior',    desc: 'Reach a 7-day streak on any habit',   type: 'streak',  streakReq: 7  },
  { id: 'streak_14',    icon: '💪', name: 'Two Weeks Strong', desc: '14-day streak on any habit',         type: 'streak',  streakReq: 14 },
  { id: 'streak_21',    icon: '🏆', name: 'Habit Formed',    desc: '21-day streak — a new habit is born!',type: 'streak',  streakReq: 21 },
  { id: 'streak_30',    icon: '🌟', name: 'One Month',       desc: '30-day streak on any habit',          type: 'streak',  streakReq: 30 },
  { id: 'streak_60',    icon: '💫', name: 'Two Months',      desc: '60-day streak on any habit',          type: 'streak',  streakReq: 60 },
  { id: 'streak_100',   icon: '🚀', name: 'Century',         desc: '100-day streak on any habit',         type: 'streak',  streakReq: 100},
  { id: 'streak_365',   icon: '👑', name: 'Year of Habit',   desc: '365-day streak — legendary!',         type: 'streak',  streakReq: 365},
];

// ---- State ----
let state = {
  habits: [],
  theme: 'light',
};

let editingId = null;
let deletingId = null;
let calendarYear = null;
let calendarMonth = null;

// ---- Utilities ----
function todayStr() {
  return formatDate(new Date());
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(str) {
  // Parse YYYY-MM-DD without timezone issues
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---- Streak Calculation ----
// Returns the current streak ending on today or yesterday (so not broken on current day)
function calcStreak(completions) {
  if (!completions || completions.length === 0) return 0;

  const sorted = [...completions].sort();
  const today = todayStr();
  const yesterday = formatDate(new Date(Date.now() - 86400000));

  // Check if habit was completed today or yesterday to consider streak active
  const lastCompletion = sorted[sorted.length - 1];
  if (lastCompletion !== today && lastCompletion !== yesterday) return 0;

  let streak = 0;
  let current = lastCompletion === today ? today : yesterday;

  const set = new Set(completions);

  while (set.has(current)) {
    streak++;
    // Go back one day
    const d = parseDate(current);
    d.setDate(d.getDate() - 1);
    current = formatDate(d);
  }

  return streak;
}

// Returns the longest ever streak for a habit
function calcLongestStreak(completions) {
  if (!completions || completions.length === 0) return 0;

  const sorted = [...new Set(completions)].sort();
  let longest = 1;
  let current = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDate(sorted[i - 1]);
    const curr = parseDate(sorted[i]);
    const diff = Math.round((curr - prev) / 86400000);
    if (diff === 1) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
}

// ---- Storage ----
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.habits = parsed.habits || [];
      state.theme = parsed.theme || 'light';
    }
  } catch (e) {
    console.error('Failed to load state', e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

// ---- Theme ----
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(state.theme);
  saveState();
}

// ---- Toast ----
let toastTimeout = null;

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden', 'fade-out');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2200);
}

// ---- Render Today View ----
function renderHabits() {
  const list = document.getElementById('habitsList');
  const empty = document.getElementById('emptyState');
  const today = todayStr();

  list.innerHTML = '';

  if (state.habits.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  state.habits.forEach((habit) => {
    const isCompleted = habit.completions.includes(today);
    const streak = calcStreak(habit.completions);

    const card = document.createElement('div');
    card.className = `habit-card${isCompleted ? ' completed' : ''}`;
    card.dataset.id = habit.id;

    card.innerHTML = `
      <input
        type="checkbox"
        class="habit-checkbox"
        ${isCompleted ? 'checked' : ''}
        aria-label="Mark ${escapeHtml(habit.name)} as complete"
      />
      <div class="habit-info">
        <div class="habit-name">${escapeHtml(habit.name)}</div>
        <div class="habit-meta">
          ${streak > 0
            ? `<span class="streak-badge"><span class="flame">🔥</span> ${streak} day${streak !== 1 ? 's' : ''}</span>`
            : `<span class="streak-zero">No streak yet</span>`
          }
        </div>
      </div>
      <div class="habit-actions">
        <button class="btn-icon edit-btn" title="Edit" aria-label="Edit habit">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-icon delete-btn" title="Delete" aria-label="Delete habit">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
        </button>
      </div>
    `;

    // Checkbox toggle
    const checkbox = card.querySelector('.habit-checkbox');
    checkbox.addEventListener('change', () => toggleCompletion(habit.id));

    // Edit
    card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(habit.id));

    // Delete
    card.querySelector('.delete-btn').addEventListener('click', () => openDeleteModal(habit.id));

    list.appendChild(card);
  });
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---- Toggle Completion ----
function toggleCompletion(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  const today = todayStr();
  const idx = habit.completions.indexOf(today);

  if (idx === -1) {
    habit.completions.push(today);
    // Check for new achievements
    const streak = calcStreak(habit.completions);
    const newAchievements = checkNewAchievements(streak);
    if (newAchievements.length > 0) {
      setTimeout(() => {
        newAchievements.forEach(a => showToast(`🎉 Achievement unlocked: ${a.name}!`));
      }, 300);
    }
  } else {
    habit.completions.splice(idx, 1);
  }

  saveState();
  renderHabits();
  updateCalendarHabitSelect();
}

// Check if a streak value unlocks new achievements (streak-type ones)
function checkNewAchievements(streak) {
  return ACHIEVEMENTS.filter(a => a.type === 'streak' && a.streakReq === streak);
}

// ---- Add Habit ----
function addHabit(name) {
  const trimmed = name.trim();
  if (!trimmed) return;

  const habit = {
    id: uid(),
    name: trimmed,
    createdAt: todayStr(),
    completions: [],
  };

  state.habits.push(habit);
  saveState();
  renderHabits();
  updateCalendarHabitSelect();

  // Check first habit achievement
  if (state.habits.length === 1) {
    showToast('🌱 Achievement unlocked: First Step!');
  } else if (state.habits.length === 5) {
    showToast('🌿 Achievement unlocked: Multi-tasker!');
  }
}

// ---- Edit Modal ----
function openEditModal(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  editingId = id;
  const input = document.getElementById('editInput');
  input.value = habit.name;
  document.getElementById('editModal').classList.remove('hidden');
  setTimeout(() => input.focus(), 50);
}

function closeEditModal() {
  editingId = null;
  document.getElementById('editModal').classList.add('hidden');
}

function saveEdit() {
  if (!editingId) return;
  const input = document.getElementById('editInput');
  const name = input.value.trim();
  if (!name) return;

  const habit = state.habits.find(h => h.id === editingId);
  if (habit) {
    habit.name = name;
    saveState();
    renderHabits();
    updateCalendarHabitSelect();
    showToast('Habit updated');
  }
  closeEditModal();
}

// ---- Delete Modal ----
function openDeleteModal(id) {
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  deletingId = id;
  document.getElementById('deleteHabitName').textContent = habit.name;
  document.getElementById('deleteModal').classList.remove('hidden');
}

function closeDeleteModal() {
  deletingId = null;
  document.getElementById('deleteModal').classList.add('hidden');
}

function confirmDelete() {
  if (!deletingId) return;

  state.habits = state.habits.filter(h => h.id !== deletingId);
  saveState();
  renderHabits();
  updateCalendarHabitSelect();
  renderCalendar();
  showToast('Habit deleted');
  closeDeleteModal();
}

// ---- Calendar ----
function updateCalendarHabitSelect() {
  const sel = document.getElementById('calendarHabitSelect');
  const prevValue = sel.value;
  sel.innerHTML = '';

  if (state.habits.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'No habits yet';
    sel.appendChild(opt);
    return;
  }

  state.habits.forEach(habit => {
    const opt = document.createElement('option');
    opt.value = habit.id;
    opt.textContent = habit.name;
    sel.appendChild(opt);
  });

  // Keep previous selection if still valid
  if (prevValue && state.habits.find(h => h.id === prevValue)) {
    sel.value = prevValue;
  }
}

function renderCalendar() {
  const sel = document.getElementById('calendarHabitSelect');
  const habitId = sel.value;
  const habit = state.habits.find(h => h.id === habitId);

  const title = document.getElementById('calendarTitle');
  const grid = document.getElementById('calendarGrid');

  const now = new Date();
  if (!calendarYear) calendarYear = now.getFullYear();
  if (calendarMonth === null) calendarMonth = now.getMonth();

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  title.textContent = `${monthNames[calendarMonth]} ${calendarYear}`;

  const today = todayStr();
  const createdAt = habit ? habit.createdAt : null;

  // Build grid
  const firstDay = new Date(calendarYear, calendarMonth, 1);
  const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sun
  const totalDays = lastDay.getDate();

  const completionSet = habit ? new Set(habit.completions) : new Set();

  let html = `
    <div class="calendar-weekdays">
      <div class="calendar-weekday">Sun</div>
      <div class="calendar-weekday">Mon</div>
      <div class="calendar-weekday">Tue</div>
      <div class="calendar-weekday">Wed</div>
      <div class="calendar-weekday">Thu</div>
      <div class="calendar-weekday">Fri</div>
      <div class="calendar-weekday">Sat</div>
    </div>
    <div class="calendar-days">
  `;

  // Empty cells before first day
  for (let i = 0; i < startDow; i++) {
    html += `<div class="calendar-day empty"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    let cls = 'calendar-day';

    if (dateStr === today) cls += ' today';

    if (habit) {
      const afterCreation = createdAt ? dateStr >= createdAt : false;
      if (dateStr > today) {
        cls += ' future';
      } else if (!afterCreation) {
        cls += ' out-of-range';
      } else if (completionSet.has(dateStr)) {
        cls += ' completed';
      } else {
        cls += ' missed';
      }
    } else {
      if (dateStr > today) cls += ' future';
    }

    html += `<div class="${cls}" title="${dateStr}">${day}</div>`;
  }

  html += '</div>';
  grid.innerHTML = html;
}

function prevMonth() {
  calendarMonth--;
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
  renderCalendar();
}

function nextMonth() {
  calendarMonth++;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
  renderCalendar();
}

// ---- Achievements ----
function renderAchievements() {
  const list = document.getElementById('achievementsList');
  list.innerHTML = '';

  // Compute unlocked achievements
  const unlockedIds = new Set();
  const unlockedHabit = new Map(); // achievementId -> habit name

  // Global achievements
  ACHIEVEMENTS.forEach(a => {
    if (a.type === 'global' && a.condition(state.habits)) {
      unlockedIds.add(a.id);
    }
  });

  // Streak achievements: check each habit's current and longest streak
  state.habits.forEach(habit => {
    const streak = calcStreak(habit.completions);
    const longest = calcLongestStreak(habit.completions);
    const best = Math.max(streak, longest);

    ACHIEVEMENTS.forEach(a => {
      if (a.type === 'streak' && best >= a.streakReq) {
        unlockedIds.add(a.id);
        if (!unlockedHabit.has(a.id)) {
          unlockedHabit.set(a.id, habit.name);
        }
      }
    });
  });

  if (unlockedIds.size === 0 && state.habits.length === 0) {
    list.innerHTML = '<div class="no-achievements">Add habits and start tracking to earn achievements!</div>';
    return;
  }

  ACHIEVEMENTS.forEach(a => {
    const unlocked = unlockedIds.has(a.id);
    const div = document.createElement('div');
    div.className = `achievement-item${unlocked ? ' unlocked' : ''}`;

    const habitName = unlockedHabit.get(a.id);

    div.innerHTML = `
      <div class="achievement-icon">${a.icon}</div>
      <div class="achievement-info">
        <div class="achievement-name">${a.name}</div>
        <div class="achievement-desc">${a.desc}</div>
        ${unlocked && habitName ? `<div class="achievement-habit">via "${escapeHtml(habitName)}"</div>` : ''}
      </div>
      <div class="achievement-badge">${unlocked ? 'Unlocked' : a.type === 'streak' ? `${a.streakReq}d` : 'Locked'}</div>
    `;
    list.appendChild(div);
  });
}

// ---- Date Header ----
function renderDateHeader() {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const now = new Date();
  document.getElementById('todayLabel').textContent = days[now.getDay()];
  document.getElementById('todayDate').textContent = `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

// ---- View Switching ----
function switchView(view) {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(t => t.classList.toggle('active', t.dataset.view === view));

  document.getElementById('todayView').classList.toggle('hidden', view !== 'today');
  document.getElementById('calendarView').classList.toggle('hidden', view !== 'calendar');

  if (view === 'calendar') {
    const now = new Date();
    if (calendarMonth === null) calendarMonth = now.getMonth();
    if (!calendarYear) calendarYear = now.getFullYear();
    updateCalendarHabitSelect();
    renderCalendar();
  }
}

// ---- Event Listeners ----
function bindEvents() {
  // Add habit form
  document.getElementById('addHabitForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('habitInput');
    addHabit(input.value);
    input.value = '';
    input.focus();
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // View tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Calendar navigation
  document.getElementById('prevMonth').addEventListener('click', prevMonth);
  document.getElementById('nextMonth').addEventListener('click', nextMonth);

  // Calendar habit select
  document.getElementById('calendarHabitSelect').addEventListener('change', renderCalendar);

  // Edit modal
  document.getElementById('editCancel').addEventListener('click', closeEditModal);
  document.getElementById('editSave').addEventListener('click', saveEdit);
  document.getElementById('editInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') closeEditModal();
  });
  document.querySelector('#editModal .modal-backdrop').addEventListener('click', closeEditModal);

  // Delete modal
  document.getElementById('deleteCancel').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteConfirm').addEventListener('click', confirmDelete);
  document.querySelector('#deleteModal .modal-backdrop').addEventListener('click', closeDeleteModal);

  // Achievements modal
  document.getElementById('achievementsBtn').addEventListener('click', () => {
    renderAchievements();
    document.getElementById('achievementsModal').classList.remove('hidden');
  });
  document.getElementById('achievementsClose').addEventListener('click', () => {
    document.getElementById('achievementsModal').classList.add('hidden');
  });
  document.querySelector('#achievementsModal .modal-backdrop').addEventListener('click', () => {
    document.getElementById('achievementsModal').classList.add('hidden');
  });

  // Global Escape key to close modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeEditModal();
      closeDeleteModal();
      document.getElementById('achievementsModal').classList.add('hidden');
    }
  });
}

// ---- Init ----
function init() {
  loadState();
  applyTheme(state.theme);
  renderDateHeader();
  renderHabits();
  bindEvents();

  // Initialize calendar state
  const now = new Date();
  calendarYear = now.getFullYear();
  calendarMonth = now.getMonth();
}

document.addEventListener('DOMContentLoaded', init);
