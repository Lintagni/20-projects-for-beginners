/* ============================================================
   NoteKeeper — app.js
   ============================================================ */

const STORAGE_KEY = 'notekeeper_v1';

// ── State ────────────────────────────────────────────────────
let notes = [];
let activeId = null;
let saveTimer = null;
let toastTimer = null;

// ── DOM refs ─────────────────────────────────────────────────
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarClose   = document.getElementById('sidebarClose');
const menuToggle     = document.getElementById('menuToggle');
const newNoteBtn     = document.getElementById('newNoteBtn');
const newNoteMobile  = document.getElementById('newNoteMobile');
const welcomeNewNote = document.getElementById('welcomeNewNote');
const searchInput    = document.getElementById('searchInput');
const searchClear    = document.getElementById('searchClear');
const sortSelect     = document.getElementById('sortSelect');
const notesCount     = document.getElementById('notesCount');
const notesList      = document.getElementById('notesList');
const emptyList      = document.getElementById('emptyList');

const welcomeScreen    = document.getElementById('welcomeScreen');
const editor           = document.getElementById('editor');
const editorBody       = document.getElementById('editorBody');
const noteTitleInput   = document.getElementById('noteTitleInput');
const noteContentInput = document.getElementById('noteContentInput');
const noteTimestamps   = document.getElementById('noteTimestamps');

const colorPicker = document.getElementById('colorPicker');
const pinBtn      = document.getElementById('pinBtn');
const exportBtn   = document.getElementById('exportBtn');
const deleteBtn   = document.getElementById('deleteBtn');

const deleteModal   = document.getElementById('deleteModal');
const cancelDelete  = document.getElementById('cancelDelete');
const confirmDelete = document.getElementById('confirmDelete');
const toast         = document.getElementById('toast');

// ── Helpers ──────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffH   = Math.floor(diffMin / 60);
  const diffD   = Math.floor(diffH   / 24);

  if (diffSec < 60)  return 'just now';
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffH   < 24)  return `${diffH}h ago`;
  if (diffD   < 7)   return `${diffD}d ago`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatFull(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escape(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function highlight(str, query) {
  if (!query) return escape(str);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${escaped})`, 'gi');
  return escape(str).replace(re, '<mark>$1</mark>');
}

// ── Persistence ──────────────────────────────────────────────
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) notes = JSON.parse(raw);
  } catch {
    notes = [];
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    showToast('Storage full — oldest notes may not save.');
  }
}

// ── CRUD ─────────────────────────────────────────────────────
function createNote() {
  const note = {
    id:        uid(),
    title:     '',
    content:   '',
    color:     'default',
    pinned:    false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  notes.unshift(note);
  save();
  return note;
}

function getNote(id) {
  return notes.find(n => n.id === id) || null;
}

function updateNote(id, patch) {
  const idx = notes.findIndex(n => n.id === id);
  if (idx === -1) return;
  notes[idx] = { ...notes[idx], ...patch, updatedAt: Date.now() };
  save();
}

function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  save();
}

// ── Sorting & filtering ───────────────────────────────────────
function getFilteredSorted() {
  const q = searchInput.value.trim().toLowerCase();
  let list = q
    ? notes.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      )
    : [...notes];

  const sort = sortSelect.value;
  list.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (sort === 'title')    return (a.title || 'Untitled').localeCompare(b.title || 'Untitled');
    if (sort === 'created')  return b.createdAt - a.createdAt;
    return b.updatedAt - a.updatedAt;
  });

  return { list, query: q };
}

// ── Render notes list ─────────────────────────────────────────
function renderList() {
  const { list, query } = getFilteredSorted();
  const count = notes.length;
  notesCount.textContent = `${count} ${count === 1 ? 'note' : 'notes'}`;

  // Remove existing note items (keep #emptyList)
  Array.from(notesList.querySelectorAll('.note-item')).forEach(el => el.remove());

  if (list.length === 0) {
    emptyList.style.display = 'flex';
    if (query) {
      emptyList.querySelector('p').innerHTML = `No notes match<br/><strong>"${escape(query)}"</strong>`;
    } else {
      emptyList.querySelector('p').innerHTML = `No notes yet.<br/>Click <strong>New Note</strong> to start.`;
    }
    return;
  }

  emptyList.style.display = 'none';

  list.forEach(note => {
    const item = document.createElement('div');
    item.className = 'note-item' + (note.id === activeId ? ' active' : '');
    item.dataset.id    = note.id;
    item.dataset.color = note.color;

    const title   = note.title   || 'Untitled';
    const preview = note.content.replace(/\n+/g, ' ').trim() || 'No content';

    item.innerHTML = `
      <div class="note-item-header">
        ${note.pinned ? `<span class="note-item-pin"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span>` : ''}
        <span class="note-item-title${!note.title ? ' untitled' : ''}">${highlight(title, query)}</span>
      </div>
      <div class="note-item-preview">${highlight(preview.slice(0, 90), query)}</div>
      <div class="note-item-meta">${formatDate(note.updatedAt)}</div>
    `;

    item.addEventListener('click', () => openNote(note.id));
    notesList.appendChild(item);
  });
}

// ── Open note in editor ───────────────────────────────────────
function openNote(id) {
  const note = getNote(id);
  if (!note) return;

  activeId = id;

  welcomeScreen.style.display = 'none';
  editor.style.display = 'flex';

  noteTitleInput.value   = note.title;
  noteContentInput.value = note.content;
  editorBody.dataset.color = note.color;

  updateTimestamps(note);
  updateColorPicker(note.color);
  updatePinBtn(note.pinned);

  renderList();

  // On mobile: close sidebar after selection
  if (window.innerWidth <= 700) closeSidebar();

  noteTitleInput.focus();
}

function updateTimestamps(note) {
  noteTimestamps.innerHTML =
    `Created ${formatFull(note.createdAt)}` +
    (note.updatedAt !== note.createdAt
      ? `&ensp;·&ensp;Edited ${formatFull(note.updatedAt)}`
      : '');
}

function updateColorPicker(color) {
  colorPicker.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === color);
  });
}

function updatePinBtn(pinned) {
  pinBtn.classList.toggle('active', pinned);
  pinBtn.title = pinned ? 'Unpin note' : 'Pin note';
}

// ── Auto-save with debounce ───────────────────────────────────
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistActiveNote, 500);
}

function persistActiveNote() {
  if (!activeId) return;
  updateNote(activeId, {
    title:   noteTitleInput.value,
    content: noteContentInput.value,
  });
  const note = getNote(activeId);
  if (note) updateTimestamps(note);
  renderList();
}

// ── Sidebar ───────────────────────────────────────────────────
function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('visible');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, duration = 2400) {
  clearTimeout(toastTimer);
  toast.textContent = msg;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── Export ────────────────────────────────────────────────────
function exportNote(id) {
  const note = getNote(id);
  if (!note) return;
  const titleLine = note.title || 'Untitled';
  const divider   = '─'.repeat(Math.min(titleLine.length + 4, 60));
  const text = [
    titleLine,
    divider,
    `Created:      ${formatFull(note.createdAt)}`,
    `Last edited:  ${formatFull(note.updatedAt)}`,
    '',
    note.content || '(empty)',
    '',
    `Exported from NoteKeeper on ${new Date().toLocaleString()}`,
  ].join('\n');

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = (note.title || 'note').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.txt';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Note exported.');
}

// ── Delete flow ───────────────────────────────────────────────
function showDeleteModal() {
  deleteModal.classList.add('visible');
}
function hideDeleteModal() {
  deleteModal.classList.remove('visible');
}

// ── Event listeners ───────────────────────────────────────────

// New note
function handleNewNote() {
  // Persist current note first
  persistActiveNote();

  const note = createNote();
  openNote(note.id);
  showToast('New note created.');
}

newNoteBtn.addEventListener('click', handleNewNote);
newNoteMobile.addEventListener('click', handleNewNote);
welcomeNewNote.addEventListener('click', handleNewNote);

// Sidebar toggle
menuToggle.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

// Search
searchInput.addEventListener('input', () => {
  searchClear.style.display = searchInput.value ? 'flex' : 'none';
  renderList();
});
searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.style.display = 'none';
  searchInput.focus();
  renderList();
});

// Sort
sortSelect.addEventListener('change', renderList);

// Editor inputs
noteTitleInput.addEventListener('input', scheduleSave);
noteContentInput.addEventListener('input', scheduleSave);

// Tab key → indent in content area
noteContentInput.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = noteContentInput.selectionStart;
    const end   = noteContentInput.selectionEnd;
    noteContentInput.value =
      noteContentInput.value.slice(0, start) + '    ' + noteContentInput.value.slice(end);
    noteContentInput.selectionStart = noteContentInput.selectionEnd = start + 4;
    scheduleSave();
  }
});

// Color picker
colorPicker.addEventListener('click', e => {
  const btn = e.target.closest('.color-btn');
  if (!btn || !activeId) return;
  const color = btn.dataset.color;
  updateNote(activeId, { color });
  editorBody.dataset.color = color;
  updateColorPicker(color);
  // Update list item color
  const item = notesList.querySelector(`[data-id="${activeId}"]`);
  if (item) item.dataset.color = color;
});

// Pin
pinBtn.addEventListener('click', () => {
  if (!activeId) return;
  persistActiveNote();
  const note = getNote(activeId);
  const next = !note.pinned;
  updateNote(activeId, { pinned: next });
  updatePinBtn(next);
  renderList();
  showToast(next ? 'Note pinned.' : 'Note unpinned.');
});

// Export
exportBtn.addEventListener('click', () => {
  if (!activeId) return;
  persistActiveNote();
  exportNote(activeId);
});

// Delete
deleteBtn.addEventListener('click', showDeleteModal);
cancelDelete.addEventListener('click', hideDeleteModal);
deleteModal.addEventListener('click', e => {
  if (e.target === deleteModal) hideDeleteModal();
});

confirmDelete.addEventListener('click', () => {
  if (!activeId) return;
  hideDeleteModal();
  const id = activeId;
  activeId = null;
  deleteNote(id);

  editor.style.display = 'none';
  welcomeScreen.style.display = '';

  renderList();
  showToast('Note deleted.');

  // Auto-select the first remaining note
  const { list } = getFilteredSorted();
  if (list.length > 0) {
    setTimeout(() => openNote(list[0].id), 80);
  }
});

// Keyboard shortcut: Ctrl/Cmd + N → new note
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault();
    handleNewNote();
  }
  if (e.key === 'Escape') {
    hideDeleteModal();
    closeSidebar();
  }
});

// ── Init ──────────────────────────────────────────────────────
(function init() {
  load();
  renderList();

  // Open the most-recently modified note if any exist
  const { list } = getFilteredSorted();
  if (list.length > 0) {
    openNote(list[0].id);
  }
})();
