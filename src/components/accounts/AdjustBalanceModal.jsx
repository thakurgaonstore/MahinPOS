import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { MdClose, MdSettings, MdCheck, MdHistory, MdArrowForward } from 'react-icons/md';
import { ACCOUNT_KEYS, adjustAccountBalance } from '../../utils/financialAccountsManager';
import { formatCurrency } from '../../utils/formatters';

const AdjustBalanceModal = ({ isOpen, onClose, shopId, currentBalances, operatorName, operatorId, onSuccess }) => {
  if (!isOpen) return null;

  const [balancesInput, setBalancesInput] = useState({
    cash: currentBalances?.cash || 0,
    bank: currentBalances?.bank || 0,
    bkash: currentBalances?.bkash || 0,
    nagad: currentBalances?.nagad || 0,
    agent_bank: currentBalances?.agent_bank || 0,
    flexiload: currentBalances?.flexiload || 0
  });

  const [reason, setReason] = useState('ব্যালান্স সমন্বয় / প্রাথমিক ব্যালান্স সেট');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (accId, val) => {
    setBalancesInput(prev => ({
      ...prev,
      [accId]: val
    }));
  };

  const handleSaveAll = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      for (const accId of Object.keys(ACCOUNT_KEYS)) {
        const newVal = Number(balancesInput[accId]) || 0;
        const oldVal = Number(currentBalances?.[accId]) || 0;
        if (newVal !== oldVal) {
          await adjustAccountBalance(shopId, {
            account: accId,
            newBalance: newVal,
            oldBalance: oldVal,
            reason: reason || 'ম্যানুয়াল ব্যালান্স সমন্বয়',
            operatorName,
            operatorId
          });
        }
      }

      toast.success('সকল ব্যালান্স সফলভাবে আপডেট করা হয়েছে!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'ব্যালান্স আপডেট করতে ত্রুটি হয়েছে');
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
          background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
          color: '#ffffff',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdSettings size={22} />
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>
                ব্যালান্স সমন্বয় ও প্রাথমিক হিসাব (Balance Adjustment)
              </h2>
              <span style={{ fontSize: '11px', opacity: 0.85 }}>বাস্তব ক্যাশ/সিম ব্যালান্সের সাথে সফটওয়্যার ব্যালান্স মিলান</span>
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

        {/* Body */}
        <form onSubmit={handleSaveAll} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {Object.values(ACCOUNT_KEYS).map((acc) => {
              const currentVal = currentBalances?.[acc.id] || 0;
              const inputVal = balancesInput[acc.id];
              const diff = (Number(inputVal) || 0) - currentVal;

              return (
                <div
                  key={acc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div style={{ minWidth: '160px' }}>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: acc.color }}>
                      {acc.nameBn}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      বর্তমান: {formatCurrency(currentVal)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      step="any"
                      value={inputVal}
                      onChange={(e) => handleInputChange(acc.id, e.target.value)}
                      style={{
                        width: '130px',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1.5px solid #cbd5e1',
                        fontSize: '15px',
                        fontWeight: '800',
                        color: '#0f172a',
                        textAlign: 'right',
                        outline: 'none'
                      }}
                    />
                    {diff !== 0 && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: diff > 0 ? '#059669' : '#dc2626',
                        minWidth: '60px',
                        textAlign: 'right'
                      }}>
                        {diff > 0 ? `+${diff}` : diff}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Reason */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              সমন্বয়ের কারণ / মন্তব্য *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="যেমন: দিনের শেষ ক্যাশ ড্রয়ার অডিট সমন্বয় বা সিম ব্যালান্স মিলকরণ"
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

          {/* Actions */}
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
                background: '#0f172a',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'সংরক্ষণ হচ্ছে...' : 'ব্যালান্স সংরক্ষণ করুন ✓'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdjustBalanceModal;
