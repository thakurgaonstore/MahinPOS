import React, { useState, useEffect } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { sendShopSMS } from '../../utils/smsHelper';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  MdNotificationsActive,
  MdSms,
  MdReceipt,
  MdLocalShipping,
  MdRequestQuote,
  MdCampaign,
  MdHistory,
  MdSave,
  MdSend,
  MdCheckCircle,
  MdSettings,
  MdSearch
} from 'react-icons/md';

const DEFAULT_INVOICE_TEMPLATE =
  'ধন্যবাদ {customerName}! {shopName} থেকে আপনার বিল #{invoiceNo} মোট {grandTotal}৳ (জমা: {paidAmount}৳, বাকি: {dueAmount}৳)।';

const DEFAULT_CUSTOMER_DUE_TEMPLATE =
  'প্রিয় {name}, {shopName}-এ আপনার পূর্বের {due}৳ বাকি রয়েছে। অনুগ্রহ করে সুবিধামতো পরিশোধ করার অনুরোধ রইল। ধন্যবাদ।';

const DEFAULT_SUPPLIER_TEMPLATE =
  'আসসালামু আলাইকুম {name}, {shopName} থেকে আপনার বর্তমান হিসাব অনুযায়ী মোট পাওনা {due}৳। ধন্যবাদ।';

const DEFAULT_PROMO_TEMPLATE =
  '🎉 বিশেষ অফার! {shopName}-এ চলছে আকর্ষণীয় মূল্যছাড়! আজই চলে আসুন এবং সাশ্রয়ী মূল্যে আপনার পছন্দের পণ্য কিনুন।';

const NotificationCenter = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [activeTab, setActiveTab] = useState('invoice_sms'); // 'invoice_sms' | 'supplier_sms' | 'customer_due' | 'promo_sms' | 'logs'
  const [shopConfig, setShopConfig] = useState({});
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [smsLogs, setSmsLogs] = useState([]);

  // 1. Invoice SMS Settings state
  const [invoiceSmsEnabled, setInvoiceSmsEnabled] = useState(false);
  const [invoiceSmsTemplate, setInvoiceSmsTemplate] = useState(DEFAULT_INVOICE_TEMPLATE);
  const [invoiceSmsOnlyWithDue, setInvoiceSmsOnlyWithDue] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // 2. Supplier SMS state
  const [suppSearch, setSuppSearch] = useState('');
  const [suppDueOnly, setSuppDueOnly] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);
  const [supplierMessage, setSupplierMessage] = useState(DEFAULT_SUPPLIER_TEMPLATE);

  // 3. Customer Due SMS state
  const [custDueSearch, setCustDueSearch] = useState('');
  const [custDueFilterAll, setCustDueFilterAll] = useState(false);
  const [selectedDueCustomerIds, setSelectedDueCustomerIds] = useState([]);
  const [customerDueMessage, setCustomerDueMessage] = useState(DEFAULT_CUSTOMER_DUE_TEMPLATE);

  // 4. Promotional SMS state
  const [promoAudience, setPromoAudience] = useState('all'); // 'all' | 'retail' | 'wholesale' | 'dealer' | 'selected' | 'manual'
  const [promoSearch, setPromoSearch] = useState('');
  const [selectedPromoIds, setSelectedPromoIds] = useState([]);
  const [manualNumbers, setManualNumbers] = useState('');
  const [promoMessage, setPromoMessage] = useState(DEFAULT_PROMO_TEMPLATE);

  // Bulk sending state
  const [sendingBulk, setSendingBulk] = useState(false);
  const [sendProgress, setSendProgress] = useState('');

  useEffect(() => {
    if (!shopId) return;

    const unsubShop = onSnapshot(doc(db, 'shops', shopId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setShopConfig(d);
        if (d.notificationSettings) {
          setInvoiceSmsEnabled(Boolean(d.notificationSettings.invoiceSmsEnabled));
          setInvoiceSmsOnlyWithDue(Boolean(d.notificationSettings.invoiceSmsOnlyWithDue));
          setInvoiceSmsTemplate(d.notificationSettings.invoiceSmsTemplate || DEFAULT_INVOICE_TEMPLATE);
        }
      }
    });

    const unsubCust = onSnapshot(collection(db, 'shops', shopId, 'customers'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (Number(b.dueAmount) || 0) - (Number(a.dueAmount) || 0));
      setCustomers(list);
    });

    const unsubSupp = onSnapshot(collection(db, 'shops', shopId, 'suppliers'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (Number(b.duePayable) || 0) - (Number(a.duePayable) || 0));
      setSuppliers(list);
    });

    const qLogs = query(collection(db, 'shops', shopId, 'smsLogs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSmsLogs(list);
    }, (err) => {
      console.warn('SMS logs listener warning:', err);
    });

    return () => {
      unsubShop();
      unsubCust();
      unsubSupp();
      unsubLogs();
    };
  }, [shopId]);

  const shopName = shopConfig?.shopName || userProfile?.shopName || 'Mahin Shop';
  const smsBalance = shopConfig?.smsBalance !== undefined ? Number(shopConfig.smsBalance) : 0;
  const hasOwnApi = Boolean(shopConfig?.smsApiKey && shopConfig.smsApiKey.trim() !== '');

  // Save Invoice SMS Settings
  const handleSaveInvoiceSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'shops', shopId), {
        notificationSettings: {
          invoiceSmsEnabled,
          invoiceSmsOnlyWithDue,
          invoiceSmsTemplate: invoiceSmsTemplate.trim() || DEFAULT_INVOICE_TEMPLATE,
          updatedAt: new Date().toISOString()
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('ইনভয়েস এসএমএস সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
    } catch (err) {
      console.error('Error saving SMS settings:', err);
      toast.error('সেটিংস সেভ করতে সমস্যা হয়েছে');
    } finally {
      setSavingSettings(false);
    }
  };

  // Helper: Replace template placeholders
  const applyTemplate = (tpl, vars = {}) => {
    let out = tpl || '';
    Object.keys(vars).forEach((k) => {
      out = out.split(`{${k}}`).join(String(vars[k] ?? ''));
    });
    return out;
  };

  // Generic Bulk SMS Dispatcher
  const sendBulkList = async (recipients, buildText, title) => {
    if (recipients.length === 0) {
      toast.error('অন্তত একজন প্রাপক নির্বাচন করুন');
      return;
    }

    setSendingBulk(true);
    let successCount = 0;
    let failCount = 0;
    let lastError = '';

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      setSendProgress(`${i + 1} / ${recipients.length} পাঠানো হচ্ছে (${r.name || r.phone})...`);
      const text = buildText(r);
      const res = await sendShopSMS(shopId, r.phone, text, title);
      if (res?.success) {
        successCount++;
      } else {
        failCount++;
        lastError = res?.message || 'অজানা ত্রুটি';
      }
    }

    setSendingBulk(false);
    setSendProgress('');

    if (successCount > 0 && failCount === 0) {
      toast.success(`সফল! ${successCount} টি এসএমএস পাঠানো হয়েছে।`);
    } else if (successCount > 0 && failCount > 0) {
      toast.success(`${successCount} টি সফল, ${failCount} টি ব্যর্থ (${lastError})`);
    } else {
      toast.error(`এসএমএস পাঠানো যায়নি: ${lastError}`);
    }
  };

  // Filtered Suppliers
  const validSuppliers = suppliers.filter((s) => {
    if (!s.phone || s.phone.trim().length < 10) return false;
    if (suppDueOnly && (Number(s.duePayable) || 0) <= 0) return false;
    if (!suppSearch.trim()) return true;
    const q = suppSearch.toLowerCase();
    return (s.name || '').toLowerCase().includes(q) || (s.company || '').toLowerCase().includes(q) || (s.phone || '').includes(q);
  });

  // Filtered Customers for Due Reminder
  const validDueCustomers = customers.filter((c) => {
    if (!c.phone || c.phone.trim().length < 10) return false;
    if (!custDueFilterAll && (Number(c.dueAmount) || 0) <= 0) return false;
    if (!custDueSearch.trim()) return true;
    const q = custDueSearch.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
  });

  // Filtered Customers for Promo
  const validPromoCustomers = customers.filter((c) => {
    if (!c.phone || c.phone.trim().length < 10) return false;
    if (!promoSearch.trim()) return true;
    const q = promoSearch.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').includes(q);
  });

  const handleSendSupplierSMS = () => {
    const targets = validSuppliers.filter((s) => selectedSupplierIds.includes(s.id));
    sendBulkList(
      targets,
      (s) =>
        applyTemplate(supplierMessage, {
          name: s.name || '',
          company: s.company || '',
          due: Number(s.duePayable) || 0,
          shopName
        }),
      'Supplier Notification'
    );
  };

  const handleSendCustomerDueSMS = () => {
    const targets = validDueCustomers.filter((c) => selectedDueCustomerIds.includes(c.id));
    sendBulkList(
      targets,
      (c) =>
        applyTemplate(customerDueMessage, {
          name: c.name || '',
          due: Number(c.dueAmount) || 0,
          phone: c.phone || '',
          shopName
        }),
      'Customer Due Reminder'
    );
  };

  const handleSendPromoSMS = () => {
    let targets = [];
    if (promoAudience === 'manual') {
      const nums = manualNumbers
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter((n) => n.length >= 10);
      targets = nums.map((phone, idx) => ({ id: `m_${idx}`, name: 'প্রিয় গ্রাহক', phone }));
    } else if (promoAudience === 'selected') {
      targets = validPromoCustomers.filter((c) => selectedPromoIds.includes(c.id));
    } else if (promoAudience === 'all') {
      targets = customers.filter((c) => c.phone && c.phone.trim().length >= 10);
    } else {
      targets = customers.filter(
        (c) => c.phone && c.phone.trim().length >= 10 && (c.customerType || 'retail') === promoAudience
      );
    }

    sendBulkList(
      targets,
      (c) =>
        applyTemplate(promoMessage, {
          name: c.name || 'প্রিয় গ্রাহক',
          shopName
        }),
      'Promotional SMS'
    );
  };

  const toggleSelection = (id, list, setList) => {
    if (list.includes(id)) {
      setList(list.filter((item) => item !== id));
    } else {
      setList([...list, id]);
    }
  };

  const toggleAllSelection = (items, selectedIds, setSelectedIds) => {
    const visibleIds = items.map((i) => i.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(selectedIds.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds([...new Set([...selectedIds, ...visibleIds])]);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <MdNotificationsActive color="#2563eb" /> নোটিফিকেশন ও এসএমএস সেন্টার (Notification Center)
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
            অটো ইনভয়েস এসএমএস সেটিংস, মহাজন বার্তা, কাস্টমার বাকি তাগাদা ও প্রমোশনাল মেসেজ পাঠান
          </p>
        </div>

        {/* SMS Balance Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{
            background: hasOwnApi ? '#ecfdf5' : '#eff6ff',
            border: `1px solid ${hasOwnApi ? '#a7f3d0' : '#bfdbfe'}`,
            padding: '8px 14px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: '700',
            color: hasOwnApi ? '#047857' : '#1d4ed8'
          }}>
            <MdSms size={18} />
            {hasOwnApi ? (
              <span>নিজস্ব Bulk SMS API সক্রিয়</span>
            ) : (
              <span>সেন্ট্রাল SMS ব্যালেন্স: {smsBalance} টি</span>
            )}
          </div>
          <Link
            to="/dashboard/settings"
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontWeight: '700',
              fontSize: '12px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <MdSettings size={16} /> গেটওয়ে / API সেটিংস
          </Link>
        </div>
      </div>

      {/* Sending Progress Banner */}
      {sendingBulk && (
        <div style={{
          background: '#eff6ff',
          border: '1.5px solid #2563eb',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '16px',
          color: '#1e40af',
          fontWeight: '700',
          fontSize: '13px'
        }}>
          ⏳ {sendProgress || 'এসএমএস পাঠানো হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।'}
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
        {[
          { id: 'invoice_sms', label: '১. ইনভয়েস এসএমএস সেটিংস', icon: <MdReceipt size={16} /> },
          { id: 'supplier_sms', label: '২. মহাজন / সাপ্লায়ার মেসেজ', icon: <MdLocalShipping size={16} /> },
          { id: 'customer_due', label: '৩. কাস্টমার বাকি আদায় মেসেজ', icon: <MdRequestQuote size={16} /> },
          { id: 'promo_sms', label: '৪. প্রমোশনাল / অফার মেসেজ', icon: <MdCampaign size={16} /> },
          { id: 'logs', label: `এসএমএস হিস্ট্রি (${smsLogs.length})`, icon: <MdHistory size={16} /> }
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '9px 15px',
                borderRadius: '10px',
                border: active ? 'none' : '1px solid #cbd5e1',
                background: active ? '#2563eb' : '#ffffff',
                color: active ? '#ffffff' : '#334155',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: active ? '0 4px 6px -1px rgba(37,99,235,0.25)' : 'none'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Invoice SMS Settings */}
      {activeTab === 'invoice_sms' && (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', maxWidth: '760px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
            কাস্টমার ইনভয়েস অটো-এসএমএস সেটিংস
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0' }}>
            POS কাউন্টারে বিল সম্পন্ন হওয়ার সাথে সাথে কাস্টমারের মোবাইলে অটোমেটিক বিল ও বাকির মেসেজ যাবে কিনা তা নিয়ন্ত্রণ করুন।
          </p>

          <form onSubmit={handleSaveInvoiceSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Master Toggle */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderRadius: '10px',
              background: invoiceSmsEnabled ? '#ecfdf5' : '#f8fafc',
              border: `1.5px solid ${invoiceSmsEnabled ? '#10b981' : '#cbd5e1'}`,
              cursor: 'pointer'
            }}>
              <div>
                <div style={{ fontWeight: '800', fontSize: '14px', color: invoiceSmsEnabled ? '#065f46' : '#0f172a' }}>
                  বিক্রয়ের পর অটো ইনভয়েস এসএমএস পাঠান (On / Off)
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  চালু থাকলে নিবন্ধিত কাস্টমারের নম্বরে প্রতিটি বিলের এসএমএস যাবে
                </div>
              </div>
              <input
                type="checkbox"
                checked={invoiceSmsEnabled}
                onChange={(e) => setInvoiceSmsEnabled(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#059669', cursor: 'pointer' }}
              />
            </label>

            {/* Due Only Option */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              color: '#334155'
            }}>
              <input
                type="checkbox"
                checked={invoiceSmsOnlyWithDue}
                onChange={(e) => setInvoiceSmsOnlyWithDue(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              শুধুমাত্র বাকিতে (Due) বিক্রয় হলেই অটো এসএমএস পাঠান (খরচ সাশ্রয়ের জন্য)
            </label>

            {/* Template Editor */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                  ইনভয়েস এসএমএস টেক্সট ফরম্যাট:
                </label>
                <button
                  type="button"
                  onClick={() => setInvoiceSmsTemplate(DEFAULT_INVOICE_TEMPLATE)}
                  style={{ fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontWeight: '600' }}
                >
                  ডিফল্ট টেক্সট রিসেট
                </button>
              </div>

              <textarea
                rows="3"
                value={invoiceSmsTemplate}
                onChange={(e) => setInvoiceSmsTemplate(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '13px', lineHeight: '1.5' }}
              />

              {/* Variable Chips */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {[
                  { key: 'customerName', label: 'কাস্টমার নাম' },
                  { key: 'shopName', label: 'দোকানের নাম' },
                  { key: 'invoiceNo', label: 'ইনভয়েস নং' },
                  { key: 'grandTotal', label: 'মোট বিল' },
                  { key: 'paidAmount', label: 'জমা টাকা' },
                  { key: 'dueAmount', label: 'বাকি টাকা' }
                ].map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => setInvoiceSmsTemplate((prev) => `${prev} {${v.key}}`)}
                    style={{
                      fontSize: '11px',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      borderRadius: '6px',
                      padding: '3px 8px',
                      cursor: 'pointer',
                      fontWeight: '700'
                    }}
                  >
                    + {v.label} ({`{${v.key}}`})
                  </button>
                ))}
              </div>
            </div>

            {/* Live Preview */}
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>নমুনা প্রিভিউ (Preview):</div>
              <div style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>
                {applyTemplate(invoiceSmsTemplate, {
                  customerName: 'রফিকুল ইসলাম',
                  shopName,
                  invoiceNo: '261128101530',
                  grandTotal: '1500',
                  paidAmount: '1000',
                  dueAmount: '500'
                })}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                disabled={savingSettings}
                style={{
                  padding: '10px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#059669',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <MdSave size={18} /> {savingSettings ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Supplier SMS */}
      {activeTab === 'supplier_sms' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Left: Supplier List */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>মহাজন / সাপ্লায়ার তালিকা ({validSuppliers.length})</h3>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={suppDueOnly} onChange={(e) => setSuppDueOnly(e.target.checked)} />
                শুধু পাওনা আছে
              </label>
            </div>

            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <MdSearch size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                value={suppSearch}
                onChange={(e) => setSuppSearch(e.target.value)}
                placeholder="নাম, কোম্পানি বা মোবাইল..."
                style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={validSuppliers.length > 0 && validSuppliers.every((s) => selectedSupplierIds.includes(s.id))}
                  onChange={() => toggleAllSelection(validSuppliers, selectedSupplierIds, setSelectedSupplierIds)}
                />
                সকল সিলেক্ট করুন
              </label>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb' }}>নির্বাচিত: {selectedSupplierIds.length} জন</span>
            </div>

            <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {validSuppliers.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: selectedSupplierIds.includes(s.id) ? '#2563eb' : '#e2e8f0',
                    background: selectedSupplierIds.includes(s.id) ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={selectedSupplierIds.includes(s.id)}
                      onChange={() => toggleSelection(s.id, selectedSupplierIds, setSelectedSupplierIds)}
                    />
                    <div>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{s.phone} {s.company ? `• ${s.company}` : ''}</div>
                    </div>
                  </div>
                  <span style={{ fontWeight: '800', color: (s.duePayable || 0) > 0 ? '#dc2626' : '#059669' }}>
                    {formatCurrency(s.duePayable || 0)}
                  </span>
                </label>
              ))}
              {validSuppliers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                  সঠিক মোবাইল নম্বরসহ কোনো সাপ্লায়ার পাওয়া যায়নি
                </div>
              )}
            </div>
          </div>

          {/* Right: Message Composer */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>মহাজনকে মেসেজ পাঠান</h3>
            <textarea
              rows="4"
              value={supplierMessage}
              onChange={(e) => setSupplierMessage(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '13px', lineHeight: '1.5' }}
            />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { key: 'name', label: 'নাম' },
                { key: 'company', label: 'কোম্পানি' },
                { key: 'due', label: 'বাকি পাওনা' },
                { key: 'shopName', label: 'দোকান' }
              ].map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setSupplierMessage((prev) => `${prev} {${v.key}}`)}
                  style={{ fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontWeight: '600' }}
                >
                  + {v.label} ({`{${v.key}}`})
                </button>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              অক্ষর: {supplierMessage.length} টি | নির্বাচিত মহাজন: <b>{selectedSupplierIds.length} জন</b>
            </div>
            <button
              type="button"
              disabled={sendingBulk || selectedSupplierIds.length === 0}
              onClick={handleSendSupplierSMS}
              style={{
                padding: '11px 18px',
                borderRadius: '8px',
                border: 'none',
                background: selectedSupplierIds.length > 0 ? '#059669' : '#94a3b8',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                cursor: selectedSupplierIds.length > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <MdSend size={17} /> {sendingBulk ? 'পাঠানো হচ্ছে...' : `মহাজনকে SMS পাঠান (${selectedSupplierIds.length} জন)`}
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: Customer Due Reminder SMS */}
      {activeTab === 'customer_due' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Left: Due Customers */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>বাকি কাস্টমার তালিকা ({validDueCustomers.length})</h3>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input type="checkbox" checked={custDueFilterAll} onChange={(e) => setCustDueFilterAll(e.target.checked)} />
                সকল কাস্টমার দেখান
              </label>
            </div>

            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <MdSearch size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                value={custDueSearch}
                onChange={(e) => setCustDueSearch(e.target.value)}
                placeholder="নাম বা মোবাইল নম্বর..."
                style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={validDueCustomers.length > 0 && validDueCustomers.every((c) => selectedDueCustomerIds.includes(c.id))}
                  onChange={() => toggleAllSelection(validDueCustomers, selectedDueCustomerIds, setSelectedDueCustomerIds)}
                />
                সকল সিলেক্ট করুন
              </label>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626' }}>নির্বাচিত: {selectedDueCustomerIds.length} জন</span>
            </div>

            <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {validDueCustomers.map((c) => (
                <label
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: selectedDueCustomerIds.includes(c.id) ? '#dc2626' : '#e2e8f0',
                    background: selectedDueCustomerIds.includes(c.id) ? '#fef2f2' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={selectedDueCustomerIds.includes(c.id)}
                      onChange={() => toggleSelection(c.id, selectedDueCustomerIds, setSelectedDueCustomerIds)}
                    />
                    <div>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{c.name}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{c.phone}</div>
                    </div>
                  </div>
                  <span style={{ fontWeight: '800', color: (c.dueAmount || 0) > 0 ? '#dc2626' : '#059669' }}>
                    {formatCurrency(c.dueAmount || 0)}
                  </span>
                </label>
              ))}
              {validDueCustomers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '13px' }}>
                  বাকি থাকা কোনো কাস্টমার পাওয়া যায়নি
                </div>
              )}
            </div>
          </div>

          {/* Right: Due Reminder Composer */}
          <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>বাকি আদায়ের তাগাদা মেসেজ</h3>
            <textarea
              rows="4"
              value={customerDueMessage}
              onChange={(e) => setCustomerDueMessage(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '13px', lineHeight: '1.5' }}
            />
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                { key: 'name', label: 'কাস্টমার নাম' },
                { key: 'due', label: 'বাকি টাকা' },
                { key: 'shopName', label: 'দোকানের নাম' }
              ].map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setCustomerDueMessage((prev) => `${prev} {${v.key}}`)}
                  style={{ fontSize: '11px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', fontWeight: '600' }}
                >
                  + {v.label} ({`{${v.key}}`})
                </button>
              ))}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              অক্ষর: {customerDueMessage.length} টি | নির্বাচিত কাস্টমার: <b>{selectedDueCustomerIds.length} জন</b>
            </div>
            <button
              type="button"
              disabled={sendingBulk || selectedDueCustomerIds.length === 0}
              onClick={handleSendCustomerDueSMS}
              style={{
                padding: '11px 18px',
                borderRadius: '8px',
                border: 'none',
                background: selectedDueCustomerIds.length > 0 ? '#dc2626' : '#94a3b8',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                cursor: selectedDueCustomerIds.length > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <MdSend size={17} /> {sendingBulk ? 'পাঠানো হচ্ছে...' : `বাকি আদায়ের SMS পাঠান (${selectedDueCustomerIds.length} জন)`}
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: Promotional SMS */}
      {activeTab === 'promo_sms' && (
        <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '24px', maxWidth: '820px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
            প্রমোশনাল ও অফার বাল্ক এসএমএস (Promotional Campaign)
          </h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 16px 0' }}>
            দোকানের নতুন অফার, ডিসকাউন্ট বা উৎসবের শুভেচ্ছা সকল কাস্টমার বা নির্দিষ্ট গ্রুপের কাছে পাঠান।
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                কাদেরকে পাঠাতে চান? (Target Audience)
              </label>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'all', label: `সকল কাস্টমার (${customers.filter(c => c.phone?.length >= 10).length})` },
                  { id: 'retail', label: 'শুধুমাত্র খুচরা (Retail)' },
                  { id: 'wholesale', label: 'শুধুমাত্র পাইকারি (Wholesale)' },
                  { id: 'dealer', label: 'শুধুমাত্র ডিলার (Dealer)' },
                  { id: 'selected', label: 'তালিকা হতে সিলেক্ট করুন' },
                  { id: 'manual', label: 'ম্যানুয়াল নম্বর লিখুন' }
                ].map((aud) => (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setPromoAudience(aud.id)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '8px',
                      border: `1.5px solid ${promoAudience === aud.id ? '#7c3aed' : '#cbd5e1'}`,
                      background: promoAudience === aud.id ? '#f5f3ff' : '#ffffff',
                      color: promoAudience === aud.id ? '#6d28d9' : '#475569',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    {aud.label}
                  </button>
                ))}
              </div>
            </div>

            {promoAudience === 'selected' && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', background: '#f8fafc' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={promoSearch}
                    onChange={(e) => setPromoSearch(e.target.value)}
                    placeholder="কাস্টমার খুঁজুন..."
                    style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', width: '220px' }}
                  />
                  <button
                    type="button"
                    onClick={() => toggleAllSelection(validPromoCustomers, selectedPromoIds, setSelectedPromoIds)}
                    style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    সকল সিলেক্ট / বাতিল ({selectedPromoIds.length} জন নির্বাচিত)
                  </button>
                </div>
                <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px' }}>
                  {validPromoCustomers.map((c) => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedPromoIds.includes(c.id)}
                        onChange={() => toggleSelection(c.id, selectedPromoIds, setSelectedPromoIds)}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name} ({c.phone})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {promoAudience === 'manual' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  মোবাইল নম্বরসমূহ (কমা বা নতুন লাইনে লিখুন):
                </label>
                <textarea
                  rows="3"
                  value={manualNumbers}
                  onChange={(e) => setManualNumbers(e.target.value)}
                  placeholder="01711000000, 01811000000"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                প্রমোশনাল মেসেজ লিখুন:
              </label>
              <textarea
                rows="4"
                value={promoMessage}
                onChange={(e) => setPromoMessage(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #94a3b8', fontSize: '13px', lineHeight: '1.5' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '11px', color: '#64748b', flexWrap: 'wrap', gap: '8px' }}>
                <span>অক্ষর: {promoMessage.length} টি (বাংলা ইউনিকোডে প্রতি ৭০ অক্ষরে ১টি SMS)</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => setPromoMessage(DEFAULT_PROMO_TEMPLATE)} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '11px' }}>
                    অফার টেমপ্লেট
                  </button>
                  <button type="button" onClick={() => setPromoMessage((p) => `${p} {name}`)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', fontSize: '11px' }}>
                    + কাস্টমার নাম
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={sendingBulk}
              onClick={handleSendPromoSMS}
              style={{
                padding: '11px 22px',
                borderRadius: '8px',
                border: 'none',
                background: '#7c3aed',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: 'fit-content'
              }}
            >
              <MdSend size={17} /> {sendingBulk ? 'পাঠানো হচ্ছে...' : 'প্রমোশনাল SMS পাঠান'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: SMS Logs */}
      {activeTab === 'logs' && (
        <div className="table-responsive">
          <table className="pos-table">
            <thead>
              <tr>
                <th>তারিখ ও সময়</th>
                <th>ধরন (Title)</th>
                <th>প্রাপক নম্বর</th>
                <th>মেসেজ</th>
                <th>স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody>
              {smsLogs.map((log) => (
                <tr key={log.id}>
                  <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{formatDateTime(log.timestamp)}</td>
                  <td style={{ fontSize: '12px', fontWeight: '700' }}>{log.title || 'SMS'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{log.to}</td>
                  <td style={{ fontSize: '12px', maxWidth: '380px' }}>{log.text}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: log.status === 'Delivered' ? '#dcfce7' : '#fee2e2',
                      color: log.status === 'Delivered' ? '#15803d' : '#dc2626'
                    }}>
                      {log.status === 'Delivered' ? 'পাঠানো হয়েছে' : 'ব্যর্থ'}
                    </span>
                  </td>
                </tr>
              ))}
              {smsLogs.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    এখনো কোনো এসএমএস পাঠানো হয়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
