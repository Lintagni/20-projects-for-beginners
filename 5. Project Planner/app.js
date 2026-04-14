/* ── Storage helpers ──────────────────────────────────── */
const STORAGE_KEYS = { projects: 'pp_projects', tasks: 'pp_tasks' };

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

/* ── State ───────────────────────────────────────────── */
let projects = load(STORAGE_KEYS.projects);
let tasks    = load(STORAGE_KEYS.tasks);
let activeProjectId = null;
let activeFilter    = 'all';
let timerInterval   = null;

/* ── ID generator ────────────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── Date helpers ────────────────────────────────────── */
function parseDeadline(dateStr) {
  // Parse YYYY-MM-DD as local date (not UTC)
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59);
}

function formatDeadline(dateStr) {
  const d = parseDeadline(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getTimeRemaining(dateStr) {
  const deadline = parseDeadline(dateStr);
  const now      = new Date();
  const diff     = deadline - now;

  if (diff < 0) {
    const days = Math.floor(-diff / 86400000);
    return { label: days === 0 ? 'Overdue today' : `${days}d overdue`, status: 'overdue' };
  }

  const days    = Math.floor(diff / 86400000);
  const hours   = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  if (days === 0 && hours === 0) {
    return { label: `${minutes}m ${seconds}s left`, status: 'today' };
  }
  if (days === 0) {
    return { label: `${hours}h ${minutes}m left`, status: 'today' };
  }
  if (days <= 3) {
    return { label: `${days}d ${hours}h left`, status: 'soon' };
  }
  return { label: `${days} days left`, status: 'ok' };
}

function getDeadlineUrgency(dateStr) {
  const deadline = parseDeadline(dateStr);
  const diff     = deadline - new Date();
  if (diff < 0)           return 'overdue';
  if (diff < 259200000)   return 'soon';   // < 3 days
  return 'ok';
}

/* ── Render sidebar ──────────────────────────────────── */
function renderSidebar() {
  const list = document.getElementById('projectList');
  list.innerHTML = '';

  if (projects.length === 0) {
    list.innerHTML = '<li style="padding:8px 12px;font-size:13px;color:var(--muted)">No projects yet</li>';
    return;
  }

  projects.forEach(p => {
    const projectTasks = tasks.filter(t => t.projectId === p.id);
    const done = projectTasks.filter(t => t.completed).length;
    const urgency = getDeadlineUrgency(p.deadline);

    const li = document.createElement('li');
    li.className = 'project-nav-item' + (p.id === activeProjectId ? ' active' : '');
    li.dataset.id = p.id;
    li.innerHTML = `
      <span class="nav-deadline-dot ${urgency}" title="${urgency === 'overdue' ? 'Overdue' : urgency === 'soon' ? 'Due soon' : 'On track'}"></span>
      <span class="nav-name" title="${p.name}">${p.name}</span>
      <span class="nav-badge">${done}/${projectTasks.length}</span>
    `;
    li.addEventListener('click', () => selectProject(p.id));
    list.appendChild(li);
  });
}

/* ── Render project detail ───────────────────────────── */
function renderProjectDetail() {
  const emptyState    = document.getElementById('emptyState');
  const projectDetail = document.getElementById('projectDetail');

  if (!activeProjectId) {
    emptyState.classList.remove('hidden');
    projectDetail.classList.add('hidden');
    return;
  }

  const project = projects.find(p => p.id === activeProjectId);
  if (!project) { activeProjectId = null; renderProjectDetail(); return; }

  emptyState.classList.add('hidden');
  projectDetail.classList.remove('hidden');

  // Name
  document.getElementById('projectName').textContent = project.name;

  // Deadline tag
  document.getElementById('deadlineTag').textContent = 'Due: ' + formatDeadline(project.deadline);

  // Progress
  const projectTasks = tasks.filter(t => t.projectId === activeProjectId);
  const done  = projectTasks.filter(t => t.completed).length;
  const total = projectTasks.length;
  const pct   = total === 0 ? 0 : Math.round((done / total) * 100);

  document.getElementById('progressFill').style.width  = pct + '%';
  document.getElementById('progressLabel').textContent = pct + '%';

  const statsEl = document.getElementById('taskStats');
  statsEl.innerHTML = `
    <span><span class="stat-dot" style="background:var(--success)"></span>${done} complete</span>
    <span><span class="stat-dot" style="background:#94a3b8"></span>${total - done} pending</span>
    <span><span class="stat-dot" style="background:var(--primary)"></span>${total} total</span>
  `;

  renderTasks(projectTasks);
}

/* ── Render tasks ────────────────────────────────────── */
function renderTasks(projectTasks) {
  const list    = document.getElementById('taskList');
  const noTasks = document.getElementById('noTasks');
  list.innerHTML = '';

  let filtered;
  if (activeFilter === 'complete') filtered = projectTasks.filter(t => t.completed);
  else if (activeFilter === 'pending') filtered = projectTasks.filter(t => !t.completed);
  else filtered = [...projectTasks];

  // Sort: incomplete first, then by priority weight
  const pw = { high: 0, medium: 1, low: 2 };
  filtered.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return pw[a.priority] - pw[b.priority];
  });

  if (filtered.length === 0) {
    noTasks.classList.remove('hidden');
    return;
  }
  noTasks.classList.add('hidden');

  filtered.forEach(task => {
    const li = document.createElement('li');
    li.className = `task-item priority-${task.priority}${task.completed ? ' completed' : ''}`;
    li.dataset.id = task.id;
    li.innerHTML = `
      <div class="task-checkbox${task.completed ? ' checked' : ''}" data-taskid="${task.id}" title="Toggle complete"></div>
      <span class="task-name">${escapeHtml(task.name)}</span>
      <span class="priority-badge ${task.priority}">${task.priority}</span>
      <button class="delete-task-btn" data-taskid="${task.id}" title="Delete task">&#x2715;</button>
    `;
    list.appendChild(li);
  });

  // Delegate events
  list.querySelectorAll('.task-checkbox').forEach(cb => {
    cb.addEventListener('click', () => toggleTask(cb.dataset.taskid));
  });
  list.querySelectorAll('.delete-task-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTask(btn.dataset.taskid));
  });
}

/* ── Deadline banner ─────────────────────────────────── */
function renderDeadlineBanner() {
  const banner = document.getElementById('deadlineBanner');

  const overdue = projects.filter(p => getDeadlineUrgency(p.deadline) === 'overdue');
  const soon    = projects.filter(p => getDeadlineUrgency(p.deadline) === 'soon');

  if (overdue.length > 0) {
    banner.classList.remove('hidden');
    banner.classList.add('warning');
    banner.textContent = `Overdue: ${overdue.map(p => p.name).join(', ')}`;
  } else if (soon.length > 0) {
    banner.classList.remove('hidden');
    banner.classList.remove('warning');
    banner.textContent = `Due soon: ${soon.map(p => p.name).join(', ')}`;
  } else {
    banner.classList.add('hidden');
  }
}

/* ── Time remaining ticker ───────────────────────────── */
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);
  tickTimer();
}

function tickTimer() {
  if (!activeProjectId) return;
  const project = projects.find(p => p.id === activeProjectId);
  if (!project) return;

  const { label, status } = getTimeRemaining(project.deadline);
  const el = document.getElementById('timeRemaining');
  el.textContent = label;
  el.className = `time-remaining ${status}`;

  renderDeadlineBanner();
  renderSidebar();
}

/* ── Actions ─────────────────────────────────────────── */
function selectProject(id) {
  activeProjectId = id;
  activeFilter = 'all';
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'all'));
  renderSidebar();
  renderProjectDetail();
}

function createProject(name, deadline) {
  const project = { id: uid(), name: name.trim(), deadline, createdAt: Date.now() };
  projects.push(project);
  save(STORAGE_KEYS.projects, projects);
  selectProject(project.id);
  renderSidebar();
  renderDeadlineBanner();
}

function deleteProject(id) {
  projects = projects.filter(p => p.id !== id);
  tasks    = tasks.filter(t => t.projectId !== id);
  save(STORAGE_KEYS.projects, projects);
  save(STORAGE_KEYS.tasks, tasks);
  if (activeProjectId === id) activeProjectId = null;
  renderSidebar();
  renderProjectDetail();
  renderDeadlineBanner();
}

function addTask(name, priority) {
  if (!activeProjectId) return;
  const task = {
    id: uid(),
    projectId: activeProjectId,
    name: name.trim(),
    priority,
    completed: false,
    createdAt: Date.now()
  };
  tasks.push(task);
  save(STORAGE_KEYS.tasks, tasks);
  renderProjectDetail();
  renderSidebar();
}

function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  save(STORAGE_KEYS.tasks, tasks);
  renderProjectDetail();
  renderSidebar();
}

function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  save(STORAGE_KEYS.tasks, tasks);
  renderProjectDetail();
  renderSidebar();
}

/* ── Escape HTML ─────────────────────────────────────── */
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── Wire up UI ──────────────────────────────────────── */

// New project modal
const modalOverlay = document.getElementById('modalOverlay');
const projectNameInput    = document.getElementById('projectNameInput');
const projectDeadlineInput = document.getElementById('projectDeadlineInput');
const modalError = document.getElementById('modalError');

function openModal() {
  modalOverlay.classList.remove('hidden');
  projectNameInput.value = '';
  projectDeadlineInput.value = '';
  modalError.classList.add('hidden');
  setTimeout(() => projectNameInput.focus(), 50);
}
function closeModal() { modalOverlay.classList.add('hidden'); }

document.getElementById('openNewProjectModal').addEventListener('click', openModal);
document.getElementById('emptyStateBtn').addEventListener('click', openModal);
document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('cancelModal').addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

document.getElementById('createProjectBtn').addEventListener('click', () => {
  const name     = projectNameInput.value.trim();
  const deadline = projectDeadlineInput.value;
  if (!name || !deadline) { modalError.classList.remove('hidden'); return; }
  closeModal();
  createProject(name, deadline);
});

// Enter key in modal
projectNameInput.addEventListener('keydown', e => { if (e.key === 'Enter') projectDeadlineInput.focus(); });
projectDeadlineInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('createProjectBtn').click();
});

// Delete project
document.getElementById('deleteProjectBtn').addEventListener('click', () => {
  const project = projects.find(p => p.id === activeProjectId);
  if (!project) return;
  if (confirm(`Delete project "${project.name}" and all its tasks?`)) {
    deleteProject(activeProjectId);
  }
});

// Add task
const taskInput      = document.getElementById('taskInput');
const prioritySelect = document.getElementById('prioritySelect');

document.getElementById('addTaskBtn').addEventListener('click', () => {
  const name = taskInput.value.trim();
  if (!name) { taskInput.focus(); return; }
  addTask(name, prioritySelect.value);
  taskInput.value = '';
  taskInput.focus();
});

taskInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('addTaskBtn').click();
});

// Filters
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (activeProjectId) {
      const projectTasks = tasks.filter(t => t.projectId === activeProjectId);
      renderTasks(projectTasks);
    }
  });
});

// Set minimum date to today
const today = new Date().toISOString().split('T')[0];
projectDeadlineInput.min = today;

/* ── Bootstrap ───────────────────────────────────────── */
renderSidebar();
renderProjectDetail();
renderDeadlineBanner();
startTimer();

// Auto-select first project if any
if (projects.length > 0 && !activeProjectId) {
  selectProject(projects[0].id);
}
