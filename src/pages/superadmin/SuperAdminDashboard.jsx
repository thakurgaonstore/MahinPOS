import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, getAuth } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { db, primaryFirebaseConfig, defaultAuth } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  testCloudinaryConnection,
  downloadShopBackupJson,
  backupShopToCloudinary
} from '../../utils/tenantBackupManager';

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
  MdSave,
  MdDelete,
  MdSearch,
  MdFilterList,
  MdRefresh,
  MdSecurity,
  MdSpeed,
  MdHistoryEdu,
  MdSettings,
  MdCheck,
  MdClose,
  MdSend,
  MdCloudUpload,
  MdCloudDownload,
  MdBackup,
  MdOutlineCloudDone,
  MdConfirmationNumber,
  MdVpnKey,
  MdContentCopy
} from 'react-icons/md';

const SuperAdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { impersonateShop, currentUser } = useAuth();

  const currentPath = location.pathname;

  // Real-time Shops List
  const [shops, setShops] = useState([]);
  const [loadingShops, setLoadingShops] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'Active' | 'Suspended'

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New Shop Form
  const [shopCode, setShopCode] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('12345678');
  const [phone, setPhone] = useState('');
  const [packageTier, setPackageTier] = useState('Pro');
  const [maxProducts, setMaxProducts] = useState(1000);
  const [databaseType, setDatabaseType] = useState('Shared');
  const [initialSmsQuota, setInitialSmsQuota] = useState(50); // Default 50 free SMS

  // Broadcast State
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastType, setBroadcastType] = useState('info');
  const [isBroadcastActive, setIsBroadcastActive] = useState(false);
  const [savingBroadcast, setSavingBroadcast] = useState(false);

  // SMS & Gateway Settings State
  const [smsProvider, setSmsProvider] = useState('bulksmsbd');
  const [smsApiKey, setSmsApiKey] = useState('');
  const [smsSenderId, setSmsSenderId] = useState('');
  const [bkashAppKey, setBkashAppKey] = useState('');
  const [bkashSecret, setBkashSecret] = useState('');
  const [sslStoreId, setSslStoreId] = useState('');
  const [savingGateways, setSavingGateways] = useState(false);

  // Cloudinary Global Settings
  const [cCloudName, setCCloudName] = useState('jekaqst5');
  const [cImagePreset, setCImagePreset] = useState('school_preset');
  const [cBackupPreset, setCBackupPreset] = useState('school_preset');
  const [cBackupFolder, setCBackupFolder] = useState('MahinPOS_Backups');
  const [testingCloudinary, setTestingCloudinary] = useState(false);
  const [savingCloudinary, setSavingCloudinary] = useState(false);

  // SMS Allocation Modal
  const [smsModalShop, setSmsModalShop] = useState(null);
  const [smsNewBalance, setSmsNewBalance] = useState(0);
  const [smsNewStatus, setSmsNewStatus] = useState('Active');
  const [updatingSms, setUpdatingSms] = useState(false);

  // Password Management Modal State
  const [passwordModalShop, setPasswordModalShop] = useState(null);
  const [adminNewPassword, setAdminNewPassword] = useState('12345678');
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [settingNewPassword, setSettingNewPassword] = useState(false);

  // Dedicated DB Config Form
  const [selectedShopForDb, setSelectedShopForDb] = useState('');
  const [dedicatedApiKey, setDedicatedApiKey] = useState('');
  const [dedicatedProjectId, setDedicatedProjectId] = useState('');

  // Fetch Shops in Real-Time
  useEffect(() => {
    setLoadingShops(true);
    const unsub = onSnapshot(
      collection(db, 'shops'),
      (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setShops(list);
        setLoadingShops(false);
      },
      (error) => {
        console.error("Firestore snapshot error:", error);
        setLoadingShops(false);
        if (error.code === 'permission-denied') {
          toast.error('Firebase Rules পারমিশন প্রয়োজন: Firebase কনসোলে Firestore Rules পাবলিশ করুন।', { duration: 6000 });
        }
      }
    );

    // Fetch Broadcast, Gateway & Cloudinary Settings
    const fetchGlobalConfigs = async () => {
      try {
        const bSnap = await getDoc(doc(db, 'platform', 'broadcast'));
        if (bSnap.exists()) {
          const data = bSnap.data();
          setBroadcastText(data.message || '');
          setIsBroadcastActive(data.isActive || false);
          setBroadcastType(data.type || 'info');
        }

        const gSnap = await getDoc(doc(db, 'platform', 'gateways'));
        if (gSnap.exists()) {
          const gData = gSnap.data();
          setSmsProvider(gData.smsProvider || 'bulksmsbd');
          setSmsApiKey(gData.smsApiKey || '');
          setSmsSenderId(gData.smsSenderId || '');
          setBkashAppKey(gData.bkashAppKey || '');
          setBkashSecret(gData.bkashSecret || '');
          setSslStoreId(gData.sslStoreId || '');
        }

        const cSnap = await getDoc(doc(db, 'platform', 'cloudinary'));
        if (cSnap.exists()) {
          const cData = cSnap.data();
          setCCloudName(cData.cloudName || 'jekaqst5');
          setCImagePreset(cData.imagePreset || 'school_preset');
          setCBackupPreset(cData.backupPreset || 'school_preset');
          setCBackupFolder(cData.backupFolder || 'MahinPOS_Backups');
        }
      } catch (e) {
        console.warn("Global configs fetch note:", e);
      }
    };

    fetchGlobalConfigs();
    return () => unsub();
  }, []);

  // 1-Click Impersonation: Enter Shop as Owner
  const handleImpersonate = async (shop) => {
    toast.loading(`দোকানে প্রবেশ করা হচ্ছে: ${shop.shopName || shop.name}...`);
    const success = await impersonateShop(shop.id, shop);
    toast.dismiss();
    if (success) {
      toast.success(`সফলভাবে ${shop.shopName || shop.name} দোকানে প্রবেশ করেছেন!`);
      navigate('/dashboard');
    } else {
      toast.error('দোকানে প্রবেশ করতে ব্যর্থ হয়েছে');
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

    setSubmitting(true);
    try {
      const defaultPass = (ownerPassword || '12345678').trim();
      const shopData = {
        shopName: shopName.trim(),
        name: shopName.trim(),
        ownerEmail: ownerEmail.trim(),
        phone: phone.trim(),
        tempPassword: defaultPass,
        packageTier,
        maxProducts: Number(maxProducts) || 1000,
        databaseType,
        smsBalance: Number(initialSmsQuota) || 50,
        smsStatus: 'Active',
        status: 'Active',
        createdAt: serverTimestamp()
      };

      await setDoc(doc(db, 'shops', cleanId), shopData);

      // Create Firebase Auth user using secondary app so Super Admin is NOT logged out
      try {
        const secondaryApp = getApps().find(a => a.name === 'SecondaryCreatorApp') || 
                             initializeApp(primaryFirebaseConfig, 'SecondaryCreatorApp');
        const secondaryAuth = getAuth(secondaryApp);
        await createUserWithEmailAndPassword(secondaryAuth, ownerEmail.trim(), defaultPass);
        await signOut(secondaryAuth);
      } catch (authErr) {
        console.warn("[SuperAdmin] Auth account creation note:", authErr.code);
      }

      // Create initial settings profile for tenant
      try {
        await setDoc(doc(db, 'shops', cleanId, 'settings', 'profile'), {
          shopName: shopName.trim(),
          phone: phone.trim(),
          email: ownerEmail.trim(),
          address: 'বাংলাদেশ',
          invoiceFormat: 'thermal_80mm',
          enablePoints: true,
          pointsPer100Tk: 1,
          pointValueTk: 1
        }, { merge: true });
      } catch (e) {
        console.warn("Profile init note:", e);
      }

      toast.success(`নতুন দোকান "${shopName}" সফলভাবে তৈরি হয়েছে! পাসওয়ার্ড: ${defaultPass}`);
      setIsAddModalOpen(false);
      setShopCode('');
      setShopName('');
      setOwnerEmail('');
      setOwnerPassword('12345678');
      setPhone('');
    } catch (err) {
      console.error("Create shop error:", err);
      if (err.code === 'permission-denied') {
        toast.error('Firebase Rules পারমিশন সমস্যা! Firebase Console > Firestore Database > Rules এ গিয়ে allow read, write: if true; দিয়ে Publish করুন।', { duration: 8000 });
      } else {
        toast.error(err.message || 'দোকান তৈরিতে সমস্যা হয়েছে');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Open Password Modal
  const openPasswordModal = (shop) => {
    setPasswordModalShop(shop);
    setAdminNewPassword(shop.tempPassword || '12345678');
  };

  // 1-Click Send Reset Link via Email
  const handleAdminSendResetEmail = async (shop) => {
    const targetEmail = shop?.ownerEmail?.trim();
    if (!targetEmail) {
      toast.error('দোকানের কোনো মালিক ইমেইল পাওয়া যায়নি');
      return;
    }
    setSendingResetLink(true);
    try {
      await sendPasswordResetEmail(defaultAuth, targetEmail);
      toast.success(`পাসওয়ার্ড রিসেট লিঙ্ক সফলভাবে "${targetEmail}" ঠিকানায় পাঠানো হয়েছে!`, { duration: 6000 });
    } catch (err) {
      console.error("Admin send reset link error:", err);
      if (err.code === 'auth/user-not-found') {
        toast.error('Firebase Auth-এ এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি। অনুগ্রহ করে নিচে "নতুন পাসওয়ার্ড দিয়ে একাউন্ট তৈরি/সেট করুন" অপশনটি ব্যবহার করুন।', { duration: 8000 });
      } else {
        toast.error(err.message || 'পাসওয়ার্ড রিসেট লিঙ্ক পাঠাতে ব্যর্থ হয়েছে');
      }
    } finally {
      setSendingResetLink(false);
    }
  };

  // Direct Set / Create Password
  const handleAdminSetNewPassword = async (e) => {
    e.preventDefault();
    if (!passwordModalShop || !adminNewPassword) return;
    const cleanPass = adminNewPassword.trim();
    if (cleanPass.length < 6) {
      toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }

    setSettingNewPassword(true);
    const targetEmail = passwordModalShop.ownerEmail?.trim();
    try {
      let created = false;
      try {
        const secondaryApp = getApps().find(a => a.name === 'SecondaryCreatorApp') || 
                             initializeApp(primaryFirebaseConfig, 'SecondaryCreatorApp');
        const secondaryAuth = getAuth(secondaryApp);
        await createUserWithEmailAndPassword(secondaryAuth, targetEmail, cleanPass);
        await signOut(secondaryAuth);
        created = true;
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          try {
            await sendPasswordResetEmail(defaultAuth, targetEmail);
          } catch (rErr) {}
        } else {
          console.warn("Secondary auth creation note:", authErr.code);
        }
      }

      await updateDoc(doc(db, 'shops', passwordModalShop.id), {
        tempPassword: cleanPass,
        lastPasswordResetAt: serverTimestamp()
      });

      if (created) {
        toast.success(`ক্লায়েন্টের নতুন Firebase Auth একাউন্ট তৈরি ও পাসওয়ার্ড "${cleanPass}" সফলভাবে সেট হয়েছে!`, { duration: 6000 });
      } else {
        toast.success(`পাসওয়ার্ড রিসেট লিঙ্ক "${targetEmail}"-এ পাঠানো হয়েছে এবং সাময়িক পাসওয়ার্ড সেভ হয়েছে!`, { duration: 6000 });
      }
      setPasswordModalShop(null);
    } catch (err) {
      console.error("Admin set password error:", err);
      toast.error(err.message || 'পাসওয়ার্ড সেট করতে ব্যর্থ হয়েছে');
    } finally {
      setSettingNewPassword(false);
    }
  };

  // Toggle Shop Status (Active / Suspended)
  const toggleShopStatus = async (shop) => {
    const newStatus = shop.status === 'Active' ? 'Suspended' : 'Active';
    try {
      await updateDoc(doc(db, 'shops', shop.id), { status: newStatus });
      toast.success(`দোকানের স্ট্যাটাস পরিবর্তন: ${newStatus === 'Active' ? 'সক্রিয়' : 'স্থগিত'}`);
    } catch (e) {
      console.error(e);
      toast.error('স্ট্যাটাস পরিবর্তন ব্যর্থ');
    }
  };

  // Delete Shop
  const handleDeleteShop = async (shop) => {
    const conf = window.confirm(`আপনি কি নিশ্চিত যে "${shop.shopName || shop.name}" দোকানটি স্থায়ীভাবে মুছে ফেলতে চান?`);
    if (!conf) return;

    try {
      await deleteDoc(doc(db, 'shops', shop.id));
      toast.success('দোকানটি মুছে ফেলা হয়েছে');
    } catch (e) {
      console.error(e);
      toast.error('দোকান মুছতে ব্যর্থ হয়েছে');
    }
  };

  // Open SMS Allocation Modal
  const openSmsModal = (shop) => {
    setSmsModalShop(shop);
    setSmsNewBalance(shop.smsBalance !== undefined ? Number(shop.smsBalance) : 0);
    setSmsNewStatus(shop.smsStatus || 'Active');
  };

  // Save SMS Allocation
  const handleSaveSmsAllocation = async (e) => {
    e.preventDefault();
    if (!smsModalShop) return;
    setUpdatingSms(true);
    try {
      await updateDoc(doc(db, 'shops', smsModalShop.id), {
        smsBalance: Number(smsNewBalance),
        smsStatus: smsNewStatus,
        lastSmsAllocatedAt: serverTimestamp()
      });
      toast.success(`"${smsModalShop.shopName || smsModalShop.name}" দোকানে এসএমএস কোটা আপডেট হয়েছে!`);
      setSmsModalShop(null);
    } catch (err) {
      console.error(err);
      toast.error('এসএমএস বরাদ্দ সংরক্ষণ ব্যর্থ');
    } finally {
      setUpdatingSms(false);
    }
  };

  // Admin 1-Click JSON Backup
  const handleAdminDownloadBackup = async (shop) => {
    try {
      toast.loading(`"${shop.shopName || shop.name}" ডেটা প্রস্তুত হচ্ছে...`);
      const res = await downloadShopBackupJson(shop.id, shop.shopName || shop.name);
      toast.dismiss();
      toast.success(`ব্যাকআপ ফাইল "${res.fileName}" ডাউনলোড হয়েছে!`);
    } catch (e) {
      toast.dismiss();
      console.error(e);
      toast.error(e.message || 'ব্যাকআপ তৈরি ব্যর্থ');
    }
  };

  // Admin 1-Click Cloudinary Backup
  const handleAdminCloudinaryBackup = async (shop) => {
    try {
      toast.loading(`Cloudinary-তে "${shop.shopName || shop.name}" ব্যাকআপ নেওয়া হচ্ছে...`);
      const res = await backupShopToCloudinary(shop.id, shop.shopName || shop.name, {
        cloudName: cCloudName,
        uploadPreset: cBackupPreset,
        folder: cBackupFolder
      });
      toast.dismiss();
      toast.success(`সফল! Cloudinary ক্লাউডে সংরক্ষিত হয়েছে: ${res.fileName}`);
    } catch (e) {
      toast.dismiss();
      console.error(e);
      toast.error(e.message || 'ক্লাউড ব্যাকআপ ব্যর্থ');
    }
  };

  // Save Cloudinary Global Settings
  const handleSaveCloudinary = async (e) => {
    e.preventDefault();
    setSavingCloudinary(true);
    try {
      await setDoc(doc(db, 'platform', 'cloudinary'), {
        cloudName: cCloudName.trim(),
        imagePreset: cImagePreset.trim(),
        backupPreset: cBackupPreset.trim(),
        backupFolder: cBackupFolder.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('গ্লোবাল Cloudinary প্রিসেট ও ব্যাকআপ সেটিংস সংরক্ষিত হয়েছে!');
    } catch (e) {
      console.error(e);
      toast.error('Cloudinary সেটিংস সেভ করতে সমস্যা হয়েছে');
    } finally {
      setSavingCloudinary(false);
    }
  };

  // Test Cloudinary Connection
  const handleTestCloudinary = async () => {
    setTestingCloudinary(true);
    toast.loading('Cloudinary ক্লাউড ব্যাকআপ সংযোগ পরীক্ষা করা হচ্ছে...');
    try {
      const res = await testCloudinaryConnection(cCloudName, cBackupPreset, cBackupFolder);
      toast.dismiss();
      toast.success(res.message);
    } catch (e) {
      toast.dismiss();
      console.error(e);
      toast.error(e.message || 'Cloudinary সংযোগ ব্যর্থ হয়েছে');
    } finally {
      setTestingCloudinary(false);
    }
  };

  // Save Broadcast Announcement
  const handleSaveBroadcast = async () => {
    setSavingBroadcast(true);
    try {
      await setDoc(doc(db, 'platform', 'broadcast'), {
        message: broadcastText.trim(),
        isActive: isBroadcastActive,
        type: broadcastType,
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('সার্বজনীন নোটিশ সফলভাবে আপডেট হয়েছে!');
    } catch (e) {
      console.error(e);
      toast.error('নোটিশ সেভ করতে সমস্যা হয়েছে');
    } finally {
      setSavingBroadcast(false);
    }
  };

  // Save SMS & Gateway Settings
  const handleSaveGateways = async (e) => {
    e.preventDefault();
    setSavingGateways(true);
    try {
      await setDoc(doc(db, 'platform', 'gateways'), {
        smsProvider,
        smsApiKey: smsApiKey.trim(),
        smsSenderId: smsSenderId.trim(),
        bkashAppKey: bkashAppKey.trim(),
        bkashSecret: bkashSecret.trim(),
        sslStoreId: sslStoreId.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('গেটওয়ে সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (e) {
      console.error(e);
      toast.error('গেটওয়ে সেটিংস সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setSavingGateways(false);
    }
  };

  // Filtered Shops
  const filteredShops = shops.filter((s) => {
    const matchSearch =
      (s.shopName || s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.ownerEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone || '').includes(searchTerm);

    const matchStatus =
      statusFilter === 'ALL' ? true :
      statusFilter === 'Active' ? s.status !== 'Suspended' :
      s.status === 'Suspended';

    return matchSearch && matchStatus;
  });

  // Common Top Header
  const renderHeader = (title, subtitle, actionButton = null) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{title}</h1>
        <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>{subtitle}</p>
      </div>
      {actionButton}
    </div>
  );

  /* =========================================================================================
     VIEW 1: প্ল্যাটফর্ম ওভারভিউ (Platform Overview)
  ========================================================================================= */
  const renderOverview = () => (
    <div>
      {renderHeader(
        'সুপার এডমিন কন্ট্রোল সেন্টার',
        'Mahin POS মাল্টিটেন্যান্ট প্ল্যাটফর্মের সার্বিক পরিসংখ্যান ও স্বাস্থ্য',
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
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>মোট দোকান ক্লায়েন্ট</span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginTop: '6px' }}>{shops.length} টি</div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '13px', color: '#059669', fontWeight: '600' }}>সক্রিয় দোকান (Active)</span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#059669', marginTop: '6px' }}>
            {shops.filter(s => s.status !== 'Suspended').length} টি
          </div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '13px', color: '#dc2626', fontWeight: '600' }}>স্থগিত দোকান (Suspended)</span>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#dc2626', marginTop: '6px' }}>
            {shops.filter(s => s.status === 'Suspended').length} টি
          </div>
        </div>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: '600' }}>সিস্টেম ভার্সন</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb', marginTop: '6px' }}>v1.2 Cloud Pro</div>
        </div>
      </div>

      {/* System Health */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdSpeed color="#2563eb" size={20} /> ইনফ্রাস্ট্রাকচার স্ট্যাটাস
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Cloudflare Pages হোস্টিং:</span>
              <span style={{ color: '#059669', fontWeight: '700' }}>● লাইভ (mahinpos.pages.dev)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Firebase Firestore DB:</span>
              <span style={{ color: '#059669', fontWeight: '700' }}>● সংযুক্ত (mahinpos)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Cloudinary ক্লাউড স্টোরেজ:</span>
              <span style={{ color: '#7c3aed', fontWeight: '700' }}>● সচল ({cCloudName})</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>সুপার এডমিন একাউন্ট:</span>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>{currentUser?.email}</span>
            </div>
          </div>
        </div>

        {/* Quick Broadcast Banner Preview */}
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdCampaign color="#ef4444" size={20} /> লাইভ সার্বজনীন নোটিশ
          </h3>
          {isBroadcastActive && broadcastText ? (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '14px',
              borderRadius: '8px',
              color: '#991b1b',
              fontSize: '14px',
              lineHeight: '1.5'
            }}>
              <b>📢 বর্তমান প্রচার:</b> {broadcastText}
            </div>
          ) : (
            <div style={{ color: '#94a3b8', fontSize: '14px', padding: '16px 0' }}>
              বর্তমানে কোনো সার্বজনীন নোটিশ সক্রিয় নেই।
            </div>
          )}
          <div style={{ marginTop: '14px' }}>
            <Link
              to="/super-admin/broadcasts"
              style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: '700' }}
            >
              নোটিশ পরিবর্তন বা প্রচার করুন →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Shops Preview */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            সাম্প্রতিক অনবোর্ড করা দোকান
          </h3>
          <Link to="/super-admin/shops" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'none', fontWeight: '700' }}>
            সকল দোকান ও ক্লায়েন্ট পরিচালনা ({shops.length}) →
          </Link>
        </div>
        {renderShopsTable(shops.slice(0, 5))}
      </div>
    </div>
  );

  /* =========================================================================================
     VIEW 2: দোকান ও ক্লায়েন্ট তালিকা (Shops & Client Management)
  ========================================================================================= */
  const renderShopsView = () => (
    <div>
      {renderHeader(
        'দোকান ও ক্লায়েন্ট তালিকা',
        'প্ল্যাটফর্মে নিবন্ধিত সকল দোকান, এসএমএস কোটা বরাদ্দ, ব্যাকআপ ও ১-ক্লিক প্রবেশ',
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
      )}

      {/* Search & Filter Bar */}
      <div style={{
        background: '#fff',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
        display: 'flex',
        gap: '14px',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: '280px', alignItems: 'center' }}>
          <MdSearch size={22} color="#94a3b8" />
          <input
            type="text"
            placeholder="দোকানের নাম, আইডি, ইমেইল বা মোবাইল দিয়ে খুঁজুন..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', border: 'none', outline: 'none', fontSize: '14px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>ফিল্টার:</span>
          {['ALL', 'Active', 'Suspended'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: statusFilter === s ? '#2563eb' : '#cbd5e1',
                background: statusFilter === s ? '#eff6ff' : '#fff',
                color: statusFilter === s ? '#2563eb' : '#64748b',
                fontWeight: statusFilter === s ? '700' : '500',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              {s === 'ALL' ? 'সকল দোকান' : s === 'Active' ? 'সক্রিয়' : 'স্থগিত'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px' }}>
        {renderShopsTable(filteredShops)}
      </div>
    </div>
  );

  /* Helper: Shops Table Component */
  const renderShopsTable = (list) => (
    <div className="table-responsive">
      <table className="pos-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
            <th style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b' }}>দোকান কোড (ID)</th>
            <th style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b' }}>দোকানের নাম</th>
            <th style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b' }}>মালিকের তথ্য</th>
            <th style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b' }}>প্যাকেজ</th>
            <th style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>💬 এসএমএস কোটা</th>
            <th style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b' }}>স্ট্যাটাস</th>
            <th style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>⚡ ১-ক্লিক প্রবেশ</th>
            <th style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>ব্যাকআপ</th>
            <th style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b', textAlign: 'center' }}>অ্যাকশন</th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => {
            const smsBal = s.smsBalance !== undefined ? Number(s.smsBalance) : 0;
            const smsActive = s.smsStatus !== 'Suspended';
            return (
              <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px 10px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#2563eb', background: '#eff6ff', padding: '3px 8px', borderRadius: '4px' }}>
                    {s.id}
                  </span>
                </td>
                <td style={{ padding: '12px 10px' }}>
                  <div style={{ fontWeight: '700', color: '#0f172a' }}>{s.shopName || s.name}</div>
                  <div style={{ fontSize: '11px', color: s.databaseType === 'Dedicated' ? '#7c3aed' : '#64748b' }}>
                    {s.databaseType === 'Dedicated' ? '⚡ Dedicated DB' : 'Shared Cloud'}
                  </div>
                </td>
                <td style={{ padding: '12px 10px' }}>
                  <div style={{ fontSize: '13px', color: '#334155' }}>{s.ownerEmail}</div>
                  {s.phone && <div style={{ fontSize: '12px', color: '#64748b' }}>{s.phone}</div>}
                </td>
                <td style={{ padding: '12px 10px' }}>
                  <span style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                    {s.packageTier || 'Pro'}
                  </span>
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: '800',
                      background: smsBal > 0 ? '#ecfdf5' : '#fee2e2',
                      color: smsBal > 0 ? '#059669' : '#dc2626',
                      border: '1px solid',
                      borderColor: smsBal > 0 ? '#a7f3d0' : '#fecaca'
                    }}>
                      {smsBal} টি {smsActive ? '' : '(স্থগিত)'}
                    </span>
                    <button
                      onClick={() => openSmsModal(s)}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        color: '#2563eb',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      বরাদ্দ পরিবর্তন
                    </button>
                  </div>
                </td>
                <td style={{ padding: '12px 10px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: s.status === 'Suspended' ? '#fee2e2' : '#ecfdf5',
                    color: s.status === 'Suspended' ? '#dc2626' : '#059669'
                  }}>
                    {s.status === 'Suspended' ? 'স্থগিত' : 'সক্রিয়'}
                  </span>
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                  <button
                    onClick={() => handleImpersonate(s)}
                    style={{
                      padding: '7px 14px',
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
                      boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                    }}
                  >
                    <MdLogin size={15} /> প্রবেশ করুন (POS)
                  </button>
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: '4px' }}>
                    <button
                      onClick={() => handleAdminDownloadBackup(s)}
                      title="JSON ব্যাকআপ ফাইল ডাউনলোড করুন"
                      style={{
                        padding: '5px 8px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        color: '#0f172a',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <MdCloudDownload size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> JSON
                    </button>
                    <button
                      onClick={() => handleAdminCloudinaryBackup(s)}
                      title="Cloudinary-তে ক্লাউড ব্যাকআপ নিন"
                      style={{
                        padding: '5px 8px',
                        borderRadius: '4px',
                        border: 'none',
                        background: '#7c3aed',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      <MdCloudUpload size={14} style={{ verticalAlign: 'middle', marginRight: '2px' }} /> ক্লাউড
                    </button>
                  </div>
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', gap: '6px' }}>
                    <button
                      onClick={() => openPasswordModal(s)}
                      title="ক্লায়েন্ট পাসওয়ার্ড রিসেট ও সেটআপ"
                      style={{
                        padding: '5px 9px',
                        borderRadius: '5px',
                        border: '1px solid #fed7aa',
                        background: '#fff7ed',
                        color: '#ea580c',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px'
                      }}
                    >
                      <MdVpnKey size={13} /> পাসওয়ার্ড
                    </button>
                    <button
                      onClick={() => toggleShopStatus(s)}
                      title={s.status === 'Suspended' ? 'সক্রিয় করুন' : 'স্থগিত করুন'}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '5px',
                        border: '1px solid',
                        borderColor: s.status === 'Suspended' ? '#a7f3d0' : '#fecaca',
                        background: s.status === 'Suspended' ? '#ecfdf5' : '#fee2e2',
                        color: s.status === 'Suspended' ? '#059669' : '#dc2626',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {s.status === 'Suspended' ? 'সক্রিয়' : 'স্থগিত'}
                    </button>
                    <button
                      onClick={() => handleDeleteShop(s)}
                      title="দোকান মুছুন"
                      style={{
                        padding: '5px 8px',
                        borderRadius: '5px',
                        border: '1px solid #fee2e2',
                        background: '#fff',
                        color: '#ef4444',
                        cursor: 'pointer'
                      }}
                    >
                      <MdDelete size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {list.length === 0 && (
            <tr>
              <td colSpan="9" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                {loadingShops ? 'দোকানের তালিকা লোড হচ্ছে...' : 'কোনো দোকান পাওয়া যায়নি'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  /* =========================================================================================
     VIEW 3: হাইব্রিড ক্লাউড ও ডেটাবেস (Hybrid Cloud & Dedicated DB)
  ========================================================================================= */
  const renderHybridDbView = () => (
    <div>
      {renderHeader(
        'হাইব্রিড ক্লাউড ও ডেটাবেস সংযোগ',
        'মাল্টিটেন্যান্ট আর্কিটেকচার: শেয়ার্ড ক্লাউড ডেটাবেস ও এন্টারপ্রাইজ ক্লায়েন্ট ডেডিকেটেড DB সংযোগ'
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Shared Database Status */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdCloudSync color="#2563eb" size={22} /> শেয়ার্ড প্রাইমারি ক্লাউড DB (Firebase)
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', marginBottom: '16px' }}>
            ছোট ও মাঝারি আকারের দোকানগুলোর ডেটা ডিফল্টভাবে এই সেন্ট্রাল ফায়ারবেস ক্লাউডে সুরক্ষিত থাকে।
          </p>

          <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>Project ID:</span>
              <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>mahinpos</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>কানেকশন স্ট্যাটাস:</span>
              <span style={{ color: '#059669', fontWeight: '700' }}>● সক্রিয় (Active)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>নিবন্ধিত শেয়ার্ড দোকান:</span>
              <span style={{ fontWeight: '700' }}>{shops.filter(s => s.databaseType !== 'Dedicated').length} টি</span>
            </div>
          </div>
        </div>

        {/* Dedicated Database Management */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdSecurity color="#7c3aed" size={22} /> ডেডিকেটেড টেন্যান্ট ক্লাউড DB
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', marginBottom: '16px' }}>
            বড় সুপারশপ বা এন্টারপ্রাইজ ক্লায়েন্টদের জন্য তাদের নিজস্ব প্রাইভেট ফায়ারবেস প্রোজেক্ট কানেক্ট করার সুবিধা।
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>দোকান সিলেক্ট করুন</label>
              <select
                value={selectedShopForDb}
                onChange={(e) => setSelectedShopForDb(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value="">দোকান বেছে নিন...</option>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.shopName || s.name} ({s.id})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Dedicated Project ID</label>
              <input
                type="text"
                placeholder="যেমন: my-shop-firebase"
                value={dedicatedProjectId}
                onChange={(e) => setDedicatedProjectId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>API Key</label>
              <input
                type="text"
                placeholder="AIzaSy..."
                value={dedicatedApiKey}
                onChange={(e) => setDedicatedApiKey(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <button
              onClick={() => {
                if (!selectedShopForDb || !dedicatedProjectId) {
                  toast.error('দোকান ও Project ID প্রদান করুন');
                  return;
                }
                updateDoc(doc(db, 'shops', selectedShopForDb), {
                  databaseType: 'Dedicated',
                  dedicatedFirebaseConfig: {
                    projectId: dedicatedProjectId.trim(),
                    apiKey: dedicatedApiKey.trim()
                  }
                }).then(() => toast.success('ডেডিকেটেড DB সংযোগ সফল!'))
                  .catch(() => toast.error('সংযোগে সমস্যা হয়েছে'));
              }}
              style={{
                marginTop: '6px',
                padding: '10px',
                borderRadius: '6px',
                border: 'none',
                background: '#7c3aed',
                color: '#fff',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              ডেডিকেটেড DB সেভ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* =========================================================================================
     VIEW 4: এসএমএস ও গেটওয়ে সেটিংস (SMS & Gateway Settings)
  ========================================================================================= */
  const renderSmsGatewayView = () => (
    <div>
      {renderHeader(
        'এসএমএস ও পেমেন্ট গেটওয়ে সেটিংস',
        'ক্লায়েন্টদের ইনভয়েস মেসেজ এবং অনলাইন পেমেন্ট সংগ্রহের সেন্ট্রাল গেটওয়ে কনফিগারেশন'
      )}

      <form onSubmit={handleSaveGateways} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* SMS Gateway Card */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdSms color="#059669" size={22} /> সেন্ট্রাল এসএমএস গেটওয়ে (Master SMS Gateway)
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', marginBottom: '16px' }}>
            যেসব ক্লায়েন্টের নিজস্ব এপিআই নেই, তারা সুপার এডমিনের এই সেন্ট্রাল গেটওয়ের মাধ্যমে এসএমএস পাঠাবে (বরাদ্দকৃত কোটা থেকে)।
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>এসএমএস প্রোভাইডার</label>
              <select
                value={smsProvider}
                onChange={(e) => setSmsProvider(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value="bulksmsbd">BulkSMSBD (www.bulksmsbd.com)</option>
                <option value="greenweb">Greenweb SMS</option>
                <option value="mimsms">MimSMS Bangladesh</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Master API Key / Token</label>
              <input
                type="text"
                placeholder="API Key দিন"
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Master Sender ID / Masking</label>
              <input
                type="text"
                placeholder="যেমন: MahinPOS বা 8809612..."
                value={smsSenderId}
                onChange={(e) => setSmsSenderId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', fontSize: '12px', color: '#64748b' }}>
              💡 টিপস: ক্লাউডফ্লেয়ার ওয়ার্কার গেটওয়ে (`worker.js`) এই সেটিংস ব্যবহার করে এসএমএস ডেলিভারি করবে।
            </div>
          </div>
        </div>

        {/* Payment Gateways Card */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdCardMembership color="#ef4444" size={22} /> পেমেন্ট গেটওয়ে (bKash & SSLCOMMERZ)
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.6', marginBottom: '16px' }}>
            দোকান সাবস্ক্রিপশন ফি ও গ্রাহক বিল কালেকশনের অনলাইন গেটওয়ে ক্রেডেনশিয়াল।
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>bKash App Key</label>
              <input
                type="text"
                placeholder="bKash App Key"
                value={bkashAppKey}
                onChange={(e) => setBkashAppKey(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>bKash App Secret</label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={bkashSecret}
                onChange={(e) => setBkashSecret(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>SSLCOMMERZ Store ID</label>
              <input
                type="text"
                placeholder="SSLCOMMERZ Store ID"
                value={sslStoreId}
                onChange={(e) => setSslStoreId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <button
              type="submit"
              disabled={savingGateways}
              style={{
                marginTop: '10px',
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                background: '#0f172a',
                color: '#fff',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <MdSave size={18} /> {savingGateways ? 'সংরক্ষণ হচ্ছে...' : 'সকল সেটিংস সংরক্ষণ করুন'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );

  /* =========================================================================================
     VIEW 5: সার্বজনীন নোটিশ (Broadcast Announcement)
  ========================================================================================= */
  const renderBroadcastsView = () => (
    <div>
      {renderHeader(
        'সার্বজনীন নোটিশ (Broadcast Announcement)',
        'প্ল্যাটফর্মের সকল দোকান ড্যাশবোর্ড ও POS স্ক্রিনে জরুরি নোটিশ বা এনাউন্সমেন্ট প্রচার করুন'
      )}

      <div style={{ maxWidth: '750px', background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MdCampaign color="#ef4444" size={24} /> নোটিশ বার্তা তৈরি করুন
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
              নোটিশ মেসেজ (বাংলা বা ইংরেজিতে) *
            </label>
            <textarea
              rows={4}
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              placeholder="যেমন: সম্মানিত গ্রাহক, আজ রাত ১২:০০ টা থেকে ১:০০ টা পর্যন্ত সিস্টেম আপগ্রেড চলবে। সাময়িক অসুবিধার জন্য দুঃখিত।"
              style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', lineHeight: '1.6' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>নোটিশ টাইপ</label>
              <select
                value={broadcastType}
                onChange={(e) => setBroadcastType(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
              >
                <option value="info">তথ্যমূলক (Info - নীল)</option>
                <option value="warning">সতর্কবার্তা (Warning - হলুদ)</option>
                <option value="alert">জরুরি অ্যালার্ট (Alert - লাল)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>প্রচার স্ট্যাটাস</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '38px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isBroadcastActive}
                  onChange={(e) => setIsBroadcastActive(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '14px', fontWeight: '700', color: isBroadcastActive ? '#059669' : '#64748b' }}>
                  {isBroadcastActive ? '● সক্রিয় (সরাসরি দেখা যাবে)' : 'নিষ্ক্রিয়'}
                </span>
              </label>
            </div>
          </div>

          {/* Live Preview */}
          <div style={{ marginTop: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>লাইভ প্রিভিউ:</span>
            <div style={{
              marginTop: '6px',
              padding: '14px 18px',
              borderRadius: '8px',
              background: broadcastType === 'alert' ? '#fee2e2' : broadcastType === 'warning' ? '#fef3c7' : '#eff6ff',
              border: '1px solid',
              borderColor: broadcastType === 'alert' ? '#fca5a5' : broadcastType === 'warning' ? '#fde68a' : '#bfdbfe',
              color: broadcastType === 'alert' ? '#991b1b' : broadcastType === 'warning' ? '#92400e' : '#1e40af',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <MdCampaign size={22} />
              <span>{broadcastText || 'এখানে আপনার নোটিশের প্রিভিউ প্রদর্শিত হবে...'}</span>
            </div>
          </div>

          <button
            onClick={handleSaveBroadcast}
            disabled={savingBroadcast}
            style={{
              marginTop: '10px',
              padding: '12px',
              borderRadius: '8px',
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
            }}
          >
            <MdSend size={18} /> {savingBroadcast ? 'প্রচার হচ্ছে...' : 'সার্বজনীন নোটিশ প্রচার করুন'}
          </button>
        </div>
      </div>
    </div>
  );

  /* =========================================================================================
     VIEW 6: বিলিং ও সাবস্ক্রিপশন (Subscriptions & Plans)
  ========================================================================================= */
  const renderSubscriptionsView = () => (
    <div>
      {renderHeader(
        'বিলিং ও সাবস্ক্রিপশন প্যাকেজ',
        'ক্লায়েন্ট শপ প্যাকেজ টিয়ার, ফিচার সীমা ও সাবস্ক্রিপশন রেভেনিউ ওভারভিউ'
      )}

      {/* Package Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>ছোট ব্যবসার জন্য</span>
          <h3 style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#0f172a' }}>Starter Plan</h3>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#2563eb', margin: '14px 0' }}>৳৯৯৯ <span style={{ fontSize: '13px', color: '#64748b' }}>/মাস</span></div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>✓ ৫০০ টি পণ্য ধারণক্ষমতা</li>
            <li>✓ ২ জন স্টাফ একাউন্ট</li>
            <li>✓ POS বিলিং ও বারকোড প্রিন্ট</li>
            <li>✓ কাস্টমার ও সাপ্লায়ার লেজার</li>
            <li>✓ শেয়ার্ড ক্লাউড ব্যাকআপ</li>
          </ul>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
            নিবন্ধিত: {shops.filter(s => s.packageTier === 'Starter').length} টি দোকান
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '14px', border: '2px solid #2563eb', padding: '24px', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '-11px', right: '20px', background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: '800', padding: '2px 10px', borderRadius: '10px' }}>
            সবচেয়ে জনপ্রিয়
          </span>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase' }}>গ্রোইং স্টোর</span>
          <h3 style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#0f172a' }}>Pro Plan</h3>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#2563eb', margin: '14px 0' }}>৳১,৯৯৯ <span style={{ fontSize: '13px', color: '#64748b' }}>/মাস</span></div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>✓ ৫,০০০ টি পণ্য ধারণক্ষমতা</li>
            <li>✓ ৫ জন স্টাফ একাউন্ট (ক্যাশিয়ার, ম্যানেজার)</li>
            <li>✓ কাস্টমার রিওয়ার্ড ও লয়্যালটি পয়েন্টস</li>
            <li>✓ এসএমএস গেটওয়ে ইন্টিগ্রেশন</li>
            <li>✓ লাভ-ক্ষতি ও ব্যয় বিশ্লেষণ রিপোর্ট</li>
          </ul>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
            নিবন্ধিত: {shops.filter(s => s.packageTier === 'Pro').length} টি দোকান
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px' }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#7c3aed', textTransform: 'uppercase' }}>সুপারশপ ও চেইন স্টোর</span>
          <h3 style={{ fontSize: '20px', fontWeight: '800', marginTop: '4px', color: '#0f172a' }}>Enterprise Plan</h3>
          <div style={{ fontSize: '26px', fontWeight: '800', color: '#7c3aed', margin: '14px 0' }}>৳৪,৯৯৯ <span style={{ fontSize: '13px', color: '#64748b' }}>/মাস</span></div>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', fontSize: '13px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <li>✓ আনলিমিটেড পণ্য ও ইনভেন্টরি</li>
            <li>✓ আনলিমিটেড স্টাফ ও শাখা</li>
            <li>✓ ⚡ ডেডিকেটেড প্রাইভেট ক্লাউড DB</li>
            <li>✓ কাস্টম ডোমেইন সাপোর্ট (shop.com)</li>
            <li>✓ ডেডিকেটেড ভিআইপি সাপোর্ট</li>
          </ul>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
            নিবন্ধিত: {shops.filter(s => s.packageTier === 'Enterprise').length} টি দোকান
          </div>
        </div>
      </div>
    </div>
  );

  /* =========================================================================================
     VIEW 7: অডিট ও অ্যাক্টিভিটি লগ (Audit & Activity Logs)
  ========================================================================================= */
  const renderAuditLogsView = () => (
    <div>
      {renderHeader(
        'অডিট ও অ্যাক্টিভিটি লগ',
        'সুপার এডমিন লগইন, দোকান তৈরি, এসএমএস বরাদ্দ ও কনফিগারেশন পরিবর্তনের হিস্টোরি'
      )}

      <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MdHistoryEdu color="#2563eb" size={22} /> সাম্প্রতিক ইভেন্ট হিস্টোরি
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {shops.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '8px', background: '#f8fafc', fontSize: '13px' }}>
              <div>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>দোকান রেকর্ড: </span>
                <span style={{ color: '#2563eb', fontWeight: '600' }}>{s.shopName || s.name} ({s.id})</span>
                <span style={{ color: '#64748b', marginLeft: '8px' }}>- কোটা: {s.smsBalance || 0} এসএমএস</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                স্ট্যাটাস: <b style={{ color: s.status === 'Suspended' ? '#dc2626' : '#059669' }}>{s.status}</b>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderRadius: '8px', background: '#f8fafc', fontSize: '13px' }}>
            <div>
              <span style={{ fontWeight: '700', color: '#0f172a' }}>সুপার এডমিন সেশন: </span>
              <span style={{ color: '#059669', fontWeight: '600' }}>{currentUser?.email} লগইন করেছেন</span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>আজ</div>
          </div>
        </div>
      </div>
    </div>
  );

  /* =========================================================================================
     VIEW 8: সিস্টেম সেটিংস (System Settings)
  ========================================================================================= */
  const renderSettingsView = () => (
    <div>
      {renderHeader(
        'সিস্টেম সেটিংস ও নিরাপত্তা',
        'গ্লোবাল Cloudinary প্রিসেট, ডেটা ব্যাকআপ কনফিগারেশন ও সিস্টেম ক্যাশ নিয়ন্ত্রণ'
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        {/* Global Cloudinary Preset Settings */}
        <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdCloudUpload color="#7c3aed" size={22} /> গ্লোবাল Cloudinary প্রিসেট ও ব্যাকআপ
            </h3>
            <span style={{ background: '#f5f3ff', color: '#7c3aed', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '700' }}>
              সেন্ট্রাল স্টোরেজ
            </span>
          </div>

          <p style={{ fontSize: '13px', color: '#64748b', lineHeight: '1.5', marginBottom: '16px' }}>
            যেসব ক্লায়েন্ট নিজস্ব Cloudinary প্রিসেট দিবে না, তাদের পণ্যের ছবি এবং সমস্ত ডেটা ব্যাকআপ আপনার এই সেন্ট্রাল Cloudinary স্টোরেজে আইডি অনুযায়ী সেভ হবে।
          </p>

          <form onSubmit={handleSaveCloudinary} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Cloudinary Cloud Name *</label>
              <input
                type="text"
                value={cCloudName}
                onChange={(e) => setCCloudName(e.target.value)}
                placeholder="jekaqst5"
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Image Upload Preset *</label>
              <input
                type="text"
                value={cImagePreset}
                onChange={(e) => setCImagePreset(e.target.value)}
                placeholder="school_preset বা image_preset"
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Data Backup Upload Preset *</label>
              <input
                type="text"
                value={cBackupPreset}
                onChange={(e) => setCBackupPreset(e.target.value)}
                placeholder="school_preset বা backup_preset"
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Backup Target Folder</label>
              <input
                type="text"
                value={cBackupFolder}
                onChange={(e) => setCBackupFolder(e.target.value)}
                placeholder="MahinPOS_Backups"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              <span style={{ fontSize: '11px', color: '#64748b' }}>Cloudinary ফোল্ডার স্ট্রাকচার: `MahinPOS_Backups/&#123;shopId&#125;/&#123;timestamp&#125;.json`</span>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={handleTestCloudinary}
                disabled={testingCloudinary}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '6px',
                  border: '1px solid #7c3aed',
                  background: '#fff',
                  color: '#7c3aed',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {testingCloudinary ? 'পরীক্ষা হচ্ছে...' : '⚡ সংযোগ টেস্ট করুন'}
              </button>
              <button
                type="submit"
                disabled={savingCloudinary}
                style={{
                  flex: 1,
                  padding: '9px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#7c3aed',
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {savingCloudinary ? 'সংরক্ষণ...' : 'সেটিংস সেভ করুন'}
              </button>
            </div>
          </form>
        </div>

        {/* Super Admin Whitelist & Storage Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdSecurity color="#2563eb" size={20} /> অনুমোদিত সুপার এডমিন ইমেইল
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px', lineHeight: '1.5' }}>
              নিম্নলিখিত ইমেইলগুলো সুপার এডমিন প্রিভিলেজ নিয়ে সম্পূর্ণ প্ল্যাটফর্ম কন্ট্রোল করার অনুমতিপ্রাপ্ত:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div style={{ padding: '8px 12px', background: '#eff6ff', borderRadius: '6px', color: '#1e40af', fontWeight: '700' }}>
                ✓ mahin.webservice@gmail.com (Primary Super Admin)
              </div>
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', color: '#475569', fontWeight: '600' }}>
                ✓ admin@mahinpos.com
              </div>
              <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', color: '#475569', fontWeight: '600' }}>
                ✓ admin@mahinerp.com
              </div>
            </div>
          </div>

          <div style={{ background: '#fff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdSettings color="#64748b" size={20} /> সিস্টেম ক্যাশ ও স্টোরেজ
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px', lineHeight: '1.5' }}>
              প্রয়োজনে স্থানীয় ব্রাউজার সেশন ও ক্যাশ রিসেট করুন:
            </p>
            <button
              onClick={() => {
                sessionStorage.clear();
                localStorage.removeItem('impersonationSession_pos');
                toast.success('স্থানীয় ক্যাশ পরিষ্কার করা হয়েছে!');
              }}
              style={{
                padding: '10px 16px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#334155',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              ব্রাউজার ক্যাশ রিসেট করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Route-Based Dynamic Content */}
      {currentPath === '/super-admin' && renderOverview()}
      {currentPath === '/super-admin/shops' && renderShopsView()}
      {currentPath === '/super-admin/hybrid-db' && renderHybridDbView()}
      {currentPath === '/super-admin/sms-gateway' && renderSmsGatewayView()}
      {currentPath === '/super-admin/broadcasts' && renderBroadcastsView()}
      {currentPath === '/super-admin/subscriptions' && renderSubscriptionsView()}
      {currentPath === '/super-admin/audit-logs' && renderAuditLogsView()}
      {currentPath === '/super-admin/settings' && renderSettingsView()}

      {/* SMS Quota Allocation Modal */}
      {smsModalShop && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                💬 এসএমএস কোটা বরাদ্দ ও নিয়ন্ত্রণ
              </h3>
              <button onClick={() => setSmsModalShop(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <MdClose size={22} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              দোকান: <b>{smsModalShop.shopName || smsModalShop.name}</b> ({smsModalShop.id})
            </div>

            <form onSubmit={handleSaveSmsAllocation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>
                  এসএমএস ব্যালেন্স (সংখ্যা)
                </label>
                <input
                  type="number"
                  value={smsNewBalance}
                  onChange={(e) => setSmsNewBalance(e.target.value)}
                  required
                  min="0"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '16px', fontWeight: '700' }}
                />
              </div>

              {/* Quick Add Pills */}
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>কুইক অ্যাড:</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {[50, 100, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setSmsNewBalance(prev => Number(prev) + amt)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#f1f5f9',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer'
                      }}
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>
                  এসএমএস সার্ভিস স্ট্যাটাস
                </label>
                <select
                  value={smsNewStatus}
                  onChange={(e) => setSmsNewStatus(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="Active">সক্রিয় (Active) - এসএমএস পাঠানো যাবে</option>
                  <option value="Suspended">স্থগিত (Suspended) - এসএমএস সার্ভিস ব্লক থাকবে</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSmsModalShop(null)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={updatingSms}
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '700' }}
                >
                  {updatingSms ? 'সেভ হচ্ছে...' : 'বরাদ্দ নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Onboard New Shop Modal */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            width: '100%',
            maxWidth: '520px',
            borderRadius: '16px',
            padding: '28px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                নতুন দোকান অনবোর্ড করুন
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <MdClose size={24} />
              </button>
            </div>

            <form onSubmit={handleCreateShop} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  দোকান কোড / ID (Unique Code) *
                </label>
                <input
                  type="text"
                  value={shopCode}
                  onChange={(e) => setShopCode(e.target.value)}
                  placeholder="যেমন: mahin বা thakurgaon-store"
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>ছোট হাতের ইংরেজি ও হাইফেন দিন (যেমন: shop101)</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  দোকানের নাম *
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="যেমন: মায়িশা সুপার স্টোর"
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  মালিকের ইমেইল *
                </label>
                <input
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="owner@example.com"
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  লগইন পাসওয়ার্ড (Password) *
                </label>
                <input
                  type="text"
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="যেমন: 12345678"
                  required
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>এই পাসওয়ার্ড দিয়ে ক্লায়েন্ট লগইন করবেন (কমপক্ষে ৬ অক্ষর)</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                  মোবাইল নম্বর
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01700000000"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>প্যাকেজ</label>
                  <select
                    value={packageTier}
                    onChange={(e) => {
                      setPackageTier(e.target.value);
                      if (e.target.value === 'Starter') setMaxProducts(500);
                      else if (e.target.value === 'Pro') setMaxProducts(1000);
                      else setMaxProducts(5000);
                    }}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px' }}
                  >
                    <option value="Starter">Starter (৫০০ পণ্য)</option>
                    <option value="Pro">Pro (১০০০ পণ্য)</option>
                    <option value="Enterprise">Enterprise (৫০০০+ পণ্য)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>প্রাথমিক ফ্রি এসএমএস কোটা</label>
                  <input
                    type="number"
                    value={initialSmsQuota}
                    onChange={(e) => setInitialSmsQuota(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '14px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontWeight: '600' }}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    padding: '9px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#ef4444',
                    color: '#fff',
                    fontWeight: '700',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {submitting ? 'অনবোর্ড হচ্ছে...' : 'অনবোর্ড নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Management & Reset Modal */}
      {passwordModalShop && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '20px 24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ background: '#ffedd5', color: '#ea580c', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                  <MdVpnKey size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                    ক্লায়েন্ট পাসওয়ার্ড নিয়ন্ত্রণ ও রিসেট
                  </h3>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    দোকান: <b>{passwordModalShop.shopName || passwordModalShop.name}</b> (ID: {passwordModalShop.id})
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordModalShop(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <MdClose size={22} />
              </button>
            </div>

            {/* Client Info Card */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>মালিকের ইমেইল:</span>
                <span style={{ fontWeight: '700', color: '#0f172a' }}>{passwordModalShop.ownerEmail}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                <span style={{ color: '#64748b' }}>সেট করা পাসওয়ার্ড:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <code style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: '4px', fontWeight: '700', color: '#0f172a' }}>
                    {passwordModalShop.tempPassword || 'সেট করা নেই'}
                  </code>
                  {passwordModalShop.tempPassword && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(passwordModalShop.tempPassword);
                        toast.success('পাসওয়ার্ড কপি করা হয়েছে!');
                      }}
                      title="কপি করুন"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '2px' }}
                    >
                      <MdContentCopy size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Option 1: 1-Click Send Reset Link via Email */}
            <div style={{ border: '1px solid #e0e7ff', background: '#eef2ff', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <MdSend color="#4f46e5" size={18} />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#312e81' }}>
                  পদ্ধতি ১: ইমেইলে পাসওয়ার্ড রিসেট লিঙ্ক পাঠান
                </h4>
              </div>
              <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#4338ca', lineHeight: '1.4' }}>
                ক্লায়েন্টের ইমেইলে একটি অফিসিয়াল পাসওয়ার্ড রিসেট লিঙ্ক যাবে। সেখানে ক্লিক করে ক্লায়েন্ট নিজের ইচ্ছেমতো নতুন পাসওয়ার্ড সেট করতে পারবেন।
              </p>
              <button
                type="button"
                onClick={() => handleAdminSendResetEmail(passwordModalShop)}
                disabled={sendingResetLink}
                style={{
                  width: '100%',
                  padding: '9px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#4f46e5',
                  color: '#fff',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: sendingResetLink ? 'not-allowed' : 'pointer'
                }}
              >
                {sendingResetLink ? 'পাঠানো হচ্ছে...' : '📩 ইমেইলে পাসওয়ার্ড রিসেট লিঙ্ক পাঠান'}
              </button>
            </div>

            {/* Option 2: Direct Set / Create Password */}
            <form onSubmit={handleAdminSetNewPassword} style={{ border: '1px solid #fed7aa', background: '#fffbeb', padding: '16px', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <MdVpnKey color="#d97706" size={18} />
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#78350f' }}>
                  পদ্ধতি ২: সরাসরি নতুন পাসওয়ার্ড দিয়ে একাউন্ট সক্রিয় / আপডেট করুন
                </h4>
              </div>
              <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#92400e', lineHeight: '1.4' }}>
                ক্লায়েন্ট যদি একাউন্ট তৈরি করতে না পারে বা পাসওয়ার্ড ভুলে যায়, সরাসরি একটি পাসওয়ার্ড দিয়ে একাউন্ট সক্রিয় বা পাসওয়ার্ড আপডেট করে দিন।
              </p>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#78350f' }}>
                  নতুন পাসওয়ার্ড (Password)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    placeholder="কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড"
                    required
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d97706',
                      background: '#fff',
                      fontSize: '13px'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rand = Math.floor(10000000 + Math.random() * 90000000).toString();
                      setAdminNewPassword(rand);
                    }}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    🎲 র‍্যান্ডম
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="submit"
                  disabled={settingNewPassword}
                  style={{
                    flex: 1,
                    padding: '9px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#d97706',
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '13px',
                    cursor: settingNewPassword ? 'not-allowed' : 'pointer'
                  }}
                >
                  {settingNewPassword ? 'সেভ হচ্ছে...' : '💾 পাসওয়ার্ড সেট ও একাউন্ট সক্রিয় করুন'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = `দোকানের লগইন তথ্য:\nওয়েবসাইট: https://mahinpos.pages.dev/poserp\nইমেইল: ${passwordModalShop.ownerEmail}\nপাসওয়ার্ড: ${adminNewPassword}`;
                    navigator.clipboard.writeText(text);
                    toast.success('ক্লায়েন্টের লগইন তথ্য ক্লিপবোর্ডে কপি করা হয়েছে!');
                  }}
                  title="লগইন তথ্য কপি করুন"
                  style={{
                    padding: '9px 14px',
                    borderRadius: '6px',
                    border: '1px solid #d97706',
                    background: '#fff',
                    color: '#b45309',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MdContentCopy size={15} /> কপি
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
