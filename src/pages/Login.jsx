import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  MdPointOfSale,
  MdLock,
  MdEmail,
  MdPhoneIphone,
  MdVisibility,
  MdVisibilityOff,
  MdStorefront,
  MdPerson,
  MdAdminPanelSettings,
  MdLockReset,
  MdClose,
  MdCheckCircle
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

  // Forgot password modal state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    const cleanEmail = (resetEmail || '').trim();
    if (!cleanEmail) {
      toast.error('অনুগ্রহ করে আপনার নিবন্ধিত ইমেইল ঠিকানা প্রদান করুন');
      return;
    }

    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetSentSuccess(true);
      toast.success('পাসওয়ার্ড রিসেট লিঙ্ক আপনার ইমেইলে পাঠানো হয়েছে!', { duration: 6000 });
    } catch (err) {
      console.error("Password reset error:", err);
      if (err.code === 'auth/user-not-found') {
        toast.error('এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। সুপার এডমিনের সাথে যোগাযোগ করুন।', { duration: 6000 });
      } else if (err.code === 'auth/invalid-email') {
        toast.error('সঠিক ইমেইল ঠিকানা প্রদান করুন');
      } else {
        toast.error(err.message || 'রিসেট লিঙ্ক পাঠাতে ব্যর্থ হয়েছে');
      }
    } finally {
      setSendingReset(false);
    }
  };

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
      if (err.code === 'auth/invalid-credential' || err.message?.includes('invalid-credential')) {
        toast.error('ভুল ইমেইল বা পাসওয়ার্ড! আপনি কি পাসওয়ার্ড ভুলে গেছেন? নিচে "পাসওয়ার্ড ভুলে গেছেন?" লিঙ্কে ক্লিক করুন।', { duration: 6000 });
      } else {
        toast.error(err.message || 'ভুল ইমেইল বা পাসওয়ার্ড!');
      }
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

            {/* Forgot password link */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-6px' }}>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email.trim());
                  setResetSentSuccess(false);
                  setShowForgotPassword(true);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  padding: '2px 0',
                  textDecoration: 'underline'
                }}
              >
                পাসওয়ার্ড ভুলে গেছেন? (Forgot Password)
              </button>
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

            {/* Staff note */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-6px' }}>
              <span style={{ color: '#94a3b8', fontSize: '11.5px' }}>
                পাসওয়ার্ড ভুলে গেলে দোকান অ্যাডমিনের সাথে যোগাযোগ করুন
              </span>
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

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(5px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '430px',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '16px',
            padding: '28px 24px',
            color: '#fff',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdLockReset size={24} color="#38bdf8" />
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>পাসওয়ার্ড রিসেট</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotPassword(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <MdClose size={22} />
              </button>
            </div>

            {resetSentSuccess ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <MdCheckCircle size={48} color="#10b981" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>
                  রিসেট লিঙ্ক পাঠানো হয়েছে!
                </h4>
                <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '20px' }}>
                  <b>{resetEmail}</b> ঠিকানায় পাসওয়ার্ড পরিবর্তনের অফিসিয়াল লিঙ্ক পাঠানো হয়েছে। অনুগ্রহ করে আপনার ইনবক্স অথবা স্প্যাম ফোল্ডার চেক করে নতুন পাসওয়ার্ড সেট করে নিন।
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  style={{
                    width: '100%',
                    padding: '11px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  লগইন পেজে ফিরে যান
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendResetEmail} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5', margin: 0 }}>
                  আপনার একাউন্টে নিবন্ধিত ইমেইল ঠিকানা দিন। আমরা পাসওয়ার্ড রিসেট করার একটি নিরাপদ লিঙ্ক পাঠিয়ে দেব।
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    নিবন্ধিত ইমেইল (Email)
                  </label>
                  <div style={{ position: 'relative' }}>
                    <MdEmail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#64748b' }} />
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="owner@example.com"
                      required
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 40px',
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

                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      background: '#1e293b',
                      color: '#94a3b8',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    বাতিল
                  </button>
                  <button
                    type="submit"
                    disabled={sendingReset}
                    style={{
                      flex: 2,
                      padding: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#2563eb',
                      color: '#fff',
                      fontWeight: '700',
                      cursor: sendingReset ? 'not-allowed' : 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    {sendingReset ? 'পাঠানো হচ্ছে...' : 'রিসেট লিঙ্ক পাঠান'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
