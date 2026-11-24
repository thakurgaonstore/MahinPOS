import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import { Link } from 'react-router-dom';
import InvoiceViewModal from './invoices/InvoiceViewModal';

import {
  MdPointOfSale,
  MdShoppingCart,
  MdTrendingUp,
  MdWarning,
  MdPeople,
  MdReceipt,
  MdPrint,
  MdInventory2,
  MdAdd,
  MdTrackChanges,
  MdAttachMoney,
  MdMilitaryTech,
  MdStars,
  MdCalendarToday,
  MdAccountBalance
} from 'react-icons/md';

const DashboardHome = () => {
  const { userProfile, currentUser } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';
  const role = userProfile?.role || 'cashier';
  const isOwner = role === 'shop_admin' || userProfile?.isImpersonating;
  const isManager = role === 'manager' || isOwner;
  const isSalesStaff = role === 'salesman' || role === 'cashier' || role === 'staff';

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [shopConfig, setShopConfig] = useState(null);

  useEffect(() => {
    if (!shopId) return;

    // Realtime Sales (Limit 150 for Spark plan quota & fast dashboard loading)
    const qSales = query(collection(db, 'shops', shopId, 'sales'), orderBy('createdAt', 'desc'), limit(150));
    const unsubSales = onSnapshot(qSales, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSales(list);
    });

    // Realtime Products
    const unsubProd = onSnapshot(collection(db, 'shops', shopId, 'products'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setProducts(list);
    });

    // Realtime Customers
    const unsubCust = onSnapshot(collection(db, 'shops', shopId, 'customers'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setCustomers(list);
    });

    // Realtime Staff
    const unsubStaff = onSnapshot(collection(db, 'shops', shopId, 'staff'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setStaffList(list);
    });

    // Realtime Expenses (Owner/Manager only)
    let unsubExp = () => {};
    if (!isSalesStaff) {
      unsubExp = onSnapshot(collection(db, 'shops', shopId, 'expenses'), (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setExpenses(list);
      });
    }

    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'shops', shopId));
      if (snap.exists()) setShopConfig(snap.data());
    };
    fetchConfig();

    return () => {
      unsubSales();
      unsubProd();
      unsubCust();
      unsubStaff();
      unsubExp();
    };
  }, [shopId, isSalesStaff]);

  // Current Date Benchmarks
  const now = new Date();
  const todayStr = now.toDateString();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const isToday = (d) => {
    if (!d) return false;
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.toDateString() === todayStr;
  };

  const isThisMonth = (d) => {
    if (!d) return false;
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  };

  const isThisYear = (d) => {
    if (!d) return false;
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.getFullYear() === currentYear;
  };

  // 1. Overall Store Calculations
  const todaySales = sales.filter((s) => isToday(s.createdAt));
  const todayRevenue = todaySales.reduce((a, s) => a + (Number(s.grandTotal) || 0) - (Number(s.totalRefundAmount) || 0), 0);

  const monthSales = sales.filter((s) => isThisMonth(s.createdAt));
  const monthRevenue = monthSales.reduce((a, s) => a + (Number(s.grandTotal) || 0) - (Number(s.totalRefundAmount) || 0), 0);

  // Today Gross Profit (Owner/Manager only)
  let todayCOGS = 0;
  todaySales.forEach((s) => {
    s.items?.forEach((item) => {
      todayCOGS += (Number(item.costPrice) || 0) * (Number(item.quantity) || 0);
    });
  });
  const todayGrossProfit = todayRevenue - todayCOGS;

  const lowStockCount = products.filter((p) => {
    const stock = Number(p.stock) || 0;
    const minAlert = Number(p.minStockAlert) || 5;
    return stock <= minAlert;
  }).length;

  // 2. Logged-in Staff Member Details & Incentive Calculation
  const loggedInStaff = staffList.find(s => 
    (s.phone && userProfile?.phone && s.phone === userProfile.phone) ||
    s.id === userProfile?.staffId ||
    s.id === currentUser?.uid ||
    (s.name && userProfile?.name && s.name.toLowerCase() === userProfile.name.toLowerCase())
  );

  const myCommissionType = loggedInStaff?.commissionType || 'none';
  const myCommissionRate = Number(loggedInStaff?.commissionRate) || 0;
  const myMonthlyTarget = Number(loggedInStaff?.monthlySalesTarget) || 0;

  // Filter sales made by this salesman
  const isMySale = (s) => {
    if (!isSalesStaff) return true;
    const matchId = loggedInStaff && (s.salesmanId === loggedInStaff.id || s.cashierId === loggedInStaff.id);
    const matchPhone = userProfile?.phone && s.salesmanPhone === userProfile.phone;
    const matchName = userProfile?.name && (s.salesmanName === userProfile.name || s.cashierName === userProfile.name);
    return matchId || matchPhone || matchName;
  };

  const mySalesList = sales.filter(isMySale);
  const myTodaySales = mySalesList.filter((s) => isToday(s.createdAt));
  const myTodayRevenue = myTodaySales.reduce((sum, s) => sum + (Number(s.grandTotal) || 0) - (Number(s.totalRefundAmount) || 0), 0);

  const myMonthSales = mySalesList.filter((s) => isThisMonth(s.createdAt));
  const myMonthRevenue = myMonthSales.reduce((sum, s) => sum + (Number(s.grandTotal) || 0) - (Number(s.totalRefundAmount) || 0), 0);

  const myYearSales = mySalesList.filter((s) => isThisYear(s.createdAt));
  const myYearRevenue = myYearSales.reduce((sum, s) => sum + (Number(s.grandTotal) || 0) - (Number(s.totalRefundAmount) || 0), 0);

  // Incentive Calculations
  let myTodayIncentive = 0;
  let myMonthIncentive = 0;
  let myYearIncentive = 0;

  if (myCommissionType === 'percentage' && myCommissionRate > 0) {
    myTodayIncentive = Math.round((myTodayRevenue * myCommissionRate) / 100);
    myMonthIncentive = Math.round((myMonthRevenue * myCommissionRate) / 100);
    myYearIncentive = Math.round((myYearRevenue * myCommissionRate) / 100);
  } else if (myCommissionType === 'fixed_per_sale' && myCommissionRate > 0) {
    myTodayIncentive = Math.round(myTodaySales.length * myCommissionRate);
    myMonthIncentive = Math.round(myMonthSales.length * myCommissionRate);
    myYearIncentive = Math.round(myYearSales.length * myCommissionRate);
  }

  const targetProgressPercent = myMonthlyTarget > 0 ? Math.min(100, Math.round((myMonthRevenue / myMonthlyTarget) * 100)) : 0;

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: isSalesStaff 
          ? 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' 
          : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        color: '#ffffff',
        padding: '24px 28px',
        borderRadius: '16px',
        marginBottom: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>
              স্বাগতম, {userProfile?.name || userProfile?.email || 'Admin'} 👋
            </h1>
            <span style={{
              background: isSalesStaff ? '#4338ca' : '#334155',
              padding: '2px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {role === 'manager' ? 'ম্যানেজার' :
               role === 'salesman' ? 'সেলসম্যান' :
               role === 'cashier' ? 'ক্যাশিয়ার' :
               role === 'accountant' ? 'হিসাবরক্ষক' : 'অ্যাডমিন'}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>
            {shopConfig?.shopName || 'Mahin POS Store'} — {isSalesStaff ? 'আপনার আজকের বিক্রয় ও অর্জিত ইনসেন্টিভ ড্যাশবোর্ড' : 'আজকের সামগ্রিক দোকান কার্যক্রম ও আর্থিক সংক্ষিপ্ত রিপোর্ট'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Link
            to="/dashboard/pos"
            style={{
              background: '#2563eb',
              color: '#ffffff',
              padding: '10px 20px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: '700',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)'
            }}
          >
            <MdPointOfSale size={20} />
            নতুন বিক্রয় (POS)
          </Link>
          <Link
            to="/dashboard/inventory"
            style={{
              background: 'rgba(255,255,255,0.12)',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MdInventory2 size={18} />
            পণ্য স্টক দেখুন
          </Link>
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: SALESMAN / CASHIER INCENTIVE DASHBOARD (Only for Sales Staff)
      ========================================================================= */}
      {isSalesStaff ? (
        <>
          {/* Salesman KPI Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            {/* Today Sales */}
            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '700' }}>আমার আজকের বিক্রয়</span>
                <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px', color: '#2563eb' }}><MdShoppingCart size={20} /></div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a' }}>{formatCurrency(myTodayRevenue)}</div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>আজ মোট {myTodaySales.length} টি সফল মেমো</span>
            </div>

            {/* Today Incentive */}
            <div style={{ padding: '20px', borderRadius: '14px', border: '1px solid #fed7aa', background: '#fffaf5', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#ea580c', fontWeight: '700' }}>আজকের অর্জিত ইনসেন্টিভ</span>
                <div style={{ background: '#ffedd5', padding: '8px', borderRadius: '8px', color: '#ea580c' }}><MdStars size={20} /></div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#c2410c' }}>{formatCurrency(myTodayIncentive)}</div>
              <span style={{ fontSize: '12px', color: '#ea580c' }}>
                {myCommissionType === 'percentage' ? `${myCommissionRate}% হারে প্রাপ্য` : myCommissionType === 'fixed_per_sale' ? `৳${myCommissionRate}/মেমো` : 'ফিক্সড বেতনভুক্ত'}
              </span>
            </div>

            {/* This Month Sales */}
            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '700' }}>চলতি মাসের মোট বিক্রয়</span>
                <div style={{ background: '#f5f3ff', padding: '8px', borderRadius: '8px', color: '#7c3aed' }}><MdTrendingUp size={20} /></div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#5b21b6' }}>{formatCurrency(myMonthRevenue)}</div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>এই মাসে {myMonthSales.length} টি বিক্রয় সম্পন্ন</span>
            </div>

            {/* This Month Incentive */}
            <div style={{ padding: '20px', borderRadius: '14px', border: '1px solid #bbf7d0', background: '#f0fdf4', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#059669', fontWeight: '700' }}>চলতি মাসের মোট ইনসেন্টিভ</span>
                <div style={{ background: '#dcfce7', padding: '8px', borderRadius: '8px', color: '#059669' }}><MdAttachMoney size={20} /></div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#15803d' }}>{formatCurrency(myMonthIncentive)}</div>
              <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>বেতনের সাথে যুক্ত হবে</span>
            </div>
          </div>

          {/* Monthly Sales Target Progress Bar */}
          {myMonthlyTarget > 0 && (
            <div style={{
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              padding: '20px',
              marginBottom: '24px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MdTrackChanges size={22} color="#2563eb" />
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                    মাসিক বিক্রয় লক্ষ্যমাত্রা (Monthly Sales Target)
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  টার্গেট: <b>{formatCurrency(myMonthlyTarget)}</b> | অর্জিত: <b style={{ color: '#2563eb' }}>{formatCurrency(myMonthRevenue)}</b> ({targetProgressPercent}%)
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: '14px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{
                  width: `${targetProgressPercent}%`,
                  height: '100%',
                  background: targetProgressPercent >= 100 
                    ? 'linear-gradient(90deg, #10b981, #059669)' 
                    : 'linear-gradient(90deg, #3b82f6, #2563eb)',
                  borderRadius: '10px',
                  transition: 'width 0.5s ease-in-out'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                <span>০ ৳</span>
                <span style={{ fontWeight: '700', color: targetProgressPercent >= 100 ? '#059669' : '#2563eb' }}>
                  {targetProgressPercent >= 100 ? '🎉 অভিনন্দন! আপনি চলতি মাসের টার্গেট পূর্ণ করেছেন!' : `টার্গেট পূরণে বাকি: ${formatCurrency(Math.max(0, myMonthlyTarget - myMonthRevenue))}`}
                </span>
                <span>{formatCurrency(myMonthlyTarget)}</span>
              </div>
            </div>
          )}

          {/* Incentive Summary Banner (Monthly & Yearly) */}
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #cbd5e1',
            borderRadius: '14px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div>
              <span style={{ fontWeight: '800', color: '#1e293b', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MdMilitaryTech size={20} color="#f59e0b" />
                বাৎসরিক পারফরম্যান্স ({currentYear} সাল):
              </span>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                চলতি বছরে আপনার মোট বিক্রয়: <b>{formatCurrency(myYearRevenue)}</b> ({myYearSales.length} টি মেমো)
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>বাৎসরিক মোট অর্জিত ইনসেন্টিভ:</span>
              <span style={{ fontSize: '20px', fontWeight: '900', color: '#059669' }}>
                {formatCurrency(myYearIncentive)}
              </span>
            </div>
          </div>
        </>
      ) : (
        /* =========================================================================
            SECTION 2: OWNER & MANAGER FULL SHOP OVERVIEW
        ========================================================================= */
        <>
          {/* Owner Shop KPI Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>আজকের মোট বিক্রয়</span>
                <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '8px', color: '#2563eb' }}><MdShoppingCart size={20} /></div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a' }}>{formatCurrency(todayRevenue)}</div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>আজ {todaySales.length} টি ইনভয়েস হয়েছে</span>
            </div>

            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>আজকের আনুমানিক লাভ (Gross)</span>
                <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '8px', color: '#10b981' }}><MdTrendingUp size={20} /></div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#059669' }}>{formatCurrency(todayGrossProfit)}</div>
              <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>মার্জিন সংরক্ষিত</span>
            </div>

            <Link to="/dashboard/low-stock" style={{ textDecoration: 'none' }}>
              <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>কম স্টক এলার্ট</span>
                  <div style={{ background: lowStockCount > 0 ? '#fef3c7' : '#f8fafc', padding: '8px', borderRadius: '8px', color: lowStockCount > 0 ? '#d97706' : '#94a3b8' }}><MdWarning size={20} /></div>
                </div>
                <div style={{ fontSize: '26px', fontWeight: '900', color: lowStockCount > 0 ? '#d97706' : '#0f172a' }}>
                  {lowStockCount} টি পণ্য
                </div>
                <span style={{ fontSize: '12px', color: lowStockCount > 0 ? '#d97706' : '#64748b' }}>
                  {lowStockCount > 0 ? '⚠️ অবিলম্বে রি-অর্ডার করুন' : '✓ পর্যাপ্ত স্টক রয়েছে'}
                </span>
              </div>
            </Link>

            <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>নিবন্ধিত কাস্টমার</span>
                <div style={{ background: '#fdf2f8', padding: '8px', borderRadius: '8px', color: '#db2777' }}><MdPeople size={20} /></div>
              </div>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a' }}>{customers.length} জন</div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>লয়্যালটি পয়েন্ট সক্রিয়</span>
            </div>
          </div>

          {/* Staff Sales & Incentive Performance Table for Owner */}
          {staffList.length > 0 && isOwner && (
            <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MdMilitaryTech size={22} color="#f59e0b" />
                    স্টাফ ও সেলসম্যানদের বিক্রয় ও ইনসেন্টিভ হিসাব (চলতি মাস)
                  </h3>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                    কর্মীদের মাসিক বিক্রয় অগ্রগতি ও প্রাপ্য কমিশন পর্যবেক্ষণ করুন
                  </p>
                </div>
                <Link
                  to="/dashboard/staff"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    fontSize: '12px',
                    fontWeight: '700',
                    textDecoration: 'none'
                  }}
                >
                  বেতন ও পেরোল খাতা →
                </Link>
              </div>

              <div className="table-responsive">
                <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '8px 10px' }}>কর্মীর নাম</th>
                      <th style={{ padding: '8px 10px' }}>পদবী</th>
                      <th style={{ padding: '8px 10px' }}>চলতি মাসের বিক্রয়</th>
                      <th style={{ padding: '8px 10px' }}>টার্গেট ও অগ্রগতি</th>
                      <th style={{ padding: '8px 10px' }}>প্রদেয় ইনসেন্টিভ</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((s) => {
                      const staffSalesThisMonth = sales.filter(sale => 
                        isThisMonth(sale.createdAt) && 
                        (sale.salesmanId === s.id || sale.cashierId === s.id || sale.salesmanPhone === s.phone || sale.cashierName === s.name)
                      );
                      const totalSold = staffSalesThisMonth.reduce((sum, item) => sum + (Number(item.grandTotal) || 0) - (Number(item.totalRefundAmount) || 0), 0);
                      
                      let incAmount = 0;
                      if (s.commissionType === 'percentage' && s.commissionRate > 0) {
                        incAmount = Math.round((totalSold * s.commissionRate) / 100);
                      } else if (s.commissionType === 'fixed_per_sale' && s.commissionRate > 0) {
                        incAmount = Math.round(staffSalesThisMonth.length * s.commissionRate);
                      }

                      const target = Number(s.monthlySalesTarget) || 0;
                      const pct = target > 0 ? Math.min(100, Math.round((totalSold / target) * 100)) : 0;

                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px' }}>
                            <div style={{ fontWeight: '700', color: '#0f172a' }}>{s.name}</div>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>📱 {s.phone}</span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '700',
                              background: s.role === 'salesman' ? '#f3e8ff' : '#eff6ff',
                              color: s.role === 'salesman' ? '#7c3aed' : '#2563eb'
                            }}>
                              {s.role}
                            </span>
                          </td>
                          <td style={{ padding: '10px' }}>
                            <b style={{ color: '#0f172a' }}>{formatCurrency(totalSold)}</b>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{staffSalesThisMonth.length} টি মেমো</div>
                          </td>
                          <td style={{ padding: '10px' }}>
                            {target > 0 ? (
                              <div style={{ minWidth: '120px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                                  <span>{pct}%</span>
                                  <span>{formatCurrency(target)}</span>
                                </div>
                                <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#10b981' : '#3b82f6' }} />
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>টার্গেট নেই</span>
                            )}
                          </td>
                          <td style={{ padding: '10px' }}>
                            <span style={{ fontWeight: '800', color: incAmount > 0 ? '#059669' : '#64748b' }}>
                              {formatCurrency(incAmount)}
                            </span>
                            <div style={{ fontSize: '10px', color: '#64748b' }}>
                              {s.commissionType === 'percentage' ? `${s.commissionRate}% হারে` : s.commissionType === 'fixed_per_sale' ? `৳${s.commissionRate}/মেমো` : 'ফিক্সড বেতন'}
                            </div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'center' }}>
                            <Link
                              to="/dashboard/staff"
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#0f172a',
                                fontSize: '11px',
                                fontWeight: '700',
                                textDecoration: 'none'
                              }}
                            >
                              পেরোল দেখুন
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          SECTION 3: RECENT SALES TABLE (Filtered for Salesman if staff)
      ========================================================================= */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            {isSalesStaff ? 'আমার সর্বশেষ বিক্রয় তালিকা' : 'দোকানের সর্বশেষ বিক্রয় তালিকা'}
          </h3>
          <Link to="/dashboard/sales" style={{ color: '#2563eb', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
            সকল বিক্রয় দেখুন →
          </Link>
        </div>

        <div className="table-responsive">
          <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th>ইনভয়েস</th>
                <th>সময়</th>
                <th>কাস্টমার</th>
                <th>মোট টাকা</th>
                <th>পদ্ধতি</th>
                <th style={{ textAlign: 'center' }}>প্রিন্ট</th>
              </tr>
            </thead>
            <tbody>
              {(isSalesStaff ? mySalesList : sales).slice(0, 8).map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td><b style={{ color: '#2563eb' }}>#{s.invoiceNo}</b></td>
                  <td><span style={{ fontSize: '12px', color: '#64748b' }}>{formatDateTime(s.createdAt)}</span></td>
                  <td>{s.customerName || 'নগদ ক্রেতা'}</td>
                  <td><b>{formatCurrency(s.grandTotal)}</b></td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: '#eff6ff', color: '#2563eb' }}>
                      {s.paymentMethod}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => setViewInvoice(s)}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', color: '#0f172a' }}
                      title="ইনভয়েস দেখুন"
                    >
                      <MdPrint size={15} />
                    </button>
                  </td>
                </tr>
              ))}

              {(isSalesStaff ? mySalesList : sales).length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    এখনো কোনো বিক্রয় সম্পন্ন হয়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Viewer Modal */}
      {viewInvoice && (
        <InvoiceViewModal
          invoice={viewInvoice}
          shopConfig={shopConfig}
          onClose={() => setViewInvoice(null)}
          initialFormat={shopConfig?.defaultInvoiceFormat || 'pos'}
        />
      )}
    </div>
  );
};

export default DashboardHome;
