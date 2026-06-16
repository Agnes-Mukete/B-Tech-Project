import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Users, Route, Calendar, AlertTriangle,
  BarChart2, FileText, Settings, LogOut, Car, MapPin, History,
  BookOpen, Navigation, Building2, Bell, Search, X, Check, User,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { notificationAPI } from '../../api';

// ── Avatar ─────────────────────────────────────────────────────────
export function Avatar({ name = '', size = 32, color = '#1d4ed8' }) {
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const bg = color;
  return (
    <div className="avatar" style={{ width: size, height: size, background: bg, color: '#fff', fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────────
export function Spinner({ size = 20 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

// ── NavItem ─────────────────────────────────────────────────────────
function NavItem({ icon: Icon, label, to, badge, onClick }) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const active = pathname.startsWith(to);
  return (
    <button className={`nav-item ${active ? 'active' : ''}`}
      onClick={() => { if (onClick) onClick(); else nav(to); }}>
      <Icon size={15} />
      <span>{label}</span>
      {badge > 0 && <span className="nav-badge">{badge}</span>}
    </button>
  );
}

// ── Admin Sidebar ───────────────────────────────────────────────────
export function AdminSidebar({ pendingCount = 0 }) {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><Car size={18} color="#fff" /></div>
        <div>
          <div className="sidebar-logo-text">MoveSmart</div>
          <div className="sidebar-logo-sub">System Admin</div>
        </div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-label">Overview</div>
        <NavItem icon={LayoutDashboard} label="Dashboard" to="/admin/dashboard" />
        <NavItem icon={Building2}       label="Agencies"  to="/admin/agencies" badge={pendingCount} />
        <NavItem icon={Users}           label="Users"     to="/admin/users" />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-label">Operations</div>
        <NavItem icon={BarChart2}  label="Analytics" to="/admin/analytics" />
        <NavItem icon={FileText}   label="Reports"   to="/admin/reports" />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-label">System</div>
        <NavItem icon={Bell}     label="Notifications" to="/notifications" />
        <NavItem icon={User}     label="My Profile"    to="/profile" />
        <NavItem icon={Settings} label="Settings"      to="/settings" />
      </div>
      <div className="sidebar-spacer" />
      <div className="sidebar-user">
        <Avatar name={user?.name || 'A'} size={30} color="#1d4ed8" />
        <div>
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-role">System Administrator</div>
        </div>
        <button className="nav-item btn-ghost" style={{ marginLeft: 'auto', padding: '4px', width: 'auto', minWidth: 0 }}
          onClick={() => { logout(); nav('/'); }}>
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}

// ── Fleet Sidebar ───────────────────────────────────────────────────
export function FleetSidebar() {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><Car size={18} color="#fff" /></div>
        <div>
          <div className="sidebar-logo-text">MoveSmart</div>
          <div className="sidebar-logo-sub">Fleet Portal</div>
        </div>
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-label">Fleet</div>
        <NavItem icon={LayoutDashboard} label="Overview"   to="/fleet/dashboard" />
        <NavItem icon={Truck}           label="Vehicles"   to="/fleet/vehicles" />
        <NavItem icon={Route}           label="Routes"     to="/fleet/routes" />
        <NavItem icon={Calendar}        label="Schedule"   to="/fleet/schedule" />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-label">People</div>
        <NavItem icon={Users}          label="Drivers"    to="/fleet/drivers" />
        <NavItem icon={AlertTriangle}  label="Incidents"  to="/fleet/incidents" />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-label">Analytics</div>
        <NavItem icon={BarChart2} label="Performance" to="/fleet/analytics" />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-label">Account</div>
        <NavItem icon={Bell}     label="Notifications" to="/notifications" />
        <NavItem icon={User}     label="My Profile"    to="/profile" />
        <NavItem icon={Settings} label="Settings"      to="/settings" />
      </div>
      <div className="sidebar-spacer" />
      <div className="sidebar-user">
        <Avatar name={user?.name || 'F'} size={30} color="#059669" />
        <div>
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-role">{user?.role === 'agencyAdmin' ? 'Agency Administrator' : 'Fleet Manager'}</div>
        </div>
        <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
          onClick={() => { logout(); nav('/'); }}>
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}

// ── Driver Sidebar ──────────────────────────────────────────────────
export function DriverSidebar() {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><Car size={18} color="#fff" /></div>
        <div>
          <div className="sidebar-logo-text">MoveSmart</div>
          <div className="sidebar-logo-sub">Driver App</div>
        </div>
      </div>
      <div className="sidebar-section">
        <NavItem icon={LayoutDashboard} label="My Trips"  to="/driver/dashboard" />
        <NavItem icon={Navigation}      label="Live Map"  to="/driver/map" />
        <NavItem icon={AlertTriangle}   label="Incidents" to="/driver/incidents" />
        <NavItem icon={History}         label="History"   to="/driver/history" />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-label">Account</div>
        <NavItem icon={Bell}     label="Notifications" to="/notifications" />
        <NavItem icon={User}     label="My Profile"    to="/profile" />
        <NavItem icon={Settings} label="Settings"      to="/settings" />
      </div>
      <div className="sidebar-spacer" />
      <div className="sidebar-user">
        <Avatar name={user?.name || 'D'} size={30} color="#0891b2" />
        <div>
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-role">Driver</div>
        </div>
        <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
          onClick={() => { logout(); nav('/'); }}>
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}

// ── Passenger Sidebar ───────────────────────────────────────────────
export function PassengerSidebar() {
  const { user, logout } = useAuthStore();
  const nav = useNavigate();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon"><Car size={18} color="#fff" /></div>
        <div>
          <div className="sidebar-logo-text">MoveSmart</div>
          <div className="sidebar-logo-sub">Passenger</div>
        </div>
      </div>
      <div className="sidebar-section">
        <NavItem icon={Building2}  label="Agencies"  to="/passenger/agencies" />
        <NavItem icon={BookOpen}   label="My Trips"  to="/passenger/bookings" />
        <NavItem icon={MapPin}     label="Track"     to="/passenger/track" />
        <NavItem icon={History}    label="History"   to="/passenger/history" />
      </div>
      <div className="sidebar-section">
        <div className="sidebar-section-label">Account</div>
        <NavItem icon={Bell}     label="Notifications" to="/notifications" />
        <NavItem icon={User}     label="My Profile"    to="/profile" />
        <NavItem icon={Settings} label="Settings"      to="/settings" />
      </div>
      <div className="sidebar-spacer" />
      <div className="sidebar-user">
        <Avatar name={user?.name || 'P'} size={30} color="#7c3aed" />
        <div>
          <div className="sidebar-user-name">{user?.name}</div>
          <div className="sidebar-user-role">Passenger</div>
        </div>
        <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
          onClick={() => { logout(); nav('/'); }}>
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}

// ── Topbar ─────────────────────────────────────────────────────────
export function Topbar({ title, actions }) {
  const nav = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    notificationAPI.unreadCount()
      .then(r => setUnread(r.data.data.count || 0))
      .catch(() => {});
    // Poll every 60s
    const id = setInterval(() => {
      notificationAPI.unreadCount()
        .then(r => setUnread(r.data.data.count || 0))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="topbar">
      <div className="topbar-title">{title}</div>
      <div className="topbar-right">
        {actions}
        {/* Notification bell */}
        <button
          onClick={() => nav('/notifications')}
          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative' }}
          title="Notifications"
        >
          <Bell size={15} color="var(--text-2)" />
          {unread > 0 && (
            <span style={{
              position: 'absolute', top: -4, right: -4,
              background: 'var(--brand-500)', color: '#fff',
              borderRadius: 99, fontSize: 9, fontWeight: 700,
              minWidth: 16, height: 16, display: 'flex',
              alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              border: '2px solid var(--surface)',
            }}>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        {/* Profile */}
        <button
          onClick={() => nav('/profile')}
          style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          title="My profile"
        >
          <User size={15} color="var(--text-2)" />
        </button>
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}><X size={14} /></button>
        </div>
        {children}
        {footer && <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── useToast hook ──────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  const ToastContainer = () => (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className="fade-up" style={{
          background: t.type === 'error' ? 'var(--danger)' : t.type === 'warning' ? 'var(--warning)' : '#1e293b',
          color: '#fff', padding: '10px 16px', borderRadius: 10,
          fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: 'var(--shadow-lg)', minWidth: 220,
        }}>
          {t.type === 'success' && <Check size={14} />}
          {t.type === 'error' && <X size={14} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
  return { toast, ToastContainer };
}

// ── Pill ───────────────────────────────────────────────────────────
export function Pill({ status }) {
  const map = {
    active: 'pill-active', idle: 'pill-idle', maintenance: 'pill-maint',
    pending: 'pill-pending', upcoming: 'pill-upcoming',
    completed: 'pill-completed', cancelled: 'pill-cancelled',
    inProgress: 'pill-inProgress', scheduled: 'pill-upcoming',
    suspended: 'pill-maint',
  };
  return <span className={`pill ${map[status] || 'pill-idle'}`}>{status}</span>;
}

// ── FuelBar ────────────────────────────────────────────────────────
export function FuelBar({ level }) {
  const color = level > 60 ? '#10b981' : level > 30 ? '#f59e0b' : '#ef4444';
  return (
    <div className="fuel-bar">
      <div className="fuel-bar-bg">
        <div className="fuel-bar-fill" style={{ width: `${level}%`, background: color }} />
      </div>
      <div className="fuel-pct" style={{ color }}>{level}%</div>
    </div>
  );
}

// ── ProgressBar ────────────────────────────────────────────────────
export function ProgressBar({ value, max = 100, color }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="progress-bar">
      <div className="progress-bg">
        <div className="progress-fill" style={{ width: `${pct}%`, background: color || 'var(--brand-500)' }} />
      </div>
    </div>
  );
}

// ── SearchBar ──────────────────────────────────────────────────────
export function SearchBar({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="search-bar">
      <Search size={14} />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      {value && <button onClick={() => onChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={12} /></button>}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)' }}>
      {Icon && <Icon size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />}
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 12 }}>{sub}</div>}
    </div>
  );
}
