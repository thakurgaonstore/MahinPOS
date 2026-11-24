import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import styles from './DashboardLayout.module.css';
import { useAuth } from '../context/AuthContext';

// Icons
import {
  MdPointOfSale,
  MdDashboard,
  MdShoppingCart,
  MdInventory,
  MdWarning,
  MdQrCode,
  MdAccountBalance,
  MdReceipt,
  MdPeople,
  MdLocalShipping,
  MdPayments,
  MdManageAccounts,
  MdSettings,
  MdLogout,
  MdMenu,
  MdClose,
  MdFullscreen,
  MdFullscreenExit,
  MdAdminPanelSettings
} from 'react-icons/md';

const DashboardLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser, userProfile, stopImpersonation } = useAuth();

  const [shopName, setShopName] = useState(userProfile?.shopName || "Mahin POS Store");
  const [shopLogo, setShopLogo] = useState(userProfile?.logoUrl || "");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  const shopId = userProfile?.shopId || 'main-shop';
  const role = userProfile?.role || 'cashier';

  // Load shop profile logo and title
  useEffect(() => {
    if (!shopId) return;
    getDoc(doc(db, 'shops', shopId)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.shopName || d.name) setShopName(d.shopName || d.name);
        if (d.logoUrl) setShopLogo(d.logoUrl);
      }
    }).catch(() => {});
  }, [shopId]);

  const isSuperAdminUser = 
    userProfile?.isImpersonating || 
    userProfile?.role === 'super_admin' || 
    ['mahin.webservice@gmail.com', 'admin@mahinpos.com', 'admin@mahinerp.com'].includes(currentUser?.email?.toLowerCase());

  // Realtime low stock tracker
  useEffect(() => {
    if (!shopId) return;
    try {
      const prodRef = collection(db, 'shops', shopId, 'products');
      const unsubscribe = onSnapshot(prodRef, (snapshot) => {
        let count = 0;
        snapshot.forEach((doc) => {
          const data = doc.data();
          const stock = Number(data.stock) || 0;
          const minAlert = Number(data.minStockAlert) || 5;
          if (stock <= minAlert) {
            count++;
          }
        });
        setLowStockCount(count);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Low stock tracker error:", e);
    }
  }, [shopId]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleExitToSuperAdmin = () => {
    stopImpersonation();
    navigate('/super-admin');
  };

  const handleLogout = async () => {
    try {
      await logout();
      if (isSuperAdminUser) {
        navigate('/mahinerp');
      } else {
        navigate('/poserp');
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Role based access check
  const isOwnerOrManager = role === 'shop_admin' || role === 'manager' || userProfile?.isImpersonating || isSuperAdminUser;
  const isAccountant = role === 'accountant' || isOwnerOrManager;

  const navLinks = [
    { name: 'ড্যাশবোর্ড (Overview)', path: '/dashboard', icon: <MdDashboard />, show: true },
    { name: '⚡ POS বিলিং কাউন্টার', path: '/dashboard/pos', icon: <MdPointOfSale />, show: true },
    { name: 'বিক্রয় ও ইনভয়েস', path: '/dashboard/sales', icon: <MdShoppingCart />, show: true },
    { name: 'পণ্য ও ইনভেন্টরি', path: '/dashboard/inventory', icon: <MdInventory />, show: isOwnerOrManager },
    { name: 'কম স্টক এলার্ট', path: '/dashboard/low-stock', icon: <MdWarning />, badge: lowStockCount > 0 ? lowStockCount : null, show: true },
    { name: 'বারকোড স্টিকার প্রিন্ট', path: '/dashboard/barcodes', icon: <MdQrCode />, show: isOwnerOrManager },
    { name: 'হিসাব ও লাভ-ক্ষতি', path: '/dashboard/accounts', icon: <MdAccountBalance />, show: isAccountant },
    { name: 'খরচের খাতা', path: '/dashboard/expenses', icon: <MdReceipt />, show: isAccountant },
    { name: 'গ্রাহক ও লয়্যালটি পয়েন্ট', path: '/dashboard/customers', icon: <MdPeople />, show: true },
    { name: 'মহাজন / সাপ্লায়ার খাতা', path: '/dashboard/suppliers', icon: <MdLocalShipping />, show: isOwnerOrManager },
    { name: 'দৈনিক ক্যাশ খাতা', path: '/dashboard/cash-register', icon: <MdPayments />, show: true },
    { name: 'স্টাফ ও পেরোল (HR)', path: '/dashboard/staff', icon: <MdManageAccounts />, show: isOwnerOrManager },
    { name: 'দোকান সেটিংস', path: '/dashboard/settings', icon: <MdSettings />, show: isOwnerOrManager },
  ];

  return (
    <div className={styles.layout}>
      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div 
          onClick={() => setIsMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 45 }}
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isMobileOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <Link to="/dashboard" className={styles.brand}>
            {shopLogo ? (
              <img src={shopLogo} alt="Logo" style={{ width: '38px', height: '38px', objectFit: 'contain', borderRadius: '8px', background: '#ffffff', padding: '2px', flexShrink: 0 }} />
            ) : (
              <div className={styles.brandLogo}>POS</div>
            )}
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>{shopName}</span>
              <span className={styles.brandSubtitle}>স্মার্ট শপ ম্যানেজমেন্ট</span>
            </div>
          </Link>
          <button 
            onClick={() => setIsMobileOpen(false)} 
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', display: isMobileOpen ? 'block' : 'none' }}
          >
            <MdClose />
          </button>
        </div>

        <nav className={styles.navSection}>
          {navLinks.filter(l => l.show).map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/dashboard'}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
              onClick={() => setIsMobileOpen(false)}
            >
              <span className={styles.navIcon}>{link.icon}</span>
              <span>{link.name}</span>
              {link.badge && <span className={styles.navBadge}>{link.badge}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Super Admin Quick Return Button in Sidebar */}
        {isSuperAdminUser && (
          <div style={{ padding: '14px 16px', borderTop: '1px solid #1e293b', marginTop: 'auto', background: '#090d16' }}>
            <button
              onClick={handleExitToSuperAdmin}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 14px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
              }}
            >
              <MdAdminPanelSettings size={18} />
              <span>⚡ সুপার এডমিন প্যানেল</span>
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className={styles.mainWrapper}>
        {/* Impersonation Banner if Super Admin is browsing */}
        {userProfile?.isImpersonating && (
          <div className={styles.impersonationBanner} style={{
            background: 'linear-gradient(90deg, #7f1d1d, #991b1b)',
            color: '#fff',
            padding: '12px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            <span>⚡ আপনি সুপার এডমিন হিসেবে <b>"{shopName}"</b> দোকানে প্রবেশ করেছেন (Impersonation Mode)</span>
            <button
              onClick={handleExitToSuperAdmin}
              className={styles.stopImpBtn}
              style={{
                background: '#ffffff',
                color: '#dc2626',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '6px',
                fontWeight: '800',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              সুপার এডমিনে ফিরুন →
            </button>
          </div>
        )}

        {/* Topbar */}
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button 
              onClick={() => setIsMobileOpen(true)}
              style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#0f172a' }}
            >
              <MdMenu />
            </button>
            <div className={styles.shopInfo}>
              <span className={styles.shopName}>{shopName}</span>
              <span className={styles.shopRole}>
                রোল: <span className={styles.roleTag}>{role}</span>
              </span>
            </div>
          </div>

          <div className={styles.topbarRight}>
            {/* Direct Super Admin return in Topbar */}
            {isSuperAdminUser && (
              <button
                onClick={handleExitToSuperAdmin}
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MdAdminPanelSettings size={17} />
                <span>সুপার এডমিন</span>
              </button>
            )}

            <Link to="/dashboard/pos" className={styles.quickPosBtn}>
              <MdPointOfSale size={18} />
              <span>নতুন বিক্রয় (POS)</span>
            </Link>

            <button 
              onClick={toggleFullscreen}
              title="ফুলস্ক্রিন মোড"
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '8px', cursor: 'pointer', color: '#64748b', display: 'flex' }}
            >
              {isFullscreen ? <MdFullscreenExit size={20} /> : <MdFullscreen size={20} />}
            </button>

            <div className={styles.userMenu}>
              <button onClick={handleLogout} className={styles.logoutBtn} title="লগআউট করুন">
                <MdLogout size={16} />
                <span>লগআউট</span>
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
