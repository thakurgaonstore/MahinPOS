import {
  collection,
  doc,
  addDoc,
  updateDoc,
  increment,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config.js';
import { debitAccountFromExpense, creditAccountFromSale } from './financialAccountsManager.js';

/**
 * Records a supplier transaction (Purchase on due, Payment, or Opening Balance)
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
  recordedBy = 'Admin'
}) {
  if (!shopId || !supplierId) throw new Error("Shop ID এবং Supplier ID প্রয়োজন");

  const numBill = Math.max(0, Number(billAmount) || 0);
  const numPaid = Math.max(0, Number(paidAmount) || 0);
  const numDue = Number(dueAmount) || 0;
  const txDate = date ? new Date(date) : new Date();
  const txYear = txDate.getFullYear();

  // 1. Update Supplier document totals
  const suppRef = doc(db, 'shops', shopId, 'suppliers', supplierId);
  const suppUpdates = {
    duePayable: increment(numDue),
    updatedAt: serverTimestamp(),
    lastTransactionAt: serverTimestamp()
  };
  if (numBill > 0) {
    suppUpdates.totalPurchased = increment(numBill);
  }
  await updateDoc(suppRef, suppUpdates);

  // 2. Add entry to shops/{shopId}/supplier_transactions
  const txData = {
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
  };

  const txRef = await addDoc(collection(db, 'shops', shopId, 'supplier_transactions'), txData);

  // 3. Financial Account Auto-Debit if payment was made to supplier
  if (type === 'payment' && numPaid > 0) {
    let accKey = 'cash';
    const m = paymentMethod.toLowerCase();
    if (m.includes('bank') || m.includes('ব্যাংক')) accKey = 'bank';
    else if (m.includes('bkash') || m.includes('বিকাশ')) accKey = 'bkash';
    else if (m.includes('nagad') || m.includes('নগদ')) accKey = 'nagad';
    else if (m.includes('agent') || m.includes('এজেন্ট')) accKey = 'agent_bank';

    debitAccountFromExpense(shopId, accKey, numPaid).catch((err) => {
      console.warn("Auto-debit from account for supplier payment failed:", err);
    });
  }

  return txRef.id;
}

/**
 * Records a customer due transaction (Sale on due, Due collection payment, or Opening Balance)
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
  recordedBy = 'Admin'
}) {
  if (!shopId || !customerId) throw new Error("Shop ID এবং Customer ID প্রয়োজন");

  const numBill = Math.max(0, Number(billAmount) || 0);
  const numPaid = Math.max(0, Number(paidAmount) || 0);
  const numDue = Number(dueAmount) || 0;
  const txDate = date ? new Date(date) : new Date();
  const txYear = txDate.getFullYear();

  // 1. Update Customer document due
  const custRef = doc(db, 'shops', shopId, 'customers', customerId);
  const custUpdates = {
    dueAmount: increment(numDue),
    updatedAt: serverTimestamp(),
    lastTransactionAt: serverTimestamp()
  };
  if (type === 'sale_due' && numBill > 0) {
    custUpdates.totalPurchases = increment(numBill);
  }
  await updateDoc(custRef, custUpdates);

  // 2. Add entry to shops/{shopId}/customer_transactions
  const txData = {
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
  };

  const txRef = await addDoc(collection(db, 'shops', shopId, 'customer_transactions'), txData);

  // 3. Financial Account Auto-Credit if due was collected from customer
  if (type === 'payment' && numPaid > 0) {
    creditAccountFromSale(shopId, paymentMethod, numPaid).catch((err) => {
      console.warn("Auto-credit from customer due payment failed:", err);
    });
  }

  return txRef.id;
}

/**
 * Subscribes to realtime transactions for a specific supplier
 */
export function subscribeToSupplierTransactions(shopId, supplierId, callback) {
  if (!shopId || !supplierId) return () => {};

  const q = query(
    collection(db, 'shops', shopId, 'supplier_transactions'),
    where('supplierId', '==', supplierId),
    orderBy('date', 'asc')
  );

  return onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.warn("Supplier transactions listener fallback:", err);
    // If composite index is pending, fallback to un-ordered query
    const fallbackQ = query(
      collection(db, 'shops', shopId, 'supplier_transactions'),
      where('supplierId', '==', supplierId)
    );
    return onSnapshot(fallbackQ, (fSnap) => {
      const fList = [];
      fSnap.forEach((d) => fList.push({ id: d.id, ...d.data() }));
      fList.sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));
      callback(fList);
    });
  });
}

/**
 * Subscribes to realtime transactions for a specific customer
 */
export function subscribeToCustomerTransactions(shopId, customerId, callback) {
  if (!shopId || !customerId) return () => {};

  const q = query(
    collection(db, 'shops', shopId, 'customer_transactions'),
    where('customerId', '==', customerId),
    orderBy('date', 'asc')
  );

  return onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.warn("Customer transactions listener fallback:", err);
    const fallbackQ = query(
      collection(db, 'shops', shopId, 'customer_transactions'),
      where('customerId', '==', customerId)
    );
    return onSnapshot(fallbackQ, (fSnap) => {
      const fList = [];
      fSnap.forEach((d) => fList.push({ id: d.id, ...d.data() }));
      fList.sort((a, b) => new Date(a.date || a.createdAt || 0) - new Date(b.date || b.createdAt || 0));
      callback(fList);
    });
  });
}

/**
 * Computes a formal Ledger Statement with Running Balance and "পূর্বের জের (Balance B/F)"
 * based on selected year.
 */
export function computeLedgerStatement(transactions = [], selectedYear = 'all', totalCurrentDue = 0) {
  // Sort chronologically ascending
  const sorted = [...transactions].sort((a, b) => {
    const timeA = new Date(a.date || a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt || 0).getTime();
    const timeB = new Date(b.date || b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt || 0).getTime();
    return timeA - timeB;
  });

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
    const txTime = new Date(tx.date || tx.createdAt?.toDate ? tx.createdAt.toDate() : tx.createdAt || 0).getTime();
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
