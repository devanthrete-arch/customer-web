import { ExploreScreen, ExploreCenterScreen } from './screens/ExploreScreens';
import { SupportDetailScreen } from './screens/SupportDetailScreen';
import { useEffect } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PublicTrackingScreen } from './screens/PublicTrackingScreen';
import { isTrackingPath } from './lib/public-tracking';
import { AppShell, RequireProfile } from './components/AppShell';
import { RequireBookingEligibility } from './components/BookingEligibility';
import {
  AuthOtpScreen,
  AuthRegisterScreen,
  AuthSignInScreen,
} from './screens/AuthScreens';
import { LandingScreen } from './screens/LandingScreen';
import { ProfileSetupScreen, RequireToken } from './screens/ProfileScreens';
import { DashboardScreen } from './screens/HomeScreen';
import {
  VehicleAddScreen,
  VehicleDetailScreen,
  VehicleEditScreen,
  VehicleListScreen,
} from './screens/GarageScreens';
import {
  ApprovalScreen,
  HistoryDetailScreen,
  HistoryScreen,
  ServiceDetailScreen,
  ServiceListScreen,
} from './screens/ServicesScreens';
import {
  BookCenterScreen,
  BookIssueScreen,
  BookReviewScreen,
  BookScheduleScreen,
  BookServicesScreen,
  BookVehicleScreen,
} from './screens/BookingScreens';
import {
  DocumentAddScreen,
  DocumentDetailScreen,
  DocumentsScreen,
  MaintenanceAddScreen,
  MaintenanceDetailScreen,
  MaintenanceScreen,
  PaymentDetailScreen,
  PaymentsScreen,
} from './screens/OwnershipScreens';
import {
  AddressesScreen,
  NotificationsScreen,
  PreferencesScreen,
  ProfileScreen,
  SupportScreen,
} from './screens/AccountScreens';
import { DomainProvider } from './domain/DomainProvider';
import { getAccessToken, SIGNED_OUT_EVENT } from './lib/session';

function PhoneFrame() {
  return (
    <div className="af-shell">
      <Outlet />
    </div>
  );
}

function FrontDoor() {
  if (getAccessToken()) return <Navigate to="/home" replace />;
  return <LandingScreen />;
}

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const onSignedOut = () => {
      if (!isTrackingPath(pathname)) navigate('/', { replace: true });
    };
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, [navigate, pathname]);

  return (
    <Routes>
      <Route path="/t/:token" element={<PublicTrackingScreen />} />
      <Route path="/t" element={<PublicTrackingScreen />} />
      <Route path="/t/*" element={<PublicTrackingScreen />} />
      <Route path="/" element={<FrontDoor />} />
      <Route path="/landing" element={<Navigate to="/" replace />} />
      <Route element={<PhoneFrame />}>
        <Route path="/auth/sign-in" element={<AuthSignInScreen />} />
        <Route path="/auth/register" element={<AuthRegisterScreen />} />
        <Route path="/auth/otp" element={<AuthOtpScreen />} />
        <Route
          path="/profile/setup"
          element={
            <RequireToken>
              <ProfileSetupScreen />
            </RequireToken>
          }
        />
        <Route
          element={
            <RequireProfile>
              <DomainProvider>
                <AppShell />
              </DomainProvider>
            </RequireProfile>
          }
        >
          <Route path="/explore" element={<ExploreScreen />} />
          <Route path="/explore/centers/:id" element={<ExploreCenterScreen />} />
          <Route path="/home" element={<DashboardScreen />} />
          <Route path="/vehicles" element={<VehicleListScreen />} />
          <Route path="/vehicles/new" element={<VehicleAddScreen />} />
          <Route path="/vehicles/:id/edit" element={<VehicleEditScreen />} />
          <Route path="/vehicles/:id" element={<VehicleDetailScreen />} />
          <Route path="/services" element={<ServiceListScreen />} />
          <Route element={<RequireBookingEligibility />}>
            <Route path="/services/book/vehicle" element={<BookVehicleScreen />} />
            <Route path="/services/book/center" element={<BookCenterScreen />} />
            <Route path="/services/book/services" element={<BookServicesScreen />} />
            <Route path="/services/book/issue" element={<BookIssueScreen />} />
            <Route path="/services/book/schedule" element={<BookScheduleScreen />} />
            <Route path="/services/book/review" element={<BookReviewScreen />} />
          </Route>
          <Route path="/services/:id/approval" element={<ApprovalScreen />} />
          <Route path="/services/:id" element={<ServiceDetailScreen />} />
          <Route path="/documents" element={<DocumentsScreen />} />
          <Route path="/documents/new" element={<DocumentAddScreen />} />
          <Route path="/documents/:id" element={<DocumentDetailScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/history/:id" element={<HistoryDetailScreen />} />
          <Route path="/maintenance" element={<MaintenanceScreen />} />
          <Route path="/maintenance/new" element={<MaintenanceAddScreen />} />
          <Route path="/maintenance/:id" element={<MaintenanceDetailScreen />} />
          <Route path="/payments" element={<PaymentsScreen />} />
          <Route path="/payments/:id" element={<PaymentDetailScreen />} />
          <Route path="/notifications" element={<NotificationsScreen />} />
          <Route path="/support" element={<SupportScreen />} />
          <Route path="/support/:id" element={<SupportDetailScreen />} />
          <Route path="/profile" element={<ProfileScreen />} />
          <Route path="/profile/addresses" element={<AddressesScreen />} />
          <Route path="/profile/preferences" element={<PreferencesScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
