import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell, RequireProfile } from './components/AppShell';
import {
  AuthOtpScreen,
  AuthRegisterScreen,
  AuthSignInScreen,
} from './screens/AuthScreens';
import { LandingScreen } from './screens/LandingScreen';
import { ProfileSetupScreen, RequireToken } from './screens/ProfileScreens';
import {
  MockAddressesScreen,
  MockBookCenterScreen,
  MockBookIssueScreen,
  MockBookModeScreen,
  MockBookReviewScreen,
  MockBookScheduleScreen,
  MockBookTypeScreen,
  MockBookVehicleScreen,
  MockDashboardScreen,
  MockDocumentAddScreen,
  MockDocumentDetailScreen,
  MockDocumentsScreen,
  MockHistoryDetailScreen,
  MockHistoryScreen,
  MockMaintenanceDetailScreen,
  MockMaintenanceScreen,
  MockNotificationsScreen,
  MockPaymentDetailScreen,
  MockPaymentsScreen,
  MockPreferencesScreen,
  MockProfileScreen,
  MockRecommendationScreen,
  MockServiceDetailScreen,
  MockServiceListScreen,
  MockSupportScreen,
  MockVehicleAddScreen,
  MockVehicleDetailScreen,
  MockVehicleEditScreen,
  MockVehicleListScreen,
} from './screens/MockProductScreens';

function PhoneFrame() {
  return (
    <div className="af-shell">
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/landing" element={<LandingScreen />} />
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
              <AppShell />
            </RequireProfile>
          }
        >
          <Route path="/home" element={<MockDashboardScreen />} />
          <Route path="/vehicles" element={<MockVehicleListScreen />} />
          <Route path="/vehicles/new" element={<MockVehicleAddScreen />} />
          <Route path="/vehicles/:id/edit" element={<MockVehicleEditScreen />} />
          <Route path="/vehicles/:id" element={<MockVehicleDetailScreen />} />
          <Route path="/services" element={<MockServiceListScreen />} />
          <Route path="/services/book/vehicle" element={<MockBookVehicleScreen />} />
          <Route path="/services/book/type" element={<MockBookTypeScreen />} />
          <Route path="/services/book/issue" element={<MockBookIssueScreen />} />
          <Route path="/services/book/mode" element={<MockBookModeScreen />} />
          <Route path="/services/book/center" element={<MockBookCenterScreen />} />
          <Route path="/services/book/schedule" element={<MockBookScheduleScreen />} />
          <Route path="/services/book/review" element={<MockBookReviewScreen />} />
          <Route path="/services/:id/recommendations/:recommendationId" element={<MockRecommendationScreen />} />
          <Route path="/services/:id" element={<MockServiceDetailScreen />} />
          <Route path="/documents" element={<MockDocumentsScreen />} />
          <Route path="/documents/new" element={<MockDocumentAddScreen />} />
          <Route path="/documents/:id" element={<MockDocumentDetailScreen />} />
          <Route path="/history" element={<MockHistoryScreen />} />
          <Route path="/history/:id" element={<MockHistoryDetailScreen />} />
          <Route path="/maintenance" element={<MockMaintenanceScreen />} />
          <Route path="/maintenance/:id" element={<MockMaintenanceDetailScreen />} />
          <Route path="/payments" element={<MockPaymentsScreen />} />
          <Route path="/payments/:id" element={<MockPaymentDetailScreen />} />
          <Route path="/notifications" element={<MockNotificationsScreen />} />
          <Route path="/support" element={<MockSupportScreen />} />
          <Route path="/profile" element={<MockProfileScreen />} />
          <Route path="/profile/addresses" element={<MockAddressesScreen />} />
          <Route path="/profile/preferences" element={<MockPreferencesScreen />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
