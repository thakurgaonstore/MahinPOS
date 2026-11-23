import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import { MdAdd, MdReceipt, MdDelete, MdFilterList } from 'react-icons/md';

const ExpenseManager = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('দোকান ভাড়া');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    'দোকান ভাড়া',
    'বিদ্যুৎ ও ইউটিলিটি বিল',
    'স্টাফ বেতন ও বোনাস',
    'আপ্যায়ন ও চা-নাস্তা',
    'পরিবহন ও ডেলিভারি',
    'মেরামত ও রক্ষণাবেক্ষণ',
    'বিজ্ঞাপন ও প্রচারণা',
    'অন্যান্য খরচ'
  ];

  useEffect(() => {
    if (!shopId) return;
    const unsub = onSnapshot(collection(db, 'shops', shopId, 'expenses'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
      setExpenses(list);
    });
    return () => unsub();
  }, [shopId]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!title || !amount) {
      toast.error('খরচের শিরোনাম ও টাকার পরিমাণ লিখুন');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'shops', shopId, 'expenses'), {
        title: title.trim(),
        amount: Number(amount) || 0,
        category,
        note: note.trim(),
        createdAt: serverTimestamp()
      });
      toast.success('খরচ সফলভাবে যুক্ত হয়েছে');
      setTitle('');
      setAmount('');
      setNote('');
    } catch (err) {
      toast.error('খরচ সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('এই খরচের এন্ট্রিটি মুছে ফেলতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'shops', shopId, 'expenses', id));
      toast.success('খরচ মুছে ফেলা হয়েছে');
    } catch (e) {
      toast.error('মুছতে সমস্যা হয়েছে');
    }
  };

  const totalExpenseAmount = expenses.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>দোকানের খরচের খাতা (Expense Manager)</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>দোকানের প্রতিদিনের ও মাসিক খরচের সার্বিক হিসাব</p>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 18px', borderRadius: '10px' }}>
          <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: '600' }}>সর্বমোট খরচ: </span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>{formatCurrency(totalExpenseAmount)}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px', alignItems: 'start' }}>
        {/* Add Expense Form */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdAdd color="#2563eb" size={20} /> নতুন খরচ যুক্ত করুন
          </h3>
          <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                খরচের বিবরণ *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: চলতি মাসের বিদ্যুৎ বিল"
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                টাকার পরিমাণ (৳) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                খরচের ক্যাটাগরি
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                অতিরিক্ত নোট
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="বিল নং বা অন্য কোনো তথ্য"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                marginTop: '6px',
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                background: '#dc2626',
                color: '#fff',
                fontWeight: '700',
                fontSize: '14px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'যোগ হচ্ছে...' : 'খরচ সংরক্ষণ করুন'}
            </button>
          </form>
        </div>

        {/* Expenses Table */}
        <div className="table-responsive">
          <table className="pos-table">
            <thead>
              <tr>
                <th>তারিখ</th>
                <th>বিবরণ</th>
                <th>ক্যাটাগরি</th>
                <th>পরিমাণ</th>
                <th style={{ textAlign: 'center' }}>অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>{formatDate(e.createdAt)}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600', color: '#0f172a' }}>{e.title}</div>
                    {e.note && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{e.note}</div>}
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>
                      {e.category}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontWeight: '800', color: '#dc2626' }}>{formatCurrency(e.amount)}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => handleDelete(e.id)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <MdDelete size={18} />
                    </button>
                  </td>
                </tr>
              ))}

              {expenses.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    কোনো খরচের হিসাব নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ExpenseManager;
