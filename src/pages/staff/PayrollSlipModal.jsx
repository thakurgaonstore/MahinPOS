import React from 'react';
import { formatCurrency, formatDate, formatDateTime, numberToBengaliWords } from '../../utils/formatters';
import { MdPrint, MdClose, MdReceipt, MdCheckCircle, MdCorporateFare } from 'react-icons/md';

const PayrollSlipModal = ({ record, shopConfig, onClose }) => {
  if (!record) return null;

  const shopName = shopConfig?.shopName || shopConfig?.name || 'Mahin POS Store';
  const shopPhone = shopConfig?.phone || '01700-000000';
  const shopAddress = shopConfig?.address || 'বাংলাদেশ';
  const shopLogo = shopConfig?.logoUrl || '';
  const slogan = shopConfig?.slogan || 'আপনার বিশ্বস্ত শপ';
  const binVat = shopConfig?.binVat || '';

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

  // Earnings Breakdown
  const baseSalary = Number(record.baseSalary) || 0;
  const houseRent = Number(record.houseRent) || 0;
  const medical = Number(record.medical) || 0;
  const conveyance = Number(record.conveyance) || 0;
  const bonus = Number(record.bonus) || 0;
  const incentive = Number(record.incentive) || 0;
  const otherAllowance = Number(record.otherAllowance) || 0;
  const grossEarnings = record.grossEarnings !== undefined ? Number(record.grossEarnings) : (baseSalary + houseRent + medical + conveyance + bonus + incentive + otherAllowance);

  // Deductions Breakdown
  const advanceDeduction = Number(record.advanceDeduction) || (record.deduction && !record.totalDeductions ? Number(record.deduction) : 0);
  const taxDeduction = Number(record.taxDeduction) || 0;
  const otherDeduction = Number(record.otherDeduction) || 0;
  const otherDeductionReason = record.otherDeductionReason || '';
  const totalDeductions = record.totalDeductions !== undefined ? Number(record.totalDeductions) : (advanceDeduction + taxDeduction + otherDeduction);

  // Net Paid
  const netPaid = Number(record.paidAmount) || Math.max(0, grossEarnings - totalDeductions);
  const paymentDate = record.paymentDate || (record.createdAt ? formatDate(record.createdAt) : formatDate(new Date()));
  const voucherNo = record.id ? `PAY-${record.id.slice(0, 8).toUpperCase()}` : `PAY-${new Date().getTime().toString().slice(-6)}`;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.75)',
      zIndex: 120,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      backdropFilter: 'blur(4px)'
    }}>
      {/* Print-specific style tag */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .payroll-print-wrapper, .payroll-print-wrapper * {
            visibility: visible;
          }
          .payroll-print-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 10mm 15mm !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm 12mm;
          }
        }
      `}</style>

      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '840px',
        maxHeight: '94vh',
        overflowY: 'auto',
        borderRadius: '16px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Controls (No Print) */}
        <div className="no-print" style={{
          padding: '14px 24px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f172a', fontWeight: '800', fontSize: '15px' }}>
            <MdReceipt size={22} color="#2563eb" /> A4 অফিসিয়াল প্যাড বেতন স্লিপ (A4 Official Pad Payslip)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '6px',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
              }}
            >
              <MdPrint size={18} /> A4 প্যাডে প্রিন্ট করুন (Print Slip)
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

        {/* Printable Official Pad Payslip Body */}
        <div className="payroll-print-wrapper" style={{
          padding: '36px 40px',
          fontFamily: "'Hind Siliguri', 'Inter', sans-serif",
          color: '#0f172a',
          background: '#ffffff',
          position: 'relative'
        }}>
          
          {/* Top Pad Header Accent */}
          <div style={{ height: '6px', background: 'linear-gradient(90deg, #1e3a8a, #2563eb, #3b82f6)', borderRadius: '4px', marginBottom: '20px' }}></div>

          {/* Letterhead Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid #1e3a8a',
            paddingBottom: '18px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {shopLogo ? (
                <img
                  src={shopLogo}
                  alt="Shop Logo"
                  style={{ maxHeight: '78px', maxWidth: '140px', objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : (
                <div style={{ width: '64px', height: '64px', borderRadius: '10px', background: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                  <MdCorporateFare size={36} />
                </div>
              )}
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: '900', color: '#1e3a8a', margin: '0 0 2px', letterSpacing: '-0.3px' }}>{shopName}</h1>
                <p style={{ fontSize: '13px', color: '#475569', margin: '0 0 2px' }}>{slogan}</p>
                <p style={{ fontSize: '12px', color: '#334155', margin: '0 0 2px' }}>{shopAddress} | মোবাইল: <b>{shopPhone}</b></p>
                {binVat && <p style={{ fontSize: '11px', color: '#2563eb', fontWeight: '600', margin: 0 }}>BIN/VAT: {binVat}</p>}
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{
                display: 'inline-block',
                background: '#1e3a8a',
                color: '#ffffff',
                padding: '5px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '800',
                letterSpacing: '0.5px',
                marginBottom: '8px'
              }}>
                মাসিক বেতন ও পে-রোল রসিদ
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>ভাউচার নং: <b style={{ color: '#0f172a' }}>#{voucherNo}</b></div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>প্রদানের তারিখ: <b style={{ color: '#0f172a' }}>{paymentDate}</b></div>
            </div>
          </div>

          {/* Employee Profile Information Card */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '14px 18px',
            marginBottom: '22px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '14px',
            fontSize: '13px'
          }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>কর্মীর নাম (Employee Name):</span>
              <strong style={{ fontSize: '15px', color: '#0f172a' }}>{record.staffName || record.staff?.name}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>পদবী (Designation / Role):</span>
              <strong style={{ color: '#2563eb' }}>{roleLabels[record.role || record.staff?.role] || record.role}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>মোবাইল নম্বর (Phone):</span>
              <strong>{record.staff?.phone || '---'}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>বেতন মাস (Salary Month):</span>
              <strong style={{ color: '#059669', fontSize: '14px' }}>{formatMonthYear(record.month)}</strong>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>পেমেন্ট মাধ্যম (Method):</span>
              <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '12px' }}>
                {record.paymentMethod || 'ক্যাশ (Cash)'}
              </span>
            </div>

            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>স্ট্যাটাস (Payment Status):</span>
              <span style={{ color: '#059669', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MdCheckCircle size={15} /> সম্পূর্ণ পরিশোধিত (PAID)
              </span>
            </div>
          </div>

          {/* Two-Column Official Earnings & Deductions Table */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '18px', marginBottom: '22px' }}>
            
            {/* Left: Earnings Table */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#1e3a8a', color: '#ffffff', padding: '8px 14px', fontWeight: '800', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span>উপার্জন খাত (Earnings & Allowances)</span>
                <span>টাকা (৳)</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>১. মূল বেতন (Basic Salary)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(baseSalary)}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>২. বাড়িভাড়া ভাতা (House Rent)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{houseRent > 0 ? formatCurrency(houseRent) : '---'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>৩. চিকিৎসা ভাতা (Medical Allowance)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{medical > 0 ? formatCurrency(medical) : '---'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>৪. যাতায়াত ভাতা (Conveyance)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{conveyance > 0 ? formatCurrency(conveyance) : '---'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>৫. উৎসব / পারফরম্যান্স বোনাস (Bonus)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: bonus > 0 ? '#15803d' : '#334155' }}>{bonus > 0 ? formatCurrency(bonus) : '---'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>৬. ইনসেন্টিভ / কমিশন (Incentives)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{incentive > 0 ? formatCurrency(incentive) : '---'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>৭. অন্যান্য বিশেষ ভাতা (Other Allowance)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{otherAllowance > 0 ? formatCurrency(otherAllowance) : '---'}</td>
                  </tr>
                  <tr style={{ background: '#eff6ff', borderTop: '2px solid #2563eb' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '800', color: '#1e3a8a' }}>মোট উপার্জন (Gross Earnings):</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '900', color: '#1d4ed8', fontSize: '14px' }}>
                      {formatCurrency(grossEarnings)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Right: Deductions Table */}
            <div style={{ border: '1px solid #cbd5e1', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#991b1b', color: '#ffffff', padding: '8px 14px', fontWeight: '800', fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                <span>কর্তন খাত (Deductions)</span>
                <span>টাকা (৳)</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>১. অগ্রিম বেতন সমন্বয় (Advance)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: advanceDeduction > 0 ? '#dc2626' : '#334155', fontWeight: advanceDeduction > 0 ? '700' : 'normal' }}>
                      {advanceDeduction > 0 ? formatCurrency(advanceDeduction) : '---'}
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>২. ইনকাম ট্যাক্স / টিডিএস (Tax)</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{taxDeduction > 0 ? formatCurrency(taxDeduction) : '---'}</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', color: '#334155' }}>
                      <div>৩. অন্যান্য কর্তন (Other Deductions)</div>
                      {otherDeductionReason && (
                        <span style={{ fontSize: '10.5px', color: '#64748b', display: 'block' }}>কারণ: {otherDeductionReason}</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{otherDeduction > 0 ? formatCurrency(otherDeduction) : '---'}</td>
                  </tr>
                  <tr>
                    <td colSpan="2" style={{ height: '70px', verticalAlign: 'middle', textAlign: 'center', color: '#94a3b8', fontSize: '11px', background: '#fafafa' }}>
                      {totalDeductions === 0 ? 'কোনো কর্তন প্রযোজ্য নয়' : ''}
                    </td>
                  </tr>
                  <tr style={{ background: '#fef2f2', borderTop: '2px solid #dc2626' }}>
                    <td style={{ padding: '10px 12px', fontWeight: '800', color: '#991b1b' }}>মোট কর্তন (Total Deductions):</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '900', color: '#dc2626', fontSize: '14px' }}>
                      - {formatCurrency(totalDeductions)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

          </div>

          {/* Net Payable & Summary Box */}
          <div style={{
            background: '#f8fafc',
            border: '2px solid #0f172a',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px'
          }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                পরিশোধিত সর্বমোট নিট বেতন (Net Payable & Paid):
              </span>
              <div style={{ fontSize: '26px', fontWeight: '900', color: '#1e3a8a', marginTop: '2px' }}>
                {formatCurrency(netPaid)}
              </div>
              <div style={{ fontSize: '13px', color: '#334155', fontWeight: '700', marginTop: '4px' }}>
                কথায়: <span style={{ color: '#0f172a' }}>{numberToBengaliWords(netPaid)}</span>
              </div>
              {record.note && (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  মন্তব্য/নোট: {record.note}
                </div>
              )}
            </div>

            <div style={{
              border: '2px dashed #059669',
              borderRadius: '8px',
              padding: '8px 16px',
              textAlign: 'center',
              background: '#ecfdf5',
              color: '#059669'
            }}>
              <span style={{ fontSize: '11px', fontWeight: '700', display: 'block', textTransform: 'uppercase' }}>Official Seal / Stamp</span>
              <strong style={{ fontSize: '16px', fontWeight: '900', letterSpacing: '1px' }}>✓ PAID</strong>
              <span style={{ fontSize: '10px', display: 'block', color: '#047857' }}>পরিশোধ সম্পন্ন</span>
            </div>
          </div>

          {/* 4 Signatures Section (Standard Corporate A4 Pad) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '16px',
            marginTop: '55px',
            textAlign: 'center',
            fontSize: '12px'
          }}>
            <div>
              <div style={{ borderTop: '1px dashed #64748b', paddingTop: '6px', fontWeight: '700', color: '#334155' }}>
                প্রস্তুতকারক
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Prepared By</span>
            </div>

            <div>
              <div style={{ borderTop: '1px dashed #64748b', paddingTop: '6px', fontWeight: '700', color: '#334155' }}>
                হিসাবরক্ষক
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Accountant / Checked</span>
            </div>

            <div>
              <div style={{ borderTop: '1px dashed #64748b', paddingTop: '6px', fontWeight: '700', color: '#334155' }}>
                ম্যানেজিং ডিরেক্টর / এডমিন
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>MD / Proprietor Approval</span>
            </div>

            <div>
              <div style={{ borderTop: '1px dashed #64748b', paddingTop: '6px', fontWeight: '700', color: '#334155' }}>
                কর্মচারীর স্বাক্ষর ও তারিখ
              </div>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>Employee Signature & Date</span>
            </div>
          </div>

          {/* Slip Footer */}
          <div style={{ textAlign: 'center', marginTop: '36px', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
            অফিসিয়াল সফটওয়্যার: Mahin POS | এটি একটি কম্পিউটার জেনারেটেড প্রামাণ্য পে-রোল বেতন ভাউচার।
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayrollSlipModal;
