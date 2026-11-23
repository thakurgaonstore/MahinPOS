import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
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
  MdFullscreenExit
} from 'react-icons/md';

const DashboardLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentUser, userProfile, stopImpersonation } = useAuth();

  const [shopName, setShopName] = useState(userProfile?.shopName || "Mahin POS Store");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  const shopId = userProfile?.shopId || 'main-shop';
  const role = userProfile?.role || 'cashier';

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

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/poserp');
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Role based access check
  const isOwnerOrManager = role === 'shop_admin' || role === 'manager' || userProfile?.isImpersonating;
  const isAccountant = role === 'accountant' || isOwnerOrManager;

  const navLinks = [
    { name: 'ড্যাশবোর্ড (Overview)', path: '/dashboard', icon: <MdDashboard />, show: true },
    { name: '⚡ POS বিলিং কাউন্টার', path: '/dashboard/pos', icon: <MdPointOfSale />, show: true },
    { name: 'বিক্রয় ও ইনভয়েস', path: '/dashboard/sales', icon: <MdShoppingCart />, show: true },
    { name: 'পণ্য ও ইনভেন্টরি', path: '/dashboard/inventory', icon: <MdInventory />, show: isOwnerOrManager },
    { name: 'কম স্টক এলার্ট', path: '/dashboard/low-stock', icon: <MdWarning />, badge: lowStockCount > 0 ? lowStockCount : null, show: true },
    { name: 'বারকোড প্রিন্টার', path: '/dashboard/barcodes', icon: <MdQrCode />, show: isOwnerOrManager },
    { name: 'হিসাব ও লাভ-ক্ষতি', path: '/dashboard/accounts', icon: <MdAccountBalance />, show: isAccountant },
    { name: 'খরচের খাতা', path: '/dashboard/expenses', icon: <MdReceipt />, show: isAccountant },
    { name: 'গ্রাহক ও লয়্যালটি পয়েন্ট', path: '/dashboard/customers', icon: <MdPeople />, show: true },
    { name: 'মহাজন / সাপ্লায়ার খাতা', path: '/dashboard/suppliers', icon: <MdLocalShipping />, show: isOwnerOrManager },
    { name: 'দৈনিক ক্যাশ খাতা', path: '/dashboard/cash-register', icon: <MdPayments />, show: true },
    { name: 'স্টাফ ও পারমিশন', path: '/dashboard/staff', icon: <MdManageAccounts />, show: role === 'shop_admin' || userProfile?.isImpersonating },
    { name: 'দোকান সেটিংস', path: '/dashboard/settings', icon: <MdSettings />, show: role === 'shop_admin' || userProfile?.isImpersonating },
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
            <div className={styles.brandLogo}>POS</div>
            <div className={styles.brandText}>
              <span className={styles.brandTitle}>Mahin POS</span>
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
      </aside>

      {/* Main Content Area */}
      <div className={styles.mainWrapper}>
        {/* Impersonation Banner if Super Admin is browsing */}
        {userProfile?.isImpersonating && (
          <div className={styles.impersonationBanner}>
            <span>⚡ আপনি সুপার এডমিন হিসেবে <b>{userProfile.shopName}</b> দোকানে প্রবেশ করেছেন (Impersonation Mode)</span>
            <button onClick={stopImpersonation} className={styles.stopImpBtn}>
              এডমিনে ফেরত যান
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
