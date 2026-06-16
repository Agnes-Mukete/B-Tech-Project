import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, CheckCircle, Mail, MapPin, Phone, User } from 'lucide-react';
import { agencyAPI } from '../../api';
import { Spinner } from '../../components/shared';

const initialForm = {
  name: '',
  shortCode: '',
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  city: '',
  coverageCities: '',
  tier: 'standard',
};

export default function RegisterAgency() {
  const nav = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await agencyAPI.register({
        name: form.name.trim(),
        shortCode: form.shortCode.trim().toUpperCase(),
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerPhone: form.ownerPhone.trim(),
        city: form.city.trim(),
        tier: form.tier,
        coverageCities: form.coverageCities
          .split(',')
          .map(city => city.trim())
          .filter(Boolean),
      });

      setSubmitted(true);
      setForm(initialForm);
    } catch (err) {
      setError(err.response?.data?.message || 'Agency registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell" style={{ minHeight: '100vh', padding: 24, justifyContent: 'center' }}>
      <button
        onClick={() => nav('/')}
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          background: 'rgba(255,255,255,.1)',
          border: 'none',
          borderRadius: 8,
          padding: '7px 12px',
          color: 'rgba(255,255,255,.75)',
          fontSize: 13,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <ArrowLeft size={14} /> Back
      </button>

      <div
        className="auth-card"
        style={{
          width: 720,
          maxWidth: 'calc(100vw - 32px)',
          margin: '0 auto',
        }}
      >
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '18px 8px' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--success-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 18px',
              }}
            >
              <CheckCircle size={34} color="var(--success)" />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 8 }}>
              Registration submitted
            </h2>
            <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>
              Your agency has been sent to the MoveSmart administrator for review. You will be contacted after approval.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => setSubmitted(false)}>
                Register another agency
              </button>
              <button className="btn btn-primary" onClick={() => nav('/')}>
                Return to login
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: 'var(--brand-600)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                <Building2 size={24} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, marginBottom: 3 }}>
                  Register your agency
                </h2>
                <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  Submit your transport agency for administrator review.
                </p>
              </div>
            </div>

            {error && (
              <div
                style={{
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  fontSize: 13,
                  padding: '10px 12px',
                  borderRadius: 8,
                  marginBottom: 14,
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <div className="field">
                  <label className="field-label">Agency name</label>
                  <div className="input-wrap">
                    <Building2 className="input-icon" size={15} />
                    <input className="field-input" required value={form.name} onChange={e => set('name', e.target.value)} />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Short code (max 4)</label>
                  <input
                    className="field-input"
                    required
                    maxLength={4}
                    value={form.shortCode}
                    onChange={e => set('shortCode', e.target.value.toUpperCase())}
                    placeholder="MV"
                  />
                </div>

                <div className="field">
                  <label className="field-label">Owner full name</label>
                  <div className="input-wrap">
                    <User className="input-icon" size={15} />
                    <input className="field-input" required value={form.ownerName} onChange={e => set('ownerName', e.target.value)} />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Owner email</label>
                  <div className="input-wrap">
                    <Mail className="input-icon" size={15} />
                    <input className="field-input" type="email" required value={form.ownerEmail} onChange={e => set('ownerEmail', e.target.value)} />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Owner phone</label>
                  <div className="input-wrap">
                    <Phone className="input-icon" size={15} />
                    <input className="field-input" type="tel" required value={form.ownerPhone} onChange={e => set('ownerPhone', e.target.value)} />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Head office city</label>
                  <div className="input-wrap">
                    <MapPin className="input-icon" size={15} />
                    <input className="field-input" required value={form.city} onChange={e => set('city', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="field">
                <label className="field-label">Coverage cities (comma-separated)</label>
                <input
                  className="field-input"
                  value={form.coverageCities}
                  onChange={e => set('coverageCities', e.target.value)}
                  placeholder="Yaounde, Bafoussam, Douala"
                />
              </div>

              <div className="field">
                <label className="field-label">Agency tier</label>
                <select className="field-input field-select" value={form.tier} onChange={e => set('tier', e.target.value)}>
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div style={{ background: 'var(--info-bg)', color: '#3730a3', fontSize: 12, padding: '10px 12px', borderRadius: 8 }}>
                Your agency will be saved as pending. It will only appear to passengers after administrator approval.
              </div>

              <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                {loading ? <><Spinner size={16} /> Submitting...</> : 'Submit agency registration'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
