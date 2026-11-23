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
  MdAdd
} from 'react-icons/md';

const DashboardHome = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [shopConfig, setShopConfig] = useState(null);

  useEffect(() => {
    if (!shopId) return;

    // Realtime Sales
    const qSales = query(collection(db, 'shops', shopId, 'sales'), orderBy('createdAt', 'desc'), limit(10));
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

    // Realtime Expenses
    const unsubExp = onSnapshot(collection(db, 'shops', shopId, 'expenses'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setExpenses(list);
    });

    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'shops', shopId));
      if (snap.exists()) setShopConfig(snap.data());
    };
    fetchConfig();

    return () => {
      unsubSales();
      unsubProd();
      unsubCust();
      unsubExp();
    };
  }, [shopId]);

  // Today calculations
  const todayStr = new Date().toDateString();
  const isToday = (d) => {
    if (!d) return false;
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.toDateString() === todayStr;
  };

  const todaySales = sales.filter((s) => isToday(s.createdAt));
  const todayRevenue = todaySales.reduce((a, s) => a + (Number(s.grandTotal) || 0), 0);

  // Today Gross Profit
  let todayCOGS = 0;
  todaySales.forEach((s) => {
    s.items?.forEach((item) => {
      todayCOGS += (Number(item.costPrice) || 0) * (Number(item.quantity) || 0);
    });
  });
  const todayGrossProfit = todayRevenue - todayCOGS;

  // Low stock counter
  const lowStockCount = products.filter((p) => {
    const stock = Number(p.stock) || 0;
    const minAlert = Number(p.minStockAlert) || 5;
    return stock <= minAlert;
  }).length;

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b, #0f172a)',
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
          <h1 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '6px' }}>
            স্বাগতম, {userProfile?.name || userProfile?.email || 'Admin'} 👋
          </h1>
          <p style={{ fontSize: '14px', color: '#94a3b8' }}>
            {shopConfig?.shopName || 'Mahin POS Store'} — আজকের কার্যক্রম ও সংক্ষিপ্ত রিপোর্ট
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
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
            নতুন বিক্রয় শুরু করুন (POS)
          </Link>
          <Link
            to="/dashboard/inventory"
            style={{
              background: 'rgba(255,255,255,0.1)',
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
            পণ্য তালিকা
          </Link>
        </div>
      </div>

      {/* KPI Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '16px',
        marginBottom: '28px'
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
            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>আজকের মোট লাভ (Gross)</span>
            <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '8px', color: '#10b981' }}><MdTrendingUp size={20} /></div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: '900', color: '#059669' }}>{formatCurrency(todayGrossProfit)}</div>
          <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>লাভ মার্জিন সক্রিয়</span>
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

      {/* Recent Sales Table */}
      <div style={{ background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>সর্বশেষ বিক্রয় তালিকা</h3>
          <Link to="/dashboard/sales" style={{ color: '#2563eb', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}>
            সকল বিক্রয় দেখুন →
          </Link>
        </div>

        <div className="table-responsive">
          <table className="pos-table">
            <thead>
              <tr>
                <th>ইনভয়েস</th>
                <th>সময়</th>
                <th>কাস্টমার</th>
                <th>মোট টাকা</th>
                <th>পদ্ধতি</th>
                <th style={{ textAlign: 'center' }}>প্রিন্ট</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 6).map((s) => (
                <tr key={s.id}>
                  <td><b>#{s.invoiceNo}</b></td>
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
                    >
                      <MdPrint size={15} />
                    </button>
                  </td>
                </tr>
              ))}

              {sales.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    আজ এখনো কোনো বিক্রয় সম্পন্ন হয়নি
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
