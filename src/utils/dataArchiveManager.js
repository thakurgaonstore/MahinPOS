import { db } from '../firebase/config';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  setDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Computes a condensed financial summary from a list of raw sales and expenses
 */
export function computeFinancialRollup(salesList = [], expensesList = [], year) {
  const grossRevenue = salesList.reduce((acc, s) => acc + (Number(s.grandTotal) || 0), 0);
  const totalReturns = salesList.reduce((acc, s) => acc + (Number(s.totalRefundAmount) || 0), 0);
  const netRevenue = Math.max(0, grossRevenue - totalReturns);

  let totalCostOfGoods = 0;
  salesList.forEach((s) => {
    if (s.items && Array.isArray(s.items)) {
      s.items.forEach((item) => {
        const netQty = Math.max(0, (Number(item.quantity) || 0) - (Number(item.returnedQty) || 0));
        totalCostOfGoods += (Number(item.costPrice) || 0) * netQty;
      });
    }
  });

  const grossProfit = netRevenue - totalCostOfGoods;
  const totalExpenses = expensesList.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  const netProfit = grossProfit - totalExpenses;
  const totalPaid = salesList.reduce((acc, s) => acc + (Number(s.paidAmount) || 0), 0);
  const totalDue = salesList.reduce((acc, s) => acc + (Number(s.dueAmount) || 0), 0);

  // Monthly Rollups (1-12)
  const monthlyBreakdown = {};
  for (let m = 1; m <= 12; m++) {
    monthlyBreakdown[m] = { month: m, revenue: 0, cogs: 0, expenses: 0, profit: 0, count: 0 };
  }

  salesList.forEach((s) => {
    const d = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt);
    if (!isNaN(d.getTime())) {
      const monthNum = d.getMonth() + 1;
      if (monthlyBreakdown[monthNum]) {
        const lineNet = (Number(s.grandTotal) || 0) - (Number(s.totalRefundAmount) || 0);
        monthlyBreakdown[monthNum].revenue += lineNet;
        monthlyBreakdown[monthNum].count += 1;
      }
    }
  });

  // Payment Breakdown
  const paymentBreakdown = {};
  salesList.forEach((s) => {
    const m = s.paymentMethod || 'Cash';
    paymentBreakdown[m] = (paymentBreakdown[m] || 0) + (Number(s.grandTotal) || 0);
  });

  return {
    year: String(year),
    totalInvoices: salesList.length,
    grossRevenue: Math.round(grossRevenue * 100) / 100,
    totalReturns: Math.round(totalReturns * 100) / 100,
    netRevenue: Math.round(netRevenue * 100) / 100,
    totalCostOfGoods: Math.round(totalCostOfGoods * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    totalDue: Math.round(totalDue * 100) / 100,
    paymentBreakdown,
    monthlyBreakdown,
    archivedAt: new Date().toISOString()
  };
}

/**
 * Downloads a complete JSON archive of the raw documents before deletion
 */
export function downloadArchiveFile(data, fileName) {
  const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', jsonString);
  downloadAnchor.setAttribute('download', fileName);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Fetches all permanent yearly summaries from shops/{shopId}/yearly_summaries
 */
export async function getArchivedYearlySummaries(shopId) {
  if (!shopId) return [];
  try {
    const snap = await getDocs(collection(db, 'shops', shopId, 'yearly_summaries'));
    const list = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    return list;
  } catch (err) {
    console.warn("Could not fetch yearly_summaries:", err);
    return [];
  }
}

/**
 * Core function to:
 * 1. Read invoices up to cutoff date (or target year)
 * 2. Calculate and persist permanent financial rollup into shops/{shopId}/yearly_summaries/{year}
 * 3. Auto-download full JSON archive file
 * 4. Batch delete raw sales documents from Firestore
 */
export async function archiveAndPurgeSales({
  shopId,
  targetYear,
  cutoffDate,
  onProgress
}) {
  if (!shopId) throw new Error("Shop ID প্রয়োজন");

  if (onProgress) onProgress("ডেটাবেস থেকে পুরাতন ইনভয়েস লোড করা হচ্ছে...");

  // 1. Fetch Sales to archive
  const salesRef = collection(db, 'shops', shopId, 'sales');
  const salesSnap = await getDocs(salesRef);
  
  const salesToArchive = [];
  const cutoffTimestamp = cutoffDate ? new Date(cutoffDate).getTime() : null;

  salesSnap.forEach((docItem) => {
    const data = docItem.data();
    const d = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    const timeVal = d.getTime();

    if (!isNaN(timeVal)) {
      const docYear = String(d.getFullYear());
      let shouldInclude = false;

      if (targetYear && docYear === String(targetYear)) {
        shouldInclude = true;
      } else if (cutoffTimestamp && timeVal <= cutoffTimestamp) {
        shouldInclude = true;
      }

      if (shouldInclude) {
        salesToArchive.push({ id: docItem.id, ...data });
      }
    }
  });

  if (salesToArchive.length === 0) {
    throw new Error("নির্বাচিত সময়কালের কোনো ইনভয়েস পাওয়া যায়নি।");
  }

  if (onProgress) onProgress(`${salesToArchive.length} টি ইনভয়েসের আর্থিক সারসংক্ষেপ (Rollup) তৈরি হচ্ছে...`);

  // 2. Fetch Expenses for that period to pair accurately
  const expRef = collection(db, 'shops', shopId, 'expenses');
  const expSnap = await getDocs(expRef);
  const expensesToArchive = [];

  expSnap.forEach((docItem) => {
    const data = docItem.data();
    const d = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    const timeVal = d.getTime();

    if (!isNaN(timeVal)) {
      const docYear = String(d.getFullYear());
      if (targetYear && docYear === String(targetYear)) {
        expensesToArchive.push({ id: docItem.id, ...data });
      } else if (cutoffTimestamp && timeVal <= cutoffTimestamp) {
        expensesToArchive.push({ id: docItem.id, ...data });
      }
    }
  });

  // 3. Compute Permanent Financial Rollup
  const resolvedYear = targetYear || (cutoffDate ? new Date(cutoffDate).getFullYear() : 'Historical');
  const financialRollup = computeFinancialRollup(salesToArchive, expensesToArchive, resolvedYear);

  if (onProgress) onProgress("বাৎসরিক লেজারে আর্থিক সামারি স্থায়ীভাবে সংরক্ষণ হচ্ছে...");

  // 4. Save permanent Rollup Summary into Firestore
  const summaryDocRef = doc(db, 'shops', shopId, 'yearly_summaries', String(resolvedYear));
  await setDoc(summaryDocRef, {
    ...financialRollup,
    updatedAt: serverTimestamp()
  }, { merge: true });

  if (onProgress) onProgress("আপনার কম্পিউটারে পূর্ণাঙ্গ ব্যাকআপ JSON ফাইল ডাউনলোড হচ্ছে...");

  // 5. Trigger Automatic Full Backup Download
  const backupFileName = `MahinPOS_Archive_Sales_${resolvedYear}_${new Date().toISOString().slice(0, 10)}.json`;
  const archivePayload = {
    platform: 'MahinPOS',
    archiveType: 'Sales_Purge_Archive',
    shopId,
    year: resolvedYear,
    totalRecords: salesToArchive.length,
    financialSummary: financialRollup,
    invoices: salesToArchive
  };
  downloadArchiveFile(archivePayload, backupFileName);

  if (onProgress) onProgress(`ফায়ারবেস থেকে ${salesToArchive.length} টি ডকুমেন্ট ব্যাচ ডিলেট করা হচ্ছে...`);

  // 6. Delete raw documents in batches of 400 (Firestore limit is 500 per batch)
  const batchSize = 400;
  for (let i = 0; i < salesToArchive.length; i += batchSize) {
    const chunk = salesToArchive.slice(i, i + batchSize);
    const batch = writeBatch(db);
    chunk.forEach((s) => {
      batch.delete(doc(db, 'shops', shopId, 'sales', s.id));
    });
    await batch.commit();
    if (onProgress) onProgress(`${Math.min(i + batchSize, salesToArchive.length)} / ${salesToArchive.length} টি সম্পন্ন...`);
  }

  return {
    success: true,
    archivedCount: salesToArchive.length,
    year: resolvedYear,
    financialRollup,
    backupFileName
  };
}
