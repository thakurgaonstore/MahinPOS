import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  MdClose,
  MdReceipt,
  MdPayment,
  MdPrint,
  MdInfo,
  MdPerson,
  MdPhone,
  MdAttachMoney
} from 'react-icons/md';
import {
  subscribeToCustomerTransactions,
  computeLedgerStatement
} from '../../utils/ledgerManager';

const CustomerStatementModal = ({ shopId, customer, onClose, onOpenPayment }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId || !customer?.id) return;
    setLoading(true);
    const unsub = subscribeToCustomerTransactions(shopId, customer.id, (list) => {
      setTransactions(list);
      setLoading(false);
    });
    return () => unsub();
  }, [shopId, customer?.id]);

  // Detected years from transactions
  const detectedYears = [...new Set(
    transactions.map((t) => {
      const d = new Date(t.date || t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt || 0);
      return !isNaN(d.getTime()) ? String(d.getFullYear()) : String(currentYear);
    })
  )].sort((a, b) => Number(b) - Number(a));

  if (!detectedYears.includes(String(currentYear))) {
    detectedYears.unshift(String(currentYear));
  }

  const { openingBalance, closingBalance, statementRows } = computeLedgerStatement(
    transactions,
    selectedYear,
    customer?.dueAmount || 0
  );

  // Period stats
  const periodSales = statementRows
    .filter((r) => !r.isOpeningBalance && r.type === 'sale_due')
    .reduce((sum, r) => sum + (Number(r.billAmount) || 0), 0);

  const periodCollections = statementRows
    .filter((r) => !r.isOpeningBalance && (r.type === 'payment' || Number(r.paidAmount) > 0))
    .reduce((sum, r) => sum + (Number(r.paidAmount) || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.65)',
      zIndex: 120,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '900px',
        maxHeight: '94vh',
        overflowY: 'auto',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '16px',
          borderBottom: '1px solid #f1f5f9',
          paddingBottom: '14px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                background: '#eff6ff',
                color: '#2563eb',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center'
              }}>
                <MdPerson size={22} />
              </span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  কাস্টমার হিসাব খাতা ও বাকি বিবরণী
                  <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '12px', fontWeight: '800' }}>
                    Customer Due Statement
                  </span>
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  <strong>{customer?.name}</strong> {customer?.customerType ? `(${customer.customerType})` : ''} | মোবাইল: {customer?.phone || 'N/A'} {customer?.address ? `| ঠিকানা: ${customer.address}` : ''}
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrint}
              title="স্টেটমেন্ট প্রিন্ট করুন"
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                color: '#334155'
              }}
            >
              <MdPrint size={16} /> প্রিন্ট
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <MdClose size={18} />
            </button>
          </div>
        </div>

        {/* Year Filter & Action Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '14px',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
              হিসাবের অর্থবছর / সাল:
            </span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1.5px solid #2563eb',
                fontSize: '13px',
                fontWeight: '700',
                color: '#1e40af',
                background: '#eff6ff',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">সকল সাল (All Time Statement)</option>
              {detectedYears.map((y) => (
                <option key={y} value={y}>{y} অর্থবছর</option>
              ))}
            </select>
          </div>

          {onOpenPayment && (
            <button
              onClick={() => {
                onClose();
                onOpenPayment(customer);
              }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 6px -1px rgba(37,99,235,0.3)'
              }}
            >
              <MdPayment size={16} /> বাকি আদায় করুন
            </button>
          )}
        </div>

        {/* 4 Financial Highlights */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px'
        }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
              {selectedYear === 'all' ? 'সর্বমোট প্রারম্ভিক' : `${selectedYear} সালের প্রারম্ভিক বাকি`}
            </span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: openingBalance > 0 ? '#dc2626' : '#059669' }}>
              {formatCurrency(openingBalance)}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
              {selectedYear === 'all' ? 'সর্বমোট বাকিতে বিক্রয়' : `${selectedYear} এ মোট বিক্রয় বিল`}
            </span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              {formatCurrency(periodSales)}
            </span>
          </div>

          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
              {selectedYear === 'all' ? 'সর্বমোট আদায়' : `${selectedYear} এ মোট আদায়`}
            </span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#16a34a' }}>
              {formatCurrency(periodCollections)}
            </span>
          </div>

          <div style={{ background: '#fef2f2', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
            <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: '700', display: 'block' }}>
              বর্তমান সমাপনী বাকি (Receivable)
            </span>
            <span style={{ fontSize: '18px', fontWeight: '900', color: '#dc2626' }}>
              {formatCurrency(customer?.dueAmount || closingBalance)}
            </span>
          </div>
        </div>

        {/* Year-End Balance Rollover Notice */}
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '8px 12px',
          marginBottom: '16px',
          fontSize: '12px',
          color: '#166534',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <MdInfo size={16} color="#15803d" style={{ flexShrink: 0 }} />
          <span>
            <strong>জের সংরক্ষণ নীতি:</strong> নতুন বছরে গেলে পূর্ববর্তী বছরের অবশিষ্ট বাকি <strong>"পূর্বের জের (Balance B/F)"</strong> হিসেবে সংরক্ষিত থাকবে। নতুন বছরের বিক্রয় ও আদায় তার সাথে যোগ-বিয়োগ হয়ে নিখুঁত চলমান ব্যালেন্স প্রদর্শন করবে।
          </span>
        </div>

        {/* Ledger Table */}
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: '700' }}>
                <th style={{ padding: '10px 12px' }}>তারিখ</th>
                <th style={{ padding: '10px 12px' }}>বিবরণ / লেনদেন</th>
                <th style={{ padding: '10px 12px' }}>ইনভয়েস নং</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>বিক্রয় বিল (৳)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>পরিশোধ (৳)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>বাকি বৃদ্ধি/হ্রাস (৳)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>চলমান বাকি জের (৳)</th>
              </tr>
            </thead>
            <tbody>
              {statementRows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    এই অর্থবছরে কোনো বাকি লেনদেন পাওয়া যায়নি।
                  </td>
                </tr>
              ) : (
                statementRows.map((row, idx) => {
                  const isOpening = Boolean(row.isOpeningBalance);
                  const isPayment = row.type === 'payment';
                  const isSale = row.type === 'sale_due';

                  return (
                    <tr key={row.id || idx} style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isOpening ? '#fefce8' : (idx % 2 === 0 ? '#ffffff' : '#f8fafc'),
                      fontWeight: isOpening ? '800' : 'normal'
                    }}>
                      {/* Date */}
                      <td style={{ padding: '10px 12px', color: isOpening ? '#854d0e' : '#1e293b' }}>
                        {isOpening ? `০১ জানু ${selectedYear}` : formatDateTime(row.date || row.createdAt)}
                      </td>

                      {/* Description */}
                      <td style={{ padding: '10px 12px' }}>
                        {isOpening ? (
                          <div style={{ color: '#854d0e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            📌 <span>{row.title || 'পূর্বের জের'}</span>
                          </div>
                        ) : isSale ? (
                          <span style={{ color: '#b45309', fontWeight: '700', background: '#fef3c7', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                            🛍️ বাকিতে বিক্রয়
                          </span>
                        ) : (
                          <span style={{ color: '#15803d', fontWeight: '700', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                            💰 বাকি আদায় ({row.paymentMethod || 'ক্যাশ'})
                          </span>
                        )}
                        {row.note && (
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            {row.note}
                          </div>
                        )}
                      </td>

                      {/* Invoice No */}
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '12px' }}>
                        {row.invoiceNo || (isOpening ? 'B/F' : '---')}
                      </td>

                      {/* Bill Amount */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                        {row.billAmount > 0 ? formatCurrency(row.billAmount) : '---'}
                      </td>

                      {/* Paid Amount */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#16a34a' }}>
                        {row.paidAmount > 0 ? formatCurrency(row.paidAmount) : '---'}
                      </td>

                      {/* Due Change */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: row.dueAmount >= 0 ? '#dc2626' : '#16a34a' }}>
                        {row.dueAmount > 0 ? `+${formatCurrency(row.dueAmount)}` : row.dueAmount < 0 ? formatCurrency(row.dueAmount) : '৳ ০.০০'}
                      </td>

                      {/* Running Balance */}
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: row.runningBalance > 0 ? '#dc2626' : '#059669', fontSize: '13px' }}>
                        {formatCurrency(row.runningBalance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerStatementModal;
