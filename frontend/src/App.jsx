import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import './App.css'

const STATUS = {
  pendiente: { label: 'Pendiente', className: 'pending' },
  en_progreso: { label: 'En curso', className: 'progress' },
  completado: { label: 'Completada', className: 'done' },
}

function Mark({ small = false }) {
  return <span className={`brand-mark${small ? ' brand-mark--small' : ''}`} aria-hidden="true"><i /><i /><i /></span>
}

function Icon({ name, size = 18 }) {
  const shared = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m16 16 4.2 4.2" /></>,
    check: <><path d="m5 12 4.2 4.2L19 6.5" /></>,
    trash: <><path d="M4 7h16M10 11v6m4-6v6M6.5 7l.8 13h9.4l.8-13M9 7V4h6v3" /></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
    exit: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  }
  return <svg {...shared}>{paths[name]}</svg>
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', identifier: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const registerMode = mode === 'register'

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = registerMode
        ? await api.register({ username: form.username, email: form.email, password: form.password })
        : await api.login({ identifier: form.identifier, password: form.password })
      onAuthenticated(result.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-topbar"><a className="brand" href="#inicio" aria-label="Tanda, inicio"><Mark /><span>Tanda</span></a><span className="top-note">Tu espacio para avanzar</span></div>
      <div className="auth-layout">
        <section className="auth-story" aria-label="Presentación">
          <div className="story-art" aria-hidden="true">
            <div className="sun-disc" />
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <div className="paper-note note-back"><span>HOY</span><b>Una cosa<br />a la vez.</b></div>
            <div className="paper-note note-front"><span className="note-check"><Icon name="check" size={14} /></span><b>Hecho es<br />mejor que<br />perfecto.</b><small>— regla número uno</small></div>
            <span className="spark spark-one">✳</span><span className="spark spark-two">✳</span>
          </div>
          <div className="story-copy"><p className="section-label">MENOS RUIDO, MÁS HECHO</p><h1>Las ideas también<br />necesitan <em>un lugar.</em></h1><p>Ordena lo que tienes en mente. Avanza a tu ritmo y celebra cada pequeño paso.</p></div>
        </section>
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-panel-heading"><span className="panel-mark"><Mark small /></span><p className="section-label">BIENVENIDO A TANDA</p><h2 id="auth-title">{registerMode ? 'Empieza por aquí.' : 'Qué bueno verte.'}</h2><p>{registerMode ? 'Crea tu cuenta y pon tus ideas en marcha.' : 'Entra y sigue justo donde lo dejaste.'}</p></div>
          {error && <div className="notice notice-error" role="alert">{error}</div>}
          <form className="auth-form" onSubmit={submit}>
            {registerMode && <>
              <label>Nombre de usuario<input autoComplete="username" minLength="3" maxLength="25" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="p. ej. sergio" required /></label>
              <label>Correo electrónico<input type="email" autoComplete="email" maxLength="254" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="tu@correo.com" required /></label>
            </>}
            {!registerMode && <label>Usuario o correo<input autoComplete="username" value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="¿Con qué nombre te registraste?" required /></label>}
            <label>Contraseña<input type="password" autoComplete={registerMode ? 'new-password' : 'current-password'} minLength={registerMode ? 8 : undefined} maxLength="128" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={registerMode ? 'Al menos 8 caracteres' : 'Tu contraseña'} required /></label>
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Un momento…' : registerMode ? 'Crear mi cuenta' : 'Entrar'}<Icon name="arrow" /></button>
          </form>
          <p className="auth-switch">{registerMode ? '¿Ya tienes cuenta?' : '¿Primera vez por aquí?'} <button type="button" onClick={() => { setMode(registerMode ? 'login' : 'register'); setError('') }}>{registerMode ? 'Inicia sesión' : 'Crea una cuenta'}</button></p>
          <p className="auth-footnote"><span className="tiny-lock">⌑</span> Tus tareas son privadas y solo tú puedes verlas.</p>
        </section>
      </div>
      <footer className="auth-footer"><span>Hecho para avanzar, no para correr.</span><span>© Tanda</span></footer>
    </main>
  )
}

function TaskEditor({ task, onSave, onCancel, busy }) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [status, setStatus] = useState(task?.status || 'pendiente')
  return <form className="task-editor" onSubmit={(event) => { event.preventDefault(); onSave({ title, description, status }) }}>
    <label>Título<input autoFocus maxLength="80" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="¿Qué quieres sacar adelante?" required /></label>
    <label>Descripción <span className="optional">OPCIONAL</span><textarea maxLength="500" rows="3" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Añade algún detalle que te ayude…" /></label>
    <label>Estado<select value={status} onChange={(e) => setStatus(e.target.value)}><option value="pendiente">Pendiente</option><option value="en_progreso">En curso</option><option value="completado">Completada</option></select></label>
    <div className="editor-actions"><button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Guardando…' : task ? 'Guardar cambios' : 'Añadir tarea'}</button><button className="button button-quiet" type="button" onClick={onCancel}>Cancelar</button></div>
  </form>
}

function TaskCard({ task, onEdit, onDelete, onStatus }) {
  const status = STATUS[task.status] || STATUS.pendiente
  return <article className={`task-row ${status.className}`}>
    <button className="task-complete" type="button" aria-label={task.status === 'completado' ? `Marcar ${task.title} como pendiente` : `Marcar ${task.title} como completada`} onClick={() => onStatus(task, task.status === 'completado' ? 'pendiente' : 'completado')}><Icon name="check" size={16} /></button>
    <div className="task-main"><h3 className={task.status === 'completado' ? 'task-title is-done' : 'task-title'}>{task.title}</h3>{task.description && <p>{task.description}</p>}</div>
    <span className={`status-label ${status.className}`}><i />{status.label}</span>
    <div className="task-actions"><button type="button" onClick={() => onEdit(task)}>Editar</button><button className="icon-button danger-hover" type="button" aria-label={`Eliminar ${task.title}`} onClick={() => onDelete(task)}><Icon name="trash" size={16} /></button></div>
  </article>
}

function Dashboard({ user, onLogout }) {
  const [tasks, setTasks] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadTasks = useCallback(async () => {
    try { setTasks((await api.tasks()).tasks); setError('') }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    let mounted = true
    api.tasks().then(({ tasks: initialTasks }) => {
      if (mounted) { setTasks(initialTasks); setError(''); setLoading(false) }
    }).catch((err) => {
      if (mounted) { setError(err.message); setLoading(false) }
    })
    return () => { mounted = false }
  }, [])

  const visibleTasks = useMemo(() => tasks
    .filter((task) => !statusFilter || task.status === statusFilter)
    .filter((task) => `${task.title} ${task.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [tasks, query, statusFilter])
  const counts = useMemo(() => ({ all: tasks.length, pending: tasks.filter((task) => task.status === 'pendiente').length, open: tasks.filter((task) => task.status !== 'completado').length, done: tasks.filter((task) => task.status === 'completado').length }), [tasks])

  async function saveTask(payload) {
    setBusy(true); setError('')
    try {
      if (editor?.task) await api.updateTask(editor.task.id, payload)
      else await api.createTask(payload)
      setEditor(null)
      await loadTasks()
    } catch (err) { setError(err.message) }
    finally { setBusy(false) }
  }

  async function deleteTask(task) {
    if (!window.confirm(`¿Eliminar “${task.title}”? Esta acción no se puede deshacer.`)) return
    setError('')
    try { await api.deleteTask(task.id); await loadTasks() } catch (err) { setError(err.message) }
  }

  async function updateStatus(task, status) {
    try { await api.updateTask(task.id, { status }); await loadTasks() } catch (err) { setError(err.message) }
  }

  return <main className="dashboard-page">
    <header className="app-header"><a className="brand" href="#inicio" aria-label="Tanda, inicio"><Mark /><span>Tanda</span></a><div className="header-right"><span className="today-date">Tu espacio, a tu ritmo</span><span className="header-divider" /><span className="user-avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</span><span className="user-name">{user.username}</span><button type="button" className="logout-button" onClick={onLogout} title="Cerrar sesión" aria-label="Cerrar sesión"><Icon name="exit" /></button></div></header>
    <section className="dashboard-content">
      <div className="welcome-row"><div><p className="section-label">TU TABLERO</p><h1>Vamos paso a paso<span className="period">.</span></h1><p className="welcome-subtitle">Todo lo que quieres hacer, en un solo lugar.</p></div><button className="button button-primary add-task-button" type="button" onClick={() => setEditor(editor?.task ? null : { task: null })}><Icon name={editor?.task ? 'plus' : 'plus'} />Nueva tarea</button></div>
      <div className="task-toolbar"><div className="task-tabs" role="group" aria-label="Filtrar tareas por estado"><button type="button" className={!statusFilter ? 'active' : ''} onClick={() => setStatusFilter('')}>Todas <span>{counts.all}</span></button><button type="button" className={statusFilter === 'pendiente' ? 'active' : ''} onClick={() => setStatusFilter('pendiente')}>Pendientes <span>{counts.pending}</span></button><button type="button" className={statusFilter === 'en_progreso' ? 'active' : ''} onClick={() => setStatusFilter('en_progreso')}>En curso</button><button type="button" className={statusFilter === 'completado' ? 'active' : ''} onClick={() => setStatusFilter('completado')}>Completadas <span>{counts.done}</span></button></div><label className="search-box"><Icon name="search" size={17} /><input type="search" aria-label="Buscar por título o descripción" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar tareas" /></label></div>
      {error && <div className="notice notice-error dashboard-notice" role="alert"><span>{error}</span><button type="button" className="icon-button" aria-label="Cerrar aviso" onClick={() => setError('')}><Icon name="close" size={16} /></button></div>}
      {editor && <section className="editor-section" aria-labelledby="editor-title"><div className="editor-heading"><div><p className="section-label">{editor.task ? 'ACTUALIZAR' : 'AÑADIR A TU LISTA'}</p><h2 id="editor-title">{editor.task ? 'Ajusta los detalles.' : 'Una cosa más.'}</h2></div><button type="button" className="icon-button" onClick={() => setEditor(null)} aria-label="Cerrar formulario"><Icon name="close" /></button></div><TaskEditor key={editor.task?.id || 'new'} task={editor.task} onSave={saveTask} onCancel={() => setEditor(null)} busy={busy} /></section>}
      <section className="task-list" aria-label="Lista de tareas" aria-live="polite">
        {loading ? <div className="loading-state"><span className="loader" />Cargando tus tareas…</div> : visibleTasks.length ? visibleTasks.map((task) => <TaskCard key={task.id} task={task} onEdit={(selected) => { setEditor({ task: selected }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} onDelete={deleteTask} onStatus={updateStatus} />) : <div className="empty-state"><div className="empty-illustration" aria-hidden="true"><span /><span /><span /></div><h2>{query ? 'No encontramos esa tarea.' : statusFilter ? 'No hay tareas en este estado.' : 'Tu lista está en blanco.'}</h2><p>{query ? 'Prueba con otra palabra o limpia la búsqueda.' : statusFilter ? 'Puedes cambiar el filtro o crear una nueva tarea.' : 'Empieza con algo pequeño. Lo demás vendrá después.'}</p>{!query && <button className="button button-outline" type="button" onClick={() => setEditor({ task: null })}><Icon name="plus" size={16} />Añadir primera tarea</button>}</div>}
      </section>
      <footer className="dashboard-footer"><span><strong>{counts.open}</strong> {counts.open === 1 ? 'tarea por hacer' : 'tareas por hacer'}</span><span>{counts.done ? `${counts.done} completada${counts.done === 1 ? '' : 's'} — buen trabajo.` : 'Cada paso cuenta.'}</span></footer>
    </section>
  </main>
}

function App() {
  const [user, setUser] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  useEffect(() => {
    let active = true
    api.me().then(({ user: currentUser }) => { if (active) setUser(currentUser) }).catch(() => {}).finally(() => { if (active) setCheckingSession(false) })
    return () => { active = false }
  }, [])

  async function logout() {
    try { await api.logout(); setUser(null) } catch (err) { window.alert(err.message) }
  }

  if (checkingSession) return <main className="boot-screen"><Mark /><span>Preparando tu espacio…</span></main>
  return user ? <Dashboard user={user} onLogout={logout} /> : <AuthScreen onAuthenticated={setUser} />
}

export default App
