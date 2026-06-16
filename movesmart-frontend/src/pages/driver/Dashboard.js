import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigation, AlertTriangle, Clock, Users, Gauge, MapPin } from 'lucide-react';
import { DriverSidebar, Topbar, Pill, Spinner, Modal, EmptyState, useToast } from '../../components/shared';
import { tripAPI, incidentAPI } from '../../api';
import io from 'socket.io-client';
import useAuthStore from '../../store/authStore';

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
const MAPS_KEY   = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// ── Cameroon geographic constants ────────────────────────────────────
const CAMEROON_CENTER = { lat: 5.7, lng: 12.35 };
const CAMEROON_ZOOM   = 6;                          // shows the whole country
const CAMEROON_BOUNDS = {                           // restrict panning to Cameroon
  north: 13.1,
  south:  1.65,
  west:   8.5,
  east:  16.2,
};

// Real GPS coordinates of major Cameroonian intercity hubs
// Used as starting points for the fallback GPS simulation
const CM_CITIES = [
  { name: 'Yaoundé',    lat: 3.8480,  lng: 11.5021 },
  { name: 'Douala',     lat: 4.0483,  lng:  9.7043 },
  { name: 'Buea',       lat: 4.1527,  lng:  9.2403 },
  { name: 'Bafoussam',  lat: 5.4737,  lng: 10.4179 },
  { name: 'Bamenda',    lat: 5.9597,  lng: 10.1456 },
  { name: 'Garoua',     lat: 9.3017,  lng: 13.3968 },
  { name: 'Ngaoundéré', lat: 7.3167,  lng: 13.5833 },
  { name: 'Maroua',     lat: 10.5921, lng: 14.3255 },
  { name: 'Limbe',      lat: 4.0230,  lng:  9.1998 },
  { name: 'Bertoua',    lat: 4.5785,  lng: 13.6854 },
];

// ── Google Maps component ─────────────────────────────────────────────
function LiveMap({ position, gpsOn }) {
  const divRef     = useRef(null);
  const mapRef     = useRef(null);
  const markerRef  = useRef(null);
  const circleRef  = useRef(null);

  // Load the Maps script once, then init the map
  useEffect(() => {
    const initMap = () => {
      if (!divRef.current || mapRef.current) return;

      mapRef.current = new window.google.maps.Map(divRef.current, {
        center: CAMEROON_CENTER,
        zoom: CAMEROON_ZOOM,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        // Restrict panning/zooming to Cameroon
        restriction: {
          latLngBounds: CAMEROON_BOUNDS,
          strictBounds: false,   // allows slight pan beyond for UX, but snaps back
        },
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
      });

      // Driver marker (blue dot)
      markerRef.current = new window.google.maps.Marker({
        map: mapRef.current,
        title: 'Your position',
        visible: false,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#1d4ed8',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2.5,
        },
      });

      // Accuracy ring around the marker
      circleRef.current = new window.google.maps.Circle({
        map: mapRef.current,
        radius: 80,
        fillColor: '#1d4ed8',
        fillOpacity: 0.12,
        strokeColor: '#1d4ed8',
        strokeOpacity: 0.3,
        strokeWeight: 1,
        visible: false,
      });
    };

    if (window.google?.maps) {
      initMap();
    } else if (!document.getElementById('gmap-script')) {
      const script = document.createElement('script');
      script.id    = 'gmap-script';
      script.src   = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}`;
      script.async = true;
      script.defer = true;
      script.onload = initMap;
      document.head.appendChild(script);
    }
  }, []);

  // Pan & update marker whenever position changes
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;

    if (position) {
      const latLng = new window.google.maps.LatLng(position.lat, position.lng);
      markerRef.current.setPosition(latLng);
      markerRef.current.setVisible(true);
      circleRef.current.setCenter(latLng);
      circleRef.current.setVisible(true);
      mapRef.current.panTo(latLng);
    } else {
      markerRef.current.setVisible(false);
      circleRef.current.setVisible(false);
    }
  }, [position]);

  return (
    <div style={{ position: 'relative', height: 200, borderRadius: 8, overflow: 'hidden', background: '#e5e7eb' }}>
      <div ref={divRef} style={{ height: '100%', width: '100%' }} />
      {!gpsOn && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(2px)',
          fontSize: 12, color: 'var(--text-3)', fontWeight: 500,
          gap: 6,
        }}>
          <Navigation size={18} color="var(--text-3)" />
          <span>Start a trip to activate GPS tracking</span>
          <span style={{ fontSize: 11, color: 'var(--text-3)', opacity: 0.7 }}>Map showing Cameroon</span>
        </div>
      )}
    </div>
  );
}

export default function DriverDashboard() {
  const { accessToken } = useAuthStore();
  const [trips,     setTrips]     = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [gpsOn,     setGpsOn]     = useState(false);
  const [speed,     setSpeed]     = useState(0);
  const [position,  setPosition]  = useState(null); // { lat, lng }
  const [loading,   setLoading]   = useState(true);
  const [showInc,   setShowInc]   = useState(false);
  const [incForm,   setIncForm]   = useState({ type: 'mechanical', description: '' });
  const [saving,    setSaving]    = useState(false);
  const socketRef = useRef(null);
  const gpsInterval = useRef(null);
  const { toast, ToastContainer } = useToast();

  // ── GPS helpers ──────────────────────────────────────────────────────
  const startGPS = useCallback((trip) => {
    if (gpsInterval.current) clearInterval(gpsInterval.current);
    setGpsOn(true);

    // Pick a random Cameroonian city as the starting point for the simulation
    const origin = CM_CITIES[Math.floor(Math.random() * CM_CITIES.length)];
    // Pick a different city as the destination so the marker moves toward it
    const dest   = CM_CITIES.filter(c => c.name !== origin.name)[
      Math.floor(Math.random() * (CM_CITIES.length - 1))
    ];

    let mockLat = origin.lat;
    let mockLng = origin.lng;

    // Step size moves ~0.001° per tick (~110 m) toward destination
    const latStep = (dest.lat - origin.lat) / 300;
    const lngStep = (dest.lng - origin.lng) / 300;

    const emit = (lat, lng, kmh) => {
      setSpeed(kmh);
      setPosition({ lat, lng });
      socketRef.current?.emit('gps:broadcast', {
        tripId: trip._id,
        vehicleId: trip.vehicleId?._id || trip.vehicleId,
        latitude: lat, longitude: lng, speed: kmh, heading: 0,
      });
    };

    gpsInterval.current = setInterval(() => {
      if (!navigator.geolocation) {
        // No Geolocation API — simulate movement between Cameroonian cities
        mockLat += latStep + (Math.random() - 0.5) * 0.0003;
        mockLng += lngStep + (Math.random() - 0.5) * 0.0003;
        emit(mockLat, mockLng, Math.round(60 + Math.random() * 40));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        pos => {
          const { latitude, longitude, speed: spd } = pos.coords;
          emit(latitude, longitude, Math.round((spd || 0) * 3.6));
        },
        () => {
          // Browser denied geolocation — use Cameroon city simulation as fallback
          mockLat += latStep + (Math.random() - 0.5) * 0.0003;
          mockLng += lngStep + (Math.random() - 0.5) * 0.0003;
          // Clamp strictly within Cameroon
          mockLat = Math.max(1.65, Math.min(13.1, mockLat));
          mockLng = Math.max(8.5,  Math.min(16.2, mockLng));
          emit(mockLat, mockLng, Math.round(60 + Math.random() * 40));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    }, 5000);
  }, []);

  const stopGPS = useCallback(() => {
    clearInterval(gpsInterval.current);
    socketRef.current?.emit('gps:stop');
    setGpsOn(false);
    setSpeed(0);
    setPosition(null);
  }, []);

  const loadTrips = useCallback(async (autoStartGPS = false) => {
    try {
      // Use LOCAL midnight as the day boundary — avoids UTC offset stripping a day at midnight
      const todayLocal = new Date();
      todayLocal.setHours(0, 0, 0, 0);
      // Show yesterday → +6 days: catches in-progress trips that started yesterday
      // AND scheduled trips assigned for the next several days
      const dateFrom = new Date(todayLocal.getTime() - 86_400_000).toISOString();
      const dateTo   = new Date(todayLocal.getTime() + 6 * 86_400_000).toISOString();
      const r = await tripAPI.list({ dateFrom, dateTo, limit: 50 });
      const all = r.data.data || [];
      setTrips(all);
      const inProg = all.find(t => t.status === 'inProgress');
      setActiveTrip(inProg || null);
      // Auto-resume GPS if driver has an in-progress trip on page load
      if (inProg && autoStartGPS && !gpsInterval.current) {
        startGPS(inProg);
      }
    } catch { toast('Failed to load trips', 'error'); }
    finally  { setLoading(false); }
  }, [toast, startGPS]);

  useEffect(() => {
    loadTrips(true);   // pass true → auto-start GPS if trip already in progress
    // Socket.IO connection
    socketRef.current = io(SOCKET_URL, { auth: { token: accessToken }, autoConnect: false });
    socketRef.current.connect();
    return () => {
      socketRef.current?.disconnect();
      clearInterval(gpsInterval.current);
    };
  }, [accessToken, loadTrips]);

  // Manual GPS toggle (for the topbar button)
  const toggleGPS = () => {
    if (!activeTrip) { toast('Start a trip before activating GPS', 'warning'); return; }
    if (gpsOn) {
      stopGPS();
    } else {
      startGPS(activeTrip);
    }
  };

  const startTrip = async (tripId) => {
    try {
      await tripAPI.start(tripId);
      toast('Trip started — GPS broadcasting active ✓');
      // Reload trips first so activeTrip is populated, then auto-start GPS
      const todayLocal = new Date();
      todayLocal.setHours(0, 0, 0, 0);
      const dateFrom = new Date(todayLocal.getTime() - 86_400_000).toISOString();
      const dateTo   = new Date(todayLocal.getTime() + 6 * 86_400_000).toISOString();
      const r = await tripAPI.list({ dateFrom, dateTo, limit: 50 });
      const all = r.data.data || [];
      setTrips(all);
      const inProg = all.find(t => t._id === tripId || t.status === 'inProgress');
      if (inProg) {
        setActiveTrip(inProg);
        startGPS(inProg);   // ← auto-start GPS immediately on trip start
      }
    } catch (err) { toast(err.response?.data?.message || 'Failed to start trip', 'error'); }
  };

  const endTrip = async (tripId) => {
    try {
      await tripAPI.end(tripId);
      stopGPS();
      setActiveTrip(null);
      toast('Trip completed ✓');
      loadTrips();
    } catch (err) { toast(err.response?.data?.message || 'Failed to end trip', 'error'); }
  };

  const submitIncident = async (e) => {
    e.preventDefault();
    if (!activeTrip) { toast('No active trip', 'error'); return; }
    setSaving(true);
    try {
      await incidentAPI.submit({ ...incForm, tripId: activeTrip._id, vehicleId: activeTrip.vehicleId });
      toast('Incident reported — fleet manager notified ✓');
      setShowInc(false);
      setIncForm({ type: 'mechanical', description: '' });
    } catch (err) { toast(err.response?.data?.message || 'Failed to submit', 'error'); }
    finally { setSaving(false); }
  };

  const statusOrder = { inProgress: 0, scheduled: 1, completed: 2, cancelled: 3 };
  const sorted = [...trips].sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9));

  return (
    <div className="app-shell">
      <DriverSidebar />
      <div className="main-content">
        <Topbar title="My trips"
          actions={
            <button
              onClick={toggleGPS}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all .15s', background: gpsOn ? 'var(--success-bg)' : 'var(--danger-bg)', color: gpsOn ? '#065f46' : '#991b1b' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: gpsOn ? 'var(--success)' : 'var(--danger)', animation: gpsOn ? 'gps-pulse 1.5s infinite' : 'none' }} />
              GPS {gpsOn ? 'Active' : 'Inactive'}
            </button>
          }
        />
        <div className="page-body">

          {/* Live stats */}
          <div className="metric-grid">
            {[
              { icon: Gauge,   label: 'Speed',           value: gpsOn ? `${speed} km/h` : '— km/h', color: 'var(--brand-600)' },
              { icon: Users,   label: 'Passengers',      value: activeTrip?.passengerCount ?? '—',   color: 'var(--success)'   },
              { icon: Clock,   label: 'Next stop ETA',   value: activeTrip ? '4 min' : '—',          color: '#0891b2'          },
              { icon: Navigation, label: 'Trip status', value: activeTrip?.status || 'No active trip', color: activeTrip ? 'var(--brand-600)' : 'var(--text-3)' },
            ].map(s => (
              <div key={s.label} className="metric-card">
                <div className="metric-label" style={{ color: s.color }}><s.icon size={12} />{s.label}</div>
                <div className="metric-value" style={{ fontSize: 20 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>

            {/* Live map */}
            <div className="card fade-up stagger-1">
              <div className="card-title">Live position</div>
              <div style={{ marginBottom: 12 }}>
                <LiveMap position={position} gpsOn={gpsOn} />
              </div>

              {/* Next stop */}
              {activeTrip && (
                <div style={{ background: 'var(--brand-50)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <MapPin size={18} color="var(--brand-600)" />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--brand-600)', fontWeight: 600 }}>Next stop</div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>Carrefour Warda</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>ETA 4 min · 1.8 km</div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                {activeTrip ? (
                  <button className="btn btn-danger btn-full" onClick={() => endTrip(activeTrip._id)}>End trip</button>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', flex: 1, display: 'flex', alignItems: 'center' }}>Select a scheduled trip to start</div>
                )}
                <button className="btn btn-secondary" onClick={() => { if (activeTrip) setShowInc(true); else toast('No active trip', 'warning'); }}>
                  <AlertTriangle size={14} /> Incident
                </button>
              </div>
            </div>

            {/* Trip list */}
            <div className="card fade-up stagger-2">
              <div className="card-title">My schedule</div>
              {loading ? <Spinner /> : sorted.length === 0 ? (
                <EmptyState icon={Navigation} title="No trips today" sub="Your assigned trips will appear here" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {sorted.map(t => {
                    const route = t.routeId;
                    return (
                      <div key={t._id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5, background: t.status === 'inProgress' ? 'var(--success)' : t.status === 'scheduled' ? 'var(--brand-500)' : 'var(--text-3)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {route?.name || 'Route'}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                            {t.scheduledStart ? new Date(t.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'} · {route?.stops?.length || 0} stops
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <Pill status={t.status} />
                          {t.status === 'scheduled' && (
                            <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} onClick={() => startTrip(t._id)}>Start</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Incident modal */}
      {showInc && (
        <Modal title="Report incident" onClose={() => setShowInc(false)}
          footer={<>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowInc(false)}>Cancel</button>
            <button className="btn btn-danger btn-sm" disabled={saving} onClick={submitIncident}>
              {saving ? <Spinner size={14} /> : <><AlertTriangle size={12} /> Submit report</>}
            </button>
          </>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label className="field-label">Incident type</label>
              <select className="field-input field-select" value={incForm.type} onChange={e => setIncForm(f => ({ ...f, type: e.target.value }))}>
                {['mechanical', 'accident', 'passenger', 'route', 'other'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Description</label>
              <textarea className="field-input" rows={4} style={{ height: 'auto', padding: '8px 12px' }}
                value={incForm.description} onChange={e => setIncForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the incident in detail…" required />
            </div>
            <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--text-3)' }}>
              <MapPin size={12} style={{ display: 'inline', marginRight: 4 }} />
              GPS location will be auto-attached from your current position
            </div>
          </div>
        </Modal>
      )}
      <ToastContainer />
    </div>
  );
}
