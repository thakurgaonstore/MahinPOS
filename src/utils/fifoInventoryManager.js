/**
 * FIFO (First-In, First-Out) Inventory & Batch Tracking Manager
 * 
 * Manages separate inventory batches/lots per product, ensuring that:
 * 1. Each purchase/restock preserves its specific purchase cost price.
 * 2. Sales and stock reductions deplete items from the oldest active batch first (FIFO).
 * 3. Cost of Goods Sold (COGS) and profit/loss are calculated on the exact batch cost.
 * 4. Full batch history (supplier, voucher, initial qty, remaining qty) is tracked.
 */

/**
 * Ensures a product has a valid batches array.
 * If legacy product without batches exists with stock > 0, creates an initial baseline batch.
 */
export function ensureProductBatches(product) {
  if (!product) return [];

  if (Array.isArray(product.batches) && product.batches.length > 0) {
    return product.batches.map((b, idx) => ({
      batchId: b.batchId || `BATCH-LEGACY-${product.id || 'P'}-${idx + 1}`,
      costPrice: Math.max(0, Number(b.costPrice) || 0),
      quantity: Math.max(0, Number(b.quantity) || 0),
      remainingQty: Math.max(0, Number(b.remainingQty ?? b.quantity) || 0),
      createdAt: b.createdAt || (product.createdAt?.toDate ? product.createdAt.toDate().toISOString() : new Date().toISOString()),
      supplierName: b.supplierName || product.supplierName || '',
      voucherNo: b.voucherNo || product.voucherNo || '',
      notes: b.notes || ''
    }));
  }

  const currentStock = Math.max(0, Number(product.stock) || 0);
  const costPrice = Math.max(0, Number(product.costPrice) || 0);

  if (currentStock > 0 || costPrice > 0) {
    return [
      {
        batchId: `BATCH-INIT-${product.id || Date.now()}`,
        costPrice: costPrice,
        quantity: currentStock,
        remainingQty: currentStock,
        createdAt: product.createdAt?.toDate 
          ? product.createdAt.toDate().toISOString() 
          : (typeof product.createdAt === 'string' ? product.createdAt : new Date().toISOString()),
        supplierName: product.supplierName || 'প্রারম্ভিক মজুদ / পূর্ববর্তী স্টক',
        voucherNo: 'INIT',
        notes: 'সিস্টেম প্রারম্ভিক স্টক রেকর্ড'
      }
    ];
  }

  return [];
}

/**
 * Appends a new purchase batch to the product's batch list.
 */
export function addBatchToProduct(existingBatches = [], {
  quantity,
  costPrice,
  supplierName = '',
  voucherNo = '',
  notes = '',
  createdAt
}) {
  const sanitizedQty = Math.max(0, Number(quantity) || 0);
  const sanitizedCost = Math.max(0, Number(costPrice) || 0);
  const currentList = Array.isArray(existingBatches) ? [...existingBatches] : [];

  if (sanitizedQty <= 0) return currentList;

  const newBatch = {
    batchId: `BATCH-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    costPrice: sanitizedCost,
    quantity: sanitizedQty,
    remainingQty: sanitizedQty,
    createdAt: createdAt || new Date().toISOString(),
    supplierName: String(supplierName || '').trim(),
    voucherNo: String(voucherNo || '').trim(),
    notes: String(notes || '').trim()
  };

  return [...currentList, newBatch];
}

/**
 * Depletes stock from batches in FIFO order (oldest active batch first).
 * 
 * Returns:
 * - updatedBatches: the batches array with updated remainingQty
 * - totalCost: exact total purchase cost for the depleted items
 * - unitCost: weighted unit purchase cost for this transaction
 * - allocations: array of batches and quantities consumed
 */
export function depleteBatchesFIFO(existingBatches = [], quantityToDeplete, fallbackCostPrice = 0) {
  const targetQty = Math.max(0, Number(quantityToDeplete) || 0);
  const fallbackCost = Math.max(0, Number(fallbackCostPrice) || 0);

  if (targetQty <= 0) {
    return {
      updatedBatches: existingBatches || [],
      totalCost: 0,
      unitCost: fallbackCost,
      allocations: []
    };
  }

  // Clone batches
  const batches = (existingBatches || []).map((b) => ({
    ...b,
    costPrice: Math.max(0, Number(b.costPrice) || 0),
    quantity: Math.max(0, Number(b.quantity) || 0),
    remainingQty: Math.max(0, Number(b.remainingQty ?? b.quantity) || 0)
  }));

  // Sort batches ascending by createdAt (oldest first)
  batches.sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime() || 0;
    const timeB = new Date(b.createdAt || 0).getTime() || 0;
    return timeA - timeB;
  });

  let remainingToDeplete = targetQty;
  let totalCost = 0;
  const allocations = [];

  for (const batch of batches) {
    if (remainingToDeplete <= 0) break;
    if (batch.remainingQty > 0) {
      const take = Math.min(batch.remainingQty, remainingToDeplete);
      batch.remainingQty = Math.round((batch.remainingQty - take) * 10000) / 10000;
      const batchCost = take * batch.costPrice;
      totalCost += batchCost;

      allocations.push({
        batchId: batch.batchId,
        costPrice: batch.costPrice,
        quantity: take,
        voucherNo: batch.voucherNo || '',
        supplierName: batch.supplierName || ''
      });

      remainingToDeplete = Math.round((remainingToDeplete - take) * 10000) / 10000;
    }
  }

  // Handle any excess / overflow if stock in batches was less than demanded
  if (remainingToDeplete > 0) {
    const excessCost = remainingToDeplete * fallbackCost;
    totalCost += excessCost;
    allocations.push({
      batchId: 'BATCH-OVERFLOW',
      costPrice: fallbackCost,
      quantity: remainingToDeplete,
      voucherNo: 'OVERFLOW',
      supplierName: 'স্টক ঘাটতি / ওভারফ্লো',
      isOverflow: true
    });
  }

  const roundedTotalCost = Math.round(totalCost * 100) / 100;
  const unitCost = targetQty > 0 ? Math.round((roundedTotalCost / targetQty) * 100) / 100 : fallbackCost;

  return {
    updatedBatches: batches,
    totalCost: roundedTotalCost,
    unitCost,
    allocations
  };
}

/**
 * Restores returned quantities back into inventory batches.
 */
export function restoreBatchStock(existingBatches = [], returnQty, fallbackCostPrice = 0, batchAllocations = []) {
  const qty = Math.max(0, Number(returnQty) || 0);
  if (qty <= 0) return existingBatches || [];

  const batches = (existingBatches || []).map((b) => ({ ...b }));

  // If specific batch allocations were recorded on the sale line, try restoring to them
  if (Array.isArray(batchAllocations) && batchAllocations.length > 0) {
    let unallocatedReturn = qty;
    // Iterate allocations in reverse (latest first)
    for (let i = batchAllocations.length - 1; i >= 0; i--) {
      if (unallocatedReturn <= 0) break;
      const alloc = batchAllocations[i];
      const matchBatch = batches.find((b) => b.batchId === alloc.batchId);
      if (matchBatch) {
        const canRestore = Math.max(0, (matchBatch.quantity || 0) - (matchBatch.remainingQty || 0));
        const toAdd = Math.min(canRestore, unallocatedReturn, alloc.quantity || unallocatedReturn);
        if (toAdd > 0) {
          matchBatch.remainingQty = Math.round(((matchBatch.remainingQty || 0) + toAdd) * 10000) / 10000;
          unallocatedReturn = Math.round((unallocatedReturn - toAdd) * 10000) / 10000;
        }
      }
    }

    if (unallocatedReturn <= 0) return batches;

    // Remaining unallocated returned qty added as return batch
    batches.push({
      batchId: `BATCH-RET-${Date.now()}`,
      costPrice: Number(fallbackCostPrice) || 0,
      quantity: unallocatedReturn,
      remainingQty: unallocatedReturn,
      createdAt: new Date().toISOString(),
      supplierName: 'কাস্টমার রিটার্ন',
      voucherNo: 'RETURN',
      notes: 'পণ্য ফেরতের মাধ্যমে স্টকে পুনঃসংযোজন'
    });
    return batches;
  }

  // Fallback: Add as a new return batch
  batches.push({
    batchId: `BATCH-RET-${Date.now()}`,
    costPrice: Number(fallbackCostPrice) || 0,
    quantity: qty,
    remainingQty: qty,
    createdAt: new Date().toISOString(),
    supplierName: 'কাস্টমার রিটার্ন',
    voucherNo: 'RETURN',
    notes: 'পণ্য ফেরতের মাধ্যমে স্টকে পুনঃসংযোজন'
  });

  return batches;
}

/**
 * Calculates accurate FIFO valuation and batch statistics for a product.
 */
export function calculateProductValuation(product) {
  if (!product) {
    return {
      totalStock: 0,
      totalCostValue: 0,
      activeBatches: [],
      depletedBatches: [],
      activeBatchesCount: 0
    };
  }

  const batches = ensureProductBatches(product);
  const activeBatches = batches.filter((b) => Number(b.remainingQty) > 0);
  const depletedBatches = batches.filter((b) => Number(b.remainingQty) <= 0);

  if (batches.length > 0) {
    const totalStock = activeBatches.reduce((sum, b) => sum + (Number(b.remainingQty) || 0), 0);
    const totalCostValue = activeBatches.reduce((sum, b) => {
      return sum + ((Number(b.remainingQty) || 0) * (Number(b.costPrice) || 0));
    }, 0);

    return {
      totalStock: Math.round(totalStock * 1000) / 1000,
      totalCostValue: Math.round(totalCostValue * 100) / 100,
      activeBatches,
      depletedBatches,
      activeBatchesCount: activeBatches.length
    };
  }

  // Fallback if no batches
  const fallbackStock = Math.max(0, Number(product.stock) || 0);
  const fallbackCost = Math.max(0, Number(product.costPrice) || 0);

  return {
    totalStock: fallbackStock,
    totalCostValue: Math.round(fallbackStock * fallbackCost * 100) / 100,
    activeBatches: [],
    depletedBatches: [],
    activeBatchesCount: 0
  };
}
