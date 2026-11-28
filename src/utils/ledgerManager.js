import {
  collection,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config.js';

/**
 * Safely extracts timestamp (ms) from a transaction object
 */
export function getTxTimestamp(tx) {
  if (!tx) return 0;
  if (tx.date) {
    const t = new Date(tx.date).getTime();
    if (!isNaN(t)) return t;
  }
  if (tx.createdAt?.toDate) {
    return tx.createdAt.toDate().getTime();
  }
  if (tx.createdAt) {
    const t = new Date(tx.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  return 0;
}

/**
 * Resolves payment method string to financial_accounts/balances key
 */
function resolveAccountKey(paymentMethod = 'Cash') {
  const m = String(paymentMethod).toLowerCase();
  if (m.includes('bank') || m.includes('ব্যাংক') || m.includes('card') || m.includes('কার্ড')) {
    return m.includes('agent') || m.includes('এজেন্ট') ? 'agent_bank' : 'bank';
  }
  if (m.includes('bkash') || m.includes('বিকাশ')) return 'bkash';
  if (m.includes('nagad') || m.includes('নগদ')) return 'nagad';
  if (m.includes('agent') || m.includes('এজেন্ট')) return 'agent_bank';
  if (m.includes('due') || m.includes('বাকি')) return null;
  return 'cash';
}

/**
 * Records a supplier transaction (Purchase on due, Payment, or Opening Balance)
 * Uses a single atomic writeBatch for instant execution and zero race conditions.
 */
export async function recordSupplierTransaction(shopId, {
  supplierId,
  supplierName = '',
  supplierCompany = '',
  supplierPhone = '',
  type = 'payment', // 'purchase_due' | 'payment' | 'opening_balance'
  billAmount = 0,
  paidAmount = 0,
  dueAmount = 0,
  paymentMethod = 'Cash',
  voucherNo = '',
  note = '',
  date = null,
  recordedBy = 'Admin',
  skipEntityUpdate = false
}) {
  if (!shopId || !supplierId) throw new Error("Shop ID এবং Supplier ID প্রয়োজন");

  const numBill = Math.max(0, Number(billAmount) || 0);
  const numPaid = Math.max(0, Number(paidAmount) || 0);
  const numDue = Number(dueAmount) || 0;
  const txDate = date ? new Date(date) : new Date();
  const txYear = txDate.getFullYear();

  const batch = writeBatch(db);

  // 1. Update Supplier document totals atomically
  if (!skipEntityUpdate) {
    const suppRef = doc(db, 'shops', shopId, 'suppliers', supplierId);
    const suppUpdates = {
      duePayable: increment(numDue),
      updatedAt: serverTimestamp(),
      lastTransactionAt: serverTimestamp()
    };
    if (numBill > 0) {
      suppUpdates.totalPurchased = increment(numBill);
    }
    batch.update(suppRef, suppUpdates);
  }

  // 2. Add entry to shops/{shopId}/supplier_transactions
  const txRef = doc(collection(db, 'shops', shopId, 'supplier_transactions'));
  batch.set(txRef, {
    supplierId,
    supplierName: supplierName.trim(),
    supplierCompany: supplierCompany.trim(),
    supplierPhone: supplierPhone.trim(),
    type,
    billAmount: numBill,
    paidAmount: numPaid,
    dueAmount: numDue,
    paymentMethod,
    voucherNo: voucherNo.trim(),
    note: note.trim(),
    year: txYear,
    date: txDate.toISOString(),
    recordedBy,
    createdAt: serverTimestamp()
  });

  // 3. Financial Account Auto-Debit if payment was made to supplier (updates liquid funds & Net Capital)
  if ((type === 'payment' || type === 'purchase_due') && numPaid > 0) {
    const accKey = resolveAccountKey(paymentMethod);
    if (accKey) {
      const balancesDocRef = doc(db, 'shops', shopId, 'financial_accounts', 'balances');
      batch.set(balancesDocRef, {
        [accKey]: increment(-numPaid),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }

  await batch.commit();
  return txRef.id;
}

/**
 * Records a customer due transaction (Sale on due, Due collection payment, or Opening Balance)
 * Uses a single atomic writeBatch for instant execution.
 */
export async function recordCustomerTransaction(shopId, {
  customerId,
  customerName = '',
  customerPhone = '',
  type = 'payment', // 'sale_due' | 'payment' | 'opening_balance'
  invoiceNo = '',
  billAmount = 0,
  paidAmount = 0,
  dueAmount = 0,
  paymentMethod = 'Cash',
  note = '',
  date = null,
  recordedBy = 'Admin',
  skipEntityUpdate = false
}) {
  if (!shopId || !customerId) throw new Error("Shop ID এবং Customer ID প্রয়োজন");

  const numBill = Math.max(0, Number(billAmount) || 0);
  const numPaid = Math.max(0, Number(paidAmount) || 0);
  const numDue = Number(dueAmount) || 0;
  const txDate = date ? new Date(date) : new Date();
  const txYear = txDate.getFullYear();

  const batch = writeBatch(db);

  // 1. Update Customer document due
  if (!skipEntityUpdate) {
    const custRef = doc(db, 'shops', shopId, 'customers', customerId);
    const custUpdates = {
      dueAmount: increment(numDue),
      updatedAt: serverTimestamp(),
      lastTransactionAt: serverTimestamp()
    };
    if (type === 'sale_due' && numBill > 0) {
      custUpdates.totalPurchases = increment(numBill);
    }
    batch.update(custRef, custUpdates);
  }

  // 2. Add entry to shops/{shopId}/customer_transactions
  const txRef = doc(collection(db, 'shops', shopId, 'customer_transactions'));
  batch.set(txRef, {
    customerId,
    customerName: customerName.trim(),
    customerPhone: customerPhone.trim(),
    type,
    invoiceNo: invoiceNo.trim(),
    billAmount: numBill,
    paidAmount: numPaid,
    dueAmount: numDue,
    paymentMethod,
    note: note.trim(),
    year: txYear,
    date: txDate.toISOString(),
    recordedBy,
    createdAt: serverTimestamp()
  });

  // 3. Financial Account Auto-Credit if due was collected from customer (updates liquid funds & Net Capital)
  if (type === 'payment' && numPaid > 0) {
    const accKey = resolveAccountKey(paymentMethod);
    if (accKey) {
      const balancesDocRef = doc(db, 'shops', shopId, 'financial_accounts', 'balances');
      batch.set(balancesDocRef, {
        [accKey]: increment(numPaid),
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }

  await batch.commit();
  return txRef.id;
}

/**
 * Syncs supplier duePayable field to match exact ledger statement balance
 */
export async function syncSupplierDueBalance(shopId, supplierId, exactBalance) {
  if (!shopId || !supplierId) return;
  const ref = doc(db, 'shops', shopId, 'suppliers', supplierId);
  await updateDoc(ref, {
    duePayable: Math.round((Number(exactBalance) || 0) * 100) / 100,
    updatedAt: serverTimestamp()
  });
}

/**
 * Syncs customer dueAmount field to match exact ledger statement balance
 */
export async function syncCustomerDueBalance(shopId, customerId, exactBalance) {
  if (!shopId || !customerId) return;
  const ref = doc(db, 'shops', shopId, 'customers', customerId);
  await updateDoc(ref, {
    dueAmount: Math.round((Number(exactBalance) || 0) * 100) / 100,
    updatedAt: serverTimestamp()
  });
}

/**
 * Subscribes to realtime transactions for a specific supplier (no composite index required, instant load)
 */
export function subscribeToSupplierTransactions(shopId, supplierId, callback) {
  if (!shopId || !supplierId) return () => {};

  const q = query(
    collection(db, 'shops', shopId, 'supplier_transactions'),
    where('supplierId', '==', supplierId)
  );

  return onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => getTxTimestamp(a) - getTxTimestamp(b));
    callback(list);
  }, (err) => {
    console.warn("Supplier transactions listener warning:", err);
    callback([]);
  });
}

/**
 * Subscribes to realtime transactions for a specific customer (no composite index required, instant load)
 */
export function subscribeToCustomerTransactions(shopId, customerId, callback) {
  if (!shopId || !customerId) return () => {};

  const q = query(
    collection(db, 'shops', shopId, 'customer_transactions'),
    where('customerId', '==', customerId)
  );

  return onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => getTxTimestamp(a) - getTxTimestamp(b));
    callback(list);
  }, (err) => {
    console.warn("Customer transactions listener warning:", err);
    callback([]);
  });
}

/**
 * Computes a formal Ledger Statement with Running Balance and "পূর্বের জের (Balance B/F)"
 * based on selected year.
 */
export function computeLedgerStatement(transactions = [], selectedYear = 'all') {
  // Sort chronologically ascending
  const sorted = [...transactions].sort((a, b) => getTxTimestamp(a) - getTxTimestamp(b));

  if (selectedYear === 'all') {
    let running = 0;
    const rows = sorted.map((tx) => {
      const dueDelta = Number(tx.dueAmount) || 0;
      running += dueDelta;
      return {
        ...tx,
        runningBalance: Math.round(running * 100) / 100
      };
    });

    return {
      openingBalance: 0,
      closingBalance: Math.round(running * 100) / 100,
      statementRows: rows
    };
  }

  const numYear = Number(selectedYear);
  const startOfYearTime = new Date(numYear, 0, 1, 0, 0, 0).getTime();
  const endOfYearTime = new Date(numYear, 11, 31, 23, 59, 59).getTime();

  // Split into prior year transactions and current year transactions
  let priorBalance = 0;
  const currentYearRows = [];

  sorted.forEach((tx) => {
    const txTime = getTxTimestamp(tx);
    const dueDelta = Number(tx.dueAmount) || 0;

    if (txTime < startOfYearTime) {
      priorBalance += dueDelta;
    } else if (txTime <= endOfYearTime) {
      currentYearRows.push(tx);
    }
  });

  priorBalance = Math.round(priorBalance * 100) / 100;

  // Create highlighted Opening Balance Row (পূর্বের জের টানা)
  const openingRow = {
    id: `bf_${numYear}`,
    isOpeningBalance: true,
    type: 'opening_balance',
    title: `পূর্বের জের (${numYear} সালের প্রারম্ভিক বকেয়া)`,
    voucherNo: 'B/F',
    date: new Date(numYear, 0, 1, 0, 0, 0).toISOString(),
    billAmount: 0,
    paidAmount: 0,
    dueAmount: priorBalance,
    runningBalance: priorBalance,
    note: `পূর্ববর্তী বছরসমূহ হতে আনীত জের (Balance Brought Forward)`
  };

  let running = priorBalance;
  const calculatedRows = currentYearRows.map((tx) => {
    const dueDelta = Number(tx.dueAmount) || 0;
    running += dueDelta;
    return {
      ...tx,
      runningBalance: Math.round(running * 100) / 100
    };
  });

  return {
    openingBalance: priorBalance,
    closingBalance: Math.round(running * 100) / 100,
    statementRows: [openingRow, ...calculatedRows]
  };
}
