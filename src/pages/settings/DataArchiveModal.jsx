import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { archiveAndPurgeSales } from '../../utils/dataArchiveManager';
import { toast } from 'react-hot-toast';
import {
  MdClose,
  MdDeleteSweep,
  MdSecurity,
  MdCloudDownload,
  MdWarning,
  MdCheckCircle,
  MdInfo
} from 'react-icons/md';

const DataArchiveModal = ({ shopId, onClose, onSuccess }) => {
  const currentYear = new Date().getFullYear();
  const [archiveMode, setArchiveMode] = useState('year'); // 'year' | 'one_year_old' | 'custom_date'
  const [selectedYear, setSelectedYear] = useState(String(currentYear - 1));
  const [isCustomYearInput, setIsCustomYearInput] = useState(false);
  const [customYearValue, setCustomYearValue] = useState('');
  const [customCutoffDate, setCustomCutoffDate] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  // Dynamically detected years from Firestore
  const [detectedYearsMap, setDetectedYearsMap] = useState({});
  const [loadingDetectedYears, setLoadingDetectedYears] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    const fetchExistingYears = async () => {
      try {
        setLoadingDetectedYears(true);
        const snap = await getDocs(collection(db, 'shops', shopId, 'sales'));
        const counts = {};
        snap.forEach((docItem) => {
          const d = docItem.data();
          const dateObj = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt);
          if (!isNaN(dateObj.getTime())) {
            const yr = String(dateObj.getFullYear());
            counts[yr] = (counts[yr] || 0) + 1;
          }
        });
        setDetectedYearsMap(counts);

        // If detected years exist and previous year isn't present, default to earliest detected year or current - 1
        const detectedKeys = Object.keys(counts).sort((a, b) => Number(b) - Number(a));
        if (detectedKeys.length > 0 && !counts[String(currentYear - 1)]) {
          setSelectedYear(detectedKeys[0]);
        }
      } catch (err) {
        console.warn("Could not scan sales years:", err);
      } finally {
        setLoadingDetectedYears(false);
      }
    };
    fetchExistingYears();
  }, [shopId, currentYear]);

  // Build a rich, dynamic list of years spanning future (up to currentYear + 10) and past down to 2020
  const dynamicYearsRange = [];
  const startYr = currentYear + 10; // e.g. 2036
  const endYr = 2020;
  for (let y = startYr; y >= endYr; y--) {
    dynamicYearsRange.push(String(y));
  }
  // Ensure any detected year from database is included
  Object.keys(detectedYearsMap).forEach((dy) => {
    if (!dynamicYearsRange.includes(dy)) {
      dynamicYearsRange.push(dy);
    }
  });
  dynamicYearsRange.sort((a, b) => Number(b) - Number(a));

  const resolvedTargetYear = isCustomYearInput ? customYearValue.trim() : selectedYear;
  const currentSelectedCount = detectedYearsMap[resolvedTargetYear] || 0;

  const handleStartPurge = async (e) => {
    e.preventDefault();

    if (confirmText.trim().toUpperCase() !== 'ARCHIVE') {
      toast.error('নিশ্চিত করতে ইনপুট বক্সে সঠিকভাবে "ARCHIVE" লিখুন');
      return;
    }

    if (archiveMode === 'year' && isCustomYearInput && (!customYearValue || isNaN(Number(customYearValue)))) {
      toast.error('অনুগ্রহ করে সঠিক সাল লিখুন (যেমন: ২০৩০ বা ২০৩৫)');
      return;
    }

    setLoading(true);
    setProgressMsg('আর্কাইভ প্রস্তুত করা হচ্ছে...');

    try {
      let targetYear = null;
      let cutoffDate = null;

      if (archiveMode === 'year') {
        targetYear = resolvedTargetYear;
      } else if (archiveMode === 'one_year_old') {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        cutoffDate = oneYearAgo.toISOString().slice(0, 10);
      } else if (archiveMode === 'custom_date') {
        if (!customCutoffDate) {
          toast.error('অনুগ্রহ করে শেষ তারিখ নির্বাচন করুন');
          setLoading(false);
          return;
        }
        cutoffDate = customCutoffDate;
      }

      const res = await archiveAndPurgeSales({
        shopId,
        targetYear,
        cutoffDate,
        onProgress: (msg) => setProgressMsg(msg)
      });

      toast.success(
        `সফল! ${res.archivedCount} টি ইনভয়েস মুছে ডাটাবেস খালি হয়েছে এবং ${res.year} সালের আর্থিক সামারি স্থায়ীভাবে সংরক্ষিত হয়েছে!`,
        { duration: 6000 }
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Purge archive error:", err);
      toast.error(err.message || 'আর্কাইভ ও ক্লিনআপ করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 120,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      backdropFilter: 'blur(3px)'
    }}>
      <div style={{
        background: '#ffffff',
        width: '100%',
        maxWidth: '650px',
        maxHeight: '92vh',
        overflowY: 'auto',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ background: '#fef2f2', color: '#dc2626', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center' }}>
              <MdDeleteSweep size={24} />
            </span>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                পুরাতন ইনভয়েস আর্কাইভ ও ডাটাবেস খালি করুন
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
                আর্থিক হিসাব অক্ষুণ্ণ রেখে পুরাতন ডাটা ব্যাকআপ ও ডাটাবেজ গতিশীল রাখার সমাধান
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
          >
            <MdClose size={18} />
          </button>
        </div>

        {/* Feature Highlights Card */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '14px 16px',
          marginBottom: '18px',
          fontSize: '12px',
          color: '#1e3a8a',
          lineHeight: '1.6'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '800', fontSize: '13px', marginBottom: '6px', color: '#1d4ed8' }}>
            <MdSecurity size={18} /> এই প্রক্রিয়ায় আপনার আর্থিক হিসাবের শতভাগ নিশ্চয়তা:
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>
            <li>
              <b>স্থায়ী বাৎসরিক লেজার সামারি:</b> ডিলিট হওয়ার পূর্বে ওই বছরের মোট বিক্রয়, মোট লাভ, ক্রয় খরচ (COGS) ও খরচের হিসাব স্থায়ী সামারি হিসেবে সংরক্ষিত হবে। ফলে বাৎসরিক ও সর্বমোট রিপোর্টে কোনো পার্থক্য হবে না।
            </li>
            <li>
              <b>স্বয়ংক্রিয় ব্যাকআপ ডাউনলোড:</b> ডিলিট হওয়ার পূর্বেই সমস্ত ইনভয়েসের পূর্ণাঙ্গ কপি আপনার পিসিতে `.json` ফাইল হিসেবে স্বয়ংক্রিয়ভাবে ডাউনলোড হয়ে যাবে।
            </li>
            <li>
              <b>ডাটাবেজ ১০০% গতিশীল ও হালকা থাকবে:</b> মেমরি সাশ্রয় হবে এবং সফটওয়্যার সুপার-ফাস্ট গতিতে লোড হবে।
            </li>
          </ul>
        </div>

        <form onSubmit={handleStartPurge}>
          {/* Archive Mode Selector */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
              কোন সময়কালের ইনভয়েস আর্কাইভ করতে চান?
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
              {[
                { id: 'year', label: 'নির্দিষ্ট এক বছর (Year-wise)', desc: 'যেমন: ২০২৫ বা ২০২৪ সাল' },
                { id: 'one_year_old', label: '১ বছরের পুরাতন সকল ইনভয়েস', desc: 'আজকের তারিখ থেকে ১ বছর আগের' },
                { id: 'custom_date', label: 'নির্দিষ্ট তারিখের পূর্বের ইনভয়েস', desc: 'নির্দিষ্ট তারিখ পর্যন্ত' }
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => !loading && setArchiveMode(opt.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: archiveMode === opt.id ? '#2563eb' : '#cbd5e1',
                    background: archiveMode === opt.id ? '#f0fdf4' : '#ffffff',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  <div style={{ fontWeight: '700', fontSize: '12px', color: archiveMode === opt.id ? '#059669' : '#0f172a' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Input based on Mode */}
          {archiveMode === 'year' && (
            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                  যে বছরের ইনভয়েস ডিলিট ও আর্কাইভ করতে চান:
                </label>
                <button
                  type="button"
                  onClick={() => setIsCustomYearInput(!isCustomYearInput)}
                  style={{
                    border: 'none',
                    background: 'none',
                    color: '#2563eb',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  {isCustomYearInput ? '← তালিকা থেকে বেছে নিন' : 'অন্য সাল লিখুন (যেমন ২০৩০, ২০৩৫)'}
                </button>
              </div>

              {!isCustomYearInput ? (
                <>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    disabled={loading}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '14px', fontWeight: '700', background: '#fff' }}
                  >
                    {/* Detected Years First */}
                    {Object.keys(detectedYearsMap).length > 0 && (
                      <optgroup label="📋 ডেটাবেসে পাওয়া গেছে (Detected in Database)">
                        {Object.keys(detectedYearsMap).sort((a, b) => Number(b) - Number(a)).map((yr) => (
                          <option key={`detected-${yr}`} value={yr}>
                            {yr} সাল ({detectedYearsMap[yr]} টি ইনভয়েস বিদ্যমান)
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {/* All dynamic years */}
                    <optgroup label="📅 সকল সাল (Dynamic Range 2036 - 2020)">
                      {dynamicYearsRange.map((yr) => (
                        <option key={`range-${yr}`} value={yr}>
                          {yr} সাল {detectedYearsMap[yr] ? `(${detectedYearsMap[yr]} টি ইনভয়েস)` : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="number"
                    min="2000"
                    max="2099"
                    placeholder="সাল লিখুন (যেমন: 2030 বা 2035)"
                    value={customYearValue}
                    onChange={(e) => setCustomYearValue(e.target.value)}
                    disabled={loading}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: '6px', border: '1px solid #2563eb', fontSize: '14px', fontWeight: '700' }}
                  />
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#64748b' }}>সাল</span>
                </div>
              )}

              {/* Real-time Document Count Feedback */}
              <div style={{ marginTop: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {loadingDetectedYears ? (
                  <span style={{ color: '#64748b' }}>ফায়ারবেস থেকে ইনভয়েসের সাল স্ক্যান হচ্ছে...</span>
                ) : currentSelectedCount > 0 ? (
                  <span style={{ color: '#059669', fontWeight: '700', background: '#ecfdf5', padding: '3px 8px', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                    ✓ নির্বাচিত {resolvedTargetYear} সালে মোট {currentSelectedCount} টি ইনভয়েস পাওয়া গেছে যা আর্কাইভ করা হবে।
                  </span>
                ) : (
                  <span style={{ color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                    ℹ️ নির্বাচিত {resolvedTargetYear} সালে বর্তমানে ফায়ারবেসে কোনো ইনভয়েস পাওয়া যায়নি।
                  </span>
                )}
              </div>
            </div>
          )}

          {archiveMode === 'custom_date' && (
            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                যে তারিখ পর্যন্ত সকল ইনভয়েস মুছে ফেলতে চান:
              </label>
              <input
                type="date"
                required
                value={customCutoffDate}
                onChange={(e) => setCustomCutoffDate(e.target.value)}
                disabled={loading}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #94a3b8', fontSize: '13px' }}
              />
            </div>
          )}

          {/* Red Safety Warning & Confirmation */}
          <div style={{
            background: '#fff5f5',
            border: '2px solid #fecaca',
            borderRadius: '12px',
            padding: '14px 16px',
            marginBottom: '18px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontWeight: '800', fontSize: '13px', marginBottom: '6px' }}>
              <MdWarning size={18} /> নিরাপত্তা যাচাই (Safety Confirmation):
            </div>
            <p style={{ fontSize: '12px', color: '#475569', margin: '0 0 10px 0' }}>
              নির্বাচিত ইনভয়েসগুলো মুছে ফেলার আগে আপনার পিসিতে একটি ব্যাকআপ JSON ফাইল ডাউনলোড হবে। নিশ্চিত হলে নিচের ঘরে বড় হাতের অক্ষরে <b>ARCHIVE</b> টাইপ করুন:
            </p>
            <input
              type="text"
              required
              disabled={loading}
              placeholder='লিখুন: ARCHIVE'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #dc2626',
                fontSize: '14px',
                fontWeight: '800',
                letterSpacing: '1px',
                outline: 'none',
                background: '#ffffff'
              }}
            />
          </div>

          {/* Progress Message */}
          {loading && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#065f46',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span className="spinner" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid #059669', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
              {progressMsg || 'কাজ চলছে, অনুগ্রহ করে অপেক্ষা করুন...'}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '10px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading || confirmText.trim().toUpperCase() !== 'ARCHIVE'}
              style={{
                padding: '10px 22px',
                borderRadius: '8px',
                border: 'none',
                background: confirmText.trim().toUpperCase() === 'ARCHIVE' && !loading ? '#dc2626' : '#cbd5e1',
                color: '#ffffff',
                fontWeight: '800',
                fontSize: '13px',
                cursor: confirmText.trim().toUpperCase() === 'ARCHIVE' && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: confirmText.trim().toUpperCase() === 'ARCHIVE' && !loading ? '0 4px 6px -1px rgba(220,38,38,0.3)' : 'none'
              }}
            >
              <MdDeleteSweep size={18} />
              {loading ? 'প্রসেস হচ্ছে...' : 'আর্কাইভ ও ডাটাবেস খালি করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DataArchiveModal;
