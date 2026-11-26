import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { MdClose, MdAddCircle, MdPayments, MdAccountBalance, MdPhoneAndroid, MdStoreMallDirectory, MdCellWifi } from 'react-icons/md';
import { ACCOUNT_KEYS, addMoneyToAccount } from '../../utils/financialAccountsManager';
import { formatCurrency } from '../../utils/formatters';

const AddMoneyModal = ({ isOpen, onClose, shopId, currentBalances, operatorName, operatorId, onSuccess }) => {
  if (!isOpen) return null;

  const [selectedAccount, setSelectedAccount] = useState('cash');
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('মালিকের নিজস্ব মূলধন (Owner Capital)');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const quickAmounts = [500, 1000, 2000, 5000, 10000, 20000, 50000];

  const sourceOptions = [
    'মালিকের নিজস্ব মূলধন (Owner Capital)',
    'সকালের প্রারম্ভিক ক্যাশ (Opening Drawer Cash)',
    'সরাসরি ব্যাংক ডিপোজিট (Bank Direct Deposit)',
    'ফ্লেক্সিলোড ব্যালান্স রিচার্জ ক্রয় (Flexiload Balance Purchase)',
    'এজেন্ট ব্যাংকিং ফান্ড জমা (Agent Bank Deposit)',
    'অন্যান্য নগদ ফান্ড ইনপুট (Other Inflow)'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) {
      toast.error('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন');
      return;
    }

    setLoading(true);
    try {
      await addMoneyToAccount(shopId, {
        account: selectedAccount,
        amount: num,
        source,
        note,
        operatorName,
        operatorId
      });

      const accName = ACCOUNT_KEYS[selectedAccount]?.nameBn || selectedAccount;
      toast.success(`${accName} অ্যাকাউন্টে ৳${num.toLocaleString('bn-BD')} সফলভাবে যোগ করা হয়েছে!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'টাকা যুক্ত করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const getAccountIcon = (type) => {
    switch (type) {
      case 'bank': return <MdAccountBalance size={18} />;
      case 'mobile': return <MdPhoneAndroid size={18} />;
      case 'store': return <MdStoreMallDirectory size={18} />;
      case 'sim': return <MdCellWifi size={18} />;
      default: return <MdPayments size={18} />;
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '520px',
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
          color: '#ffffff',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdAddCircle size={24} />
            <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
              টাকা যুক্ত করুন (Add Money / Capital)
            </h2>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Target Account Selection */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
              কোন অ্যাকাউন্টে টাকা যোগ করতে চান? *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {Object.values(ACCOUNT_KEYS).map((acc) => {
                const isSelected = selectedAccount === acc.id;
                const currentBal = currentBalances?.[acc.id] || 0;
                return (
                  <div
                    key={acc.id}
                    onClick={() => setSelectedAccount(acc.id)}
                    style={{
                      border: `2px solid ${isSelected ? acc.color : '#e2e8f0'}`,
                      background: isSelected ? acc.bgColor : '#ffffff',
                      borderRadius: '10px',
                      padding: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: acc.color, fontWeight: '700', fontSize: '12px' }}>
                      {getAccountIcon(acc.iconType)}
                      <span>{acc.shortName}</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: '#0f172a', marginTop: '4px' }}>
                      {formatCurrency(currentBal)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              টাকার পরিমাণ (Amount ৳) *
            </label>
            <input
              type="number"
              min="1"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '18px',
                fontWeight: '800',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            {/* Quick Chips */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
              {quickAmounts.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(String((Number(amount) || 0) + q))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  +{q.toLocaleString()}
                </button>
              ))}
              {amount && (
                <button
                  type="button"
                  onClick={() => setAmount('')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #fecaca',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  ক্লিয়ার
                </button>
              )}
            </div>
          </div>

          {/* Source Selection */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              জমার খাত / উৎস (Source Category) *
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontWeight: '600',
                outline: 'none',
                background: '#fff',
                boxSizing: 'border-box'
              }}
            >
              {sourceOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          {/* Note / Ref */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              মন্তব্য / ভাউচার / রেফারেন্স নং (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="যেমন: সোনালী ব্যাংক চেক নং ১২৩৪৫ বা ক্যাশ ডিপোজিট"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Submit Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'যোগ হচ্ছে...' : 'টাকা যুক্ত করুন ✓'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMoneyModal;
