import React, { useState } from 'react';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { uploadToCloudinary } from '../../utils/imageUploadHelper';
import { generateRandomBarcode } from '../../utils/barcodeHelper';
import { toast } from 'react-hot-toast';
import { MdClose, MdCloudUpload, MdQrCode, MdSave } from 'react-icons/md';

const ProductFormModal = ({ shopId, productToEdit, onClose, onSave }) => {
  const [name, setName] = useState(productToEdit?.name || '');
  const [nameBn, setNameBn] = useState(productToEdit?.nameBn || '');
  const [barcode, setBarcode] = useState(productToEdit?.barcode || '');
  const [sku, setSku] = useState(productToEdit?.sku || '');
  const [category, setCategory] = useState(productToEdit?.category || 'General');
  const [unit, setUnit] = useState(productToEdit?.unit || 'টি (Pcs)');
  const [costPrice, setCostPrice] = useState(productToEdit?.costPrice || '');
  const [sellingPrice, setSellingPrice] = useState(productToEdit?.sellingPrice || productToEdit?.price || '');
  const [wholesalePrice, setWholesalePrice] = useState(productToEdit?.wholesalePrice || '');
  const [stock, setStock] = useState(productToEdit?.stock || '0');
  const [minStockAlert, setMinStockAlert] = useState(productToEdit?.minStockAlert || '5');
  const [imageUrl, setImageUrl] = useState(productToEdit?.imageUrl || '');

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
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        price: Number(sellingPrice) || 0,
        wholesalePrice: Number(wholesalePrice) || 0,
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
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                ক্যাটাগরি
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="যেমন: মুদি, পানীয়, স্টেশনারি"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
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
                বিক্রয় মূল্য (MRP ৳) *
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
                পাইকারি মূল্য (Wholesale ৳)
              </label>
              <input
                type="number"
                value={wholesalePrice}
                onChange={(e) => setWholesalePrice(e.target.value)}
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
