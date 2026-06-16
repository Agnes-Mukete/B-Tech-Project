import React, { useState, useEffect } from 'react';
import { History, MapPin, Clock, Star, TrendingUp, DollarSign, Calendar } from 'lucide-react';
import { PassengerSidebar, Topbar, Pill, EmptyState, Spinner, Modal, useToast } from '../../components/shared';
import { bookingAPI, agencyAPI } from '../../api';

export default function PassengerHistory() {
  const [bookings,  setBookings]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [rateModal, setRateModal] = useState(null);
  const [rating,    setRating]    = useState(5);
  const [comment,   setComment]   = useState('');
  const [saving,    setSaving]    = useState(false);
  const { toast, ToastContainer } = useToast();

  useEffect(() => {
    bookingAPI.myBookings({ status: 'completed', limit: 200 })
      .then(r => setBookings(r.data.data))
      .catch(() => toast('Failed to load history', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  // ── Stats ──────────────────────────────────────────────────────────
  const totalSpent  = bookings.reduce((s, b) => s + (b.fareBreakdown?.total || 0), 0);
  const agenciesSet = new Set(bookings.map(b => b.agencyId?._id).filter(Boolean));
  const avgFare     = bookings.length ? Math.round(totalSpent / bookings.length) : 0;

  // ── Group by month ─────────────────────────────────────────────────
  const grouped = bookings.reduce((acc, b) => {
    const dep = b.tripId?.scheduledStart ? new Date(b.tripId.scheduledStart) : new Date(b.createdAt);
    const key = dep.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    (acc[key] = acc[key] || []).push(b);
    return acc;
  }, {});

  const submitRating = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await agencyAPI.submitRating(rateModal.agencyId?._id, { bookingId: rateModal._id, score: rating, comment });
      toast('Rating submitted ✓');
      setBookings(bs => bs.map(b => b._id === rateModal._id ? { ...b, ratedAt: new Date() } : b));
      setRateModal(null);
    } catch (err) { toast(err.response?.data?.message || 'Failed to rate', 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="app-shell">
      <PassengerSidebar />
      <div className="main-content">
        <Topbar title="Travel history" />
        <div className="page-body">

          {/* ── Summary stats ── */}
          <div className="metric-grid">
            {[
              { icon: History,    label: 'Total trips',      value: bookings.length,                 color: 'var(--brand-600)' },
              { icon: DollarSign, label: 'Total spent',      value: `${totalSpent.toLocaleString()} FCFA`, color: '#059669'       },
              { icon: TrendingUp, label: 'Avg fare / trip',  value: avgFare ? `${avgFare.toLocaleString()} FCFA` : '—', color: '#0891b2' },
              { icon: MapPin,     label: 'Agencies used',    value: agenciesSet.size,                color: '#7c3aed'       },
            ].map(s => (
              <div key={s.label} className="metric-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <s.icon size={16} color={s.color} />
                  <span className="metric-label" style={{ color: s.color }}>{s.label}</span>
                </div>
                <div className="metric-value">{s.value}</div>
              </div>
            ))}
          </div>

          {/* ── Trip list grouped by month ── */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
          ) : bookings.length === 0 ? (
            <EmptyState icon={History} title="No completed trips yet" sub="Your travel history will appear here once you complete a trip" />
          ) : (
            Object.entries(grouped).map(([month, items]) => (
              <div key={month} className="card fade-up" style={{ marginBottom: 16 }}>
                {/* Month header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Calendar size={14} color="var(--brand-600)" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{month}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {items.length} trip{items.length !== 1 ? 's' : ''} · {items.reduce((s, b) => s + (b.fareBreakdown?.total || 0), 0).toLocaleString()} FCFA
                  </span>
                </div>

                {/* Trip rows */}
                {items.map(b => {
                  const trip   = b.tripId;
                  const route  = trip?.routeId;
                  const agency = b.agencyId;
                  const dep    = trip?.scheduledStart ? new Date(trip.scheduledStart) : null;
                  const canRate = b.status === 'completed' && !b.ratedAt && agency?._id;

                  return (
                    <div key={b._id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      {/* Agency chip */}
                      {agency && (
                        <div style={{
                          width: 38, height: 38, borderRadius: 8, flexShrink: 0,
                          background: agency.logoColor || '#1d4ed8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700, color: '#fff',
                        }}>
                          {agency.shortCode}
                        </div>
                      )}

                      {/* Detail */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                          {route?.origin || '—'} → {route?.destination || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                          {b.bookingRef}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                          {dep && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Clock size={10} />
                              {dep.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} {dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <MapPin size={10} /> Seat {b.seatLabel}
                          </span>
                        </div>
                      </div>

                      {/* Right side */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{b.fareBreakdown?.total?.toLocaleString()} FCFA</div>
                        <Pill status={b.status} />
                        {b.ratedAt && (
                          <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                            <Star size={10} fill="#f59e0b" /> Rated
                          </div>
                        )}
                        {canRate && (
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: 6, fontSize: 11 }}
                            onClick={() => { setRateModal(b); setRating(5); setComment(''); }}
                          >
                            <Star size={10} /> Rate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Rate modal */}
      {rateModal && (
        <Modal
          title={`Rate ${rateModal.agencyId?.name || 'agency'}`}
          onClose={() => setRateModal(null)}
          footer={<>
            <button className="btn btn-secondary btn-sm" onClick={() => setRateModal(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={submitRating}>
              {saving ? <Spinner size={14} /> : 'Submit rating'}
            </button>
          </>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 30, color: n <= rating ? '#f59e0b' : 'var(--border-2)' }}>
                  ★
                </button>
              ))}
            </div>
            <div className="field">
              <label className="field-label">Comment (optional)</label>
              <textarea className="field-input" rows={3} style={{ height: 'auto', padding: '8px 12px' }}
                value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your experience…" />
            </div>
          </div>
        </Modal>
      )}
      <ToastContainer />
    </div>
  );
}
