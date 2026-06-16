import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Star, Snowflake, Wifi, Usb, Crown, ShieldCheck } from 'lucide-react';
import { PassengerSidebar, Topbar, SearchBar, EmptyState, Spinner, useToast } from '../../components/shared';
import { agencyAPI } from '../../api';
import { useNavigate } from 'react-router-dom';

const AMENITY_ICONS = { ac: Snowflake, wifi: Wifi, usb: Usb };

function AgencyCard({ agency, onSelect }) {
  const { name, shortCode, logoColor, tier, rating, ratingCount, coverageCities = [], amenities = [], monthlyTrips } = agency;
  return (
    <div className="agency-card fade-up" onClick={() => onSelect(agency)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div className="agency-logo" style={{ background: logoColor || '#1d4ed8' }}>
          {shortCode}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{name}</span>
            {tier === 'premium' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, background: 'var(--warning-bg)', color: '#92400e', padding: '2px 7px', borderRadius: 99 }}>
                <Crown size={9} /> Premium
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, background: 'var(--success-bg)', color: '#065f46', padding: '2px 7px', borderRadius: 99 }}>
              <ShieldCheck size={10} /> Verified
            </span>
            {amenities.map(a => {
              const Icon = AMENITY_ICONS[a];
              return Icon ? (
                <span key={a} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, background: 'var(--brand-50)', color: 'var(--brand-700)', padding: '2px 7px', borderRadius: 99 }}>
                  <Icon size={9} /> {a.toUpperCase()}
                </span>
              ) : null;
            })}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 700, color: '#f59e0b', flexShrink: 0 }}>
          <Star size={12} fill="#f59e0b" />
          {rating > 0 ? rating.toFixed(1) : '—'}
        </div>
      </div>

      {/* Coverage cities */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {coverageCities.slice(0, 5).map(c => (
          <span key={c} style={{ fontSize: 10, background: 'var(--surface-2)', color: 'var(--text-2)', padding: '2px 7px', borderRadius: 4, fontWeight: 500 }}>{c}</span>
        ))}
        {coverageCities.length > 5 && (
          <span style={{ fontSize: 10, color: 'var(--text-3)', padding: '2px 4px' }}>+{coverageCities.length - 5}</span>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{monthlyTrips || 0} trips / month · {ratingCount || 0} reviews</div>
        <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); onSelect(agency); }}>
          Select agency
        </button>
      </div>
    </div>
  );
}

export default function PassengerAgencies() {
  const nav = useNavigate();
  const [agencies, setAgencies] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [allCities,  setAllCities]  = useState([]);
  const { toast, ToastContainer } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await agencyAPI.listPublic({ search, city: cityFilter || undefined, limit: 50 });
      const list = r.data.data;
      setAgencies(list);
      // Build city list from all loaded agencies
      const cities = [...new Set(list.flatMap(a => a.coverageCities || []))].sort();
      setAllCities(cities);
    } catch { toast('Failed to load agencies', 'error'); }
    finally  { setLoading(false); }
  }, [search, cityFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const handleSelect = (agency) => {
    // Store selected agency in sessionStorage for booking flow
    sessionStorage.setItem('selectedAgency', JSON.stringify(agency));
    nav(`/passenger/book/${agency._id}`);
  };

  return (
    <div className="app-shell">
      <PassengerSidebar />
      <div className="main-content">
        <Topbar title="Choose your agency" />
        <div className="page-body">

          {/* Step bar */}
          <div className="step-bar" style={{ borderRadius: 12 }}>
            {['Agency', 'Search', 'Seat', 'Payment', 'Confirm'].map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 && <div className="step-line" />}
                <div className={`step ${i === 0 ? 'step-active' : 'step-future'}`}>
                  <div className="step-circle">{i + 1}</div>
                  <span className="step-label">{s}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Filters */}
          <div className="card fade-up">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <SearchBar value={search} onChange={setSearch} placeholder="Search agencies or destinations…" />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setCityFilter('')}
                  style={{ fontSize: 11, padding: '4px 12px', borderRadius: 99, border: '1px solid var(--border-2)', background: cityFilter === '' ? 'var(--brand-600)' : 'var(--surface)', color: cityFilter === '' ? '#fff' : 'var(--text-2)', cursor: 'pointer', fontWeight: 500 }}>
                  All destinations
                </button>
                {allCities.slice(0, 8).map(c => (
                  <button key={c}
                    onClick={() => setCityFilter(c === cityFilter ? '' : c)}
                    style={{ fontSize: 11, padding: '4px 12px', borderRadius: 99, border: '1px solid var(--border-2)', background: cityFilter === c ? 'var(--brand-600)' : 'var(--surface)', color: cityFilter === c ? '#fff' : 'var(--text-2)', cursor: 'pointer', fontWeight: 500 }}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Agency grid */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner size={32} /></div>
          ) : agencies.length === 0 ? (
            <EmptyState icon={Building2} title="No agencies found" sub="Try a different search or destination filter" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {agencies.map((a, i) => (
                <div key={a._id} style={{ animationDelay: `${i * 0.05}s` }}>
                  <AgencyCard agency={a} onSelect={handleSelect} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
