import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  MdClose,
  MdSwapHoriz,
  MdPayments,
  MdAccountBalance,
  MdPhoneAndroid,
  MdStoreMallDirectory,
  MdCellWifi,
  MdArrowForward
} from 'react-icons/md';
import {
  ACCOUNT_KEYS,
  transferAccountFund,
  transferBetweenAnyAccounts,
  subscribeToBankAccounts
} from '../../utils/financialAccountsManager';
import { formatCurrency } from '../../utils/formatters';

const TransferFundModal = ({
  isOpen,
  onClose,
  shopId,
  currentBalances,
  operatorName,
  operatorId,
  onSuccess,
  defaultFrom = 'bank',
  defaultTo = 'cash',
  initialFromBankId = null
}) => {
  if (!isOpen) return null;

  const [fromType, setFromType] = useState(defaultFrom);
  const [toType, setToType] = useState(defaultTo);
  const [fromBankId, setFromBankId] = useState(initialFromBankId || '');
  const [toBankId, setToBankId] = useState('');
  const [amount, setAmount] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    if (!shopId) return;
    const unsub = subscribeToBankAccounts(shopId, (list) => {
      setBankAccounts(list);
      if (list.length > 0) {
        if (!fromBankId) setFromBankId(list[0].id);
        if (list.length > 1 && !toBankId) setToBankId(list[1].id);
        else if (!toBankId) setToBankId(list[0].id);
      }
    });
    return () => unsub();
  }, [shopId]);

  const quickPresets = [
    { label: '🏦 ব্যাংক ➔ ব্যাংক', fromType: 'bank', toType: 'bank', note: 'এক ব্যাংক হিসাব থেকে অন্য ব্যাংক হিসাবে ফান্ড ট্রান্সফার' },
    { label: '🏦 ব্যাংক ➔ ক্যাশ', fromType: 'bank', toType: 'cash', note: 'ব্যাংক থেকে নগদ ক্যাশ ড্রয়ারে উত্তোলন' },
    { label: '💵 ক্যাশ ➔ ব্যাংক', fromType: 'cash', toType: 'bank', note: 'দোকানের ক্যাশ টাকা ব্যাংকে জমা' },
    { label: '💵 ক্যাশ ➔ ফ্লেক্সিলোড', fromType: 'cash', toType: 'flexiload', note: 'ক্যাশ থেকে ফ্লেক্সিলোড সিম রিচার্জ ক্রয়' },
    { label: '📱 বিকাশ ➔ ব্যাংক', fromType: 'bkash', toType: 'bank', note: 'বিকাশ মার্চেন্ট থেকে ব্যাংক অ্যাকাউন্টে ট্রান্সফার' },
    { label: '🟠 নগদ ➔ ব্যাংক', fromType: 'nagad', toType: 'bank', note: 'নগদ ব্যালান্স ব্যাংকে জমা' },
  ];

  const quickAmounts = [500, 1000, 2000, 5000, 10000, 20000, 50000];

  const applyPreset = (preset) => {
    setFromType(preset.fromType);
    setToType(preset.toType);
    if (!note) setNote(preset.note);
  };

  const handleSwap = () => {
    const tempType = fromType;
    setFromType(toType);
    setToType(tempType);

    const tempBank = fromBankId;
    setFromBankId(toBankId);
    setToBankId(tempBank);
  };

  const selectedFromBank = bankAccounts.find(b => b.id === fromBankId);
  const selectedToBank = bankAccounts.find(b => b.id === toBankId);

  // Compute available balance in source
  const getSourceBalance = () => {
    if (fromType === 'bank' && selectedFromBank) {
      return Number(selectedFromBank.currentBalance) || 0;
    }
    return currentBalances?.[fromType] || 0;
  };

  const fromBalance = getSourceBalance();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num <= 0) {
      toast.error('অনুগ্রহ করে সঠিক ট্রান্সফার পরিমাণ লিখুন');
      return;
    }

    if (fromType === toType && fromType !== 'bank') {
      toast.error('উৎস ও গন্তব্য অ্যাকাউন্ট ভিন্ন হতে হবে');
      return;
    }

    if (fromType === 'bank' && toType === 'bank' && fromBankId === toBankId) {
      toast.error('উৎস ব্যাংক ও গন্তব্য ব্যাংক অ্যাকাউন্ট আলাদা হতে হবে');
      return;
    }

    if (num > fromBalance) {
      if (!window.confirm(`সতর্কতা: নির্বাচিত অ্যাকাউন্টে ব্যালান্স (${formatCurrency(fromBalance)}) এর চেয়ে ট্রান্সফার পরিমাণ (${formatCurrency(num)}) বেশি। আপনি কি তবুও ট্রান্সফার সম্পন্ন করতে চান?`)) {
        return;
      }
    }

    setLoading(true);
    try {
      await transferBetweenAnyAccounts(shopId, {
        fromType,
        fromBankId: fromType === 'bank' ? fromBankId : null,
        fromBankName: fromType === 'bank' ? (selectedFromBank?.bankName || 'ব্যাংক') : '',
        toType,
        toBankId: toType === 'bank' ? toBankId : null,
        toBankName: toType === 'bank' ? (selectedToBank?.bankName || 'ব্যাংক') : '',
        amount: num,
        checkNumber,
        note: note || 'ফান্ড ট্রান্সফার লেনদেন',
        operatorName,
        operatorId
      });

      const fromLabel = fromType === 'bank' ? selectedFromBank?.bankName : ACCOUNT_KEYS[fromType]?.shortName;
      const toLabel = toType === 'bank' ? selectedToBank?.bankName : ACCOUNT_KEYS[toType]?.shortName;

      toast.success(`${fromLabel} থেকে ${toLabel}-এ ৳${num.toLocaleString('bn-BD')} সফলভাবে ট্রান্সফার সম্পন্ন হয়েছে!`);
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
      zIndex: 1050,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
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
                ফান্ড ট্রান্সফার (Fund Transfer)
              </h2>
              <span style={{ fontSize: '11px', opacity: 0.85 }}>ব্যাংক টু ব্যাংক, ব্যাংক টু ক্যাশ ও অভ্যন্তরীণ অ্যাকাউন্ট লেনদেন</span>
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
                const isActive = fromType === preset.fromType && toType === preset.toType;
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
                value={fromType}
                onChange={(e) => setFromType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: '700',
                  background: '#ffffff',
                  outline: 'none',
                  marginBottom: fromType === 'bank' ? '6px' : '0'
                }}
              >
                {Object.values(ACCOUNT_KEYS).map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.shortName}
                  </option>
                ))}
              </select>

              {/* If Bank, select which bank */}
              {fromType === 'bank' && bankAccounts.length > 0 && (
                <select
                  value={fromBankId}
                  onChange={(e) => setFromBankId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #93c5fd',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: '#eff6ff',
                    color: '#1e40af',
                    outline: 'none'
                  }}
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} ({formatCurrency(b.currentBalance || 0)})
                    </option>
                  ))}
                </select>
              )}

              <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginTop: '4px' }}>
                ব্যালান্স: <b style={{ color: '#0f172a' }}>{formatCurrency(fromBalance)}</b>
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
                value={toType}
                onChange={(e) => setToType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  fontWeight: '700',
                  background: '#ffffff',
                  outline: 'none',
                  marginBottom: toType === 'bank' ? '6px' : '0'
                }}
              >
                {Object.values(ACCOUNT_KEYS).map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.shortName}
                  </option>
                ))}
              </select>

              {/* If Bank, select which bank */}
              {toType === 'bank' && bankAccounts.length > 0 && (
                <select
                  value={toBankId}
                  onChange={(e) => setToBankId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    border: '1px solid #86efac',
                    fontSize: '11px',
                    fontWeight: '700',
                    background: '#f0fdf4',
                    color: '#15803d',
                    outline: 'none'
                  }}
                >
                  {bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} ({formatCurrency(b.currentBalance || 0)})
                    </option>
                  ))}
                </select>
              )}

              <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginTop: '4px' }}>
                ব্যালান্স: <b style={{ color: '#0f172a' }}>
                  {formatCurrency(toType === 'bank' && selectedToBank ? selectedToBank.currentBalance : (currentBalances?.[toType] || 0))}
                </b>
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

          {/* Check / Ref No (If Bank is involved) */}
          {(fromType === 'bank' || toType === 'bank') && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                চেক নম্বর / ট্রানজ্যাকশন আইডি (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="যেমন: চেক নং ৪৭৮৯১ বা ফান্ড ট্রান্সফার রেফারেন্স"
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
          )}

          {/* Note / Purpose */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              মন্তব্য / কারণ (Note / Purpose)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="যেমন: ডাচ-বাংলা ব্যাংক থেকে ইসলামী ব্যাংকে স্থানান্তর"
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
