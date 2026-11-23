import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { MdSettings, MdSave, MdStorefront, MdReceipt, MdSms, MdCardGiftcard } from 'react-icons/md';

const ShopSettings = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [shopName, setShopName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [binVat, setBinVat] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');
  const [defaultInvoiceFormat, setDefaultInvoiceFormat] = useState('pos'); // 'pos' | 'memo' | 'a4'
  const [pointsEarnRate, setPointsEarnRate] = useState('100'); // 100 BDT = 1 point

  // SMS Gateway
  const [smsGateway, setSmsGateway] = useState('bulksmsbd');
  const [smsApiKey, setSmsApiKey] = useState('');
  const [senderId, setSenderId] = useState('');

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'shops', shopId));
        if (snap.exists()) {
          const d = snap.data();
          setShopName(d.shopName || d.name || '');
          setSlogan(d.slogan || '');
          setPhone(d.phone || '');
          setAddress(d.address || '');
          setBinVat(d.binVat || '');
          setReturnPolicy(d.returnPolicy || 'বিক্রিত পণ্য ৩ দিনের মধ্যে ক্যাশ মেমো সহ ফেরতযোগ্য।');
          setDefaultInvoiceFormat(d.defaultInvoiceFormat || 'pos');
          setPointsEarnRate(d.pointsEarnRate?.toString() || '100');
          setSmsGateway(d.smsGateway || 'bulksmsbd');
          setSmsApiKey(d.smsApiKey || '');
          setSenderId(d.senderId || '');
        }
      } catch (e) {
        console.warn("Failed to load shop settings:", e);
      }
    };
    fetchConfig();
  }, [shopId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'shops', shopId), {
        shopName: shopName.trim(),
        name: shopName.trim(),
        slogan: slogan.trim(),
        phone: phone.trim(),
        address: address.trim(),
        binVat: binVat.trim(),
        returnPolicy: returnPolicy.trim(),
        defaultInvoiceFormat,
        pointsEarnRate: Number(pointsEarnRate) || 100,
        smsGateway,
        smsApiKey: smsApiKey.trim(),
        senderId: senderId.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast.success('দোকান সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err) {
      console.error("Save settings error:", err);
      toast.error('সেটিংস সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>দোকান সেটিংস ও কাস্টমাইজেশন</h1>
        <p style={{ fontSize: '14px', color: '#64748b' }}>দোকানের পরিচিতি, ইনভয়েস প্রিন্ট ডিজাইন ও লয়্যালটি পয়েন্ট কনফিগারেশন</p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Basic Shop Info */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdStorefront color="#2563eb" /> দোকানের সাধারণ তথ্য
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>দোকানের নাম *</label>
              <input type="text" value={shopName} onChange={(e) => setShopName(e.target.value)} required style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>স্লোগান / ট্যাগলাইন</label>
              <input type="text" value={slogan} onChange={(e) => setSlogan(e.target.value)} placeholder="যেমন: আপনার বিশ্বস্ত সুপারশপ" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>দোকানের মোবাইল নম্বর *</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} required style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>BIN / VAT Reg No</label>
              <input type="text" value={binVat} onChange={(e) => setBinVat(e.target.value)} placeholder="ঐচ্ছিক ভ্যাট নম্বর" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>দোকানের ঠিকানা</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="দোকান নং, মার্কেট/রোড, এলাকা, জেলা" style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
          </div>
        </div>

        {/* Invoice & Printing Settings */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdReceipt color="#2563eb" /> ইনভয়েস ও প্রিন্ট সেটিংস (৩টি ফরম্যাট)
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
              ডিফল্ট ইনভয়েস ফরম্যাট নির্বাচন করুন:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { id: 'pos', name: '১. থার্মাল POS (80mm/58mm)', desc: 'সুপারশপ রোল প্রিন্টার' },
                { id: 'memo', name: '২. ক্যাশ মেমো (A5 Half)', desc: 'ঐতিহ্যবাহী বাংলা মেমো' },
                { id: 'a4', name: '৩. অফিসিয়াল ইনভয়েস (A4)', desc: 'পূর্ণাঙ্গ কর্পোরেট চালান' }
              ].map((fmt) => (
                <div
                  key={fmt.id}
                  onClick={() => setDefaultInvoiceFormat(fmt.id)}
                  style={{
                    border: '2px solid',
                    borderColor: defaultInvoiceFormat === fmt.id ? '#2563eb' : '#e2e8f0',
                    background: defaultInvoiceFormat === fmt.id ? '#eff6ff' : '#fff',
                    borderRadius: '10px',
                    padding: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a' }}>{fmt.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{fmt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>ইনভয়েস ফেরত নীতি ও ফুটনোট</label>
            <textarea
              rows="2"
              value={returnPolicy}
              onChange={(e) => setReturnPolicy(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
          </div>
        </div>

        {/* Customer Loyalty Points Configuration */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdCardGiftcard color="#2563eb" /> কাস্টমার রিওয়ার্ড পয়েন্ট রেট
          </h3>
          <div style={{ maxWidth: '360px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
              কত টাকা কেনাকাটায় ১ পয়েন্ট অর্জিত হবে? (৳)
            </label>
            <input
              type="number"
              value={pointsEarnRate}
              onChange={(e) => setPointsEarnRate(e.target.value)}
              placeholder="100"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontWeight: '700' }}
            />
            <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '4px' }}>
              উদাহরণ: ১০০ দিলে কাস্টমার প্রতি ১০০ টাকার ক্রয়ে ১ পয়েন্ট পাবে (১ পয়েন্ট = ১ টাকা ডিসকাউন্ট)।
            </span>
          </div>
        </div>

        {/* SMS Gateway Settings */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdSms color="#2563eb" /> এসএমএস গেটওয়ে সেটিংস (Cloudflare Worker)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>এসএমএস প্রোভাইডার</label>
              <select
                value={smsGateway}
                onChange={(e) => setSmsGateway(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value="bulksmsbd">BulkSMSBD (bulksmsbd.net)</option>
                <option value="greenweb">Greenweb (greenweb.com.bd)</option>
                <option value="mimsms">MimSMS / Generic API</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>API Key / Token</label>
              <input
                type="password"
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                placeholder="API Key লিখুন"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Sender ID / মাস্কিং নাম</label>
              <input
                type="text"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                placeholder="যেমন: 8809612..."
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            alignSelf: 'flex-start',
            padding: '12px 28px',
            borderRadius: '8px',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontSize: '15px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
          }}
        >
          <MdSave size={20} />
          {loading ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}
        </button>
      </form>
    </div>
  );
};

export default ShopSettings;
