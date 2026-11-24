import React, { useState, useEffect } from 'react';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  MdClose,
  MdAddShoppingCart,
  MdCalculate,
  MdOutlineTrendingUp,
  MdCheckCircle,
  MdInventory
} from 'react-icons/md';

const ProductRestockModal = ({ shopId, product, onClose, onSuccess }) => {
  const currentStock = Math.max(0, Number(product?.stock) || 0);
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
  const [voucherNo, setVoucherNo] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Parse numeric values
  const addQty = parseFloat(newQuantity) || 0;
  const unitCost = parseFloat(newCostPrice) || 0;
  const newBatchTotalCost = addQty * unitCost;

  // Weighted Average Cost Price Calculation
  const totalNewStock = currentStock + addQty;
  let calculatedAvgCost = currentCostPrice;

  if (addQty > 0) {
    if (currentStock <= 0) {
      calculatedAvgCost = unitCost;
    } else {
      const totalInventoryValue = (currentStock * currentCostPrice) + (addQty * unitCost);
      calculatedAvgCost = Math.round((totalInventoryValue / totalNewStock) * 100) / 100;
    }
  }

  // Margin Calculations
  const rPrice = parseFloat(retailPrice) || 0;
  const wPrice = parseFloat(wholesalePrice) || 0;
  const dPrice = parseFloat(dealerPrice) || 0;

  const retailMargin = rPrice > 0 ? Math.round(((rPrice - calculatedAvgCost) / rPrice) * 100) : 0;
  const wholesaleMargin = wPrice > 0 ? Math.round(((wPrice - calculatedAvgCost) / wPrice) * 100) : 0;
  const dealerMargin = dPrice > 0 ? Math.round(((dPrice - calculatedAvgCost) / dPrice) * 100) : 0;

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
      const finalCostPrice = calculatedAvgCost;

      // 1. Update Product Document with new Stock, Average Cost, and Selling Prices
      const productRef = doc(db, 'shops', shopId, 'products', product.id);
      await updateDoc(productRef, {
        stock: finalStock,
        costPrice: finalCostPrice,
        sellingPrice: rPrice,
        price: rPrice,
        wholesalePrice: wPrice,
        dealerPrice: dPrice,
        lastRestockedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Record Stock Inward / Restock Audit Log
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
        newAverageCostPrice: finalCostPrice,
        batchTotalCost: newBatchTotalCost,
        retailPrice: rPrice,
        wholesalePrice: wPrice,
        dealerPrice: dPrice,
        supplierName: supplierName.trim(),
        voucherNo: voucherNo.trim(),
        notes: notes.trim(),
        createdAt: serverTimestamp()
      });

      toast.success(`"${product.name}" রিস্টক ও গড় ক্রয় মূল্য (৳${finalCostPrice}) সফলভাবে আপডেট হয়েছে!`);
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
        maxWidth: '680px',
        maxHeight: '92vh',
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
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  পণ্য রিস্টক ও গড় ক্রয় মূল্য সমন্বয়
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
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান স্টক</span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                {currentStock} {product?.unit || 'টি'}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান ক্রয় মূল্য</span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#475569' }}>
                {formatCurrency(currentCostPrice)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান স্টক মূল্য</span>
              <span style={{ fontSize: '15px', fontWeight: '700', color: '#475569' }}>
                {formatCurrency(currentStock * currentCostPrice)}
              </span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান খুচরা মূল্য</span>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#2563eb' }}>
                {formatCurrency(product?.sellingPrice || product?.price || 0)}
              </span>
            </div>
          </div>

          {/* 2. Inward / Purchase Input Section */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px'
          }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MdInventory color="#059669" size={18} /> নতুন ক্রয় বিবরণ (Purchase / Restock)
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
                  মহাজন / সাপ্লায়ার নাম (ঐচ্ছিক)
                </label>
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
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>
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
          </div>

          {/* 3. Weighted Average Cost Price Card (Automated) */}
          <div style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #eff6ff 100%)',
            border: '2px solid #a7f3d0',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', color: '#065f46', fontSize: '14px' }}>
                <MdCalculate size={20} />
                স্বয়ংক্রিয় গড় ক্রয় মূল্য (Weighted Average Cost Price)
              </div>
              <span style={{ fontSize: '11px', background: '#d1fae5', color: '#047857', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                অটো ক্যালকুলেটেড
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '12px', color: '#334155' }}>
              <div>
                <span>নতুন মোট স্টক হবে:</span>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                  {totalNewStock} {product?.unit || 'টি'}
                </div>
              </div>
              <div>
                <span>নতুন ক্রয়ের মোট বিল:</span>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#047857' }}>
                  {formatCurrency(newBatchTotalCost)}
                </div>
              </div>
              <div style={{ background: '#ffffff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #6ee7b7' }}>
                <span style={{ color: '#065f46', fontWeight: '700' }}>নতুন গড় ক্রয় মূল্য:</span>
                <div style={{ fontSize: '18px', fontWeight: '900', color: '#047857' }}>
                  {formatCurrency(calculatedAvgCost)}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '11px', color: '#475569', margin: '8px 0 0 0', borderTop: '1px dashed #a7f3d0', paddingTop: '6px' }}>
              সূত্র: ((পূর্বের স্টক {currentStock} × পূর্বের দর ৳{currentCostPrice}) + (নতুন ক্রয় {addQty} × নতুন দর ৳{unitCost})) ÷ মোট স্টক {totalNewStock}
            </p>
          </div>

          {/* 4. Update 3 Selling Price Tiers (Retail, Wholesale, Dealer) */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MdOutlineTrendingUp color="#2563eb" size={18} /> ৩ ধরনের কাস্টমার বিক্রয় মূল্য আপডেট করুন
              </h4>
              <span style={{ fontSize: '11px', color: '#64748b' }}>প্রয়োজন অনুযায়ী বিক্রয় মূল্য পরিবর্তন করতে পারেন</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
              {/* 1. Retail Price */}
              <div style={{ background: '#eff6ff', padding: '10px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '800', color: '#1e40af' }}>
                    ১. খুচরা মূল্য (Retail / MRP ৳)
                  </label>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: retailMargin >= 0 ? '#16a34a' : '#dc2626' }}>
                    লাভ: {retailMargin}%
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
                    লাভ: {wholesaleMargin}%
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
                    লাভ: {dealerMargin}%
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
              {saving ? 'সংরক্ষণ হচ্ছে...' : 'রিস্টক ও মূল্য নিশ্চিত করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductRestockModal;
