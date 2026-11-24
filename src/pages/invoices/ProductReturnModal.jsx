import React, { useState } from 'react';
import { doc, updateDoc, addDoc, collection, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  MdClose,
  MdAssignmentReturn,
  MdCheckCircle,
  MdInfo,
  MdWarning
} from 'react-icons/md';

const ProductReturnModal = ({ shopId, invoice, userProfile, onClose, onSuccess }) => {
  // Items array with return quantities state
  const [returnItems, setReturnItems] = useState(() => {
    return (invoice?.items || []).map((item) => {
      const alreadyReturned = Number(item.returnedQty) || 0;
      const maxReturnable = Math.max(0, Number(item.quantity) - alreadyReturned);
      return {
        ...item,
        alreadyReturned,
        maxReturnable,
        returnQty: 0 // initial return qty
      };
    });
  });

  const [returnReason, setReturnReason] = useState('নষ্ট বা ত্রুটিপূর্ণ পণ্য');
  const [refundMethod, setRefundMethod] = useState(invoice?.dueAmount > 0 ? 'due' : 'cash'); // 'cash' | 'due' | 'credit'
  const [shouldRestock, setShouldRestock] = useState(true);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Handle quantity change
  const handleQtyChange = (index, val) => {
    const num = parseFloat(val) || 0;
    const item = returnItems[index];
    const validQty = Math.max(0, Math.min(num, item.maxReturnable));

    const updated = [...returnItems];
    updated[index].returnQty = validQty;
    setReturnItems(updated);
  };

  // Quick return all for a specific item
  const handleReturnAllItem = (index) => {
    const updated = [...returnItems];
    updated[index].returnQty = updated[index].maxReturnable;
    setReturnItems(updated);
  };

  // Calculations
  const itemsBeingReturned = returnItems.filter((i) => i.returnQty > 0);
  const totalRefundAmount = itemsBeingReturned.reduce((sum, item) => {
    const unitPrice = (Number(item.price) || 0) - (Number(item.discount) || 0);
    return sum + (unitPrice * item.returnQty);
  }, 0);

  const roundedRefund = Math.round(totalRefundAmount * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (itemsBeingReturned.length === 0) {
      toast.error('অনুগ্রহ করে অন্তত একটি পণ্যের ফেরত পরিমাণ দিন');
      return;
    }

    if (roundedRefund <= 0) {
      toast.error('রিফান্ডের মোট পরিমাণ শূন্য হতে পারে না');
      return;
    }

    setSaving(true);
    try {
      // 1. Generate Return Number
      const returnNo = `RET-${invoice.invoiceNo || Date.now()}-${String(Date.now()).slice(-3)}`;

      // 2. Prepare updated invoice items state
      let totalRemainingItems = 0;
      const updatedInvoiceItems = returnItems.map((item) => {
        const newlyReturned = item.returnQty || 0;
        const totalReturned = (item.alreadyReturned || 0) + newlyReturned;
        const remaining = item.quantity - totalReturned;
        totalRemainingItems += remaining;
        return {
          productId: item.productId,
          name: item.name,
          nameBn: item.nameBn || '',
          barcode: item.barcode || '',
          unit: item.unit || 'টি',
          isLoose: Boolean(item.isLoose),
          costPrice: Number(item.costPrice) || 0,
          price: Number(item.price) || 0,
          discount: Number(item.discount) || 0,
          quantity: item.quantity,
          returnedQty: totalReturned,
          total: item.total
        };
      });

      const isFullReturn = totalRemainingItems <= 0;
      const newTotalRefundOnInvoice = (Number(invoice.totalRefundAmount) || 0) + roundedRefund;

      // 3. Create Return Record in shops/{shopId}/returns
      await addDoc(collection(db, 'shops', shopId, 'returns'), {
        returnNo,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        customerId: invoice.customerId || null,
        customerName: invoice.customerName || 'নগদ ক্রেতা',
        customerPhone: invoice.customerPhone || '',
        returnedItems: itemsBeingReturned.map((item) => ({
          productId: item.productId,
          name: item.name,
          unit: item.unit,
          unitPrice: item.price,
          quantityReturned: item.returnQty,
          refundAmount: (item.price - (item.discount || 0)) * item.returnQty
        })),
        totalRefundAmount: roundedRefund,
        refundMethod,
        returnReason,
        shouldRestock,
        notes: notes.trim(),
        cashierName: userProfile?.name || userProfile?.email || 'Admin',
        createdAt: serverTimestamp()
      });

      // 4. Update Original Sale Document
      const saleRef = doc(db, 'shops', shopId, 'sales', invoice.id);
      await updateDoc(saleRef, {
        isReturned: true,
        returnStatus: isFullReturn ? 'full' : 'partial',
        totalRefundAmount: newTotalRefundOnInvoice,
        items: updatedInvoiceItems,
        updatedAt: serverTimestamp()
      });

      // 5. Restock returned items to Inventory (if requested)
      if (shouldRestock) {
        for (const item of itemsBeingReturned) {
          if (item.productId) {
            try {
              const productRef = doc(db, 'shops', shopId, 'products', item.productId);
              await updateDoc(productRef, {
                stock: increment(item.returnQty),
                totalSold: increment(-item.returnQty)
              });
            } catch (err) {
              console.warn(`Could not restock product ${item.productId}:`, err);
            }
          }
        }
      }

      // 6. Adjust Customer Due / Points if applicable
      if (invoice.customerId) {
        try {
          const custRef = doc(db, 'shops', shopId, 'customers', invoice.customerId);
          const custUpdates = {};

          // If refund method is adjusting customer due
          if (refundMethod === 'due') {
            custUpdates.dueAmount = increment(-roundedRefund);
          }

          // If retail sale had loyalty points, reverse points earned on returned portion
          if (invoice.pricingTier === 'retail' && invoice.pointsEarned > 0 && invoice.grandTotal > 0) {
            const pointsToDeduct = Math.floor((roundedRefund / invoice.grandTotal) * invoice.pointsEarned);
            if (pointsToDeduct > 0) {
              custUpdates.rewardPoints = increment(-pointsToDeduct);
            }
          }

          if (Object.keys(custUpdates).length > 0) {
            await updateDoc(custRef, custUpdates);
          }
        } catch (err) {
          console.warn("Could not update customer balance on return:", err);
        }
      }

      toast.success(`ইনভয়েস #${invoice.invoiceNo} থেকে পণ্য সফলভাবে রিটার্ন ও ৳${roundedRefund} রিফান্ড করা হয়েছে!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Return processing error:", err);
      toast.error('রিটার্ন প্রসেস করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 110,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '750px',
        maxHeight: '94vh',
        overflowY: 'auto',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: '#fef2f2', color: '#dc2626', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
              <MdAssignmentReturn size={24} />
            </span>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                পণ্য রিটার্ন ও রিফান্ড ম্যানেজমেন্ট
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                ইনভয়েস নং: <b style={{ color: '#2563eb' }}>#{invoice.invoiceNo}</b> | তারিখ: {formatDate(invoice.createdAt)} | কাস্টমার: <b>{invoice.customerName || 'সাধারণ ক্রেতা'}</b>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
          >
            <MdClose size={18} />
          </button>
        </div>

        {/* Invoice Summary Info Strip */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '10px 14px',
          marginBottom: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '10px',
          fontSize: '12px'
        }}>
          <div>
            <span style={{ color: '#64748b', display: 'block' }}>মূল ইনভয়েস বিল:</span>
            <span style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>{formatCurrency(invoice.grandTotal)}</span>
          </div>
          <div>
            <span style={{ color: '#64748b', display: 'block' }}>পরিশোধিত টাকা:</span>
            <span style={{ fontWeight: '700', fontSize: '14px', color: '#059669' }}>{formatCurrency(invoice.paidAmount)}</span>
          </div>
          <div>
            <span style={{ color: '#64748b', display: 'block' }}>বাকি পাওনা:</span>
            <span style={{ fontWeight: '700', fontSize: '14px', color: invoice.dueAmount > 0 ? '#dc2626' : '#64748b' }}>
              {formatCurrency(invoice.dueAmount || 0)}
            </span>
          </div>
          {invoice.totalRefundAmount > 0 && (
            <div>
              <span style={{ color: '#b91c1c', display: 'block' }}>পূর্বে ফেরত দেওয়া হয়েছে:</span>
              <span style={{ fontWeight: '800', fontSize: '14px', color: '#b91c1c' }}>{formatCurrency(invoice.totalRefundAmount)}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Table of items */}
          <div style={{ marginBottom: '16px', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>পণ্য</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>বিক্রীত</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>দর (৳)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>ফেরতযোগ্য</th>
                  <th style={{ padding: '8px 12px', width: '120px', textAlign: 'center' }}>ফেরত পরিমাণ</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>রিফান্ড (৳)</th>
                </tr>
              </thead>
              <tbody>
                {returnItems.map((item, idx) => {
                  const unitPrice = (Number(item.price) || 0) - (Number(item.discount) || 0);
                  const lineRefund = Math.round(unitPrice * (item.returnQty || 0) * 100) / 100;
                  const isFullyReturned = item.maxReturnable <= 0;

                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: isFullyReturned ? '#f8fafc' : '#ffffff' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ fontWeight: '700', color: isFullyReturned ? '#94a3b8' : '#0f172a' }}>{item.name}</div>
                        {item.alreadyReturned > 0 && (
                          <div style={{ fontSize: '11px', color: '#dc2626' }}>
                            পূর্বে ফেরত: {item.alreadyReturned} {item.unit || ''}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#475569' }}>
                        {item.quantity} {item.unit || ''}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600' }}>
                        {formatCurrency(unitPrice)}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '700', color: item.maxReturnable > 0 ? '#059669' : '#94a3b8' }}>
                        {item.maxReturnable} {item.unit || ''}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {!isFullyReturned ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={item.maxReturnable}
                              value={item.returnQty || ''}
                              onChange={(e) => handleQtyChange(idx, e.target.value)}
                              placeholder="0"
                              style={{
                                width: '65px',
                                padding: '4px 6px',
                                textAlign: 'center',
                                borderRadius: '6px',
                                border: '1px solid #94a3b8',
                                fontWeight: '800',
                                color: item.returnQty > 0 ? '#dc2626' : '#0f172a',
                                background: item.returnQty > 0 ? '#fef2f2' : '#ffffff'
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleReturnAllItem(idx)}
                              title="সম্পূর্ণ পরিমাণ ফেরত"
                              style={{
                                fontSize: '10px',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                background: '#f1f5f9',
                                cursor: 'pointer',
                                fontWeight: '700'
                              }}
                            >
                              সব
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>সম্পূর্ণ ফেরত</span>
                        )}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800', color: lineRefund > 0 ? '#dc2626' : '#94a3b8' }}>
                        {formatCurrency(lineRefund)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Refund Parameters Form */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              {/* Return Reason */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  রিটার্ন করার কারণ (Return Reason) *
                </label>
                <select
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #94a3b8',
                    fontSize: '13px',
                    outline: 'none',
                    background: '#fff'
                  }}
                >
                  <option value="নষ্ট বা ত্রুটিপূর্ণ পণ্য">নষ্ট বা ত্রুটিপূর্ণ পণ্য (Damaged)</option>
                  <option value="পণ্যের মেয়াদ শেষ">পণ্যের মেয়াদ শেষ (Expired)</option>
                  <option value="কাস্টমার পছন্দ করেনি / ভুল আইটেম">কাস্টমার পছন্দ করেনি / ভুল আইটেম</option>
                  <option value="প্যাকেট কাটা / সিল খোলা">প্যাকেট কাটা / সিল খোলা</option>
                  <option value="অন্যান্য কারণ">অন্যান্য কারণ (Other)</option>
                </select>
              </div>

              {/* Refund Method */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  রিফান্ড পরিশোধ পদ্ধতি (Refund Method) *
                </label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid #94a3b8',
                    fontSize: '13px',
                    outline: 'none',
                    background: '#fff'
                  }}
                >
                  <option value="cash">💵 নগদ টাকা ফেরত (Cash Refund)</option>
                  {invoice.dueAmount > 0 && (
                    <option value="due">📝 কাস্টমারের বাকি থেকে সমন্বয় (Adjust Due)</option>
                  )}
                  <option value="credit">💳 কাস্টমার ওয়ালেট / ক্রেডিট (Store Credit)</option>
                </select>
              </div>
            </div>

            {/* Restock Checkbox */}
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={shouldRestock}
                  onChange={(e) => setShouldRestock(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                ফেরতকৃত পণ্য ইনভেন্টরি স্টকে পুনরায় যোগ করুন (Restock to Inventory)
              </label>
              <p style={{ margin: '4px 0 0 24px', fontSize: '11px', color: '#64748b' }}>
                পণ্যটি যদি পুনরায় বিক্রয়যোগ্য হয় তবে টিক চিহ্ন রাখুন। পণ্যটি যদি সম্পূর্ণ নষ্ট বা ফেলে দেওয়ার মতো হয় তবে আনচেক করুন।
              </p>
            </div>

            {/* Optional Notes */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                অতিরিক্ত মন্তব্য / নোট (ঐচ্ছিক)
              </label>
              <input
                type="text"
                placeholder="যেমন: সিল খোলা ছিল তাই ফেরত নেওয়া হলো..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Refund Summary Card */}
          <div style={{
            background: 'linear-gradient(135deg, #fef2f2 0%, #fff1f2 100%)',
            border: '2px solid #fecaca',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: '700', display: 'block' }}>
                মোট রিফান্ড প্রদানযোগ্য টাকা:
              </span>
              <span style={{ fontSize: '24px', fontWeight: '900', color: '#dc2626' }}>
                {formatCurrency(roundedRefund)}
              </span>
            </div>
            <div style={{ textAlign: 'right', fontSize: '12px', color: '#475569' }}>
              <span>ফেরতকৃত আইটেম: <b>{itemsBeingReturned.length} টি</b></span>
              <div style={{ color: '#059669', fontWeight: '600' }}>
                পদ্ধতি: {refundMethod === 'cash' ? 'নগদ ফেরত' : refundMethod === 'due' ? 'বাকি সমন্বয়' : 'ক্রেডিট'}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving || roundedRefund <= 0}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                border: 'none',
                background: roundedRefund > 0 ? '#dc2626' : '#94a3b8',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                cursor: roundedRefund > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: roundedRefund > 0 ? '0 4px 6px -1px rgba(220,38,38,0.3)' : 'none'
              }}
            >
              <MdCheckCircle size={18} />
              {saving ? 'প্রসেস হচ্ছে...' : 'রিটার্ন ও রিফান্ড নিশ্চিত করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductReturnModal;
