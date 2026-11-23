import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  MdPointOfSale,
  MdLock,
  MdEmail,
  MdPhoneIphone,
  MdVisibility,
  MdVisibilityOff,
  MdStorefront,
  MdPerson,
  MdAdminPanelSettings
} from 'react-icons/md';

const Login = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, loginStaff } = useAuth();

  const isSuperAdminPath = location.pathname === '/mahinerp';

  const [activeTab, setActiveTab] = useState('owner'); // 'owner' | 'staff'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Staff login fields
  const [shopCode, setShopCode] = useState(() => localStorage.getItem('lastShopId_pos') || '');
  const [phone, setPhone] = useState('');

  const [loading, setLoading] = useState(false);

  const handleOwnerOrSuperAdminLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('ইমেইল ও পাসওয়ার্ড প্রদান করুন');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success('সফলভাবে লগইন হয়েছে!');
      if (isSuperAdminPath) {
        navigate('/super-admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error("Login error:", err);
      toast.error(err.message || 'ভুল ইমেইল বা পাসওয়ার্ড!');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    if (!shopCode || !phone || !password) {
      toast.error('দোকান কোড, মোবাইল নম্বর ও পাসওয়ার্ড প্রদান করুন');
      return;
    }

    setLoading(true);
    try {
      const res = await loginStaff(shopCode, phone, password);
      if (res.success) {
        toast.success(`স্বাগতম, ${res.profile.name}!`);
        navigate('/dashboard');
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      toast.error('স্টাফ লগইনে সমস্যা হচ্ছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#090d16',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Hind Siliguri', 'Inter', sans-serif"
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: '#0f172a',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '20px',
        padding: '36px 32px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            margin: '0 auto 16px',
            borderRadius: '14px',
            background: isSuperAdminPath 
              ? 'linear-gradient(135deg, #ef4444, #f97316)' 
              : 'linear-gradient(135deg, #2563eb, #38bdf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            color: '#fff',
            boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
          }}>
            {isSuperAdminPath ? <MdAdminPanelSettings /> : <MdPointOfSale />}
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#ffffff', marginBottom: '6px' }}>
            {isSuperAdminPath ? 'সুপার এডমিন লগইন' : 'দোকান ও পিওএস লগইন'}
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8' }}>
            {isSuperAdminPath 
              ? 'প্ল্যাটফর্ম ও সকল দোকান সেন্ট্রাল কন্ট্রোল প্যানেল' 
              : 'আপনার শপ অ্যাকাউন্টে নিরাপদে প্রবেশ করুন'}
          </p>
        </div>

        {/* Tab switch for Client Shop (Owner vs Staff) */}
        {!isSuperAdminPath && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: 'rgba(255,255,255,0.05)',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '24px'
          }}>
            <button
              type="button"
              onClick={() => setActiveTab('owner')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'owner' ? '#2563eb' : 'transparent',
                color: activeTab === 'owner' ? '#ffffff' : '#94a3b8',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <MdStorefront size={16} />
              দোকান মালিক
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'staff' ? '#2563eb' : 'transparent',
                color: activeTab === 'staff' ? '#ffffff' : '#94a3b8',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <MdPerson size={16} />
              স্টাফ / সেলসম্যান
            </button>
          </div>
        )}

        {/* Form */}
        {isSuperAdminPath || activeTab === 'owner' ? (
          <form onSubmit={handleOwnerOrSuperAdminLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                ইমেইল ঠিকানা (Email)
              </label>
              <div style={{ position: 'relative' }}>
                <MdEmail size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: '#64748b' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isSuperAdminPath ? 'admin@mahinpos.com' : 'owner@shop.com'}
                  required
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 40px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                পাসওয়ার্ড (Password)
              </label>
              <div style={{ position: 'relative' }}>
                <MdLock size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: '#64748b' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 40px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '13px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: isSuperAdminPath ? '#ef4444' : '#2563eb',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: isSuperAdminPath 
                  ? '0 4px 12px rgba(239, 68, 68, 0.4)' 
                  : '0 4px 12px rgba(37, 99, 235, 0.4)'
              }}
            >
              {loading ? 'যাচাই করা হচ্ছে...' : (isSuperAdminPath ? 'সুপার এডমিন লগইন' : 'দোকান অ্যাকাউন্টে প্রবেশ')}
            </button>
          </form>
        ) : (
          /* Staff Form */
          <form onSubmit={handleStaffLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                দোকান কোড (Shop Code)
              </label>
              <div style={{ position: 'relative' }}>
                <MdStorefront size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: '#64748b' }} />
                <input
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value)}
                  placeholder="যেমন: shop101 বা main-shop"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 40px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                স্টাফ মোবাইল নম্বর (Phone Number)
              </label>
              <div style={{ position: 'relative' }}>
                <MdPhoneIphone size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: '#64748b' }} />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01700000000"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 12px 11px 40px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                স্টাফ পাসওয়ার্ড (Password)
              </label>
              <div style={{ position: 'relative' }}>
                <MdLock size={18} style={{ position: 'absolute', left: '12px', top: '13px', color: '#64748b' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 40px',
                    borderRadius: '8px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '13px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                  {showPassword ? <MdVisibilityOff size={18} /> : <MdVisibility size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '8px',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                background: '#10b981',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: '700',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)'
              }}
            >
              {loading ? 'লগইন হচ্ছে...' : 'স্টাফ হিসেবে লগইন'}
            </button>
          </form>
        )}

        {/* Footer Links */}
        <div style={{ marginTop: '24px', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <Link to="/" style={{ color: '#94a3b8', fontSize: '13px', textDecoration: 'none' }}>
            ← হোম পেজে ফিরে যান
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
