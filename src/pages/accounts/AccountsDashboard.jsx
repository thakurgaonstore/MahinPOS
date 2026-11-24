import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { Link } from 'react-router-dom';
import {
  MdTrendingUp,
  MdTrendingDown,
  MdAttachMoney,
  MdAccountBalanceWallet,
  MdShoppingCart,
  MdReceipt,
  MdAssignmentReturn,
  MdDateRange,
  MdArchive,
  MdSecurity,
  MdInventory,
  MdLocalShipping,
  MdSearch,
  MdArrowForward
} from 'react-icons/md';
import { getArchivedYearlySummaries } from '../../utils/dataArchiveManager';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const AccountsDashboard = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [stockLogs, setStockLogs] = useState([]);
  const [products, setProducts] = useState([]);
  const [archivedSummaries, setArchivedSummaries] = useState([]);
  const [timeRange, setTimeRange] = useState('today'); // 'today' | 'month' | 'year' | 'all' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Active ledger tab: 'expenses' | 'purchases' | 'cogs'
  const [activeLedgerTab, setActiveLedgerTab] = useState('expenses');
  const [purchaseViewMode, setPurchaseViewMode] = useState('all'); // 'all' (সকল ইনভেন্টরি ও ক্রয়) | 'period' (ফিল্টার অনুযায়ী)
  const [expenseSearch, setExpenseSearch] = useState('');
  const [purchaseSearch, setPurchaseSearch] = useState('');

  const ledgerSectionRef = useRef(null);

  const scrollToLedger = (tab) => {
    setActiveLedgerTab(tab);
    if (ledgerSectionRef.current) {
      ledgerSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (!shopId) return;

    // Load permanent archived yearly summaries
    getArchivedYearlySummaries(shopId).then((summaries) => {
      setArchivedSummaries(summaries || []);
    });

    // Realtime Sales (latest 300)
    const salesQuery = query(collection(db, 'shops', shopId, 'sales'), orderBy('createdAt', 'desc'), limit(300));
    const unsubSales = onSnapshot(salesQuery, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSales(list);
    });

    // Realtime Expenses (latest 300)
    const expQuery = query(collection(db, 'shops', shopId, 'expenses'), orderBy('createdAt', 'desc'), limit(300));
    const unsubExp = onSnapshot(expQuery, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setExpenses(list);
    });

    // Realtime Stock Inward / Purchase Logs (latest 300)
    const stockQuery = query(collection(db, 'shops', shopId, 'stock_logs'), orderBy('createdAt', 'desc'), limit(300));
    const unsubStock = onSnapshot(stockQuery, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setStockLogs(list);
    }, (err) => {
      console.warn("Stock logs listener warning:", err);
    });

    // Realtime Products (for initial stock & excel uploaded products)
    const prodsQuery = query(collection(db, 'shops', shopId, 'products'), limit(300));
    const unsubProds = onSnapshot(prodsQuery, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setProducts(list);
    }, (err) => {
      console.warn("Products listener warning:", err);
    });

    return () => {
      unsubSales();
      unsubExp();
      unsubStock();
      unsubProds();
    };
  }, [shopId]);

  // Date Filtering Helpers
  const now = new Date();

  const isMatchPeriod = (d) => {
    if (!d) return true;
    const date = d.toDate ? d.toDate() : new Date(d);
    if (isNaN(date.getTime())) return true;

    if (timeRange === 'today') {
      return date.toDateString() === now.toDateString();
    }
    if (timeRange === 'month') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    if (timeRange === 'year') {
      return date.getFullYear() === now.getFullYear();
    }
    if (timeRange === 'custom') {
      if (customStartDate && date < new Date(customStartDate + 'T00:00:00')) return false;
      if (customEndDate && date > new Date(customEndDate + 'T23:59:59')) return false;
      return true;
    }
    return true; // 'all'
  };

  const filteredSales = sales.filter((s) => isMatchPeriod(s.createdAt));
  const filteredExpenses = expenses.filter((e) => isMatchPeriod(e.createdAt || e.date));
  const filteredStockLogs = stockLogs.filter((l) => isMatchPeriod(l.createdAt));

  // Financial Calculations (Live Active Records)
  const liveGrossRevenue = filteredSales.reduce((acc, s) => acc + (Number(s.grandTotal) || 0), 0);
  const liveTotalReturns = filteredSales.reduce((acc, s) => acc + (Number(s.totalRefundAmount) || 0), 0);
  const liveNetRevenue = Math.max(0, liveGrossRevenue - liveTotalReturns);

  // Cost of Goods Sold (COGS) & Itemized Map
  let liveCostOfGoods = 0;
  const cogsMap = {};

  filteredSales.forEach((s) => {
    if (s.items && Array.isArray(s.items)) {
      s.items.forEach((item) => {
        const netQty = Math.max(0, (Number(item.quantity) || 0) - (Number(item.returnedQty) || 0));
        const itemCOGS = (Number(item.costPrice) || 0) * netQty;
        liveCostOfGoods += itemCOGS;

        if (netQty > 0) {
          const key = item.productId || item.name;
          if (!cogsMap[key]) {
            cogsMap[key] = {
              name: item.name,
              nameBn: item.nameBn || '',
              unit: item.unit || 'টি',
              quantity: 0,
              costPrice: Number(item.costPrice) || 0,
              sellingPrice: Number(item.price) || 0,
              totalCost: 0,
              totalSales: 0
            };
          }
          cogsMap[key].quantity += netQty;
          cogsMap[key].totalCost += itemCOGS;
          cogsMap[key].totalSales += (Number(item.price) || 0) * netQty;
        }
      });
    }
  });

  const cogsList = Object.values(cogsMap).sort((a, b) => b.totalCost - a.totalCost);

  const liveExpenses = filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const payrollExpenseTotal = filteredExpenses
    .filter((e) => e.category === 'স্টাফ বেতন ও বোনাস' || (e.title && e.title.includes('স্টাফ বেতন')))
    .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  // Category-wise Expense Breakdown
  const expenseByCategory = filteredExpenses.reduce((acc, e) => {
    const cat = e.category || 'অন্যান্য খরচ';
    acc[cat] = (acc[cat] || 0) + (Number(e.amount) || 0);
    return acc;
  }, {});

  // Merge stock_logs and products (for products added via Excel or initial stock without explicit log)
  const productLogIds = new Set(stockLogs.map((l) => l.productId));
  const synthesizedInitialLogs = products
    .filter((p) => !productLogIds.has(p.id) && (Number(p.stock) > 0 || Number(p.costPrice) > 0))
    .map((p) => {
      const qty = Number(p.stock) || 0;
      const cost = Number(p.costPrice) || 0;
      return {
        id: `init_${p.id}`,
        productId: p.id,
        productName: p.name || 'অজানা পণ্য',
        productBarcode: p.barcode || p.sku || '',
        previousStock: 0,
        addedQuantity: qty,
        finalStock: qty,
        unit: p.unit || 'টি',
        previousCostPrice: 0,
        purchaseCostPrice: cost,
        newAverageCostPrice: cost,
        batchTotalCost: qty * cost,
        supplierName: p.supplierName || 'এক্সেল আপলোড / প্রাথমিক মজুদ',
        voucherNo: p.sku || (p.barcode ? 'BAR-' + p.barcode.slice(-6) : 'EXCEL-IMPORT'),
        notes: 'ইনভেন্টরিতে প্রারম্ভিক মজুদ / এক্সেল আপলোড',
        type: 'initial_stock',
        createdAt: p.createdAt || p.updatedAt || new Date()
      };
    });

  const allPurchases = [...stockLogs, ...synthesizedInitialLogs].sort((a, b) => {
    const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
    const db = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
    return db - da;
  });

  const periodStockPurchases = allPurchases.filter((l) => isMatchPeriod(l.createdAt));
  const displayedStockPurchases = purchaseViewMode === 'period' ? periodStockPurchases : allPurchases;

  // Total Purchase Batch Cost in the active view
  const totalPurchaseCost = displayedStockPurchases.reduce((sum, l) => {
    return sum + (Number(l.batchTotalCost) || (Number(l.addedQuantity || 0) * Number(l.purchaseCostPrice || 0)));
  }, 0);

  // Merge permanent archived yearly summaries if applicable ('all' or 'year')
  let archivedGross = 0;
  let archivedReturns = 0;
  let archivedNet = 0;
  let archivedCOGS = 0;
  let archivedExp = 0;
  let archivedProfit = 0;
  let archivedInvoicesCount = 0;

  if (timeRange === 'all') {
    archivedSummaries.forEach((a) => {
      archivedGross += Number(a.grossRevenue) || 0;
      archivedReturns += Number(a.totalReturns) || 0;
      archivedNet += Number(a.netRevenue) || 0;
      archivedCOGS += Number(a.totalCostOfGoods) || 0;
      archivedExp += Number(a.totalExpenses) || 0;
      archivedProfit += Number(a.netProfit) || 0;
      archivedInvoicesCount += Number(a.totalInvoices) || 0;
    });
  } else if (timeRange === 'year') {
    const thisYearArchived = archivedSummaries.find((a) => String(a.year) === String(now.getFullYear()));
    if (thisYearArchived) {
      archivedGross = Number(thisYearArchived.grossRevenue) || 0;
      archivedReturns = Number(thisYearArchived.totalReturns) || 0;
      archivedNet = Number(thisYearArchived.netRevenue) || 0;
      archivedCOGS = Number(thisYearArchived.totalCostOfGoods) || 0;
      archivedExp = Number(thisYearArchived.totalExpenses) || 0;
      archivedProfit = Number(thisYearArchived.netProfit) || 0;
      archivedInvoicesCount = Number(thisYearArchived.totalInvoices) || 0;
    }
  }

  // Final Merged Totals
  const grossRevenue = liveGrossRevenue + archivedGross;
  const totalReturns = liveTotalReturns + archivedReturns;
  const netRevenue = liveNetRevenue + archivedNet;
  const totalCostOfGoods = liveCostOfGoods + archivedCOGS;
  const grossProfit = netRevenue - totalCostOfGoods;
  const totalExpenses = liveExpenses + archivedExp;
  const netProfit = grossProfit - totalExpenses;
  const totalInvoicesCount = filteredSales.length + archivedInvoicesCount;

  // Chart Data: Payment Breakdown
  const paymentBreakdown = {};
  filteredSales.forEach((s) => {
    const m = s.paymentMethod || 'Cash';
    paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (Number(s.grandTotal) || 0);
  });
  const pieData = Object.keys(paymentBreakdown).map((k) => ({ name: k, value: paymentBreakdown[k] }));
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  const barChartData = [
    { name: 'মোট বিক্রয়', amount: grossRevenue },
    { name: 'ফেরত', amount: totalReturns },
    { name: 'নিট বিক্রয়', amount: netRevenue },
    { name: 'ক্রয় খরচ (COGS)', amount: totalCostOfGoods },
    { name: 'দোকান খরচ', amount: totalExpenses },
    { name: 'নিট লাভ', amount: Math.max(0, netProfit) }
  ];

  // Filtered Expense Rows Search
  const searchedExpenses = filteredExpenses.filter((e) => {
    if (!expenseSearch.trim()) return true;
    const q = expenseSearch.toLowerCase();
    return (
      (e.title || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q) ||
      (e.note || '').toLowerCase().includes(q)
    );
  });

  // Filtered Purchase Log Rows Search
  const searchedPurchases = displayedStockPurchases.filter((l) => {
    if (!purchaseSearch.trim()) return true;
    const q = purchaseSearch.toLowerCase();
    return (
      (l.productName || '').toLowerCase().includes(q) ||
      (l.productBarcode || '').includes(q) ||
      (l.supplierName || '').toLowerCase().includes(q) ||
      (l.voucherNo || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Title & Range Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>হিসাব ও লাভ-ক্ষতি রিপোর্ট (Profit & Loss)</h1>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            দৈনিক, মাসিক, বাৎসরিক ও সর্বমোট বিক্রয়, রিটার্ন ও খরচের সমন্বয়ে প্রকৃত লাভ-ক্ষতি
          </p>
        </div>

        {/* Period Selector Tabs: দৈনিক, মাসিক, বাৎসরিক, সর্বমোট */}
        <div style={{
          display: 'flex',
          gap: '6px',
          background: '#ffffff',
          padding: '6px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          flexWrap: 'wrap'
        }}>
          {[
            { id: 'today', label: '📅 দৈনিক (আজ)' },
            { id: 'month', label: '📆 চলতি মাস' },
            { id: 'year', label: '📈 চলতি বছর' },
            { id: 'all', label: '📊 এ পর্যন্ত (সর্বমোট)' },
            { id: 'custom', label: '🗓️ কাস্টম তারিখ' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: timeRange === tab.id ? '#2563eb' : 'transparent',
                color: timeRange === tab.id ? '#ffffff' : '#475569',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Pickers */}
      {timeRange === 'custom' && (
        <div style={{
          background: '#ffffff',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>কাস্টম সময়সীমা:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>হতে:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>পর্যন্ত:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
            />
          </div>
        </div>
      )}

      {/* 6 Key Financial Metrics KPI Grid (Interactive Drill-down) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px',
        marginBottom: '24px'
      }}>
        {/* 1. Gross Revenue */}
        <div
          onClick={() => scrollToLedger('cogs')}
          title="বিক্রিত পণ্যের তালিকা ও বিক্রয় দেখতে ক্লিক করুন"
          style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>১. মোট বিক্রয় (Gross Sales)</span>
            <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '6px', color: '#2563eb' }}><MdShoppingCart size={18} /></div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(grossRevenue)}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>মোট {totalInvoicesCount} টি বিক্রয় ইনভয়েস</span>
        </div>

        {/* 2. Total Returns */}
        <Link to="/dashboard/returns" style={{ textDecoration: 'none' }}>
          <div style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid #fecaca', background: '#fffafa', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626' }}>২. মোট ফেরত (Returns)</span>
              <div style={{ background: '#fee2e2', padding: '6px', borderRadius: '6px', color: '#dc2626' }}><MdAssignmentReturn size={18} /></div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626' }}>- {formatCurrency(totalReturns)}</div>
            <span style={{ fontSize: '11px', color: '#dc2626' }}>গ্রাহককে ফেরত দেওয়া রিফান্ড ↗</span>
          </div>
        </Link>

        {/* 3. Net Revenue */}
        <div style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid #a7f3d0', background: '#f0fdf4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>৩. নিট বিক্রয় (Net Sales)</span>
            <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '6px', color: '#059669' }}><MdTrendingUp size={18} /></div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#059669' }}>{formatCurrency(netRevenue)}</div>
          <span style={{ fontSize: '11px', color: '#059669' }}>মোট বিক্রয় বিয়োগ রিটার্ন</span>
        </div>

        {/* 4. COGS (Clickable to Purchase & Restock Log) */}
        <div
          onClick={() => scrollToLedger('purchases')}
          title="কোন পণ্য কবে ক্রয় ও রিস্টক করা হয়েছে দেখতে ক্লিক করুন"
          style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '2px solid #cbd5e1', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#1e293b' }}>
              ৪. ক্রয় খরচ (COGS) 🔍
            </span>
            <div style={{ background: '#f1f5f9', padding: '6px', borderRadius: '6px', color: '#2563eb' }}><MdInventory size={18} /></div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b' }}>{formatCurrency(totalCostOfGoods)}</div>
          <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: '700' }}>
            👉 পণ্য ক্রয় হিস্ট্রি দেখতে ক্লিক করুন
          </span>
        </div>

        {/* 5. Expenses (Clickable to Detailed Expense Ledger) */}
        <div
          onClick={() => scrollToLedger('expenses')}
          title="কোন খাতে কত খরচ হয়েছে বিস্তারিত দেখতে ক্লিক করুন"
          style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '2px solid #fca5a5', cursor: 'pointer', boxShadow: '0 2px 6px rgba(239,68,68,0.08)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#991b1b' }}>
              ৫. দোকান খরচ (Expenses) 🔍
            </span>
            <div style={{ background: '#fee2e2', padding: '6px', borderRadius: '6px', color: '#dc2626' }}><MdTrendingDown size={18} /></div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#dc2626' }}>{formatCurrency(totalExpenses)}</div>
          <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '700' }}>
            👉 খরচের খাতওয়ারি তালিকা দেখতে ক্লিক করুন
          </span>
        </div>

        {/* 6. Net Profit */}
        <div style={{
          background: '#ffffff',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '2px solid',
          borderColor: netProfit >= 0 ? '#10b981' : '#ef4444',
          boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: netProfit >= 0 ? '#065f46' : '#991b1b' }}>
              ৬. প্রকৃত নিট লাভ (Net Profit)
            </span>
            <div style={{ background: netProfit >= 0 ? '#ecfdf5' : '#fee2e2', padding: '6px', borderRadius: '6px', color: netProfit >= 0 ? '#059669' : '#dc2626' }}>
              <MdAttachMoney size={18} />
            </div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: netProfit >= 0 ? '#059669' : '#dc2626' }}>
            {formatCurrency(netProfit)}
          </div>
          <span style={{ fontSize: '11px', fontWeight: '700', color: netProfit >= 0 ? '#059669' : '#dc2626' }}>
            {netProfit >= 0 ? '✓ নিট মুনাফা' : '✗ নিট ক্ষতি'} (মার্জিন: {netRevenue > 0 ? ((netProfit / netRevenue) * 100).toFixed(1) : 0}%)
          </span>
        </div>
      </div>

      {/* Visual Analysis Chart */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
      }}>
        {/* Comparison Bar */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', color: '#0f172a' }}>
            আয়, রিটার্ন, খরচ ও মুনাফা তুলনা ({timeRange === 'today' ? 'আজকের' : timeRange === 'month' ? 'চলতি মাস' : timeRange === 'year' ? 'চলতি বছর' : 'সর্বমোট'})
          </h3>
          <div style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Pie */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px', color: '#0f172a' }}>
            পেমেন্ট মাধ্যম অনুপাত ({timeRange === 'today' ? 'আজকের' : timeRange === 'month' ? 'চলতি মাস' : timeRange === 'year' ? 'চলতি বছর' : 'সর্বমোট'})
          </h3>
          <div style={{ height: '200px' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>তথ্য নেই</div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          DETAILED TRANSACTION HISTORIES & DRILL-DOWN LEDGERS
      ========================================================================= */}
      <div
        ref={ledgerSectionRef}
        id="transaction-ledger-section"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          marginBottom: '28px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.03)'
        }}
      >
        {/* Ledger Navigation Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdReceipt size={22} color="#2563eb" />
              বিস্তারিত ট্রানজ্যাকশন ও হিসাব অডিট খাতা
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0 0' }}>
              কোন খাতে কত খরচ হয়েছে এবং কোন পণ্য কবে কত টাকায় ক্রয়/রিস্টক করা হয়েছে তার সম্পূর্ণ বিবরণী
            </p>
          </div>

          {/* Ledger Tabs */}
          <div style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveLedgerTab('expenses')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeLedgerTab === 'expenses' ? '#dc2626' : 'transparent',
                color: activeLedgerTab === 'expenses' ? '#ffffff' : '#475569',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MdTrendingDown size={16} /> খরচের বিস্তারিত খাতা ({filteredExpenses.length})
            </button>
            <button
              onClick={() => setActiveLedgerTab('purchases')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeLedgerTab === 'purchases' ? '#2563eb' : 'transparent',
                color: activeLedgerTab === 'purchases' ? '#ffffff' : '#475569',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MdInventory size={16} /> পণ্য ক্রয় ও রিস্টক হিস্ট্রি ({allPurchases.length})
            </button>
            <button
              onClick={() => setActiveLedgerTab('cogs')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: activeLedgerTab === 'cogs' ? '#059669' : 'transparent',
                color: activeLedgerTab === 'cogs' ? '#ffffff' : '#475569',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MdShoppingCart size={16} /> বিক্রীত পণ্যের ক্রয়মূল্য (COGS বিশ্লেষণ)
            </button>
          </div>
        </div>

        {/* -------------------------------------------------------------------------
            TAB 1: EXPENSES BREAKDOWN & TRANSACTION TABLE
        ------------------------------------------------------------------------- */}
        {activeLedgerTab === 'expenses' && (
          <div>
            {/* Category Breakdown Chips */}
            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                খাত অনুযায়ী মোট খরচের বিশ্লেষণ:
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.keys(expenseByCategory).map((cat) => (
                  <div
                    key={cat}
                    style={{
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#9f1239' }}>{cat}:</span>
                    <span style={{ fontSize: '13px', fontWeight: '900', color: '#be123c' }}>{formatCurrency(expenseByCategory[cat])}</span>
                  </div>
                ))}

                {Object.keys(expenseByCategory).length === 0 && (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>নির্বাচিত সময়ে কোনো খরচ রেকর্ড নেই</span>
                )}
              </div>
            </div>

            {/* Filter Search & Manage Link */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ position: 'relative', width: '300px' }}>
                <MdSearch size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder="খরচের খাত বা শিরোনাম দিয়ে খুঁজুন..."
                  style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#dc2626' }}>
                  সর্বমোট খরচ: {formatCurrency(liveExpenses)}
                </span>
                <Link
                  to="/dashboard/expenses"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '12px',
                    fontWeight: '700',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  খরচের খাতা খুলুন / নতুন খরচ যোগ করুন <MdArrowForward size={14} />
                </Link>
              </div>
            </div>

            {/* Expenses Table */}
            <div className="table-responsive">
              <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px' }}>তারিখ</th>
                    <th style={{ padding: '10px' }}>খরচের খাত</th>
                    <th style={{ padding: '10px' }}>বিবরণ / শিরোনাম</th>
                    <th style={{ padding: '10px' }}>নোট / মেমো</th>
                    <th style={{ padding: '10px' }}>এন্ট্রি করেছেন</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>টাকার পরিমাণ (৳)</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedExpenses.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px', color: '#64748b' }}>
                        {formatDate(e.createdAt || e.date)}
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: e.category === 'স্টাফ বেতন ও বোনাস' ? '#f5f3ff' : '#fee2e2',
                          color: e.category === 'স্টাফ বেতন ও বোনাস' ? '#7c3aed' : '#dc2626'
                        }}>
                          {e.category || 'সাধারণ খরচ'}
                        </span>
                      </td>
                      <td style={{ padding: '10px', fontWeight: '700', color: '#0f172a' }}>
                        {e.title}
                      </td>
                      <td style={{ padding: '10px', color: '#64748b', fontSize: '12px' }}>
                        {e.note || '---'}
                      </td>
                      <td style={{ padding: '10px', color: '#475569', fontSize: '12px' }}>
                        {e.recordedBy || 'Admin'}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', fontWeight: '800', color: '#dc2626' }}>
                        {formatCurrency(e.amount)}
                      </td>
                    </tr>
                  ))}

                  {searchedExpenses.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        কোনো খরচের রেকর্ড পাওয়া যায়নি
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------------------
            TAB 2: PRODUCT PURCHASES & RESTOCK AUDIT LOG
        ------------------------------------------------------------------------- */}
        {activeLedgerTab === 'purchases' && (
          <div>
            {/* Purchase Summary Header & Sub-filters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '280px' }}>
                  <MdSearch size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={purchaseSearch}
                    onChange={(e) => setPurchaseSearch(e.target.value)}
                    placeholder="পণ্য, সাপ্লায়ার বা ভাউচার দিয়ে খুঁজুন..."
                    style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                  />
                </div>

                {/* Sub-filter View Mode Toggles */}
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setPurchaseViewMode('all')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: purchaseViewMode === 'all' ? '#2563eb' : 'transparent',
                      color: purchaseViewMode === 'all' ? '#ffffff' : '#475569',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    📦 সকল ইনভেন্টরি ও ক্রয় ({allPurchases.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPurchaseViewMode('period')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: purchaseViewMode === 'period' ? '#2563eb' : 'transparent',
                      color: purchaseViewMode === 'period' ? '#ffffff' : '#475569',
                      fontWeight: '700',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🗓️ ফিল্টারকৃত তারিখের ক্রয় ({periodStockPurchases.length})
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#2563eb', background: '#eff6ff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  {purchaseViewMode === 'all' ? 'সর্বমোট ইনভেন্টরি ক্রয়মূল্য' : 'এই সময়ে ক্রয় চালান'}: {formatCurrency(totalPurchaseCost)}
                </span>
                <Link
                  to="/dashboard/inventory"
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    background: '#2563eb',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: '700',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  পণ্য রিস্টক করুন <MdArrowForward size={14} />
                </Link>
              </div>
            </div>

            {/* Purchases Table */}
            <div className="table-responsive">
              <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px' }}>ক্রয়ের তারিখ ও সময়</th>
                    <th style={{ padding: '10px' }}>পণ্যের নাম ও বারকোড</th>
                    <th style={{ padding: '10px' }}>সোর্স / সাপ্লায়ার</th>
                    <th style={{ padding: '10px' }}>চালান / ভাউচার</th>
                    <th style={{ padding: '10px' }}>ক্রয়ের পরিমাণ</th>
                    <th style={{ padding: '10px' }}>একক ক্রয়মূল্য</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>মোট ক্রয় বিল (৳)</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>নতুন গড় ক্রয়মূল্য</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedPurchases.map((l) => {
                    const batchCost = Number(l.batchTotalCost) || (Number(l.addedQuantity || 0) * Number(l.purchaseCostPrice || 0));

                    return (
                      <tr key={l.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px', color: '#64748b' }}>
                          {formatDateTime(l.createdAt)}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <div style={{ fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            {l.productName}
                            {l.type === 'excel_import' && (
                              <span style={{ fontSize: '10px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                📊 এক্সেল আপলোড
                              </span>
                            )}
                            {l.type === 'initial_stock' && (
                              <span style={{ fontSize: '10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                🌱 প্রাথমিক স্টক
                              </span>
                            )}
                            {l.type === 'restock' && (
                              <span style={{ fontSize: '10px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                                🔄 রিস্টক
                              </span>
                            )}
                          </div>
                          {l.productBarcode && (
                            <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                              #{l.productBarcode}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>
                          {l.supplierName ? (
                            <span style={{ fontWeight: '700', color: '#2563eb' }}>
                              🏭 {l.supplierName}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>সরাসরি ক্রয়</span>
                          )}
                        </td>
                        <td style={{ padding: '10px', color: '#475569', fontSize: '12px' }}>
                          {l.voucherNo ? <b>#{l.voucherNo}</b> : '---'}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span style={{ fontWeight: '800', color: '#059669', background: '#ecfdf5', padding: '2px 8px', borderRadius: '4px' }}>
                            +{l.addedQuantity} {l.unit || 'টি'}
                          </span>
                        </td>
                        <td style={{ padding: '10px', fontWeight: '700', color: '#334155' }}>
                          {formatCurrency(l.purchaseCostPrice || 0)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: '900', color: '#2563eb' }}>
                          {formatCurrency(batchCost)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', fontWeight: '700', color: '#059669' }}>
                          {formatCurrency(l.newAverageCostPrice || l.purchaseCostPrice || 0)}
                        </td>
                      </tr>
                    );
                  })}

                  {searchedPurchases.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                        <div>📦 {purchaseViewMode === 'period' ? 'নির্বাচিত সময়কালে কোনো নতুন পণ্য ক্রয় বা রিস্টক রেকর্ড পাওয়া যায়নি।' : 'কোনো পণ্য ক্রয় বা স্টক তথ্য পাওয়া যায়নি।'}</div>
                        {purchaseViewMode === 'period' && allPurchases.length > 0 && (
                          <div style={{ marginTop: '12px' }}>
                            <button
                              type="button"
                              onClick={() => setPurchaseViewMode('all')}
                              style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: '#eff6ff',
                                border: '1px solid #2563eb',
                                color: '#2563eb',
                                fontWeight: '700',
                                fontSize: '13px',
                                cursor: 'pointer'
                              }}
                            >
                              📦 সকল ইনভেন্টরি পণ্যের ক্রয় তালিকা দেখুন ({allPurchases.length} টি পণ্য)
                            </button>
                          </div>
                        )}
                        <div style={{ fontSize: '12px', marginTop: '8px' }}>
                          পণ্য ক্রয় লিপিবদ্ধ করতে <b>"পণ্য ও ইনভেন্টরি"</b> পেজ থেকে যে কোনো পণ্যের <b>"রিস্টক"</b> বাটনে চাপুন অথবা নতুন পণ্য যোগ/এক্সেল আপলোড করুন।
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------------------
            TAB 3: COGS PRODUCT BREAKDOWN (Products Sold & Their Cost of Goods)
        ------------------------------------------------------------------------- */}
        {activeLedgerTab === 'cogs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>
                নির্বাচিত সময়কালে যে যে পণ্য বিক্রয় হয়ে ক্রয় খরচ (COGS = {formatCurrency(liveCostOfGoods)}) তৈরি করেছে:
              </span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#059669' }}>
                বিক্রীত আইটেমের মোট লাভ: {formatCurrency(liveNetRevenue - liveCostOfGoods)}
              </span>
            </div>

            <div className="table-responsive">
              <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '10px' }}>পণ্যের নাম</th>
                    <th style={{ padding: '10px' }}>বিক্রিত পরিমাণ</th>
                    <th style={{ padding: '10px' }}>গড় ক্রয়মূল্য</th>
                    <th style={{ padding: '10px' }}>মোট ক্রয় খরচ (COGS)</th>
                    <th style={{ padding: '10px' }}>মোট বিক্রয় মূল্য</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>গ্রস মুনাফা (লাভ)</th>
                  </tr>
                </thead>
                <tbody>
                  {cogsList.map((item, idx) => {
                    const itemProfit = item.totalSales - item.totalCost;
                    const margin = item.totalSales > 0 ? Math.round((itemProfit / item.totalSales) * 100) : 0;

                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px' }}>
                          <span style={{ fontWeight: '800', color: '#0f172a' }}>{item.name}</span>
                          {item.nameBn && <div style={{ fontSize: '11px', color: '#64748b' }}>{item.nameBn}</div>}
                        </td>
                        <td style={{ padding: '10px', fontWeight: '700' }}>
                          {item.quantity} {item.unit}
                        </td>
                        <td style={{ padding: '10px', color: '#475569' }}>
                          {formatCurrency(item.costPrice)}
                        </td>
                        <td style={{ padding: '10px', fontWeight: '800', color: '#dc2626' }}>
                          {formatCurrency(item.totalCost)}
                        </td>
                        <td style={{ padding: '10px', fontWeight: '800', color: '#2563eb' }}>
                          {formatCurrency(item.totalSales)}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>
                          <span style={{ fontWeight: '900', color: itemProfit >= 0 ? '#059669' : '#dc2626' }}>
                            {formatCurrency(itemProfit)}
                          </span>
                          <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                            ({margin}%)
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {cogsList.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        নির্বাচিত সময়ে কোনো বিক্রিত পণ্যের হিসাব নেই
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Archived Yearly Ledgers Table */}
      {archivedSummaries.length > 0 && (
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', marginBottom: '4px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdArchive color="#ea580c" size={20} /> বিগত বছরসমূহের স্থায়ী লেজার সামারি (Archived Yearly Ledgers)
          </h3>
          <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>
            ডাটাবেজ সুরক্ষিত ও গতিশীল রাখতে পুরাতন ইনভয়েস আর্কাইভ করা হলেও, বিগত বছরগুলোর বাৎসরিক চূড়ান্ত আর্থিক হিসাব চিরস্থায়ীভাবে এখানে সংরক্ষিত রয়েছে।
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>সাল (Year)</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>ইনভয়েস সংখ্যা</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>মোট বিক্রয়</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>ফেরত (Returns)</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>নিট বিক্রয়</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>ক্রয় খরচ</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>খরচ</th>
                  <th style={{ padding: '10px 12px', fontWeight: '700' }}>নিট লাভ</th>
                </tr>
              </thead>
              <tbody>
                {archivedSummaries.map((s) => (
                  <tr key={s.id || s.year} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '800', color: '#0f172a' }}>{s.year} সাল</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.totalInvoices} টি</td>
                    <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0f172a' }}>{formatCurrency(s.grossRevenue)}</td>
                    <td style={{ padding: '10px 12px', color: '#dc2626' }}>- {formatCurrency(s.totalReturns)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: '800', color: '#059669' }}>{formatCurrency(s.netRevenue)}</td>
                    <td style={{ padding: '10px 12px', color: '#475569' }}>{formatCurrency(s.totalCostOfGoods)}</td>
                    <td style={{ padding: '10px 12px', color: '#dc2626' }}>{formatCurrency(s.totalExpenses)}</td>
                    <td style={{ padding: '10px 12px', fontWeight: '800', color: (s.netProfit || 0) >= 0 ? '#059669' : '#dc2626' }}>
                      {formatCurrency(s.netProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsDashboard;
