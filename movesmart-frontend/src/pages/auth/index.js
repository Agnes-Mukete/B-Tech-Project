import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { Building2, Car, Shield, Users, Truck, User, Mail, Lock, Phone, Eye, EyeOff, ArrowLeft, BadgeCheck } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { Spinner } from '../../components/shared';

const ROLES = [
  { id: 'admin',        label: 'System Administrator', sub: 'Manage platform, agencies & global reports', icon: Shield, color: '#1d4ed8', dest: '/admin/dashboard' },
  { id: 'fleetManager', label: 'Fleet Manager',        sub: 'Manage vehicles, routes & schedules',        icon: Users,  color: '#059669', dest: '/fleet/dashboard' },
  { id: 'driver',       label: 'Driver',               sub: 'View trips & manage assignments',            icon: Truck,  color: '#0891b2', dest: '/driver/dashboard' },
  { id: 'passenger',    label: 'Passenger',            sub: 'Book trips & track vehicles',                icon: User,   color: '#7c3aed', dest: '/passenger/agencies' },
];

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

// Inner component — useGoogleLogin hook is only called when this actually renders
function GoogleBtnInner({ label, onSuccess, disabled }) {
  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => onSuccess({ credential: tokenResponse.access_token }),
    onError: () => {},
    flow: 'implicit',
  });

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => login()}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: '10px 16px', borderRadius: 10,
        border: '1.5px solid var(--border)', background: '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 500,
        color: '#1f2937', transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.84l6.09-6.09C34.46 3.19 29.52 1 24 1 14.82 1 6.98 6.55 3.46 14.44l7.08 5.5C12.3 14.01 17.73 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.5 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.7c-.55 2.96-2.22 5.47-4.72 7.16l7.26 5.64C43.37 37.62 46.5 31.51 46.5 24.5z"/>
        <path fill="#FBBC05" d="M10.54 28.56A14.45 14.45 0 0 1 9.5 24c0-1.59.27-3.13.75-4.57l-7.08-5.5A23.97 23.97 0 0 0 0 24c0 3.88.93 7.55 2.56 10.79l7.98-6.23z"/>
        <path fill="#34A853" d="M24 47c5.52 0 10.16-1.83 13.54-4.96l-7.26-5.64c-1.83 1.23-4.18 1.96-6.28 1.96-6.28 0-11.6-4.51-13.46-10.8l-7.98 6.23C6.98 41.45 14.82 47 24 47z"/>
      </svg>
      {label}
    </button>
  );
}

// Outer wrapper — uses real Google flow when configured, shows button either way
function GoogleBtn({ label, onSuccess, disabled }) {
  if (GOOGLE_CLIENT_ID) {
    return <GoogleBtnInner label={label} onSuccess={onSuccess} disabled={disabled} />;
  }
  // Show the button visually even before the client ID is set up
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => alert('Google Sign-In requires a Google Client ID.\nAdd REACT_APP_GOOGLE_CLIENT_ID to movesmart-frontend/.env and restart.')}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: '10px 16px', borderRadius: 10,
        border: '1.5px solid var(--border)', background: '#fff',
        cursor: 'pointer', fontSize: 14, fontWeight: 500,
        color: '#1f2937', transition: 'box-shadow .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.14 0 5.95 1.08 8.17 2.84l6.09-6.09C34.46 3.19 29.52 1 24 1 14.82 1 6.98 6.55 3.46 14.44l7.08 5.5C12.3 14.01 17.73 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.5 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.7c-.55 2.96-2.22 5.47-4.72 7.16l7.26 5.64C43.37 37.62 46.5 31.51 46.5 24.5z"/>
        <path fill="#FBBC05" d="M10.54 28.56A14.45 14.45 0 0 1 9.5 24c0-1.59.27-3.13.75-4.57l-7.08-5.5A23.97 23.97 0 0 0 0 24c0 3.88.93 7.55 2.56 10.79l7.98-6.23z"/>
        <path fill="#34A853" d="M24 47c5.52 0 10.16-1.83 13.54-4.96l-7.26-5.64c-1.83 1.23-4.18 1.96-6.28 1.96-6.28 0-11.6-4.51-13.46-10.8l-7.98 6.23C6.98 41.45 14.82 47 24 47z"/>
      </svg>
      {label}
    </button>
  );
}

// ── Divider ────────────────────────────────────────────────────────────────
function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>or continue with email</span>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

// ── Role Selection ─────────────────────────────────────────────────────────
export function RoleSelectPage() {
  const nav = useNavigate();
  return (
    <div className="auth-shell" style={{ alignItems: 'center', justifyContent: 'center', padding: 24, gap: 32 }}>
      <div style={{ textAlign: 'center' }} className="fade-up">
        <div style={{ width: 72, height: 72, background: 'rgba(255,255,255,.1)', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px', border: '1px solid rgba(255,255,255,.15)' }}>
          <Car size={36} color="#fff" />
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 600, color: '#fff', letterSpacing: -1, marginBottom: 6 }}>Move Smart</h1>
        <p style={{ color: 'rgba(255,255,255,.55)', fontSize: 14 }}>Intelligent Transport Management System</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 380 }}>
        {ROLES.map((r, i) => {
          const Icon = r.icon;
          return (
            <button key={r.id} className="fade-up" style={{ animationDelay: `${i * .07}s`, background: '#fff', border: 'none', borderRadius: 16, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', transition: 'transform .15s, box-shadow .15s', boxShadow: '0 2px 12px rgba(0,0,0,.12)' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,.12)'; }}
              onClick={() => nav(`/login/${r.id}`)}>
              <div style={{ width: 48, height: 48, borderRadius: 13, background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={22} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{r.label}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{r.sub}</div>
              </div>
            </button>
          );
        })}

        <button
          className="fade-up"
          style={{ animationDelay: `${ROLES.length * .07}s`, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', color: '#fff' }}
          onClick={() => nav('/agency/register')}
        >
          <div style={{ width: 44, height: 44, borderRadius: 13, background: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={20} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Register a transport agency</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.62)' }}>Submit agency details for admin approval</div>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Login ──────────────────────────────────────────────────────────────────
export function LoginPage() {
  const nav = useNavigate();
  const { login, socialLogin, loading, error, clearError } = useAuthStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const roleId = window.location.pathname.split('/').pop();
  const role = ROLES.find(r => r.id === roleId) || ROLES[0];
  const dest = role.dest;
  const useStaffId = ['driver', 'fleetManager'].includes(role.id);
  const isPassenger = role.id === 'passenger';

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const result = await login(identifier, password);
    if (result.ok) nav(dest);
  };

  const handleGoogle = async ({ credential }) => {
    clearError();
    const result = await socialLogin('google', { credential });
    if (result.ok) nav('/passenger/agencies');
  };

  return (
    <div className="auth-shell" style={{ alignItems: 'center', justifyContent: 'center', padding: 24, gap: 0 }}>
      <button onClick={() => nav('/')} style={{ position: 'absolute', top: 20, left: 20, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, padding: '7px 12px', color: 'rgba(255,255,255,.7)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={14} /> Back to role selection
      </button>

      <div className="auth-card">
        <div style={{ marginBottom: 22 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>Sign in as <strong>{role.label}</strong></p>
        </div>

        {error && (
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 13, padding: '10px 12px', borderRadius: 8, marginBottom: 16, fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            {useStaffId ? (
              <>
                <label className="field-label">Staff ID</label>
                <div className="input-wrap">
                  <BadgeCheck className="input-icon" size={15} />
                  <input className="field-input" type="text" value={identifier} onChange={e => setIdentifier(e.target.value.toUpperCase())} placeholder="e.g. GLD-DRV-001" autoComplete="username" required />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Your Staff ID was assigned by your agency administrator.</p>
              </>
            ) : (
              <>
                <label className="field-label">Email address</label>
                <div className="input-wrap">
                  <Mail className="input-icon" size={15} />
                  <input className="field-input" type="email" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="your.email@example.com" autoComplete="email" required />
                </div>
              </>
            )}
          </div>

          <div className="field">
            <label className="field-label">Password</label>
            <div className="input-wrap">
              <Lock className="input-icon" size={15} />
              <input className="field-input" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {!useStaffId && (
            <div style={{ textAlign: 'right' }}>
              <button type="button" onClick={() => nav('/forgot-password')} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                Forgot password?
              </button>
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <><Spinner size={16} /> Signing in…</> : 'Sign in'}
          </button>
        </form>

        {/* Google as alternative — passengers only */}
        {isPassenger && (
          <>
            <OrDivider />
            <GoogleBtn label="Continue with Google" onSuccess={handleGoogle} disabled={loading} />
          </>
        )}

        {!useStaffId && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-3)', marginTop: 20 }}>
            Don't have an account?{' '}
            <button onClick={() => nav(`/register/${roleId}`)} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontWeight: 600, cursor: 'pointer' }}>
              Register
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

// ── Register ───────────────────────────────────────────────────────────────
export function RegisterPage() {
  const nav = useNavigate();
  const { register, socialLogin, loading, error, clearError } = useAuthStore();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [showPw, setShowPw] = useState(false);
  const [validationError, setValidationError] = useState('');

  const roleId = window.location.pathname.split('/').pop();
  const role = ROLES.find(r => r.id === roleId) || ROLES[3];
  const canSelfRegister = role.id === 'passenger';

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setValidationError('');
    if (!canSelfRegister) { setValidationError('Staff accounts are created by a system or agency administrator.'); return; }
    if (form.password !== form.confirmPassword) { setValidationError('Passwords do not match'); return; }
    if (form.password.length < 8) { setValidationError('Password must be at least 8 characters'); return; }
    const result = await register({ name: form.name, email: form.email, phone: form.phone, password: form.password, role: roleId });
    if (result.ok) nav(role.dest);
  };

  const handleGoogle = async ({ credential }) => {
    clearError();
    const result = await socialLogin('google', { credential });
    if (result.ok) nav('/passenger/agencies');
  };

  return (
    <div className="auth-shell" style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <button onClick={() => nav(`/login/${roleId}`)} style={{ position: 'absolute', top: 20, left: 20, background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 8, padding: '7px 12px', color: 'rgba(255,255,255,.7)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
        <ArrowLeft size={14} /> Back to login
      </button>

      <div className="auth-card">
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>Create account</h2>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            {canSelfRegister ? <>Register as <strong>{role.label}</strong></> : 'Staff accounts are invite-only'}
          </p>
        </div>

        {(error || validationError) && (
          <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: 13, padding: '10px 12px', borderRadius: 8, marginBottom: 14, fontWeight: 500 }}>
            {validationError || error}
          </div>
        )}

        {!canSelfRegister && (
          <div style={{ background: 'var(--info-bg)', color: '#3730a3', fontSize: 13, padding: '10px 12px', borderRadius: 8, marginBottom: 14, fontWeight: 500 }}>
            Ask your system administrator or agency administrator to create this account for you.
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label className="field-label">Full name</label>
            <div className="input-wrap"><User className="input-icon" size={15} /><input className="field-input" type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Doe" required /></div>
          </div>
          <div className="field">
            <label className="field-label">Email address</label>
            <div className="input-wrap"><Mail className="input-icon" size={15} /><input className="field-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="your.email@example.com" required /></div>
          </div>
          <div className="field">
            <label className="field-label">Phone number</label>
            <div className="input-wrap"><Phone className="input-icon" size={15} /><input className="field-input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+237 6XX XXX XXX" /></div>
          </div>
          <div className="field">
            <label className="field-label">Password</label>
            <div className="input-wrap">
              <Lock className="input-icon" size={15} />
              <input className="field-input" type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} placeholder="Create a strong password" required style={{ paddingRight: 40 }} />
              <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>{showPw ? <EyeOff size={15} /> : <Eye size={15} />}</button>
            </div>
          </div>
          <div className="field">
            <label className="field-label">Confirm password</label>
            <div className="input-wrap"><Lock className="input-icon" size={15} /><input className="field-input" type="password" value={form.confirmPassword} onChange={e => set('confirmPassword', e.target.value)} placeholder="Confirm your password" required /></div>
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" style={{ marginTop: 4 }} disabled={loading || !canSelfRegister}>
            {loading ? <><Spinner size={16} /> Creating account…</> : 'Create account'}
          </button>
        </form>

        {/* Google as alternative — passengers only */}
        {canSelfRegister && (
          <>
            <OrDivider />
            <GoogleBtn label="Sign up with Google" onSuccess={handleGoogle} disabled={loading} />
          </>
        )}
      </div>
    </div>
  );
}
