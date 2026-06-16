import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCheck, Trash2, BellOff,
  ShoppingBag, Truck, AlertTriangle, Building2, Lock, Info,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { notificationAPI } from '../../api';
import {
  AdminSidebar, FleetSidebar, DriverSidebar, PassengerSidebar,
  Topbar, Spinner, EmptyState, useToast,
} from '../../components/shared';

// ── Sidebar picker ──────────────────────────────────────────────────
function useSidebar() {
  const { user } = useAuthStore();
  const map = {
    admin: AdminSidebar, superAdmin: AdminSidebar,
    agencyAdmin: FleetSidebar, fleetManager: FleetSidebar,
    driver: DriverSidebar,
    passenger: PassengerSidebar,
  };
  return map[user?.role] || PassengerSidebar;
}

// ── Notification type display config ────────────────────────────────
const TYPE_META = {
  trip_assigned:    { Icon: Truck,         color: '#0891b2', bg: '#e0f2fe' },
  trip_started:     { Icon: Truck,         color: '#059669', bg: '#d1fae5' },
  trip_completed:   { Icon: Truck,         color: '#059669', bg: '#d1fae5' },
  trip_cancelled:   { Icon: Truck,         color: '#dc2626', bg: '#fee2e2' },
  booking_confirmed:{ Icon: ShoppingBag,   color: '#7c3aed', bg: '#ede9fe' },
  booking_cancelled:{ Icon: ShoppingBag,   color: '#dc2626', bg: '#fee2e2' },
  incident_reported:{ Icon: AlertTriangle, color: '#d97706', bg: '#fef3c7' },
  incident_resolved:{ Icon: AlertTriangle, color: '#059669', bg: '#d1fae5' },
  agency_approved:  { Icon: Building2,     color: '#059669', bg: '#d1fae5' },
  agency_suspended: { Icon: Building2,     color: '#dc2626', bg: '#fee2e2' },
  account_locked:   { Icon: Lock,          color: '#dc2626', bg: '#fee2e2' },
  general:          { Icon: Info,          color: '#1d4ed8', bg: '#dbeafe' },
};

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function NotificationsPage() {
  const Sidebar = useSidebar();

  const [notifications, setNotifications] = useState([]);
  const [unread,  setUnread]  = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all'); // 'all' | 'unread'
  const { toast, ToastContainer } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = filter === 'unread' ? { read: 'false' } : {};
      const res = await notificationAPI.list(params);
      setNotifications(res.data.data);
      setUnread(res.data.unreadCount);
    } catch {
      toast('Failed to load notifications', 'error');
    } finally { setLoading(false); }
  }, [filter, toast]);

  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    await notificationAPI.markRead(id).catch(() => {});
    setNotifications(ns => ns.map(n => n._id === id ? { ...n, read: true } : n));
    setUnread(u => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifications(ns => ns.map(n => ({ ...n, read: true })));
      setUnread(0);
      toast('All marked as read ✓');
    } catch { toast('Failed', 'error'); }
  };

  const remove = async (id, wasUnread) => {
    try {
      await notificationAPI.remove(id);
      setNotifications(ns => ns.filter(n => n._id !== id));
      if (wasUnread) setUnread(u => Math.max(0, u - 1));
    } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Notifications" />
        <div className="page-body">
          <div className="card fade-up">
            {/* Tabs + bulk action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 4, flex: 1 }}>
                {[['all', 'All'], ['unread', 'Unread']].map(([v, lbl]) => (
                  <button key={v} className={`tab-btn ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>
                    {lbl}
                    {v === 'unread' && unread > 0 && (
                      <span style={{ marginLeft: 5, background: 'var(--brand-500)', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 5px' }}>
                        {unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {unread > 0 && (
                <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
                  <CheckCheck size={13} /> Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
                <Spinner size={28} />
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title="No notifications"
                sub={filter === 'unread' ? "You're all caught up!" : 'Notifications will appear here'}
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {notifications.map(n => {
                  const m = TYPE_META[n.type] || TYPE_META.general;
                  const NIcon = m.Icon;
                  return (
                    <NotificationRow
                      key={n._id}
                      notification={n}
                      meta={m}
                      NIcon={NIcon}
                      onRead={markRead}
                      onRemove={remove}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}

// ── Single notification row ─────────────────────────────────────────
function NotificationRow({ notification: n, meta: m, NIcon, onRead, onRemove }) {
  const handleClick = () => {
    if (!n.read) onRead(n._id);
    if (n.link)  window.location.href = n.link;
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
        background: n.read ? 'transparent' : 'var(--brand-50)',
        borderLeft: n.read ? '3px solid transparent' : `3px solid ${m.color}`,
        transition: 'background .12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = n.read ? 'transparent' : 'var(--brand-50)'; }}
    >
      {/* Type icon */}
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: m.bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0,
      }}>
        <NIcon size={17} color={m.color} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: 'var(--text-1)' }}>
            {n.title}
          </span>
          {!n.read && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand-500)', flexShrink: 0 }} />
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>{n.message}</div>
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{timeAgo(n.createdAt)}</div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center' }}>
        {!n.read && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ padding: '3px 8px', fontSize: 11 }}
            title="Mark as read"
            onClick={e => { e.stopPropagation(); onRead(n._id); }}
          >
            <CheckCheck size={12} />
          </button>
        )}
        <button
          className="btn btn-danger btn-sm"
          style={{ padding: '3px 8px', fontSize: 11 }}
          title="Delete"
          onClick={e => { e.stopPropagation(); onRemove(n._id, !n.read); }}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
