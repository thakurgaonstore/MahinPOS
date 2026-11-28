import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  MdPayments,
  MdArrowDownward,
  MdArrowUpward,
  MdHistory,
  MdAccountBalance,
  MdSwapHoriz,
  MdAddCircle,
  MdSettings
} from 'react-icons/md';
import AccountBalancesCardGrid from '../../components/accounts/AccountBalancesCardGrid';
import { subscribeToAccountTransactions, ACCOUNT_KEYS } from '../../utils/financialAccountsManager';

const DailyCashRegister = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';
  const role = userProfile?.role || 'cashier';
  const isOwner = role === 'shop_admin' || role === 'manager' || userProfile?.isImpersonating;

  const [openingCash, setOpeningCash] = useState(() => localStorage.getItem(`openingCash_${shopId}`) || '0');
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    if (!shopId) return;

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTimestamp = Timestamp.fromDate(startOfToday);

    // Real-time sales (server-filtered for today's only — zero historical reads)
    const qSales = query(
      collection(db, 'shops', shopId, 'sales'),
      where('createdAt', '>=', todayTimestamp)
    );
    const unsubSales = onSnapshot(qSales, (snap) => {
      const list = [];
      snap.forEach((d) => list.push(d.data()));
      setSales(list);
    });

    // Real-time expenses (server-filtered for today's only — zero historical reads)
    const qExp = query(
      collection(db, 'shops', shopId, 'expenses'),
      where('createdAt', '>=', todayTimestamp)
    );
    const unsubExp = onSnapshot(qExp, (snap) => {
      const list = [];
      snap.forEach((d) => list.push(d.data()));
      setExpenses(list);
    });

    // Recent account transactions (Transfers, Add Money, Adjustments)
    const unsubTx = subscribeToAccountTransactions(shopId, (list) => {
      setTransactions(list);
    }, 40);

    return () => {
      unsubSales();
      unsubExp();
      unsubTx();
    };
  }, [shopId]);

  // Cash In (Today's Cash Sales only)
  const cashSales = sales
    .filter((s) => (s.paymentMethod || 'Cash').toLowerCase().includes('cash') || (s.paymentMethod || '').includes('নগদ'))
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
      {/* Page Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>
          দৈনিক ক্যাশ ও ব্যাংক খাতা (Cash & Multi-Account Ledger)
        </h1>
        <p style={{ fontSize: '14px', color: '#64748b' }}>
          দোকানের সকল অ্যাকাউন্ট ব্যালান্স, ব্যাংক টু ক্যাশ ট্রান্সফার, Add Money ও দৈনিক ক্যাশ ড্রয়ার ট্র্যাকার
        </p>
      </div>

      {/* 1. All Account Balances Grid (Cash, Bank, bKash, Nagad, Agent Bank, Flexiload, Total) */}
      <AccountBalancesCardGrid
        shopId={shopId}
        userProfile={userProfile}
        isOwner={isOwner}
      />

      {/* 2. Today's Physical Cash Drawer Section */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              আজকের ক্যাশ ড্রয়ার ইন-আউট হিসাব (Today's Cash Drawer)
            </h3>
            <span style={{ fontSize: '12px', color: '#64748b' }}>প্রারম্ভিক ক্যাশ + আজকের নগদ বিক্রয় - আজকের খরচ</span>
          </div>

          {/* Opening Cash Input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>সকালের প্রারম্ভিক ক্যাশ:</span>
            <input
              type="number"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="0.00"
              style={{
                width: '120px',
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1.5px solid #cbd5e1',
                fontSize: '14px',
                fontWeight: '800',
                outline: 'none',
                textAlign: 'right'
              }}
            />
            <button
              onClick={handleSaveOpening}
              style={{
                padding: '7px 14px',
                borderRadius: '6px',
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              সেভ
            </button>
          </div>
        </div>

        {/* Cash Flow Summary 4-Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '700' }}>১. প্রারম্ভিক ক্যাশ (Opening)</span>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{formatCurrency(openingCash)}</div>
          </div>

          <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '12px', color: '#15803d', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MdArrowDownward size={16} /> ২. নগদ ক্যাশ ইন (আজকের সেলস)
            </span>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#15803d', marginTop: '4px' }}>+{formatCurrency(cashSales)}</div>
          </div>

          <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', border: '1px solid #fecaca' }}>
            <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MdArrowUpward size={16} /> ৩. নগদ ক্যাশ আউট (আজকের খরচ)
            </span>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#b91c1c', marginTop: '4px' }}>-{formatCurrency(todayExpenses)}</div>
          </div>

          <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '12px', border: '2px solid #10b981' }}>
            <span style={{ fontSize: '12px', color: '#047857', fontWeight: '800' }}>৪. ড্রয়ার ক্যাশ ব্যালান্স</span>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#047857', marginTop: '4px' }}>{formatCurrency(closingCash)}</div>
          </div>
        </div>
      </div>

      {/* 3. Account Transactions & Fund Transfer Audit History */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdHistory size={20} color="#2563eb" />
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              সাম্প্রতিক ফান্ড ট্রান্সফার ও Add Money লগ (Audit Trail)
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: '#64748b' }}>সর্বশেষ {transactions.length} টি লেনদেন</span>
        </div>

        <div className="table-responsive">
          <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '10px' }}>তারিখ ও সময়</th>
                <th style={{ padding: '10px' }}>ধরন (Type)</th>
                <th style={{ padding: '10px' }}>অ্যাকাউন্ট বিবরণ</th>
                <th style={{ padding: '10px' }}>টাকার পরিমাণ</th>
                <th style={{ padding: '10px' }}>মন্তব্য / নোট</th>
                <th style={{ padding: '10px' }}>অপারেটর</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const isTransfer = tx.type === 'transfer';
                const isAddMoney = tx.type === 'add_money';
                const isAdjust = tx.type === 'adjust';

                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {formatDateTime(tx.createdAt || tx.timestamp)}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: isTransfer ? '#eff6ff' : isAddMoney ? '#ecfdf5' : '#f8fafc',
                        color: isTransfer ? '#2563eb' : isAddMoney ? '#059669' : '#475569',
                        border: `1px solid ${isTransfer ? '#bfdbfe' : isAddMoney ? '#a7f3d0' : '#e2e8f0'}`
                      }}>
                        {isTransfer ? '⇄ ট্রান্সফার' : isAddMoney ? '+ Add Money' : '⚙️ সমন্বয়'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {isTransfer ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', color: '#0f172a' }}>
                          <span style={{ color: '#dc2626' }}>{ACCOUNT_KEYS[tx.fromAccount]?.shortName || tx.fromAccount}</span>
                          <span>➔</span>
                          <span style={{ color: '#059669' }}>{ACCOUNT_KEYS[tx.toAccount]?.shortName || tx.toAccount}</span>
                        </div>
                      ) : (
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>
                          {ACCOUNT_KEYS[tx.account]?.nameBn || tx.account}
                          {tx.source && <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 'normal' }}>উৎস: {tx.source}</span>}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                      <b style={{ fontSize: '14px', color: isTransfer ? '#2563eb' : isAddMoney ? '#059669' : '#0f172a' }}>
                        {formatCurrency(tx.amount || Math.abs(tx.difference || 0))}
                      </b>
                    </td>
                    <td style={{ padding: '10px', color: '#475569', fontSize: '12px' }}>
                      {tx.note || tx.reason || '—'}
                    </td>
                    <td style={{ padding: '10px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                      {tx.operatorName || 'Admin'}
                    </td>
                  </tr>
                );
              })}

              {transactions.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    এখনো কোনো ফান্ড ট্রান্সফার বা Add Money ট্রানজ্যাকশন রেকর্ড হয়নি
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

export default DailyCashRegister;
