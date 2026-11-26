import React from 'react';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import {
  MdClose,
  MdLayers,
  MdAddShoppingCart,
  MdInventory,
  MdCheckCircle,
  MdReceipt,
  MdInfo,
  MdLocalShipping
} from 'react-icons/md';
import { ensureProductBatches, calculateProductValuation } from '../../utils/fifoInventoryManager';

const ProductBatchDetailsModal = ({ product, onClose, onOpenRestock }) => {
  if (!product) return null;

  const valuation = calculateProductValuation(product);
  const batches = ensureProductBatches(product);

  // Sort batches: oldest first for FIFO sequence
  const sortedBatches = [...batches].sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime() || 0;
    const timeB = new Date(b.createdAt || 0).getTime() || 0;
    return timeA - timeB;
  });

  const activeBatches = sortedBatches.filter((b) => (Number(b.remainingQty) || 0) > 0);
  const retailPrice = Number(product.sellingPrice || product.price || 0);
  const potentialRetailValue = valuation.totalStock * retailPrice;
  const potentialGrossProfit = Math.max(0, potentialRetailValue - valuation.totalCostValue);

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
        maxWidth: '850px',
        maxHeight: '92vh',
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
          marginBottom: '18px',
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
                <MdLayers size={22} />
              </span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  পণ্য রিস্টক ও FIFO ব্যাচ হিস্ট্রি
                  <span style={{ fontSize: '11px', background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '12px', fontWeight: '800' }}>
                    First-In, First-Out
                  </span>
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  {product.name} {product.nameBn ? `(${product.nameBn})` : ''} | বারকোড: <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{product.barcode || 'N/A'}</span>
                </p>
              </div>
            </div>
          </div>
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

        {/* 1. Inventory Summary Cards */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '18px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px'
        }}>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান মোট মজুদ</span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              {valuation.totalStock} {product.unit || 'টি'}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>সক্রিয় লট / ব্যাচ</span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#2563eb' }}>
              {activeBatches.length} টি সচল ব্যাচ
            </span>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>স্টকের মোট ক্রয়মূল্য (FIFO)</span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#059669' }}>
              {formatCurrency(valuation.totalCostValue)}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান খুচরা দর</span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
              {formatCurrency(retailPrice)}
            </span>
          </div>
          <div>
            <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>সম্ভাব্য নিট মুনাফা</span>
            <span style={{ fontSize: '16px', fontWeight: '800', color: '#16a34a' }}>
              {formatCurrency(potentialGrossProfit)}
            </span>
          </div>
        </div>

        {/* FIFO Workflow Notice Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #ecfdf5 0%, #eff6ff 100%)',
          border: '1px solid #a7f3d0',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '18px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '12px',
          color: '#065f46'
        }}>
          <MdInfo size={20} color="#059669" style={{ flexShrink: 0 }} />
          <div>
            <strong>FIFO পলিসি কার্যকর:</strong> পণ্যটি যতবার আলাদা আলাদা ক্রয়মূল্যে রিস্টক করা হবে, প্রতিটি ক্রয়মূল্য আলাদা ব্যাচে সংরক্ষিত থাকবে। পিওএস (POS) কাউন্টারে বিক্রির সময় স্বয়ংক্রিয়ভাবে আগের কেনা ব্যাচ থেকে পণ্য খালাস হবে এবং সেই ক্রয়মূল্যেই বিক্রয় মুনাফা ও লাভ-ক্ষতি হিসাব হবে।
          </div>
        </div>

        {/* 2. Batches Table */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MdInventory size={18} color="#2563eb" /> রিস্টক ও ব্যাচ বিবরণী ({sortedBatches.length} টি রেকর্ড)
            </h4>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              পুরানো ব্যাচ থেকে নতুন ব্যাচের ক্রমানুসারে সাজানো
            </span>
          </div>

          {sortedBatches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
              কোনো পৃথক ব্যাচ তথ্য পাওয়া যায়নি।
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', color: '#475569', fontWeight: '700' }}>
                    <th style={{ padding: '10px 12px' }}>অগ্রাধিকার</th>
                    <th style={{ padding: '10px 12px' }}>ক্রয়ের তারিখ</th>
                    <th style={{ padding: '10px 12px' }}>চালান / সাপ্লায়ার</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>ক্রয় দর (৳)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>মূল পরিমাণ</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>অবশিষ্ট মজুদ</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>অবশিষ্ট মূল্য</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBatches.map((batch, idx) => {
                    const remaining = Number(batch.remainingQty) || 0;
                    const initial = Number(batch.quantity) || 0;
                    const isSoldOut = remaining <= 0;
                    
                    // Determine if this is the 1st active batch in FIFO queue
                    const isFirstActive = activeBatches.length > 0 && activeBatches[0].batchId === batch.batchId;

                    return (
                      <tr key={batch.batchId || idx} style={{
                        borderBottom: '1px solid #f1f5f9',
                        background: isFirstActive ? '#f0fdf4' : (isSoldOut ? '#fafafa' : '#ffffff'),
                        color: isSoldOut ? '#94a3b8' : '#1e293b'
                      }}>
                        {/* Sequence */}
                        <td style={{ padding: '10px 12px', fontWeight: '700' }}>
                          {isFirstActive ? (
                            <span style={{ background: '#16a34a', color: '#ffffff', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              ১ম বিক্রি হবে
                            </span>
                          ) : isSoldOut ? (
                            <span style={{ color: '#94a3b8' }}>-</span>
                          ) : (
                            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '6px', fontSize: '11px' }}>
                              পরবর্তী
                            </span>
                          )}
                        </td>

                        {/* Date */}
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontWeight: '600' }}>{formatDateTime(batch.createdAt)}</span>
                        </td>

                        {/* Supplier / Voucher */}
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '600', color: isSoldOut ? '#94a3b8' : '#0f172a' }}>
                            {batch.voucherNo || 'N/A'}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {batch.supplierName || 'সাধারণ ক্রয়'}
                          </div>
                        </td>

                        {/* Cost Price */}
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '800', color: isSoldOut ? '#94a3b8' : '#059669' }}>
                          {formatCurrency(batch.costPrice)}
                        </td>

                        {/* Initial Quantity */}
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600' }}>
                          {initial} {product.unit || 'টি'}
                        </td>

                        {/* Remaining Quantity */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            fontWeight: '800',
                            fontSize: '13px',
                            color: isSoldOut ? '#dc2626' : '#0f172a'
                          }}>
                            {remaining} {product.unit || 'টি'}
                          </span>
                        </td>

                        {/* Remaining Value */}
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: isSoldOut ? '#94a3b8' : '#334155' }}>
                          {formatCurrency(remaining * (Number(batch.costPrice) || 0))}
                        </td>

                        {/* Status */}
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          {isSoldOut ? (
                            <span style={{ background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700' }}>
                              বিক্রিত শেষ
                            </span>
                          ) : (
                            <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <MdCheckCircle size={12} /> সচল
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '9px 18px',
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

          {onOpenRestock && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRestock(product);
              }}
              style={{
                padding: '9px 20px',
                borderRadius: '8px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 6px -1px rgba(5,150,105,0.3)'
              }}
            >
              <MdAddShoppingCart size={17} /> নতুন ব্যাচ রিস্টক করুন
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductBatchDetailsModal;
