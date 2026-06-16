import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Auth pages
import { RoleSelectPage, LoginPage, RegisterPage } from './pages/auth';
import RegisterAgency from './pages/agency/RegisterAgency';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminAgencies  from './pages/admin/Agencies';
import AdminUsers     from './pages/admin/Users';
import AdminReports   from './pages/admin/Reports';

// Fleet pages
import FleetDashboard from './pages/fleet/Dashboard';
import FleetAnalytics from './pages/fleet/Analytics';
import FleetSchedule  from './pages/fleet/Schedule';
import { FleetVehicles, FleetRoutes, FleetDrivers, FleetIncidents } from './pages/fleet';

// Driver pages
import DriverDashboard from './pages/driver/Dashboard';
import DriverHistory   from './pages/driver/History';

// Passenger pages
import PassengerAgencies from './pages/passenger/Agencies';
import BookingFlow       from './pages/passenger/BookingFlow';
import PassengerBookings from './pages/passenger/Bookings';
import PassengerTrack    from './pages/passenger/Track';
import PassengerHistory  from './pages/passenger/History';

// Shared pages (all roles)
import ProfilePage       from './pages/shared/Profile';
import NotificationsPage from './pages/shared/Notifications';
import SettingsPage      from './pages/shared/Settings';

// ── Protected route guard ─────────────────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated()) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user?.role)) {
    // Redirect to correct dashboard
    const dashMap = {
      admin: '/admin/dashboard',
      superAdmin: '/admin/dashboard',
      agencyAdmin: '/fleet/dashboard',
      fleetManager: '/fleet/dashboard',
      driver: '/driver/dashboard',
      passenger: '/passenger/agencies',
    };
    return <Navigate to={dashMap[user?.role] || '/'} replace />;
  }

  return children;
}

// ── Role-based home redirect ──────────────────────────────────────
function HomeRedirect() {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated()) return <RoleSelectPage />;
  const dest = {
    admin:        '/admin/dashboard',
    superAdmin:   '/admin/dashboard',
    agencyAdmin:  '/fleet/dashboard',
    fleetManager: '/fleet/dashboard',
    driver:       '/driver/dashboard',
    passenger:    '/passenger/agencies',
  };
  return <Navigate to={dest[user?.role] || '/'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public ── */}
        <Route path="/"                  element={<HomeRedirect />} />
        <Route path="/login/:role"       element={<LoginPage />} />
        <Route path="/register/:role"    element={<RegisterPage />} />
        <Route path="/agency/register"   element={<RegisterAgency />} />

        {/* ── Admin ── */}
        <Route path="/admin/dashboard" element={<ProtectedRoute roles={['admin','superAdmin']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/agencies"  element={<ProtectedRoute roles={['admin','superAdmin']}><AdminAgencies  /></ProtectedRoute>} />
        <Route path="/admin/users"     element={<ProtectedRoute roles={['admin','superAdmin']}><AdminUsers     /></ProtectedRoute>} />
        <Route path="/admin/reports"   element={<ProtectedRoute roles={['admin','superAdmin']}><AdminReports   /></ProtectedRoute>} />
        {/* Redirect /admin → /admin/dashboard */}
        <Route path="/admin"           element={<Navigate to="/admin/dashboard" replace />} />

        {/* ── Fleet Manager ── */}
        <Route path="/fleet/dashboard" element={<ProtectedRoute roles={['agencyAdmin','fleetManager','admin','superAdmin']}><FleetDashboard /></ProtectedRoute>} />
        <Route path="/fleet/vehicles"  element={<ProtectedRoute roles={['agencyAdmin','fleetManager','admin','superAdmin']}><FleetVehicles  /></ProtectedRoute>} />
        <Route path="/fleet/routes"    element={<ProtectedRoute roles={['agencyAdmin','fleetManager','admin','superAdmin']}><FleetRoutes    /></ProtectedRoute>} />
        <Route path="/fleet/schedule"  element={<ProtectedRoute roles={['agencyAdmin','fleetManager','admin','superAdmin']}><FleetSchedule  /></ProtectedRoute>} />
        <Route path="/fleet/drivers"   element={<ProtectedRoute roles={['agencyAdmin','fleetManager','admin','superAdmin']}><FleetDrivers   /></ProtectedRoute>} />
        <Route path="/fleet/incidents" element={<ProtectedRoute roles={['agencyAdmin','fleetManager','admin','superAdmin']}><FleetIncidents /></ProtectedRoute>} />
        <Route path="/fleet/analytics" element={<ProtectedRoute roles={['agencyAdmin','fleetManager','admin','superAdmin']}><FleetAnalytics /></ProtectedRoute>} />
        <Route path="/fleet"           element={<Navigate to="/fleet/dashboard" replace />} />

        {/* ── Driver ── */}
        <Route path="/driver/dashboard" element={<ProtectedRoute roles={['driver','admin']}><DriverDashboard /></ProtectedRoute>} />
        <Route path="/driver/history"   element={<ProtectedRoute roles={['driver','admin']}><DriverHistory   /></ProtectedRoute>} />
        <Route path="/driver"           element={<Navigate to="/driver/dashboard" replace />} />

        {/* ── Passenger ── */}
        <Route path="/passenger/agencies" element={<ProtectedRoute roles={['passenger','admin']}><PassengerAgencies /></ProtectedRoute>} />
        <Route path="/passenger/book/:agencyId" element={<ProtectedRoute roles={['passenger','admin']}><BookingFlow /></ProtectedRoute>} />
        <Route path="/passenger/bookings" element={<ProtectedRoute roles={['passenger','admin']}><PassengerBookings /></ProtectedRoute>} />
        <Route path="/passenger/track"    element={<ProtectedRoute roles={['passenger','admin']}><PassengerTrack    /></ProtectedRoute>} />
        <Route path="/passenger/history"  element={<ProtectedRoute roles={['passenger','admin']}><PassengerHistory  /></ProtectedRoute>} />
        <Route path="/passenger"          element={<Navigate to="/passenger/agencies" replace />} />

        {/* ── Shared (all authenticated roles) ── */}
        <Route path="/profile"       element={<ProtectedRoute roles={['admin','superAdmin','agencyAdmin','fleetManager','driver','passenger']}><ProfilePage       /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute roles={['admin','superAdmin','agencyAdmin','fleetManager','driver','passenger']}><NotificationsPage /></ProtectedRoute>} />
        <Route path="/settings"      element={<ProtectedRoute roles={['admin','superAdmin','agencyAdmin','fleetManager','driver','passenger']}><SettingsPage      /></ProtectedRoute>} />

        {/* ── 404 ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
