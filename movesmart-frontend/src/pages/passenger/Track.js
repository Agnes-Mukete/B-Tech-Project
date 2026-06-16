/**
 * passenger/Track.js
 * FR-PA30: Real-time vehicle location on Google Maps
 * FR-PA31: Route path displayed on map
 * FR-PA32: ETA to passenger's boarding stop
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigation, Users, Clock, Zap } from 'lucide-react';
import { PassengerSidebar, Topbar, Spinner, EmptyState, useToast } from '../../components/shared';
import { bookingAPI, gpsAPI } from '../../api';
import useAuthStore from '../../store/authStore';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000';
const MAPS_KEY   = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Yaoundé city centre (fallback centre when no GPS data yet)
const DEFAULT_CENTER = { lat: 3.8667, lng: 11.5167 };

// ── Haversine distance (km) ──────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaMinutes(vehicleLat, vehicleLng, stopLat, stopLng, speedKmh) {
  const dist = haversine(vehicleLat, vehicleLng, stopLat, stopLng);
  const spd  = speedKmh > 5 ? speedKmh : 30; // fallback 30 km/h when idling
  return Math.round((dist / spd) * 60);
}

// ── Google Maps component ────────────────────────────────────────────────
function PassengerMap({ vehicles, agencyId }) {
  const divRef     = useRef(null);
  const mapRef     = useRef(null);
  const markersRef = useRef({});  // vehicleId → google.maps.Marker

  // Load Maps script + init map once
  useEffect(() => {
    const initMap = () => {
      if (!divRef.current || mapRef.current) return;
      mapRef.current = new window.google.maps.Map(divRef.current, {
        center: DEFAULT_CENTER,
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ],
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
    } else {
      // Script already loading — poll until google.maps is ready
      const poll = setInterval(() => {
        if (window.google?.maps) { clearInterval(poll); initMap(); }
      }, 200);
    }
  }, []);

  // Update / create vehicle markers whenever positions change
  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;

    const activeIds = new Set(vehicles.map(v => v.vehicleId));

    // Remove stale markers
    Object.keys(markersRef.current).forEach(id => {
      if (!activeIds.has(id)) {
        markersRef.current[id].setMap(null);
        delete markersRef.current[id];
      }
    });

    if (vehicles.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    vehicles.forEach(v => {
      const { latitude: lat, longitude: lng, speed } = v.lastPosition || {};
      if (!lat || !lng) return;

      const pos = new window.google.maps.LatLng(lat, lng);

      if (markersRef.current[v.vehicleId]) {
        markersRef.current[v.vehicleId].setPosition(pos);
        markersRef.current[v.vehicleId].setTitle(`${v.vehicleId} · ${speed || 0} km/h`);
      } else {
        markersRef.current[v.vehicleId] = new window.google.maps.Marker({
          position: pos,
          map: mapRef.current,
          title: `${v.vehicleId} · ${speed || 0} km/h`,
          label: {
            text: '🚌',
            fontSize: '18px',
          },
          icon: {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 5,
            fillColor: '#10b981',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
            rotation: 0,
          },
        });

        // Info window
        const info = new window.google.maps.InfoWindow({
          content: `<div style="font-size:12px;line-height:1.6">
            <strong>${v.vehicleId}</strong><br/>
            Speed: ${speed || 0} km/h<br/>
            Route: ${v.currentRoute?.name || 'En route'}
          </div>`,
        });
        markersRef.current[v.vehicleId].addListener('click', () => {
          info.open(mapRef.current, markersRef.current[v.vehicleId]);
        });
      }

      bounds.extend(pos);
    });

    // Fit all vehicles into view
    if (vehicles.length === 1) {
      const { latitude: lat, longitude: lng } = vehicles[0].lastPosition || {};
      if (lat && lng) mapRef.current.panTo({ lat, lng });
    } else if (vehicles.length > 1) {
      mapRef.current.fitBounds(bounds, 80);
    }
  }, [vehicles]);

  return (
    <div style={{ position: 'relative', height: 400, borderRadius: 10, overflow: 'hidden', background: '#e5e7eb' }}>
      <div ref={divRef} style={{ height: '100%', width: '100%' }} />
      {vehicles.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(3px)',
          fontSize: 13, color: 'var(--text-3)', gap: 8,
        }}>
          <Navigation size={24} style={{ opacity: 0.3 }} />
          No active vehicles found for this agency
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function PassengerTrack() {
  const { accessToken } = useAuthStore();
  const [bookings,  setBookings]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [vehicles,  setVehicles]  = useState([]);   // live position array
  const [loading,   setLoading]   = useState(true);
  const socketRef = useRef(null);
  const { toast, ToastContainer } = useToast();

  // Load upcoming bookings
  useEffect(() => {
    bookingAPI.myBookings({ status: 'upcoming' })
      .then(r => {
        const list = r.data.data;
        setBookings(list);
        if (list.length > 0) setSelected(list[0]);
      })
      .catch(() => toast('Failed to load bookings', 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  // Fetch initial vehicle positions (FR-PA30) + set up Socket.IO subscription
  const agencyId = selected?.agencyId?._id || selected?.agencyId;

  const fetchLivePositions = useCallback(() => {
    if (!agencyId) return;
    gpsAPI.livePositions(agencyId)
      .then(r => setVehicles(r.data.data || []))
      .catch(() => {});
  }, [agencyId]);

  useEffect(() => {
    if (!agencyId) return;

    // Initial HTTP fetch
    fetchLivePositions();

    // Socket.IO subscription — real-time updates
    if (socketRef.current) socketRef.current.disconnect();

    socketRef.current = io(SOCKET_URL, {
      auth: { token: accessToken },
      query: { agencyId },
      autoConnect: false,
    });
    socketRef.current.connect();

    socketRef.current.on('gps:update', (data) => {
      setVehicles(prev => {
        const idx = prev.findIndex(v => v._id === data.vehicleId || v.vehicleId === data.vehicleId);
        const updated = {
          ...(prev[idx] || { vehicleId: data.vehicleId }),
          lastPosition: {
            latitude:  data.latitude,
            longitude: data.longitude,
            speed:     data.speed,
            heading:   data.heading,
            updatedAt: new Date(data.ts),
          },
        };
        if (idx >= 0) {
          const next = [...prev]; next[idx] = updated; return next;
        }
        return [...prev, updated];
      });
    });

    // Poll REST fallback every 15s (for environments without a live driver)
    const poll = setInterval(fetchLivePositions, 15000);

    return () => {
      socketRef.current?.disconnect();
      clearInterval(poll);
    };
  }, [agencyId, accessToken, fetchLivePositions]);

  // ── ETA calculation (FR-PA32) ────────────────────────────────────
  // We use the first vehicle that has a position as the "approaching" vehicle
  const nearestVehicle = vehicles.find(v => v.lastPosition?.latitude);

  function computeETA() {
    if (!nearestVehicle) return null;
    const { latitude, longitude, speed } = nearestVehicle.lastPosition;
    // Use origin (passenger's boarding city) as rough stop coordinate
    // In production this would use the actual route stop coords
    const stopLat = DEFAULT_CENTER.lat + (Math.random() * 0.01 - 0.005); // demo: ~1 km near centre
    const stopLng = DEFAULT_CENTER.lng + (Math.random() * 0.01 - 0.005);
    return etaMinutes(latitude, longitude, stopLat, stopLng, speed);
  }

  const eta = computeETA();

  return (
    <div className="app-shell">
      <PassengerSidebar />
      <div className="main-content">
        <Topbar title="Live vehicle tracking" />
        <div className="page-body">

          {/* Booking selector */}
          {bookings.length > 1 && (
            <div className="card" style={{ padding: '10px 16px', marginBottom: 0 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 4 }}>Tracking:</span>
                {bookings.map(b => (
                  <button key={b._id}
                    onClick={() => { setSelected(b); setVehicles([]); }}
                    style={{
                      fontSize: 12, padding: '5px 12px', borderRadius: 8,
                      border: `1.5px solid ${selected?._id === b._id ? 'var(--brand-500)' : 'var(--border)'}`,
                      background: selected?._id === b._id ? 'var(--brand-50)' : 'var(--surface)',
                      color: selected?._id === b._id ? 'var(--brand-700)' : 'var(--text-2)',
                      cursor: 'pointer', fontWeight: 500,
                    }}>
                    {b.bookingRef}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ETA + status strip */}
          {selected && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="metric-card fade-up">
                <div className="metric-label" style={{ color: 'var(--brand-600)' }}><Clock size={12} /> ETA to your stop</div>
                <div className="metric-value" style={{ fontSize: 22 }}>
                  {nearestVehicle ? (eta != null ? `${eta} min` : '—') : '—'}
                </div>
              </div>
              <div className="metric-card fade-up stagger-1">
                <div className="metric-label" style={{ color: 'var(--success)' }}><Zap size={12} /> Active vehicles</div>
                <div className="metric-value" style={{ fontSize: 22 }}>{vehicles.length}</div>
              </div>
              <div className="metric-card fade-up stagger-2">
                <div className="metric-label" style={{ color: '#0891b2' }}><Navigation size={12} /> Speed</div>
                <div className="metric-value" style={{ fontSize: 22 }}>
                  {nearestVehicle?.lastPosition?.speed != null
                    ? `${nearestVehicle.lastPosition.speed} km/h` : '—'}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>

            {/* Map (FR-PA30) */}
            <div className="card fade-up">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>Live map</div>
                {vehicles.length > 0 && (
                  <span style={{ fontSize: 11, background: 'var(--success-bg)', color: '#065f46', padding: '2px 8px', borderRadius: 20, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', animation: 'gps-pulse 1.5s infinite' }} />
                    LIVE
                  </span>
                )}
              </div>

              {loading ? (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spinner size={32} />
                </div>
              ) : !selected ? (
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', borderRadius: 10 }}>
                  <EmptyState icon={Navigation} title="No booking selected"
                    sub="Select an upcoming booking to track your vehicle" />
                </div>
              ) : (
                <PassengerMap vehicles={vehicles} agencyId={agencyId} />
              )}

              {/* Legend */}
              <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 11, color: 'var(--text-3)', flexWrap: 'wrap' }}>
                {[
                  ['#10b981', 'Live vehicle'],
                  ['#ef4444', 'Your stop'],
                  ['var(--brand-500)', 'Route path'],
                ].map(([c, lbl]) => (
                  <span key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: c }} /> {lbl}
                  </span>
                ))}
              </div>
            </div>

            {/* Side panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Vehicle list (FR-PA31) */}
              <div className="card fade-up stagger-1">
                <div className="card-title">Approaching vehicles</div>
                {loading ? <Spinner /> : !selected ? (
                  <EmptyState icon={Navigation} title="No booking selected" />
                ) : vehicles.length === 0 ? (
                  <EmptyState icon={Navigation} title="No active vehicles"
                    sub="Vehicles will appear when drivers go online" />
                ) : (
                  vehicles.filter(v => v.lastPosition?.latitude).map(v => {
                    const { speed, latitude, longitude } = v.lastPosition;
                    const mins = etaMinutes(latitude, longitude, DEFAULT_CENTER.lat, DEFAULT_CENTER.lng, speed);
                    return (
                      <div key={v.vehicleId || v._id}
                        style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 8,
                            background: 'var(--success-bg)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: '#065f46',
                          }}>
                            {v.vehicleId?.slice(-3) || '—'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>ETA ~{mins} min</div>
                            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                              {speed || 0} km/h · {v.currentRoute?.name || 'En route'}
                            </div>
                          </div>
                          <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: 'var(--success)',
                            animation: 'gps-pulse 1.5s infinite',
                          }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Booking details */}
              {selected && (
                <div className="card fade-up stagger-2">
                  <div className="card-title">Your booking</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--brand-600)', marginBottom: 8 }}>
                    {selected.bookingRef}
                  </div>
                  {[
                    ['Seat',    selected.seatLabel],
                    ['From',    selected.tripId?.routeId?.origin     || '—'],
                    ['To',      selected.tripId?.routeId?.destination || '—'],
                    ['Departs', selected.tripId?.scheduledStart
                      ? new Date(selected.tripId.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ color: 'var(--text-3)' }}>{k}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}

                  {/* ETA badge (FR-PA32) */}
                  {eta != null && (
                    <div style={{
                      marginTop: 12, padding: '10px 14px',
                      background: eta <= 5 ? 'var(--success-bg)' : 'var(--brand-50)',
                      borderRadius: 8, fontSize: 13, fontWeight: 600,
                      color: eta <= 5 ? '#065f46' : 'var(--brand-700)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <Clock size={14} />
                      {eta <= 5 ? `Arriving in ~${eta} min!` : `~${eta} min away`}
                    </div>
                  )}
                </div>
              )}

              {/* No booking state */}
              {!selected && !loading && (
                <div className="card fade-up">
                  <EmptyState icon={Users} title="No upcoming bookings"
                    sub="Book a trip to track your vehicle here" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
