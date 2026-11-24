import React from 'react';
import { formatCurrency, formatDate, formatDateTime, numberToBengaliWords } from '../../utils/formatters';
import { MdPrint, MdClose, MdReceipt, MdCheckCircle } from 'react-icons/md';

const PayrollSlipModal = ({ record, shopConfig, onClose }) => {
  if (!record) return null;

  const shopName = shopConfig?.shopName || shopConfig?.name || 'Mahin POS Store';
  const shopPhone = shopConfig?.phone || '01700-000000';
  const shopAddress = shopConfig?.address || 'বাংলাদেশ';
  const shopLogo = shopConfig?.logoUrl || '';
  const slogan = shopConfig?.slogan || 'আপনার বিশ্বস্ত শপ';

  const handlePrint = () => {
    window.print();
  };

  // Convert "YYYY-MM" to readable Bengali/English Month
  const formatMonthYear = (monthStr) => {
    if (!monthStr) return '';
    const [year, month] = monthStr.split('-');
    const monthNamesBn = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const monthNamesEn = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const idx = parseInt(month, 10) - 1;
    if (idx >= 0 && idx < 12) {
      return `${monthNamesBn[idx]} ${year} (${monthNamesEn[idx]} ${year})`;
    }
    return monthStr;
  };

  const roleLabels = {
    manager: 'ম্যানেজার (Manager)',
    cashier: 'ক্যাশিয়ার (Cashier)',
    salesman: 'সেলসম্যান (Salesman)',
    accountant: 'হিসাবরক্ষক (Accountant)',
    staff: 'সহকারী কর্মী (Staff)'
  };

  const baseSalary = Number(record.baseSalary) || 0;
  const bonus = Number(record.bonus) || 0;
  const deduction = Number(record.deduction) || 0;
  const grossPay = baseSalary + bonus;
  const netPaid = Number(record.paidAmount) || Math.max(0, grossPay - deduction);
  const paymentDate = record.paymentDate || (record.createdAt ? formatDate(record.createdAt) : formatDate(new Date()));
  const voucherNo = record.id ? record.id.slice(0, 8).toUpperCase() : 'PAY-001';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
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
        maxWidth: '720px',
        maxHeight: '94vh',
        overflowY: 'auto',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Controls (No Print) */}
        <div className="no-print" style={{
          padding: '14px 20px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '800', fontSize: '15px' }}>
            <MdReceipt size={20} color="#2563eb" /> পে-রোল ও বেতন স্লিপ ভাউচার
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MdPrint size={18} /> স্লিপ প্রিন্ট করুন (Print Slip)
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#e2e8f0',
                color: '#475569',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <MdClose size={18} />
            </button>
          </div>
        </div>

        {/* Printable Payslip Body */}
        <div style={{
          padding: '32px',
          fontFamily: "'Hind Siliguri', 'Inter', sans-serif",
          color: '#0f172a',
          background: '#ffffff'
        }}>
          {/* Slip Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #2563eb',
            paddingBottom: '16px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {shopLogo && (
                <img
                  src={shopLogo}
                  alt="Shop Logo"
                  style={{ maxHeight: '70px', maxWidth: '120px', objectFit: 'contain', borderRadius: '6px' }}
                />
              )}
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#1e3a8a', margin: '0 0 2px' }}>{shopName}</h1>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 2px' }}>{slogan}</p>
                <p style={{ fontSize: '12px', margin: '0 0 2px' }}>{shopAddress} | মোবাইল: <b>{shopPhone}</b></p>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{
                display: 'inline-block',
                background: '#2563eb',
                color: '#ffffff',
                padding: '4px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                marginBottom: '6px'
              }}>
                বেতন স্লিপ (SALARY PAYSLIP)
              </div>
              <div style={{ fontSize: '12px', color: '#475569' }}>ভাউচার নং: <b>#{voucherNo}</b></div>
              <div style={{ fontSize: '12px', color: '#475569' }}>তারিখ: <b>{paymentDate}</b></div>
            </div>
          </div>

          {/* Employee & Period Details */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            fontSize: '13px'
          }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>কর্মীর নাম:</span>
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>{record.staffName || record.staff?.name}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>পদবী / রোল:</span>
              <strong style={{ color: '#2563eb' }}>{roleLabels[record.role || record.staff?.role] || record.role}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>মোবাইল নম্বর:</span>
              <strong>{record.staff?.phone || '---'}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>বেতন মাস / সময়কাল:</span>
              <strong style={{ color: '#059669', fontSize: '14px' }}>{formatMonthYear(record.month)}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>পেমেন্ট মাধ্যম:</span>
              <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '12px' }}>
                {record.paymentMethod || 'ক্যাশ (Cash)'}
              </span>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>স্ট্যাটাস:</span>
              <span style={{ color: '#059669', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MdCheckCircle size={14} /> সম্পূর্ণ পরিশোধিত (Paid)
              </span>
            </div>
          </div>

          {/* Breakdown Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#ffffff', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', borderTopLeftRadius: '6px' }}>বিবরণ (Salary Component)</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', borderTopRightRadius: '6px' }}>টাকার পরিমাণ (Amount ৳)</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px 14px', color: '#334155' }}>১. মাসিক মূল বেতন (Basic Salary)</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(baseSalary)}</td>
              </tr>
              {bonus > 0 && (
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f0fdf4' }}>
                  <td style={{ padding: '10px 14px', color: '#166534' }}>২. অতিরিক্ত ভাতা / বোনাস (Bonus & Allowances)</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#166534' }}>+ {formatCurrency(bonus)}</td>
                </tr>
              )}
              <tr style={{ borderBottom: '1px solid #cbd5e1', background: '#f8fafc' }}>
                <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0f172a' }}>মোট উপার্জন (Gross Earnings)</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '800', color: '#0f172a' }}>{formatCurrency(grossPay)}</td>
              </tr>
              {deduction > 0 && (
                <tr style={{ borderBottom: '1px solid #fecaca', background: '#fff5f5' }}>
                  <td style={{ padding: '10px 14px', color: '#dc2626' }}>৩. অগ্রিম বেতন সমন্বয় / অন্যান্য কর্তন (Advance Deductions)</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: '#dc2626' }}>- {formatCurrency(deduction)}</td>
                </tr>
              )}
              <tr style={{ borderTop: '2px solid #0f172a', background: '#eff6ff' }}>
                <td style={{ padding: '12px 14px', fontSize: '15px', fontWeight: '900', color: '#1e3a8a' }}>
                  পরিশোধিত সর্বমোট নিট বেতন (Net Payable & Paid)
                </td>
                <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '18px', fontWeight: '900', color: '#2563eb' }}>
                  {formatCurrency(netPaid)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Amount in Words */}
          <div style={{
            background: '#faf5ff',
            border: '1px dashed #d8b4fe',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            color: '#6b21a8'
          }}>
            কথায়: <b>{numberToBengaliWords(netPaid)}</b>
            {record.note && <span style={{ display: 'block', marginTop: '4px', color: '#475569', fontSize: '12px' }}>নোট: {record.note}</span>}
          </div>

          {/* Signatures Section */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '20px',
            marginTop: '55px',
            textAlign: 'center',
            fontSize: '12px'
          }}>
            <div>
              <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '6px', fontWeight: '700', color: '#334155' }}>
                প্রস্তুতকারকের স্বাক্ষর
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Prepared By</span>
            </div>

            <div>
              <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '6px', fontWeight: '700', color: '#334155' }}>
                হিসাবরক্ষক / ম্যানেজার
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Approved By</span>
            </div>

            <div>
              <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '6px', fontWeight: '700', color: '#334155' }}>
                কর্মী / গ্রহীতার স্বাক্ষর
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Employee Signature</span>
            </div>
          </div>

          {/* Slip Footer */}
          <div style={{ textAlign: 'center', marginTop: '30px', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            সফটওয়্যার তৈরি করেছে: Mahin POS | এটি একটি স্বয়ংক্রিয়ভাবে জেনারেট হওয়া পে-রোল রসিদ।
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollSlipModal;
