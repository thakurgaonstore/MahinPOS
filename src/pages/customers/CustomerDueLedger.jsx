import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  MdRequestQuote,
  MdSearch,
  MdHistory,
  MdPayment,
  MdPersonAdd,
  MdClose,
  MdPhone,
  MdLocationOn
} from 'react-icons/md';
import QuickAddCustomerModal from '../../components/QuickAddCustomerModal';
import CustomerStatementModal from './CustomerStatementModal';
import { recordCustomerTransaction } from '../../utils/ledgerManager';

const CustomerDueLedger = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [dueFilter, setDueFilter] = useState('due_only'); // 'due_only' | 'all'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'retail' | 'wholesale' | 'dealer'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Due Collection Modal
  const [selectedCustForDue, setSelectedCustForDue] = useState(null);
  const [duePayAmount, setDuePayAmount] = useState('');
  const [duePayMethod, setDuePayMethod] = useState('Cash');
  const [duePayNote, setDuePayNote] = useState('');
  const [submittingDue, setSubmittingDue] = useState(false);

  // Statement Modal
  const [statementCustomer, setStatementCustomer] = useState(null);

  useEffect(() => {
    if (!shopId) return;
    const unsub = onSnapshot(collection(db, 'shops', shopId, 'customers'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      // Sort highest due first
      list.sort((a, b) => (Number(b.dueAmount) || 0) - (Number(a.dueAmount) || 0));
      setCustomers(list);
    });
    return () => unsub();
  }, [shopId]);

  const filteredCustomers = customers.filter((c) => {
    const due = Number(c.dueAmount) || 0;
    if (dueFilter === 'due_only' && due <= 0) return false;

    const cType = c.customerType || 'retail';
    if (typeFilter !== 'all' && cType !== typeFilter) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.address || '').toLowerCase().includes(q)
    );
  });

  const dueCustomersCount = customers.filter((c) => (Number(c.dueAmount) || 0) > 0).length;
  const totalDuesReceivable = customers.reduce((sum, c) => sum + Math.max(0, Number(c.dueAmount) || 0), 0);
  const totalPurchasesVolume = customers.reduce((sum, c) => sum + (Number(c.totalPurchases) || 0), 0);

  const handlePayDue = async (e) => {
    e.preventDefault();
    const amount = Number(duePayAmount) || 0;
    if (amount <= 0) {
      toast.error('সঠিক টাকার পরিমাণ দিন');
      return;
    }

    setSubmittingDue(true);
    try {
      await recordCustomerTransaction(shopId, {
        customerId: selectedCustForDue.id,
        customerName: selectedCustForDue.name,
        customerPhone: selectedCustForDue.phone || '',
        type: 'payment',
        billAmount: 0,
        paidAmount: amount,
        dueAmount: -amount,
        paymentMethod: duePayMethod,
        note: duePayNote.trim() || 'কাস্টমারের নিকট হতে বাকি আদায়',
        recordedBy: userProfile?.name || userProfile?.email || 'Admin'
      });

      toast.success(`${formatCurrency(amount)} বাকি আদায় সফলভাবে সংরক্ষিত হয়েছে!`);
      setSelectedCustForDue(null);
      setDuePayAmount('');
      setDuePayNote('');
    } catch (err) {
      console.error('Error paying customer due:', err);
      toast.error('বাকি আপডেট করতে সমস্যা হয়েছে');
    } finally {
      setSubmittingDue(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdRequestQuote color="#dc2626" /> কাস্টমার বাকি খাতা (Customer Due Ledger)
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            খুচরা, পাইকারি ও ডিলার কাস্টমারদের বাকির হিসাব, বাকি আদায়, বাৎসরিক জের ও ট্রানজ্যাকশন স্টেটমেন্ট
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          style={{
            padding: '9px 18px',
            borderRadius: '8px',
            border: 'none',
            background: '#2563eb',
            color: '#fff',
            fontWeight: '700',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 6px -1px rgba(37,99,235,0.3)'
          }}
        >
          <MdPersonAdd size={18} /> নতুন কাস্টমার / প্রারম্ভিক বাকি
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', border: '1px solid #fecaca' }}>
          <span style={{ fontSize: '13px', color: '#991b1b', fontWeight: '700' }}>মোট কাস্টমার বাকি পাওনা (Receivable)</span>
          <div style={{ fontSize: '26px', fontWeight: '900', color: '#dc2626' }}>{formatCurrency(totalDuesReceivable)}</div>
        </div>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>বাকি থাকা কাস্টমার সংখ্যা</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{dueCustomersCount} জন</div>
        </div>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>সর্বমোট কাস্টমার বিক্রয় ভলিউম</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669' }}>{formatCurrency(totalPurchasesVolume)}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        background: '#fff',
        padding: '14px',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        marginBottom: '16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
          <MdSearch size={20} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="কাস্টমারের নাম, মোবাইল বা ঠিকানা দিয়ে খুঁজুন..."
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setDueFilter('due_only')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: dueFilter === 'due_only' ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
              background: dueFilter === 'due_only' ? '#fef2f2' : '#ffffff',
              color: dueFilter === 'due_only' ? '#dc2626' : '#475569',
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            শুধুমাত্র বাকি আছে ({dueCustomersCount})
          </button>
          <button
            onClick={() => setDueFilter('all')}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: dueFilter === 'all' ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
              background: dueFilter === 'all' ? '#eff6ff' : '#ffffff',
              color: dueFilter === 'all' ? '#1d4ed8' : '#475569',
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            সকল কাস্টমার ({customers.length})
          </button>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              fontWeight: '600',
              color: '#334155',
              background: '#f8fafc',
              outline: 'none'
            }}
          >
            <option value="all">সকল কাস্টমার ধরন</option>
            <option value="retail">খুচরা (Retail)</option>
            <option value="wholesale">পাইকারি (Wholesale)</option>
            <option value="dealer">ডিলার (Dealer)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="pos-table">
          <thead>
            <tr>
              <th>কাস্টমার নাম ও ধরন</th>
              <th>মোবাইল নম্বর</th>
              <th>ঠিকানা</th>
              <th>মোট ক্রয়</th>
              <th>বর্তমান বাকি (Receivable)</th>
              <th style={{ textAlign: 'center' }}>হিসাব খাতা ও বাকি আদায়</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => {
              const type = c.customerType || 'retail';
              const due = Number(c.dueAmount) || 0;
              const typeBadge =
                type === 'wholesale' ? { label: 'পাইকারি', bg: '#ecfdf5', color: '#059669' } :
                type === 'dealer' ? { label: 'ডিলার', bg: '#f5f3ff', color: '#7c3aed' } :
                { label: 'খুচরা', bg: '#eff6ff', color: '#2563eb' };

              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <b>{c.name}</b>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 7px',
                        borderRadius: '10px',
                        fontWeight: '700',
                        background: typeBadge.bg,
                        color: typeBadge.color
                      }}>
                        {typeBadge.label}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: '#2563eb', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <MdPhone size={13} /> {c.phone || '---'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      {c.address ? <><MdLocationOn size={13} /> {c.address}</> : '---'}
                    </span>
                  </td>
                  <td>{formatCurrency(c.totalPurchases || 0)}</td>
                  <td>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: due > 0 ? '#dc2626' : '#059669' }}>
                      {formatCurrency(due)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                      <button
                        onClick={() => setStatementCustomer(c)}
                        title="কাস্টমার হিসাব খাতা, প্রারম্ভিক জের ও লেনদেন বিবরণী দেখুন"
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontWeight: '700',
                          fontSize: '12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <MdHistory size={14} /> হিসাব খাতা
                      </button>

                      {due > 0 && (
                        <button
                          onClick={() => {
                            setSelectedCustForDue(c);
                            setDuePayAmount(due.toString());
                          }}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: 'none',
                            background: '#059669',
                            color: '#ffffff',
                            fontWeight: '700',
                            fontSize: '12px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <MdPayment size={14} /> বাকি আদায়
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                  {dueFilter === 'due_only'
                    ? 'কোনো কাস্টমারের কাছে বাকি পাওনা নেই!'
                    : 'কোনো কাস্টমার পাওয়া যায়নি'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Add Customer Modal */}
      {isAddModalOpen && (
        <QuickAddCustomerModal
          shopId={shopId}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* Due Collection Modal */}
      {selectedCustForDue && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '420px', borderRadius: '14px', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#0f172a' }}>বাকি টাকা আদায়</h3>
              <button onClick={() => setSelectedCustForDue(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <MdClose size={20} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{selectedCustForDue.name}</div>
              <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '700' }}>
                বর্তমান মোট বাকি: {formatCurrency(selectedCustForDue.dueAmount)}
              </div>
            </div>

            <form onSubmit={handlePayDue} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  জমা টাকা (৳) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={duePayAmount}
                  onChange={(e) => setDuePayAmount(e.target.value)}
                  required
                  placeholder="যেমন: 1500"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid #10b981', fontSize: '16px', fontWeight: '800', color: '#047857' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  পেমেন্ট মাধ্যম *
                </label>
                <select
                  value={duePayMethod}
                  onChange={(e) => setDuePayMethod(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
                >
                  <option value="Cash">ক্যাশ (হাতে নগদ)</option>
                  <option value="Bank">ব্যাংক অ্যাকাউন্ট</option>
                  <option value="bKash">বিকাশ (bKash)</option>
                  <option value="Nagad">নগদ (Nagad)</option>
                  <option value="Agent Bank">এজেন্ট ব্যাংক</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  অতিরিক্ত মন্তব্য / নোট
                </label>
                <input
                  type="text"
                  value={duePayNote}
                  onChange={(e) => setDuePayNote(e.target.value)}
                  placeholder="যেমন: বাকির আংশিক পরিশোধ"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCustForDue(null)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submittingDue}
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#059669', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
                >
                  {submittingDue ? 'সংরক্ষণ হচ্ছে...' : 'আদায় নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Statement Modal */}
      {statementCustomer && (
        <CustomerStatementModal
          shopId={shopId}
          customer={statementCustomer}
          onClose={() => setStatementCustomer(null)}
          onOpenPayment={(c) => {
            setSelectedCustForDue(c);
            setDuePayAmount((Number(c.dueAmount) || 0).toString());
          }}
        />
      )}
    </div>
  );
};

export default CustomerDueLedger;
