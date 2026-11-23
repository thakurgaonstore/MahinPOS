import React, { useState, useRef, useEffect } from 'react';
import { generateBarcodeSvg } from '../../utils/barcodeHelper';
import { formatCurrency } from '../../utils/formatters';
import { MdPrint, MdClose, MdQrCode } from 'react-icons/md';

const BarcodePrintCenter = ({ product, onClose }) => {
  const [stickerCount, setStickerCount] = useState(24);
  const [shopName, setShopName] = useState('Mahin POS Store');
  const [customPrice, setCustomPrice] = useState(product?.sellingPrice || 0);

  const barcodeValue = product?.barcode || product?.sku || '123456789012';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 120,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '92vh',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        overflow: 'hidden'
      }}>
        {/* Controls Bar (No Print) */}
        <div className="no-print" style={{
          padding: '16px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdQrCode color="#2563eb" />
              বারকোড স্টিকার প্রিন্ট সেন্টার
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b' }}>{product?.name} ({barcodeValue})</p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <span>স্টিকার সংখ্যা:</span>
              <select
                value={stickerCount}
                onChange={(e) => setStickerCount(Number(e.target.value))}
                style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value={12}>১২ টি</option>
                <option value={24}>২৪ টি (Standard Sheet)</option>
                <option value={40}>৪০ টি (Small Stickers)</option>
                <option value={60}>৬০ টি</option>
              </select>
            </div>

            <button
              onClick={handlePrint}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MdPrint size={18} /> প্রিন্ট স্টিকার শিট
            </button>

            <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
              <MdClose size={20} />
            </button>
          </div>
        </div>

        {/* Printable Stickers Sheet */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#f1f5f9' }}>
          <div className="print-area" style={{
            background: '#ffffff',
            padding: '20px',
            margin: '0 auto',
            maxWidth: '750px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px'
          }}>
            {Array.from({ length: stickerCount }).map((_, index) => (
              <BarcodeStickerSingle
                key={index}
                shopName={shopName}
                productName={product?.name || 'Product'}
                barcode={barcodeValue}
                price={customPrice}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const BarcodeStickerSingle = ({ shopName, productName, barcode, price }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && barcode) {
      generateBarcodeSvg(svgRef.current, barcode, {
        width: 1.2,
        height: 28,
        fontSize: 10,
        margin: 0
      });
    }
  }, [barcode]);

  return (
    <div style={{
      border: '1px dashed #cbd5e1',
      borderRadius: '6px',
      padding: '8px',
      textAlign: 'center',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
        {shopName}
      </div>
      <div style={{
        fontSize: '11px',
        fontWeight: '700',
        color: '#0f172a',
        maxWidth: '180px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        margin: '2px 0'
      }}>
        {productName}
      </div>
      <svg ref={svgRef} style={{ maxWidth: '100%' }}></svg>
      <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
        মূল্য: {formatCurrency(price)}
      </div>
    </div>
  );
};

export default BarcodePrintCenter;
