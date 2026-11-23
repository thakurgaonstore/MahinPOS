import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import InvoiceViewModal from './InvoiceViewModal';
import { MdSearch, MdPrint, MdReceipt, MdFileDownload, MdFilterList } from 'react-icons/md';
import * as XLSX from 'xlsx';

const SalesList = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('All');
  const [viewInvoice, setViewInvoice] = useState(null);
  const [shopConfig, setShopConfig] = useState(null);

  useEffect(() => {
    if (!shopId) return;

    const ref = collection(db, 'shops', shopId, 'sales');
    const q = query(ref, orderBy('createdAt', 'desc'));
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
  }, [shopId]);

  const filteredSales = sales.filter((s) => {
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

  const exportExcel = () => {
    const data = filteredSales.map((s, i) => ({
      'নং': i + 1,
      'ইনভয়েস': s.invoiceNo,
      'তারিখ': formatDate(s.createdAt),
      'কাস্টমার': s.customerName || 'নগদ ক্রেতা',
      'ফোন': s.customerPhone || '',
      'আইটেম সংখ্যা': s.items?.length || 0,
      'সর্বমোট দেয়': s.grandTotal || 0,
      'পরিশোধ': s.paidAmount || 0,
      'বাকি': s.dueAmount || 0,
      'পেমেন্ট মেথড': s.paymentMethod || 'Cash',
      'ক্যাশিয়ার': s.cashierName || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, `Sales_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>বিক্রয় ও ইনভয়েস হিস্ট্রি</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>সকল সম্পন্ন বিক্রয়ের হিসাব ও ইনভয়েস রিপ্রিন্ট</p>
        </div>

        <button
          onClick={exportExcel}
          style={{
            padding: '9px 16px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            background: '#ffffff',
            color: '#334155',
            fontWeight: '600',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <MdFileDownload size={18} /> এক্সেল ডাউনলোড
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{
        background: '#ffffff',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
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
            placeholder="ইনভয়েস নং বা কাস্টমার ফোন দিয়ে খুঁজুন..."
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
        <table className="pos-table">
          <thead>
            <tr>
              <th>ইনভয়েস নং</th>
              <th>তারিখ ও সময়</th>
              <th>কাস্টমার</th>
              <th>আইটেম</th>
              <th>মোট বিল</th>
              <th>পরিশোধ</th>
              <th>বাকি</th>
              <th>পদ্ধতি</th>
              <th style={{ textAlign: 'center' }}>ইনভয়েস</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((s) => (
              <tr key={s.id}>
                <td>
                  <span style={{ fontWeight: '700', color: '#2563eb' }}>#{s.invoiceNo}</span>
                </td>
                <td>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{formatDateTime(s.createdAt)}</span>
                </td>
                <td>
                  <div style={{ fontWeight: '600' }}>{s.customerName || 'নগদ ক্রেতা'}</div>
                  {s.customerPhone && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{s.customerPhone}</div>}
                </td>
                <td>
                  <span style={{ fontSize: '13px', color: '#475569' }}>{s.items?.length || 0} টি</span>
                </td>
                <td>
                  <span style={{ fontWeight: '800', color: '#0f172a' }}>{formatCurrency(s.grandTotal)}</span>
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
                <td style={{ textAlign: 'center' }}>
                  <button
                    onClick={() => setViewInvoice(s)}
                    style={{
                      padding: '6px 12px',
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
                    <MdPrint size={15} /> দেখুন / প্রিন্ট
                  </button>
                </td>
              </tr>
            ))}

            {filteredSales.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  কোনো বিক্রয়ের তথ্য পাওয়া যায়নি
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

export default SalesList;
