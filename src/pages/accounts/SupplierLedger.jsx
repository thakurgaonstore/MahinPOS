import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  MdLocalShipping,
  MdAdd,
  MdPayment,
  MdReceipt,
  MdSearch,
  MdLayers,
  MdHistory,
  MdAttachMoney,
  MdCheckCircle,
  MdClose
} from 'react-icons/md';
import SupplierStatementModal from './SupplierStatementModal';
import { recordSupplierTransaction } from '../../utils/ledgerManager';

const SupplierLedger = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [initialDue, setInitialDue] = useState('');

  // Payment Modal state
  const [activeSupplierForPay, setActiveSupplierForPay] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [voucherNo, setVoucherNo] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Direct Purchase / Bill Modal state
  const [activeSupplierForBill, setActiveSupplierForBill] = useState(null);
  const [billTotal, setBillTotal] = useState('');
  const [billPaid, setBillPaid] = useState('');
  const [billVoucher, setBillVoucher] = useState('');
  const [billNote, setBillNote] = useState('');
  const [submittingBill, setSubmittingBill] = useState(false);

  // Statement Modal state
  const [statementSupplier, setStatementSupplier] = useState(null);

  useEffect(() => {
    if (!shopId) return;
    const unsub = onSnapshot(collection(db, 'shops', shopId, 'suppliers'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSuppliers(list);
    });
    return () => unsub();
  }, [shopId]);

  const filteredSuppliers = suppliers.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.company || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    );
  });

  const totalDuesPayable = suppliers.reduce((sum, s) => sum + (Number(s.duePayable) || 0), 0);
  const totalPurchases = suppliers.reduce((sum, s) => sum + (Number(s.totalPurchased) || 0), 0);

  // Add new Supplier
  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error('সাপ্লায়ারের নাম ও মোবাইল নম্বর দিন');
      return;
    }

    try {
      const initDueNum = Math.max(0, Number(initialDue) || 0);

      const docRef = await addDoc(collection(db, 'shops', shopId, 'suppliers'), {
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
        totalPurchased: 0,
        duePayable: initDueNum,
        createdAt: serverTimestamp()
      });

      // If initial due was entered, record an opening balance transaction
      if (initDueNum > 0) {
        await recordSupplierTransaction(shopId, {
          supplierId: docRef.id,
          supplierName: name.trim(),
          supplierCompany: company.trim(),
          supplierPhone: phone.trim(),
          type: 'opening_balance',
          billAmount: 0,
          paidAmount: 0,
          dueAmount: initDueNum,
          note: 'সাপ্লায়ার খাতা খোলার সময় প্রারম্ভিক বকেয়া জের',
          voucherNo: 'INIT-DUE',
          recordedBy: userProfile?.name || userProfile?.email || 'Admin',
          skipEntityUpdate: true
        });
      }

      toast.success('সাপ্লায়ার সফলভাবে যুক্ত হয়েছে');
      setName('');
      setCompany('');
      setPhone('');
      setInitialDue('');
      setIsAddModalOpen(false);
    } catch (e) {
      toast.error('সাপ্লায়ার যোগ করতে সমস্যা হয়েছে');
    }
  };

  // Pay Supplier
  const handlePaySupplier = async (e) => {
    e.preventDefault();
    const amount = Number(payAmount) || 0;
    if (amount <= 0) {
      toast.error('পরিশোধের সঠিক টাকার পরিমাণ দিন');
      return;
    }

    setSubmittingPayment(true);
    try {
      await recordSupplierTransaction(shopId, {
        supplierId: activeSupplierForPay.id,
        supplierName: activeSupplierForPay.name,
        supplierCompany: activeSupplierForPay.company || '',
        supplierPhone: activeSupplierForPay.phone || '',
        type: 'payment',
        billAmount: 0,
        paidAmount: amount,
        dueAmount: -amount,
        paymentMethod: payMethod,
        voucherNo: voucherNo.trim() || `PAY-${Date.now().toString().slice(-6)}`,
        note: paymentNote.trim() || 'মহাজনকে পাওনা পরিশোধ',
        recordedBy: userProfile?.name || userProfile?.email || 'Admin'
      });

      toast.success(`"${activeSupplierForPay.name}" কে ${formatCurrency(amount)} পরিশোধ সম্পন্ন ও খাতা আপডেট হয়েছে!`);
      setActiveSupplierForPay(null);
      setPayAmount('');
      setVoucherNo('');
      setPaymentNote('');
    } catch (e) {
      toast.error('পরিশোধ সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Add Direct Bill / Purchase on Due
  const handleAddBill = async (e) => {
    e.preventDefault();
    const total = Number(billTotal) || 0;
    const paid = Number(billPaid) || 0;
    const due = Math.max(0, total - paid);

    if (total <= 0) {
      toast.error('সঠিক মোট বিলের পরিমাণ দিন');
      return;
    }

    setSubmittingBill(true);
    try {
      await recordSupplierTransaction(shopId, {
        supplierId: activeSupplierForBill.id,
        supplierName: activeSupplierForBill.name,
        supplierCompany: activeSupplierForBill.company || '',
        supplierPhone: activeSupplierForBill.phone || '',
        type: 'purchase_due',
        billAmount: total,
        paidAmount: paid,
        dueAmount: due,
        paymentMethod: paid > 0 ? 'Cash' : 'Due',
        voucherNo: billVoucher.trim() || `CH-${Date.now().toString().slice(-6)}`,
        note: billNote.trim() || 'পণ্য ক্রয় চালান এন্ট্রি',
        recordedBy: userProfile?.name || userProfile?.email || 'Admin'
      });

      toast.success(`চালান এন্ট্রি সফল! বাকি যুক্ত হয়েছে: ${formatCurrency(due)}`);
      setActiveSupplierForBill(null);
      setBillTotal('');
      setBillPaid('');
      setBillVoucher('');
      setBillNote('');
    } catch (e) {
      toast.error('চালান সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setSubmittingBill(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdLocalShipping color="#2563eb" /> মহাজন ও সাপ্লায়ার খাতা (Suppliers Ledger)
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            মহাজনদের নিকট থেকে বাকিতে পণ্য ক্রয়, আংশিক পরিশোধ, বাৎসরিক জের ও ট্রানজ্যাকশন হিস্ট্রি
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
          <MdAdd size={18} /> নতুন সাপ্লায়ার যোগ
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>মোট তালিকাভুক্ত মহাজন</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{suppliers.length} জন</div>
        </div>
        <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', border: '1px solid #fecaca' }}>
          <span style={{ fontSize: '13px', color: '#991b1b', fontWeight: '700' }}>মহাজনদের মোট পাওনা (আমাদের দেনা)</span>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#dc2626' }}>{formatCurrency(totalDuesPayable)}</div>
        </div>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>সর্বমোট ক্রয় ভলিউম</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#059669' }}>{formatCurrency(totalPurchases)}</div>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ background: '#fff', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
        <div style={{ position: 'relative', maxWidth: '360px' }}>
          <MdSearch size={20} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="সাপ্লায়ারের নাম, কোম্পানি বা মোবাইল দিয়ে খুঁজুন..."
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-responsive">
        <table className="pos-table">
          <thead>
            <tr>
              <th>সাপ্লায়ার নাম</th>
              <th>কোম্পানি</th>
              <th>মোবাইল নম্বর</th>
              <th>মোট ক্রয়</th>
              <th>আমাদের দেনা (বাকি পাওনা)</th>
              <th style={{ textAlign: 'center' }}>হিসাব খাতা ও অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((s) => {
              const due = Number(s.duePayable) || 0;
              return (
                <tr key={s.id}>
                  <td><b>{s.name}</b></td>
                  <td>{s.company || '---'}</td>
                  <td>{s.phone}</td>
                  <td>{formatCurrency(s.totalPurchased || 0)}</td>
                  <td>
                    <span style={{ fontWeight: '800', fontSize: '14px', color: due > 0 ? '#dc2626' : '#059669' }}>
                      {formatCurrency(due)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                      {/* Statement Modal Button */}
                      <button
                        onClick={() => setStatementSupplier(s)}
                        title="মহাজন হিসাব খাতা, চালান ও পরিশোধ স্টেটমেন্ট দেখুন"
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <MdHistory size={14} /> হিসাব খাতা
                      </button>

                      {/* Add Bill Button */}
                      <button
                        onClick={() => {
                          setActiveSupplierForBill(s);
                          setBillTotal('');
                          setBillPaid('');
                        }}
                        title="নতুন চালান / বাকিতে ক্রয় এন্ট্রি করুন"
                        style={{
                          padding: '5px 8px',
                          borderRadius: '6px',
                          border: '1px solid #fed7aa',
                          background: '#fff7ed',
                          color: '#ea580c',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <MdReceipt size={14} /> +চালান
                      </button>

                      {/* Pay Button */}
                      <button
                        onClick={() => {
                          setActiveSupplierForPay(s);
                          setPayAmount(due > 0 ? due.toString() : '');
                        }}
                        title="মহাজনকে আংশিক বা পূর্ণ পরিশোধ করুন"
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          background: due > 0 ? '#059669' : '#f1f5f9',
                          color: due > 0 ? '#ffffff' : '#64748b',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <MdPayment size={14} /> পরিশোধ
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredSuppliers.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  কোনো সাপ্লায়ার পাওয়া যায়নি
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 1. Add Supplier Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#0f172a' }}>নতুন মহাজন / সাপ্লায়ার যোগ করুন</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <MdClose size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>সাপ্লায়ারের নাম *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="যেমন: রহিম ট্রেডার্স" required style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>কোম্পানি / ব্র্যান্ডের নাম</label>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="যেমন: স্কয়ার ফুড অ্যান্ড বেভারেজ" style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>মোবাইল নম্বর *</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="যেমন: 01712345678" required style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>পূর্বে কোনো বকেয়া পাওনা আছে কি? (ঐচ্ছিক প্রারম্ভিক জের)</label>
                <input type="number" step="any" min="0" value={initialDue} onChange={(e) => setInitialDue(e.target.value)} placeholder="যেমন: 5000" style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>বাতিল</button>
                <button type="submit" style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>সংরক্ষণ করুন</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Payment Modal */}
      {activeSupplierForPay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#0f172a' }}>মহাজনকে পাওনা পরিশোধ</h3>
              <button onClick={() => setActiveSupplierForPay(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <MdClose size={20} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{activeSupplierForPay.name}</div>
              <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '700' }}>
                বর্তমান বাকি পাওনা: {formatCurrency(activeSupplierForPay.duePayable || 0)}
              </div>
            </div>

            <form onSubmit={handlePaySupplier} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>পরিশোধের পরিমাণ (৳) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="যেমন: 5000"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1.5px solid #059669', fontSize: '15px', fontWeight: '800', color: '#047857' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>পেমেন্ট মেথড *</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '600' }}
                >
                  <option value="Cash">ক্যাশ (হাতে নগদ ড্রয়ার)</option>
                  <option value="Bank">ব্যাংক অ্যাকাউন্ট</option>
                  <option value="bKash">বিকাশ (bKash)</option>
                  <option value="Nagad">নগদ (Nagad)</option>
                  <option value="Agent Bank">এজেন্ট ব্যাংক</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>মানি রিসিট / চেক / ভাউচার নং</label>
                <input
                  type="text"
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  placeholder="যেমন: VR-8891 বা চেক নং"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>মন্তব্য / নোট</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="যেমন: মে মাসের চালানের কিস্তি পরিশোধ"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveSupplierForPay(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>বাতিল</button>
                <button type="submit" disabled={submittingPayment} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#059669', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>
                  {submittingPayment ? 'প্রসেস হচ্ছে...' : 'পরিশোধ নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Add Direct Bill / Purchase Modal */}
      {activeSupplierForBill && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '440px', maxHeight: '90vh', overflowY: 'auto', borderRadius: '14px', padding: '20px 24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0, color: '#0f172a' }}>নতুন ক্রয় চালান এন্ট্রি</h3>
              <button onClick={() => setActiveSupplierForBill(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <MdClose size={20} />
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>{activeSupplierForBill.name}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>কোম্পানি: {activeSupplierForBill.company || 'N/A'}</div>
            </div>

            <form onSubmit={handleAddBill} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>চালানের মোট মূল্য (৳) *</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  value={billTotal}
                  onChange={(e) => setBillTotal(e.target.value)}
                  placeholder="যেমন: 25000"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>নগদ পরিশোধের পরিমাণ (যদি থাকে)</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={billPaid}
                  onChange={(e) => setBillPaid(e.target.value)}
                  placeholder="যেমন: 10000"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700', color: '#059669' }}
                />
              </div>

              <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>নতুন বাকি দেনা হবে:</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#dc2626' }}>
                  {formatCurrency(Math.max(0, (Number(billTotal) || 0) - (Number(billPaid) || 0)))}
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>চালান / ইনভয়েস নং</label>
                <input
                  type="text"
                  value={billVoucher}
                  onChange={(e) => setBillVoucher(e.target.value)}
                  placeholder="যেমন: INV-4592"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>পণ্যের বিবরণ / নোট</label>
                <input
                  type="text"
                  value={billNote}
                  onChange={(e) => setBillNote(e.target.value)}
                  placeholder="যেমন: ৫০ বস্তা মিনিকেট চাল ক্রয়"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setActiveSupplierForBill(null)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>বাতিল</button>
                <button type="submit" disabled={submittingBill} style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#ea580c', color: '#fff', fontWeight: '700', cursor: 'pointer' }}>
                  {submittingBill ? 'সংরক্ষণ হচ্ছে...' : 'চালান সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Supplier Statement Modal */}
      {statementSupplier && (
        <SupplierStatementModal
          shopId={shopId}
          supplier={statementSupplier}
          onClose={() => setStatementSupplier(null)}
          onOpenPayment={(s) => {
            setActiveSupplierForPay(s);
            setPayAmount(Number(s.duePayable) > 0 ? s.duePayable.toString() : '');
          }}
        />
      )}
    </div>
  );
};

export default SupplierLedger;
