import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  downloadShopBackupJson,
  backupShopToCloudinary,
  restoreShopDataFromJson
} from '../../utils/tenantBackupManager';

import {
  MdSettings,
  MdSave,
  MdStorefront,
  MdReceipt,
  MdSms,
  MdCardGiftcard,
  MdCloudUpload,
  MdCloudDownload,
  MdBackup,
  MdRestore,
  MdCheckCircle,
  MdWarning
} from 'react-icons/md';

const ShopSettings = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [shopName, setShopName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [binVat, setBinVat] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');
  const [defaultInvoiceFormat, setDefaultInvoiceFormat] = useState('pos');
  const [pointsEarnRate, setPointsEarnRate] = useState('100');

  // SMS Settings & Real-Time Balance
  const [smsBalance, setSmsBalance] = useState(0);
  const [smsStatus, setSmsStatus] = useState('Active');
  const [smsGateway, setSmsGateway] = useState('bulksmsbd');
  const [smsApiKey, setSmsApiKey] = useState('');
  const [senderId, setSenderId] = useState('');

  // Custom Cloudinary Settings (Optional - fallback to Super Admin)
  const [cloudinaryCloudName, setCloudinaryCloudName] = useState('');
  const [cloudinaryUploadPreset, setCloudinaryUploadPreset] = useState('');

  // Backup info
  const [lastBackupDate, setLastBackupDate] = useState('');
  const [lastBackupFileUrl, setLastBackupFileUrl] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

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
          setSmsBalance(d.smsBalance !== undefined ? Number(d.smsBalance) : 0);
          setSmsStatus(d.smsStatus || 'Active');
          setCloudinaryCloudName(d.cloudinaryCloudName || '');
          setCloudinaryUploadPreset(d.cloudinaryUploadPreset || '');
          setLastBackupDate(d.lastBackupDate || '');
          setLastBackupFileUrl(d.lastBackupFileUrl || '');
        }
      } catch (e) {
        console.warn("Failed to load shop settings:", e);
      }
    };
    fetchConfig();
  }, [shopId]);

  // Save Shop Settings
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
        cloudinaryCloudName: cloudinaryCloudName.trim(),
        cloudinaryUploadPreset: cloudinaryUploadPreset.trim(),
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

  // Download JSON Backup
  const handleDownloadBackup = async () => {
    setBackupLoading(true);
    try {
      const res = await downloadShopBackupJson(shopId, shopName);
      toast.success(`ব্যাকআপ ফাইল "${res.fileName}" সফলভাবে ডাউনলোড হয়েছে!`);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'ব্যাকআপ ডাউনলোড ব্যর্থ হয়েছে');
    } finally {
      setBackupLoading(false);
    }
  };

  // Cloudinary Cloud Backup
  const handleCloudinaryBackup = async () => {
    setBackupLoading(true);
    toast.loading('Cloudinary-তে ডেটা ব্যাকআপ নেওয়া হচ্ছে...');
    try {
      const res = await backupShopToCloudinary(shopId, shopName);
      toast.dismiss();
      toast.success('Cloudinary ক্লাউডে সম্পূর্ণ ব্যাকআপ সংরক্ষিত হয়েছে!');
      setLastBackupDate(new Date().toISOString());
      setLastBackupFileUrl(res.fileUrl);
    } catch (e) {
      toast.dismiss();
      console.error(e);
      toast.error(e.message || 'ক্লাউড ব্যাকআপ ব্যর্থ হয়েছে');
    } finally {
      setBackupLoading(false);
    }
  };

  // Restore from JSON File
  const handleFileRestore = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const conf = window.confirm(
      '⚠️ সতর্কবার্তা: আপনি কি নিশ্চিত যে এই ব্যাকআপ ফাইলটি থেকে ডেটা রিস্টোর করতে চান? এটি বর্তমান পণ্যাদি ও হিসাবের সাথে সিঙ্ক হবে।'
    );
    if (!conf) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const res = await restoreShopDataFromJson(shopId, json);
        toast.success(`সফল! মোট ${res.restoredCount} টি ডকুমেন্ট সফলভাবে রিস্টোর হয়েছে।`);
      } catch (err) {
        console.error("Restore error:", err);
        toast.error(err.message || 'ফাইলটি অকার্যকর বা রিস্টোর ব্যর্থ হয়েছে');
      } finally {
        setRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto', paddingBottom: '40px' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>দোকান সেটিংস ও কাস্টমাইজেশন</h1>
        <p style={{ fontSize: '14px', color: '#64748b' }}>
          দোকানের পরিচিতি, ইনভয়েস ডিজাইন, এসএমএস রাউটিং, Cloudinary স্টোরেজ ও ডেটা ব্যাকআপ
        </p>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Basic Shop Info */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdStorefront color="#2563eb" size={20} /> দোকানের সাধারণ তথ্য
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
            <MdReceipt color="#2563eb" size={20} /> ইনভয়েস ও প্রিন্ট সেটিংস (৩টি ফরম্যাট)
          </h3>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
              ডিফল্ট ইনভয়েস ফরম্যাট নির্বাচন করুন:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
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

        {/* Customer Loyalty Points */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdCardGiftcard color="#2563eb" size={20} /> কাস্টমার রিওয়ার্ড পয়েন্ট রেট
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

        {/* Cloudinary Preset Settings (Optional - fallback to Super Admin) */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdCloudUpload color="#7c3aed" size={20} /> Cloudinary ইমেজ ও ফাইল স্টোরেজ সেটিংস (ঐচ্ছিক)
          </h3>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#5b21b6', lineHeight: '1.6' }}>
            💡 <b>স্মার্ট ফলব্যাক সুবিধা:</b> আপনি চাইলে আপনার নিজস্ব Cloudinary একাউন্টের Cloud Name ও Upload Preset নিচে যুক্ত করতে পারেন। যদি এই অপশনগুলো ফাঁকা রাখেন, তবে সিস্টেমের সেন্ট্রাল Cloudinary স্টোরেজেই আপনার পণ্যের ছবি ও ফাইল স্বয়ংক্রিয়ভাবে সুরক্ষিত থাকবে।
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                নিজস্ব Cloudinary Cloud Name (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={cloudinaryCloudName}
                onChange={(e) => setCloudinaryCloudName(e.target.value)}
                placeholder="ফাঁকা রাখলে সেন্ট্রাল ক্লাউডিনারি চলবে"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                Upload Preset Name (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={cloudinaryUploadPreset}
                onChange={(e) => setCloudinaryUploadPreset(e.target.value)}
                placeholder="Unsigned Preset Name"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>
        </div>

        {/* SMS Gateway & Balance Allocation */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdSms color="#059669" size={20} /> এসএমএস সার্ভিস ও ব্যালেন্স রাউটিং
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>সেন্ট্রাল এসএমএস কোটা:</span>
              <span style={{
                background: smsBalance > 0 ? '#ecfdf5' : '#fee2e2',
                color: smsBalance > 0 ? '#059669' : '#dc2626',
                padding: '4px 10px',
                borderRadius: '8px',
                fontWeight: '800',
                fontSize: '13px',
                border: '1px solid',
                borderColor: smsBalance > 0 ? '#a7f3d0' : '#fecaca'
              }}>
                {smsBalance} টি অবশিষ্ট
              </span>
              <span style={{
                background: smsStatus === 'Suspended' ? '#fee2e2' : '#f1f5f9',
                color: smsStatus === 'Suspended' ? '#dc2626' : '#475569',
                padding: '4px 8px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '700'
              }}>
                {smsStatus === 'Suspended' ? 'স্থগিত' : 'সক্রিয়'}
              </span>
            </div>
          </div>

          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#166534', lineHeight: '1.6' }}>
            📱 <b>স্মার্ট এসএমএস রাউটিং নিয়ম:</b><br />
            ১. যদি নিচে আপনার নিজস্ব বাল্ক এসএমএস একাউন্টের API Key দেন, তবে সরাসরি <b>আপনার একাউন্ট থেকেই এসএমএস যাবে</b> (সেন্ট্রাল ব্যালেন্স কাটা হবে না)।<br />
            ২. যদি API Key <b>ফাঁকা রাখেন</b>, তবে সুপার এডমিনের বরাদ্দকৃত <b>সেন্ট্রাল ব্যালেন্স ({smsBalance} টি)</b> থেকে প্রতি এসএমএসে ১টি করে ব্যালেন্স কাটা হবে।
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>নিজস্ব API Key (ঐচ্ছিক)</label>
              <input
                type="password"
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                placeholder="ফাঁকা রাখলে সেন্ট্রাল কোটা চলবে"
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

        {/* Save Settings Button */}
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
          {loading ? 'সংরক্ষণ হচ্ছে...' : 'সকল সেটিংস সংরক্ষণ করুন'}
        </button>
      </form>

      {/* Data Backup & Restore Center */}
      <div style={{ marginTop: '36px', background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a' }}>
          <MdBackup color="#059669" size={22} /> ডেটা ব্যাকআপ ও রিস্টোর সেন্টার (Backup & Restore)
        </h3>
        <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', marginBottom: '20px' }}>
          আপনার দোকানের সকল পণ্য, ইনভেন্টরি, সেলস ইনভয়েস, কাস্টমার এবং হিসাবের পূর্ণাঙ্গ ব্যাকআপ ডাউনলোড করুন অথবা রিস্টোর করুন।
        </p>

        {lastBackupDate && (
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span>সর্বশেষ ব্যাকআপের তারিখ: <b>{new Date(lastBackupDate).toLocaleString('bn-BD')}</b></span>
            {lastBackupFileUrl && (
              <a href={lastBackupFileUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: '700', textDecoration: 'none' }}>
                Cloudinary ফাইল ডাউনলোড ↗
              </a>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {/* Download JSON */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#fafafa' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 6px 0', color: '#0f172a' }}>১. লোকাল JSON ব্যাকআপ</h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>আপনার পিসিতে সম্পূর্ণ ডেটার একটি `.json` ব্যাকআপ ফাইল ডাউনলোড করুন।</p>
            <button
              onClick={handleDownloadBackup}
              disabled={backupLoading}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#0f172a',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <MdCloudDownload size={18} color="#2563eb" /> JSON ফাইল ডাউনলোড
            </button>
          </div>

          {/* Cloudinary Cloud Backup */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#fafafa' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 6px 0', color: '#0f172a' }}>২. Cloudinary ক্লাউড ব্যাকআপ</h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>সরাসরি Cloudinary ক্লাউড স্টোরেজে স্থায়ী ব্যাকআপ সংরক্ষণ করুন।</p>
            <button
              onClick={handleCloudinaryBackup}
              disabled={backupLoading}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                border: 'none',
                background: '#7c3aed',
                color: '#fff',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <MdCloudUpload size={18} /> Cloudinary ক্লাউড ব্যাকআপ
            </button>
          </div>

          {/* Restore JSON */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', background: '#fafafa' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 6px 0', color: '#0f172a' }}>৩. ব্যাকআপ ফাইল রিস্টোর</h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 14px 0' }}>পূর্বের সংরক্ষিত `.json` ফাইল থেকে দোকানের ডেটা রিস্টোর করুন।</p>
            <label style={{
              width: '100%',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              background: '#fef2f2',
              color: '#dc2626',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <MdRestore size={18} /> {restoring ? 'রিস্টোর হচ্ছে...' : 'JSON ফাইল রিস্টোর করুন'}
              <input
                type="file"
                accept=".json"
                onChange={handleFileRestore}
                disabled={restoring}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopSettings;
