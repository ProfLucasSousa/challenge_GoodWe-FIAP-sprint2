import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AppShell } from './components/app-shell';
import { LoginPage } from './pages/login-page';

const DashboardPage = lazy(() =>
  import('./pages/dashboard-page').then((module) => ({ default: module.DashboardPage })),
);
const portalPages = () => import('./pages/portal-pages');
const ChargersPage = lazy(() =>
  import('./pages/charger-pages').then((module) => ({ default: module.ChargersPage })),
);
const ChargerDetailPage = lazy(() =>
  import('./pages/charger-pages').then((module) => ({ default: module.ChargerDetailPage })),
);
const SessionsPage = lazy(() => portalPages().then((module) => ({ default: module.SessionsPage })));
const SessionDetailPage = lazy(() =>
  portalPages().then((module) => ({ default: module.SessionDetailPage })),
);
const UnitsPage = lazy(() => portalPages().then((module) => ({ default: module.UnitsPage })));
const UnitDetailPage = lazy(() =>
  portalPages().then((module) => ({ default: module.UnitDetailPage })),
);
const UsersPage = lazy(() => portalPages().then((module) => ({ default: module.UsersPage })));
const VehiclesPage = lazy(() => portalPages().then((module) => ({ default: module.VehiclesPage })));
const RfidsPage = lazy(() => portalPages().then((module) => ({ default: module.RfidsPage })));
const TariffsPage = lazy(() => portalPages().then((module) => ({ default: module.TariffsPage })));
const InvoicesPage = lazy(() => portalPages().then((module) => ({ default: module.InvoicesPage })));
const InvoiceDetailPage = lazy(() =>
  portalPages().then((module) => ({ default: module.InvoiceDetailPage })),
);
const IntelligencePage = lazy(() =>
  portalPages().then((module) => ({ default: module.IntelligencePage })),
);
const GoodWePage = lazy(() => portalPages().then((module) => ({ default: module.GoodWePage })));
const AccountPage = lazy(() => portalPages().then((module) => ({ default: module.AccountPage })));

function ProtectedLayout() {
  const { session } = useAuth();
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

export function App() {
  const { session } = useAuth();
  return (
    <Suspense fallback={<div className="route-loading">Carregando operação…</div>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/carregadores" element={<ChargersPage />} />
            <Route path="/carregadores/:id" element={<ChargerDetailPage />} />
            <Route path="/sessoes" element={<SessionsPage />} />
            <Route path="/sessoes/:id" element={<SessionDetailPage />} />
            <Route path="/unidades" element={<UnitsPage />} />
            <Route path="/unidades/:id" element={<UnitDetailPage />} />
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/veiculos" element={<VehiclesPage />} />
            <Route path="/rfids" element={<RfidsPage />} />
            <Route path="/tarifas" element={<TariffsPage />} />
            <Route path="/faturas" element={<InvoicesPage />} />
            <Route path="/faturas/:id" element={<InvoiceDetailPage />} />
            <Route path="/inteligencia" element={<IntelligencePage />} />
            <Route path="/integracoes/goodwe" element={<GoodWePage />} />
            <Route path="/minha-conta" element={<AccountPage />} />
          </Route>
        </Route>
        <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </Suspense>
  );
}
