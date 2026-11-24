import React, { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-hot-toast';
import { MdClose, MdPersonAdd } from 'react-icons/md';

const QuickAddCustomerModal = ({ shopId, onClose, onCustomerAdded, initialPhone = '' }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState(initialPhone || '');
  const [address, setAddress] = useState('');
  const [customerType, setCustomerType] = useState('retail'); // 'retail' | 'wholesale' | 'dealer'
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !phone) {
      toast.error('কাস্টমারের নাম ও মোবাইল নম্বর দিন');
      return;
    }

    setLoading(true);
    try {
      const custData = {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        customerType: customerType || 'retail',
        rewardPoints: 0,
        totalPurchases: 0,
        dueAmount: 0,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'shops', shopId, 'customers'), custData);
      toast.success('নতুন কাস্টমার যুক্ত হয়েছে!');
      onCustomerAdded({ id: docRef.id, ...custData });
      onClose();
    } catch (err) {
      console.error("Error adding customer:", err);
      toast.error('কাস্টমার যোগ করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 110,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '420px',
        borderRadius: '14px',
        padding: '24px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdPersonAdd color="#2563eb" />
            নতুন কাস্টমার নিবন্ধন
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
            <MdClose size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              কাস্টমারের ধরণ (Customer Type) *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {[
                { id: 'retail', label: '🛒 খুচরা (Retail)', desc: 'পয়েন্ট সুবিধা প্রযোজ্য' },
                { id: 'wholesale', label: '📦 পাইকারি (Wholesale)', desc: 'পয়েন্ট প্রযোজ্য নয়' },
                { id: 'dealer', label: '🏢 ডিলার (Dealer)', desc: 'পয়েন্ট প্রযোজ্য নয়' }
              ].map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setCustomerType(tier.id)}
                  style={{
                    padding: '8px 4px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: customerType === tier.id ? '#2563eb' : '#cbd5e1',
                    background: customerType === tier.id ? '#eff6ff' : '#ffffff',
                    color: customerType === tier.id ? '#1e40af' : '#475569',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  {tier.label}
                </button>
              ))}
            </div>
            {customerType !== 'retail' && (
              <span style={{ fontSize: '11px', color: '#b45309', marginTop: '4px', display: 'block', fontWeight: '600' }}>
                ⚠️ পাইকারি ও ডিলার কাস্টমারদের কোনো রিওয়ার্ড পয়েন্ট অর্জিত বা রিডিম হবে না।
              </span>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
              কাস্টমারের নাম *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="যেমন: মোঃ রফিকুল ইসলাম"
              required
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
              মোবাইল নম্বর *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01700000000"
              required
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
              ঠিকানা
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="গ্রাম/রোড, এলাকা, থানা"
              style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'সংরক্ষণ হচ্ছে...' : 'কাস্টমার যুক্ত করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickAddCustomerModal;
