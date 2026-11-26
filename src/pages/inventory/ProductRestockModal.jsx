import React, { useState, useEffect } from 'react';
import { doc, updateDoc, addDoc, collection, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  MdClose,
  MdAddShoppingCart,
  MdOutlineTrendingUp,
  MdCheckCircle,
  MdInventory,
  MdLayers,
  MdInfo,
  MdOutlineHistoryEdu,
  MdLocalShipping
} from 'react-icons/md';
import {
  ensureProductBatches,
  addBatchToProduct,
  calculateProductValuation
} from '../../utils/fifoInventoryManager';
import { recordSupplierTransaction } from '../../utils/ledgerManager';

const ProductRestockModal = ({ shopId, product, onClose, onSuccess }) => {
  const valuation = calculateProductValuation(product);
  const currentStock = valuation.totalStock;
  const currentBatches = valuation.activeBatches;
  const currentCostPrice = Number(product?.costPrice) || 0;

  const [newQuantity, setNewQuantity] = useState('');
  const [newCostPrice, setNewCostPrice] = useState(currentCostPrice > 0 ? currentCostPrice.toString() : '');
  
  // Selling Prices (Editable on restock)
  const [retailPrice, setRetailPrice] = useState(
    (product?.sellingPrice || product?.price || 0).toString()
  );
  const [wholesalePrice, setWholesalePrice] = useState(
    (product?.wholesalePrice || 0).toString()
  );
  const [dealerPrice, setDealerPrice] = useState(
    (product?.dealerPrice || 0).toString()
  );

  const [supplierName, setSupplierName] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [suppliersList, setSuppliersList] = useState([]);
  const [paymentStatus, setPaymentStatus] = useState('full_paid'); // 'full_paid' | 'partial_paid' | 'full_due'
  const [paidAmountOnRestock, setPaidAmountOnRestock] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!shopId) return;
    getDocs(collection(db, 'shops', shopId, 'suppliers'))
      .then((snap) => {
        const list = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setSuppliersList(list);
      })
      .catch((err) => console.warn("Could not load suppliers for restock:", err));
  }, [shopId]);

  // Parse numeric values
  const addQty = parseFloat(newQuantity) || 0;
  const unitCost = parseFloat(newCostPrice) || 0;
  const newBatchTotalCost = addQty * unitCost;

  // Total New Stock
  const totalNewStock = currentStock + addQty;
  const totalNewCostValue = valuation.totalCostValue + newBatchTotalCost;

  // Margin Calculations based on latest restock cost
  const rPrice = parseFloat(retailPrice) || 0;
  const wPrice = parseFloat(wholesalePrice) || 0;
  const dPrice = parseFloat(dealerPrice) || 0;

  const retailMargin = rPrice > 0 ? Math.round(((rPrice - unitCost) / rPrice) * 100) : 0;
  const wholesaleMargin = wPrice > 0 ? Math.round(((wPrice - unitCost) / wPrice) * 100) : 0;
  const dealerMargin = dPrice > 0 ? Math.round(((dPrice - unitCost) / dPrice) * 100) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (addQty <= 0) {
      toast.error('রিস্টক করার সঠিক পরিমাণ (Quantity) দিন');
      return;
    }
    if (unitCost <= 0) {
      toast.error('নতুন ক্রয় মূল্য দিন');
      return;
    }

    setSaving(true);
    try {
      const finalStock = currentStock + addQty;

      // Calculate paid vs due on this restock batch
      let actualPaid = newBatchTotalCost;
      let actualDue = 0;
      if (paymentStatus === 'full_due') {
        actualPaid = 0;
        actualDue = newBatchTotalCost;
      } else if (paymentStatus === 'partial_paid') {
        actualPaid = Math.min(newBatchTotalCost, Math.max(0, Number(paidAmountOnRestock) || 0));
        actualDue = Math.max(0, newBatchTotalCost - actualPaid);
      }

      // Determine supplier name and supplierId
      let finalSupplierName = supplierName.trim();
      let resolvedSupplierId = selectedSupplierId;

      if (selectedSupplierId) {
        const found = suppliersList.find((s) => s.id === selectedSupplierId);
        if (found) finalSupplierName = found.name;
      }

      // 1. Prepare FIFO Batches: Existing batches remain intact with their separate costs; append new batch
      const existingBatches = ensureProductBatches(product);
      const updatedBatches = addBatchToProduct(existingBatches, {
        quantity: addQty,
        costPrice: unitCost,
        supplierName: finalSupplierName,
        voucherNo: voucherNo.trim(),
        notes: notes.trim(),
        createdAt: new Date().toISOString()
      });

      // 2. Update Product Document with new Stock, FIFO Batches, Latest Cost Price, and Selling Prices
      const productRef = doc(db, 'shops', shopId, 'products', product.id);
      await updateDoc(productRef, {
        stock: finalStock,
        batches: updatedBatches,
        costPrice: unitCost, // Keep latest restock price as primary reference
        sellingPrice: rPrice,
        price: rPrice,
        wholesalePrice: wPrice,
        dealerPrice: dPrice,
        lastRestockedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3. Record Stock Inward / Restock Audit Log
      await addDoc(collection(db, 'shops', shopId, 'stock_logs'), {
        type: 'restock',
        productId: product.id,
        productName: product.name,
        productBarcode: product.barcode || '',
        previousStock: currentStock,
        addedQuantity: addQty,
        finalStock: finalStock,
        unit: product.unit || 'টি',
        previousCostPrice: currentCostPrice,
        purchaseCostPrice: unitCost,
        newAverageCostPrice: unitCost,
        batchTotalCost: newBatchTotalCost,
        retailPrice: rPrice,
        wholesalePrice: wPrice,
        dealerPrice: dPrice,
        supplierName: finalSupplierName,
        voucherNo: voucherNo.trim(),
        paymentStatus,
        paidAmount: actualPaid,
        dueAmount: actualDue,
        notes: notes.trim(),
        isFifoBatch: true,
        createdAt: serverTimestamp()
      });

      // 4. Link to Supplier Ledger if a supplier is linked or if there is due
      if (finalSupplierName || resolvedSupplierId) {
        try {
          if (!resolvedSupplierId) {
            // Find existing supplier by name or create new supplier doc
            const match = suppliersList.find((s) => s.name.toLowerCase() === finalSupplierName.toLowerCase());
            if (match) {
              resolvedSupplierId = match.id;
            } else {
              const newSuppRef = await addDoc(collection(db, 'shops', shopId, 'suppliers'), {
                name: finalSupplierName,
                company: '',
                phone: '',
                totalPurchased: 0,
                duePayable: 0,
                createdAt: serverTimestamp()
              });
              resolvedSupplierId = newSuppRef.id;
            }
          }

          if (resolvedSupplierId) {
            await recordSupplierTransaction(shopId, {
              supplierId: resolvedSupplierId,
              supplierName: finalSupplierName,
              type: 'purchase_due',
              billAmount: newBatchTotalCost,
              paidAmount: actualPaid,
              dueAmount: actualDue,
              paymentMethod: actualPaid > 0 ? 'Cash' : 'Due',
              voucherNo: voucherNo.trim() || `RESTOCK-${Date.now().toString().slice(-6)}`,
              note: `"${product.name}" রিস্টক ব্যাচ (${addQty} ${product.unit || 'টি'})` + (notes ? ` - ${notes}` : '')
            });
          }
        } catch (suppErr) {
          console.warn("Could not log supplier due transaction on restock:", suppErr);
        }
      }

      toast.success(`"${product.name}" এর নতুন ব্যাচ (৳${unitCost} দরে ${addQty} ${product.unit || 'টি'}) সফলভাবে যুক্ত হয়েছে!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error during restock:', err);
      toast.error('পণ্য রিস্টক করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
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
        maxWidth: '720px',
        maxHeight: '94vh',
        overflowY: 'auto',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#ecfdf5', color: '#059669', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
                <MdAddShoppingCart size={22} />
              </span>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  পণ্য রিস্টক ও FIFO ব্যাচ এন্ট্রি
                  <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '12px', fontWeight: '800' }}>
                    FIFO Enabled
                  </span>
                </h3>
                <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                  {product?.name} {product?.nameBn ? `(${product?.nameBn})` : ''} | বারকোড: <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{product?.barcode || 'N/A'}</span>
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
          >
            <MdClose size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* 1. Current Inventory Status Card */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '12px'
          }}>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান মোট স্টক</span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                {currentStock} {product?.unit || 'টি'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>সক্রিয় ব্যাচ সংখ্যা</span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#2563eb' }}>
                {currentBatches.length} টি লট / ব্যাচ
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান মোট মজুদ মূল্য</span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#059669' }}>
                {formatCurrency(valuation.totalCostValue)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান খুচরা বিক্রয় মূল্য</span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                {formatCurrency(product?.sellingPrice || product?.price || 0)}
              </span>
            </div>
          </div>

          {/* 1.1 Existing Active Batches Breakdown */}
          {currentBatches.length > 0 && (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#166534', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MdLayers size={16} /> বর্তমানে স্টকে থাকা সক্রিয় ব্যাচসমূহ (বিক্রির সিরিয়াল: উপর থেকে নিচে):
                </span>
                <span style={{ fontSize: '11px', color: '#15803d', fontWeight: '600' }}>আগের ক্রয়মূল্য অপরিবর্তিত থাকবে</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {currentBatches.map((b, idx) => (
                  <div key={b.batchId || idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#ffffff',
                    border: '1px solid #dcfce7',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: idx === 0 ? '#15803d' : '#e2e8f0',
                        color: idx === 0 ? '#ffffff' : '#475569',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '800'
                      }}>
                        {idx === 0 ? '১ম বিক্রি হবে' : `ব্যাচ #${idx + 1}`}
                      </span>
                      <span style={{ fontWeight: '700', color: '#0f172a' }}>
                        অবশিষ্ট: {b.remainingQty} {product?.unit || 'টি'}
                      </span>
                      {b.supplierName && (
                        <span style={{ color: '#64748b', fontSize: '11px' }}>({b.supplierName})</span>
                      )}
                    </div>
                    <div style={{ fontWeight: '800', color: '#047857' }}>
                      ক্রয়দর: {formatCurrency(b.costPrice)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Inward / Purchase Input Section */}
          <div style={{
            background: '#ffffff',
            border: '1.5px solid #cbd5e1',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MdInventory color="#059669" size={18} /> নতুন ক্রয় বিবরণ (New Restock Batch)
            </h4>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  নতুন ক্রয় পরিমাণ ({product?.unit || 'টি'}) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  required
                  placeholder="যেমন: 50"
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #94a3b8',
                    fontSize: '14px',
                    fontWeight: '700',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                  নতুন ক্রয় দর প্রতি একক (৳) *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="যেমন: 55.00"
                  value={newCostPrice}
                  onChange={(e) => setNewCostPrice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #94a3b8',
                    fontSize: '14px',
                    fontWeight: '700',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  মহাজন / সাপ্লায়ার নির্বাচন করুন (ঐচ্ছিক)
                </label>
                {suppliersList.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => {
                        setSelectedSupplierId(e.target.value);
                        if (e.target.value) {
                          const s = suppliersList.find(sup => sup.id === e.target.value);
                          if (s) setSupplierName(s.name);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px'
                      }}
                    >
                      <option value="">-- তালিকা হতে মহাজন নির্বাচন করুন --</option>
                      {suppliersList.map((sup) => (
                        <option key={sup.id} value={sup.id}>
                          {sup.name} {sup.company ? `(${sup.company})` : ''} - দেনা: ৳{sup.duePayable || 0}
                        </option>
                      ))}
                    </select>
                    {!selectedSupplierId && (
                      <input
                        type="text"
                        placeholder="অথবা নতুন মহাজনের নাম লিখুন..."
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          border: '1px dashed #cbd5e1',
                          fontSize: '12px'
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="যেমন: এসিআই লজিস্টিকস"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px'
                    }}
                  />
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '4px' }}>
                  চালান / ভাউচার নং (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: CH-8921"
                  value={voucherNo}
                  onChange={(e) => setVoucherNo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px'
                  }}
                />
              </div>
            </div>

            {/* Payment & Credit / Due Option */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '12px'
            }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#1e293b', marginBottom: '6px' }}>
                💳 মহাজন পেমেন্ট শর্ত (Payment & Due Status):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: paymentStatus === 'partial_paid' ? '10px' : '0' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: paymentStatus === 'full_paid' ? '#ecfdf5' : '#ffffff',
                  border: `1.5px solid ${paymentStatus === 'full_paid' ? '#10b981' : '#cbd5e1'}`,
                  padding: '7px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: paymentStatus === 'full_paid' ? '#047857' : '#475569'
                }}>
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="full_paid"
                    checked={paymentStatus === 'full_paid'}
                    onChange={() => setPaymentStatus('full_paid')}
                  />
                  সম্পূর্ণ নগদ পরিশোধ
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: paymentStatus === 'partial_paid' ? '#eff6ff' : '#ffffff',
                  border: `1.5px solid ${paymentStatus === 'partial_paid' ? '#2563eb' : '#cbd5e1'}`,
                  padding: '7px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: paymentStatus === 'partial_paid' ? '#1d4ed8' : '#475569'
                }}>
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="partial_paid"
                    checked={paymentStatus === 'partial_paid'}
                    onChange={() => setPaymentStatus('partial_paid')}
                  />
                  আংশিক পে ও বাকি
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: paymentStatus === 'full_due' ? '#fef2f2' : '#ffffff',
                  border: `1.5px solid ${paymentStatus === 'full_due' ? '#dc2626' : '#cbd5e1'}`,
                  padding: '7px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: paymentStatus === 'full_due' ? '#b91c1c' : '#475569'
                }}>
                  <input
                    type="radio"
                    name="paymentStatus"
                    value="full_due"
                    checked={paymentStatus === 'full_due'}
                    onChange={() => setPaymentStatus('full_due')}
                  />
                  সম্পূর্ণ বাকিতে ক্রয়
                </label>
              </div>

              {paymentStatus === 'partial_paid' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '8px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#475569', fontWeight: '700', display: 'block', marginBottom: '3px' }}>নগদ পরিশোধের টাকা (৳):</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      max={newBatchTotalCost}
                      placeholder="যেমন: 5000"
                      value={paidAmountOnRestock}
                      onChange={(e) => setPaidAmountOnRestock(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '6px', border: '1px solid #2563eb', fontSize: '13px', fontWeight: '700', color: '#1d4ed8' }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#991b1b', fontWeight: '700', display: 'block', marginBottom: '3px' }}>মহাজনের নতুন বাকি পাওনা হবে:</span>
                    <div style={{ padding: '7px 10px', borderRadius: '6px', background: '#fee2e2', border: '1px solid #fecaca', fontSize: '13px', fontWeight: '800', color: '#dc2626' }}>
                      {formatCurrency(Math.max(0, newBatchTotalCost - (Number(paidAmountOnRestock) || 0)))}
                    </div>
                  </div>
                </div>
              )}

              {paymentStatus === 'full_due' && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#b91c1c', fontWeight: '700' }}>
                  ⚠️ চালানের সম্পূর্ণ মূল্য <strong>{formatCurrency(newBatchTotalCost)}</strong> মহাজনের বকেয়া খাতায় যুক্ত হবে।
                </div>
              )}
            </div>

            <div style={{ marginTop: '6px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                অতিরিক্ত মন্তব্য / নোট (ঐচ্ছিক)
              </label>
              <input
                type="text"
                placeholder="যেমন: নতুন লটের মেয়াদ ২০২৭ পর্যন্ত..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px'
                }}
              />
            </div>
          </div>

          {/* 3. FIFO Multi-Batch Impact Summary */}
          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #eff6ff 100%)',
            border: '1.5px solid #6ee7b7',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', color: '#065f46', fontSize: '14px' }}>
                <MdLayers size={20} />
                FIFO ব্যাচ ইনভেন্টরি সামারি (First-In, First-Out)
              </div>
              <span style={{ fontSize: '11px', background: '#d1fae5', color: '#047857', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                স্বয়ংক্রিয় ব্যাচ ট্র্যাকিং
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '12px', color: '#334155' }}>
              <div>
                <span>নতুন মোট মজুদ হবে:</span>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  {totalNewStock} {product?.unit || 'টি'}
                </div>
              </div>
              <div>
                <span>এই ব্যাচের মোট ক্রয় বিল:</span>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#047857' }}>
                  {formatCurrency(newBatchTotalCost)}
                </div>
              </div>
              <div>
                <span>মোট ইনভেন্টরি ক্রয়মূল্য:</span>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  {formatCurrency(totalNewCostValue)}
                </div>
              </div>
              <div style={{ background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #6ee7b7' }}>
                <span style={{ color: '#065f46', fontWeight: '700' }}>এই ব্যাচের ক্রয়দর:</span>
                <div style={{ fontSize: '16px', fontWeight: '900', color: '#047857' }}>
                  {formatCurrency(unitCost)}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '11px', color: '#065f46', margin: '8px 0 0 0', borderTop: '1px dashed #a7f3d0', paddingTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MdInfo size={14} /> <strong>FIFO নিশ্চয়তা:</strong> পূর্বের কেনা পণ্যের ক্রয়মূল্য অপরিবর্তিত থাকবে। বিক্রির সময় আগের ব্যাচ আগে শেষ হবে এবং বিক্রিত পণ্যের প্রকৃত ক্রয়মূল্য অনুযায়ী নিখুঁত লাভ-ক্ষতি হিসাব হবে।
            </p>
          </div>

          {/* 4. Update 3 Selling Price Tiers (Unified Selling Price) */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MdOutlineTrendingUp color="#2563eb" size={18} /> বিক্রয় মূল্য সমন্বয় করুন (একক বিক্রয়মূল্য)
              </h4>
              <span style={{ fontSize: '11px', color: '#64748b' }}>প্রয়োজন হলে নতুন বিক্রয় মূল্য আপডেট করতে পারেন</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
              {/* 1. Retail Price */}
              <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: '#1e40af' }}>
                    ১. খুচরা মূল্য (Retail / MRP ৳)
                  </label>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: retailMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                    মার্জিন: {retailMargin}%
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={retailPrice}
                  onChange={(e) => setRetailPrice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #2563eb',
                    fontSize: '14px',
                    fontWeight: '800',
                    color: '#1e40af',
                    background: '#ffffff',
                    outline: 'none'
                  }}
                />
              </div>

              {/* 2. Wholesale Price */}
              <div style={{ background: '#ecfdf5', padding: '10px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: '#065f46' }}>
                    ২. পাইকারি মূল্য (Wholesale ৳)
                  </label>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: wholesaleMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                    মার্জিন: {wholesaleMargin}%
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={wholesalePrice}
                  onChange={(e) => setWholesalePrice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #059669',
                    fontSize: '14px',
                    fontWeight: '800',
                    color: '#065f46',
                    background: '#ffffff',
                    outline: 'none'
                  }}
                />
              </div>

              {/* 3. Dealer Price */}
              <div style={{ background: '#f5f3ff', padding: '10px', borderRadius: '8px', border: '1px solid #ddd6fe' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: '#5b21b6' }}>
                    ৩. ডিলার মূল্য (Dealer ৳)
                  </label>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: dealerMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                    মার্জিন: {dealerMargin}%
                  </span>
                </div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={dealerPrice}
                  onChange={(e) => setDealerPrice(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #7c3aed',
                    fontSize: '14px',
                    fontWeight: '800',
                    color: '#5b21b6',
                    background: '#ffffff',
                    outline: 'none'
                  }}
                />
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
              disabled={saving}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                border: 'none',
                background: '#059669',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 6px -1px rgba(5,150,105,0.3)'
              }}
            >
              <MdCheckCircle size={18} />
              {saving ? 'সংরক্ষণ হচ্ছে...' : 'নতুন ব্যাচ রিস্টক নিশ্চিত করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductRestockModal;
