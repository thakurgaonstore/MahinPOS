import React, { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDate, numberToBengaliWords } from '../../utils/formatters';
import { hashPassword } from '../../utils/cryptoHelper';
import { toast } from 'react-hot-toast';
import PayrollSlipModal from './PayrollSlipModal';

import {
  MdPersonAdd,
  MdEdit,
  MdDelete,
  MdLock,
  MdPhone,
  MdBadge,
  MdDateRange,
  MdPayments,
  MdCheckCircle,
  MdCancel,
  MdAccessTime,
  MdReceipt,
  MdAttachMoney,
  MdHistoryEdu,
  MdPeopleAlt,
  MdEventAvailable
} from 'react-icons/md';

const StaffManager = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  // Navigation Tabs: 'staff' | 'attendance' | 'payroll'
  const [activeTab, setActiveTab] = useState('staff');

  // Staff State
  const [staffList, setStaffList] = useState([]);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  // Staff Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('cashier'); // 'manager' | 'cashier' | 'accountant' | 'salesman' | 'staff'
  const [baseSalary, setBaseSalary] = useState('');
  const [joinDate, setJoinDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('Active');
  const [loading, setLoading] = useState(false);

  // Attendance State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Payroll State
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [advanceRecords, setAdvanceRecords] = useState([]);

  // Payroll Disbursement Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payingStaff, setPayingStaff] = useState(null);

  // Detailed Earnings Heads
  const [basicSalary, setBasicSalary] = useState('');
  const [houseRent, setHouseRent] = useState('');
  const [medical, setMedical] = useState('');
  const [conveyance, setConveyance] = useState('');
  const [bonus, setBonus] = useState('');
  const [incentive, setIncentive] = useState('');
  const [otherAllowance, setOtherAllowance] = useState('');

  // Detailed Deductions Heads
  const [advanceDeduction, setAdvanceDeduction] = useState('');
  const [taxDeduction, setTaxDeduction] = useState('');
  const [otherDeduction, setOtherDeduction] = useState('');
  const [otherDeductionReason, setOtherDeductionReason] = useState('');

  // Payment Method & Notes
  const [payMethod, setPayMethod] = useState('Cash'); // 'Cash' | 'bKash' | 'Bank'
  const [payNote, setPayNote] = useState('');

  // Advance Salary Modal
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceStaffId, setAdvanceStaffId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceMethod, setAdvanceMethod] = useState('Cash');
  const [advanceNote, setAdvanceNote] = useState('');

  // Payroll Slip Modal State & Shop Config
  const [shopConfig, setShopConfig] = useState(null);
  const [viewingSlipRecord, setViewingSlipRecord] = useState(null);

  useEffect(() => {
    if (!shopId) return;
    getDoc(doc(db, 'shops', shopId)).then((snap) => {
      if (snap.exists()) setShopConfig(snap.data());
    }).catch(() => {});
  }, [shopId]);

  // 1. Realtime Staff List
  useEffect(() => {
    if (!shopId) return;
    const unsub = onSnapshot(collection(db, 'shops', shopId, 'staff'), (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setStaffList(list);
    });
    return () => unsub();
  }, [shopId]);

  // 2. Realtime Daily Attendance for selected date
  useEffect(() => {
    if (!shopId || !selectedDate) return;
    const unsub = onSnapshot(collection(db, 'shops', shopId, 'attendance'), (snap) => {
      const records = {};
      snap.forEach((d) => {
        const data = d.data();
        if (data.date === selectedDate) {
          records[data.staffId] = data.status;
        }
      });
      setAttendanceRecords(records);
    });
    return () => unsub();
  }, [shopId, selectedDate]);

  // 3. Realtime Payroll & Advances
  useEffect(() => {
    if (!shopId || !selectedMonth) return;
    const unsubPay = onSnapshot(collection(db, 'shops', shopId, 'payroll'), (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (data.month === selectedMonth) list.push(data);
      });
      setPayrollRecords(list);
    });

    const unsubAdv = onSnapshot(collection(db, 'shops', shopId, 'advances'), (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        if (data.month === selectedMonth) list.push(data);
      });
      setAdvanceRecords(list);
    });

    return () => {
      unsubPay();
      unsubAdv();
    };
  }, [shopId, selectedMonth]);

  // Handle Add/Edit Staff
  const handleSaveStaff = async (e) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || (!editingStaff && !password.trim())) {
      toast.error('নাম, মোবাইল নম্বর ও পাসওয়ার্ড পূরণ করুন');
      return;
    }

    setLoading(true);
    try {
      const staffData = {
        name: name.trim(),
        phone: phone.trim(),
        role,
        baseSalary: Number(baseSalary) || 0,
        joinDate: joinDate || new Date().toISOString().slice(0, 10),
        status,
        updatedAt: serverTimestamp()
      };

      if (password.trim()) {
        staffData.password = await hashPassword(password.trim());
      }

      if (editingStaff?.id) {
        await setDoc(doc(db, 'shops', shopId, 'staff', editingStaff.id), staffData, { merge: true });
        toast.success('স্টাফ তথ্য সফলভাবে আপডেট হয়েছে!');
      } else {
        staffData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'shops', shopId, 'staff'), staffData);
        toast.success('নতুন কর্মী সফলভাবে যুক্ত হয়েছে!');
      }

      setIsStaffModalOpen(false);
      setEditingStaff(null);
      setName('');
      setPhone('');
      setPassword('');
      setBaseSalary('');
    } catch (err) {
      console.error(err);
      toast.error('স্টাফ তথ্য সংরক্ষণে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  // Delete Staff
  const handleDeleteStaff = async (id, sName) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${sName}" এর একাউন্ট মুছে ফেলতে চান?`)) return;
    try {
      await deleteDoc(doc(db, 'shops', shopId, 'staff', id));
      toast.success('কর্মী একাউন্ট মুছে ফেলা হয়েছে');
    } catch (e) {
      toast.error('মুছতে ব্যর্থ হয়েছে');
    }
  };

  // Mark Individual Attendance
  const handleMarkAttendance = async (staffId, statusVal) => {
    try {
      const recordId = `${selectedDate}_${staffId}`;
      await setDoc(doc(db, 'shops', shopId, 'attendance', recordId), {
        date: selectedDate,
        staffId,
        status: statusVal,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      toast.error('হাজিরা আপডেট করতে সমস্যা হয়েছে');
    }
  };

  // Mark All Present for Date
  const handleMarkAllPresent = async () => {
    setSavingAttendance(true);
    try {
      const promises = staffList.map(s => {
        const recordId = `${selectedDate}_${s.id}`;
        return setDoc(doc(db, 'shops', shopId, 'attendance', recordId), {
          date: selectedDate,
          staffId: s.id,
          status: 'Present',
          updatedAt: serverTimestamp()
        }, { merge: true });
      });
      await Promise.all(promises);
      toast.success(`আজকের তারিখে (${selectedDate}) সকলকে উপস্থিত চিহ্নিত করা হয়েছে!`);
    } catch (e) {
      toast.error('হাজিরা সংরক্ষণ ব্যর্থ');
    } finally {
      setSavingAttendance(false);
    }
  };

  // Open Salary Payment Modal
  const openPaySalaryModal = (staff) => {
    setPayingStaff(staff);
    const bSalary = Number(staff.baseSalary) || 0;
    // Calculate total advance taken this month
    const staffAdvances = advanceRecords
      .filter(a => a.staffId === staff.id)
      .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

    setBasicSalary(bSalary > 0 ? bSalary.toString() : '');
    setHouseRent('');
    setMedical('');
    setConveyance('');
    setBonus('');
    setIncentive('');
    setOtherAllowance('');

    setAdvanceDeduction(staffAdvances > 0 ? staffAdvances.toString() : '0');
    setTaxDeduction('');
    setOtherDeduction('');
    setOtherDeductionReason('');

    setPayMethod('Cash');
    setPayNote(`বেতন পরিশোধ: ${selectedMonth}`);
    setIsPayModalOpen(true);
  };

  // Disburse Salary & Record in Expenses
  const handleDisburseSalary = async (e) => {
    e.preventDefault();
    if (!payingStaff) return;

    const numBasic = Number(basicSalary) || 0;
    const numHouseRent = Number(houseRent) || 0;
    const numMedical = Number(medical) || 0;
    const numConveyance = Number(conveyance) || 0;
    const numBonus = Number(bonus) || 0;
    const numIncentive = Number(incentive) || 0;
    const numOtherAllowance = Number(otherAllowance) || 0;
    const grossEarnings = numBasic + numHouseRent + numMedical + numConveyance + numBonus + numIncentive + numOtherAllowance;

    const numAdvance = Number(advanceDeduction) || 0;
    const numTax = Number(taxDeduction) || 0;
    const numOtherDeduction = Number(otherDeduction) || 0;
    const totalDeductions = numAdvance + numTax + numOtherDeduction;
    const netPayable = Math.max(0, grossEarnings - totalDeductions);

    setLoading(true);
    try {
      // 1. Record detailed payroll document in payroll collection
      const payrollData = {
        staffId: payingStaff.id,
        staffName: payingStaff.name,
        role: payingStaff.role,
        month: selectedMonth,
        // Earnings breakdown
        baseSalary: numBasic,
        houseRent: numHouseRent,
        medical: numMedical,
        conveyance: numConveyance,
        bonus: numBonus,
        incentive: numIncentive,
        otherAllowance: numOtherAllowance,
        grossEarnings,
        // Deductions breakdown
        advanceDeduction: numAdvance,
        taxDeduction: numTax,
        otherDeduction: numOtherDeduction,
        otherDeductionReason: otherDeductionReason.trim(),
        totalDeductions,
        deduction: totalDeductions,
        // Net Payable & Status
        paidAmount: netPayable,
        paymentMethod: payMethod,
        note: payNote.trim(),
        paymentDate: new Date().toISOString().slice(0, 10),
        status: 'Paid',
        createdAt: serverTimestamp()
      };

      const payrollRef = await addDoc(collection(db, 'shops', shopId, 'payroll'), payrollData);

      // 2. Automatically record in shop expenses so P&L, Daily Accounts & Expenses reflect it!
      const expenseNote = `মূল বেতন: ৳${numBasic} | মোট আয়: ৳${grossEarnings} | কর্তন: ৳${totalDeductions} | ভাউচার: #${payrollRef.id.slice(0, 8).toUpperCase()}${payNote ? ' (' + payNote + ')' : ''}`;
      await addDoc(collection(db, 'shops', shopId, 'expenses'), {
        title: `স্টাফ বেতন: ${payingStaff.name} (${selectedMonth})`,
        amount: netPayable,
        category: 'স্টাফ বেতন ও বোনাস',
        paymentMethod: payMethod,
        note: expenseNote,
        createdAt: serverTimestamp()
      });

      toast.success(`সফল! "${payingStaff.name}" কে ${formatCurrency(netPayable)} বেতন পরিশোধ সম্পন্ন এবং একাউন্টস খরচে অন্তর্ভুক্ত হয়েছে।`);
      setIsPayModalOpen(false);

      // Open printable official pad payroll slip
      setViewingSlipRecord({
        ...payrollData,
        id: payrollRef.id,
        staff: payingStaff
      });

      setPayingStaff(null);
    } catch (err) {
      console.error(err);
      toast.error('বেতন পরিশোধ প্রক্রিয়ায় সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  // Save Advance Salary
  const handleSaveAdvance = async (e) => {
    e.preventDefault();
    if (!advanceStaffId || !advanceAmount) {
      toast.error('কর্মী ও টাকার পরিমাণ দিন');
      return;
    }

    const st = staffList.find(s => s.id === advanceStaffId);
    if (!st) return;

    setLoading(true);
    try {
      const amt = Number(advanceAmount);
      // 1. Record in advances collection
      await addDoc(collection(db, 'shops', shopId, 'advances'), {
        staffId: st.id,
        staffName: st.name,
        month: selectedMonth,
        amount: amt,
        paymentMethod: advanceMethod,
        note: advanceNote.trim() || 'অগ্রিম বেতন গ্রহণ',
        date: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp()
      });

      // 2. Record as shop expense
      await addDoc(collection(db, 'shops', shopId, 'expenses'), {
        title: `অগ্রিম বেতন: ${st.name}`,
        amount: amt,
        category: 'স্টাফ বেতন ও বোনাস',
        paymentMethod: advanceMethod,
        note: advanceNote.trim() || 'অগ্রিম বেতন',
        createdAt: serverTimestamp()
      });

      toast.success(`সফল! "${st.name}" এর জন্য ${formatCurrency(amt)} অগ্রিম বেতন রেকর্ড করা হয়েছে।`);
      setIsAdvanceModalOpen(false);
      setAdvanceStaffId('');
      setAdvanceAmount('');
      setAdvanceNote('');
    } catch (err) {
      console.error(err);
      toast.error('অগ্রিম সংরক্ষণ ব্যর্থ');
    } finally {
      setLoading(false);
    }
  };

  // Attendance Metrics for Selected Date
  const totalStaff = staffList.length;
  const presentCount = staffList.filter(s => attendanceRecords[s.id] === 'Present').length;
  const absentCount = staffList.filter(s => attendanceRecords[s.id] === 'Absent').length;
  const leaveCount = staffList.filter(s => attendanceRecords[s.id] === 'Leave' || attendanceRecords[s.id] === 'Late').length;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
            স্টাফ, এইচআর ও পেরোল ম্যানেজমেন্ট
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
            দোকানের কর্মী তালিকা, পদবী, দৈনিক হাজিরা, মাসিক বেতন ও অগ্রিম হিসাব
          </p>
        </div>

        {/* Action Button based on tab */}
        {activeTab === 'staff' && (
          <button
            onClick={() => {
              setEditingStaff(null);
              setName('');
              setPhone('');
              setPassword('');
              setBaseSalary('');
              setRole('cashier');
              setIsStaffModalOpen(true);
            }}
            style={{
              padding: '10px 20px',
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
              boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)'
            }}
          >
            <MdPersonAdd size={18} /> নতুন কর্মী যোগ করুন
          </button>
        )}

        {activeTab === 'attendance' && (
          <button
            onClick={handleMarkAllPresent}
            disabled={savingAttendance || staffList.length === 0}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#059669',
              color: '#fff',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 10px rgba(5, 150, 105, 0.25)'
            }}
          >
            <MdCheckCircle size={18} /> সকলকে উপস্থিত করুন
          </button>
        )}

        {activeTab === 'payroll' && (
          <button
            onClick={() => {
              if (staffList.length > 0) setAdvanceStaffId(staffList[0].id);
              setIsAdvanceModalOpen(true);
            }}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#7c3aed',
              color: '#fff',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 10px rgba(124, 58, 237, 0.25)'
            }}
          >
            <MdAttachMoney size={18} /> ➕ অগ্রিম বেতন প্রদান
          </button>
        )}
      </div>

      {/* Tabs Switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '2px' }}>
        {[
          { id: 'staff', label: '👥 কর্মী ও দায়িত্ব (Staff & Roles)', count: staffList.length },
          { id: 'attendance', label: '📅 দৈনিক হাজিরা (Daily HR)', count: `${presentCount}/${totalStaff}` },
          { id: 'payroll', label: '💵 বেতন ও পেরোল (Payroll Sheet)', count: payrollRecords.length > 0 ? `${payrollRecords.length} জন পরিশোধিত` : null }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              borderRadius: '8px 8px 0 0',
              border: 'none',
              background: activeTab === tab.id ? '#2563eb' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : '#64748b',
              fontWeight: '700',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: '0.2s'
            }}
          >
            <span>{tab.label}</span>
            {tab.count && (
              <span style={{
                background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                color: activeTab === tab.id ? '#fff' : '#475569',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* =========================================================================
          TAB 1: কর্মী ও পারমিশন (Staff & Permissions)
      ========================================================================= */}
      {activeTab === 'staff' && (
        <div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#1e40af' }}>
            💡 <b>স্টাফ লগইন সিস্টেম:</b> ক্যাশিয়ার ও ম্যানেজারগণ <b>/poserp</b> লিংকে গিয়ে দোকান কোড <b>({shopId})</b>, মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে সহজে লগইন করতে পারবেন।
          </div>

          <div className="table-responsive" style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  <th style={{ padding: '10px' }}>কর্মীর নাম</th>
                  <th style={{ padding: '10px' }}>মোবাইল (লগইন আইডি)</th>
                  <th style={{ padding: '10px' }}>পদবী / রোল</th>
                  <th style={{ padding: '10px' }}>মূল বেতন (৳)</th>
                  <th style={{ padding: '10px' }}>যোগদানের তারিখ</th>
                  <th style={{ padding: '10px' }}>স্ট্যাটাস</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 10px' }}>
                      <div style={{ fontWeight: '700', color: '#0f172a' }}>{s.name}</div>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', color: '#334155' }}>{s.phone}</span>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{
                        padding: '3px 10px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '700',
                        background:
                          s.role === 'manager' ? '#eff6ff' :
                          s.role === 'accountant' ? '#fef3c7' :
                          s.role === 'salesman' ? '#f3e8ff' : '#ecfdf5',
                        color:
                          s.role === 'manager' ? '#2563eb' :
                          s.role === 'accountant' ? '#d97706' :
                          s.role === 'salesman' ? '#7c3aed' : '#059669',
                        textTransform: 'capitalize'
                      }}>
                        {s.role === 'manager' ? 'ম্যানেজার' :
                         s.role === 'cashier' ? 'ক্যাশিয়ার' :
                         s.role === 'accountant' ? 'হিসাবরক্ষক' :
                         s.role === 'salesman' ? 'সেলসম্যান' : 'সহকারী কর্মী'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{ fontWeight: '700', color: '#0f172a' }}>
                        {formatCurrency(s.baseSalary || 0)} /মাস
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', color: '#64748b', fontSize: '13px' }}>
                      {s.joinDate || '---'}
                    </td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: s.status === 'Inactive' ? '#fee2e2' : '#ecfdf5',
                        color: s.status === 'Inactive' ? '#dc2626' : '#059669'
                      }}>
                        {s.status === 'Inactive' ? 'নিষ্ক্রিয়' : 'সক্রিয়'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            setEditingStaff(s);
                            setName(s.name || '');
                            setPhone(s.phone || '');
                            setPassword('');
                            setRole(s.role || 'cashier');
                            setBaseSalary(s.baseSalary?.toString() || '');
                            setJoinDate(s.joinDate || '');
                            setStatus(s.status || 'Active');
                            setIsStaffModalOpen(true);
                          }}
                          title="তথ্য সংশোধন"
                          style={{ padding: '6px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}
                        >
                          <MdEdit size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteStaff(s.id, s.name)}
                          title="মুছে ফেলুন"
                          style={{ padding: '6px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fee2e2', color: '#dc2626', cursor: 'pointer' }}
                        >
                          <MdDelete size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {staffList.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      কোনো কর্মীর একাউন্ট তৈরি করা হয়নি। উপরে "নতুন কর্মী যোগ করুন" বাটনে ক্লিক করুন।
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: দৈনিক হাজিরা ও ছুটি (Daily HR & Attendance)
      ========================================================================= */}
      {activeTab === 'attendance' && (
        <div>
          {/* Date Picker & Metrics Banner */}
          <div style={{
            background: '#fff',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MdDateRange size={22} color="#2563eb" />
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>হাজিরার তারিখ:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700' }}
              />
            </div>

            {/* Attendance Counters */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ background: '#ecfdf5', color: '#059669', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
                ✓ উপস্থিত: {presentCount} জন
              </span>
              <span style={{ background: '#fee2e2', color: '#dc2626', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
                ✕ অনুপস্থিত: {absentCount} জন
              </span>
              <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
                ⏳ ছুটি/অন্যান্য: {leaveCount} জন
              </span>
            </div>
          </div>

          {/* Attendance Table */}
          <div className="table-responsive" style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  <th style={{ padding: '10px' }}>কর্মীর নাম</th>
                  <th style={{ padding: '10px' }}>পদবী</th>
                  <th style={{ padding: '10px' }}>মোবাইল</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>আজকের হাজিরা স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => {
                  const currentStatus = attendanceRecords[s.id] || 'None';
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{s.name}</div>
                      </td>
                      <td style={{ padding: '12px 10px', fontSize: '13px', color: '#475569' }}>
                        {s.role}
                      </td>
                      <td style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b' }}>
                        {s.phone}
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleMarkAttendance(s.id, 'Present')}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: currentStatus === 'Present' ? '#059669' : '#cbd5e1',
                              background: currentStatus === 'Present' ? '#059669' : '#fff',
                              color: currentStatus === 'Present' ? '#fff' : '#059669',
                              fontWeight: '700',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            ✓ উপস্থিত
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(s.id, 'Absent')}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: currentStatus === 'Absent' ? '#dc2626' : '#cbd5e1',
                              background: currentStatus === 'Absent' ? '#dc2626' : '#fff',
                              color: currentStatus === 'Absent' ? '#fff' : '#dc2626',
                              fontWeight: '700',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            ✕ অনুপস্থিত
                          </button>
                          <button
                            onClick={() => handleMarkAttendance(s.id, 'Leave')}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid',
                              borderColor: currentStatus === 'Leave' ? '#d97706' : '#cbd5e1',
                              background: currentStatus === 'Leave' ? '#d97706' : '#fff',
                              color: currentStatus === 'Leave' ? '#fff' : '#d97706',
                              fontWeight: '700',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            ছুটি (Leave)
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {staffList.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      কোনো কর্মীর তালিকা পাওয়া যায়নি
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: পেরোল ও বেতন খাতা (Payroll & Salary Sheet)
      ========================================================================= */}
      {activeTab === 'payroll' && (
        <div>
          {/* Month Filter & Summary */}
          <div style={{
            background: '#fff',
            padding: '16px 20px',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MdPayments size={22} color="#7c3aed" />
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>বেতনের মাস:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: '700' }}
              />
            </div>

            <div style={{ fontSize: '13px', color: '#64748b' }}>
              💡 বেতন পরিশোধ করার সাথে সাথে তা দোকানের <b>খরচের খাতা (Expenses)</b> ও ক্যাশ রেজিস্ট্রারে স্বয়ংক্রিয়ভাবে যুক্ত হয়ে যায়।
            </div>
          </div>

          {/* Monthly Payroll Sheet */}
          <div className="table-responsive" style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
                  <th style={{ padding: '10px' }}>কর্মীর নাম</th>
                  <th style={{ padding: '10px' }}>পদবী</th>
                  <th style={{ padding: '10px' }}>মূল বেতন</th>
                  <th style={{ padding: '10px' }}>গৃহীত অগ্রিম</th>
                  <th style={{ padding: '10px' }}>নেট প্রদেয়</th>
                  <th style={{ padding: '10px' }}>স্ট্যাটাস</th>
                  <th style={{ padding: '10px', textAlign: 'center' }}>অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => {
                  const bSalary = Number(s.baseSalary) || 0;
                  const totalAdvance = advanceRecords
                    .filter(a => a.staffId === s.id)
                    .reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

                  const payrollPaid = payrollRecords.find(p => p.staffId === s.id);
                  const isPaid = Boolean(payrollPaid);
                  const netPayable = Math.max(0, bSalary - totalAdvance);

                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 10px' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{s.name}</div>
                      </td>
                      <td style={{ padding: '12px 10px', fontSize: '13px', color: '#64748b' }}>
                        {s.role}
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: '700', color: '#0f172a' }}>
                        {formatCurrency(bSalary)}
                      </td>
                      <td style={{ padding: '12px 10px', color: totalAdvance > 0 ? '#dc2626' : '#64748b', fontWeight: '700' }}>
                        {formatCurrency(totalAdvance)}
                      </td>
                      <td style={{ padding: '12px 10px', fontWeight: '800', color: '#2563eb' }}>
                        {formatCurrency(isPaid ? payrollPaid.paidAmount : netPayable)}
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '700',
                          background: isPaid ? '#ecfdf5' : '#fee2e2',
                          color: isPaid ? '#059669' : '#dc2626'
                        }}>
                          {isPaid ? `পরিশোধিত (${formatDate(payrollPaid.paymentDate)})` : 'বকেয়া'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                        {isPaid ? (
                          <button
                            type="button"
                            onClick={() => setViewingSlipRecord({ ...payrollPaid, staff: s })}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: '1px solid #2563eb',
                              background: '#eff6ff',
                              color: '#2563eb',
                              fontWeight: '700',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 1px 3px rgba(37,99,235,0.1)'
                            }}
                          >
                            <MdReceipt size={15} /> পে-রোল স্লিপ
                          </button>
                        ) : (
                          <button
                            onClick={() => openPaySalaryModal(s)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '6px',
                              border: 'none',
                              background: '#2563eb',
                              color: '#fff',
                              fontWeight: '700',
                              fontSize: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            বেতন পরিশোধ
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {staffList.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                      কোনো কর্মীর তথ্য নেই
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: Add / Edit Staff Modal
      ========================================================================= */}
      {isStaffModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '480px', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px', color: '#0f172a' }}>
              {editingStaff ? 'কর্মী তথ্য সংশোধন' : 'নতুন কর্মী যোগ করুন'}
            </h3>

            <form onSubmit={handleSaveStaff} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>কর্মীর নাম *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="যেমন: মোঃ রাসেল আহমেদ"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>মোবাইল নম্বর (লগইন আইডি) *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01700000000"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>পদবী / রোল *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                  >
                    <option value="cashier">ক্যাশিয়ার (Cashier)</option>
                    <option value="manager">ম্যানেজার (Manager)</option>
                    <option value="salesman">সেলসম্যান (Salesman)</option>
                    <option value="accountant">হিসাবরক্ষক (Accountant)</option>
                    <option value="staff">সহকারী কর্মী (Staff)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>মাসিক মূল বেতন (৳)</label>
                  <input
                    type="number"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    placeholder="15000"
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', marginBottom: '4px' }}>
                  {editingStaff ? 'নতুন পাসওয়ার্ড (পরিবর্তন না করতে চাইলে ফাঁকা রাখুন)' : 'লগইন পাসওয়ার্ড *'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required={!editingStaff}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsStaffModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontWeight: '700' }}
                >
                  {loading ? 'সংরক্ষণ...' : 'সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: Salary Disbursement Modal (Detailed Heads)
      ========================================================================= */}
      {isPayModalOpen && payingStaff && (() => {
        const numBasic = Number(basicSalary) || 0;
        const numHouseRent = Number(houseRent) || 0;
        const numMedical = Number(medical) || 0;
        const numConveyance = Number(conveyance) || 0;
        const numBonus = Number(bonus) || 0;
        const numIncentive = Number(incentive) || 0;
        const numOtherAllowance = Number(otherAllowance) || 0;
        const grossEarnings = numBasic + numHouseRent + numMedical + numConveyance + numBonus + numIncentive + numOtherAllowance;

        const numAdvance = Number(advanceDeduction) || 0;
        const numTax = Number(taxDeduction) || 0;
        const numOtherDeduction = Number(otherDeduction) || 0;
        const totalDeductions = numAdvance + numTax + numOtherDeduction;
        const netPayable = Math.max(0, grossEarnings - totalDeductions);

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(3px)' }}>
            <div style={{ background: '#fff', width: '100%', maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)' }}>
              
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px', color: '#0f172a' }}>
                    💵 কর্মকর্তা/কর্মচারীর বেতন পরিশোধ ভাউচার (Salary Disbursement)
                  </h3>
                  <div style={{ fontSize: '13px', color: '#64748b' }}>
                    কর্মী: <strong style={{ color: '#0f172a' }}>{payingStaff.name}</strong> ({payingStaff.role}) | বেতন মাস: <strong style={{ color: '#2563eb' }}>{selectedMonth}</strong>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleDisburseSalary}>
                {/* 2 Column Grid for Earnings & Deductions */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '18px' }}>
                  
                  {/* Column 1: Earnings & Allowances */}
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 12px', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      💰 উপার্জন ও ভাতাসমূহ (Earnings & Allowances)
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '3px', color: '#166534' }}>
                          ১. মূল বেতন (Basic Salary) *
                        </label>
                        <input
                          type="number"
                          required
                          value={basicSalary}
                          onChange={(e) => setBasicSalary(e.target.value)}
                          placeholder="0"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #86efac', background: '#fff', fontSize: '13px', fontWeight: '700' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '3px', color: '#334155' }}>
                            ২. বাড়িভাড়া ভাতা
                          </label>
                          <input
                            type="number"
                            value={houseRent}
                            onChange={(e) => setHouseRent(e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '3px', color: '#334155' }}>
                            ৩. মেডিকেল ভাতা
                          </label>
                          <input
                            type="number"
                            value={medical}
                            onChange={(e) => setMedical(e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '3px', color: '#334155' }}>
                            ৪. যাতায়াত ভাতা
                          </label>
                          <input
                            type="number"
                            value={conveyance}
                            onChange={(e) => setConveyance(e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '3px', color: '#334155' }}>
                            ৫. উৎসব / বোনাস
                          </label>
                          <input
                            type="number"
                            value={bonus}
                            onChange={(e) => setBonus(e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '3px', color: '#334155' }}>
                            ৬. ইনসেন্টিভ / কমিশন
                          </label>
                          <input
                            type="number"
                            value={incentive}
                            onChange={(e) => setIncentive(e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '3px', color: '#334155' }}>
                            ৭. অন্যান্য ভাতা
                          </label>
                          <input
                            type="number"
                            value={otherAllowance}
                            onChange={(e) => setOtherAllowance(e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div style={{ background: '#dcfce7', padding: '8px 12px', borderRadius: '6px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#166534' }}>মোট উপার্জন (Gross Earnings):</span>
                        <strong style={{ fontSize: '14px', color: '#15803d' }}>{formatCurrency(grossEarnings)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Deductions */}
                  <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: '800', margin: '0 0 12px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ✂️ কর্তনসমূহ (Deductions)
                    </h4>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '3px', color: '#991b1b' }}>
                          ১. অগ্রিম বেতন সমন্বয় (Advance Deduction)
                        </label>
                        <input
                          type="number"
                          value={advanceDeduction}
                          onChange={(e) => setAdvanceDeduction(e.target.value)}
                          placeholder="0"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff', fontSize: '13px', fontWeight: '700', color: '#dc2626' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '3px', color: '#334155' }}>
                            ২. ইনকাম ট্যাক্স কর্তন
                          </label>
                          <input
                            type="number"
                            value={taxDeduction}
                            onChange={(e) => setTaxDeduction(e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '3px', color: '#334155' }}>
                            ৩. অন্যান্য কর্তন
                          </label>
                          <input
                            type="number"
                            value={otherDeduction}
                            onChange={(e) => setOtherDeduction(e.target.value)}
                            placeholder="0"
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '3px', color: '#334155' }}>
                          অন্যান্য কর্তনের মন্তব্য / কারণ
                        </label>
                        <input
                          type="text"
                          value={otherDeductionReason}
                          onChange={(e) => setOtherDeductionReason(e.target.value)}
                          placeholder="যেমন: বিলম্বে উপস্থিতি জরিমানা বা ক্ষতিপূরণ"
                          style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '3px', color: '#334155' }}>
                            পেমেন্ট মাধ্যম
                          </label>
                          <select
                            value={payMethod}
                            onChange={(e) => setPayMethod(e.target.value)}
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                          >
                            <option value="Cash">ক্যাশ (Cash Drawer)</option>
                            <option value="bKash">বিকাশ (bKash)</option>
                            <option value="Bank">ব্যাংক একাউন্ট</option>
                            <option value="Nagad">নগদ (Nagad)</option>
                          </select>
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '3px', color: '#334155' }}>
                            পেমেন্ট নোট
                          </label>
                          <input
                            type="text"
                            value={payNote}
                            onChange={(e) => setPayNote(e.target.value)}
                            placeholder="নোট..."
                            style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div style={{ background: '#fee2e2', padding: '8px 12px', borderRadius: '6px', marginTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>মোট কর্তন (Total Deductions):</span>
                        <strong style={{ fontSize: '14px', color: '#dc2626' }}>- {formatCurrency(totalDeductions)}</strong>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Final Net Summary Banner */}
                <div style={{
                  background: '#eff6ff',
                  border: '2px solid #2563eb',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e40af' }}>সর্বমোট প্রদেয় নিট বেতন (Net Payable):</span>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#1d4ed8' }}>
                      {formatCurrency(netPayable)}
                    </div>
                    <div style={{ fontSize: '12px', color: '#3b82f6', fontWeight: '600', marginTop: '2px' }}>
                      কথায়: {numberToBengaliWords(netPayable)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      onClick={() => setIsPayModalOpen(false)}
                      disabled={loading}
                      style={{ padding: '9px 18px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: '600', cursor: 'pointer' }}
                    >
                      বাতিল
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      style={{
                        padding: '9px 24px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#16a34a',
                        color: '#fff',
                        fontWeight: '800',
                        fontSize: '14px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 6px -1px rgba(22,163,74,0.3)'
                      }}
                    >
                      {loading ? 'প্রসেস হচ্ছে...' : 'বেতন পরিশোধ নিশ্চিত করুন'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* =========================================================================
          MODAL 3: Advance Salary Modal
      ========================================================================= */}
      {isAdvanceModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#fff', width: '100%', maxWidth: '440px', borderRadius: '16px', padding: '24px' }}>
            <h3 style={{ fontSize: '17px', fontWeight: '800', marginBottom: '14px', color: '#0f172a' }}>
              ➕ অগ্রিম বেতন প্রদান
            </h3>

            <form onSubmit={handleSaveAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>কর্মী নির্বাচন করুন *</label>
                <select
                  value={advanceStaffId}
                  onChange={(e) => setAdvanceStaffId(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>অগ্রিম টাকার পরিমাণ (৳) *</label>
                <input
                  type="number"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  placeholder="2000"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #7c3aed', fontSize: '16px', fontWeight: '800' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>পেমেন্ট মাধ্যম</label>
                <select
                  value={advanceMethod}
                  onChange={(e) => setAdvanceMethod(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  <option value="Cash">ক্যাশ (Cash)</option>
                  <option value="bKash">বিকাশ (bKash)</option>
                  <option value="Bank">ব্যাংক</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>বিবরণ / কারণ</label>
                <input
                  type="text"
                  value={advanceNote}
                  onChange={(e) => setAdvanceNote(e.target.value)}
                  placeholder="যেমন: জরুরি প্রয়োজনে অগ্রিম গ্রহণ"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#7c3aed', color: '#fff', fontWeight: '700' }}
                >
                  {loading ? 'সংরক্ষণ...' : 'অগ্রিম প্রদান নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* =========================================================
          MODAL 4: Payroll Pay Slip Modal
      ========================================================= */}
      {viewingSlipRecord && (
        <PayrollSlipModal
          record={viewingSlipRecord}
          shopConfig={shopConfig}
          onClose={() => setViewingSlipRecord(null)}
        />
      )}
    </div>
  );
};

export default StaffManager;
