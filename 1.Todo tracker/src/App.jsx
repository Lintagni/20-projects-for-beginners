import { useState, useEffect, useRef } from 'react'
import './App.css'

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch {
      return initialValue
    }
  })

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value))
  }, [key, value])

  return [value, setValue]
}

export default function App() {
  const [tasks, setTasks] = useLocalStorage('todo-tasks', [])
  const [darkMode, setDarkMode] = useLocalStorage('todo-dark', false)
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('all')
  const inputRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  function addTask(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text) return
    setTasks(prev => [
      ...prev,
      { id: Date.now(), text, completed: false }
    ])
    setInput('')
    inputRef.current?.focus()
  }

  function toggleTask(id) {
    setTasks(prev =>
      prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t)
    )
  }

  function deleteTask(id) {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function clearCompleted() {
    setTasks(prev => prev.filter(t => !t.completed))
  }

  const total = tasks.length
  const completedCount = tasks.filter(t => t.completed).length

  const filtered = tasks.filter(t => {
    if (filter === 'active') return !t.completed
    if (filter === 'completed') return t.completed
    return true
  })

  return (
    <div className="app">
      <header className="header">
        <h1 className="title">Todo Tracker</h1>
        <button
          className="theme-toggle"
          onClick={() => setDarkMode(d => !d)}
          aria-label="Toggle theme"
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </header>

      <main className="main">
        <form className="input-row" onSubmit={addTask}>
          <input
            ref={inputRef}
            className="task-input"
            type="text"
            placeholder="Add a new task..."
            value={input}
            onChange={e => setInput(e.target.value)}
            maxLength={200}
          />
          <button className="add-btn" type="submit" disabled={!input.trim()}>
            Add
          </button>
        </form>

        <div className="stats">
          <span>{total} {total === 1 ? 'task' : 'tasks'} total</span>
          <span className="dot">·</span>
          <span>{completedCount} completed</span>
          {completedCount > 0 && (
            <>
              <span className="dot">·</span>
              <button className="clear-btn" onClick={clearCompleted}>
                Clear completed
              </button>
            </>
          )}
        </div>

        <div className="filters">
          {['all', 'active', 'completed'].map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <ul className="task-list">
          {filtered.length === 0 && (
            <li className="empty">
              {filter === 'completed' ? 'No completed tasks yet.' :
               filter === 'active' ? 'All tasks done! 🎉' :
               'No tasks yet. Add one above!'}
            </li>
          )}
          {filtered.map(task => (
            <li key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                  className="checkbox"
                />
                <span className="checkmark" />
              </label>
              <span className="task-text">{task.text}</span>
              <button
                className="delete-btn"
                onClick={() => deleteTask(task.id)}
                aria-label="Delete task"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
