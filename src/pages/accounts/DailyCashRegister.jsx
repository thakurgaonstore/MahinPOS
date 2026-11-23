import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import { MdPayments, MdArrowDownward, MdArrowUpward } from 'react-icons/md';

const DailyCashRegister = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [openingCash, setOpeningCash] = useState(() => localStorage.getItem(`openingCash_${shopId}`) || '0');
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);

  useEffect(() => {
    if (!shopId) return;

    const unsubSales = onSnapshot(collection(db, 'shops', shopId, 'sales'), (snap) => {
      const list = [];
      const todayStr = new Date().toDateString();
      snap.forEach((d) => {
        const data = d.data();
        const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        if (date.toDateString() === todayStr) {
          list.push(data);
        }
      });
      setSales(list);
    });

    const unsubExp = onSnapshot(collection(db, 'shops', shopId, 'expenses'), (snap) => {
      const list = [];
      const todayStr = new Date().toDateString();
      snap.forEach((d) => {
        const data = d.data();
        const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
        if (date.toDateString() === todayStr) {
          list.push(data);
        }
      });
      setExpenses(list);
    });

    return () => {
      unsubSales();
      unsubExp();
    };
  }, [shopId]);

  // Cash In (Today's Cash Sales only)
  const cashSales = sales
    .filter((s) => (s.paymentMethod || 'Cash') === 'Cash')
    .reduce((a, s) => a + (Number(s.paidAmount) || 0), 0);

  // Cash Out (Today's expenses)
  const todayExpenses = expenses.reduce((a, e) => a + (Number(e.amount) || 0), 0);

  // Closing cash in drawer = Opening + Cash In - Cash Out
  const closingCash = (Number(openingCash) || 0) + cashSales - todayExpenses;

  const handleSaveOpening = () => {
    localStorage.setItem(`openingCash_${shopId}`, openingCash);
    toast.success('ওপেনিং ক্যাশ সেভ করা হয়েছে');
  };

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>দৈনিক ক্যাশ খাতা (Daily Cash Register)</h1>
        <p style={{ fontSize: '14px', color: '#64748b' }}>আজকের দিনের ক্যাশ ড্রয়ার ব্যালেন্স ও ক্যাশ ইন-আউট ট্র্যাকার</p>
      </div>

      {/* Opening Cash Input */}
      <div style={{ background: '#fff', padding: '16px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748b' }}>সকালের প্রারম্ভিক ক্যাশ (Opening Cash):</span>
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="0.00"
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: '700', outline: 'none' }}
            />
            <button
              onClick={handleSaveOpening}
              style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '600', cursor: 'pointer' }}
            >
              সেভ করুন
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>ড্রয়ারে সম্ভাব্য বর্তমান ক্যাশ:</span>
          <div style={{ fontSize: '28px', fontWeight: '900', color: '#059669' }}>
            {formatCurrency(closingCash)}
          </div>
        </div>
      </div>

      {/* Cash Flow Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>প্রারম্ভিক ক্যাশ (Opening)</span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(openingCash)}</div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MdArrowDownward size={16} /> মোট ক্যাশ ইন (নগদ বিক্রয়)
          </span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669' }}>+{formatCurrency(cashSales)}</div>
        </div>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MdArrowUpward size={16} /> মোট ক্যাশ আউট (আজকের খরচ)
          </span>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626' }}>-{formatCurrency(todayExpenses)}</div>
        </div>

        <div style={{ background: '#ecfdf5', padding: '20px', borderRadius: '12px', border: '1px solid #a7f3d0' }}>
          <span style={{ fontSize: '13px', color: '#065f46', fontWeight: '700' }}>ড্রয়ার ক্যাশ (Closing Cash)</span>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#059669' }}>{formatCurrency(closingCash)}</div>
        </div>
      </div>
    </div>
  );
};

export default DailyCashRegister;
