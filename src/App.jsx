import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PageLoader from './components/PageLoader';
import ErrorBoundary from './components/ErrorBoundary';
import { resolveCustomDomain } from './utils/domainResolver';
import './App.css';

// Override global alert
// Mahin POS Production v1.0.1 - Trigger Cloudflare Deploy
window.alert = (msg) => {
  toast(msg, {
    duration: 4000,
    position: 'top-center',
    style: {
      borderRadius: '10px',
      background: '#0f172a',
      color: '#ffffff',
      fontSize: '14px'
    }
  });
};

// Lazy loaded pages & layouts
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const SuperAdminLayout = lazy(() => import('./layouts/SuperAdminLayout'));

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const AccessDenied = lazy(() => import('./pages/AccessDenied'));

const DashboardHome = lazy(() => import('./pages/DashboardHome'));
const POSTerminal = lazy(() => import('./pages/pos/POSTerminal'));
const SalesList = lazy(() => import('./pages/invoices/SalesList'));
const ProductList = lazy(() => import('./pages/inventory/ProductList'));
const LowStockAlerts = lazy(() => import('./pages/inventory/LowStockAlerts'));
const BarcodePrintCenter = lazy(() => import('./pages/inventory/BarcodePrintCenter'));
const AccountsDashboard = lazy(() => import('./pages/accounts/AccountsDashboard'));
const ExpenseManager = lazy(() => import('./pages/accounts/ExpenseManager'));
const CustomerManager = lazy(() => import('./pages/customers/CustomerManager'));
const SupplierLedger = lazy(() => import('./pages/accounts/SupplierLedger'));
const DailyCashRegister = lazy(() => import('./pages/accounts/DailyCashRegister'));
const StaffManager = lazy(() => import('./pages/staff/StaffManager'));
const ShopSettings = lazy(() => import('./pages/settings/ShopSettings'));

const SuperAdminDashboard = lazy(() => import('./pages/superadmin/SuperAdminDashboard'));

// Root Route: Automatically routes to POS login if on custom domain, else platform Landing Page
const RootRoute = () => {
  const [customTenant, setCustomTenant] = React.useState(null);
  const [resolving, setResolving] = React.useState(true);

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const tenant = await resolveCustomDomain();
        if (isMounted && tenant?.shopId) {
          setCustomTenant(tenant);
        }
      } catch (err) {
        console.error("Domain resolution error:", err);
      } finally {
        if (isMounted) setResolving(false);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  if (resolving) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#090d16', color: '#94a3b8' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🛒</div>
          <div style={{ fontSize: '15px' }}>Mahin POS সংযুক্ত হচ্ছে...</div>
        </div>
      </div>
    );
  }

  if (customTenant && customTenant.shopId) {
    return <Navigate to="/poserp" replace />;
  }

  return <LandingPage />;
};

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public & Login Routes */}
                <Route path="/" element={<RootRoute />} />
                <Route path="/login" element={<Navigate to="/poserp" replace />} />
                <Route path="/poserp" element={<Login />} />
                <Route path="/mahinerp" element={<Login />} />
                <Route path="/access-denied" element={<AccessDenied />} />

                {/* Client Shop Admin & Staff Dashboard */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['super_admin', 'shop_admin', 'manager', 'cashier', 'accountant', 'staff']}>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardHome />} />
                  <Route path="pos" element={<POSTerminal />} />
                  <Route path="sales" element={<SalesList />} />
                  <Route path="returns" element={<SalesList defaultTab="return" />} />
                  <Route path="inventory" element={<ProductList />} />
                  <Route path="low-stock" element={<LowStockAlerts />} />
                  <Route path="barcodes" element={<ProtectedRoute allowedRoles={['super_admin', 'shop_admin', 'manager']}><BarcodePrintCenter /></ProtectedRoute>} />
                  <Route path="accounts" element={<ProtectedRoute allowedRoles={['super_admin', 'shop_admin', 'accountant']}><AccountsDashboard /></ProtectedRoute>} />
                  <Route path="expenses" element={<ProtectedRoute allowedRoles={['super_admin', 'shop_admin', 'accountant', 'manager']}><ExpenseManager /></ProtectedRoute>} />
                  <Route path="customers" element={<CustomerManager />} />
                  <Route path="suppliers" element={<ProtectedRoute allowedRoles={['super_admin', 'shop_admin', 'manager', 'accountant']}><SupplierLedger /></ProtectedRoute>} />
                  <Route path="cash-register" element={<DailyCashRegister />} />
                  <Route path="staff" element={<ProtectedRoute allowedRoles={['super_admin', 'shop_admin']}><StaffManager /></ProtectedRoute>} />
                  <Route path="settings" element={<ProtectedRoute allowedRoles={['super_admin', 'shop_admin']}><ShopSettings /></ProtectedRoute>} />
                </Route>

                {/* Super Admin Dashboard */}
                <Route
                  path="/super-admin"
                  element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                      <SuperAdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<SuperAdminDashboard />} />
                  <Route path="shops" element={<SuperAdminDashboard />} />
                  <Route path="hybrid-db" element={<SuperAdminDashboard />} />
                  <Route path="sms-gateway" element={<SuperAdminDashboard />} />
                  <Route path="broadcasts" element={<SuperAdminDashboard />} />
                  <Route path="subscriptions" element={<SuperAdminDashboard />} />
                  <Route path="audit-logs" element={<SuperAdminDashboard />} />
                  <Route path="settings" element={<SuperAdminDashboard />} />
                  <Route path="*" element={<SuperAdminDashboard />} />
                </Route>

                {/* Shorthand Redirects */}
                <Route path="/pos" element={<Navigate to="/dashboard/pos" replace />} />
                <Route path="/sales" element={<Navigate to="/dashboard/sales" replace />} />
                <Route path="/inventory" element={<Navigate to="/dashboard/inventory" replace />} />
                <Route path="/accounts" element={<Navigate to="/dashboard/accounts" replace />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </>
  );
}

export default App;
