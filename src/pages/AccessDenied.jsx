import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AccessDenied = () => {
  const { userProfile, currentUser } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin' || 
    ['mahin.webservice@gmail.com', 'admin@mahinpos.com'].includes(currentUser?.email?.toLowerCase());

  return (
    <div style={{
      minHeight: '80vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '24px',
      fontFamily: "'Hind Siliguri', 'Inter', sans-serif"
    }}>
      <div style={{
        maxWidth: '480px',
        background: '#ffffff',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ fontSize: '56px', marginBottom: '16px' }}>🚫</div>
        <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
          প্রবেশাধিকার সংরক্ষিত (Access Denied)
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
          আপনার অ্যাকাউন্টটিতে এই সেকশনে প্রবেশের উপযুক্ত পারমিশন নেই। অনুগ্রহ করে আপনার দোকান মালিক বা ম্যানেজারের সাথে যোগাযোগ করুন।
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {isSuperAdmin && (
            <Link to="/super-admin" style={{
              background: '#ef4444',
              color: '#fff',
              padding: '10px 20px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '700',
              fontSize: '14px'
            }}>
              ⚡ সুপার এডমিন প্যানেল
            </Link>
          )}
          <Link to="/dashboard" style={{
            background: '#2563eb',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '14px'
          }}>
            ড্যাশবোর্ডে ফিরুন
          </Link>
          <Link to="/mahinerp" style={{
            background: '#f1f5f9',
            color: '#334155',
            padding: '10px 20px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '14px'
          }}>
            এডমিন লগইন
          </Link>
        </div>
      </div>
    </div>
  );
};

export default AccessDenied;
