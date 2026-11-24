import React, { useState, useRef, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { generateBarcodeSvg } from '../../utils/barcodeHelper';
import { formatCurrency } from '../../utils/formatters';
import { MdPrint, MdClose, MdQrCode, MdSearch, MdSettings, MdCheck } from 'react-icons/md';

const BarcodePrintCenter = ({ product: initialProduct, onClose }) => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(initialProduct || null);
  const [searchTerm, setSearchTerm] = useState('');

  // Sticker Options
  const [stickerCount, setStickerCount] = useState(24);
  const [paperLayout, setPaperLayout] = useState('a4_24'); // 'thermal_single_38x25' | 'thermal_single_50x30' | 'a4_24' | 'a4_40'
  const [shopName, setShopName] = useState(userProfile?.shopName || 'Mahin POS Store');
  const [customPrice, setCustomPrice] = useState(initialProduct?.sellingPrice || initialProduct?.price || 0);

  // Content Toggles
  const [showShopName, setShowShopName] = useState(true);
  const [showProductName, setShowProductName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showCodeText, setShowCodeText] = useState(true);

  // Load all products for standalone page mode
  useEffect(() => {
    if (!shopId) return;
    const unsub = onSnapshot(collection(db, 'shops', shopId, 'products'), (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      setProducts(list);
      if (!selectedProduct && list.length > 0 && !initialProduct) {
        setSelectedProduct(list[0]);
        setCustomPrice(list[0].sellingPrice || list[0].price || 0);
      }
    });
    return () => unsub();
  }, [shopId]);

  useEffect(() => {
    if (selectedProduct) {
      setCustomPrice(selectedProduct.sellingPrice || selectedProduct.price || 0);
    }
  }, [selectedProduct]);

  const barcodeValue = selectedProduct?.barcode || selectedProduct?.sku || '123456789012';

  const handlePrint = () => {
    window.print();
  };

  const filteredProducts = products.filter(p =>
    (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode || '').includes(searchTerm)
  );

  // Layout Grid Calculation
  const getGridStyle = () => {
    if (paperLayout === 'thermal_single_38x25') {
      return {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      };
    }
    if (paperLayout === 'thermal_single_50x30') {
      return {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      };
    }
    if (paperLayout === 'a4_40') {
      return {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px'
      };
    }
    // Default a4_24 (3 x 8)
    return {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '12px'
    };
  };

  const isModal = Boolean(onClose);

  const containerStyle = isModal ? {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    zIndex: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px'
  } : {
    maxWidth: '1200px',
    margin: '0 auto',
    paddingBottom: '40px'
  };

  const cardStyle = isModal ? {
    background: '#ffffff',
    width: '100%',
    maxWidth: '960px',
    maxHeight: '92vh',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
    overflow: 'hidden'
  } : {
    background: '#ffffff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Top Control Panel (Hidden on Print) */}
        <div className="no-print" style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MdQrCode color="#2563eb" size={24} /> বারকোড স্টিকার প্রিন্ট সেন্টার
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                থার্মাল রোল ও এ৪ শিটের জন্য উচ্চমানের বারকোড স্টিকার তৈরি ও প্রিন্ট করুন
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={handlePrint}
                style={{
                  background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 22px',
                  borderRadius: '8px',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
                }}
              >
                <MdPrint size={20} /> 🖨️ স্টিকার প্রিন্ট করুন
              </button>

              {isModal && (
                <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
                  <MdClose size={22} />
                </button>
              )}
            </div>
          </div>

          {/* Configuration Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', alignItems: 'flex-end' }}>
            {/* Product Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                পণ্য নির্বাচন করুন:
              </label>
              <select
                value={selectedProduct?.id || ''}
                onChange={(e) => {
                  const p = products.find(item => item.id === e.target.value);
                  if (p) setSelectedProduct(p);
                }}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.barcode || p.sku || 'No Barcode'}) - {formatCurrency(p.sellingPrice || p.price || 0)}
                  </option>
                ))}
              </select>
            </div>

            {/* Paper Layout */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                কাগজের ধরন / প্রিন্টার মোড:
              </label>
              <select
                value={paperLayout}
                onChange={(e) => setPaperLayout(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
              >
                <option value="a4_24">A4 শিট (২৪ টি স্টিকার / ৩x৮)</option>
                <option value="a4_40">A4 শিট (৪০ টি ছোট স্টিকার / ৪x১০)</option>
                <option value="thermal_single_38x25">থার্মাল রোল (38mm x 25mm)</option>
                <option value="thermal_single_50x30">থার্মাল রোল (50mm x 30mm)</option>
              </select>
            </div>

            {/* Sticker Quantity */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                স্টিকার সংখ্যা:
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={stickerCount}
                  onChange={(e) => setStickerCount(Math.max(1, Number(e.target.value)))}
                  style={{ width: '80px', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700' }}
                />
                <button
                  type="button"
                  onClick={() => setStickerCount(Number(selectedProduct?.stock) || 24)}
                  style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '12px', cursor: 'pointer' }}
                >
                  স্টকের সমান ({selectedProduct?.stock || 0})
                </button>
              </div>
            </div>

            {/* Custom Price Override */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                স্টিকারের মূল্য (৳):
              </label>
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '700' }}
              />
            </div>
          </div>

          {/* Toggle Switches */}
          <div style={{ display: 'flex', gap: '16px', marginTop: '14px', flexWrap: 'wrap', fontSize: '12px', fontWeight: '600', color: '#475569' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showShopName} onChange={e => setShowShopName(e.target.checked)} />
              দোকানের নাম
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showProductName} onChange={e => setShowProductName(e.target.checked)} />
              পণ্যের নাম
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} />
              বিক্রয় মূল্য
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={showCodeText} onChange={e => setShowCodeText(e.target.checked)} />
              বারকোড সংখ্যা
            </label>
          </div>
        </div>

        {/* Printable Stickers Area */}
        <div style={{ overflowY: 'auto', padding: '24px', background: '#f1f5f9', minHeight: '400px' }}>
          <div className="print-area" style={{
            background: '#ffffff',
            padding: paperLayout.startsWith('thermal') ? '10px' : '24px',
            margin: '0 auto',
            maxWidth: paperLayout.startsWith('thermal') ? '300px' : '780px',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            ...getGridStyle()
          }}>
            {Array.from({ length: stickerCount }).map((_, index) => (
              <BarcodeStickerSingle
                key={index}
                shopName={shopName}
                productName={selectedProduct?.name || 'Product'}
                barcode={barcodeValue}
                price={customPrice}
                showShopName={showShopName}
                showProductName={showProductName}
                showPrice={showPrice}
                showCodeText={showCodeText}
                paperLayout={paperLayout}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Scoped Print CSS for Thermal Roll / A4 Page */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print, header, aside, .impersonationBanner {
            display: none !important;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          .barcode-sticker-item {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

const BarcodeStickerSingle = ({
  shopName,
  productName,
  barcode,
  price,
  showShopName,
  showProductName,
  showPrice,
  showCodeText,
  paperLayout
}) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (svgRef.current && barcode) {
      const isThermal = paperLayout.startsWith('thermal');
      generateBarcodeSvg(svgRef.current, barcode, {
        width: isThermal ? 1.4 : 1.2,
        height: isThermal ? 32 : 26,
        fontSize: showCodeText ? 10 : 0,
        displayValue: showCodeText,
        margin: 0
      });
    }
  }, [barcode, showCodeText, paperLayout]);

  const isThermal = paperLayout.startsWith('thermal');

  return (
    <div className="barcode-sticker-item" style={{
      border: '1px dashed #cbd5e1',
      borderRadius: '6px',
      padding: isThermal ? '10px 14px' : '8px 10px',
      textAlign: 'center',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: isThermal ? '220px' : 'auto',
      minHeight: isThermal ? '110px' : '85px',
      boxSizing: 'border-box'
    }}>
      {showShopName && (
        <div style={{ fontSize: isThermal ? '11px' : '10px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {shopName}
        </div>
      )}
      {showProductName && (
        <div style={{
          fontSize: isThermal ? '12px' : '11px',
          fontWeight: '700',
          color: '#0f172a',
          maxWidth: '190px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          margin: '2px 0'
        }}>
          {productName}
        </div>
      )}
      <svg ref={svgRef} style={{ maxWidth: '100%', margin: '2px 0' }}></svg>
      {showPrice && (
        <div style={{ fontSize: isThermal ? '14px' : '12px', fontWeight: '800', color: '#0f172a', marginTop: '2px' }}>
          মূল্য: {formatCurrency(price)}
        </div>
      )}
    </div>
  );
};

export default BarcodePrintCenter;
