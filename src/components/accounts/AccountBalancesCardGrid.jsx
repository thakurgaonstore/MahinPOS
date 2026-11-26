import React, { useState, useEffect } from 'react';
import {
  MdPayments,
  MdAccountBalance,
  MdPhoneAndroid,
  MdStoreMallDirectory,
  MdCellWifi,
  MdSwapHoriz,
  MdAddCircle,
  MdSettings,
  MdAccountBalanceWallet,
  MdArrowForward,
  MdFlashOn,
  MdAccountTree
} from 'react-icons/md';
import {
  ACCOUNT_KEYS,
  DEFAULT_BALANCES,
  subscribeToAccountBalances,
  subscribeToBankAccounts
} from '../../utils/financialAccountsManager';
import { formatCurrency } from '../../utils/formatters';
import AddMoneyModal from './AddMoneyModal';
import TransferFundModal from './TransferFundModal';
import AdjustBalanceModal from './AdjustBalanceModal';
import BankAccountManagerModal from './BankAccountManagerModal';

const AccountBalancesCardGrid = ({ shopId, userProfile, isOwner = true, showActions = true }) => {
  const [balances, setBalances] = useState(DEFAULT_BALANCES);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isBankManagerOpen, setIsBankManagerOpen] = useState(false);
  const [transferDefaults, setTransferDefaults] = useState({ from: 'bank', to: 'cash', initialFromBankId: null });

  const operatorName = userProfile?.name || userProfile?.email || 'Admin';
  const operatorId = userProfile?.staffId || '';

  useEffect(() => {
    if (!shopId) return;
    const unsubBalances = subscribeToAccountBalances(shopId, (newBalances) => {
      setBalances(newBalances);
    });

    const unsubBanks = subscribeToBankAccounts(shopId, (list) => {
      setBankAccounts(list);
    });

    return () => {
      unsubBalances();
      unsubBanks();
    };
  }, [shopId]);

  // If dynamic bank accounts exist, aggregate bank balance reflects the sum of all banks
  const totalBankBalance = bankAccounts.length > 0
    ? bankAccounts.reduce((sum, b) => sum + (Number(b.currentBalance) || 0), 0)
    : (Number(balances.bank) || 0);

  const totalLiquidBalance = 
    (Number(balances.cash) || 0) +
    totalBankBalance +
    (Number(balances.bkash) || 0) +
    (Number(balances.nagad) || 0) +
    (Number(balances.agent_bank) || 0) +
    (Number(balances.flexiload) || 0);

  const openBankToCashTransfer = (bankId = null) => {
    setTransferDefaults({ from: 'bank', to: 'cash', initialFromBankId: bankId });
    setIsTransferOpen(true);
  };

  const openBankToBankTransfer = () => {
    setTransferDefaults({ from: 'bank', to: 'bank', initialFromBankId: bankAccounts[0]?.id || null });
    setIsTransferOpen(true);
  };

  const openCashToFlexiloadTransfer = () => {
    setTransferDefaults({ from: 'cash', to: 'flexiload', initialFromBankId: null });
    setIsTransferOpen(true);
  };

  const openCashToBankTransfer = () => {
    setTransferDefaults({ from: 'cash', to: 'bank', initialFromBankId: null });
    setIsTransferOpen(true);
  };

  const getAccountIcon = (id) => {
    switch (id) {
      case 'bank': return <MdAccountBalance size={22} />;
      case 'bkash': return <MdPhoneAndroid size={22} />;
      case 'nagad': return <MdPhoneAndroid size={22} />;
      case 'agent_bank': return <MdStoreMallDirectory size={22} />;
      case 'flexiload': return <MdCellWifi size={22} />;
      default: return <MdPayments size={22} />;
    }
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Section Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            background: '#eff6ff',
            padding: '8px',
            borderRadius: '10px',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <MdAccountBalanceWallet size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              সকল অ্যাকাউন্ট ব্যালান্স ও আর্থিক তহবিল (Account Balances)
            </h2>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
              ক্যাশ ড্রয়ার, ব্যাংকসমূহ, বিকাশ, নগদ, এজেন্ট ব্যাংক ও ফ্লেক্সিলোড লিকুইড ব্যালান্স ট্র্যাকার
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Manage Bank Accounts Button */}
            <button
              onClick={() => setIsBankManagerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #bfdbfe',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <MdAccountBalance size={17} />
              ব্যাংক অ্যাকাউন্টসমূহ {bankAccounts.length > 0 && `(${bankAccounts.length})`}
            </button>

            <button
              onClick={() => setIsAddMoneyOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                transition: 'all 0.15s'
              }}
            >
              <MdAddCircle size={16} />
              Add Money (টাকা যোগ)
            </button>

            <button
              onClick={() => openBankToCashTransfer()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                transition: 'all 0.15s'
              }}
            >
              <MdSwapHoriz size={18} />
              ফান্ড ট্রান্সফার
            </button>

            {isOwner && (
              <button
                onClick={() => setIsAdjustOpen(true)}
                title="ব্যালান্স সমন্বয় বা প্রাথমিক হিসাব সেট"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <MdSettings size={16} />
                ব্যালান্স সমন্বয়
              </button>
            )}
          </div>
        )}
      </div>

      {/* 7 Balances Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        {/* 1. Cash in Drawer */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #a7f3d0',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#065f46' }}>
                ক্যাশ (ড্রয়ার/নগদ)
              </span>
              <div style={{ background: '#ecfdf5', padding: '6px', borderRadius: '8px', color: '#059669' }}>
                {getAccountIcon('cash')}
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>
              {formatCurrency(balances.cash)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>দোকান ড্রয়ার নগদ ক্যাশ</span>
          </div>
          {showActions && (
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => openBankToCashTransfer()}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
              >
                + ব্যাংক থেকে আনুন
              </button>
              <button
                onClick={openCashToBankTransfer}
                style={{ background: 'none', border: 'none', color: '#059669', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
              >
                ব্যাংকে জমা ➔
              </button>
            </div>
          )}
        </div>

        {/* 2. Bank Accounts (Aggregate of all individual banks) */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #bfdbfe',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: '#1e40af' }}>
                  ব্যাংক ব্যালান্স
                </span>
                {bankAccounts.length > 0 && (
                  <span style={{
                    background: '#eff6ff',
                    color: '#2563eb',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '10px',
                    fontWeight: '800'
                  }}>
                    {bankAccounts.length}টি ব্যাংক
                  </span>
                )}
              </div>
              <div style={{ background: '#eff6ff', padding: '6px', borderRadius: '8px', color: '#2563eb' }}>
                {getAccountIcon('bank')}
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>
              {formatCurrency(totalBankBalance)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>সকল ব্যাংক অ্যাকাউন্টের মোট জমা</span>
          </div>
          {showActions && (
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
              <button
                onClick={() => setIsBankManagerOpen(true)}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
              >
                🏦 ব্যাংক খাতা দেখুন
              </button>
              {bankAccounts.length > 1 && (
                <button
                  onClick={openBankToBankTransfer}
                  style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
                >
                  ব্যাংক ➔ ব্যাংক ➔
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. bKash */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #fecdd3',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#9f1239' }}>
                বিকাশ (bKash)
              </span>
              <div style={{ background: '#fff1f2', padding: '6px', borderRadius: '8px', color: '#e11d48' }}>
                {getAccountIcon('bkash')}
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>
              {formatCurrency(balances.bkash)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>মার্চেন্ট / এজেন্ট ব্যালান্স</span>
          </div>
          {showActions && (
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
              <button
                onClick={() => {
                  setTransferDefaults({ from: 'bkash', to: 'bank', initialFromBankId: null });
                  setIsTransferOpen(true);
                }}
                style={{ background: 'none', border: 'none', color: '#e11d48', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
              >
                ব্যাংকে ট্রান্সফার ➔
              </button>
            </div>
          )}
        </div>

        {/* 4. Nagad */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #fed7aa',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#9a3412' }}>
                নগদ (Nagad)
              </span>
              <div style={{ background: '#fff7ed', padding: '6px', borderRadius: '8px', color: '#ea580c' }}>
                {getAccountIcon('nagad')}
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>
              {formatCurrency(balances.nagad)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>নগদ ওয়ালেট ব্যালান্স</span>
          </div>
          {showActions && (
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
              <button
                onClick={() => {
                  setTransferDefaults({ from: 'nagad', to: 'bank', initialFromBankId: null });
                  setIsTransferOpen(true);
                }}
                style={{ background: 'none', border: 'none', color: '#ea580c', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
              >
                ব্যাংকে ট্রান্সফার ➔
              </button>
            </div>
          )}
        </div>

        {/* 5. Agent Bank */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #a5f3fc',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#155e75' }}>
                এজেন্ট ব্যাংক
              </span>
              <div style={{ background: '#ecfeff', padding: '6px', borderRadius: '8px', color: '#0891b2' }}>
                {getAccountIcon('agent_bank')}
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>
              {formatCurrency(balances.agent_bank)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>এজেন্ট ব্যাংকিং ফান্ড</span>
          </div>
          {showActions && (
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
              <button
                onClick={() => {
                  setTransferDefaults({ from: 'agent_bank', to: 'cash', initialFromBankId: null });
                  setIsTransferOpen(true);
                }}
                style={{ background: 'none', border: 'none', color: '#0891b2', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
              >
                ক্যাশে রূপান্তর ➔
              </button>
            </div>
          )}
        </div>

        {/* 6. Flexiload Balance */}
        <div style={{
          background: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #ddd6fe',
          padding: '16px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#5b21b6' }}>
                ফ্লেক্সিলোড ব্যালান্স
              </span>
              <div style={{ background: '#f5f3ff', padding: '6px', borderRadius: '8px', color: '#7c3aed' }}>
                {getAccountIcon('flexiload')}
              </div>
            </div>
            <div style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a' }}>
              {formatCurrency(balances.flexiload)}
            </div>
            <span style={{ fontSize: '11px', color: '#64748b' }}>সিম রিচার্জ রানিং স্টক</span>
          </div>
          {showActions && (
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0' }}>
              <button
                onClick={openCashToFlexiloadTransfer}
                style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: '11px', fontWeight: '700', cursor: 'pointer', padding: 0 }}
              >
                + ক্যাশ থেকে লোড কিনুন
              </button>
            </div>
          )}
        </div>

        {/* 7. TOTAL LIQUID BALANCE (Highlighted Card) */}
        <div style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: '14px',
          padding: '16px',
          color: '#ffffff',
          boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#38bdf8' }}>
                সর্বমোট তরল ব্যালান্স
              </span>
              <div style={{ background: 'rgba(56, 189, 248, 0.2)', padding: '6px', borderRadius: '8px', color: '#38bdf8' }}>
                <MdAccountBalanceWallet size={22} />
              </div>
            </div>
            <div style={{ fontSize: '24px', fontWeight: '900', color: '#10b981' }}>
              {formatCurrency(totalLiquidBalance)}
            </div>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>সকল একাউন্টের মোট নগদ ও ব্যাংক টাকা</span>
          </div>
          <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
              {bankAccounts.length > 0 ? `${bankAccounts.length}টি ব্যাংক + ৫টি ওয়ালেট` : '৬টি সক্রিয় অ্যাকাউন্ট'}
            </span>
            <button
              onClick={() => setIsAddMoneyOpen(true)}
              style={{ background: '#10b981', border: 'none', borderRadius: '4px', color: '#ffffff', fontSize: '11px', fontWeight: '800', cursor: 'pointer', padding: '2px 8px' }}
            >
              + Add
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddMoneyModal
        isOpen={isAddMoneyOpen}
        onClose={() => setIsAddMoneyOpen(false)}
        shopId={shopId}
        currentBalances={{ ...balances, bank: totalBankBalance }}
        operatorName={operatorName}
        operatorId={operatorId}
      />

      <TransferFundModal
        isOpen={isTransferOpen}
        onClose={() => setIsTransferOpen(false)}
        shopId={shopId}
        currentBalances={{ ...balances, bank: totalBankBalance }}
        operatorName={operatorName}
        operatorId={operatorId}
        defaultFrom={transferDefaults.from}
        defaultTo={transferDefaults.to}
        initialFromBankId={transferDefaults.initialFromBankId}
      />

      <AdjustBalanceModal
        isOpen={isAdjustOpen}
        onClose={() => setIsAdjustOpen(false)}
        shopId={shopId}
        currentBalances={{ ...balances, bank: totalBankBalance }}
        operatorName={operatorName}
        operatorId={operatorId}
      />

      <BankAccountManagerModal
        isOpen={isBankManagerOpen}
        onClose={() => setIsBankManagerOpen(false)}
        shopId={shopId}
        operatorName={operatorName}
        operatorId={operatorId}
        onTransferRequest={(bankId, bankName) => {
          setIsBankManagerOpen(false);
          openBankToCashTransfer(bankId);
        }}
      />
    </div>
  );
};

export default AccountBalancesCardGrid;
