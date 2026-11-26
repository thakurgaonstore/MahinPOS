import React from 'react';
import {
  MdAccountBalanceWallet,
  MdInventory2,
  MdPeople,
  MdLocalShipping,
  MdTrendingUp,
  MdShield,
  MdInfo
} from 'react-icons/md';
import { formatCurrency } from '../../utils/formatters';

const BusinessCapitalSummaryCard = ({
  totalLiquidFunds = 0,
  totalStockCostValue = 0,
  totalCustomerDues = 0,
  totalSupplierDues = 0,
  cashBalance = 0,
  bankBalance = 0,
  mobileWalletsBalance = 0,
  totalStockQty = 0,
  onOpenBankManager,
  onOpenTransfer,
  onOpenAddMoney
}) => {
  // True Net Capital = Liquid Funds + Stock Inventory + Customer Receivables - Supplier Payables
  const netCapital = totalLiquidFunds + totalStockCostValue + totalCustomerDues - totalSupplierDues;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
      borderRadius: '18px',
      padding: '24px',
      color: '#ffffff',
      marginBottom: '24px',
      boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.35)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative radial ambient glow */}
      <div style={{
        position: 'absolute',
        top: '-40px',
        right: '-40px',
        width: '260px',
        height: '260px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(255,255,255,0) 70%)',
        pointerEvents: 'none'
      }} />

      {/* Header Row: Title & Total Net Capital Highlight */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '20px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        paddingBottom: '18px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '800',
              letterSpacing: '0.5px',
              textTransform: 'uppercase'
            }}>
              ★ মোট আর্থিক মূলধন অডিট
            </span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              (সম্পদ ও দায়ের পূর্ণাঙ্গ হিসাব)
            </span>
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0, color: '#f8fafc' }}>
            দোকানের প্রকৃত মোট মূলধন (Total Net Working Capital)
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#cbd5e1' }}>
            ক্যাশ ও ব্যাংক ফান্ড + স্টকের পণ্য সম্পদ + কাস্টমার বাকি পাওনা − মহাজন দেনা
          </p>
        </div>

        {/* Big Highlight Net Capital Number */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.07)',
          padding: '14px 22px',
          borderRadius: '14px',
          border: '1px solid rgba(52, 211, 153, 0.35)',
          textAlign: 'right',
          backdropFilter: 'blur(8px)'
        }}>
          <span style={{ fontSize: '12px', color: '#a7f3d0', fontWeight: '700', display: 'block' }}>
            সর্বমোট প্রকৃত মূলধন (Net Worth)
          </span>
          <div style={{ fontSize: '32px', fontWeight: '900', color: '#10b981', lineHeight: '1.2' }}>
            {formatCurrency(netCapital)}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            {netCapital >= 0 ? '✓ পজিটিভ সুস্থ মূলধন' : '⚠️ ঋণাত্মক মূলধন সতর্কতা'}
          </span>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px',
        marginBottom: '18px'
      }}>
        {/* Pillar 1: Liquid Cash & Banks */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '12px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#93c5fd' }}>
              ১. তরল ক্যাশ ও ব্যাংক ফান্ড
            </span>
            <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '5px', borderRadius: '6px', color: '#60a5fa' }}>
              <MdAccountBalanceWallet size={18} />
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#60a5fa' }}>
            {formatCurrency(totalLiquidFunds)}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            ক্যাশ: <b>{formatCurrency(cashBalance)}</b> | ব্যাংক: <b>{formatCurrency(bankBalance)}</b>
          </div>
        </div>

        {/* Pillar 2: Stock Inventory Asset */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '12px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#fcd34d' }}>
              ২. স্টকের মোট ক্রয়মূল্য
            </span>
            <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '5px', borderRadius: '6px', color: '#fbbf24' }}>
              <MdInventory2 size={18} />
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#fbbf24' }}>
            {formatCurrency(totalStockCostValue)}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            ইনভেন্টরি পণ্য মজুদ: <b>{totalStockQty}</b> টি
          </div>
        </div>

        {/* Pillar 3: Customer Receivables */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(52, 211, 153, 0.3)',
          borderRadius: '12px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#86efac' }}>
              ৩. কাস্টমার বাকি (পাওনা)
            </span>
            <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '5px', borderRadius: '6px', color: '#34d399' }}>
              <MdPeople size={18} />
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#34d399' }}>
            + {formatCurrency(totalCustomerDues)}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            ক্রেতাদের কাছে দোকানে প্রদেয় বাকি
          </div>
        </div>

        {/* Pillar 4: Supplier Payables (Liability) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '12px',
          padding: '14px 16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: '800', color: '#fca5a5' }}>
              ৪. মহাজন / সাপ্লায়ার দেনা
            </span>
            <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '5px', borderRadius: '6px', color: '#f87171' }}>
              <MdLocalShipping size={18} />
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#f87171' }}>
            - {formatCurrency(totalSupplierDues)}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            সাপ্লায়ারদের পাওনা পরিশোধযোগ্য
          </div>
        </div>
      </div>

      {/* Quick Actions Footer */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#cbd5e1' }}>
          <MdInfo size={16} color="#38bdf8" />
          <span>সম্পূর্ণ হিসাব রিয়েল-টাইম ডাটাবেজ থেকে স্বয়ংক্রিয়ভাবে সমন্বিত।</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {onOpenBankManager && (
            <button
              onClick={onOpenBankManager}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.25)',
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              🏦 ব্যাংক অ্যাকাউন্টসমূহ
            </button>
          )}

          {onOpenTransfer && (
            <button
              onClick={onOpenTransfer}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              ⇄ ব্যাংক / ফান্ড ট্রান্সফার
            </button>
          )}

          {onOpenAddMoney && (
            <button
              onClick={onOpenAddMoney}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              + মূলধন / Add Money
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessCapitalSummaryCard;
