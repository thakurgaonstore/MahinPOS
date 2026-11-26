import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  serverTimestamp,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config';

// 6 Core Accounts Definition
export const ACCOUNT_KEYS = {
  cash: {
    id: 'cash',
    nameBn: 'ক্যাশ (হাতে নগদ/ড্রয়ার)',
    nameEn: 'Cash in Hand',
    shortName: 'ক্যাশ',
    color: '#059669',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    iconType: 'cash',
    description: 'দোকানের ক্যাশ ড্রয়ারে থাকা নগদ টাকা'
  },
  bank: {
    id: 'bank',
    nameBn: 'ব্যাংক ব্যালান্স',
    nameEn: 'Bank Account',
    shortName: 'ব্যাংক',
    color: '#2563eb',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    iconType: 'bank',
    description: 'দোকানের মূল চলতি/সঞ্চয়ী ব্যাংক হিসাব'
  },
  bkash: {
    id: 'bkash',
    nameBn: 'বিকাশ (bKash)',
    nameEn: 'bKash Wallet',
    shortName: 'বিকাশ',
    color: '#e11d48',
    bgColor: '#fff1f2',
    borderColor: '#fecdd3',
    iconType: 'mobile',
    description: 'মার্চেন্ট / এজেন্ট / পার্সোনাল বিকাশ ব্যালান্স'
  },
  nagad: {
    id: 'nagad',
    nameBn: 'নগদ (Nagad)',
    nameEn: 'Nagad Wallet',
    shortName: 'নগদ',
    color: '#ea580c',
    bgColor: '#fff7ed',
    borderColor: '#fed7aa',
    iconType: 'mobile',
    description: 'মার্চেন্ট / পার্সোনাল নগদ ওয়ালেট ব্যালান্স'
  },
  agent_bank: {
    id: 'agent_bank',
    nameBn: 'এজেন্ট ব্যাংক',
    nameEn: 'Agent Banking',
    shortName: 'এজেন্ট ব্যাংক',
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
    iconType: 'store',
    description: 'এজেন্ট ব্যাংকিং অ্যাকাউন্ট ও কাউন্টার ব্যালান্স'
  },
  flexiload: {
    id: 'flexiload',
    nameBn: 'ফ্লেক্সিলোড ব্যালান্স',
    nameEn: 'Flexiload Balance',
    shortName: 'ফ্লেক্সিলোড',
    color: '#7c3aed',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    iconType: 'sim',
    description: 'মোবাইল রিচার্জ সিমে থাকা মোট রানিং ব্যালান্স'
  }
};

export const DEFAULT_BALANCES = {
  cash: 0,
  bank: 0,
  bkash: 0,
  nagad: 0,
  agent_bank: 0,
  flexiload: 0
};

/**
 * Real-time listener for financial account balances
 */
export const subscribeToAccountBalances = (shopId, callback) => {
  if (!shopId) return () => {};

  const balancesDocRef = doc(db, 'shops', shopId, 'financial_accounts', 'balances');

  const unsubscribe = onSnapshot(balancesDocRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      const sanitized = {
        cash: Number(data.cash) || 0,
        bank: Number(data.bank) || 0,
        bkash: Number(data.bkash) || 0,
        nagad: Number(data.nagad) || 0,
        agent_bank: Number(data.agent_bank) || 0,
        flexiload: Number(data.flexiload) || 0,
        updatedAt: data.updatedAt || null
      };
      callback(sanitized);
    } else {
      // Initialize with 0 or local storage opening cash if first time
      const initialCash = Number(localStorage.getItem(`openingCash_${shopId}`)) || 0;
      const initialData = { ...DEFAULT_BALANCES, cash: initialCash, updatedAt: serverTimestamp() };
      setDoc(balancesDocRef, initialData).catch(() => {});
      callback({ ...DEFAULT_BALANCES, cash: initialCash });
    }
  }, (err) => {
    console.error("Error subscribing to account balances:", err);
    callback(DEFAULT_BALANCES);
  });

  return unsubscribe;
};

/**
 * Add money / Capital inflow into an account
 */
export const addMoneyToAccount = async (shopId, { account, amount, source, note, operatorName, operatorId }) => {
  const numAmount = Number(amount);
  if (!shopId || !account || isNaN(numAmount) || numAmount <= 0) {
    throw new Error('অবৈধ টাকার পরিমাণ বা অ্যাকাউন্ট');
  }

  const balancesDocRef = doc(db, 'shops', shopId, 'financial_accounts', 'balances');

  // 1. Update balance atomically
  await setDoc(balancesDocRef, {
    [account]: increment(numAmount),
    updatedAt: serverTimestamp(),
    lastUpdatedBy: operatorName || 'Admin'
  }, { merge: true });

  // 2. Log transaction
  const txRef = collection(db, 'shops', shopId, 'account_transactions');
  await addDoc(txRef, {
    type: 'add_money',
    account,
    accountName: ACCOUNT_KEYS[account]?.nameBn || account,
    amount: numAmount,
    source: source || 'মালিকের মূলধন',
    note: note || '',
    operatorName: operatorName || 'Admin',
    operatorId: operatorId || '',
    createdAt: serverTimestamp(),
    timestamp: Date.now()
  });

  return true;
};

/**
 * Transfer funds between accounts (e.g. Bank to Cash, Cash to Flexiload, etc.)
 */
export const transferAccountFund = async (shopId, { fromAccount, toAccount, amount, note, operatorName, operatorId }) => {
  const numAmount = Number(amount);
  if (!shopId || !fromAccount || !toAccount || isNaN(numAmount) || numAmount <= 0) {
    throw new Error('অবৈধ ট্রান্সফার তথ্য বা পরিমাণ');
  }

  if (fromAccount === toAccount) {
    throw new Error('উৎস ও গন্তব্য অ্যাকাউন্ট একই হতে পারবে না');
  }

  const balancesDocRef = doc(db, 'shops', shopId, 'financial_accounts', 'balances');

  // 1. Update balances atomically: decrease fromAccount, increase toAccount
  await setDoc(balancesDocRef, {
    [fromAccount]: increment(-numAmount),
    [toAccount]: increment(numAmount),
    updatedAt: serverTimestamp(),
    lastUpdatedBy: operatorName || 'Admin'
  }, { merge: true });

  // 2. Log transaction
  const txRef = collection(db, 'shops', shopId, 'account_transactions');
  await addDoc(txRef, {
    type: 'transfer',
    fromAccount,
    fromAccountName: ACCOUNT_KEYS[fromAccount]?.nameBn || fromAccount,
    toAccount,
    toAccountName: ACCOUNT_KEYS[toAccount]?.nameBn || toAccount,
    amount: numAmount,
    note: note || '',
    operatorName: operatorName || 'Admin',
    operatorId: operatorId || '',
    createdAt: serverTimestamp(),
    timestamp: Date.now()
  });

  return true;
};

/**
 * Direct balance adjustment / setting initial balance
 */
export const adjustAccountBalance = async (shopId, { account, newBalance, oldBalance, reason, operatorName, operatorId }) => {
  const numNew = Number(newBalance);
  if (!shopId || !account || isNaN(numNew)) {
    throw new Error('অবৈধ ব্যালান্স ইনপুট');
  }

  const numOld = Number(oldBalance) || 0;
  const difference = numNew - numOld;

  const balancesDocRef = doc(db, 'shops', shopId, 'financial_accounts', 'balances');

  await setDoc(balancesDocRef, {
    [account]: numNew,
    updatedAt: serverTimestamp(),
    lastUpdatedBy: operatorName || 'Admin'
  }, { merge: true });

  const txRef = collection(db, 'shops', shopId, 'account_transactions');
  await addDoc(txRef, {
    type: 'adjust',
    account,
    accountName: ACCOUNT_KEYS[account]?.nameBn || account,
    oldBalance: numOld,
    newBalance: numNew,
    difference,
    reason: reason || 'সরাসরি ব্যালান্স সমন্বয়',
    operatorName: operatorName || 'Admin',
    operatorId: operatorId || '',
    createdAt: serverTimestamp(),
    timestamp: Date.now()
  });

  return true;
};

/**
 * Auto-credit account when a POS sale is completed
 */
export const creditAccountFromSale = async (shopId, paymentMethod, amount) => {
  const numAmount = Number(amount);
  if (!shopId || !paymentMethod || isNaN(numAmount) || numAmount <= 0) return;

  const m = paymentMethod.toLowerCase();
  let targetAccount = 'cash';

  if (m.includes('bkash') || m.includes('বিকাশ')) {
    targetAccount = 'bkash';
  } else if (m.includes('nagad') || m.includes('নগদ')) {
    targetAccount = 'nagad';
  } else if (m.includes('bank') || m.includes('card') || m.includes('কার্ড')) {
    targetAccount = 'bank';
  } else if (m.includes('agent') || m.includes('এজেন্ট')) {
    targetAccount = 'agent_bank';
  } else if (m.includes('due') || m.includes('বাকি')) {
    return; // Due sale does not immediately credit liquid funds
  }

  try {
    const balancesDocRef = doc(db, 'shops', shopId, 'financial_accounts', 'balances');
    await setDoc(balancesDocRef, {
      [targetAccount]: increment(numAmount),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("Auto-credit sale to account failed:", err);
  }
};

/**
 * Auto-debit account when an expense is recorded
 */
export const debitAccountFromExpense = async (shopId, account, amount) => {
  const numAmount = Number(amount);
  if (!shopId || !account || isNaN(numAmount) || numAmount <= 0) return;

  try {
    const balancesDocRef = doc(db, 'shops', shopId, 'financial_accounts', 'balances');
    await setDoc(balancesDocRef, {
      [account]: increment(-numAmount),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("Auto-debit expense from account failed:", err);
  }
};

/**
 * Subscribe to recent account transactions (Add Money, Transfers, Adjustments)
 */
export const subscribeToAccountTransactions = (shopId, callback, limitCount = 30) => {
  if (!shopId) return () => {};

  const q = query(
    collection(db, 'shops', shopId, 'account_transactions'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    callback(list);
  }, (err) => {
    console.warn("Account transactions listener warning:", err);
    callback([]);
  });
};
