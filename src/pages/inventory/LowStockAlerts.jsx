import React, { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import ProductFormModal from './ProductFormModal';
import { MdWarning, MdEdit, MdShoppingCart, MdFileDownload } from 'react-icons/md';
import * as XLSX from 'xlsx';

const LowStockAlerts = () => {
  const { userProfile } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);

  useEffect(() => {
    if (!shopId) return;
    const ref = collection(db, 'shops', shopId, 'products');
    const unsub = onSnapshot(ref, (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        const stock = Number(data.stock) || 0;
        const minAlert = Number(data.minStockAlert) || 5;
        if (stock <= minAlert) {
          list.push(data);
        }
      });
      setLowStockProducts(list);
    });
    return () => unsub();
  }, [shopId]);

  const handleExportReorderList = () => {
    const data = lowStockProducts.map((p, i) => ({
      'নং': i + 1,
      'পণ্যের নাম': p.name,
      'বারকোড': p.barcode || '',
      'বর্তমান স্টক': p.stock || 0,
      'ন্যূনতম সীমা': p.minStockAlert || 5,
      'প্রস্তাবিত রি-অর্ডার পরিমাণ': (p.minStockAlert || 5) * 3,
      'ক্রয় মূল্য': p.costPrice || 0
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ReorderList');
    XLSX.writeFile(wb, `LowStock_Reorder_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdWarning color="#d97706" /> কম স্টক সতর্কতা (Low Stock Alerts)
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b' }}>
            স্টক কম থাকায় অবিলম্বে রি-অর্ডার প্রয়োজন এমন পণ্যসমূহ
          </p>
        </div>

        {lowStockProducts.length > 0 && (
          <button
            onClick={handleExportReorderList}
            style={{
              padding: '9px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#d97706',
              color: '#ffffff',
              fontWeight: '700',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <MdFileDownload size={18} /> রি-অর্ডার লিস্ট এক্সপোর্ট
          </button>
        )}
      </div>

      <div className="table-responsive">
        <table className="pos-table">
          <thead>
            <tr>
              <th>পণ্যের নাম</th>
              <th>বারকোড</th>
              <th>ক্যাটাগরি</th>
              <th>বর্তমান স্টক</th>
              <th>ন্যূনতম এলার্ট সীমা</th>
              <th>প্রস্তাবিত রি-অর্ডার</th>
              <th>ক্রয় মূল্য</th>
              <th style={{ textAlign: 'center' }}>অ্যাকশন</th>
            </tr>
          </thead>
          <tbody>
            {lowStockProducts.map((p) => {
              const stock = Number(p.stock) || 0;
              const min = Number(p.minStockAlert) || 5;
              const isOut = stock <= 0;

              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{p.name}</div>
                    {p.nameBn && <div style={{ fontSize: '12px', color: '#64748b' }}>{p.nameBn}</div>}
                  </td>
                  <td>{p.barcode || '---'}</td>
                  <td>{p.category || 'General'}</td>
                  <td>
                    <span style={{
                      fontWeight: '800',
                      color: isOut ? '#dc2626' : '#d97706',
                      background: isOut ? '#fee2e2' : '#fef3c7',
                      padding: '3px 8px',
                      borderRadius: '4px'
                    }}>
                      {stock} {p.unit || ''}
                    </span>
                  </td>
                  <td>{min} {p.unit || ''}</td>
                  <td>
                    <b>{min * 3} {p.unit || ''}</b>
                  </td>
                  <td>{formatCurrency(p.costPrice || 0)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => setEditingProduct(p)}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#2563eb', fontWeight: '600', fontSize: '12px', cursor: 'pointer' }}
                    >
                      স্টক আপডেট
                    </button>
                  </td>
                </tr>
              );
            })}

            {lowStockProducts.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#059669' }}>
                  🎉 সব পণ্যের পর্যাপ্ত স্টক রয়েছে! কোনো লো স্টক নেই।
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editingProduct && (
        <ProductFormModal
          shopId={shopId}
          productToEdit={editingProduct}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
};

export default LowStockAlerts;
