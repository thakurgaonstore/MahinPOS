import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, deleteDoc, doc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { generateRandomBarcode } from '../../utils/barcodeHelper';
import { toast } from 'react-hot-toast';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import ProductFormModal from './ProductFormModal';
import ProductRestockModal from './ProductRestockModal';
import ProductWasteModal from './ProductWasteModal';
import BarcodePrintCenter from './BarcodePrintCenter';

import {
  MdAdd,
  MdSearch,
  MdEdit,
  MdDelete,
  MdQrCode,
  MdFileDownload,
  MdFileUpload,
  MdWarning,
  MdCheckCircle,
  MdCancel,
  MdTableChart,
  MdInfo,
  MdAddShoppingCart
} from 'react-icons/md';

const ProductList = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';
  const role = userProfile?.role || 'cashier';
  const isOwnerOrManager = role === 'shop_admin' || role === 'manager' || userProfile?.isImpersonating;

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'low' | 'out'

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [restockProduct, setRestockProduct] = useState(null);
  const [wasteProduct, setWasteProduct] = useState(null);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [barcodeProduct, setBarcodeProduct] = useState(null);
  const [importing, setImporting] = useState(false);

  const fileInputRef = useRef(null);

  // Pagination
  const [page, setPage] = useState(1);
  const perPage = 25;

  useEffect(() => {
    if (!shopId) return;
    const ref = collection(db, 'shops', shopId, 'products');
    const unsub = onSnapshot(ref, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setProducts(list);
    });
    return () => unsub();
  }, [shopId]);

  // Categories
  const categories = ['All', ...new Set(products.map((p) => p.category).filter(Boolean))];

  // Filtering (1000+ products responsive search)
  const filtered = products.filter((p) => {
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    if (!matchCat) return false;

    const stock = Number(p.stock) || 0;
    const minAlert = Number(p.minStockAlert) || 5;

    if (stockFilter === 'low' && (stock <= 0 || stock > minAlert)) return false;
    if (stockFilter === 'out' && stock > 0) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(q) ||
      (p.nameBn || '').includes(q) ||
      (p.barcode || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / perPage) || 1;
  const paginatedProducts = filtered.slice((page - 1) * perPage, page * perPage);

  // Delete product
  const handleDelete = async (id, name) => {
    if (!window.confirm(`আপনি কি নিশ্চিত "${name}" পণ্যটি মুছে ফেলতে চান?`)) return;
    try {
      await deleteDoc(doc(db, 'shops', shopId, 'products', id));
      toast.success('পণ্য মুছে ফেলা হয়েছে');
    } catch (err) {
      toast.error('পণ্য মুছতে সমস্যা হয়েছে');
    }
  };

  // Export to Excel (Category-wise or Full Filtered)
  const handleExportExcel = () => {
    const data = filtered.map((p, i) => ({
      'নং (SL)': i + 1,
      'বারকোড (Barcode)': p.barcode || '',
      'পণ্যের নাম (Product Name)': p.name,
      'বাংলা নাম (Name Bn)': p.nameBn || '',
      'ক্যাটাগরি (Category)': p.category || 'General',
      'ক্রয় মূল্য (Cost Price)': Number(p.costPrice) || 0,
      'বিক্রয় মূল্য (Selling Price)': Number(p.sellingPrice) || 0,
      'পাইকারি মূল্য (Wholesale Price)': Number(p.wholesalePrice) || 0,
      'ডিলার মূল্য (Dealer Price)': Number(p.dealerPrice) || 0,
      'বর্তমান স্টক (Stock)': Number(p.stock) || 0,
      'একক (Unit)': p.unit || 'টি (Pcs)',
      'লুজ পণ্য কিনা (Is Loose Yes/No)': p.isLoose ? 'Yes' : 'No',
      'কম স্টক সতর্কতা (Min Stock Alert)': Number(p.minStockAlert) || 5
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const catName = selectedCategory === 'All' ? 'All_Products' : selectedCategory.replace(/[^a-zA-Z0-9]/g, '_');
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `MahinPOS_${catName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`এক্সেল ফাইল (${catName}) ডাউনলোড হয়েছে!`);
  };

  // Download Sample Excel Template with clear headers & sample rows
  const handleDownloadTemplate = () => {
    const sampleRows = [
      {
        'বারকোড (Barcode)': '8901030382891',
        'পণ্যের নাম (Product Name)': 'Lux Soft Rose Soap 100g',
        'বাংলা নাম (Name Bn)': 'লাক্স সাবান ১০০ গ্রাম',
        'ক্যাটাগরি (Category)': 'টয়লেট্রিজ',
        'ক্রয় মূল্য (Cost Price)': 52,
        'বিক্রয় মূল্য (Selling Price)': 60,
        'পাইকারি মূল্য (Wholesale Price)': 56,
        'ডিলার মূল্য (Dealer Price)': 54,
        'বর্তমান স্টক (Stock)': 48,
        'একক (Unit)': 'টি (Pcs)',
        'লুজ পণ্য কিনা (Is Loose Yes/No)': 'No',
        'কম স্টক সতর্কতা (Min Stock Alert)': 10
      },
      {
        'বারকোড (Barcode)': '8901030382892',
        'পণ্যের নাম (Product Name)': 'Miniket Rice Premium',
        'বাংলা নাম (Name Bn)': 'মিনিকেট চাল প্রিমিয়াম',
        'ক্যাটাগরি (Category)': 'মুদি',
        'ক্রয় মূল্য (Cost Price)': 68,
        'বিক্রয় মূল্য (Selling Price)': 75,
        'পাইকারি মূল্য (Wholesale Price)': 72,
        'ডিলার মূল্য (Dealer Price)': 70,
        'বর্তমান স্টক (Stock)': 250,
        'একক (Unit)': 'কেজি (Kg)',
        'লুজ পণ্য কিনা (Is Loose Yes/No)': 'Yes',
        'কম স্টক সতর্কতা (Min Stock Alert)': 20
      },
      {
        'বারকোড (Barcode)': '8901030382893',
        'পণ্যের নাম (Product Name)': 'Soyabean Oil 1 Ltr',
        'বাংলা নাম (Name Bn)': 'সয়াবিন তেল ১ লিটার',
        'ক্যাটাগরি (Category)': 'মুদি',
        'ক্রয় মূল্য (Cost Price)': 165,
        'বিক্রয় মূল্য (Selling Price)': 180,
        'পাইকারি মূল্য (Wholesale Price)': 175,
        'ডিলার মূল্য (Dealer Price)': 172,
        'বর্তমান স্টক (Stock)': 60,
        'একক (Unit)': 'লিটার (Ltr)',
        'লুজ পণ্য কিনা (Is Loose Yes/No)': 'No',
        'কম স্টক সতর্কতা (Min Stock Alert)': 12
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sample_Template');
    XLSX.writeFile(wb, 'MahinPOS_Product_Upload_Sample.xlsx');
    toast.success('নমুনা এক্সেল টেমপ্লেট ডাউনলোড হয়েছে!');
  };

  // Upload Excel with UPSERT (Update existing if barcode/id matches, otherwise Insert)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws);

        if (!rows || rows.length === 0) {
          toast.error('এক্সেল ফাইলে কোনো ডেটা পাওয়া যায়নি!');
          setImporting(false);
          return;
        }

        let updatedCount = 0;
        let insertedCount = 0;

        for (const row of rows) {
          // Normalize column headers
          const barcode = String(
            row['বারকোড (Barcode)'] ||
            row['বারকোড'] ||
            row['Barcode'] ||
            row['barcode'] ||
            row['আইডি'] ||
            row['ID'] ||
            ''
          ).trim();

          const name = String(
            row['পণ্যের নাম (Product Name)'] ||
            row['পণ্যের নাম'] ||
            row['Product Name'] ||
            row['name'] ||
            row['Name'] ||
            ''
          ).trim();

          if (!name) continue; // Skip empty rows

          const nameBn = String(row['বাংলা নাম (Name Bn)'] || row['বাংলা নাম'] || row['Name Bn'] || '').trim();
          const category = String(row['ক্যাটাগরি (Category)'] || row['ক্যাটাগরি'] || row['Category'] || 'General').trim();
          const costPrice = Number(row['ক্রয় মূল্য (Cost Price)'] || row['ক্রয় মূল্য'] || row['Cost Price'] || 0);
          const sellingPrice = Number(row['বিক্রয় মূল্য (Selling Price)'] || row['বিক্রয় মূল্য'] || row['Selling Price'] || row['Price'] || 0);
          const wholesalePrice = Number(row['পাইকারি মূল্য (Wholesale Price)'] || row['পাইকারি মূল্য'] || row['Wholesale Price'] || 0);
          const dealerPrice = Number(row['ডিলার মূল্য (Dealer Price)'] || row['ডিলার মূল্য'] || row['Dealer Price'] || 0);
          const stock = Number(row['বর্তমান স্টক (Stock)'] || row['স্টক'] || row['Stock'] || row['মজুদ'] || 0);
          const unit = String(row['একক (Unit)'] || row['একক'] || row['Unit'] || 'টি (Pcs)').trim();

          const isLooseRaw = String(row['লুজ পণ্য কিনা (Is Loose Yes/No)'] || row['লুজ পণ্য'] || row['Is Loose'] || '').toLowerCase();
          const isLoose = isLooseRaw === 'yes' || isLooseRaw === 'true' || isLooseRaw === 'হ্যাঁ' || isLooseRaw === '1';

          const minStockAlert = Number(row['কম স্টক সতর্কতা (Min Stock Alert)'] || row['কম স্টক সতর্কতা'] || row['Min Stock Alert'] || 5);

          // Check if this product already exists by barcode or exact name
          const existing = products.find(p =>
            (barcode && p.barcode && p.barcode === barcode) ||
            (p.name && p.name.toLowerCase() === name.toLowerCase())
          );

          if (existing) {
            // UPDATE existing product
            await setDoc(doc(db, 'shops', shopId, 'products', existing.id), {
              name,
              nameBn: nameBn || existing.nameBn || '',
              barcode: barcode || existing.barcode || generateRandomBarcode(),
              category: category || existing.category || 'General',
              costPrice: costPrice > 0 ? costPrice : (existing.costPrice || 0),
              sellingPrice: sellingPrice > 0 ? sellingPrice : (existing.sellingPrice || 0),
              price: sellingPrice > 0 ? sellingPrice : (existing.price || 0),
              wholesalePrice: wholesalePrice > 0 ? wholesalePrice : (existing.wholesalePrice || 0),
              dealerPrice: dealerPrice > 0 ? dealerPrice : (existing.dealerPrice || 0),
              stock: stock !== 0 ? stock : (existing.stock || 0),
              unit: unit || existing.unit || 'টি (Pcs)',
              isLoose: isLoose !== undefined ? isLoose : (existing.isLoose || false),
              minStockAlert: minStockAlert || existing.minStockAlert || 5,
              updatedAt: serverTimestamp()
            }, { merge: true });

            // Record stock log if stock increased or re-imported
            const prevStock = Number(existing.stock) || 0;
            const newStockVal = stock !== 0 ? stock : prevStock;
            if (newStockVal > prevStock) {
              const addedQty = newStockVal - prevStock;
              const unitCost = costPrice > 0 ? costPrice : (existing.costPrice || 0);
              await addDoc(collection(db, 'shops', shopId, 'stock_logs'), {
                type: 'excel_import',
                productId: existing.id,
                productName: name,
                productBarcode: barcode || existing.barcode || '',
                previousStock: prevStock,
                addedQuantity: addedQty,
                finalStock: newStockVal,
                unit: unit || existing.unit || 'টি (Pcs)',
                previousCostPrice: existing.costPrice || 0,
                purchaseCostPrice: unitCost,
                newAverageCostPrice: unitCost,
                batchTotalCost: addedQty * unitCost,
                retailPrice: sellingPrice > 0 ? sellingPrice : (existing.sellingPrice || 0),
                wholesalePrice: wholesalePrice > 0 ? wholesalePrice : (existing.wholesalePrice || 0),
                dealerPrice: dealerPrice > 0 ? dealerPrice : (existing.dealerPrice || 0),
                supplierName: 'এক্সেল শিট আপডেট',
                voucherNo: 'EXCEL-UPD',
                notes: 'এক্সেল ফাইল আপলোডের মাধ্যমে পণ্য স্টক আপডেট',
                createdAt: serverTimestamp()
              });
            }

            updatedCount++;
          } else {
            // INSERT new product
            const finalBarcode = barcode || generateRandomBarcode();
            const newProdRef = await addDoc(collection(db, 'shops', shopId, 'products'), {
              name,
              nameBn,
              barcode: finalBarcode,
              sku: finalBarcode,
              category,
              costPrice,
              sellingPrice,
              price: sellingPrice,
              wholesalePrice,
              dealerPrice,
              stock,
              unit,
              isLoose,
              minStockAlert,
              imageUrl: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });

            // Write stock purchase log for new product if stock or costPrice exists
            if (stock > 0 || costPrice > 0) {
              await addDoc(collection(db, 'shops', shopId, 'stock_logs'), {
                type: 'excel_import',
                productId: newProdRef.id,
                productName: name,
                productBarcode: finalBarcode,
                previousStock: 0,
                addedQuantity: stock,
                finalStock: stock,
                unit: unit || 'টি (Pcs)',
                previousCostPrice: 0,
                purchaseCostPrice: costPrice,
                newAverageCostPrice: costPrice,
                batchTotalCost: stock * costPrice,
                retailPrice: sellingPrice,
                wholesalePrice: wholesalePrice,
                dealerPrice: dealerPrice,
                supplierName: 'এক্সেল শিট আপলোড',
                voucherNo: 'EXCEL-' + (finalBarcode ? finalBarcode.slice(-6) : Date.now().toString().slice(-6)),
                notes: 'এক্সেল ফাইল বাল্ক আপলোডের মাধ্যমে পণ্য প্রারম্ভিক স্টক এন্ট্রি',
                createdAt: serverTimestamp()
              });
            }

            insertedCount++;
          }
        }

        toast.success(
          `এক্সেল আপলোড সফল! ${updatedCount} টি পণ্য আপডেট এবং ${insertedCount} টি নতুন পণ্য যুক্ত হয়েছে।`,
          { duration: 6000 }
        );
      } catch (err) {
        console.error("Excel import error:", err);
        toast.error('এক্সেল ফাইল পড়তে সমস্যা হয়েছে! সঠিক ফরম্যাট নিশ্চিত করুন।');
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div>
      {/* Top Banner & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: 0 }}>পণ্য ও ইনভেন্টরি ম্যানেজমেন্ট</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>
            মোট পণ্য: <b>{products.length}</b> টি | ফিল্টারকৃত: <b>{filtered.length}</b> টি (ক্যাটাগরি ও লুজ পণ্য সমর্থন)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Sample Template */}
          <button
            onClick={handleDownloadTemplate}
            title="নতুন পণ্য আপলোডের জন্য হেডার সহ নমুনা এক্সেল ফাইল ডাউনলোড করুন"
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MdTableChart size={18} color="#059669" /> নমুনা এক্সেল
          </button>

          {/* Excel Export */}
          <button
            onClick={handleExportExcel}
            title="বর্তমান ফিল্টার বা ক্যাটাগরির সমস্ত পণ্য এক্সেলে ডাউনলোড করুন"
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MdFileDownload size={18} color="#2563eb" /> এক্সপোর্ট ({selectedCategory})
          </button>

          {/* Waste / Damaged / Internal Use Button */}
          <button
            onClick={() => {
              setWasteProduct(null);
              setIsWasteModalOpen(true);
            }}
            title="নষ্ট, মেয়াদোত্তীর্ণ বা স্টোরের নিজস্ব ব্যবহারের পণ্য স্টক থেকে বাদ দিন"
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1.5px solid #fecaca',
              background: '#fff1f2',
              color: '#be123c',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MdWarning size={17} /> নষ্ট ও ইন্টারনাল ইউজ
          </button>

          {/* Excel Import (Owner/Manager only) */}
          {isOwnerOrManager && (
            <label style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontWeight: '600',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <MdFileUpload size={18} color="#7c3aed" />
              <span>{importing ? 'আপলোড হচ্ছে...' : 'এক্সেল আপলোড'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                disabled={importing}
                style={{ display: 'none' }}
              />
            </label>
          )}

          {/* Barcode Print Page Link */}
          <Link
            to="/dashboard/barcodes"
            style={{
              padding: '9px 14px',
              borderRadius: '8px',
              border: '1px solid #bfdbfe',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontWeight: '700',
              fontSize: '13px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MdQrCode size={18} /> বারকোড সেন্টার
          </Link>

          {/* Add Product Modal (Owner/Manager only) */}
          {isOwnerOrManager && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsModalOpen(true);
              }}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                fontWeight: '700',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)'
              }}
            >
              <MdAdd size={18} /> নতুন পণ্য যোগ
            </button>
          )}
        </div>
      </div>

      {/* Info Callout for Excel Upsert */}
      <div style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        padding: '10px 16px',
        marginBottom: '16px',
        fontSize: '12px',
        color: '#475569',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <MdInfo size={18} color="#2563eb" />
        <span>
          💡 <b>স্মার্ট এক্সেল আপলোড:</b> এক্সেলে যদি কোনো পণ্যের বারকোড বা নাম পূর্বে থেকেই ডেটাবেসে থাকে, তবে নতুন ডেটা দিয়ে সেটি <b>স্বয়ংক্রিয়ভাবে আপডেট</b> হবে। নতুন বারকোড পেলে সেটি নতুন পণ্য হিসেবে যুক্ত হবে।
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        background: '#ffffff',
        padding: '16px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        marginBottom: '20px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <MdSearch size={20} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="পণ্য বা বারকোড খুঁজুন..."
              style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '13px' }}
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
            style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', outline: 'none', fontWeight: '600' }}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c === 'All' ? 'সকল ক্যাটাগরি' : c}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => { setStockFilter('all'); setPage(1); }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: stockFilter === 'all' ? '#2563eb' : '#cbd5e1',
              background: stockFilter === 'all' ? '#eff6ff' : '#fff',
              color: stockFilter === 'all' ? '#2563eb' : '#475569',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            সকল স্টক
          </button>
          <button
            onClick={() => { setStockFilter('low'); setPage(1); }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: stockFilter === 'low' ? '#f59e0b' : '#cbd5e1',
              background: stockFilter === 'low' ? '#fffbeb' : '#fff',
              color: stockFilter === 'low' ? '#d97706' : '#475569',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            ⚠️ কম স্টক
          </button>
          <button
            onClick={() => { setStockFilter('out'); setPage(1); }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: stockFilter === 'out' ? '#ef4444' : '#cbd5e1',
              background: stockFilter === 'out' ? '#fef2f2' : '#fff',
              color: stockFilter === 'out' ? '#dc2626' : '#475569',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            🚫 স্টক শেষ
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="table-responsive">
        <table className="pos-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f1f5f9' }}>
              <th style={{ width: '50px' }}>ছবি</th>
              <th>পণ্যের নাম ও বিবরণ</th>
              <th>বারকোড</th>
              <th>ক্যাটাগরি</th>
              {isOwnerOrManager && <th>ক্রয় মূল্য (গড়)</th>}
              <th>বিক্রয় মূল্য (খুচরা | পাইকারি | ডিলার)</th>
              <th>স্টক ও ধরণ</th>
              <th>স্ট্যাটাস</th>
              <th style={{ textAlign: 'center', width: '220px' }}>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((p) => {
              const stock = Number(p.stock) || 0;
              const minAlert = Number(p.minStockAlert) || 5;
              const isOut = stock <= 0;
              const isLow = stock <= minAlert && stock > 0;

              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td>
                    <div style={{ width: '40px', height: '40px', borderRadius: '6px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '18px' }}>📦</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{p.name}</div>
                    {p.nameBn && <div style={{ fontSize: '12px', color: '#64748b' }}>{p.nameBn}</div>}
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                      {p.barcode || '---'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#475569', background: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                      {p.category || 'General'}
                    </span>
                  </td>
                  {isOwnerOrManager && (
                    <td>
                      <span style={{ color: '#475569', fontWeight: '600' }}>{formatCurrency(p.costPrice || 0)}</span>
                    </td>
                  )}
                  <td>
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: '800', color: '#2563eb' }}>
                        খুচরা: {formatCurrency(p.sellingPrice || p.price || 0)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#059669', fontWeight: '600' }}>
                        পাইকারি: {formatCurrency(p.wholesalePrice || 0)}
                      </div>
                      <div style={{ fontSize: '11px', color: '#7c3aed', fontWeight: '600' }}>
                        ডিলার: {formatCurrency(p.dealerPrice || 0)}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a' }}>
                        {stock} {p.unit || ''}
                      </span>
                      {p.isLoose && (
                        <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '10px', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                          ⚖️ লুজ
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '700',
                      background: isOut ? '#fee2e2' : isLow ? '#fef3c7' : '#ecfdf5',
                      color: isOut ? '#dc2626' : isLow ? '#d97706' : '#059669'
                    }}>
                      {isOut ? 'স্টক শেষ' : isLow ? 'কম স্টক' : 'উপলব্ধ'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                      {isOwnerOrManager && (
                        <button
                          onClick={() => setRestockProduct(p)}
                          title="পণ্য রিস্টক ও গড় ক্রয় মূল্য সমন্বয় করুন"
                          style={{
                            padding: '5px 8px',
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#059669',
                            fontSize: '11px',
                            fontWeight: '700',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <MdAddShoppingCart size={13} /> রিস্টক
                        </button>
                      )}

                      {/* Waste / Damaged Button */}
                      <button
                        onClick={() => {
                          setWasteProduct(p);
                          setIsWasteModalOpen(true);
                        }}
                        title="নষ্ট, মেয়াদোত্তীর্ণ বা অভ্যন্তরীণ ব্যবহারের স্টক বাদ দিন"
                        style={{
                          padding: '5px 8px',
                          background: '#fff1f2',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#dc2626',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        <MdWarning size={13} /> ড্যামেজ/ইউজ
                      </button>

                      <button
                        onClick={() => setBarcodeProduct(p)}
                        title="বারকোড স্টিকার প্রিন্ট করুন"
                        style={{ padding: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#0284c7' }}
                      >
                        <MdQrCode size={16} />
                      </button>

                      {isOwnerOrManager && (
                        <>
                          <button
                            onClick={() => {
                              setEditingProduct(p);
                              setIsModalOpen(true);
                            }}
                            title="সংশোধন"
                            style={{ padding: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', color: '#2563eb' }}
                          >
                            <MdEdit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            title="মুছুন"
                            style={{ padding: '6px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', color: '#dc2626' }}
                          >
                            <MdDelete size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {paginatedProducts.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  কোনো পণ্য পাওয়া যায়নি
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
          >
            পূর্ববর্তী
          </button>
          <span style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: '600' }}>
            পৃষ্ঠা {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
          >
            পরবর্তী
          </button>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <ProductFormModal
          shopId={shopId}
          productToEdit={editingProduct}
          existingCategories={categories.filter(c => c !== 'All')}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Barcode Sticker Printer Modal */}
      {barcodeProduct && (
        <BarcodePrintCenter
          product={barcodeProduct}
          onClose={() => setBarcodeProduct(null)}
        />
      )}

      {/* Restock & Weighted Average Cost Modal */}
      {restockProduct && (
        <ProductRestockModal
          shopId={shopId}
          product={restockProduct}
          onClose={() => setRestockProduct(null)}
        />
      )}

      {/* Waste / Damaged / Internal Use Modal */}
      {isWasteModalOpen && (
        <ProductWasteModal
          shopId={shopId}
          product={wasteProduct}
          allProducts={products}
          userProfile={userProfile}
          onClose={() => {
            setIsWasteModalOpen(false);
            setWasteProduct(null);
          }}
        />
      )}
    </div>
  );
};

export default ProductList;
