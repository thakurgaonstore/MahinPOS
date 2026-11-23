import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import {
  MdTrendingUp,
  MdTrendingDown,
  MdAttachMoney,
  MdAccountBalanceWallet,
  MdShoppingCart,
  MdReceipt
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
  const [timeRange, setTimeRange] = useState('all'); // 'today' | 'month' | 'all'

  useEffect(() => {
    if (!shopId) return;

    // Fetch Sales
    const unsubSales = onSnapshot(collection(db, 'shops', shopId, 'sales'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSales(list);
    });

    // Fetch Expenses
    const unsubExp = onSnapshot(collection(db, 'shops', shopId, 'expenses'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setExpenses(list);
    });

    return () => {
      unsubSales();
      unsubExp();
    };
  }, [shopId]);

  // Date Filtering
  const now = new Date();
  const isToday = (d) => {
    if (!d) return false;
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.toDateString() === now.toDateString();
  };

  const isThisMonth = (d) => {
    if (!d) return false;
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  const filteredSales = sales.filter((s) => {
    if (timeRange === 'today') return isToday(s.createdAt);
    if (timeRange === 'month') return isThisMonth(s.createdAt);
    return true;
  });

  const filteredExpenses = expenses.filter((e) => {
    if (timeRange === 'today') return isToday(e.createdAt);
    if (timeRange === 'month') return isThisMonth(e.createdAt);
    return true;
  });

  // Financial Calculations
  const totalRevenue = filteredSales.reduce((acc, s) => acc + (Number(s.grandTotal) || 0), 0);
  
  // Cost of Goods Sold (COGS)
  let totalCostOfGoods = 0;
  filteredSales.forEach((s) => {
    if (s.items && Array.isArray(s.items)) {
      s.items.forEach((item) => {
        totalCostOfGoods += (Number(item.costPrice) || 0) * (Number(item.quantity) || 0);
      });
    }
  });

  // Gross Profit = Revenue - COGS
  const grossProfit = totalRevenue - totalCostOfGoods;

  // Operating Expenses
  const totalExpenses = filteredExpenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

  // Net Profit = Gross Profit - Operating Expenses
  const netProfit = grossProfit - totalExpenses;

  // Chart Data: Payment Breakdown
  const paymentBreakdown = {};
  filteredSales.forEach((s) => {
    const m = s.paymentMethod || 'Cash';
    paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (Number(s.grandTotal) || 0);
  });
  const pieData = Object.keys(paymentBreakdown).map((k) => ({ name: k, value: paymentBreakdown[k] }));
  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];

  return (
    <div>
      {/* Title & Range Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>হিসাব ও লাভ-ক্ষতি রিপোর্ট (Profit & Loss)</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>ক্রয় মূল্য বনাম বিক্রয় মূল্য ও খরচের সমন্বয়ে প্রকৃত লাভ-ক্ষতি</p>
        </div>

        <div style={{ display: 'flex', gap: '6px', background: '#ffffff', padding: '4px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          {['today', 'month', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: timeRange === range ? '#2563eb' : 'transparent',
                color: timeRange === range ? '#ffffff' : '#64748b',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {range === 'today' ? 'আজকের' : range === 'month' ? 'চলতি মাস' : 'সর্বমোট'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>মোট বিক্রয় (Revenue)</span>
            <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px', color: '#2563eb' }}><MdShoppingCart size={20} /></div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(totalRevenue)}</div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>মোট {filteredSales.length} টি বিক্রয় ইনভয়েস</span>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>পণ্য ক্রয় মূল্য (COGS)</span>
            <div style={{ background: '#f8fafc', padding: '8px', borderRadius: '8px', color: '#475569' }}><MdReceipt size={20} /></div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#475569' }}>{formatCurrency(totalCostOfGoods)}</div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>বিক্রিত পণ্যের আসল খরচ</span>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>মোট মোট লাভ (Gross Profit)</span>
            <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '8px', color: '#10b981' }}><MdTrendingUp size={20} /></div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669' }}>{formatCurrency(grossProfit)}</div>
          <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>
            মার্জিন: {totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0}%
          </span>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>দোকান খরচ (Expenses)</span>
            <div style={{ background: '#fef2f2', padding: '8px', borderRadius: '8px', color: '#ef4444' }}><MdTrendingDown size={20} /></div>
          </div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626' }}>{formatCurrency(totalExpenses)}</div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>ভাড়া, বিদ্যুৎ, স্টাফ বেতন ইত্যাদি</span>
        </div>

        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '2px solid', borderColor: netProfit >= 0 ? '#10b981' : '#ef4444', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: netProfit >= 0 ? '#065f46' : '#991b1b' }}>
              প্রকৃত নিট লাভ (Net Profit)
            </span>
            <div style={{ background: netProfit >= 0 ? '#ecfdf5' : '#fee2e2', padding: '8px', borderRadius: '8px', color: netProfit >= 0 ? '#059669' : '#dc2626' }}>
              <MdAttachMoney size={20} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '900', color: netProfit >= 0 ? '#059669' : '#dc2626' }}>
            {formatCurrency(netProfit)}
          </div>
          <span style={{ fontSize: '12px', fontWeight: '600', color: netProfit >= 0 ? '#059669' : '#dc2626' }}>
            {netProfit >= 0 ? '✓ নিট মুনাফা' : '✗ নিট ক্ষতি'}
          </span>
        </div>
      </div>

      {/* Visual Analysis Chart */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gap: '20px'
      }}>
        {/* Comparison Bar */}
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#0f172a' }}>
            আয়, খরচ ও মুনাফা তুলনা (Comparison)
          </h3>
          <div style={{ height: '240px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: 'বিক্রয়', amount: totalRevenue },
                { name: 'ক্রয় খরচ', amount: totalCostOfGoods },
                { name: 'দোকান খরচ', amount: totalExpenses },
                { name: 'নিট লাভ', amount: Math.max(0, netProfit) }
              ]}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Methods Pie */}
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#0f172a' }}>
            পেমেন্ট মাধ্যম অনুপাত
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
