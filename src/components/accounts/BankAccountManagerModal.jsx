import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  MdClose,
  MdAccountBalance,
  MdAdd,
  MdEdit,
  MdDelete,
  MdCheck,
  MdSwapHoriz,
  MdInfo
} from 'react-icons/md';
import {
  subscribeToBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount
} from '../../utils/financialAccountsManager';
import { formatCurrency } from '../../utils/formatters';

const BankAccountManagerModal = ({ isOpen, onClose, shopId, operatorName, operatorId, onTransferRequest }) => {
  if (!isOpen) return null;

  const [bankAccounts, setBankAccounts] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBank, setEditingBank] = useState(null);

  // Form State
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [branch, setBranch] = useState('');
  const [accountType, setAccountType] = useState('চলতি (Current)');
  const [openingBalance, setOpeningBalance] = useState('');
  const [loading, setLoading] = useState(false);

  const bankSuggestions = [
    'ডাচ-বাংলা ব্যাংক (DBBL)',
    'ইসলামী ব্যাংক বাংলাদেশ (IBBL)',
    'সোনালী ব্যাংক',
    'ব্র্যাক ব্যাংক (BRAC Bank)',
    'দ্য সিটি ব্যাংক (City Bank)',
    'ইস্টার্ন ব্যাংক (EBL)',
    'পূবালী ব্যাংক',
    'অগ্রণী ব্যাংক',
    'ইউনাইটেড কমার্শিয়াল ব্যাংক (UCB)',
    'মিউচুয়াল ট্রাস্ট ব্যাংক (MTB)',
    'রূপালী ব্যাংক'
  ];

  useEffect(() => {
    if (!shopId) return;
    const unsub = subscribeToBankAccounts(shopId, (list) => {
      setBankAccounts(list);
    });
    return () => unsub();
  }, [shopId]);

  const resetForm = () => {
    setBankName('');
    setAccountNumber('');
    setAccountName('');
    setBranch('');
    setAccountType('চলতি (Current)');
    setOpeningBalance('');
    setEditingBank(null);
    setShowAddForm(false);
  };

  const handleEditClick = (bank) => {
    setEditingBank(bank);
    setBankName(bank.bankName || '');
    setAccountNumber(bank.accountNumber || '');
    setAccountName(bank.accountName || '');
    setBranch(bank.branch || '');
    setAccountType(bank.accountType || 'চলতি (Current)');
    setOpeningBalance(String(bank.currentBalance || 0));
    setShowAddForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bankName.trim() || !accountNumber.trim()) {
      toast.error('ব্যাংকের নাম এবং অ্যাকাউন্ট নম্বর আবশ্যক');
      return;
    }

    setLoading(true);
    try {
      if (editingBank) {
        await updateBankAccount(shopId, editingBank.id, {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
          branch: branch.trim(),
          accountType
        });
        toast.success('ব্যাংক অ্যাকাউন্টের তথ্য আপডেট হয়েছে');
      } else {
        await createBankAccount(shopId, {
          bankName,
          accountNumber,
          accountName,
          branch,
          accountType,
          openingBalance: Number(openingBalance) || 0,
          operatorName,
          operatorId
        });
        toast.success(`"${bankName}" সফলভাবে নতুন ব্যাংক হিসেবে যুক্ত হয়েছে`);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'ব্যাংক সংরক্ষণে ত্রুটি হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (bank) => {
    if (!window.confirm(`আপনি কি নিশ্চিত "${bank.bankName} (${bank.accountNumber})" ব্যাংক অ্যাকাউন্টটি মুছে ফেলতে চান?`)) {
      return;
    }

    try {
      await deleteBankAccount(shopId, bank.id, bank.currentBalance || 0);
      toast.success('ব্যাংক অ্যাকাউন্ট মুছে ফেলা হয়েছে');
    } catch (err) {
      toast.error('মুছতে সমস্যা হয়েছে');
    }
  };

  const totalBankBalances = bankAccounts.reduce((sum, b) => sum + (Number(b.currentBalance) || 0), 0);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1050,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '720px',
        maxHeight: '92vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
          color: '#ffffff',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdAccountBalance size={24} />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
                ব্যাংক অ্যাকাউন্ট খাতা (Bank Accounts Manager)
              </h2>
              <span style={{ fontSize: '11px', opacity: 0.85 }}>
                সকল ব্যাংক অ্যাকাউন্ট তালিকা, ব্যালান্স এবং অ্যাকাউন্ট পরিচালনা
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#ffffff'
            }}
          >
            <MdClose size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Summary & Add Button Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '18px',
            flexWrap: 'wrap',
            gap: '12px',
            background: '#eff6ff',
            padding: '14px 18px',
            borderRadius: '12px',
            border: '1px solid #bfdbfe'
          }}>
            <div>
              <span style={{ fontSize: '12px', color: '#1e40af', fontWeight: '700' }}>
                মোট ব্যাংক অ্যাকাউন্টে জমা মূলধন:
              </span>
              <div style={{ fontSize: '24px', fontWeight: '900', color: '#1d4ed8' }}>
                {formatCurrency(totalBankBalances)}
              </div>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                মোট {bankAccounts.length} টি সক্রিয় ব্যাংক হিসাব
              </span>
            </div>

            <button
              onClick={() => {
                if (showAddForm) resetForm();
                else setShowAddForm(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 16px',
                borderRadius: '8px',
                border: 'none',
                background: showAddForm ? '#64748b' : '#2563eb',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)'
              }}
            >
              {showAddForm ? <MdClose size={18} /> : <MdAdd size={18} />}
              {showAddForm ? 'ফর্ম বন্ধ করুন' : '+ নতুন ব্যাংক অ্যাকাউন্ট'}
            </button>
          </div>

          {/* Add / Edit Form */}
          {showAddForm && (
            <form onSubmit={handleSubmit} style={{
              background: '#f8fafc',
              border: '1.5px solid #cbd5e1',
              borderRadius: '12px',
              padding: '18px',
              marginBottom: '20px'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: '0 0 14px 0' }}>
                {editingBank ? 'ব্যাংক অ্যাকাউন্টের তথ্য পরিবর্তন' : 'নতুন ব্যাংক অ্যাকাউন্ট যুক্ত করুন'}
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    ব্যাংকের নাম *
                  </label>
                  <input
                    type="text"
                    required
                    list="bank-suggestions"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="যেমন: ডাচ-বাংলা ব্যাংক"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                  <datalist id="bank-suggestions">
                    {bankSuggestions.map(b => <option key={b} value={b} />)}
                  </datalist>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    হিসাব নম্বর (Account Number) *
                  </label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="যেমন: 123.120.45678"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    হিসাবধারীর নাম (Account Holder)
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="যেমন: মেসার্স মাহিন এন্টারপ্রাইজ"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    শাখা (Branch)
                  </label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="যেমন: ঠাকুরগাঁও শাখা"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                    হিসাবের ধরন (Type)
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none', background: '#fff' }}
                  >
                    <option value="চলতি (Current)">চলতি (Current)</option>
                    <option value="সঞ্চয়ী (Savings)">সঞ্চয়ী (Savings)</option>
                    <option value="এজেন্ট ব্যাংকিং (Agent)">এজেন্ট ব্যাংকিং (Agent)</option>
                    <option value="অন্যান্য (Other)">অন্যান্য (Other)</option>
                  </select>
                </div>

                {!editingBank && (
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                      প্রারম্ভিক ব্যালান্স (Opening Balance ৳)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      placeholder="0.00"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '800', outline: 'none' }}
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={resetForm}
                  style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '7px 20px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  {loading ? 'সংরক্ষণ হচ্ছে...' : editingBank ? 'আপডেট করুন ✓' : 'ব্যাংক যুক্ত করুন ✓'}
                </button>
              </div>
            </form>
          )}

          {/* List of Bank Accounts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {bankAccounts.map((bank) => (
              <div
                key={bank.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <MdAccountBalance size={22} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                        {bank.bankName}
                      </span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '700',
                        background: '#f1f5f9',
                        color: '#475569'
                      }}>
                        {bank.accountType || 'চলতি'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                      হিসাব নং: <b style={{ color: '#1e293b' }}>{bank.accountNumber}</b>
                      {bank.branch && <span> | শাখা: {bank.branch}</span>}
                      {bank.accountName && <span> ({bank.accountName})</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান ব্যালান্স</span>
                    <span style={{ fontSize: '18px', fontWeight: '900', color: '#059669' }}>
                      {formatCurrency(bank.currentBalance || 0)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {onTransferRequest && (
                      <button
                        onClick={() => onTransferRequest(bank.id, bank.bankName)}
                        title="এই ব্যাংক থেকে অন্য ব্যাংকে বা ক্যাশে ফান্ড ট্রান্সফার"
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#2563eb',
                          fontSize: '11px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <MdSwapHoriz size={14} /> ট্রান্সফার
                      </button>
                    )}

                    <button
                      onClick={() => handleEditClick(bank)}
                      title="তথ্য সম্পাদনা করুন"
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#334155',
                        cursor: 'pointer'
                      }}
                    >
                      <MdEdit size={16} />
                    </button>

                    <button
                      onClick={() => handleDelete(bank)}
                      title="মুছে ফেলুন"
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#dc2626',
                        cursor: 'pointer'
                      }}
                    >
                      <MdDelete size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {bankAccounts.length === 0 && !showAddForm && (
              <div style={{
                textAlign: 'center',
                padding: '36px 20px',
                background: '#f8fafc',
                borderRadius: '12px',
                border: '1px dashed #cbd5e1'
              }}>
                <MdAccountBalance size={36} color="#94a3b8" />
                <p style={{ margin: '8px 0 4px', fontSize: '14px', fontWeight: '700', color: '#475569' }}>
                  কোনো নির্দিষ্ট ব্যাংক হিসাব যুক্ত করা হয়নি
                </p>
                <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#94a3b8' }}>
                  আপনার দোকান বা ব্যবসার সকল ব্যাংক অ্যাকাউন্ট যুক্ত করে আলাদাভাবে ব্যালান্স ট্র্যাক করুন।
                </p>
                <button
                  onClick={() => setShowAddForm(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  + প্রথম ব্যাংক অ্যাকাউন্ট যোগ করুন
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BankAccountManagerModal;
