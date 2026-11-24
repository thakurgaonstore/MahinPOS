import React, { useState, useEffect } from 'react';
import { doc, setDoc, addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { uploadToCloudinary } from '../../utils/imageUploadHelper';
import { generateRandomBarcode } from '../../utils/barcodeHelper';
import { toast } from 'react-hot-toast';
import { MdClose, MdCloudUpload, MdQrCode, MdSave } from 'react-icons/md';

const ProductFormModal = ({ shopId, productToEdit, onClose, onSave, existingCategories = [] }) => {
  const [name, setName] = useState(productToEdit?.name || '');
  const [nameBn, setNameBn] = useState(productToEdit?.nameBn || '');
  const [barcode, setBarcode] = useState(productToEdit?.barcode || '');
  const [sku, setSku] = useState(productToEdit?.sku || '');
  const [category, setCategory] = useState(productToEdit?.category || 'মুদি সামগ্রী');
  const [unit, setUnit] = useState(productToEdit?.unit || 'টি (Pcs)');
  const [isLoose, setIsLoose] = useState(productToEdit?.isLoose || false);
  const [costPrice, setCostPrice] = useState(productToEdit?.costPrice || '');
  const [sellingPrice, setSellingPrice] = useState(productToEdit?.sellingPrice || productToEdit?.price || '');
  const [wholesalePrice, setWholesalePrice] = useState(productToEdit?.wholesalePrice || '');
  const [dealerPrice, setDealerPrice] = useState(productToEdit?.dealerPrice || '');
  const [stock, setStock] = useState(productToEdit?.stock || '0');
  const [minStockAlert, setMinStockAlert] = useState(productToEdit?.minStockAlert || '5');
  const [imageUrl, setImageUrl] = useState(productToEdit?.imageUrl || '');

  const defaultPopularCategories = [
    'মুদি সামগ্রী',
    'চাল ও ডাল',
    'তেল ও ঘি',
    'মসলা ও লবণ',
    'পানীয় ও জুস',
    'স্ন্যাক্স ও বিস্কুট',
    'সাবান ও প্রসাধন',
    'স্টেশনারি'
  ];

  const [availableCategories, setAvailableCategories] = useState(() => {
    const list = [...new Set([...(existingCategories || []), ...defaultPopularCategories])];
    return list.filter(Boolean);
  });

  useEffect(() => {
    if (shopId) {
      getDocs(collection(db, 'shops', shopId, 'products')).then(snap => {
        const catSet = new Set(defaultPopularCategories);
        (existingCategories || []).forEach(c => c && catSet.add(c));
        snap.forEach(d => {
          const c = d.data()?.category;
          if (c) catSet.add(c);
        });
        setAvailableCategories(Array.from(catSet));
      }).catch(err => console.warn(err));
    }
  }, [shopId]);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  // Handle Cloudinary Image Upload
  const handleImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const res = await uploadToCloudinary(file);
      setImageUrl(res.url);
      toast.success('ছবি সফলভাবে আপলোড হয়েছে!');
    } catch (err) {
      console.error("Cloudinary upload failed:", err);
      toast.error('ছবি আপলোড করতে ব্যর্থ হয়েছে');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !sellingPrice) {
      toast.error('পণ্যের নাম ও বিক্রয় মূল্য অবশ্যই প্রদান করুন');
      return;
    }

    setSaving(true);
    try {
      const finalBarcode = barcode.trim() || generateRandomBarcode();
      const productData = {
        name: name.trim(),
        nameBn: nameBn.trim(),
        barcode: finalBarcode,
        sku: sku.trim() || finalBarcode,
        category: category.trim(),
        unit: unit.trim(),
        isLoose: Boolean(isLoose),
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        price: Number(sellingPrice) || 0,
        wholesalePrice: Number(wholesalePrice) || 0,
        dealerPrice: Number(dealerPrice) || 0,
        stock: Number(stock) || 0,
        minStockAlert: Number(minStockAlert) || 5,
        imageUrl: imageUrl || '',
        updatedAt: serverTimestamp()
      };

      if (productToEdit?.id) {
        await setDoc(doc(db, 'shops', shopId, 'products', productToEdit.id), productData, { merge: true });
        toast.success('পণ্য আপডেট করা হয়েছে!');
      } else {
        productData.createdAt = serverTimestamp();
        productData.totalSold = 0;
        await addDoc(collection(db, 'shops', shopId, 'products'), productData);
        toast.success('নতুন পণ্য সফলভাবে তৈরি হয়েছে!');
      }

      if (onSave) onSave();
      onClose();
    } catch (err) {
      console.error("Save product error:", err);
      toast.error('পণ্য সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.6)',
      zIndex: 110,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '650px',
        maxHeight: '90vh',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
            {productToEdit ? 'পণ্য সংশোধন করুন' : 'নতুন পণ্য যুক্ত করুন (Add Product)'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
            <MdClose size={20} />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                পণ্যের নাম (English) *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: ACI Pure Salt 1kg"
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                পণ্যের নাম (বাংলা)
              </label>
              <input
                type="text"
                value={nameBn}
                onChange={(e) => setNameBn(e.target.value)}
                placeholder="যেমন: এসিআই পিউর লবণ ১ কেজি"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                বারকোড (Barcode)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="বারকোড স্ক্যান করুন বা লিখুন"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
                />
                <button
                  type="button"
                  onClick={() => setBarcode(generateRandomBarcode())}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <MdQrCode /> জেনারেট
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155', margin: 0 }}>
                  ক্যাটাগরি (Category)
                </label>
                <span style={{ fontSize: '11px', color: '#64748b' }}>আগের ক্যাটাগরি বেছে নিন বা নতুন লিখুন</span>
              </div>
              <input
                type="text"
                list="product-category-list"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="যেমন: চাল ও ডাল, মুদি, পানীয়..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
              <datalist id="product-category-list">
                {availableCategories.map((catName) => (
                  <option key={catName} value={catName} />
                ))}
              </datalist>

              {/* Quick Category Badges */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                {availableCategories.slice(0, 10).map((catName) => (
                  <button
                    key={catName}
                    type="button"
                    onClick={() => setCategory(catName)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: category === catName ? '#2563eb' : '#cbd5e1',
                      background: category === catName ? '#eff6ff' : '#f8fafc',
                      color: category === catName ? '#2563eb' : '#475569',
                      fontSize: '11px',
                      fontWeight: category === catName ? '700' : '500',
                      cursor: 'pointer'
                    }}
                  >
                    + {catName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                ক্রয় মূল্য (Cost Price ৳)
              </label>
              <input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                ১. খুচরা মূল্য (Retail MRP ৳) *
              </label>
              <input
                type="number"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
                required
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #2563eb', outline: 'none', fontWeight: '700' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                ২. পাইকারি মূল্য (Wholesale ৳)
              </label>
              <input
                type="number"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                ৩. ডিলার মূল্য (Dealer ৳)
              </label>
              <input
                type="number"
                value={dealerPrice}
                onChange={(e) => setDealerPrice(e.target.value)}
                placeholder="0.00"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                বর্তমান স্টক (Current Stock)
              </label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                একক (Unit)
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: '#fff' }}
              >
                <option value="টি (Pcs)">টি (Pcs)</option>
                <option value="কেজি (Kg)">কেজি (Kg)</option>
                <option value="গ্রাম (Gm)">গ্রাম (Gm)</option>
                <option value="প্যাকেট (Pkt)">প্যাকেট (Pkt)</option>
                <option value="ডজন (Doz)">ডজন (Doz)</option>
                <option value="লিটার (Ltr)">লিটার (Ltr)</option>
                <option value="বক্স (Box)">বক্স (Box)</option>
                <option value="মিটার (Mtr)">মিটার (Mtr)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                কম স্টক এলার্ট সীমা (Alert)
              </label>
              <input
                type="number"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value)}
                placeholder="5"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>
          </div>

          {/* Loose / Fractional Product Toggle */}
          <div style={{
            background: isLoose ? '#eff6ff' : '#f8fafc',
            border: '1px solid',
            borderColor: isLoose ? '#bfdbfe' : '#e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#0f172a' }}>
                ⚖️ লুজ / ওজনভিত্তিক পণ্য (Loose / Fractional Product)
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', lineHeight: '1.4' }}>
                চাল, ডাল, চিনি, তেল ইত্যাদি পণ্যের জন্য সক্রিয় করুন। POS কাউন্টারে কাস্টমার ২৫০ গ্রাম (০.২৫ কেজি) বা ৫০ টাকার মতো যেকোনো পরিমাণ নিলেও স্বয়ংক্রিয় মূল্য হিসেব হবে।
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}>
              <input
                type="checkbox"
                checked={isLoose}
                onChange={(e) => {
                  setIsLoose(e.target.checked);
                  if (e.target.checked && unit === 'টি (Pcs)') {
                    setUnit('কেজি (Kg)');
                  }
                }}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '700', color: isLoose ? '#2563eb' : '#64748b' }}>
                {isLoose ? 'লুজ পণ্য' : 'সাধারণ'}
              </span>
            </label>
          </div>

          {/* Cloudinary Image Upload */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              পণ্যের ছবি (Cloudinary Image)
            </label>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <label style={{
                padding: '10px 16px',
                borderRadius: '8px',
                border: '1px dashed #2563eb',
                background: '#eff6ff',
                color: '#2563eb',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <MdCloudUpload size={18} />
                {uploadingImage ? 'আপলোড হচ্ছে...' : 'ছবি নির্বাচন করুন'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  disabled={uploadingImage}
                  style={{ display: 'none' }}
                />
              </label>

              {imageUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src={imageUrl} alt="Preview" style={{ width: '45px', height: '45px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>আপলোড সম্পন্ন</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Submit */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 24px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '14px',
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <MdSave size={18} />
              {saving ? 'সংরক্ষণ হচ্ছে...' : 'পণ্য সংরক্ষণ করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductFormModal;
