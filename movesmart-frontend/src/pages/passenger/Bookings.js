import React, { useState, useEffect } from 'react';
import { BookOpen, MapPin, Clock, Star } from 'lucide-react';
import { PassengerSidebar, Topbar, Pill, EmptyState, Spinner, Modal, useToast } from '../../components/shared';
import { bookingAPI, agencyAPI } from '../../api';
export default function PassengerBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [rateModal, setRateModal] = useState(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();

  useEffect(() => {
    bookingAPI.myBookings({ status: statusFilter || undefined })
      .then(r => setBookings(r.data.data))
      .catch(() => toast('Failed to load bookings', 'error'))
      .finally(() => setLoading(false));
  }, [statusFilter, toast]);

  const cancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    try {
      await bookingAPI.cancel(id);
      toast('Booking cancelled ✓');
      setBookings(b => b.map(bk => bk._id === id ? { ...bk, status: 'cancelled' } : bk));
    } catch (err) { toast(err.response?.data?.message || 'Cannot cancel', 'error'); }
  };

  const submitRating = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await agencyAPI.submitRating(rateModal.agencyId._id, { bookingId: rateModal._id, score: rating, comment });
      toast('Rating submitted ✓');
      setRateModal(null);
    } catch (err) { toast(err.response?.data?.message || 'Failed to rate', 'error'); }
    finally { setSaving(false); }
  };

  const upcoming = bookings.filter(b => b.status === 'upcoming');
  const rest     = bookings.filter(b => b.status !== 'upcoming');

  return (
    <div className="app-shell">
      <PassengerSidebar />
      <div className="main-content">
        <Topbar title="My bookings" />
        <div className="page-body">

          {/* Filter tabs */}
          <div className="card" style={{ padding: '10px 16px' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['', 'upcoming', 'completed', 'cancelled'].map(s => (
                <button key={s} className={`tab-btn ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                  {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
          ) : bookings.length === 0 ? (
            <EmptyState icon={BookOpen} title="No bookings yet" sub="Book your first trip to get started" />
          ) : (
            <div className="card fade-up">
              {/* Upcoming pinned at top */}
              {upcoming.length > 0 && !statusFilter && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand-600)', textTransform: 'uppercase', letterSpacing: '.6px', marginBottom: 10 }}>Upcoming trips</div>
                  {upcoming.map(b => <BookingRow key={b._id} booking={b} onCancel={cancel} onRate={() => { setRateModal(b); setRating(5); setComment(''); }} />)}
                  {rest.length > 0 && <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />}
                </>
              )}
              {(statusFilter ? bookings : rest).map(b => (
                <BookingRow key={b._id} booking={b} onCancel={cancel} onRate={() => { setRateModal(b); setRating(5); setComment(''); }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Rate modal */}
      {rateModal && (
        <Modal title={`Rate ${rateModal.agencyId?.name || 'agency'}`} onClose={() => setRateModal(null)}
          footer={<>
            <button className="btn btn-secondary btn-sm" onClick={() => setRateModal(null)}>Cancel</button>
            <button className="btn btn-primary btn-sm" disabled={saving} onClick={submitRating}>
              {saving ? <Spinner size={14} /> : 'Submit rating'}
            </button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(n)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 28, color: n <= rating ? '#f59e0b' : 'var(--border-2)' }}>★</button>
              ))}
            </div>
            <div className="field">
              <label className="field-label">Comment (optional)</label>
              <textarea className="field-input" rows={3} style={{ height: 'auto', padding: '8px 12px' }} value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your experience…" />
            </div>
          </div>
        </Modal>
      )}
      <ToastContainer />
    </div>
  );
}

function BookingRow({ booking, onCancel, onRate }) {
  const trip   = booking.tripId;
  const route  = trip?.routeId;
  const agency = booking.agencyId;
  const dep    = trip?.scheduledStart ? new Date(trip.scheduledStart) : null;
  const canCancel = booking.status === 'upcoming' && dep && dep - Date.now() > 2 * 3600 * 1000;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      {agency && (
        <div style={{ width: 36, height: 36, borderRadius: 8, background: agency.logoColor || '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
          {agency.shortCode}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>{booking.bookingRef}</span>
          <Pill status={booking.status} />
        </div>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
          {route?.origin || '—'} → {route?.destination || '—'}
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-3)' }}>
          {dep && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} />{dep.toLocaleDateString()} {dep.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10} />Seat {booking.seatLabel}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{booking.fareBreakdown?.total?.toLocaleString()} FCFA</div>
        <div style={{ display: 'flex', gap: 5, marginTop: 5, justifyContent: 'flex-end' }}>
          {canCancel && <button className="btn btn-danger btn-sm" style={{ fontSize: 11 }} onClick={() => onCancel(booking._id)}>Cancel</button>}
          {booking.status === 'completed' && !booking.ratedAt && (
            <button className="btn btn-secondary btn-sm" style={{ fontSize: 11 }} onClick={onRate}>
              <Star size={10} /> Rate
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
