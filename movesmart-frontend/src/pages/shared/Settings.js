import React, { useState, useEffect } from 'react';
import {
  Bell, Lock, User, Shield, Globe,
  CheckCircle2,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { userAPI } from '../../api';
import {
  AdminSidebar, FleetSidebar, DriverSidebar, PassengerSidebar,
  Topbar, Spinner, useToast,
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

// ── Toggle component ────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: value ? 'var(--brand-500)' : 'var(--border-2)',
        position: 'relative', transition: 'background .2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: value ? 23 : 3, width: 18, height: 18,
        borderRadius: '50%', background: '#fff', transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.3)',
      }} />
    </button>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────
function Section({ icon: Icon, title, children }) {
  return (
    <div className="card fade-up" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 20 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color="var(--brand-600)" />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── Setting row ─────────────────────────────────────────────────────
function SettingRow({ label, sub, right }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
      </div>
      <div>{right}</div>
    </div>
  );
}

const DEFAULT_PREFS = {
  emailOnTripAssigned: true,
  emailOnBookingConfirmed: true,
  emailOnIncident: true,
  pushNotifications: true,
  smsAlerts: false,
};

export default function SettingsPage() {
  const Sidebar = useSidebar();
  const { user } = useAuthStore();
  const role = user?.role || 'passenger';

  const [prefs,    setPrefs]    = useState(DEFAULT_PREFS);
  const [pwForm,   setPwForm]   = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPw, setSavingPw] = useState(false);
  const { toast, ToastContainer } = useToast();

  // Load prefs from localStorage (persisted client-side)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('movesmart-prefs');
      if (stored) setPrefs(p => ({ ...p, ...JSON.parse(stored) }));
    } catch (_) {}
  }, []);

  const setPref = (key, val) => {
    setPrefs(p => {
      const next = { ...p, [key]: val };
      localStorage.setItem('movesmart-prefs', JSON.stringify(next));
      return next;
    });
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast('Passwords do not match', 'error'); return;
    }
    if (pwForm.newPassword.length < 8) {
      toast('Password must be at least 8 characters', 'error'); return;
    }
    setSavingPw(true);
    try {
      await userAPI.updateMe({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      toast('Password changed ✓');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast(err.response?.data?.message || 'Password change failed', 'error');
    } finally { setSavingPw(false); }
  };

  const isStaff = ['driver', 'fleetManager', 'agencyAdmin'].includes(role);
  const isAdmin  = ['admin', 'superAdmin'].includes(role);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Topbar title="Settings" />
        <div className="page-body" style={{ maxWidth: 720 }}>

          {/* ── Notification preferences ── */}
          <Section icon={Bell} title="Notification preferences">
            <SettingRow
              label="Push notifications"
              sub="In-app alerts for trips, bookings and incidents"
              right={<Toggle value={prefs.pushNotifications} onChange={v => setPref('pushNotifications', v)} />}
            />
            {(isStaff || isAdmin) && (
              <SettingRow
                label="Email alerts — trip assigned"
                sub="Get an email when a trip is assigned to you"
                right={<Toggle value={prefs.emailOnTripAssigned} onChange={v => setPref('emailOnTripAssigned', v)} />}
              />
            )}
            {(role === 'passenger') && (
              <SettingRow
                label="Email alerts — booking confirmed"
                sub="Get an email when a booking is confirmed or cancelled"
                right={<Toggle value={prefs.emailOnBookingConfirmed} onChange={v => setPref('emailOnBookingConfirmed', v)} />}
              />
            )}
            {(isStaff || isAdmin) && (
              <SettingRow
                label="Email alerts — incidents"
                sub="Get notified when an incident is reported or resolved"
                right={<Toggle value={prefs.emailOnIncident} onChange={v => setPref('emailOnIncident', v)} />}
              />
            )}
            <SettingRow
              label="SMS alerts"
              sub="Receive critical alerts via SMS (may incur charges)"
              right={<Toggle value={prefs.smsAlerts} onChange={v => setPref('smsAlerts', v)} />}
            />
          </Section>

          {/* ── Account info ── */}
          <Section icon={User} title="Account">
            <SettingRow
              label="Full name"
              sub={user?.name}
              right={
                <button className="btn btn-secondary btn-sm" onClick={() => window.location.href = '/profile'}>
                  Edit in profile
                </button>
              }
            />
            <SettingRow
              label="Email address"
              sub={user?.email || '—'}
              right={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>Contact admin to change</span>}
            />
            {user?.staffId && (
              <SettingRow
                label="Staff ID"
                sub="System-generated identifier"
                right={
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, background: 'var(--surface-2)', padding: '3px 8px', borderRadius: 6 }}>
                    {user.staffId}
                  </span>
                }
              />
            )}
          </Section>

          {/* ── Security ── */}
          <Section icon={Lock} title="Security">
            <form onSubmit={savePassword}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                {[
                  { key: 'currentPassword', label: 'Current password' },
                  { key: 'newPassword',     label: 'New password' },
                  { key: 'confirmPassword', label: 'Confirm new password' },
                ].map(({ key, label }) => (
                  <div key={key} className="field">
                    <label className="field-label">{label}</label>
                    <div className="input-wrap">
                      <Lock className="input-icon" size={14} />
                      <input
                        className="field-input"
                        type="password"
                        value={pwForm[key]}
                        onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                        required
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingPw}>
                {savingPw ? <Spinner size={14} /> : <><CheckCircle2 size={13} /> Update password</>}
              </button>
            </form>
          </Section>

          {/* ── Preferences ── */}
          <Section icon={Globe} title="Display preferences">
            <SettingRow
              label="Language"
              sub="Interface language"
              right={
                <select className="field-input field-select" style={{ width: 140, height: 32, fontSize: 12 }}
                  defaultValue="en">
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                </select>
              }
            />
            <SettingRow
              label="Time zone"
              sub="Used for schedule and trip times"
              right={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>Africa/Douala</span>}
            />
          </Section>

          {/* ── Admin-only: system ── */}
          {isAdmin && (
            <Section icon={Shield} title="System (Admin only)">
              <SettingRow
                label="Audit logging"
                sub="All user actions are logged for security review"
                right={<span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>Enabled</span>}
              />
              <SettingRow
                label="Account lockout policy"
                sub="Accounts lock after 5 failed login attempts for 30 minutes"
                right={<span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>Active</span>}
              />
              <SettingRow
                label="JWT expiry"
                sub="Access tokens expire every 15 minutes; refresh tokens last 7 days"
                right={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>15m / 7d</span>}
              />
            </Section>
          )}

        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
