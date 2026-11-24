import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import QuickAddCustomerModal from '../../components/QuickAddCustomerModal';
import { MdPersonAdd, MdSearch, MdCardGiftcard, MdAttachMoney, MdPhone, MdLocationOn } from 'react-icons/md';

const CustomerManager = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Due Payment modal
  const [selectedCustForDue, setSelectedCustForDue] = useState(null);
  const [duePayAmount, setDuePayAmount] = useState('');

  useEffect(() => {
    if (!shopId) return;
    const unsub = onSnapshot(collection(db, 'shops', shopId, 'customers'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setCustomers(list);
    });
    return () => unsub();
  }, [shopId]);

  const filteredCustomers = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.address || '').toLowerCase().includes(q)
    );
  });

  const handlePayDue = async (e) => {
    e.preventDefault();
    const amount = Number(duePayAmount) || 0;
    if (amount <= 0) {
      toast.error('সঠিক টাকার পরিমাণ দিন');
      return;
    }

    try {
      const cRef = doc(db, 'shops', shopId, 'customers', selectedCustForDue.id);
      await updateDoc(cRef, {
        dueAmount: increment(-amount)
      });
      toast.success(`${formatCurrency(amount)} বাকি আদায় সফল হয়েছে!`);
      setSelectedCustForDue(null);
      setDuePayAmount('');
    } catch (err) {
      toast.error('বাকি আপডেট করতে সমস্যা হয়েছে');
    }
  };

  const totalDues = customers.reduce((a, c) => a + (Number(c.dueAmount) || 0), 0);
  const totalPoints = customers.reduce((a, c) => a + (Number(c.rewardPoints) || 0), 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>গ্রাহক ও লয়্যালটি পয়েন্ট (Customer Rewards)</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>কাস্টমার খাতা, বাকি আদায় ও রিওয়ার্ড পয়েন্টস ব্যালেন্স</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
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
            gap: '6px'
          }}
        >
          <MdPersonAdd size={18} /> নতুন কাস্টমার
        </button>
      </div>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>মোট নিবন্ধিত কাস্টমার</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>{customers.length} জন</div>
        </div>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>মোট গ্রাহক বাকি (Receivable)</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#dc2626' }}>{formatCurrency(totalDues)}</div>
        </div>
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>মোট অর্জিত রিওয়ার্ড পয়েন্ট</span>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb' }}>{totalPoints} পয়েন্ট</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ background: '#fff', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
        <div style={{ position: 'relative', maxWidth: '360px' }}>
          <MdSearch size={20} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="নাম বা মোবাইল নম্বর দিয়ে খুঁজুন..."
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="table-responsive">
        <table className="pos-table">
          <thead>
            <tr>
              <th>কাস্টমারের নাম</th>
              <th>ধরণ (Type)</th>
              <th>মোবাইল নম্বর</th>
              <th>ঠিকানা</th>
              <th>মোট ক্রয়</th>
              <th>বাকি পাওনা</th>
              <th>রিওয়ার্ড পয়েন্ট</th>
              <th style={{ textAlign: 'center' }}>বাকি আদায়</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((c) => {
              const type = c.customerType || 'retail';
              return (
                <tr key={c.id}>
                  <td>
                    <span style={{ fontWeight: '700', color: '#0f172a' }}>{c.name}</span>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: type === 'dealer' ? '#f5f3ff' : type === 'wholesale' ? '#ecfdf5' : '#eff6ff',
                      color: type === 'dealer' ? '#7c3aed' : type === 'wholesale' ? '#059669' : '#2563eb',
                      border: '1px solid',
                      borderColor: type === 'dealer' ? '#ddd6fe' : type === 'wholesale' ? '#a7f3d0' : '#bfdbfe'
                    }}>
                      {type === 'dealer' ? 'ডিলার' : type === 'wholesale' ? 'পাইকারি' : 'খুচরা'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: '#2563eb' }}>{c.phone}</span>
                  </td>
                  <td>{c.address || '---'}</td>
                  <td>
                    <span style={{ fontWeight: '600' }}>{formatCurrency(c.totalPurchases || 0)}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: '800', color: (c.dueAmount || 0) > 0 ? '#dc2626' : '#64748b' }}>
                      {formatCurrency(c.dueAmount || 0)}
                    </span>
                  </td>
                  <td>
                    {type === 'retail' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#eff6ff',
                        color: '#2563eb',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        fontWeight: '700',
                        fontSize: '12px'
                      }}>
                        <MdCardGiftcard size={14} />
                        {c.rewardPoints || 0} pt
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                        প্রযোজ্য নয়
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                  {(c.dueAmount || 0) > 0 && (
                    <button
                      onClick={() => {
                        setSelectedCustForDue(c);
                        setDuePayAmount((c.dueAmount || 0).toString());
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #10b981',
                        background: '#ecfdf5',
                        color: '#059669',
                        fontWeight: '700',
                        fontSize: '12px',
                        cursor: 'pointer'
                      }}
                    >
                      বাকি আদায়
                    </button>
                  )}
                </td>
              </tr>
            );
          })}

            {filteredCustomers.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  কোনো কাস্টমার পাওয়া যায়নি
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Add Customer Modal */}
      {isModalOpen && (
        <QuickAddCustomerModal
          shopId={shopId}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Due Collection Modal */}
      {selectedCustForDue && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#ffffff', width: '100%', maxWidth: '380px', borderRadius: '14px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>বাকি টাকা আদায়</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
              কাস্টমার: <b>{selectedCustForDue.name}</b> (বর্তমান বাকি: {formatCurrency(selectedCustForDue.dueAmount)})
            </p>
            <form onSubmit={handlePayDue}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                  জমা টাকা (৳)
                </label>
                <input
                  type="number"
                  value={duePayAmount}
                  onChange={(e) => setDuePayAmount(e.target.value)}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', fontWeight: '700' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCustForDue(null)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', fontWeight: '700' }}
                >
                  আদায় নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerManager;
