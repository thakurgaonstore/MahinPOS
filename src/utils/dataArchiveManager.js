import { db } from '../firebase/config';
import * as XLSX from 'xlsx';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  setDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { getTxTimestamp } from './ledgerManager';

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

  if (salesToArchive.length === 0 && expensesToArchive.length === 0) {
    // Still check if ledgers or stock_logs have data before failing
    const suppCheck = await getDocs(collection(db, 'shops', shopId, 'supplier_transactions'));
    const custCheck = await getDocs(collection(db, 'shops', shopId, 'customer_transactions'));
    if (suppCheck.empty && custCheck.empty) {
      throw new Error("নির্বাচিত সময়কালের কোনো ইনভয়েস, খরচ বা লেজার লেনদেন পাওয়া যায়নি।");
    }
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

  // 5. Rollover Ledgers & Collect Stock Logs for Unified Excel Export
  let ledgerResult = null;
  try {
    ledgerResult = await rolloverAndArchiveLedgers({
      shopId,
      targetYear: resolvedYear,
      cutoffDate,
      skipJsonDownload: true,
      onProgress
    });
  } catch (err) {
    console.warn("Ledger rollover notice:", err);
  }

  // Also fetch old stock_logs up to targetYear/cutoffDate
  const stockLogsSnap = await getDocs(collection(db, 'shops', shopId, 'stock_logs'));
  const stockLogsToArchive = [];
  stockLogsSnap.forEach((docItem) => {
    const data = docItem.data();
    const timeVal = getTxTimestamp(data);
    if (timeVal > 0) {
      const docYear = String(new Date(timeVal).getFullYear());
      if ((targetYear && docYear === String(targetYear)) || (cutoffTimestamp && timeVal <= cutoffTimestamp)) {
        stockLogsToArchive.push({ id: docItem.id, ...data });
      }
    }
  });

  if (onProgress) onProgress("সম্পূর্ণ ডাটা এক্সেল (.xlsx) ফাইলে ডাউনলোড হচ্ছে...");

  // Generate Multi-Sheet Excel (.xlsx) Backup
  const wb = XLSX.utils.book_new();

  // Sheet 1: Financial Summary
  const summarySheetData = [
    { 'বিবরণ (Metric)': 'আর্কাইভকৃত বছর / সময়', 'মান (Value)': String(resolvedYear) },
    { 'বিবরণ (Metric)': 'মোট ইনভয়েস সংখ্যা', 'মান (Value)': financialRollup.totalInvoices },
    { 'বিবরণ (Metric)': 'মোট বিক্রয় (Gross Revenue)', 'মান (Value)': financialRollup.grossRevenue },
    { 'বিবরণ (Metric)': 'মোট রিটার্ন (Returns)', 'মান (Value)': financialRollup.totalReturns },
    { 'বিবরণ (Metric)': 'নিট বিক্রয় (Net Revenue)', 'মান (Value)': financialRollup.netRevenue },
    { 'বিবরণ (Metric)': 'ক্রয় খরচ (COGS)', 'মান (Value)': financialRollup.totalCostOfGoods },
    { 'বিবরণ (Metric)': 'মোট লাভ (Gross Profit)', 'মান (Value)': financialRollup.grossProfit },
    { 'বিবরণ (Metric)': 'মোট দোকান খরচ (Expenses)', 'মান (Value)': financialRollup.totalExpenses },
    { 'বিবরণ (Metric)': 'প্রকৃত নিট লাভ (Net Profit)', 'মান (Value)': financialRollup.netProfit }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summarySheetData), 'Financial_Summary');

  // Sheet 2: Sales Invoices
  const salesSheetData = salesToArchive.map((s) => ({
    'ইনভয়েস নং': s.invoiceNo || s.id,
    'তারিখ': getTxTimestamp(s) ? new Date(getTxTimestamp(s)).toLocaleString('en-GB') : '',
    'কাস্টমার': s.customerName || 'সাধারণ ক্রেতা',
    'মোবাইল': s.customerPhone || '',
    'সাবটোটাল': Number(s.subtotal) || 0,
    'ডিসকাউন্ট': Number(s.discountAmount) || 0,
    'মোট বিল': Number(s.grandTotal) || 0,
    'পরিশোধ': Number(s.paidAmount) || 0,
    'বাকি': Number(s.dueAmount) || 0,
    'পেমেন্ট মেথড': s.paymentMethod || 'Cash'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesSheetData.length ? salesSheetData : [{ 'তথ্য': 'কোনো ইনভয়েস নেই' }]), 'Sales_Invoices');

  // Sheet 3: Expenses
  const expensesSheetData = expensesToArchive.map((e) => ({
    'তারিখ': getTxTimestamp(e) ? new Date(getTxTimestamp(e)).toLocaleString('en-GB') : '',
    'খরচের বিবরণ': e.title || '',
    'ক্যাটাগরি': e.category || '',
    'টাকা': Number(e.amount) || 0,
    'পেমেন্ট মাধ্যম': e.paymentMethod || 'Cash',
    'নোট': e.note || ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expensesSheetData.length ? expensesSheetData : [{ 'তথ্য': 'কোনো খরচ নেই' }]), 'Expenses');

  // Sheet 4 & 5 & 6: Supplier Ledger, Customer Ledger, Opening Balances (B/F)
  const suppTxRows = (ledgerResult?.suppTxToArchive || []).map((t) => ({
    'তারিখ': getTxTimestamp(t) ? new Date(getTxTimestamp(t)).toLocaleString('en-GB') : '',
    'মহাজন / সাপ্লায়ার': t.supplierName || '',
    'ধরন': t.type || '',
    'ভাউচার নং': t.voucherNo || '',
    'চালান বিল': Number(t.billAmount) || 0,
    'পরিশোধ': Number(t.paidAmount) || 0,
    'বাকি পরিবর্তন': Number(t.dueAmount) || 0,
    'নোট': t.note || ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(suppTxRows.length ? suppTxRows : [{ 'তথ্য': 'কোনো মহাজন লেনদেন নেই' }]), 'Supplier_Ledger');

  const custTxRows = (ledgerResult?.custTxToArchive || []).map((t) => ({
    'তারিখ': getTxTimestamp(t) ? new Date(getTxTimestamp(t)).toLocaleString('en-GB') : '',
    'কাস্টমার': t.customerName || '',
    'মোবাইল': t.customerPhone || '',
    'ধরন': t.type || '',
    'ইনভয়েস নং': t.invoiceNo || '',
    'বিক্রয় বিল': Number(t.billAmount) || 0,
    'পরিশোধ': Number(t.paidAmount) || 0,
    'বাকি পরিবর্তন': Number(t.dueAmount) || 0,
    'নোট': t.note || ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(custTxRows.length ? custTxRows : [{ 'তথ্য': 'কোনো কাস্টমার লেনদেন নেই' }]), 'Customer_Ledger');

  const bfRows = [];
  Object.values(ledgerResult?.supplierBalancesMap || {}).forEach((s) => {
    if (Math.round(s.netDue * 100) / 100 !== 0) {
      bfRows.push({ 'খাতা ধরন': 'মহাজন (Supplier)', 'নাম': s.supplierName, 'নতুন বছরের শুরুর জের (B/F)': Math.round(s.netDue * 100) / 100 });
    }
  });
  Object.values(ledgerResult?.customerBalancesMap || {}).forEach((c) => {
    if (Math.round(c.netDue * 100) / 100 !== 0) {
      bfRows.push({ 'খাতা ধরন': 'কাস্টমার (Customer)', 'নাম': c.customerName, 'নতুন বছরের শুরুর জের (B/F)': Math.round(c.netDue * 100) / 100 });
    }
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bfRows.length ? bfRows : [{ 'তথ্য': 'কোনো প্রারম্ভিক জের নেই' }]), 'Opening_Balances_BF');

  // Sheet 7: Stock Restock Logs
  const stockSheetData = stockLogsToArchive.map((l) => ({
    'তারিখ': getTxTimestamp(l) ? new Date(getTxTimestamp(l)).toLocaleString('en-GB') : '',
    'পণ্যের নাম': l.productName || '',
    'পরিমাণ': Number(l.addedQuantity) || 0,
    'ক্রয় দর': Number(l.purchaseCostPrice) || 0,
    'মোট খরচ': Number(l.batchTotalCost) || 0,
    'মহাজন': l.supplierName || '',
    'ভাউচার': l.voucherNo || ''
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockSheetData.length ? stockSheetData : [{ 'তথ্য': 'কোনো রিস্টক লগ নেই' }]), 'Stock_Restock_Logs');

  const backupFileName = `MahinPOS_Archive_${resolvedYear}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, backupFileName);

  if (onProgress) onProgress(`ডাটাবেস থেকে ${salesToArchive.length} টি ইনভয়েস, ${expensesToArchive.length} টি খরচ ও ${stockLogsToArchive.length} টি রিস্টক লগ ডিলিট করা হচ্ছে...`);

  // 6. Delete raw documents in batches of 400 (Firestore limit is 500 per batch)
  const batchSize = 400;
  for (let i = 0; i < salesToArchive.length; i += batchSize) {
    const chunk = salesToArchive.slice(i, i + batchSize);
    const batch = writeBatch(db);
    chunk.forEach((s) => {
      batch.delete(doc(db, 'shops', shopId, 'sales', s.id));
    });
    await batch.commit();
    if (onProgress) onProgress(`${Math.min(i + batchSize, salesToArchive.length)} / ${salesToArchive.length} টি ইনভয়েস সম্পন্ন...`);
  }

  for (let i = 0; i < expensesToArchive.length; i += batchSize) {
    const chunk = expensesToArchive.slice(i, i + batchSize);
    const batch = writeBatch(db);
    chunk.forEach((e) => {
      batch.delete(doc(db, 'shops', shopId, 'expenses', e.id));
    });
    await batch.commit();
  }

  for (let i = 0; i < stockLogsToArchive.length; i += batchSize) {
    const chunk = stockLogsToArchive.slice(i, i + batchSize);
    const batch = writeBatch(db);
    chunk.forEach((l) => {
      batch.delete(doc(db, 'shops', shopId, 'stock_logs', l.id));
    });
    await batch.commit();
  }

  return {
    success: true,
    archivedCount: salesToArchive.length,
    year: resolvedYear,
    financialRollup,
    backupFileName,
    ledgerResult
  };
}

/**
 * Archives raw supplier & customer ledger transactions for a target year/cutoff,
 * carries forward the exact ending balances as "পূর্বের জের (Opening Balance B/F)" for the new year,
 * and purges old individual transactions from Firestore.
 */
export async function rolloverAndArchiveLedgers({
  shopId,
  targetYear,
  cutoffDate,
  skipJsonDownload = false,
  onProgress
}) {
  if (!shopId) throw new Error("Shop ID প্রয়োজন");

  const resolvedYear = Number(targetYear) || (cutoffDate ? new Date(cutoffDate).getFullYear() : new Date().getFullYear() - 1);
  const nextYear = resolvedYear + 1;
  const cutoffTimestamp = cutoffDate ? new Date(cutoffDate).getTime() : new Date(resolvedYear, 11, 31, 23, 59, 59).getTime();

  if (onProgress) onProgress("মহাজন ও কাস্টমার খাতার পুরাতন লেনদেন স্ক্যান করা হচ্ছে...");

  // 1. Fetch Supplier Transactions to archive
  const suppTxSnap = await getDocs(collection(db, 'shops', shopId, 'supplier_transactions'));
  const suppTxToArchive = [];
  const supplierBalancesMap = {};

  suppTxSnap.forEach((docItem) => {
    const data = docItem.data();
    const timeVal = getTxTimestamp(data);

    if (timeVal > 0 && timeVal <= cutoffTimestamp) {
      suppTxToArchive.push({ id: docItem.id, ...data });
      const sId = data.supplierId;
      if (sId) {
        if (!supplierBalancesMap[sId]) {
          supplierBalancesMap[sId] = {
            supplierId: sId,
            supplierName: data.supplierName || '',
            supplierCompany: data.supplierCompany || '',
            supplierPhone: data.supplierPhone || '',
            netDue: 0
          };
        }
        supplierBalancesMap[sId].netDue += (Number(data.dueAmount) || 0);
      }
    }
  });

  // 2. Fetch Customer Transactions to archive
  const custTxSnap = await getDocs(collection(db, 'shops', shopId, 'customer_transactions'));
  const custTxToArchive = [];
  const customerBalancesMap = {};

  custTxSnap.forEach((docItem) => {
    const data = docItem.data();
    const timeVal = getTxTimestamp(data);

    if (timeVal > 0 && timeVal <= cutoffTimestamp) {
      custTxToArchive.push({ id: docItem.id, ...data });
      const cId = data.customerId;
      if (cId) {
        if (!customerBalancesMap[cId]) {
          customerBalancesMap[cId] = {
            customerId: cId,
            customerName: data.customerName || '',
            customerPhone: data.customerPhone || '',
            netDue: 0
          };
        }
        customerBalancesMap[cId].netDue += (Number(data.dueAmount) || 0);
      }
    }
  });

  if (onProgress) onProgress(`নতুন বছর ${nextYear} এর জন্য প্রারম্ভিক জের (Opening Balance B/F) তৈরি করা হচ্ছে...`);

  // 3. Insert permanent Opening Balance (B/F) for Suppliers into the new year
  for (const sId of Object.keys(supplierBalancesMap)) {
    const sInfo = supplierBalancesMap[sId];
    const roundedDue = Math.round(sInfo.netDue * 100) / 100;
    if (roundedDue !== 0) {
      await addDoc(collection(db, 'shops', shopId, 'supplier_transactions'), {
        supplierId: sId,
        supplierName: sInfo.supplierName,
        supplierCompany: sInfo.supplierCompany || '',
        supplierPhone: sInfo.supplierPhone || '',
        type: 'opening_balance',
        billAmount: 0,
        paidAmount: 0,
        dueAmount: roundedDue,
        voucherNo: 'B/F',
        note: `${resolvedYear} সাল সমাপনী পরবর্তী ${nextYear} সালের প্রারম্ভিক বকেয়া জের (Balance B/F)`,
        year: nextYear,
        date: new Date(nextYear, 0, 1, 0, 0, 0).toISOString(),
        createdAt: serverTimestamp(),
        recordedBy: 'System Rollover'
      });
    }
  }

  // 4. Insert permanent Opening Balance (B/F) for Customers into the new year
  for (const cId of Object.keys(customerBalancesMap)) {
    const cInfo = customerBalancesMap[cId];
    const roundedDue = Math.round(cInfo.netDue * 100) / 100;
    if (roundedDue !== 0) {
      await addDoc(collection(db, 'shops', shopId, 'customer_transactions'), {
        customerId: cId,
        customerName: cInfo.customerName,
        customerPhone: cInfo.customerPhone,
        type: 'opening_balance',
        billAmount: 0,
        paidAmount: 0,
        dueAmount: roundedDue,
        invoiceNo: 'B/F',
        note: `${resolvedYear} সাল সমাপনী পরবর্তী ${nextYear} সালের প্রারম্ভিক বাকি জের (Balance B/F)`,
        year: nextYear,
        date: new Date(nextYear, 0, 1, 0, 0, 0).toISOString(),
        createdAt: serverTimestamp(),
        recordedBy: 'System Rollover'
      });
    }
  }

  // 5. Download Backup JSON of Ledger Transactions (if requested)
  let ledgerBackupFileName = null;
  if (!skipJsonDownload && (suppTxToArchive.length > 0 || custTxToArchive.length > 0)) {
    ledgerBackupFileName = `MahinPOS_Ledger_Archive_${resolvedYear}_${new Date().toISOString().slice(0, 10)}.json`;
    const ledgerPayload = {
      platform: 'MahinPOS',
      archiveType: 'Ledgers_Purge_Archive_With_Balance_BF',
      shopId,
      year: resolvedYear,
      nextYearOpening: nextYear,
      totalSupplierTx: suppTxToArchive.length,
      totalCustomerTx: custTxToArchive.length,
      supplierCarriedBalances: supplierBalancesMap,
      customerCarriedBalances: customerBalancesMap,
      supplierTransactions: suppTxToArchive,
      customerTransactions: custTxToArchive
    };
    downloadArchiveFile(ledgerPayload, ledgerBackupFileName);
  }

  if (onProgress) onProgress(`পুরাতন লেজার ট্রানজ্যাকশন ক্লিন করা হচ্ছে...`);

  // 6. Delete old supplier transactions in batches of 400
  const batchSize = 400;
  for (let i = 0; i < suppTxToArchive.length; i += batchSize) {
    const chunk = suppTxToArchive.slice(i, i + batchSize);
    const batch = writeBatch(db);
    chunk.forEach((t) => {
      batch.delete(doc(db, 'shops', shopId, 'supplier_transactions', t.id));
    });
    await batch.commit();
  }

  // 7. Delete old customer transactions in batches of 400
  for (let i = 0; i < custTxToArchive.length; i += batchSize) {
    const chunk = custTxToArchive.slice(i, i + batchSize);
    const batch = writeBatch(db);
    chunk.forEach((t) => {
      batch.delete(doc(db, 'shops', shopId, 'customer_transactions', t.id));
    });
    await batch.commit();
  }

  return {
    success: true,
    archivedSupplierTxCount: suppTxToArchive.length,
    archivedCustomerTxCount: custTxToArchive.length,
    suppliersCount: Object.keys(supplierBalancesMap).length,
    customersCount: Object.keys(customerBalancesMap).length,
    ledgerBackupFileName,
    suppTxToArchive,
    custTxToArchive,
    supplierBalancesMap,
    customerBalancesMap
  };
}
