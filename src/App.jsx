import { useEffect, useMemo, useState } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, setDoc, where
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'firebase/auth';
import {
  ArrowUpRight, Boxes, Check, ChevronDown, ExternalLink, Globe2, LayoutGrid, LogOut,
  Plus, Search, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, X, Pencil, LockKeyhole
} from 'lucide-react';
import { auth, db, firebaseConfig } from './firebase';

const emptyForm = { name: '', url: '', description: '', category: 'General', icon: '🌐', color: '#8b7cff', featured: false, published: false };
const normaliseUrl = (value) => /^https?:\/\//i.test(value) ? value : `https://${value}`;

function Login({ onSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSignIn(email.trim(), password); }
    catch (e) {
      const messages = {
        'auth/invalid-credential': 'Correo o contraseña incorrectos.',
        'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
        'auth/network-request-failed': 'No se pudo conectar. Comprueba tu conexión.'
      };
      setError(messages[e.code] || 'No se pudo iniciar sesión. Comprueba los datos y la configuración de Firebase.');
    } finally { setBusy(false); }
  }
  return <main className="login-screen">
    <div className="login-orb orb-one" /><div className="login-orb orb-two" />
    <section className="login-card">
      <div className="brand-mark"><Boxes size={25} /></div>
      <p className="eyebrow">TU ESPACIO DIGITAL</p>
      <h1>Todo empieza<br /><span>aquí.</span></h1>
      <p className="muted login-copy">Un lugar para organizar y acceder a todas tus webs.</p>
      <form onSubmit={submit} className="login-form">
        <label>Correo electrónico<input type="email" autoComplete="username" placeholder="tu@correo.com" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Contraseña<input type="password" autoComplete="current-password" placeholder="Tu contraseña" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {error && <p className="error-message">{error}</p>}
        <button className="primary-button full-button" disabled={busy}>{busy ? 'Entrando…' : 'Entrar al Hub'} <ArrowUpRight size={17} /></button>
      </form>
      <div className="login-foot"><LockKeyhole size={14} /> Acceso privado para administradores autorizados</div>
    </section>
  </main>;
}

function WebsiteForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await onSave({ ...form, url: normaliseUrl(form.url.trim()), name: form.name.trim(), description: form.description.trim(), category: form.category.trim() || 'General' });
      onClose();
    } catch { setError('No se ha podido guardar. Comprueba las reglas de Firestore.'); }
    finally { setBusy(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <section className="modal">
      <div className="modal-head"><div><p className="eyebrow">{initial ? 'EDITAR ENLACE' : 'NUEVO ENLACE'}</p><h2>{initial ? 'Actualizar web' : 'Añadir una web'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={19} /></button></div>
      <form className="website-form" onSubmit={submit}>
        <label>Nombre<input value={form.name} onChange={e => change('name', e.target.value)} placeholder="Mi proyecto" required maxLength={80} /></label>
        <label>URL<input type="text" value={form.url} onChange={e => change('url', e.target.value)} placeholder="https://ejemplo.com" required /></label>
        <label>Descripción<textarea value={form.description} onChange={e => change('description', e.target.value)} placeholder="¿Para qué sirve esta web?" rows={3} maxLength={240} /></label>
        <div className="form-row">
          <label>Categoría<input value={form.category} onChange={e => change('category', e.target.value)} placeholder="Trabajo, Herramientas…" /></label>
          <label>Icono (emoji)<input value={form.icon} onChange={e => change('icon', e.target.value)} maxLength={8} /></label>
        </div>
        <label className="color-label">Color de la tarjeta <input type="color" value={form.color || '#8b7cff'} onChange={e => change('color', e.target.value)} /></label>
        <label className="check-label"><input type="checkbox" checked={!!form.featured} onChange={e => change('featured', e.target.checked)} /> Marcar como destacada</label>
        <label className="check-label"><input type="checkbox" checked={!!form.published} onChange={e => change('published', e.target.checked)} /> Publicar para usuarios</label>
        {error && <p className="error-message">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy}>{busy ? 'Guardando…' : <><Check size={16} /> Guardar web</>}</button></div>
      </form>
    </section>
  </div>;
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isRegularUser, setIsRegularUser] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [userAccounts, setUserAccounts] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [userBusy, setUserBusy] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  const [roleChecked, setRoleChecked] = useState(false);
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [modal, setModal] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => onAuthStateChanged(auth, async current => {
    setUser(current); setRoleChecked(false); setIsAdmin(false); setIsRegularUser(false);
    if (!current) { setRoleChecked(true); setLoading(false); return; }
    try {
      const { getDoc } = await import('firebase/firestore');
      const role = await getDoc(doc(db, 'admins', current.uid));
      const admin = role.exists() && role.data().role === 'admin' && role.data().active !== false;
      setIsAdmin(admin);
      if (!admin) {
        const userRole = await getDoc(doc(db, 'users', current.uid));
        setIsRegularUser(userRole.exists() && userRole.data().role === 'user' && userRole.data().active !== false);
      }
    } catch { setIsAdmin(false); }
    finally { setRoleChecked(true); }
  }), []);

  useEffect(() => {
    if (!user || (!isAdmin && !isRegularUser)) { setWebsites([]); setLoading(false); return; }
    setLoading(true);
    const q = isAdmin
      ? query(collection(db, 'websites'), orderBy('createdAt', 'desc'))
      : query(collection(db, 'websites'), where('published', '==', true), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snapshot => {
      setWebsites(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => { setNotice('No se pudieron cargar las webs. Revisa las reglas de Firestore.'); setLoading(false); });
  }, [user, isAdmin, isRegularUser]);

  const categories = useMemo(() => ['Todas', ...new Set(websites.map(w => w.category || 'General').sort((a,b) => a.localeCompare(b, 'es')))], [websites]);
  const filtered = useMemo(() => websites.filter(w => {
    const text = `${w.name} ${w.description || ''} ${w.category || ''} ${(w.tags || []).join(' ')}`.toLocaleLowerCase('es');
    return text.includes(search.toLocaleLowerCase('es')) && (category === 'Todas' || (w.category || 'General') === category);
  }).sort((a,b) => Number(!!b.featured) - Number(!!a.featured)), [websites, search, category]);

  useEffect(() => {
    if (!user || !isAdmin || !showUsers) { setUserAccounts([]); return; }
    return onSnapshot(query(collection(db, 'users'), orderBy('email', 'asc')), snap => {
      setUserAccounts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setNotice('No se pudo cargar la lista de usuarios.'));
  }, [user, isAdmin, showUsers]);

  async function createUserAccount(event) {
    event.preventDefault(); setUserBusy(true);
    try {
      const secondaryName = 'hub-user-creation';
      const secondaryApp = getApps().find(app => app.name === secondaryName) || initializeApp(firebaseConfig, secondaryName);
      const secondaryAuth = (await import('firebase/auth')).getAuth(secondaryApp);
      const { createUserWithEmailAndPassword } = await import('firebase/auth');
      const credential = await createUserWithEmailAndPassword(secondaryAuth, newUserEmail.trim(), newUserPassword);
      await setDoc(doc(db, 'users', credential.user.uid), {
        uid: credential.user.uid, email: newUserEmail.trim(), role: 'user', active: true, createdAt: serverTimestamp()
      });
      await (await import('firebase/auth')).signOut(secondaryAuth);
      setNewUserEmail(''); setNewUserPassword(''); setNotice('Cuenta de usuario creada.');
    } catch (e) {
      setNotice(e.code === 'auth/email-already-in-use' ? 'Ese correo ya tiene una cuenta. Para asignarle el rol usuario existente hace falta su UID.' : (e.code === 'auth/weak-password' ? 'La contraseña debe tener al menos 6 caracteres.' : 'No se pudo crear el usuario. Comprueba los permisos y Firebase Authentication.'));
    } finally { setUserBusy(false); setTimeout(() => setNotice(''), 5000); }
  }

  async function toggleUserActive(account) {
    try { await updateDoc(doc(db, 'users', account.id), { active: account.active === false }); setNotice(account.active === false ? 'Usuario activado.' : 'Usuario desactivado.'); }
    catch { setNotice('No se pudo cambiar el estado del usuario.'); }
    setTimeout(() => setNotice(''), 3000);
  }

  async function saveWebsite(data) {
    if (modal?.id) await updateDoc(doc(db, 'websites', modal.id), { ...data, updatedAt: serverTimestamp() });
    else await addDoc(collection(db, 'websites'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    setNotice(modal?.id ? 'Web actualizada.' : 'Web añadida.');
    setTimeout(() => setNotice(''), 3000);
  }
  async function removeWebsite(site) {
    if (!window.confirm(`¿Eliminar “${site.name}” del Hub?`)) return;
    try { await deleteDoc(doc(db, 'websites', site.id)); setNotice('Web eliminada.'); }
    catch { setNotice('No se ha podido eliminar la web.'); }
    setTimeout(() => setNotice(''), 3000);
  }

  if (user === undefined || (user && !roleChecked)) return <main className="loading-screen"><div className="brand-mark"><Boxes size={24} /></div><p>Preparando tu espacio…</p></main>;
  if (!user) return <Login onSignIn={(email, password) => signInWithEmailAndPassword(auth, email, password)} />;
  if (!isAdmin && !isRegularUser) return <main className="denied-screen"><div className="brand-mark"><ShieldCheck size={25} /></div><h1>Acceso no autorizado</h1><p className="muted">Esta cuenta no tiene permisos para acceder al Hub.</p><p className="muted small">{user.email}</p><button className="secondary-button" onClick={() => signOut(auth)}><LogOut size={16} /> Cerrar sesión</button></main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setCategory('Todas'); setSearch(''); }}><span className="brand-mark"><Boxes size={22} /></span><span>hub<span className="brand-dot">.</span><small>WORKSPACE</small></span></a>
      <div className="side-label">ESPACIO DE TRABAJO</div>
      <button className="nav-item active"><LayoutGrid size={18} /> Todas las webs <span className="nav-count">{websites.length}</span></button>
      <div className="side-label category-label">CATEGORÍAS <ChevronDown size={13} /></div>
      <div className="side-categories">{categories.filter(c => c !== 'Todas').map(c => <button key={c} className={category === c ? 'category-item selected' : 'category-item'} onClick={() => setCategory(c)}><span className="category-dot" />{c}<span>{websites.filter(w => (w.category || 'General') === c).length}</span></button>)}</div>
      <div className="sidebar-bottom"><div className="secure-card"><div className="secure-icon"><ShieldCheck size={17} /></div><strong>{isAdmin ? 'Panel de administración' : 'Acceso de usuario'}</strong><p>{isAdmin ? 'Gestiona enlaces y permisos.' : 'Puedes ver las webs publicadas.'}</p></div><div className="profile-row"><div className="avatar">{(user.email || 'A')[0].toUpperCase()}</div><div className="profile-text"><strong>{user.email?.split('@')[0]}</strong><span>{isAdmin ? 'Administrador' : 'Usuario'}</span></div><button className="icon-button" onClick={() => signOut(auth)} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={17} /></button></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> <strong>Mis webs</strong></div><div className="top-actions"><span className="status-pill"><span /> Sistema privado</span><button className="avatar small-avatar" title={user.email}>{(user.email || 'A')[0].toUpperCase()}</button></div></header>
      <section className="welcome-row"><div><div className="eyebrow welcome-eyebrow"><Sparkles size={14} /> TU CENTRO DE CONTROL</div><h1>Tu mundo, <span>en un solo lugar.</span></h1><p className="muted">Accede a tus proyectos sin perder el ritmo.</p></div>{isAdmin && <div className="welcome-actions"><button className="secondary-button" onClick={() => { setShowUsers(v => !v); setShowAdmin(false); }}><ShieldCheck size={16} /> Usuarios</button><button className="primary-button add-button" onClick={() => { setModal({}); setShowAdmin(true); }}><Plus size={18} /> Añadir web</button></div>}</section>
{!showUsers && <>
      <section className="stats-row"><div className="stat-card"><span className="stat-icon purple"><Globe2 size={19} /></span><div><span className="stat-label">WEBS GUARDADAS</span><strong>{websites.length}</strong></div></div><div className="stat-card"><span className="stat-icon blue"><LayoutGrid size={19} /></span><div><span className="stat-label">CATEGORÍAS</span><strong>{categories.length - 1}</strong></div></div><div className="stat-card"><span className="stat-icon amber"><Sparkles size={19} /></span><div><span className="stat-label">DESTACADAS</span><strong>{websites.filter(w => w.featured).length}</strong></div></div></section>
      <section className="web-section"><div className="section-heading"><div><h2>Biblioteca de webs</h2><p className="muted">{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'} en tu espacio</p></div>{isAdmin && <button className={showAdmin ? 'secondary-button toggled' : 'secondary-button'} onClick={() => setShowAdmin(v => !v)}><SlidersHorizontal size={16} /> Gestionar <ChevronDown size={15} /></button>}</div>
        <div className="filter-row"><div className="search-box"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar una web…" /><kbd>⌕</kbd></div><div className="filter-chips">{categories.slice(0, 4).map(c => <button key={c} onClick={() => setCategory(c)} className={category === c ? 'filter-chip selected' : 'filter-chip'}>{c}</button>)}{categories.length > 4 && <select aria-label="Más categorías" value={category} onChange={e => setCategory(e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select>}</div></div>
        {notice && <div className="notice"><Check size={15} />{notice}<button onClick={() => setNotice('')}><X size={14} /></button></div>}
        {loading ? <div className="empty-state"><div className="loader" /><p>Cargando tu biblioteca…</p></div> : filtered.length ? <div className="website-grid">{filtered.map(site => <article className="website-card" key={site.id}><div className="card-top"><div className="site-icon" style={{ '--site-color': site.color || '#8b7cff' }}>{site.icon || '🌐'}</div><div className="card-top-right">{site.featured && <span className="featured-label"><Sparkles size={12} /> Destacada</span>}{isAdmin && showAdmin && <button className="icon-button danger-hover" onClick={() => removeWebsite(site)} aria-label={`Eliminar ${site.name}`}><Trash2 size={16} /></button>}</div></div><div className="site-category">{site.category || 'General'}</div><h3>{site.name}</h3><p className="site-description">{site.description || 'Acceso rápido a esta web.'}</p><div className="card-footer"><span className="site-domain"><span className="domain-dot" />{(() => { try { return new URL(normaliseUrl(site.url)).hostname.replace(/^www\./, ''); } catch { return site.url; } })()}</span><div className="card-actions">{isAdmin && showAdmin && <button className="icon-button" onClick={() => setModal(site)} aria-label={`Editar ${site.name}`}><Pencil size={15} /></button>}<button className="open-link" onClick={() => setSelectedSite(site)} aria-label={`Abrir ${site.name} dentro del Hub`} title="Abrir dentro del Hub"><ExternalLink size={16} /></button></div></div></article>)}</div> : <div className="empty-state"><div className="empty-icon"><Globe2 size={25} /></div><h3>{search || category !== 'Todas' ? 'No hay coincidencias' : 'Tu biblioteca empieza aquí'}</h3><p>{search || category !== 'Todas' ? 'Prueba con otra búsqueda o categoría.' : 'Añade tu primera web y tendrás todos tus enlaces a mano.'}</p>{!search && category === 'Todas' && <button className="primary-button" onClick={() => setModal({})}><Plus size={17} /> Añadir primera web</button>}</div>}
      </section>

      </>}
          {isAdmin && showUsers && <section className="users-panel"><div className="section-heading"><div><h2>Gestión de usuarios</h2><p className="muted">Crea cuentas con acceso únicamente a las webs publicadas.</p></div><button className="secondary-button" onClick={() => setShowUsers(false)}><X size={16} /> Volver a las webs</button></div><form className="user-create-form" onSubmit={createUserAccount}><label>Correo electrónico<input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="usuario@correo.com" required /></label><label>Contraseña inicial<input type="password" minLength={6} value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required /></label><button className="primary-button" disabled={userBusy}>{userBusy ? 'Creando…' : <><Plus size={16} /> Crear usuario</>}</button></form><div className="user-list">{userAccounts.map(account => <div className="user-row" key={account.id}><div><strong>{account.email || account.id}</strong><span>{account.active === false ? 'Desactivado' : 'Rol usuario'}</span></div><button className="secondary-button" onClick={() => toggleUserActive(account)}>{account.active === false ? 'Activar' : 'Desactivar'}</button></div>)}{!userAccounts.length && <p className="muted">Todavía no hay usuarios creados.</p>}</div></section>}
      <footer className="page-footer"><span><Boxes size={14} /> HUB WORKSPACE</span><span>Hecho para mantenerlo todo conectado.</span></footer>
    </main>

    {selectedSite && <div className="site-viewer"><header className="viewer-bar"><div><strong>{selectedSite.icon || '🌐'} {selectedSite.name}</strong><span>{selectedSite.url}</span></div><div className="viewer-actions"><a className="secondary-button" href={normaliseUrl(selectedSite.url)} target="_blank" rel="noopener noreferrer">Abrir en otra pestaña</a><button className="primary-button" onClick={() => setSelectedSite(null)}><X size={16} /> Volver al Hub</button></div></header><iframe title={selectedSite.name} src={normaliseUrl(selectedSite.url)} referrerPolicy="strict-origin-when-cross-origin" allow="clipboard-read; clipboard-write; fullscreen" allowFullScreen /></div>}
    {isAdmin && modal && <WebsiteForm key={modal.id || 'new'} initial={modal.id ? modal : null} onSave={saveWebsite} onClose={() => setModal(null)} />}
  </div>;
}