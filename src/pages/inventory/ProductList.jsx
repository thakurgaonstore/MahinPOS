import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ProductFormModal from './ProductFormModal';
import BarcodePrintCenter from './BarcodePrintCenter';

import {
  MdAdd,
  MdSearch,
  MdEdit,
  MdDelete,
  MdQrCode,
  MdFileDownload,
  MdWarning,
  MdCheckCircle,
  MdCancel
} from 'react-icons/md';

const ProductList = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'low' | 'out'

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [barcodeProduct, setBarcodeProduct] = useState(null);

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

  // Export to Excel
  const handleExportExcel = () => {
    const data = filtered.map((p, i) => ({
      'নং': i + 1,
      'পণ্যের নাম': p.name,
      'বাংলা নাম': p.nameBn || '',
      'বারকোড': p.barcode || '',
      'ক্যাটাগরি': p.category || '',
      'ক্রয় মূল্য': p.costPrice || 0,
      'বিক্রয় মূল্য': p.sellingPrice || 0,
      'বর্তমান স্টক': p.stock || 0,
      'একক': p.unit || 'টি'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `Products_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('এক্সেল ফাইল ডাউনলোড হয়েছে');
  };

  return (
    <div>
      {/* Top Banner & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a' }}>পণ্য ও ইনভেন্টরি ম্যানেজমেন্ট</h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>মোট পণ্য: <b>{products.length}</b> টি (সক্ষমতা ১০০০+ পণ্য)</p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleExportExcel}
            style={{
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
            }}
          >
            <MdFileDownload size={18} /> এক্সেল এক্সপোর্ট
          </button>

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
            <MdAdd size={18} /> নতুন পণ্য যোগ করুন
          </button>
        </div>
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
            style={{ padding: '9px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontSize: '13px', outline: 'none' }}
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
        <table className="pos-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ছবি</th>
              <th>পণ্যের নাম</th>
              <th>বারকোড</th>
              <th>ক্যাটাগরি</th>
              <th>ক্রয় মূল্য</th>
              <th>বিক্রয় মূল্য</th>
              <th>স্টক পরিমাণ</th>
              <th>স্ট্যাটাস</th>
              <th style={{ textAlign: 'center', width: '130px' }}>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((p) => {
              const stock = Number(p.stock) || 0;
              const minAlert = Number(p.minStockAlert) || 5;
              const isOut = stock <= 0;
              const isLow = stock <= minAlert && stock > 0;

              return (
                <tr key={p.id}>
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
                    <span style={{ fontSize: '12px', color: '#475569' }}>{p.category || 'General'}</span>
                  </td>
                  <td>
                    <span style={{ color: '#64748b' }}>{formatCurrency(p.costPrice || 0)}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: '700', color: '#2563eb' }}>{formatCurrency(p.sellingPrice || 0)}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: '800', fontSize: '14px' }}>{stock} {p.unit || ''}</span>
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
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                      <button
                        onClick={() => setBarcodeProduct(p)}
                        title="বারকোড স্টিকার প্রিন্ট করুন"
                        style={{ padding: '6px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', color: '#0284c7' }}
                      >
                        <MdQrCode size={16} />
                      </button>
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
    </div>
  );
};

export default ProductList;
