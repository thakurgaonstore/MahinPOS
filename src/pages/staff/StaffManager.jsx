import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { hashPassword } from '../../utils/cryptoHelper';
import { toast } from 'react-hot-toast';
import { MdPersonAdd, MdEdit, MdDelete, MdLock, MdPhone, MdBadge } from 'react-icons/md';

const StaffManager = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [staffList, setStaffList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('cashier'); // 'manager' | 'cashier' | 'accountant'
  const [status, setStatus] = useState('Active');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    const unsub = onSnapshot(collection(db, 'shops', shopId, 'staff'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setStaffList(list);
    });
    return () => unsub();
  }, [shopId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !phone || (!editingStaff && !password)) {
      toast.error('সকল প্রয়োজনীয় তথ্য পূরণ করুন');
      return;
    }

    setLoading(true);
    try {
      const staffData = {
        name: name.trim(),
        phone: phone.trim(),
        role,
        status,
        updatedAt: serverTimestamp()
      };

      if (password.trim()) {
        staffData.password = await hashPassword(password.trim());
      }

      if (editingStaff?.id) {
        await setDoc(doc(db, 'shops', shopId, 'staff', editingStaff.id), staffData, { merge: true });
        toast.success('স্টাফ তথ্য আপডেট হয়েছে');
      } else {
        staffData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'shops', shopId, 'staff'), staffData);
        toast.success('নতুন স্টাফ যুক্ত হয়েছে');
      }

      setIsModalOpen(false);
      setEditingStaff(null);
      setName('');
      setPhone('');
      setPassword('');
    } catch (err) {
      toast.error('সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, sName) => {
    if (!window.confirm(`আপনি কি "${sName}" এর স্টাফ অ্যাকাউন্ট মুছে ফেলতে চান?`)) return;
    try {
      await deleteDoc(doc(db, 'shops', shopId, 'staff', id));
      toast.success('স্টাফ মুছে ফেলা হয়েছে');
    } catch (e) {
      toast.error('মুছতে সমস্যা হয়েছে');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>স্টাফ ও পারমিশন ম্যানেজমেন্ট</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>দোকানের ম্যানেজার, ক্যাশিয়ার ও হিসাবরক্ষক কর্মী তালিকা</p>
        </div>

        <button
          onClick={() => {
            setEditingStaff(null);
            setName('');
            setPhone('');
            setPassword('');
            setRole('cashier');
            setIsModalOpen(true);
          }}
          style={{ padding: '9px 18px', borderRadius: '8px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '700', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <MdPersonAdd size={18} /> নতুন স্টাফ যোগ
        </button>
      </div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#1e40af' }}>
        💡 <b>স্টাফ লগইন সিস্টেম:</b> স্টাফগণ <b>/poserp</b> লিংকে গিয়ে দোকান কোড <b>({shopId})</b>, মোবাইল নম্বর এবং পাসওয়ার্ড দিয়ে দ্রুত লগইন করতে পারবেন।
      </div>

      <div className="table-responsive">
        <table className="pos-table">
          <thead>
            <tr>
              <th>স্টাফ নাম</th>
              <th>মোবাইল নম্বর</th>
              <th>রোল / পদবী</th>
              <th>স্ট্যাটাস</th>
              <th style={{ textAlign: 'center' }}>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b></td>
                <td>{s.phone}</td>
                <td>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: '700',
                    background: s.role === 'manager' ? '#eff6ff' : s.role === 'accountant' ? '#fef3c7' : '#ecfdf5',
                    color: s.role === 'manager' ? '#2563eb' : s.role === 'accountant' ? '#d97706' : '#059669',
                    textTransform: 'capitalize'
                  }}>
                    {s.role}
                  </span>
                </td>
                <td>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: s.status === 'Active' ? '#059669' : '#dc2626' }}>
                    {s.status === 'Active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                  </span>
                </td>
                <td style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button
                      onClick={() => {
                        setEditingStaff(s);
                        setName(s.name);
                        setPhone(s.phone);
                        setPassword('');
                        setRole(s.role || 'cashier');
                        setStatus(s.status || 'Active');
                        setIsModalOpen(true);
                      }}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
                    >
                      <MdEdit size={16} color="#2563eb" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #fecaca', background: '#fee2e2', cursor: 'pointer' }}
                    >
                      <MdDelete size={16} color="#dc2626" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {staffList.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                  কোনো স্টাফ অ্যাকাউন্ট নেই
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Staff Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '440px', borderRadius: '14px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px' }}>
              {editingStaff ? 'স্টাফ তথ্য সংশোধন' : 'নতুন স্টাফ যুক্ত করুন'}
            </h3>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>স্টাফের পুরো নাম *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>মোবাইল নম্বর (লগইন ইউজারনেম) *</label>
                <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>
                  পাসওয়ার্ড {editingStaff && '(পরিবর্তন করতে চাইলে লিখুন)'}
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>রোল / পদবী</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>
                  <option value="cashier">ক্যাশিয়ার / সেলসম্যান (শুধুমাত্র বিক্রয় ও বিলিং)</option>
                  <option value="manager">ম্যানেজার (ইনভেন্টরি, স্টক ও বিক্রয় পরিচালনা)</option>
                  <option value="accountant">হিসাবরক্ষক (খরচ, লাভ-ক্ষতি ও বাকি আদায়)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>স্ট্যাটাস</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>
                  <option value="Active">Active (সক্রিয়)</option>
                  <option value="Inactive">Inactive (নিষ্ক্রিয়)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}>বাতিল</button>
                <button type="submit" disabled={loading} style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '700' }}>
                  {loading ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManager;
