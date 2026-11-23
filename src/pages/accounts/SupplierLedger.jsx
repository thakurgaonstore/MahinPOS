import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import { MdLocalShipping, MdAdd, MdPayment, MdReceipt } from 'react-icons/md';

const SupplierLedger = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [suppliers, setSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');

  // Payment to supplier
  const [activeSupplier, setActiveSupplier] = useState(null);
  const [payAmount, setPayAmount] = useState('');

  useEffect(() => {
    if (!shopId) return;
    const unsub = onSnapshot(collection(db, 'shops', shopId, 'suppliers'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSuppliers(list);
    });
    return () => unsub();
  }, [shopId]);

  const handleAddSupplier = async (e) => {
    e.preventDefault();
    if (!name || !phone) return;
    try {
      await addDoc(collection(db, 'shops', shopId, 'suppliers'), {
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
        totalPurchased: 0,
        duePayable: 0,
        createdAt: serverTimestamp()
      });
      toast.success('সাপ্লায়ার যুক্ত হয়েছে');
      setName('');
      setCompany('');
      setPhone('');
      setIsModalOpen(false);
    } catch (e) {
      toast.error('সমস্যা হয়েছে');
    }
  };

  const handlePaySupplier = async (e) => {
    e.preventDefault();
    const amount = Number(payAmount) || 0;
    if (amount <= 0) return;
    try {
      await updateDoc(doc(db, 'shops', shopId, 'suppliers', activeSupplier.id), {
        duePayable: increment(-amount)
      });
      toast.success('সাপ্লায়ারকে পরিশোধ সম্পন্ন');
      setActiveSupplier(null);
      setPayAmount('');
    } catch (e) {
      toast.error('সমস্যা হয়েছে');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>মহাজন ও সাপ্লায়ার খাতা (Suppliers)</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>পাইকার ও ডিলারদের পাওনা এবং ক্রয়ের হিসাব</p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <MdAdd size={18} /> নতুন সাপ্লায়ার যোগ
        </button>
      </div>

      <div className="table-responsive">
        <table className="pos-table">
          <thead>
            <tr>
              <th>সাপ্লায়ার নাম</th>
              <th>কোম্পানি</th>
              <th>মোবাইল নম্বর</th>
              <th>মোট ক্রয়</th>
              <th>আমাদের দেনা (Payable)</th>
              <th style={{ textAlign: 'center' }}>পেমেন্ট</th>
            </tr>
          </thead>
          <tbody>
            {suppliers.map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b></td>
                <td>{s.company || '---'}</td>
                <td>{s.phone}</td>
                <td>{formatCurrency(s.totalPurchased || 0)}</td>
                <td>
                  <span style={{ fontWeight: '800', color: (s.duePayable || 0) > 0 ? '#dc2626' : '#64748b' }}>
                    {formatCurrency(s.duePayable || 0)}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {(s.duePayable || 0) > 0 && (
                    <button
                      onClick={() => { setActiveSupplier(s); setPayAmount((s.duePayable || 0).toString()); }}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                    >
                      পরিশোধ
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {suppliers.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  কোনো সাপ্লায়ার তালিকা নেই
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Supplier Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '400px', borderRadius: '14px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px' }}>নতুন সাপ্লায়ার যোগ করুন</h3>
            <form onSubmit={handleAddSupplier} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="সাপ্লায়ারের নাম *" required style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="কোম্পানির নাম" style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="মোবাইল নম্বর *" required style={{ padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>বাতিল</button>
                <button type="submit" style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '700' }}>যোগ করুন</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierLedger;
