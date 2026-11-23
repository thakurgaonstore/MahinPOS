import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import styles from './SuperAdminLayout.module.css';
import { useAuth } from '../context/AuthContext';

import {
  MdDashboard,
  MdStorefront,
  MdCloudSync,
  MdSms,
  MdCampaign,
  MdCardMembership,
  MdHistoryEdu,
  MdSettings,
  MdLogout
} from 'react-icons/md';

const SuperAdminLayout = () => {
  const navigate = useNavigate();
  const { logout, currentUser } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/mahinerp');
    } catch (e) {
      console.error("Super Admin logout failed:", e);
    }
  };

  const navLinks = [
    { name: 'প্ল্যাটফর্ম ওভারভিউ', path: '/super-admin', icon: <MdDashboard /> },
    { name: 'দোকান ও ক্লায়েন্ট তালিকা', path: '/super-admin/shops', icon: <MdStorefront /> },
    { name: '⚡ হাইব্রিড ক্লাউড ও ডেটাবেস', path: '/super-admin/hybrid-db', icon: <MdCloudSync /> },
    { name: '💬 এসএমএস ও গেটওয়ে সেটিংস', path: '/super-admin/sms-gateway', icon: <MdSms /> },
    { name: '📢 সার্বজনীন নোটিশ (Broadcast)', path: '/super-admin/broadcasts', icon: <MdCampaign /> },
    { name: 'বিলিং ও সাবস্ক্রিপশন', path: '/super-admin/subscriptions', icon: <MdCardMembership /> },
    { name: 'অডিট ও অ্যাক্টিভিটি লগ', path: '/super-admin/audit-logs', icon: <MdHistoryEdu /> },
    { name: 'সিস্টেম সেটিংস', path: '/super-admin/settings', icon: <MdSettings /> },
  ];

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.brandLogo}>⚡</div>
          <div className={styles.brandText}>
            <span className={styles.brandTitle}>Mahin SaaS</span>
            <span className={styles.brandBadge}>SUPER ADMIN</span>
          </div>
        </div>

        <nav className={styles.navSection}>
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/super-admin'}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <span>{link.icon}</span>
              <span>{link.name}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className={styles.mainWrapper}>
        <header className={styles.topbar}>
          <h2 className={styles.pageTitle}>Mahin POS প্ল্যাটফর্ম ম্যানেজমেন্ট</h2>
          <div className={styles.adminInfo}>
            <span className={styles.adminEmail}>{currentUser?.email || 'Super Admin'}</span>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              <MdLogout style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              লগআউট
            </button>
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
