import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  MdTrendingUp,
  MdTrendingDown,
  MdAttachMoney,
  MdAccountBalanceWallet,
  MdShoppingCart,
  MdReceipt,
  MdAssignmentReturn,
  MdDateRange
} from 'react-icons/md';
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
  const [timeRange, setTimeRange] = useState('today'); // 'today' | 'month' | 'year' | 'all' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    if (!shopId) return;

    // Spark Plan Optimized Limit: latest 300 records
    const salesQuery = query(collection(db, 'shops', shopId, 'sales'), orderBy('createdAt', 'desc'), limit(300));
    const unsubSales = onSnapshot(salesQuery, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSales(list);
    });

    // Fetch Expenses (latest 300)
    const expQuery = query(collection(db, 'shops', shopId, 'expenses'), orderBy('createdAt', 'desc'), limit(300));
    const unsubExp = onSnapshot(expQuery, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setExpenses(list);
    });

    return () => {
      unsubSales();
      unsubExp();
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
  const filteredExpenses = expenses.filter((e) => isMatchPeriod(e.createdAt));

  // Financial Calculations
  const grossRevenue = filteredSales.reduce((acc, s) => acc + (Number(s.grandTotal) || 0), 0);
  const totalReturns = filteredSales.reduce((acc, s) => acc + (Number(s.totalRefundAmount) || 0), 0);
  const netRevenue = Math.max(0, grossRevenue - totalReturns);

  // Cost of Goods Sold (COGS) adjusted for net sold items
  let totalCostOfGoods = 0;
  filteredSales.forEach((s) => {
    if (s.items && Array.isArray(s.items)) {
      s.items.forEach((item) => {
        const netQty = Math.max(0, (Number(item.quantity) || 0) - (Number(item.returnedQty) || 0));
        totalCostOfGoods += (Number(item.costPrice) || 0) * netQty;
      });
    }
  });

  // Gross Profit = Net Revenue - COGS
  const grossProfit = netRevenue - totalCostOfGoods;

  // Operating Expenses
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  // Net Profit = Gross Profit - Operating Expenses
  const netProfit = grossProfit - totalExpenses;

  // Total Cash & Due
  const totalPaid = filteredSales.reduce((acc, s) => acc + (Number(s.paidAmount) || 0), 0);
  const totalDue = filteredSales.reduce((acc, s) => acc + (Number(s.dueAmount) || 0), 0);

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
    { name: 'ক্রয় খরচ', amount: totalCostOfGoods },
    { name: 'দোকান খরচ', amount: totalExpenses },
    { name: 'নিট লাভ', amount: Math.max(0, netProfit) }
  ];

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
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
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
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: timeRange === tab.id ? '#2563eb' : 'transparent',
                color: timeRange === tab.id ? '#ffffff' : '#64748b',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Filters */}
      {timeRange === 'custom' && (
        <div style={{
          background: '#ffffff',
          padding: '12px 16px',
          borderRadius: '10px',
          border: '1px solid #cbd5e1',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>কাস্টম সময়কাল:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>শুরু:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>শেষ:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
          </div>
        </div>
      )}

      {/* KPI Cards Grid (6 Cards) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '20px'
      }}>
        {/* 1. Gross Revenue */}
        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>১. মোট বিক্রয় (Gross Sales)</span>
            <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '6px', color: '#2563eb' }}><MdShoppingCart size={18} /></div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(grossRevenue)}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>মোট {filteredSales.length} টি বিক্রয় ইনভয়েস</span>
        </div>

        {/* 2. Total Returns */}
        <div style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid #fecaca', background: '#fffafa' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#dc2626' }}>২. মোট ফেরত (Returns)</span>
            <div style={{ background: '#fee2e2', padding: '6px', borderRadius: '6px', color: '#dc2626' }}><MdAssignmentReturn size={18} /></div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626' }}>- {formatCurrency(totalReturns)}</div>
          <span style={{ fontSize: '11px', color: '#dc2626' }}>গ্রাহককে ফেরত দেওয়া রিফান্ড</span>
        </div>

        {/* 3. Net Revenue */}
        <div style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid #a7f3d0', background: '#f0fdf4' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#059669' }}>৩. নিট বিক্রয় (Net Sales)</span>
            <div style={{ background: '#dcfce7', padding: '6px', borderRadius: '6px', color: '#059669' }}><MdTrendingUp size={18} /></div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '900', color: '#059669' }}>{formatCurrency(netRevenue)}</div>
          <span style={{ fontSize: '11px', color: '#059669' }}>মোট বিক্রয় বিয়োগ রিটার্ন</span>
        </div>

        {/* 4. COGS */}
        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>৪. ক্রয় খরচ (COGS)</span>
            <div style={{ background: '#f8fafc', padding: '6px', borderRadius: '6px', color: '#475569' }}><MdReceipt size={18} /></div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#475569' }}>{formatCurrency(totalCostOfGoods)}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>বিক্রীত পণ্যের গড় ক্রয়মূল্য</span>
        </div>

        {/* 5. Expenses */}
        <div style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>৫. দোকান খরচ (Expenses)</span>
            <div style={{ background: '#fef2f2', padding: '6px', borderRadius: '6px', color: '#ef4444' }}><MdTrendingDown size={18} /></div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626' }}>{formatCurrency(totalExpenses)}</div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>ভাড়া, বিদ্যুৎ ও দৈনন্দিন খরচ</span>
        </div>

        {/* 6. Net Profit */}
        <div style={{
          background: '#ffffff',
          padding: '16px 20px',
          borderRadius: '12px',
          border: '2px solid',
          borderColor: netProfit >= 0 ? '#10b981' : '#ef4444',
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
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
        gap: '16px'
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
    </div>
  );
};

export default AccountsDashboard;
