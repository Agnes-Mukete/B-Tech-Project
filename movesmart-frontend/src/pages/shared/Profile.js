import React, { useState, useEffect } from 'react';
import {
  User, Mail, Phone, BadgeCheck, Building2, Shield, Calendar,
  Clock, Edit2, Lock, Save, X, CheckCircle2, Truck, Users,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { userAPI } from '../../api';
import {
  AdminSidebar, FleetSidebar, DriverSidebar, PassengerSidebar,
  Topbar, Spinner, useToast,
} from '../../components/shared';

// ── Role meta ───────────────────────────────────────────────────────
const ROLE_META = {
  admin:        { label: 'System Administrator', color: '#1d4ed8', Icon: Shield,   Sidebar: AdminSidebar    },
  superAdmin:   { label: 'Super Administrator',  color: '#1d4ed8', Icon: Shield,   Sidebar: AdminSidebar    },
  agencyAdmin:  { label: 'Agency Administrator', color: '#0f766e', Icon: Building2,Sidebar: FleetSidebar    },
  fleetManager: { label: 'Fleet Manager',        color: '#059669', Icon: Users,    Sidebar: FleetSidebar    },
  driver:       { label: 'Driver',               color: '#0891b2', Icon: Truck,    Sidebar: DriverSidebar   },
  passenger:    { label: 'Passenger',            color: '#7c3aed', Icon: User,     Sidebar: PassengerSidebar},
};

export default function ProfilePage() {
  const { user: storeUser } = useAuthStore();
  const role    = storeUser?.role || 'passenger';
  const meta    = ROLE_META[role] || ROLE_META.passenger;
  const Sidebar = meta.Sidebar;
  const Icon    = meta.Icon;

  const [profile,  setProfile]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form,     setForm]     = useState({ name: '', phone: '' });
  const [pwForm,   setPwForm]   = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPw,   setShowPw]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const { toast, ToastContainer } = useToast();

  useEffect(() => {
    userAPI.getMe()
      .then(r => {
        setProfile(r.data.data);
        setForm({ name: r.data.data.name || '', phone: r.data.data.phone || '' });
      })
      .catch(() => toast('Failed to load profile', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  const saveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await userAPI.updateMe({ name: form.name, phone: form.phone });
      setProfile(p => ({ ...p, name: res.data.data.name, phone: res.data.data.phone }));
      toast('Profile updated ✓');
      setEditMode(false);
    } catch (err) {
      toast(err.response?.data?.message || 'Update failed', 'error');
    } finally { setSaving(false); }
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
      setShowPw(false);
    } catch (err) {
      toast(err.response?.data?.message || 'Password change failed', 'error');
    } finally { setSavingPw(false); }
  };

  const initials = (profile?.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const joinDate  = profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
  const lastLogin = profile?.lastLogin  ? new Date(profile.lastLogin).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-content">
        <Topbar title="My Profile" />
        <div className="page-body">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={32} /></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 20, alignItems: 'start' }}>

              {/* ── Left card: avatar + identity ─── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="card fade-up" style={{ textAlign: 'center', padding: 28 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%', background: meta.color,
                    color: '#fff', fontSize: 28, fontWeight: 700, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
                    boxShadow: `0 0 0 4px ${meta.color}22`,
                  }}>
                    {initials}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{profile?.name}</div>
                  {/* Role badge */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 99,
                    background: `${meta.color}18`, color: meta.color,
                  }}>
                    <Icon size={11} /> {meta.label}
                  </span>

                  {/* Staff ID (drivers / fleet managers) */}
                  {profile?.staffId && (
                    <div style={{ marginTop: 14, background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600, marginBottom: 2 }}>STAFF ID</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--text-1)', letterSpacing: 1 }}>
                        {profile.staffId}
                      </div>
                    </div>
                  )}
                </div>

                {/* Stats card */}
                <div className="card fade-up" style={{ padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 14 }}>Account info</div>
                  {[
                    { icon: Calendar, label: 'Member since', value: joinDate },
                    { icon: Clock,    label: 'Last login',   value: lastLogin },
                    { icon: Building2,label: 'Agency',       value: profile?.agencyId?.name || 'Platform' },
                  ].map(({ icon: RowIcon, label, value }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                      <RowIcon size={14} color="var(--text-3)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Right: editable details ─────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Personal info */}
                <div className="card fade-up">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>Personal information</div>
                    {!editMode ? (
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditMode(true)}>
                        <Edit2 size={13} /> Edit
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => { setEditMode(false); setForm({ name: profile?.name || '', phone: profile?.phone || '' }); }}>
                        <X size={13} /> Cancel
                      </button>
                    )}
                  </div>

                  {editMode ? (
                    <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="field">
                        <label className="field-label">Full name</label>
                        <div className="input-wrap">
                          <User className="input-icon" size={14} />
                          <input className="field-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                        </div>
                      </div>
                      <div className="field">
                        <label className="field-label">Phone number</label>
                        <div className="input-wrap">
                          <Phone className="input-icon" size={14} />
                          <input className="field-input" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+237 6XX XXX XXX" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                          {saving ? <Spinner size={14} /> : <><Save size={13} /> Save changes</>}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      {[
                        { icon: User,       label: 'Full name',    value: profile?.name    || '—' },
                        { icon: Mail,       label: 'Email',        value: profile?.email   || '—' },
                        { icon: Phone,      label: 'Phone',        value: profile?.phone   || '—' },
                        { icon: BadgeCheck, label: 'Staff ID',     value: profile?.staffId || '—', hide: !profile?.staffId && !['driver','fleetManager'].includes(role) },
                      ].filter(f => !f.hide).map(({ icon: FIcon, label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FIcon size={11} /> {label}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Password change */}
                <div className="card fade-up">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>Password & security</div>
                    {!showPw ? (
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowPw(true)}>
                        <Lock size={13} /> Change password
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => { setShowPw(false); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }}>
                        <X size={13} /> Cancel
                      </button>
                    )}
                  </div>

                  {showPw ? (
                    <form onSubmit={savePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {[
                        { key: 'currentPassword', label: 'Current password' },
                        { key: 'newPassword',     label: 'New password' },
                        { key: 'confirmPassword', label: 'Confirm new password' },
                      ].map(({ key, label }) => (
                        <div key={key} className="field">
                          <label className="field-label">{label}</label>
                          <div className="input-wrap">
                            <Lock className="input-icon" size={14} />
                            <input className="field-input" type="password" value={pwForm[key]}
                              onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))} required />
                          </div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={savingPw}>
                          {savingPw ? <Spinner size={14} /> : <><CheckCircle2 size={13} /> Update password</>}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)', fontSize: 13 }}>
                      <Lock size={16} />
                      Password last changed on account update. Click "Change password" to update.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
