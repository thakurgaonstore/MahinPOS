import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  increment, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';
import { useBarcodeScanner } from '../../utils/barcodeHelper';
import { formatCurrency } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import QuickAddCustomerModal from '../../components/QuickAddCustomerModal';
import InvoiceViewModal from '../invoices/InvoiceViewModal';

// Icons
import {
  MdSearch,
  MdQrCodeScanner,
  MdAddShoppingCart,
  MdDelete,
  MdAdd,
  MdRemove,
  MdPerson,
  MdPersonAdd,
  MdPayment,
  MdPauseCircle,
  MdPlayCircle,
  MdWarning,
  MdCardGiftcard,
  MdLocalOffer,
  MdReceipt,
  MdClear
} from 'react-icons/md';

const POSTerminal = () => {
  const { userProfile, currentUser } = useAuth();
  const shopId = userProfile?.shopId || 'main-shop';

  // Data states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState([]);
  const [shopConfig, setShopConfig] = useState(null);

  // Cart state
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [discountType, setDiscountType] = useState('flat'); // 'flat' | 'percent'
  const [discountVal, setDiscountVal] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  // Held Carts
  const [heldCarts, setHeldCarts] = useState(() => {
    try {
      const stored = localStorage.getItem(`heldCarts_${shopId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });

  // Modals & Popups
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState('Cash'); // 'Cash' | 'bKash' | 'Nagad' | 'Card' | 'Due'
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');

  const searchInputRef = useRef(null);

  // Sound beep effect on scanner success
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 850;
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
  };

  // Realtime Listeners
  useEffect(() => {
    if (!shopId) return;

    // 1. Fetch Products
    const prodRef = collection(db, 'shops', shopId, 'products');
    const unsubProd = onSnapshot(prodRef, (snapshot) => {
      const list = [];
      const catSet = new Set(['All']);
      snapshot.forEach((d) => {
        const data = { id: d.id, ...d.data() };
        list.push(data);
        if (data.category) catSet.add(data.category);
      });
      setProducts(list);
      setCategories(Array.from(catSet));
    });

    // 2. Fetch Customers
    const custRef = collection(db, 'shops', shopId, 'customers');
    const unsubCust = onSnapshot(custRef, (snapshot) => {
      const list = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setCustomers(list);
    });

    // 3. Fetch Shop Config
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'shops', shopId));
        if (snap.exists()) setShopConfig(snap.data());
      } catch (err) {
        console.warn("Could not load shop config:", err);
      }
    };
    fetchConfig();

    return () => {
      unsubProd();
      unsubCust();
    };
  }, [shopId]);

  // Barcode Scanner Listener
  useBarcodeScanner((scannedCode) => {
    const clean = scannedCode.trim();
    if (!clean) return;

    const matched = products.find(
      (p) => (p.barcode && p.barcode.toLowerCase() === clean.toLowerCase()) || (p.sku && p.sku.toLowerCase() === clean.toLowerCase())
    );

    if (matched) {
      playBeep();
      addToCart(matched);
      toast.success(`বারকোড: ${matched.name} যোগ হয়েছে`, { position: 'bottom-right' });
    } else {
      toast.error(`কোনো পণ্য মেলেনি: ${clean}`, { position: 'bottom-right' });
    }
  });

  // Keyboard shortcut listener (F2 to focus search, F4 to checkout, ESC to cancel)
  useEffect(() => {
    const handleKeys = (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) openCheckoutModal();
      }
      if (e.key === 'Escape') {
        setIsPaymentModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  });

  // Filtered products list (Search 1000+ items instantly)
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
    if (!matchCat) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (p.name || '').toLowerCase().includes(q) || (p.nameBn || '').includes(q);
    const barcodeMatch = (p.barcode || '').toLowerCase().includes(q);
    const skuMatch = (p.sku || '').toLowerCase().includes(q);
    const catMatch = (p.category || '').toLowerCase().includes(q);
    return nameMatch || barcodeMatch || skuMatch || catMatch;
  });

  // Filtered customers by mobile number or name
  const filteredCustomers = customers.filter((c) => {
    if (!customerSearchQuery.trim()) return true;
    const q = customerSearchQuery.trim().toLowerCase();
    const phoneMatch = (c.phone || '').includes(q);
    const nameMatch = (c.name || '').toLowerCase().includes(q);
    return phoneMatch || nameMatch;
  });

  // Add to cart
  const addToCart = (product) => {
    const existingIndex = cart.findIndex((item) => item.productId === product.id);
    const currentStock = Number(product.stock) || 0;

    if (existingIndex > -1) {
      const currentQty = cart[existingIndex].quantity;
      if (currentQty + 1 > currentStock) {
        toast.error(`অপর্যাপ্ত স্টক! স্টকে আছে মাত্র ${currentStock} টি`);
        return;
      }
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].total = (newCart[existingIndex].price - newCart[existingIndex].discount) * newCart[existingIndex].quantity;
      setCart(newCart);
    } else {
      if (currentStock <= 0) {
        toast.error('দুঃখিত! এই পণ্যটির স্টক শেষ (Out of Stock)');
        return;
      }
      const price = Number(product.sellingPrice) || Number(product.price) || 0;
      setCart([
        ...cart,
        {
          productId: product.id,
          name: product.name,
          nameBn: product.nameBn || '',
          barcode: product.barcode || '',
          unit: product.unit || 'টি',
          isLoose: Boolean(product.isLoose),
          costPrice: Number(product.costPrice) || 0,
          price: price,
          discount: 0,
          quantity: 1,
          total: price,
          stock: currentStock
        }
      ]);
    }
  };

  // Modify cart quantity
  const updateQuantity = (index, delta) => {
    const item = cart[index];
    const newQty = Math.round((item.quantity + delta) * 1000) / 1000;
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    if (newQty > item.stock) {
      toast.error(`স্টকে সর্বোচ্চ ${item.stock} ${item.unit} রয়েছে`);
      return;
    }
    const newCart = [...cart];
    newCart[index].quantity = newQty;
    newCart[index].total = Math.round((newCart[index].price - newCart[index].discount) * newQty * 100) / 100;
    setCart(newCart);
  };

  // Set fractional or custom quantity (e.g. 0.150 kg, .220 ltr)
  const setCustomQty = (index, qty) => {
    if (qty === '' || qty === null || qty === undefined) return;
    const strVal = String(qty).trim();
    const val = parseFloat(strVal.startsWith('.') ? '0' + strVal : strVal);
    if (isNaN(val) || val <= 0) return;
    const item = cart[index];
    if (val > item.stock) {
      toast.error(`স্টকে সর্বোচ্চ ${item.stock} ${item.unit} রয়েছে`);
      return;
    }
    const newCart = [...cart];
    newCart[index].quantity = val;
    newCart[index].total = Math.round((newCart[index].price - newCart[index].discount) * val * 100) / 100;
    setCart(newCart);
  };

  // Set quantity by target Taka amount (e.g. 20 Tk rice at 60 Tk/kg = 0.333 kg)
  const setQtyByAmount = (index, targetTk) => {
    const val = parseFloat(targetTk);
    if (isNaN(val) || val <= 0) return;
    const item = cart[index];
    const unitPrice = item.price - item.discount;
    if (unitPrice <= 0) return;
    const calculatedQty = Math.round((val / unitPrice) * 1000) / 1000;
    setCustomQty(index, calculatedQty);
    toast.success(`৳${val} এর জন্য ${calculatedQty} ${item.unit} নির্ধারণ করা হয়েছে`);
  };

  // Remove from cart
  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  
  let calculatedDiscount = 0;
  if (discountType === 'percent') {
    calculatedDiscount = (subtotal * (Number(discountVal) || 0)) / 100;
  } else {
    calculatedDiscount = Number(discountVal) || 0;
  }

  // Loyalty Points conversion (1 point = 1 BDT discount)
  const pointsDiscount = Number(pointsToRedeem) || 0;
  const totalDiscount = Math.min(subtotal, calculatedDiscount + pointsDiscount);

  const discountedSubtotal = Math.max(0, subtotal - totalDiscount);
  const taxAmount = (discountedSubtotal * (Number(taxPercent) || 0)) / 100;
  const grandTotal = Math.round(discountedSubtotal + taxAmount);

  // Reward points earned on current transaction (1 point per 100 BDT spent)
  const pointsEarnRate = shopConfig?.pointsEarnRate || 100; // default 100 BDT = 1 point
  const pointsEarned = Math.floor(grandTotal / pointsEarnRate);

  // Return change calculation
  const numericPaid = Number(paidAmount) || 0;
  const changeReturn = Math.max(0, numericPaid - grandTotal);
  const dueAmount = Math.max(0, grandTotal - numericPaid);

  // Open Checkout Modal
  const openCheckoutModal = () => {
    if (cart.length === 0) {
      toast.error('কার্টে কোনো পণ্য নেই!');
      return;
    }
    setPaidAmount(grandTotal.toString());
    setIsPaymentModalOpen(true);
  };

  // Hold Cart
  const handleHoldCart = () => {
    if (cart.length === 0) return;
    const holdItem = {
      id: Date.now(),
      time: new Date().toLocaleTimeString(),
      cart,
      customer: selectedCustomer,
      grandTotal
    };
    const updated = [holdItem, ...heldCarts];
    setHeldCarts(updated);
    localStorage.setItem(`heldCarts_${shopId}`, JSON.stringify(updated));
    setCart([]);
    setSelectedCustomer(null);
    setPointsToRedeem(0);
    toast.success('কার্ট হোল্ড করা হয়েছে');
  };

  // Resume Cart
  const handleResumeCart = (holdItem) => {
    setCart(holdItem.cart);
    setSelectedCustomer(holdItem.customer || null);
    const updated = heldCarts.filter((h) => h.id !== holdItem.id);
    setHeldCarts(updated);
    localStorage.setItem(`heldCarts_${shopId}`, JSON.stringify(updated));
    toast.success('হোল্ড কার্ট পুনরায় লোড হয়েছে');
  };

  // Complete Sale
  const handleCompleteSale = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      // Invoice ID in YYMMDDHHMMSS format (e.g. 261124131545)
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const invoiceNo = `${yy}${mm}${dd}${hh}${min}${ss}`;

      const actualPaid = paymentMethod === 'Due' ? 0 : numericPaid;
      const actualDue = paymentMethod === 'Due' ? grandTotal : dueAmount;

      const customerPrevPoints = selectedCustomer ? (Number(selectedCustomer.rewardPoints) || 0) : 0;
      const finalCustomerPoints = selectedCustomer ? Math.max(0, customerPrevPoints + pointsEarned - pointsToRedeem) : 0;

      const saleData = {
        invoiceNo,
        shopId,
        items: cart,
        subtotal,
        discountAmount: calculatedDiscount,
        pointsRedeemed: pointsToRedeem,
        pointsRedeemedDiscount: pointsDiscount,
        customerRewardPoints: customerPrevPoints,
        finalCustomerPoints: finalCustomerPoints,
        taxAmount,
        grandTotal,
        paymentMethod,
        paidAmount: actualPaid,
        changeReturn: paymentMethod === 'Due' ? 0 : changeReturn,
        dueAmount: actualDue,
        paymentNote,
        customerId: selectedCustomer?.id || null,
        customerName: selectedCustomer?.name || 'সাধারণ ক্রেতা',
        customerPhone: selectedCustomer?.phone || '',
        customerAddress: selectedCustomer?.address || '',
        pointsEarned: selectedCustomer ? pointsEarned : 0,
        cashierId: currentUser?.uid || '',
        cashierName: userProfile?.name || userProfile?.email || 'Admin',
        createdAt: serverTimestamp()
      };

      // 1. Save Sale to Firestore
      const saleRef = await addDoc(collection(db, 'shops', shopId, 'sales'), saleData);

      // 2. Decrement Products Stock
      for (const item of cart) {
        try {
          const pDoc = doc(db, 'shops', shopId, 'products', item.productId);
          await updateDoc(pDoc, {
            stock: increment(-item.quantity),
            totalSold: increment(item.quantity)
          });
        } catch (e) {
          console.warn("Stock decrement error:", e);
        }
      }

      // 3. Update Customer Stats & Loyalty Points
      if (selectedCustomer?.id) {
        try {
          const cDoc = doc(db, 'shops', shopId, 'customers', selectedCustomer.id);
          const pointsDiff = pointsEarned - pointsToRedeem;
          await updateDoc(cDoc, {
            totalPurchases: increment(grandTotal),
            dueAmount: increment(actualDue),
            rewardPoints: increment(pointsDiff)
          });
        } catch (e) {
          console.warn("Customer update error:", e);
        }
      }

      toast.success('বিক্রয় সম্পন্ন হয়েছে!');
      setIsPaymentModalOpen(false);

      // Open printable invoice modal with newly created invoice
      setCreatedInvoice({ id: saleRef.id, ...saleData, createdAt: new Date() });

      // Reset cart
      setCart([]);
      setSelectedCustomer(null);
      setDiscountVal(0);
      setPointsToRedeem(0);
      setPaidAmount('');
      setPaymentNote('');
    } catch (err) {
      console.error("Sale completion failed:", err);
      toast.error('বিক্রয় সংরক্ষণ করতে সমস্যা হয়েছে');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.6fr 1fr',
      gap: '20px',
      height: 'calc(100vh - 110px)',
      minHeight: '600px',
      fontFamily: "'Hind Siliguri', 'Inter', sans-serif"
    }}>
      {/* LEFT COLUMN: PRODUCTS CATALOG & SEARCH */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
      }}>
        {/* Top Search & Filter Bar */}
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <MdSearch size={22} style={{ position: 'absolute', left: '12px', top: '11px', color: '#64748b' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="পণ্য সার্চ করুন বা বারকোড স্ক্যান করুন (F2)..."
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 42px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '14px',
                  outline: 'none',
                  background: '#f8fafc'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  <MdClear size={18} />
                </button>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#065f46',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}>
              <MdQrCodeScanner size={18} />
              <span>স্ক্যানার চালু</span>
            </div>
          </div>

          {/* Category Chips */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: selectedCategory === cat ? '#2563eb' : '#e2e8f0',
                  background: selectedCategory === cat ? '#2563eb' : '#ffffff',
                  color: selectedCategory === cat ? '#ffffff' : '#475569',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                {cat === 'All' ? 'সকল ক্যাটাগরি' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid (Fast handling for 1000+ items) */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: '14px',
          alignContent: 'start'
        }}>
          {filteredProducts.map((p) => {
            const stock = Number(p.stock) || 0;
            const minAlert = Number(p.minStockAlert) || 5;
            const isOutOfStock = stock <= 0;
            const isLowStock = stock <= minAlert && stock > 0;

            return (
              <div
                key={p.id}
                onClick={() => !isOutOfStock && addToCart(p)}
                style={{
                  background: isOutOfStock ? '#f8fafc' : '#ffffff',
                  border: '1px solid',
                  borderColor: isOutOfStock ? '#e2e8f0' : '#cbd5e1',
                  borderRadius: '12px',
                  padding: '12px',
                  cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease',
                  opacity: isOutOfStock ? 0.6 : 1,
                  position: 'relative'
                }}
              >
                {/* Image or Icon */}
                <div style={{
                  height: '80px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '10px'
                }}>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ fontSize: '28px', color: '#94a3b8' }}>📦</div>
                  )}
                </div>

                <div>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#0f172a',
                    marginBottom: '4px',
                    lineHeight: '1.3',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {p.name}
                  </h4>
                  {p.barcode && (
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                      #{p.barcode}
                    </span>
                  )}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '8px',
                  borderTop: '1px dashed #e2e8f0',
                  paddingTop: '6px'
                }}>
                  <div>
                    <span style={{ fontSize: '15px', fontWeight: '800', color: '#2563eb' }}>
                      {formatCurrency(p.sellingPrice || p.price)}
                    </span>
                  </div>

                  {/* Stock Badge */}
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: isOutOfStock ? '#fee2e2' : isLowStock ? '#fef3c7' : '#ecfdf5',
                    color: isOutOfStock ? '#dc2626' : isLowStock ? '#d97706' : '#059669'
                  }}>
                    {isOutOfStock ? 'স্টক শেষ' : `${stock} ${p.unit || ''}`}
                  </span>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🔍</div>
              <p>কোনো পণ্য পাওয়া যায়নি</p>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: CART & CHECKOUT TERMINAL */}
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
        overflow: 'hidden'
      }}>
        {/* Customer Select Bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', position: 'relative' }}>
          {!selectedCustomer ? (
            <div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <MdSearch size={18} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="📱 কাস্টমার মোবাইল নম্বর বা নাম লিখুন..."
                    value={customerSearchQuery}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onChange={(e) => {
                      setCustomerSearchQuery(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 28px 8px 32px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                  {customerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCustomerSearchQuery('')}
                      style={{ position: 'absolute', right: '8px', top: '8px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    >
                      <MdClear size={16} />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setIsCustomerModalOpen(true)}
                  title="নতুন কাস্টমার যোগ করুন"
                  style={{
                    background: '#2563eb',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: '600',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <MdPersonAdd size={16} />
                  + কাস্টমার
                </button>
              </div>

              {/* Autocomplete Dropdown */}
              {isCustomerDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '52px',
                  left: '16px',
                  right: '16px',
                  background: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
                  zIndex: 30,
                  maxHeight: '220px',
                  overflowY: 'auto'
                }}>
                  <div
                    onClick={() => {
                      setSelectedCustomer(null);
                      setIsCustomerDropdownOpen(false);
                      setCustomerSearchQuery('');
                      setPointsToRedeem(0);
                    }}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      color: '#64748b'
                    }}
                  >
                    🚶 সাধারণ নগদ ক্রেতা (Walk-in Customer)
                  </div>

                  {filteredCustomers.slice(0, 8).map((c) => (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setIsCustomerDropdownOpen(false);
                        setCustomerSearchQuery('');
                        setPointsToRedeem(0);
                      }}
                      style={{
                        padding: '8px 12px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '700', color: '#0f172a' }}>{c.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>📱 {c.phone}</div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '700', background: '#eff6ff', color: '#2563eb', padding: '2px 6px', borderRadius: '4px' }}>
                        🎁 {c.rewardPoints || 0} pt
                      </span>
                    </div>
                  ))}

                  {filteredCustomers.length === 0 && customerSearchQuery && (
                    <div style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#64748b' }}>এই নম্বরে কোনো কাস্টমার পাওয়া যায়নি</p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomerModalOpen(true);
                          setIsCustomerDropdownOpen(false);
                        }}
                        style={{
                          background: '#10b981',
                          color: '#fff',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer'
                        }}
                      >
                        + "{customerSearchQuery}" নম্বর দিয়ে নতুন কাস্টমার তৈরি করুন
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Selected Customer Card with Loyalty Points & Redeem */
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '8px',
              padding: '10px 12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MdPerson size={16} /> {selectedCustomer.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    📱 {selectedCustomer.phone}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setPointsToRedeem(0);
                  }}
                  style={{
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#dc2626',
                    cursor: 'pointer'
                  }}
                >
                  ❌ পরিবর্তন
                </button>
              </div>

              {/* Loyalty Points Redeem Control */}
              <div style={{
                borderTop: '1px dashed #bfdbfe',
                paddingTop: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px'
              }}>
                <div>
                  <span style={{ color: '#1e40af', fontWeight: '700' }}>🎁 পয়েন্ট ব্যালান্স: </span>
                  <span style={{ fontWeight: '800', color: '#2563eb' }}>{selectedCustomer.rewardPoints || 0} টি</span>
                  <span style={{ color: '#64748b' }}> (মান: ৳{selectedCustomer.rewardPoints || 0})</span>
                </div>

                {(selectedCustomer.rewardPoints || 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      min="0"
                      max={Math.min(selectedCustomer.rewardPoints || 0, subtotal)}
                      value={pointsToRedeem || ''}
                      onChange={(e) => {
                        const val = Math.min(Number(e.target.value) || 0, selectedCustomer.rewardPoints || 0, subtotal);
                        setPointsToRedeem(val);
                      }}
                      placeholder="পয়েন্ট"
                      style={{ width: '55px', padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #93c5fd', textAlign: 'center' }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (pointsToRedeem > 0) {
                          setPointsToRedeem(0);
                        } else {
                          const maxRedeem = Math.min(selectedCustomer.rewardPoints || 0, subtotal);
                          setPointsToRedeem(maxRedeem);
                          toast.success(`${maxRedeem} পয়েন্ট রিডিম করা হয়েছে!`);
                        }
                      }}
                      style={{
                        background: pointsToRedeem > 0 ? '#ef4444' : '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontWeight: '700',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      {pointsToRedeem > 0 ? 'রদ' : 'সর্বোচ্চ রিডিম'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8' }}>
              <MdAddShoppingCart size={48} style={{ color: '#cbd5e1', marginBottom: '8px' }} />
              <p style={{ fontSize: '15px' }}>কার্ট সম্পূর্ণ খালি</p>
              <p style={{ fontSize: '12px' }}>বাম পাশ থেকে পণ্য ক্লিক করুন বা বারকোড স্ক্যান করুন</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cart.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '10px 12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {item.name}
                        {item.isLoose && (
                          <span style={{ background: '#fef3c7', color: '#b45309', fontSize: '10px', padding: '1px 5px', borderRadius: '4px', fontWeight: '800' }}>
                            ⚖️ লুজ
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b' }}>
                        {formatCurrency(item.price)} প্রতি {item.unit}
                        {item.quantity < 1 && (String(item.unit || '').toLowerCase().includes('কেজি') || String(item.unit || '').toLowerCase().includes('kg')) && (
                          <span style={{ color: '#059669', fontWeight: '700', marginLeft: '6px' }}>
                            ({Math.round(item.quantity * 1000)} গ্রাম)
                          </span>
                        )}
                        {item.quantity < 1 && (String(item.unit || '').toLowerCase().includes('লিটার') || String(item.unit || '').toLowerCase().includes('ltr')) && (
                          <span style={{ color: '#059669', fontWeight: '700', marginLeft: '6px' }}>
                            ({Math.round(item.quantity * 1000)} মিলি)
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onClick={() => updateQuantity(idx, item.isLoose ? -0.05 : -1)}
                        style={{ background: '#fff', border: '1px solid #cbd5e1', width: '26px', height: '26px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <MdRemove size={14} />
                      </button>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw === '' || raw === '.' || raw === '0.') {
                            const newCart = [...cart];
                            newCart[idx].quantity = raw;
                            setCart(newCart);
                            return;
                          }
                          setCustomQty(idx, raw);
                        }}
                        style={{ width: '62px', textAlign: 'center', padding: '4px 2px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: '800' }}
                      />
                      <button
                        onClick={() => updateQuantity(idx, item.isLoose ? 0.05 : 1)}
                        style={{ background: '#fff', border: '1px solid #cbd5e1', width: '26px', height: '26px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <MdAdd size={14} />
                      </button>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '70px', marginLeft: '12px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a' }}>
                        {formatCurrency(item.total)}
                      </span>
                    </div>

                    <button
                      onClick={() => removeFromCart(idx)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', marginLeft: '8px' }}
                    >
                      <MdDelete size={18} />
                    </button>
                  </div>

                  {/* Quick Weight & Volume Presets for Loose Items (e.g. 150gm Rice, .220ml Oil) */}
                  {item.isLoose && (
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingTop: '4px', borderTop: '1px dashed #e2e8f0' }}>
                      {String(item.unit || '').toLowerCase().includes('লিটার') || String(item.unit || '').toLowerCase().includes('ltr') ? (
                        <>
                          {[
                            { label: '৫০ মিলি', val: 0.05 },
                            { label: '১০০ মিলি', val: 0.1 },
                            { label: '১৫০ মিলি', val: 0.15 },
                            { label: '২২০ মিলি', val: 0.22 },
                            { label: '২৫০ মিলি', val: 0.25 },
                            { label: '৫০০ মিলি', val: 0.5 },
                            { label: '১ লিটার', val: 1.0 }
                          ].map((quick) => (
                            <button
                              key={quick.val}
                              type="button"
                              onClick={() => setCustomQty(idx, quick.val)}
                              style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                background: Number(item.quantity) === quick.val ? '#2563eb' : '#ffffff',
                                color: Number(item.quantity) === quick.val ? '#ffffff' : '#334155',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                            >
                              {quick.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const ml = prompt(`মিলিলিটার (ml) পরিমাপ লিখুন (যেমন: 220):`, '220');
                              if (ml) {
                                const ltr = Math.round((parseFloat(ml) / 1000) * 1000) / 1000;
                                if (!isNaN(ltr) && ltr > 0) setCustomQty(idx, ltr);
                              }
                            }}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              cursor: 'pointer',
                              fontWeight: '700'
                            }}
                          >
                            🧪 মিলিতে লিখুন
                          </button>
                        </>
                      ) : (
                        <>
                          {[
                            { label: '৫০ গ্রাম', val: 0.05 },
                            { label: '১০০ গ্রাম', val: 0.1 },
                            { label: '১৫০ গ্রাম', val: 0.15 },
                            { label: '২৫০ গ্রাম', val: 0.25 },
                            { label: '৫০০ গ্রাম', val: 0.5 },
                            { label: '১ কেজি', val: 1.0 },
                            { label: '২ কেজি', val: 2.0 }
                          ].map((quick) => (
                            <button
                              key={quick.val}
                              type="button"
                              onClick={() => setCustomQty(idx, quick.val)}
                              style={{
                                fontSize: '11px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #cbd5e1',
                                background: Number(item.quantity) === quick.val ? '#2563eb' : '#ffffff',
                                color: Number(item.quantity) === quick.val ? '#ffffff' : '#334155',
                                cursor: 'pointer',
                                fontWeight: '600'
                              }}
                            >
                              {quick.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const gm = prompt(`গ্রাম (Gram) পরিমাপ লিখুন (যেমন: 150):`, '150');
                              if (gm) {
                                const kg = Math.round((parseFloat(gm) / 1000) * 1000) / 1000;
                                if (!isNaN(kg) && kg > 0) setCustomQty(idx, kg);
                              }
                            }}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              cursor: 'pointer',
                              fontWeight: '700'
                            }}
                          >
                            ⚖️ গ্রামে লিখুন
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const tk = prompt(`৳ কত টাকার ${item.name} নিতে চান?`, '20');
                          if (tk) setQtyByAmount(idx, tk);
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          border: '1px solid #fde68a',
                          background: '#fffbeb',
                          color: '#b45309',
                          cursor: 'pointer',
                          fontWeight: '700'
                        }}
                      >
                        ৳ টাকায় হিসেব
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Held Carts Badge Bar */}
        {heldCarts.length > 0 && (
          <div style={{ padding: '8px 16px', background: '#fffbeb', borderTop: '1px solid #fef3c7', display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#b45309' }}>হোল্ড কার্ট:</span>
            {heldCarts.map((h) => (
              <button
                key={h.id}
                onClick={() => handleResumeCart(h)}
                style={{
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <MdPlayCircle size={14} />
                {h.time} (৳{h.grandTotal})
              </button>
            ))}
          </div>
        )}

        {/* Calculation & Checkout Footer */}
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '16px', background: '#f8fafc' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b' }}>সাব-টোটাল ({cart.reduce((a, c) => a + c.quantity, 0)} আইটেম):</span>
              <span style={{ fontWeight: '700' }}>{formatCurrency(subtotal)}</span>
            </div>

            {/* Discount Row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#64748b' }}>বিশেষ ছাড়:</span>
                <input
                  type="number"
                  value={discountVal || ''}
                  onChange={(e) => setDiscountVal(Number(e.target.value) || 0)}
                  placeholder="0"
                  style={{ width: '60px', padding: '2px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value)}
                  style={{ padding: '2px 4px', fontSize: '11px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                >
                  <option value="flat">৳ (ফ্ল্যাট)</option>
                  <option value="percent">% (শতকরা)</option>
                </select>
              </div>
              <span style={{ color: '#059669', fontWeight: '700' }}>- {formatCurrency(calculatedDiscount)}</span>
            </div>

            {/* Points discount row */}
            {pointsDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb' }}>
                <span>পয়েন্ট ছাড় ({pointsToRedeem} pt):</span>
                <span style={{ fontWeight: '700' }}>- {formatCurrency(pointsDiscount)}</span>
              </div>
            )}

            {/* Grand Total */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '2px dashed #cbd5e1',
              paddingTop: '8px',
              marginTop: '4px',
              fontSize: '18px',
              fontWeight: '800',
              color: '#0f172a'
            }}>
              <span>সর্বমোট প্রদেয়:</span>
              <span style={{ color: '#2563eb' }}>{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.2fr', gap: '10px', marginTop: '14px' }}>
            <button
              onClick={handleHoldCart}
              disabled={cart.length === 0}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '12px',
                color: '#475569',
                fontWeight: '600',
                fontSize: '13px',
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <MdPauseCircle size={18} />
              হোল্ড
            </button>

            <button
              onClick={openCheckoutModal}
              disabled={cart.length === 0}
              style={{
                background: cart.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #10b981, #059669)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px',
                fontWeight: '700',
                fontSize: '15px',
                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: cart.length === 0 ? 'none' : '0 4px 12px rgba(16, 185, 129, 0.3)'
              }}
            >
              <MdPayment size={20} />
              বিল পরিশোধ ও প্রিন্ট (F4)
            </button>
          </div>
        </div>
      </div>

      {/* QUICK ADD CUSTOMER MODAL */}
      {isCustomerModalOpen && (
        <QuickAddCustomerModal
          shopId={shopId}
          initialPhone={customerSearchQuery}
          onClose={() => setIsCustomerModalOpen(false)}
          onCustomerAdded={(newCust) => {
            setSelectedCustomer(newCust);
            setCustomerSearchQuery('');
            setIsCustomerDropdownOpen(false);
          }}
        />
      )}

      {/* PAYMENT & CHECKOUT MODAL */}
      {isPaymentModalOpen && (
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
            maxWidth: '480px',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>বিল পরিশোধ (Payment Checkout)</h3>
              <button onClick={() => setIsPaymentModalOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <MdClear size={20} />
              </button>
            </div>

            {/* Total Display */}
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '10px', textAlign: 'center', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '13px', color: '#64748b' }}>সর্বমোট প্রদেয় বিল</span>
              <div style={{ fontSize: '30px', fontWeight: '800', color: '#2563eb' }}>{formatCurrency(grandTotal)}</div>
              {selectedCustomer && (
                <span style={{ fontSize: '12px', color: '#059669', fontWeight: '600' }}>
                  🎁 ক্রয়ে অর্জিত হবে: +{pointsEarned} পয়েন্ট
                </span>
              )}
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '8px' }}>
                পেমেন্ট মেথড নির্বাচন করুন
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {['Cash', 'bKash', 'Nagad', 'Card', 'Due'].map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(method);
                      if (method === 'Due') setPaidAmount('0');
                      else setPaidAmount(grandTotal.toString());
                    }}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: paymentMethod === method ? '#2563eb' : '#cbd5e1',
                      background: paymentMethod === method ? '#eff6ff' : '#ffffff',
                      color: paymentMethod === method ? '#2563eb' : '#475569',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {method === 'Cash' ? 'নগদ' : method === 'Due' ? 'বাকি' : method}
                  </button>
                ))}
              </div>
            </div>

            {/* Paid Amount Input */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                পরিশোধকৃত টাকা (Paid Amount)
              </label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '2px solid #2563eb',
                  fontSize: '18px',
                  fontWeight: '700',
                  outline: 'none'
                }}
              />

              {/* Cash Quick Suggestions */}
              {paymentMethod === 'Cash' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  {[grandTotal, 100, 500, 1000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPaidAmount(val.toString())}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#f8fafc',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      {val === grandTotal ? 'বরাবর' : `+${val}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Change & Due Display */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <div style={{ background: '#ecfdf5', padding: '12px', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                <span style={{ fontSize: '12px', color: '#065f46', fontWeight: '600' }}>ফেরত দিতে হবে:</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#059669' }}>{formatCurrency(changeReturn)}</div>
              </div>
              <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: '600' }}>বাকি থাকবে:</span>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#dc2626' }}>
                  {formatCurrency(paymentMethod === 'Due' ? grandTotal : dueAmount)}
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleCompleteSale}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                background: '#10b981',
                color: '#ffffff',
                fontSize: '16px',
                fontWeight: '700',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
              }}
            >
              <MdReceipt size={20} />
              {isSubmitting ? 'প্রসেসিং হচ্ছে...' : 'বিক্রয় নিশ্চিত করুন ও প্রিন্ট ভিউ'}
            </button>
          </div>
        </div>
      )}

      {/* COMPLETED INVOICE VIEWER MODAL (With 3 print formats!) */}
      {createdInvoice && (
        <InvoiceViewModal
          invoice={createdInvoice}
          shopConfig={shopConfig}
          onClose={() => setCreatedInvoice(null)}
          initialFormat={shopConfig?.defaultInvoiceFormat || 'pos'}
        />
      )}
    </div>
  );
};

export default POSTerminal;
