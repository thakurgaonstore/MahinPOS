import React, { useRef, useEffect } from 'react';
import { generateBarcodeSvg } from '../../utils/barcodeHelper';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatDate, formatDateTime, numberToBengaliWords } from '../../utils/formatters';
import { MdPrint, MdClose, MdReceipt, MdDescription, MdFormatListBulleted } from 'react-icons/md';

const InvoiceViewModal = ({ invoice, shopConfig, onClose, initialFormat }) => {
  const isWholesaleOrDealer = invoice?.pricingTier === 'wholesale' ||
                              invoice?.pricingTier === 'dealer' ||
                              invoice?.customerType === 'wholesale' ||
                              invoice?.customerType === 'dealer';

  const defaultFormat = initialFormat || (isWholesaleOrDealer ? 'a4' : 'pos');
  const [format, setFormat] = React.useState(defaultFormat); // 'pos' | 'memo' | 'a4'
  const barcodeRef = useRef(null);

  useEffect(() => {
    if (barcodeRef.current && invoice?.invoiceNo) {
      generateBarcodeSvg(barcodeRef.current, invoice.invoiceNo, {
        height: 35,
        width: 1.4,
        fontSize: 11
      });
    }
  }, [invoice, format]);

  if (!invoice) return null;

  const shopName = shopConfig?.shopName || shopConfig?.name || 'Mahin POS Store';
  const shopLogo = shopConfig?.logoUrl || invoice?.shopLogo || invoice?.logoUrl || '';
  const shopPhone = shopConfig?.phone || '01700-000000';
  const shopAddress = shopConfig?.address || 'বাংলাদেশ';
  const binVat = shopConfig?.binVat || '';
  const slogan = shopConfig?.slogan || 'আপনার বিশ্বস্ত শপ';
  const returnPolicy = shopConfig?.returnPolicy || 'বিক্রিত পণ্য ৩ দিনের মধ্যে ক্যাশ মেমো সহ ফেরতযোগ্য।';

  const formatQuantity = (qty, unit = '') => {
    const num = Number(qty) || 0;
    const u = String(unit || '').toLowerCase();
    if (num < 1 && (u.includes('কেজি') || u.includes('kg'))) {
      const gm = Math.round(num * 1000);
      return `${num} ${unit} (${gm} গ্রাম)`;
    }
    if (num < 1 && (u.includes('লিটার') || u.includes('ltr') || u.includes('liter'))) {
      const ml = Math.round(num * 1000);
      return `${num} ${unit} (${ml} মিলি)`;
    }
    return `${num} ${unit || ''}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: format === 'a4' ? '850px' : format === 'memo' ? '650px' : '420px',
        maxHeight: '92vh',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Modal Header (No Print) */}
        <div className="no-print" style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc'
        }}>
          {/* Format Selector Buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isWholesaleOrDealer ? (
              <>
                <button
                  onClick={() => setFormat('a4')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: format === 'a4' ? '#2563eb' : '#cbd5e1',
                    background: format === 'a4' ? '#eff6ff' : '#ffffff',
                    color: format === 'a4' ? '#2563eb' : '#475569',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MdDescription size={16} />
                  ১. অফিসিয়াল ইনভয়েস (A4)
                </button>
                <button
                  onClick={() => setFormat('memo')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: format === 'memo' ? '#2563eb' : '#cbd5e1',
                    background: format === 'memo' ? '#eff6ff' : '#ffffff',
                    color: format === 'memo' ? '#2563eb' : '#475569',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MdFormatListBulleted size={16} />
                  ২. ক্যাশ মেমো (A5)
                </button>
                <button
                  onClick={() => setFormat('pos')}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: format === 'pos' ? '#2563eb' : '#cbd5e1',
                    background: format === 'pos' ? '#eff6ff' : '#ffffff',
                    color: format === 'pos' ? '#2563eb' : '#475569',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MdReceipt size={14} />
                  ৩. থার্মাল POS (80mm)
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setFormat('pos')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: format === 'pos' ? '#2563eb' : '#cbd5e1',
                    background: format === 'pos' ? '#eff6ff' : '#ffffff',
                    color: format === 'pos' ? '#2563eb' : '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MdReceipt size={16} />
                  ১. থার্মাল POS (80mm)
                </button>
                <button
                  onClick={() => setFormat('memo')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: format === 'memo' ? '#2563eb' : '#cbd5e1',
                    background: format === 'memo' ? '#eff6ff' : '#ffffff',
                    color: format === 'memo' ? '#2563eb' : '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MdFormatListBulleted size={16} />
                  ২. ক্যাশ মেমো (A5)
                </button>
                <button
                  onClick={() => setFormat('a4')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: format === 'a4' ? '#2563eb' : '#cbd5e1',
                    background: format === 'a4' ? '#eff6ff' : '#ffffff',
                    color: format === 'a4' ? '#2563eb' : '#475569',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MdDescription size={16} />
                  ৩. অফিসিয়াল ইনভয়েস (A4)
                </button>
              </>
            )}

            {isWholesaleOrDealer && (
              <span style={{
                fontSize: '11px',
                fontWeight: '800',
                padding: '4px 8px',
                borderRadius: '6px',
                background: invoice.pricingTier === 'dealer' ? '#f5f3ff' : '#ecfdf5',
                color: invoice.pricingTier === 'dealer' ? '#7c3aed' : '#059669',
                border: '1px solid',
                borderColor: invoice.pricingTier === 'dealer' ? '#ddd6fe' : '#a7f3d0'
              }}>
                {invoice.pricingTier === 'dealer' ? '🏢 ডিলার ইনভয়েস' : '📦 পাইকারি মেমো'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={handlePrint}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MdPrint size={18} />
              প্রিন্ট করুন (Print)
            </button>
            <button
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '6px',
                padding: '8px',
                cursor: 'pointer',
                color: '#64748b'
              }}
            >
              <MdClose size={20} />
            </button>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f1f5f9' }}>
          <div className="print-area" style={{
            background: '#ffffff',
            margin: '0 auto',
            padding: format === 'pos' ? '18px 14px' : '32px',
            maxWidth: format === 'pos' ? '340px' : format === 'memo' ? '560px' : '750px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            borderRadius: format === 'pos' ? '0' : '8px',
            fontFamily: "'Hind Siliguri', 'Inter', sans-serif",
            color: '#000000'
          }}>

            {/* ========================================================= */}
            {/* FORMAT 1: THERMAL POS RECEIPT (58mm / 80mm)               */}
            {/* ========================================================= */}
            {format === 'pos' && (
              <div style={{ fontSize: '13px', lineHeight: '1.4' }}>
                <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                  {shopLogo && (
                    <img
                      src={shopLogo}
                      alt="Shop Logo"
                      style={{ maxHeight: '55px', maxWidth: '140px', objectFit: 'contain', margin: '0 auto 6px auto', display: 'block' }}
                    />
                  )}
                  <h2 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 2px' }}>{shopName}</h2>
                  <p style={{ fontSize: '12px', color: '#333', margin: '0 0 2px' }}>{slogan}</p>
                  <p style={{ fontSize: '11px', color: '#555', margin: '0 0 2px' }}>{shopAddress}</p>
                  <p style={{ fontSize: '12px', fontWeight: '600', margin: '0 0 4px' }}>মোবাইল: {shopPhone}</p>
                  {binVat && <p style={{ fontSize: '11px', margin: '0' }}>BIN/VAT: {binVat}</p>}
                </div>

                <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '6px 0', margin: '8px 0', fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>ইনভয়েস নং: <b>#{invoice.invoiceNo}</b></span>
                    <span>{formatDate(invoice.createdAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span>কাস্টমার: {invoice.customerName || 'নগদ ক্রেতা'}</span>
                    <span>{invoice.customerPhone || ''}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span>ক্যাশিয়ার: {invoice.cashierName || 'Admin'}</span>
                    <span>{formatDateTime(invoice.createdAt).split(',')[1]}</span>
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', margin: '8px 0' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px dashed #000', textAlign: 'left' }}>
                      <th style={{ padding: '4px 0' }}>পণ্য</th>
                      <th style={{ padding: '4px 0', textAlign: 'center' }}>পরিমাণ</th>
                      <th style={{ padding: '4px 0', textAlign: 'right' }}>দর</th>
                      <th style={{ padding: '4px 0', textAlign: 'right' }}>মোট</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items?.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px dotted #ccc' }}>
                        <td style={{ padding: '4px 0' }}>
                          <div>{item.name}</div>
                          {item.discount > 0 && <span style={{ fontSize: '10px', color: '#666' }}>(ছাড়: ৳{item.discount})</span>}
                        </td>
                        <td style={{ padding: '4px 0', textAlign: 'center' }}>{formatQuantity(item.quantity, item.unit)}</td>
                        <td style={{ padding: '4px 0', textAlign: 'right' }}>{item.price}</td>
                        <td style={{ padding: '4px 0', textAlign: 'right' }}><b>{item.total}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ borderTop: '1px dashed #000', paddingTop: '6px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span>মোট সাবটোটাল:</span>
                    <span>{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>বিশেষ ছাড়:</span>
                      <span>- {formatCurrency(invoice.discountAmount)}</span>
                    </div>
                  )}
                  {invoice.pointsRedeemedDiscount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>পয়েন্ট ডিসকাউন্ট:</span>
                      <span>- {formatCurrency(invoice.pointsRedeemedDiscount)}</span>
                    </div>
                  )}
                  {invoice.taxAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span>ভ্যাট/ট্যাক্স:</span>
                      <span>+ {formatCurrency(invoice.taxAmount)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: '800', borderTop: '1px solid #000', paddingTop: '4px', marginTop: '4px' }}>
                    <span>সর্বমোট দেয়:</span>
                    <span>{formatCurrency(invoice.grandTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                    <span>পরিশোধ ({invoice.paymentMethod || 'নগদ'}):</span>
                    <span>{formatCurrency(invoice.paidAmount)}</span>
                  </div>
                  {invoice.changeReturn > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', fontWeight: '700' }}>
                      <span>ফেরত দেওয়া হয়েছে:</span>
                      <span>{formatCurrency(invoice.changeReturn)}</span>
                    </div>
                  )}
                  {invoice.totalRefundAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: '#dc2626', fontWeight: '800' }}>
                      <span>পণ্য রিটার্ন রিফান্ড:</span>
                      <span>- {formatCurrency(invoice.totalRefundAmount)}</span>
                    </div>
                  )}
                  {invoice.dueAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', color: '#dc2626', fontWeight: '800' }}>
                      <span>বাকি পাওনা:</span>
                      <span>{formatCurrency(invoice.dueAmount)}</span>
                    </div>
                  )}
                </div>

                {/* Rewards & Loyalty Point Balance Info (Retail only) */}
                {!isWholesaleOrDealer && (invoice.customerPhone || invoice.customerRewardPoints !== undefined || invoice.pointsEarned > 0 || invoice.pointsRedeemed > 0) && (
                  <div style={{
                    background: '#eff6ff',
                    border: '1px dashed #bfdbfe',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    margin: '8px 0',
                    fontSize: '11px',
                    textAlign: 'center',
                    color: '#1e3a8a'
                  }}>
                    <div style={{ fontWeight: '800', marginBottom: '2px' }}>🎁 লয়্যালটি রিওয়ার্ড পয়েন্টস (Loyalty Points)</div>
                    <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '4px' }}>
                      <span>পূর্বের: <b>{invoice.customerRewardPoints || 0} pt</b></span>
                      {invoice.pointsRedeemed > 0 && <span style={{ color: '#dc2626' }}>ব্যবহৃত: <b>-{invoice.pointsRedeemed}</b></span>}
                      {invoice.pointsEarned > 0 && <span style={{ color: '#059669' }}>অর্জিত: <b>+{invoice.pointsEarned}</b></span>}
                      <span>বর্তমান ব্যালান্স: <b>{invoice.finalCustomerPoints !== undefined ? invoice.finalCustomerPoints : (Number(invoice.customerRewardPoints || 0) + Number(invoice.pointsEarned || 0) - Number(invoice.pointsRedeemed || 0))} pt</b></span>
                    </div>
                  </div>
                )}

                {/* Barcode & Footer */}
                <div style={{ textAlign: 'center', marginTop: '12px' }}>
                  <svg ref={barcodeRef} style={{ maxWidth: '100%' }}></svg>
                  <p style={{ fontSize: '10px', margin: '6px 0 2px' }}>{returnPolicy}</p>
                  <p style={{ fontSize: '11px', fontWeight: '700', margin: '2px 0' }}>ধন্যবাদ, আবার আসবেন!</p>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* FORMAT 2: BANGLADESHI TRADITIONAL CASH MEMO (A5)          */}
            {/* ========================================================= */}
            {format === 'memo' && (
              <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px double #0f172a', paddingBottom: '12px', marginBottom: '14px' }}>
                  {shopLogo && (
                    <img
                      src={shopLogo}
                      alt="Shop Logo"
                      style={{ maxHeight: '60px', maxWidth: '160px', objectFit: 'contain', margin: '0 auto 6px auto', display: 'block' }}
                    />
                  )}
                  <div style={{ display: 'inline-block', border: '1px solid #0f172a', padding: '2px 14px', borderRadius: '14px', fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
                    ক্যাশ মেমো (CASH MEMO)
                  </div>
                  <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '2px 0' }}>{shopName}</h1>
                  <p style={{ fontSize: '13px', margin: '0' }}>{slogan}</p>
                  <p style={{ fontSize: '12px', margin: '2px 0' }}>{shopAddress} | মোবাইল: <b>{shopPhone}</b></p>
                </div>

                {/* Info Bar */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '10px', borderRadius: '6px', marginBottom: '14px', fontSize: '13px' }}>
                  <div>
                    <div>
                      মেমো নং: <b>#{invoice.invoiceNo}</b>
                      {invoice.pricingTier === 'dealer' && <span style={{ marginLeft: '6px', fontSize: '11px', background: '#ddd6fe', color: '#5b21b6', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>ডিলার মেমো</span>}
                      {invoice.pricingTier === 'wholesale' && <span style={{ marginLeft: '6px', fontSize: '11px', background: '#a7f3d0', color: '#065f46', padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>পাইকারি মেমো</span>}
                    </div>
                    <div>ক্রেতার নাম: <b>{invoice.customerName || 'সাধারণ ক্রেতা'}</b></div>
                    <div>ঠিকানা: {invoice.customerAddress || '---'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>তারিখ: <b>{formatDate(invoice.createdAt)}</b></div>
                    <div>মোবাইল: <b>{invoice.customerPhone || '---'}</b></div>
                    <div>বিক্রয়কারী: {invoice.cashierName || 'Main Admin'}</div>
                  </div>
                </div>

                {/* Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #0f172a', marginBottom: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #0f172a' }}>
                      <th style={{ border: '1px solid #0f172a', padding: '6px 8px', width: '35px', textAlign: 'center' }}>নং</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px 8px', textAlign: 'left' }}>পণ্যের বিবরণ</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px 8px', width: '70px', textAlign: 'center' }}>পরিমাণ</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px 8px', width: '85px', textAlign: 'right' }}>দর (৳)</th>
                      <th style={{ border: '1px solid #0f172a', padding: '6px 8px', width: '95px', textAlign: 'right' }}>মোট টাকা (৳)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>
                          <b>{item.name}</b>
                        </td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'center' }}>{formatQuantity(item.quantity, item.unit)}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right' }}>{item.price}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right' }}><b>{item.total}</b></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Bottom Calculation & Words */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', alignItems: 'start' }}>
                  <div>
                    <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', fontSize: '13px' }}>
                      <b>কথায়:</b> {numberToBengaliWords(invoice.grandTotal)}
                    </div>
                    {!isWholesaleOrDealer && invoice.customerPhone && (
                      <div style={{ marginTop: '8px', background: '#eff6ff', border: '1px dashed #bfdbfe', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                        <div style={{ fontWeight: '700', color: '#1e40af', marginBottom: '2px' }}>🎁 লয়্যালটি রিওয়ার্ড পয়েন্টস</div>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', color: '#334155' }}>
                          <span>পূর্বের: <b>{invoice.customerRewardPoints || 0} pt</b></span>
                          {invoice.pointsRedeemed > 0 && <span style={{ color: '#dc2626' }}>ব্যবহৃত: <b>-{invoice.pointsRedeemed}</b></span>}
                          {invoice.pointsEarned > 0 && <span style={{ color: '#059669' }}>অর্জিত: <b>+{invoice.pointsEarned}</b></span>}
                          <span>ব্যালান্স: <b>{invoice.finalCustomerPoints !== undefined ? invoice.finalCustomerPoints : (Number(invoice.customerRewardPoints || 0) + Number(invoice.pointsEarned || 0) - Number(invoice.pointsRedeemed || 0))} pt</b></span>
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: '12px', fontSize: '12px', color: '#555' }}>
                      <p><b>শর্তাবলী:</b> {returnPolicy}</p>
                    </div>
                  </div>

                  <div style={{ fontSize: '13px', lineHeight: '1.8' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>মোট সাব-টোটাল:</span>
                      <span>{formatCurrency(invoice.subtotal)}</span>
                    </div>
                    {invoice.discountAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>মোট ছাড় / ডিসকাউন্ট:</span>
                        <span>- {formatCurrency(invoice.discountAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '4px', fontWeight: '800', fontSize: '15px' }}>
                      <span>সর্বমোট টাকা:</span>
                      <span>{formatCurrency(invoice.grandTotal)}</span>
                    </div>
                    {invoice.totalRefundAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: '800' }}>
                        <span>পণ্য রিটার্ন রিফান্ড:</span>
                        <span>- {formatCurrency(invoice.totalRefundAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>জমা / ক্যাশ গ্রহণ:</span>
                      <span>{formatCurrency(invoice.paidAmount)}</span>
                    </div>
                    {invoice.dueAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: '700' }}>
                        <span>বাকি টাকা:</span>
                        <span>{formatCurrency(invoice.dueAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', padding: '0 20px', textAlign: 'center', fontSize: '13px' }}>
                  <div>
                    <div style={{ width: '130px', borderTop: '1px dashed #000', paddingTop: '4px' }}>
                      ক্রেতার স্বাক্ষর
                    </div>
                  </div>
                  <div>
                    <div style={{ width: '140px', borderTop: '1px dashed #000', paddingTop: '4px' }}>
                      বিক্রেতা / শপ সিল
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* FORMAT 3: OFFICIAL TAX INVOICE (A4)                       */}
            {/* ========================================================= */}
            {format === 'a4' && (
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #2563eb', paddingBottom: '18px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    {shopLogo && (
                      <img
                        src={shopLogo}
                        alt="Shop Logo"
                        style={{ maxHeight: '75px', maxWidth: '130px', objectFit: 'contain', borderRadius: '6px' }}
                      />
                    )}
                    <div>
                      <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#1e3a8a', margin: '0 0 4px' }}>{shopName}</h1>
                      <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 4px' }}>{slogan}</p>
                      <p style={{ fontSize: '13px', margin: '0 0 2px' }}>{shopAddress}</p>
                      <p style={{ fontSize: '13px', margin: '0 0 2px' }}>ফোন: {shopPhone}</p>
                      {binVat && <p style={{ fontSize: '13px', fontWeight: '600', color: '#2563eb', margin: '0' }}>BIN / VAT Reg: {binVat}</p>}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-block', background: invoice.pricingTier === 'dealer' ? '#7c3aed' : invoice.pricingTier === 'wholesale' ? '#059669' : '#2563eb', color: '#ffffff', padding: '4px 16px', borderRadius: '4px', fontWeight: '700', fontSize: '14px', marginBottom: '8px' }}>
                      {invoice.pricingTier === 'dealer' ? 'DEALER INVOICE (ডিলার চালান)' : invoice.pricingTier === 'wholesale' ? 'WHOLESALE INVOICE (পাইকারি চালান)' : 'OFFICIAL INVOICE'}
                    </div>
                    <div style={{ fontSize: '13px' }}>ইনভয়েস নং: <b>#{invoice.invoiceNo}</b></div>
                    <div style={{ fontSize: '13px' }}>তারিখ: <b>{formatDate(invoice.createdAt)}</b></div>
                    <div style={{ fontSize: '13px' }}>পেমেন্ট: <b>{invoice.paymentMethod?.toUpperCase() || 'CASH'}</b></div>
                  </div>
                </div>

                {/* Bill To */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                  <div>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>ক্রেতার তথ্য (Bill To):</h4>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {invoice.customerName || 'নগদ ক্রেতা (Walk-in Customer)'}
                      {invoice.pricingTier === 'dealer' && <span style={{ fontSize: '12px', background: '#ddd6fe', color: '#5b21b6', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>ডিলার</span>}
                      {invoice.pricingTier === 'wholesale' && <span style={{ fontSize: '12px', background: '#a7f3d0', color: '#065f46', padding: '2px 8px', borderRadius: '6px', fontWeight: '700' }}>পাইকারি</span>}
                    </h3>
                    <p style={{ fontSize: '13px', margin: '0 0 2px' }}>মোবাইল: {invoice.customerPhone || 'N/A'}</p>
                    <p style={{ fontSize: '13px', margin: '0' }}>ঠিকানা: {invoice.customerAddress || 'N/A'}</p>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end' }}>
                    <QRCodeSVG value={`Invoice:${invoice.invoiceNo}|GrandTotal:${invoice.grandTotal}|Shop:${shopName}`} size={70} />
                  </div>
                </div>

                {/* Items Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                  <thead>
                    <tr style={{ background: '#1e293b', color: '#ffffff', textAlign: 'left' }}>
                      <th style={{ padding: '10px 12px', width: '40px' }}>#</th>
                      <th style={{ padding: '10px 12px' }}>পণ্যের বিবরণ</th>
                      <th style={{ padding: '10px 12px', width: '80px', textAlign: 'center' }}>পরিমাণ</th>
                      <th style={{ padding: '10px 12px', width: '100px', textAlign: 'right' }}>একক মূল্য</th>
                      <th style={{ padding: '10px 12px', width: '80px', textAlign: 'right' }}>ছাড়</th>
                      <th style={{ padding: '10px 12px', width: '110px', textAlign: 'right' }}>মোট (৳)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items?.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{idx + 1}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '600', color: '#0f172a' }}>{item.name}</div>
                          {item.barcode && <div style={{ fontSize: '11px', color: '#94a3b8' }}>বারকোড: {item.barcode}</div>}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{formatQuantity(item.quantity, item.unit)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669' }}>
                          {item.discount > 0 ? formatCurrency(item.discount) : '-'}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Calculation Summary */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '30px', alignItems: 'start' }}>
                  <div>
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px', fontSize: '13px' }}>
                      <p style={{ margin: '0 0 6px' }}><b>টাকার পরিমাণ (কথায়):</b> {numberToBengaliWords(invoice.grandTotal)}</p>
                      {!isWholesaleOrDealer && invoice.customerPhone && (
                        <div style={{ marginTop: '8px', background: '#ffffff', border: '1px dashed #93c5fd', padding: '8px 10px', borderRadius: '6px', fontSize: '12px' }}>
                          <div style={{ fontWeight: '700', color: '#1e40af', marginBottom: '2px' }}>🎁 লয়্যালটি রিওয়ার্ড পয়েন্টস (Loyalty Points)</div>
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', color: '#334155' }}>
                            <span>পূর্বের: <b>{invoice.customerRewardPoints || 0} pt</b></span>
                            {invoice.pointsRedeemed > 0 && <span style={{ color: '#dc2626' }}>ব্যবহৃত: <b>-{invoice.pointsRedeemed} pt</b></span>}
                            {invoice.pointsEarned > 0 && <span style={{ color: '#059669' }}>অর্জিত: <b>+{invoice.pointsEarned} pt</b></span>}
                            <span>বর্তমান ব্যালান্স: <b>{invoice.finalCustomerPoints !== undefined ? invoice.finalCustomerPoints : (Number(invoice.customerRewardPoints || 0) + Number(invoice.pointsEarned || 0) - Number(invoice.pointsRedeemed || 0))} pt</b></span>
                          </div>
                        </div>
                      )}
                      <p style={{ margin: '8px 0 0', color: '#1e40af' }}>{returnPolicy}</p>
                    </div>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', fontSize: '13px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span>সাব-টোটাল:</span>
                      <span>{formatCurrency(invoice.subtotal)}</span>
                    </div>
                    {invoice.discountAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', color: '#059669' }}>
                        <span>মোট ডিসকাউন্ট:</span>
                        <span>- {formatCurrency(invoice.discountAmount)}</span>
                      </div>
                    )}
                    {invoice.taxAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span>ভ্যাট / ট্যাক্স:</span>
                        <span>+ {formatCurrency(invoice.taxAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: '8px', marginTop: '6px', fontSize: '16px', fontWeight: '800' }}>
                      <span>সর্বমোট প্রদেয়:</span>
                      <span style={{ color: '#2563eb' }}>{formatCurrency(invoice.grandTotal)}</span>
                    </div>
                    {invoice.totalRefundAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626', fontWeight: '800', marginTop: '4px' }}>
                        <span>পণ্য রিটার্ন রিফান্ড:</span>
                        <span>- {formatCurrency(invoice.totalRefundAmount)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                      <span>পরিশোধ করা হয়েছে:</span>
                      <span>{formatCurrency(invoice.paidAmount)}</span>
                    </div>
                    {invoice.dueAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', color: '#dc2626', fontWeight: '700' }}>
                        <span>বাকি টাকা:</span>
                        <span>{formatCurrency(invoice.dueAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Signatures */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '70px', padding: '0 30px' }}>
                  <div style={{ textAlign: 'center', width: '150px', borderTop: '1px solid #94a3b8', paddingTop: '6px', fontSize: '13px' }}>
                    ক্রেতার স্বাক্ষর
                  </div>
                  <div style={{ textAlign: 'center', width: '150px', borderTop: '1px solid #94a3b8', paddingTop: '6px', fontSize: '13px' }}>
                    কর্তৃপক্ষের স্বাক্ষর
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceViewModal;
