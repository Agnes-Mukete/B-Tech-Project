import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, CreditCard, CheckCircle, Check } from 'lucide-react';
import { PassengerSidebar, Spinner, useToast } from '../../components/shared';
import { agencyAPI, tripAPI, bookingAPI } from '../../api';

// ── Step progress bar ─────────────────────────────────────────────
function StepBar({ current }) {
  const steps = ['Agency', 'Search', 'Seat', 'Payment', 'Confirm'];
  return (
    <div className="step-bar" style={{ borderRadius: 12 }}>
      {steps.map((s, i) => {
        const state = i + 1 < current ? 'step-done' : i + 1 === current ? 'step-active' : 'step-future';
        return (
          <React.Fragment key={s}>
            {i > 0 && <div className="step-line" />}
            <div className={`step ${state}`}>
              <div className="step-circle">
                {i + 1 < current ? <Check size={11} /> : i + 1}
              </div>
              <span className="step-label">{s}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Generate seat layout ──────────────────────────────────────────
function SeatMap({ seats, selected, onSelect }) {
  const rows = 'ABCDEFGHIJ'.split('');
  const cols = [1, 2, null, 3, 4]; // null = aisle gap

  const seatMap = {};
  (seats || []).forEach(s => { seatMap[s.label] = s; });

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'center', marginBottom: 10 }}>
        ← Front of bus →
      </div>
      <div className="seat-map">
        {rows.map(row => (
          <div key={row} className="seat-row">
            <span style={{ fontSize: 10, color: 'var(--text-3)', width: 14, textAlign: 'right' }}>{row}</span>
            {cols.map((col, ci) => {
              if (col === null) return <div key={ci} className="seat-aisle" />;
              const label = `${row}${col}`;
              const seatData = seatMap[label];
              if (!seatData) return <div key={label} style={{ width: 36, height: 30 }} />;
              const isTaken    = seatData.status === 'booked';
              const isHeld     = seatData.status === 'held';
              const isSelected = selected === label;
              return (
                <div key={label}
                  className={`seat ${isTaken || isHeld ? 'seat-taken' : isSelected ? 'seat-selected' : ''}`}
                  title={isTaken ? 'Taken' : isHeld ? 'Held' : label}
                  onClick={() => !isTaken && !isHeld && onSelect(isSelected ? null : label)}>
                  {label}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-3)' }}>
        {[['var(--surface-2)', 'var(--border-2)', 'Available'], ['#fee2e2', '#fca5a5', 'Taken'], ['var(--brand-600)', 'var(--brand-600)', 'Selected']].map(([bg, border, lbl]) => (
          <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: bg, border: `1.5px solid ${border}` }} />
            {lbl}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main booking flow ─────────────────────────────────────────────
export default function BookingFlow() {
  const { agencyId } = useParams();
  const nav = useNavigate();
  const { toast, ToastContainer } = useToast();

  const [step,      setStep]     = useState(2); // 1=agency (already done), 2=search
  const [agency,    setAgency]   = useState(null);
  const todayLocal = new Date(); todayLocal.setHours(0,0,0,0);
  const [search,    setSearch]   = useState({ from: '', to: '', date: todayLocal.toLocaleDateString('en-CA') }); // en-CA = YYYY-MM-DD in local time
  const [trips,     setTrips]    = useState([]);
  const [selTrip,   setSelTrip]  = useState(null);
  const [seats,     setSeats]    = useState([]);
  const [selSeat,   setSelSeat]  = useState(null);
  const [card,      setCard]     = useState({ name: '', number: '', expiry: '', cvv: '' });
  const [booking,   setBooking]  = useState(null);
  const [loading,   setLoading]  = useState(false);
  const [holdTimer, setHoldTimer] = useState(600); // 10 min

  // Load agency from session or API, then auto-load today's trips
  useEffect(() => {
    const loadAgency = async () => {
      let ag = null;
      try {
        const stored = sessionStorage.getItem('selectedAgency');
        if (stored) { ag = JSON.parse(stored); setAgency(ag); }
      } catch {}
      if (!ag) {
        try { const r = await agencyAPI.getOne(agencyId); ag = r.data.data; setAgency(ag); }
        catch { nav('/passenger/agencies'); return; }
      }
      // Auto-load today's scheduled trips so the passenger sees options immediately
      try {
        setLoading(true);
        const r = await agencyAPI.getTrips(agencyId, { date: new Date().toLocaleDateString('en-CA') });
        setTrips(Array.isArray(r.data.data) ? r.data.data : []);
      } catch { /* silent — passenger can still use the search form */ }
      finally { setLoading(false); }
    };
    loadAgency();
  }, [agencyId, nav]);

  // Hold timer countdown
  useEffect(() => {
    if (step !== 3 || !selSeat) return;
    const t = setInterval(() => setHoldTimer(h => {
      if (h <= 1) { clearInterval(t); toast('Seat hold expired — please reselect', 'error'); setSelSeat(null); setStep(2); return 600; }
      return h - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [step, selSeat, toast]);

  const searchTrips = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await agencyAPI.getTrips(agencyId, { from: search.from, to: search.to, date: search.date });
      setTrips(r.data.data);
    } catch { toast('Search failed', 'error'); }
    finally  { setLoading(false); }
  };

  const selectTrip = async (trip) => {
    setSelTrip(trip);
    setLoading(true);
    try {
      const r = await tripAPI.getSeats(trip._id);
      setSeats(r.data.data.seats);
      setStep(3);
    } catch { toast('Failed to load seats', 'error'); }
    finally  { setLoading(false); }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!selSeat) { toast('Please select a seat first', 'error'); return; }
    setLoading(true);
    try {
      const r = await bookingAPI.create({
        tripId: selTrip._id,
        seatLabel: selSeat,
        cardLast4: card.number.replace(/\s/g, '').slice(-4),
        cardType: card.number.startsWith('4') ? 'Visa' : 'Mastercard',
      });
      setBooking(r.data.data);
      setStep(5);
    } catch (err) {
      toast(err.response?.data?.message || 'Payment failed', 'error');
    } finally { setLoading(false); }
  };

  const fmtTime = (h) => {
    const m = Math.floor(h / 60), s = h % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  if (!agency) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spinner size={36} /></div>;

  return (
    <div className="app-shell">
      <PassengerSidebar />
      <div className="main-content">
        {/* Step bar */}
        <StepBar current={step} />

        <div style={{ padding: 24, maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Agency hero strip */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: agency.logoColor || '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {agency.shortCode}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{agency.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{agency.city} · {agency.tier}</div>
            </div>
            <button onClick={() => nav('/passenger/agencies')} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-2)' }}>
              <ArrowLeft size={12} /> Change
            </button>
          </div>

          {/* ── STEP 2: Search ── */}
          {step === 2 && (
            <div className="card fade-up">
              <div className="card-title">Search trips</div>
              <form onSubmit={searchTrips} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {[['from', 'From', 'text', 'Any origin (optional)'], ['to', 'To', 'text', 'Any destination (optional)'], ['date', 'Date', 'date', '']].map(([k, lbl, t, ph]) => (
                    <div key={k} className="field">
                      <label className="field-label">{lbl}</label>
                      <input className="field-input" type={t} placeholder={ph}
                        required={k === 'date'}
                        value={search[k]}
                        onChange={e => setSearch(s => ({ ...s, [k]: e.target.value }))} />
                    </div>
                  ))}
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? <Spinner size={14} /> : 'Search trips →'}
                </button>
              </form>

              {/* Trip results */}
              {trips.length > 0 && (
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500 }}>{trips.length} trip{trips.length !== 1 ? 's' : ''} found</div>
                  {trips.map(t => {
                    const route = t.routeId;
                    const avail = t.availableSeats ?? 0;
                    const seatColor = avail === 0 ? 'var(--danger)' : avail <= 8 ? 'var(--warning)' : 'var(--success)';
                    const seatBg   = avail === 0 ? 'var(--danger-bg)' : avail <= 8 ? 'var(--warning-bg)' : 'var(--success-bg)';
                    return (
                      <div key={t._id} style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', cursor: avail > 0 ? 'pointer' : 'not-allowed', opacity: avail === 0 ? 0.6 : 1, transition: 'border-color .15s' }}
                        onMouseEnter={e => { if (avail > 0) e.currentTarget.style.borderColor = 'var(--brand-400)'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                        onClick={() => avail > 0 && selectTrip(t)}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>
                              {route?.origin || '—'} → {route?.destination || '—'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--text-3)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={11} />
                                {new Date(t.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {' → '}
                                {new Date(t.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <MapPin size={11} /> {route?.stops?.length || 0} stops
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>
                              {(t.fare || 0).toLocaleString()} FCFA
                            </div>
                            <span style={{ fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 99, background: seatBg, color: seatColor }}>
                              {avail === 0 ? 'Fully booked' : `${avail} seats`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!loading && trips.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'var(--text-3)' }}>
                  No scheduled trips found for this date. Try a different date or leave origin/destination blank to see all trips.
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Seat selection ── */}
          {step === 3 && selTrip && (
            <div className="card fade-up">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="card-title" style={{ margin: 0 }}>Select your seat</div>
                <span style={{ fontSize: 12, color: selSeat ? 'var(--warning)' : 'var(--text-3)', fontWeight: 600 }}>
                  {selSeat ? `⏱ Hold expires in ${fmtTime(holdTimer)}` : 'No seat selected'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
                {selTrip.routeId?.name} · {new Date(selTrip.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {agency.name}
              </div>

              <SeatMap seats={seats} selected={selSeat} onSelect={setSelSeat} />

              {/* Fare summary */}
              <div style={{ marginTop: 20, background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px' }}>
                <div className="card-title" style={{ margin: '0 0 10px' }}>Fare summary</div>
                {[['Base fare', `${(selTrip.fare || 0).toLocaleString()} FCFA`], ['Booking fee', '100 FCFA'], ['Total', `${(selTrip.fare + 100).toLocaleString()} FCFA`]].map(([k, v], i) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderTop: i === 2 ? '1px solid var(--border)' : 'none', marginTop: i === 2 ? 6 : 0, fontSize: 13, fontWeight: i === 2 ? 700 : 400, color: i === 2 ? 'var(--text-1)' : 'var(--text-2)' }}>
                    <span>{k}</span><span>{v}</span>
                  </div>
                ))}
              </div>

              <button className="btn btn-primary btn-full" style={{ marginTop: 14 }} disabled={!selSeat} onClick={() => setStep(4)}>
                Proceed to payment →
              </button>
            </div>
          )}

          {/* ── STEP 4: Payment ── */}
          {step === 4 && (
            <div className="card fade-up">
              <div className="card-title">Payment</div>
              <div style={{ marginBottom: 14, fontSize: 12, color: 'var(--warning)', fontWeight: 600 }}>
                ⏱ Seat held for {fmtTime(holdTimer)}
              </div>

              <form onSubmit={handlePayment} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="field">
                  <label className="field-label">Cardholder name</label>
                  <input className="field-input" placeholder="Full name on card" required value={card.name} onChange={e => setCard(c => ({ ...c, name: e.target.value }))} />
                </div>
                <div className="field">
                  <label className="field-label">Card number</label>
                  <div className="input-wrap">
                    <CreditCard className="input-icon" size={15} />
                    <input className="field-input" placeholder="•••• •••• •••• ••••" maxLength={19} required
                      value={card.number}
                      onChange={e => {
                        const v = e.target.value.replace(/\D/g, '').slice(0, 16);
                        setCard(c => ({ ...c, number: v.replace(/(.{4})/g, '$1 ').trim() }));
                      }} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="field">
                    <label className="field-label">Expiry (MM/YY)</label>
                    <input className="field-input" placeholder="MM/YY" maxLength={5} required value={card.expiry}
                      onChange={e => {
                        let v = e.target.value.replace(/\D/g, '').slice(0, 4);
                        if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
                        setCard(c => ({ ...c, expiry: v }));
                      }} />
                  </div>
                  <div className="field">
                    <label className="field-label">CVV</label>
                    <input className="field-input" type="password" placeholder="•••" maxLength={3} required value={card.cvv} onChange={e => setCard(c => ({ ...c, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) }))} />
                  </div>
                </div>

                {/* Summary */}
                <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '12px 14px', fontSize: 13 }}>
                  {[['Agency', agency.name], ['Route', `${selTrip?.routeId?.origin || '—'} → ${selTrip?.routeId?.destination || '—'}`], ['Seat', selSeat], ['Total charge', `${((selTrip?.fare || 0) + 100).toLocaleString()} FCFA`]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'var(--text-2)' }}>
                      <span>{k}</span><span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(3)}>← Back</button>
                  <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? <Spinner size={14} /> : <><CreditCard size={14} /> Pay securely</>}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── STEP 5: Confirmation ── */}
          {step === 5 && booking && (
            <div className="card fade-up" style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle size={32} color="var(--success)" />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Booking confirmed!</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 22, fontWeight: 700, color: 'var(--brand-600)', marginBottom: 8 }}>{booking.bookingRef}</div>
              <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>A confirmation has been sent to your email.</div>

              <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '14px', textAlign: 'left', marginBottom: 20 }}>
                {[['Agency', agency.name], ['Route', `${selTrip?.routeId?.origin || '—'} → ${selTrip?.routeId?.destination || '—'}`], ['Departure', new Date(selTrip?.scheduledStart).toLocaleString()], ['Seat', selSeat], ['Amount paid', `${((selTrip?.fare || 0) + 100).toLocaleString()} FCFA`]].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span style={{ color: 'var(--text-3)' }}>{k}</span>
                    <span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-full" onClick={() => nav('/passenger/agencies')}>Book another trip</button>
                <button className="btn btn-primary btn-full" onClick={() => nav('/passenger/bookings')}>View my bookings</button>
              </div>
            </div>
          )}

        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
