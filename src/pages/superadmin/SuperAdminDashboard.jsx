import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, addDoc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'react-hot-toast';

import {
  MdStorefront,
  MdAdd,
  MdLogin,
  MdCloudSync,
  MdSms,
  MdCampaign,
  MdCardMembership,
  MdCheckCircle,
  MdBlock,
  MdEdit,
  MdSave
} from 'react-icons/md';

const SuperAdminDashboard = () => {
  const { impersonateShop } = useAuth();
  const navigate = useNavigate();

  const [shops, setShops] = useState([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New Shop form fields
  const [shopCode, setShopCode] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [packageTier, setPackageTier] = useState('Pro'); // 'Starter' | 'Pro' | 'Enterprise'
  const [maxProducts, setMaxProducts] = useState(1000);
  const [databaseType, setDatabaseType] = useState('Shared'); // 'Shared' | 'Dedicated'

  // Broadcast & SMS settings
  const [broadcastText, setBroadcastText] = useState('');
  const [isBroadcastActive, setIsBroadcastActive] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shops'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setShops(list);
    });

    const fetchBroadcast = async () => {
      try {
        const bSnap = await getDoc(doc(db, 'platform', 'broadcast'));
        if (bSnap.exists()) {
          const data = bSnap.data();
          setBroadcastText(data.message || '');
          setIsBroadcastActive(data.isActive || false);
        }
      } catch (e) {}
    };
    fetchBroadcast();

    return () => unsub();
  }, []);

  // 1-Click Impersonation: Super Admin enters shop as Owner!
  const handleImpersonate = async (shop) => {
    toast.loading(`দোকানে প্রবেশ করা হচ্ছে: ${shop.shopName || shop.name}...`);
    const success = await impersonateShop(shop.id, shop);
    toast.dismiss();
    if (success) {
      toast.success(`সফলভাবে ${shop.shopName || shop.name} দোকানে প্রবেশ করেছেন!`);
      navigate('/dashboard');
    } else {
      toast.error('প্রবেশ করতে ব্যর্থ হয়েছে');
    }
  };

  // Add New Shop Tenant
  const handleCreateShop = async (e) => {
    e.preventDefault();
    const cleanId = shopCode.toLowerCase().replace(/[^a-z0-9-_]/g, '').trim();
    if (!cleanId || !shopName || !ownerEmail) {
      toast.error('দোকান কোড, নাম ও মালিকের ইমেইল দিন');
      return;
    }

    try {
      const shopData = {
        shopName: shopName.trim(),
        name: shopName.trim(),
        ownerEmail: ownerEmail.trim(),
        phone: phone.trim(),
        packageTier,
        maxProducts: Number(maxProducts) || 1000,
        databaseType,
        status: 'Active',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'shops', cleanId), shopData);
      toast.success(`নতুন দোকান "${shopName}" সফলভাবে তৈরি হয়েছে!`);
      setIsAddModalOpen(false);
      setShopCode('');
      setShopName('');
      setOwnerEmail('');
      setPhone('');
    } catch (err) {
      toast.error('দোকান তৈরিতে সমস্যা হয়েছে');
    }
  };

  // Toggle Shop Status (Active / Suspended)
  const toggleShopStatus = async (shop) => {
    const newStatus = shop.status === 'Active' ? 'Suspended' : 'Active';
    try {
      await updateDoc(doc(db, 'shops', shop.id), { status: newStatus });
      toast.success(`দোকানের স্ট্যাটাস: ${newStatus}`);
    } catch (e) {
      toast.error('স্ট্যাটাস পরিবর্তন ব্যর্থ');
    }
  };

  // Save Broadcast Announcement
  const handleSaveBroadcast = async () => {
    try {
      await setDoc(doc(db, 'platform', 'broadcast'), {
        message: broadcastText.trim(),
        isActive: isBroadcastActive,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('প্ল্যাটফর্ম ব্রডকাস্ট নোটিশ আপডেট হয়েছে!');
    } catch (e) {
      toast.error('ব্রডকাস্ট সেভ করতে সমস্যা হয়েছে');
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>সুপার এডমিন কন্ট্রোল সেন্টার</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>Mahin POS মাল্টিটেন্যান্ট প্ল্যাটফর্মের সকল দোকান পরিচালনা</p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: '#ef4444',
            color: '#ffffff',
            fontWeight: '700',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
          }}
        >
          <MdAdd size={20} /> নতুন দোকান অনবোর্ড করুন
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>মোট দোকান ক্লায়েন্ট</span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a' }}>{shops.length} টি</div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#059669' }}>সক্রিয় দোকান (Active)</span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669' }}>
            {shops.filter(s => s.status !== 'Suspended').length} টি
          </div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#dc2626' }}>স্থগিত দোকান (Suspended)</span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#dc2626' }}>
            {shops.filter(s => s.status === 'Suspended').length} টি
          </div>
        </div>
      </div>

      {/* Broadcast Announcement Config Box */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MdCampaign color="#ef4444" size={22} /> সকল দোকান ড্যাশবোর্ডে সার্বজনীন নোটিশ প্রচার (Broadcast)
        </h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            placeholder="যেমন: আজ রাত ১২টায় সার্ভার মেইনটেন্যান্স চলবে..."
            style={{ flex: 1, minWidth: '280px', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isBroadcastActive}
              onChange={(e) => setIsBroadcastActive(e.target.checked)}
            />
            সক্রিয় রাখুন
          </label>
          <button
            onClick={handleSaveBroadcast}
            style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: '#0f172a', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
          >
            প্রচার করুন
          </button>
        </div>
      </div>

      {/* Shops Table with 1-Click Impersonation */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', marginBottom: '16px' }}>
          নিবন্ধিত সকল দোকান ও টেন্যান্ট তালিকা
        </h3>

        <div className="table-responsive">
          <table className="pos-table">
            <thead>
              <tr>
                <th>দোকান কোড (ID)</th>
                <th>দোকানের নাম</th>
                <th>মালিকের ইমেইল</th>
                <th>প্যাকেজ</th>
                <th>ডেটাবেস মোড</th>
                <th>স্ট্যাটাস</th>
                <th style={{ textAlign: 'center' }}>⚡ ১-ক্লিক প্রবেশ (Login as Owner)</th>
                <th style={{ textAlign: 'center' }}>স্ট্যাটাস পরিবর্তন</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((s) => (
                <tr key={s.id}>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#2563eb' }}>
                      {s.id}
                    </span>
                  </td>
                  <td><b>{s.shopName || s.name}</b></td>
                  <td>{s.ownerEmail}</td>
                  <td>
                    <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '700' }}>
                      {s.packageTier || 'Pro'} (সর্বোচ্চ {s.maxProducts || 1000} পণ্য)
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      {s.databaseType === 'Dedicated' ? '⚡ Dedicated DB' : 'Shared Cloud'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: s.status === 'Suspended' ? '#fee2e2' : '#ecfdf5',
                      color: s.status === 'Suspended' ? '#dc2626' : '#059669'
                    }}>
                      {s.status === 'Suspended' ? 'স্থগিত' : 'সক্রিয়'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleImpersonate(s)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.3)'
                      }}
                    >
                      <MdLogin size={15} /> প্রবেশ করুন (POS)
                    </button>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => toggleShopStatus(s)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '4px',
                        border: '1px solid',
                        borderColor: s.status === 'Suspended' ? '#a7f3d0' : '#fecaca',
                        background: s.status === 'Suspended' ? '#ecfdf5' : '#fee2e2',
                        color: s.status === 'Suspended' ? '#059669' : '#dc2626',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {s.status === 'Suspended' ? 'সক্রিয় করুন' : 'স্থগিত করুন'}
                    </button>
                  </td>
                </tr>
              ))}

              {shops.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    কোনো দোকান নিবন্ধিত নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Onboard New Shop Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '500px', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px' }}>নতুন দোকান অনবোর্ড করুন</h3>
            <form onSubmit={handleCreateShop} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  দোকান কোড / ID (Unique Code) *
                </label>
                <input
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value)}
                  placeholder="যেমন: mahin-store বা shop101"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>দোকানের নাম *</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="যেমন: মায়িশা সুপার স্টোর"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>মালিকের ইমেইল *</label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@example.com"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>মোবাইল নম্বর</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01700000000"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>প্যাকেজ</label>
                  <select
                    value={packageTier}
                    onChange={(e) => {
                      setPackageTier(e.target.value);
                      if (e.target.value === 'Starter') setMaxProducts(500);
                      else if (e.target.value === 'Pro') setMaxProducts(1000);
                      else setMaxProducts(5000);
                    }}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option value="Starter">Starter (৫০০ পণ্য)</option>
                    <option value="Pro">Pro (১০০০ পণ্য)</option>
                    <option value="Enterprise">Enterprise (৫০০০+ পণ্য)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>ডেটাবেস টাইপ</label>
                  <select
                    value={databaseType}
                    onChange={(e) => setDatabaseType(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option value="Shared">Shared MahinPOS DB</option>
                    <option value="Dedicated">Dedicated Firebase DB</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: '700' }}
                >
                  অনবোর্ড নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
