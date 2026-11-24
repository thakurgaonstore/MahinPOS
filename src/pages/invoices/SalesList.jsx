import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit, getDoc, doc, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import InvoiceViewModal from './InvoiceViewModal';
import ProductReturnModal from './ProductReturnModal';
import {
  MdSearch,
  MdPrint,
  MdFileDownload,
  MdAssignmentReturn,
  MdCalendarToday,
  MdTrendingUp,
  MdCheckCircle,
  MdDateRange,
  MdDeleteSweep
} from 'react-icons/md';
import * as XLSX from 'xlsx';
import DataArchiveModal from '../settings/DataArchiveModal';

const SalesList = ({ defaultTab }) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isReturnMode = defaultTab === 'return' || searchParams.get('tab') === 'return' || location.pathname.includes('/returns');

  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';
  const role = userProfile?.role || 'cashier';
  const isOwner = role === 'shop_admin' || role === 'manager' || userProfile?.isImpersonating;

  const [sales, setSales] = useState([]);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('All');
  const [timeFilter, setTimeFilter] = useState(isReturnMode ? 'all' : 'today'); // 'today' | 'month' | 'year' | 'all' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [viewFilter, setViewFilter] = useState(isReturnMode ? 'returns' : 'all'); // 'all' | 'returns'

  // Pagination (100 records = 4 pages of 25 items)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    setCurrentPage(1);
  }, [timeFilter, search, filterPayment, viewFilter]);

  // Return Counter direct search
  const [returnSearchNo, setReturnSearchNo] = useState('');
  const [isSearchingReturn, setIsSearchingReturn] = useState(false);
  const returnInputRef = useRef(null);

  const [viewInvoice, setViewInvoice] = useState(null);
  const [returnInvoice, setReturnInvoice] = useState(null);
  const [shopConfig, setShopConfig] = useState(null);

  // Auto focus return input if in return mode
  useEffect(() => {
    if (isReturnMode && returnInputRef.current) {
      returnInputRef.current.focus();
    }
  }, [isReturnMode]);

  // Direct Invoice Lookup for Return & Refund (Checks loaded sales first, then Firestore directly)
  const handleDirectReturnSearch = async (e) => {
    if (e) e.preventDefault();
    const cleanNo = returnSearchNo.trim().replace(/^#/, '');
    if (!cleanNo) {
      toast.error('অনুগ্রহ করে ইনভয়েস নম্বরটি লিখুন বা স্ক্যান করুন');
      return;
    }

    // 1. First check loaded sales
    const match = sales.find(s => 
      String(s.invoiceNo || '').replace(/^#/, '').toLowerCase() === cleanNo.toLowerCase() ||
      String(s.id || '').toLowerCase() === cleanNo.toLowerCase()
    );

    if (match) {
      if (match.returnStatus === 'full') {
        toast.error(`ইনভয়েস #${match.invoiceNo} এর সকল পণ্য ইতোমধ্যে সম্পূর্ণ ফেরত দেওয়া হয়েছে`);
      }
      setReturnInvoice(match);
      toast.success(`ইনভয়েস #${match.invoiceNo} পাওয়া গেছে!`);
      return;
    }

    // 2. Query Firestore directly for old / archived invoices not in the latest 150 loaded list
    setIsSearchingReturn(true);
    try {
      const salesRef = collection(db, 'shops', shopId, 'sales');
      // Search exact cleanNo
      let qSales = query(salesRef, where('invoiceNo', '==', cleanNo));
      let snap = await getDocs(qSales);

      if (snap.empty) {
        // Search with #
        qSales = query(salesRef, where('invoiceNo', '==', '#' + cleanNo));
        snap = await getDocs(qSales);
      }

      if (snap.empty) {
        // Try doc ID
        const docSnap = await getDoc(doc(db, 'shops', shopId, 'sales', cleanNo));
        if (docSnap.exists()) {
          const docData = { id: docSnap.id, ...docSnap.data() };
          if (docData.returnStatus === 'full') {
            toast.error(`ইনভয়েস #${docData.invoiceNo} ইতোমধ্যে সম্পূর্ণ ফেরত দেওয়া হয়েছে`);
          }
          setReturnInvoice(docData);
          toast.success(`ইনভয়েস #${docData.invoiceNo} পাওয়া গেছে!`);
          setIsSearchingReturn(false);
          return;
        }
      }

      if (!snap.empty) {
        const docData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        if (docData.returnStatus === 'full') {
          toast.error(`ইনভয়েস #${docData.invoiceNo} ইতোমধ্যে সম্পূর্ণ ফেরত দেওয়া হয়েছে`);
        }
        setReturnInvoice(docData);
        toast.success(`ইনভয়েস #${docData.invoiceNo} পাওয়া গেছে!`);
      } else {
        toast.error(`দুঃখিত, "${cleanNo}" নম্বরের কোনো ইনভয়েস খুঁজে পাওয়া যায়নি`);
      }
    } catch (err) {
      console.error("Direct return search error:", err);
      toast.error('ইনভয়েস খুঁজতে সমস্যা হয়েছে');
    } finally {
      setIsSearchingReturn(false);
    }
  };

  useEffect(() => {
    if (!shopId) return;

    // Fast loading and low quota: limit to 100 records
    const fetchLimit = 100;
    const ref = collection(db, 'shops', shopId, 'sales');
    const q = query(ref, orderBy('createdAt', 'desc'), limit(fetchLimit));

    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSales(list);
    });

    const fetchConfig = async () => {
      const s = await getDoc(doc(db, 'shops', shopId));
      if (s.exists()) setShopConfig(s.data());
    };
    fetchConfig();

    return () => unsub();
  }, [shopId, timeFilter]);

  // Date Filtering logic
  const now = new Date();
  const isMatchDate = (d) => {
    if (!d) return true;
    const date = d.toDate ? d.toDate() : new Date(d);
    if (isNaN(date.getTime())) return true;

    if (timeFilter === 'today') {
      return date.toDateString() === now.toDateString();
    }
    if (timeFilter === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (timeFilter === 'year') {
      return date.getFullYear() === now.getFullYear();
    }
    if (timeFilter === 'custom') {
      if (customStartDate && date < new Date(customStartDate + 'T00:00:00')) return false;
      if (customEndDate && date > new Date(customEndDate + 'T23:59:59')) return false;
      return true;
    }
    return true; // 'all'
  };

  const filteredSales = sales.filter((s) => {
    if (!isMatchDate(s.createdAt)) return false;
    if (viewFilter === 'returns' && !(s.isReturned || (Number(s.totalRefundAmount) || 0) > 0 || s.returnStatus)) {
      return false;
    }
    const matchPay = filterPayment === 'All' || s.paymentMethod === filterPayment;
    if (!matchPay) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.invoiceNo || '').toLowerCase().includes(q) ||
      (s.customerName || '').toLowerCase().includes(q) ||
      (s.customerPhone || '').includes(q) ||
      (s.cashierName || '').toLowerCase().includes(q)
    );
  });

  // KPI Calculations
  const grossSales = filteredSales.reduce((sum, s) => sum + (Number(s.grandTotal) || 0), 0);
  const totalRefunds = filteredSales.reduce((sum, s) => sum + (Number(s.totalRefundAmount) || 0), 0);
  const netSales = grossSales - totalRefunds;
  const totalPaid = filteredSales.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
  const totalDue = filteredSales.reduce((sum, s) => sum + (Number(s.dueAmount) || 0), 0);

  // Paginated Slicing (25 per page, up to 4 pages for 100 sales)
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / itemsPerPage));
  const paginatedSales = filteredSales.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const exportExcel = () => {
    const data = filteredSales.map((s, i) => ({
      'নং': i + 1,
      'ইনভয়েস নং': s.invoiceNo,
      'তারিখ': formatDate(s.createdAt),
      'কাস্টমার': s.customerName || 'নগদ ক্রেতা',
      'ফোন': s.customerPhone || '',
      'বিক্রয় টিয়ার': s.pricingTier === 'dealer' ? 'ডিলার' : s.pricingTier === 'wholesale' ? 'পাইকারি' : 'খুচরা',
      'আইটেম সংখ্যা': s.items?.length || 0,
      'সর্বমোট বিল': s.grandTotal || 0,
      'রিটার্ন রিফান্ড': s.totalRefundAmount || 0,
      'নিট বিল': (s.grandTotal || 0) - (s.totalRefundAmount || 0),
      'পরিশোধ': s.paidAmount || 0,
      'বাকি': s.dueAmount || 0,
      'পেমেন্ট মেথড': s.paymentMethod || 'Cash',
      'স্ট্যাটাস': s.returnStatus === 'full' ? 'সম্পূর্ণ ফেরত' : s.returnStatus === 'partial' ? 'আংশিক ফেরত' : 'সম্পন্ন',
      'ক্যাশিয়ার': s.cashierName || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, `MahinPOS_Sales_${timeFilter}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      {/* Top Title & Excel Export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: isReturnMode ? '#be123c' : '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isReturnMode ? '🔄 পণ্য রিটার্ন ও রিফান্ড কাউন্টার' : 'বিক্রয় ও ইনভয়েস হিস্ট্রি'}
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            {isReturnMode
              ? 'গ্রাহকের ফেরত দেওয়া পণ্য গ্রহণ করুন, রিফান্ড হিসাব করুন এবং ইনভেন্টরি স্টক সমন্বয় করুন'
              : 'দৈনিক, মাসিক ও বাৎসরিক বিক্রয়ের হিসাব, ইনভয়েস রিপ্রিন্ট এবং পণ্য রিটার্ন ম্যানেজমেন্ট'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Filter Mode Buttons */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
            <button
              onClick={() => setViewFilter('all')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: viewFilter === 'all' ? '#ffffff' : 'transparent',
                color: viewFilter === 'all' ? '#0f172a' : '#64748b',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: viewFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              🛒 সকল বিক্রয়
            </button>
            <button
              onClick={() => setViewFilter('returns')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: viewFilter === 'returns' ? '#e11d48' : 'transparent',
                color: viewFilter === 'returns' ? '#ffffff' : '#64748b',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: viewFilter === 'returns' ? '0 1px 3px rgba(225,29,72,0.3)' : 'none'
              }}
            >
              🔄 শুধুমাত্র রিটার্নকৃত ({sales.filter(s => s.isReturned || (s.totalRefundAmount || 0) > 0).length})
            </button>
          </div>

          <button
            onClick={exportExcel}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontWeight: '600',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MdFileDownload size={16} /> এক্সেল ডাউনলোড
          </button>

          {isOwner && (
            <button
              type="button"
              onClick={() => setIsArchiveModalOpen(true)}
              title="বিগত বছরের পুরাতন ইনভয়েস ব্যাকআপ নিয়ে ডিলিট ও ডাটাবেস খালি করুন"
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #fed7aa',
                background: '#fff7ed',
                color: '#c2410c',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(194, 65, 12, 0.1)'
              }}
            >
              <MdDeleteSweep size={18} color="#ea580c" /> পুরাতন ইনভয়েস ডিলিট / আর্কাইভ
            </button>
          )}
        </div>
      </div>

      {/* DEDICATED INSTANT RETURN COUNTER (High Visibility Bar) */}
      <div style={{
        background: 'linear-gradient(135deg, #fff1f2 0%, #fff7ed 100%)',
        borderRadius: '14px',
        border: '2px solid #fecdd3',
        padding: '16px 20px',
        marginBottom: '18px',
        boxShadow: isReturnMode ? '0 0 0 3px rgba(225, 29, 72, 0.2), 0 4px 12px rgba(225, 29, 72, 0.1)' : '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🔄</span>
            <span style={{ fontWeight: '800', color: '#9f1239', fontSize: '15px' }}>
              তাৎক্ষণিক পণ্য রিটার্ন ও রিফান্ড সার্চ (Invoice Return Finder)
            </span>
            <span style={{ fontSize: '11px', background: '#ffe4e6', color: '#be123c', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
              যেকোনো তারিখের ইনভয়েস সাপোর্ট
            </span>
          </div>
          <span style={{ fontSize: '12px', color: '#881337' }}>
            💡 বারকোড স্ক্যানার দিয়ে ইনভয়েস বারকোড স্ক্যান করুন অথবা নম্বরটি লিখে এন্টার চাপুন
          </span>
        </div>

        <form onSubmit={handleDirectReturnSearch} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '260px' }}>
            <MdSearch size={22} style={{ position: 'absolute', left: '12px', top: '10px', color: '#e11d48' }} />
            <input
              ref={returnInputRef}
              type="text"
              value={returnSearchNo}
              onChange={(e) => setReturnSearchNo(e.target.value)}
              placeholder="ইনভয়েস নং লিখুন বা স্ক্যান করুন (যেমন: 261124142553 বা 799859)..."
              style={{
                width: '100%',
                padding: '10px 14px 10px 42px',
                borderRadius: '8px',
                border: '1.5px solid #fb7185',
                background: '#ffffff',
                fontSize: '14px',
                fontWeight: '600',
                outline: 'none',
                color: '#0f172a'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isSearchingReturn}
            style={{
              background: 'linear-gradient(135deg, #e11d48, #be123c)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: isSearchingReturn ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 10px rgba(225, 29, 72, 0.3)'
            }}
          >
            <MdAssignmentReturn size={16} />
            <span>{isSearchingReturn ? 'অনুসন্ধান হচ্ছে...' : 'ইনভয়েস বের করে রিটার্ন প্রসেস করুন'}</span>
          </button>
        </form>
      </div>

      {/* Date Range Tabs: দৈনিক, মাসিক, বাৎসরিক, এ পর্যন্ত */}
      <div style={{
        background: '#ffffff',
        padding: '8px 12px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'today', label: '📅 দৈনিক (আজ)' },
            { id: 'month', label: '📆 চলতি মাস' },
            { id: 'year', label: '📈 চলতি বছর' },
            { id: 'all', label: '📊 এ পর্যন্ত (সর্বমোট)' },
            { id: 'custom', label: '🗓️ কাস্টম তারিখ' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: timeFilter === tab.id ? '#2563eb' : '#cbd5e1',
                background: timeFilter === tab.id ? '#eff6ff' : '#ffffff',
                color: timeFilter === tab.id ? '#2563eb' : '#475569',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {timeFilter === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>থেকে:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
            <span style={{ fontSize: '12px', color: '#64748b' }}>পর্যন্ত:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
          </div>
        )}

        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
          ⚡ <span>রিয়েল-টাইম সিঙ্কড ({sales.length} টি রেকর্ড লোড হয়েছে)</span>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>মোট বিক্রয় (Gross Sales)</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(grossSales)}</span>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #fecaca', background: '#fff5f5' }}>
          <span style={{ fontSize: '12px', color: '#dc2626', display: 'block', fontWeight: '700' }}>মোট রিটার্ন (Refunds)</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>- {formatCurrency(totalRefunds)}</span>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #a7f3d0', background: '#f0fdf4' }}>
          <span style={{ fontSize: '12px', color: '#059669', display: 'block', fontWeight: '700' }}>নিট বিক্রয় (Net Sales)</span>
          <span style={{ fontSize: '18px', fontWeight: '900', color: '#059669' }}>{formatCurrency(netSales)}</span>
        </div>
        <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>নগদ / পরিশোধ আদায়</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#2563eb' }}>{formatCurrency(totalPaid)}</span>
        </div>
        <div style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid #fed7aa', background: '#fffaf5' }}>
          <span style={{ fontSize: '12px', color: '#ea580c', display: 'block', fontWeight: '700' }}>বাকি পাওনা</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#ea580c' }}>{formatCurrency(totalDue)}</span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div style={{
        background: '#ffffff',
        padding: '12px 16px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '16px',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <MdSearch size={20} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ইনভয়েস নং বা কাস্টমার ফোন বা নাম দিয়ে খুঁজুন..."
            style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px' }}
          />
        </div>

        <select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', outline: 'none' }}
        >
          <option value="All">সকল পেমেন্ট মেথড</option>
          <option value="Cash">Cash (নগদ)</option>
          <option value="bKash">bKash</option>
          <option value="Nagad">Nagad</option>
          <option value="Card">Card</option>
          <option value="Due">Due (বাকি)</option>
        </select>
      </div>

      {/* Sales Table */}
      <div className="table-responsive">
        <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th>ইনভয়েস নং</th>
              <th>তারিখ ও সময়</th>
              <th>কাস্টমার ও ধরণ</th>
              <th>আইটেম</th>
              <th>মোট বিল</th>
              <th>পরিশোধ</th>
              <th>বাকি</th>
              <th>পদ্ধতি</th>
              <th>স্ট্যাটাস</th>
              <th style={{ textAlign: 'center', width: '190px' }}>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {paginatedSales.map((s) => {
              const isFullReturned = s.returnStatus === 'full';
              const isPartialReturned = s.returnStatus === 'partial';

              return (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td>
                    <span style={{ fontWeight: '700', color: '#2563eb' }}>#{s.invoiceNo}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{formatDateTime(s.createdAt)}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{s.customerName || 'নগদ ক্রেতা'}</div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                      {s.customerPhone && <span style={{ fontSize: '11px', color: '#94a3b8' }}>📱 {s.customerPhone}</span>}
                      {s.pricingTier && s.pricingTier !== 'retail' && (
                        <span style={{
                          fontSize: '10px',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          fontWeight: '800',
                          background: s.pricingTier === 'dealer' ? '#f5f3ff' : '#ecfdf5',
                          color: s.pricingTier === 'dealer' ? '#7c3aed' : '#059669'
                        }}>
                          {s.pricingTier === 'dealer' ? 'ডিলার' : 'পাইকারি'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: '#475569' }}>{s.items?.length || 0} টি</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: '800', color: '#0f172a' }}>{formatCurrency(s.grandTotal)}</div>
                    {s.totalRefundAmount > 0 && (
                      <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: '700' }}>
                        - ফেরত: {formatCurrency(s.totalRefundAmount)}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ color: '#059669', fontWeight: '600' }}>{formatCurrency(s.paidAmount)}</span>
                  </td>
                  <td>
                    {s.dueAmount > 0 ? (
                      <span style={{ color: '#dc2626', fontWeight: '700' }}>{formatCurrency(s.dueAmount)}</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: '12px' }}>পরিশোধিত</span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: s.paymentMethod === 'Due' ? '#fee2e2' : '#eff6ff',
                      color: s.paymentMethod === 'Due' ? '#dc2626' : '#2563eb'
                    }}>
                      {s.paymentMethod}
                    </span>
                  </td>
                  <td>
                    {isFullReturned ? (
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', background: '#fee2e2', color: '#dc2626' }}>
                        সম্পূর্ণ ফেরত
                      </span>
                    ) : isPartialReturned ? (
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '800', background: '#fef3c7', color: '#b45309' }}>
                        আংশিক ফেরত
                      </span>
                    ) : (
                      <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', background: '#ecfdf5', color: '#059669' }}>
                        সম্পন্ন
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        onClick={() => setViewInvoice(s)}
                        title="ইনভয়েস দেখুন বা প্রিন্ট করুন"
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          color: '#0f172a',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <MdPrint size={14} /> প্রিন্ট
                      </button>

                      {!isFullReturned ? (
                        <button
                          onClick={() => setReturnInvoice(s)}
                          title="পণ্য ফেরত ও রিফান্ড দিন"
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid #f87171',
                            background: '#fee2e2',
                            color: '#b91c1c',
                            fontSize: '12px',
                            fontWeight: '800',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <MdAssignmentReturn size={14} /> রিটার্ন
                        </button>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#94a3b8', padding: '4px 6px', fontStyle: 'italic' }}>
                          ফেরত সম্পন্ন
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredSales.length === 0 && (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  কোনো বিক্রয়ের তথ্য পাওয়া যায়নি
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar (25 items per page, up to 4 pages for 100 sales) */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', marginBottom: '24px', flexWrap: 'wrap', gap: '10px', background: '#ffffff', padding: '12px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            দেখানো হচ্ছে {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredSales.length)} / মোট {filteredSales.length} টি ইনভয়েস (পেজ {currentPage} / {totalPages})
          </span>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: currentPage === 1 ? '#f8fafc' : '#ffffff',
                color: currentPage === 1 ? '#94a3b8' : '#334155',
                fontSize: '12px',
                fontWeight: '700',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              পূর্ববর্তী
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: currentPage === pageNum ? '#2563eb' : '#cbd5e1',
                  background: currentPage === pageNum ? '#2563eb' : '#ffffff',
                  color: currentPage === pageNum ? '#ffffff' : '#334155',
                  fontSize: '12px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: currentPage === totalPages ? '#f8fafc' : '#ffffff',
                color: currentPage === totalPages ? '#94a3b8' : '#334155',
                fontSize: '12px',
                fontWeight: '700',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              পরবর্তী
            </button>
          </div>
        </div>
      )}

      {/* Invoice Viewer Modal */}
      {viewInvoice && (
        <InvoiceViewModal
          invoice={viewInvoice}
          shopConfig={shopConfig}
          onClose={() => setViewInvoice(null)}
          initialFormat={viewInvoice.defaultInvoiceFormat || (viewInvoice.pricingTier !== 'retail' ? 'a4' : 'pos')}
        />
      )}

      {/* Product Return & Refund Modal */}
      {returnInvoice && (
        <ProductReturnModal
          shopId={shopId}
          invoice={returnInvoice}
          userProfile={userProfile}
          onClose={() => setReturnInvoice(null)}
        />
      )}

      {/* Archive and Purge Old Invoices Modal */}
      {isArchiveModalOpen && (
        <DataArchiveModal
          shopId={shopId}
          onClose={() => setIsArchiveModalOpen(false)}
        />
      )}
    </div>
  );
};

export default SalesList;
