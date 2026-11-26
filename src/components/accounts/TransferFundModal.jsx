import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { MdClose, MdSwapHoriz, MdPayments, MdAccountBalance, MdPhoneAndroid, MdStoreMallDirectory, MdCellWifi, MdArrowForward } from 'react-icons/md';
import { ACCOUNT_KEYS, transferAccountFund } from '../../utils/financialAccountsManager';
import { formatCurrency } from '../../utils/formatters';

const TransferFundModal = ({ isOpen, onClose, shopId, currentBalances, operatorName, operatorId, onSuccess, defaultFrom = 'bank', defaultTo = 'cash' }) => {
  if (!isOpen) return null;

  const [fromAccount, setFromAccount] = useState(defaultFrom);
  const [toAccount, setToAccount] = useState(defaultTo);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const quickPresets = [
    { label: '🏦 ব্যাংক ➔ ক্যাশ', from: 'bank', to: 'cash', note: 'ব্যাংক থেকে নগদ ক্যাশ ড্রয়ারে উত্তোলন' },
    { label: '💵 ক্যাশ ➔ ব্যাংক', from: 'cash', to: 'bank', note: 'দোকানের ক্যাশ টাকা ব্যাংকে জমা' },
    { label: '💵 ক্যাশ ➔ ফ্লেক্সিলোড', from: 'cash', to: 'flexiload', note: 'ক্যাশ থেকে ফ্লেক্সিলোড সিম রিচার্জ ক্রয়' },
    { label: '📱 বিকাশ ➔ ব্যাংক', from: 'bkash', to: 'bank', note: 'বিকাশ মার্চেন্ট থেকে ব্যাংক অ্যাকাউন্টে ট্রান্সফার' },
    { label: '🟠 নগদ ➔ ব্যাংক', from: 'nagad', to: 'bank', note: 'নগদ ব্যালান্স ব্যাংকে জমা' },
    { label: '🏛️ এজেন্ট ➔ ক্যাশ', from: 'agent_bank', to: 'cash', note: 'এজেন্ট ব্যাংকিং ব্যালান্স ক্যাশে রূপান্তর' },
  ];

  const quickAmounts = [500, 1000, 2000, 5000, 10000, 20000, 50000];

  const applyPreset = (preset) => {
    setFromAccount(preset.from);
    setToAccount(preset.to);
    if (!note) setNote(preset.note);
  };

  const handleSwap = () => {
    const temp = fromAccount;
    setFromAccount(toAccount);
    setToAccount(temp);
  };

  const fromBalance = currentBalances?.[fromAccount] || 0;
  const toBalance = currentBalances?.[toAccount] || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) {
      toast.error('অনুগ্রহ করে সঠিক ট্রান্সফার পরিমাণ লিখুন');
      return;
    }

    if (fromAccount === toAccount) {
      toast.error('উৎস ও গন্তব্য অ্যাকাউন্ট ভিন্ন হতে হবে');
      return;
    }

    if (num > fromBalance) {
      if (!window.confirm(`সতর্কতা: নির্বাচিত অ্যাকাউন্টে ব্যালান্স (${formatCurrency(fromBalance)}) এর চেয়ে ট্রান্সফার পরিমাণ (${formatCurrency(num)}) বেশি। আপনি কি তবুও ট্রান্সফার সম্পন্ন করতে চান?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      await transferAccountFund(shopId, {
        fromAccount,
        toAccount,
        amount: num,
        note: note || `${ACCOUNT_KEYS[fromAccount]?.shortName} থেকে ${ACCOUNT_KEYS[toAccount]?.shortName} ফান্ড ট্রান্সফার`,
        operatorName,
        operatorId
      });

      toast.success(`${ACCOUNT_KEYS[fromAccount]?.shortName} থেকে ${ACCOUNT_KEYS[toAccount]?.shortName}-এ ৳${num.toLocaleString('bn-BD')} সফলভাবে ট্রান্সফার হয়েছে!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'ট্রান্সফার করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
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
        maxWidth: '540px',
        maxHeight: '92vh',
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
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          color: '#ffffff',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdSwapHoriz size={26} />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
                ফান্ড ট্রান্সফার (Account Fund Transfer)
              </h2>
              <span style={{ fontSize: '11px', opacity: 0.85 }}>ব্যাংক টু ক্যাশ ও অভ্যন্তরীণ অ্যাকাউন্ট লেনদেন</span>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Quick Presets */}
          <div style={{ marginBottom: '18px' }}>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '6px' }}>
              ⚡ দ্রুত ট্রান্সফার শর্টকাট (Quick Presets):
            </span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {quickPresets.map((preset) => {
                const isActive = fromAccount === preset.from && toAccount === preset.to;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: `1px solid ${isActive ? '#2563eb' : '#cbd5e1'}`,
                      background: isActive ? '#eff6ff' : '#f8fafc',
                      color: isActive ? '#1d4ed8' : '#334155',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* From Account & To Account Row */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '18px',
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '10px',
            alignItems: 'center'
          }}>
            {/* From Account */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase', marginBottom: '4px' }}>
                যেখান থেকে কাটবে (From)
              </label>
              <select
                value={fromAccount}
                onChange={(e) => setFromAccount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: '700',
                  background: '#ffffff',
                  outline: 'none'
                }}
              >
                {Object.values(ACCOUNT_KEYS).map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.shortName} ({formatCurrency(currentBalances?.[acc.id] || 0)})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginTop: '4px' }}>
                বর্তমান: <b style={{ color: '#0f172a' }}>{formatCurrency(fromBalance)}</b>
              </div>
            </div>

            {/* Swap Button */}
            <div style={{ textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleSwap}
                title="অ্যাকাউন্ট অদল-বদল করুন"
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '50%',
                  width: '34px',
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#2563eb'
                }}
              >
                <MdSwapHoriz size={20} />
              </button>
            </div>

            {/* To Account */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#059669', textTransform: 'uppercase', marginBottom: '4px' }}>
                যেখানে জমা হবে (To)
              </label>
              <select
                value={toAccount}
                onChange={(e) => setToAccount(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: '700',
                  background: '#ffffff',
                  outline: 'none'
                }}
              >
                {Object.values(ACCOUNT_KEYS).map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.shortName} ({formatCurrency(currentBalances?.[acc.id] || 0)})
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginTop: '4px' }}>
                বর্তমান: <b style={{ color: '#0f172a' }}>{formatCurrency(toBalance)}</b>
              </div>
            </div>
          </div>

          {/* Amount Input */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              ট্রান্সফার টাকার পরিমাণ (Amount ৳) *
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
              {fromBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(fromBalance))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid #bbf7d0',
                    background: '#f0fdf4',
                    color: '#15803d',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                >
                  সর্বোচ্চ ব্যালান্স
                </button>
              )}
            </div>
          </div>

          {/* Note / Remarks */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              মন্তব্য / কারণ (Note / Purpose)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="যেমন: ব্যাংক থেকে চেক মারফত ক্যাশ ড্রয়ারে আনয়ন"
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
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'ট্রান্সফার হচ্ছে...' : 'ট্রান্সফার সম্পন্ন করুন ➔'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransferFundModal;
