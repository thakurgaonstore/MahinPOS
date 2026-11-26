import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  MdAdd,
  MdReceipt,
  MdDelete,
  MdFilterList,
  MdSearch,
  MdDeleteSweep,
  MdDateRange,
  MdFlashOn
} from 'react-icons/md';
import DataArchiveModal from '../settings/DataArchiveModal';
import { debitAccountFromExpense, creditAccountFromSale, ACCOUNT_KEYS } from '../../utils/financialAccountsManager';

const ExpenseManager = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';
  const role = userProfile?.role || 'cashier';
  const isOwner = role === 'shop_admin' || role === 'manager' || userProfile?.isImpersonating;

  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('দোকান ভাড়া');
  const [paymentAccount, setPaymentAccount] = useState('cash');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Time & Category Filters
  const [timeRange, setTimeRange] = useState('month'); // 'month' | 'today' | 'year' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  // Pagination (100 records = 4 pages of 25 items)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  useEffect(() => {
    setCurrentPage(1);
  }, [timeRange, searchQuery, filterCategory]);

  const categories = [
    'দোকান ভাড়া',
    'বিদ্যুৎ ও ইউটিলিটি বিল',
    'স্টাফ বেতন ও বোনাস',
    'আপ্যায়ন ও চা-নাস্তা',
    'পরিবহন ও ডেলিভারি',
    'মেরামত ও রক্ষণাবেক্ষণ',
    'বিজ্ঞাপন ও প্রচারণা',
    'নষ্ট ও ড্যামেজ পণ্য',
    'অন্যান্য খরচ'
  ];

  useEffect(() => {
    if (!shopId) return;

    // Load recent 100 expenses ordered by createdAt desc to minimize quota and ensure fast loading
    const q = query(
      collection(db, 'shops', shopId, 'expenses'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setExpenses(list);
    }, (err) => {
      console.warn("Expenses query error, fallback to default collection listener:", err);
      const fallbackUnsub = onSnapshot(collection(db, 'shops', shopId, 'expenses'), (snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => ((b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)));
        setExpenses(list);
      });
      return () => fallbackUnsub();
    });

    return () => unsub();
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
    return true; // 'all'
  };

  const filteredExpenses = expenses.filter((e) => {
    if (!isMatchPeriod(e.createdAt || e.date)) return false;
    if (filterCategory !== 'All' && e.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = (e.title || '').toLowerCase().includes(q);
      const matchesCat = (e.category || '').toLowerCase().includes(q);
      const matchesNote = (e.note || '').toLowerCase().includes(q);
      if (!matchesTitle && !matchesCat && !matchesNote) return false;
    }
    return true;
  });

  const totalExpenseAmount = filteredExpenses.reduce((a, b) => a + (Number(b.amount) || 0), 0);

  // Paginated Slicing
  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / itemsPerPage));
  const paginatedExpenses = filteredExpenses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!title || !amount) {
      toast.error('খরচের শিরোনাম ও টাকার পরিমাণ লিখুন');
      return;
    }

    const numAmount = Number(amount) || 0;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'shops', shopId, 'expenses'), {
        title: title.trim(),
        amount: numAmount,
        category,
        paymentAccount,
        note: note.trim(),
        recordedBy: userProfile?.name || 'Admin',
        createdAt: serverTimestamp()
      });

      // Auto-debit the corresponding financial account balance
      if (numAmount > 0) {
        debitAccountFromExpense(shopId, paymentAccount, numAmount).catch((err) => {
          console.warn("Auto-debit from account failed:", err);
        });
      }

      toast.success('খরচ সফলভাবে যুক্ত হয়েছে');
      setTitle('');
      setAmount('');
      setNote('');
    } catch (err) {
      console.error("Save expense error:", err);
      toast.error('খরচ সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, expAmount, expAccount = 'cash') => {
    if (!window.confirm('এই খরচের এন্ট্রিটি মুছে ফেলতে চান?')) return;
    try {
      await deleteDoc(doc(db, 'shops', shopId, 'expenses', id));
      if (expAmount) {
        creditAccountFromSale(shopId, expAccount, expAmount).catch(() => {});
      }
      toast.success('খরচ মুছে ফেলা হয়েছে');
    } catch (e) {
      toast.error('মুছতে সমস্যা হয়েছে');
    }
  };

  return (
    <div>
      {/* Top Banner & Summary */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            দোকানের খরচের খাতা (Expense Manager)
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
            দোকানের প্রতিদিনের ও মাসিক খরচের সার্বিক হিসাব ও বাজেট নিয়ন্ত্রণ
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsArchiveModalOpen(true)}
              title="বিগত বছরের পুরাতন ইনভয়েস ও খরচ ব্যাকআপ নিয়ে ডিলিট করুন"
              style={{
                padding: '9px 14px',
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
              <MdDeleteSweep size={18} color="#ea580c" /> পুরাতন ডাটা আর্কাইভ / ডিলিট
            </button>
          )}

          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 18px', borderRadius: '10px' }}>
            <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: '700' }}>
              {timeRange === 'today' ? 'আজকের মোট খরচ' : timeRange === 'month' ? 'চলতি মাসের মোট খরচ' : timeRange === 'year' ? 'চলতি বছরের মোট খরচ' : 'নির্বাচিত মোট খরচ'}:{' '}
            </span>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626' }}>
              {formatCurrency(totalExpenseAmount)}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 2fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Side: Add Expense Form */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MdAdd color="#2563eb" size={20} /> নতুন খরচ যুক্ত করুন
          </h3>
          <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                খরচের বিবরণ *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: চলতি মাসের বিদ্যুৎ বিল বা দোকান ভাড়া"
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                টাকার পরিমাণ (৳) *
              </label>
              <input
                type="number"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px', fontWeight: '700' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                টাকা পরিশোধের মাধ্যম / অ্যাকাউন্ট
              </label>
              <select
                value={paymentAccount}
                onChange={(e) => setPaymentAccount(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: '13px', fontWeight: '700' }}
              >
                <option value="cash">💵 ক্যাশ (হাতে নগদ/ড্রয়ার)</option>
                <option value="bank">🏦 ব্যাংক অ্যাকাউন্ট</option>
                <option value="bkash">📱 বিকাশ (bKash)</option>
                <option value="nagad">🟠 নগদ (Nagad)</option>
                <option value="agent_bank">🏛️ এজেন্ট ব্যাংক</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                খরচের খাত / ক্যাটাগরি
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff', fontSize: '13px' }}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                অতিরিক্ত মন্তব্য / ভাউচার নং
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="বিল নং, চেক নং বা অন্য কোনো তথ্য"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px' }}
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
                fontWeight: '800',
                fontSize: '14px',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
              }}
            >
              <MdAdd size={18} />
              {isSubmitting ? 'যোগ হচ্ছে...' : 'খরচ সংরক্ষণ করুন'}
            </button>
          </form>
        </div>

        {/* Right Side: Expense Filter & Audit Table */}
        <div style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            {/* Period Selector Tabs */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '4px', flexWrap: 'wrap' }}>
              {[
                { id: 'month', label: '📆 চলতি মাস' },
                { id: 'today', label: '📅 আজ' },
                { id: 'year', label: '📈 চলতি বছর' },
                { id: 'all', label: '📊 সকল রেকর্ড' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTimeRange(tab.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: timeRange === tab.id ? '#2563eb' : 'transparent',
                    color: timeRange === tab.id ? '#ffffff' : '#475569',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Quota optimization tag */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#059669', background: '#ecfdf5', padding: '4px 9px', borderRadius: '6px', fontWeight: '700' }}>
              <MdFlashOn size={14} /> অপ্টিমাইজড ভিউ (সর্বশেষ ১০০ রেকর্ড | ৪টি পেজিনেশন)
            </div>
          </div>

          {/* Search & Category Filter Row */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <MdSearch size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="খরচের নাম বা নোট দিয়ে খুঁজুন..."
                style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px' }}
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#fff', color: '#334155' }}
            >
              <option value="All">সকল ক্যাটাগরি ({expenses.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Expenses Table */}
          <div className="table-responsive">
            <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px' }}>তারিখ</th>
                  <th style={{ padding: '10px' }}>বিবরণ</th>
                  <th style={{ padding: '10px' }}>ক্যাটাগরি</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>পরিমাণ</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', color: '#64748b', fontSize: '12px' }}>
                      {formatDate(e.createdAt || e.date)}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{e.title}</div>
                      {e.note && <div style={{ fontSize: '11px', color: '#94a3b8' }}>{e.note}</div>}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '4px', fontWeight: '600' }}>
                        {e.category}
                      </span>
                      {e.paymentAccount && e.paymentAccount !== 'cash' && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#2563eb', fontWeight: '700', marginTop: '2px' }}>
                          পেমেন্ট: {ACCOUNT_KEYS[e.paymentAccount]?.shortName || e.paymentAccount}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'right' }}>
                      <span style={{ fontWeight: '800', color: '#dc2626' }}>{formatCurrency(e.amount)}</span>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleDelete(e.id, Number(e.amount), e.paymentAccount || 'cash')}
                        title="এই খরচের এন্ট্রি মুছে ফেলুন"
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <MdDelete size={18} />
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      <div>কোনো খরচের রেকর্ড পাওয়া যায়নি</div>
                      {timeRange !== 'all' && (
                        <button
                          type="button"
                          onClick={() => setTimeRange('all')}
                          style={{
                            marginTop: '8px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#2563eb',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          সকল রেকর্ড দেখুন
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Clean Pagination Bar (25 items per page, up to 4 pages for 100 items) */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '10px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                দেখানো হচ্ছে {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredExpenses.length)} / মোট {filteredExpenses.length} টি রেকর্ড (পেজ {currentPage} / {totalPages})
              </span>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: '5px 10px',
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
                      padding: '5px 11px',
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
                    padding: '5px 10px',
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
        </div>
      </div>

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

export default ExpenseManager;
