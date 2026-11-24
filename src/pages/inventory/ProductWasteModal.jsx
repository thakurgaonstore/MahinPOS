import React, { useState } from 'react';
import { doc, updateDoc, addDoc, collection, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  MdClose,
  MdWarning,
  MdStore,
  MdAccessTime,
  MdBrokenImage,
  MdCheckCircle,
  MdSearch
} from 'react-icons/md';

const WASTE_TYPES = [
  { id: 'damaged', label: '💔 নষ্ট বা ড্যামেজ পণ্য', expenseCat: 'নষ্ট ও ড্যামেজ পণ্য' },
  { id: 'expired', label: '⌛ মেয়াদোত্তীর্ণ পণ্য (Expired)', expenseCat: 'নষ্ট ও ড্যামেজ পণ্য' },
  { id: 'internal_use', label: '🏢 দোকানের নিজস্ব ব্যবহার (Internal Use)', expenseCat: 'দোকান অভ্যন্তরীণ ব্যবহার' },
  { id: 'broken', label: '📦 ভাঙ্গা বা প্যাকেট নষ্ট (Broken / Defective)', expenseCat: 'নষ্ট ও ড্যামেজ পণ্য' },
  { id: 'loss', label: '❓ ঘাটতি বা হারিয়ে যাওয়া (Loss / Shrinkage)', expenseCat: 'নষ্ট ও ড্যামেজ পণ্য' }
];

const ProductWasteModal = ({ shopId, product, allProducts = [], userProfile, onClose, onSuccess }) => {
  const [selectedProductId, setSelectedProductId] = useState(product?.id || (allProducts[0]?.id || ''));
  const [searchQuery, setSearchQuery] = useState('');
  const [wasteType, setWasteType] = useState('damaged');
  const [quantity, setQuantity] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [saving, setSaving] = useState(false);

  // Active product details
  const activeProduct = product || allProducts.find((p) => p.id === selectedProductId);
  const currentStock = Number(activeProduct?.stock) || 0;
  const costPrice = Number(activeProduct?.costPrice) || 0;
  const isLoose = Boolean(activeProduct?.isLoose);
  const unit = activeProduct?.unit || 'টি';

  const numQty = parseFloat(quantity) || 0;
  const totalLoss = Math.round(numQty * costPrice * 100) / 100;

  // Filter products for dropdown
  const filteredProductOptions = allProducts.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.nameBn || '').includes(q) ||
      (p.barcode || '').includes(q)
    );
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!activeProduct) {
      toast.error('অনুগ্রহ করে একটি পণ্য নির্বাচন করুন');
      return;
    }

    if (numQty <= 0) {
      toast.error('অনুগ্রহ করে কর্তনের সঠিক পরিমাণ দিন');
      return;
    }

    if (numQty > currentStock) {
      toast.error(`বর্তমান মজুদের চেয়ে বেশি কর্তন সম্ভব নয় (বর্তমান স্টক: ${currentStock} ${unit})`);
      return;
    }

    setSaving(true);
    try {
      const selectedTypeObj = WASTE_TYPES.find((t) => t.id === wasteType) || WASTE_TYPES[0];

      // 1. Decrement Product Stock
      const prodRef = doc(db, 'shops', shopId, 'products', activeProduct.id);
      await updateDoc(prodRef, {
        stock: increment(-numQty),
        updatedAt: serverTimestamp()
      });

      // 2. Add entry in waste_adjustments collection
      await addDoc(collection(db, 'shops', shopId, 'waste_adjustments'), {
        productId: activeProduct.id,
        productName: activeProduct.name,
        productNameBn: activeProduct.nameBn || '',
        barcode: activeProduct.barcode || '',
        unit,
        isLoose,
        costPrice,
        quantity: numQty,
        totalLossAmount: totalLoss,
        type: wasteType,
        typeLabel: selectedTypeObj.label,
        reason: reasonNote.trim() || 'কোনো কারণ উল্লেখ নেই',
        recordedBy: userProfile?.name || userProfile?.email || 'Admin',
        createdAt: serverTimestamp()
      });

      // 3. Add Expense Entry to Accounts
      if (totalLoss > 0) {
        await addDoc(collection(db, 'shops', shopId, 'expenses'), {
          title: `${selectedTypeObj.label}: ${activeProduct.name}`,
          amount: totalLoss,
          category: selectedTypeObj.expenseCat,
          paymentMethod: 'Adjustment (সমন্বয়)',
          note: `কর্তন: ${numQty} ${unit} | প্রতি একক ক্রয়মূল্য: ৳${costPrice} | কারণ: ${reasonNote.trim() || 'উল্লেখ নেই'}`,
          date: new Date().toISOString().slice(0, 10),
          recordedBy: userProfile?.name || userProfile?.email || 'Admin',
          isAutoWaste: true,
          createdAt: serverTimestamp()
        });
      }

      toast.success(`"${activeProduct.name}" (${numQty} ${unit}) স্টক থেকে কর্তন ও ক্ষতি হিসেবে সমন্বয় করা হয়েছে!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Waste recording error:", err);
      toast.error('স্টক সমন্বয় করতে সমস্যা হয়েছে');
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
        maxWidth: '560px',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: '#fef2f2', color: '#dc2626', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
              <MdWarning size={24} />
            </span>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                নষ্ট বা ইন্টারনাল ব্যবহারের পণ্য সমন্বয়
              </h3>
              <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0' }}>
                পণ্য স্টক থেকে বাদ দিন এবং লাভ-ক্ষতিতে ক্ষতি হিসেবে যোগ করুন
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Product Selection (if not pre-selected) */}
          {!product && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                পণ্য নির্বাচন করুন *
              </label>
              <div style={{ position: 'relative', marginBottom: '6px' }}>
                <MdSearch size={18} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="পণ্য বা বারকোড খুঁজুন..."
                  style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' }}
              >
                {filteredProductOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.nameBn ? `(${p.nameBn})` : ''} - স্টক: {p.stock || 0} {p.unit || ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active Product Info Card */}
          {activeProduct && (
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: '800', color: '#0f172a', fontSize: '14px' }}>
                  {activeProduct.name} {activeProduct.nameBn && `(${activeProduct.nameBn})`}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  বারকোড: #{activeProduct.barcode || 'N/A'} | ক্রয়মূল্য: <b>{formatCurrency(costPrice)}</b>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>বর্তমান স্টক</span>
                <span style={{ fontSize: '16px', fontWeight: '800', color: currentStock > 0 ? '#059669' : '#dc2626' }}>
                  {currentStock} {unit}
                </span>
              </div>
            </div>
          )}

          {/* Type of Adjustment */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
              সমন্বয়ের ধরণ (Reason Type) *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
              {WASTE_TYPES.map((t) => (
                <label
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: wasteType === t.id ? '#e11d48' : '#e2e8f0',
                    background: wasteType === t.id ? '#fff1f2' : '#ffffff',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: wasteType === t.id ? '700' : '500',
                    color: wasteType === t.id ? '#be123c' : '#334155'
                  }}
                >
                  <input
                    type="radio"
                    name="wasteType"
                    checked={wasteType === t.id}
                    onChange={() => setWasteType(t.id)}
                    style={{ accentColor: '#e11d48' }}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Quantity to Deduct */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                কর্তনের পরিমাণ ({unit}) *
              </label>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                {isLoose ? '💡 দশমিক গ্রহণযোগ্য (যেমন: 0.250 কেজি)' : '💡 সংখ্যা লিখুন'}
              </span>
            </div>
            <input
              type="number"
              step={isLoose ? '0.001' : '1'}
              min="0"
              max={currentStock}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`কত ${unit} বাদ দিতে চান লিখুন...`}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1.5px solid #cbd5e1',
                fontSize: '15px',
                fontWeight: '700',
                outline: 'none'
              }}
            />
          </div>

          {/* Financial Impact Banner */}
          <div style={{
            background: '#fffaf5',
            border: '1px solid #fed7aa',
            borderRadius: '10px',
            padding: '12px 14px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <span style={{ fontSize: '12px', color: '#ea580c', display: 'block', fontWeight: '700' }}>
                আর্থিক ক্ষতি / অভ্যন্তরীণ খরচের পরিমাণ:
              </span>
              <span style={{ fontSize: '11px', color: '#9a3412' }}>
                ({numQty || 0} {unit} × {formatCurrency(costPrice)}) স্বয়ংক্রিয়ভাবে খরচ খাতায় যুক্ত হবে
              </span>
            </div>
            <div style={{ fontSize: '18px', fontWeight: '900', color: '#c2410c' }}>
              {formatCurrency(totalLoss)}
            </div>
          </div>

          {/* Remarks Note */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
              মন্তব্য বা বিস্তারিত কারণ (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="যেমন: মেয়াদ শেষ, প্যাকেজিং ছেড়া, স্টাফ নাস্তায় ব্যবহার ইত্যাদি..."
              style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px' }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '11px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving || numQty <= 0}
              style={{
                flex: 2,
                padding: '11px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #e11d48, #be123c)',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '13px',
                cursor: (saving || numQty <= 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(225, 29, 72, 0.3)'
              }}
            >
              {saving ? 'সমন্বয় হচ্ছে...' : '⚠️ স্টক থেকে কর্তন ও ক্ষতি রেকর্ড করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductWasteModal;
