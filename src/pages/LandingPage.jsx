import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MdPointOfSale, 
  MdQrCodeScanner, 
  MdInventory2, 
  MdAccountBalanceWallet, 
  MdReceiptLong, 
  MdCardGiftcard,
  MdSpeed,
  MdCloudDone,
  MdCheckCircle,
  MdLock
} from 'react-icons/md';

const LandingPage = () => {
  return (
    <div style={{ minHeight: '100vh', background: '#090d16', color: '#f8fafc', fontFamily: "'Hind Siliguri', 'Inter', sans-serif" }}>
      {/* Navbar */}
      <nav style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb, #38bdf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: '800',
            fontSize: '18px',
            color: '#fff'
          }}>
            POS
          </div>
          <div>
            <span style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px' }}>Mahin<span style={{ color: '#38bdf8' }}>POS</span></span>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Cloud Multi-Tenant Retail ERP</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link 
            to="/mahinerp" 
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <MdLock size={14} /> সুপার এডমিন
          </Link>
          <Link 
            to="/poserp" 
            style={{
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              padding: '8px 20px',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '14px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
            }}
          >
            দোকান লগইন (Login)
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header style={{
        maxWidth: '1000px',
        margin: '60px auto 40px',
        padding: '0 24px',
        textAlign: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(37, 99, 235, 0.15)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          padding: '6px 16px',
          borderRadius: '30px',
          color: '#38bdf8',
          fontSize: '13px',
          fontWeight: '600',
          marginBottom: '24px'
        }}>
          ⚡ Cloudflare + Firebase চালিত আধুনিক ও দ্রুততম ক্লাউড POS
        </div>
        <h1 style={{
          fontSize: '44px',
          fontWeight: '800',
          lineHeight: '1.25',
          marginBottom: '20px',
          background: 'linear-gradient(180deg, #ffffff 40%, #94a3b8 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          আপনার সুপারশপ ও দোকানের আধুনিক ও দ্রুতগতির <br/>
          <span style={{ color: '#38bdf8', WebkitTextFillColor: '#38bdf8' }}>Point of Sale (POS)</span> ও ইনভেন্টরি সফটওয়্যার
        </h1>
        <p style={{
          fontSize: '18px',
          color: '#94a3b8',
          maxWidth: '750px',
          margin: '0 auto 36px',
          lineHeight: '1.6'
        }}>
          ১০০০+ পণ্যের তাৎক্ষণিক বারকোড সার্চ, ল্যাপটপ ও ডেক্সটপ ফ্রেন্ডলি কি-বোর্ড শর্টকাট, ৩ ধরনের ইনভয়েস (থার্মাল পিওএস, ক্যাশমেমো, এ৪), কাস্টমার লয়্যালটি রিওয়ার্ড পয়েন্টস ও লাভ-ক্ষতির সম্পূর্ণ হিসাব।
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Link 
            to="/poserp" 
            style={{
              background: '#2563eb',
              color: '#ffffff',
              padding: '14px 32px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: '700',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 20px rgba(37, 99, 235, 0.4)'
            }}
          >
            <MdPointOfSale size={20} />
            সিস্টেমে প্রবেশ করুন (Shop POS)
          </Link>
          <Link 
            to="/mahinerp" 
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#ffffff',
              padding: '14px 28px',
              borderRadius: '10px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            সুপার এডমিন কন্ট্রোল
          </Link>
        </div>
      </header>

      {/* Feature Cards Grid */}
      <section style={{
        maxWidth: '1200px',
        margin: '60px auto',
        padding: '0 24px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px'
      }}>
        {[
          {
            icon: <MdPointOfSale size={28} color="#38bdf8" />,
            title: "হাইপার ফাস্ট POS কাউন্টার",
            desc: "বারকোড স্ক্যানার দিয়ে নিমেষেই পণ্য স্ক্যান, কীবোর্ড শর্টকাট, একাধিক পেমেন্ট মেথড (ক্যাশ, বিকাশ, কার্ড, বাকি) এবং অটো চেঞ্জ ক্যালকুলেটর।"
          },
          {
            icon: <MdReceiptLong size={28} color="#34d399" />,
            title: "৩ ধরনের মাল্টি-ফরম্যাট ইনভয়েস",
            desc: "৫৮/৮০ মিমি থার্মাল রোল রিসিপ্ট, দেশীয় ঐতিহ্যবাহী ক্যাশ মেমো (সিল ও সাইন এরিয়া সহ), এবং এ৪ সাইজ অফিশিয়াল ইনভয়েস।"
          },
          {
            icon: <MdInventory2 size={28} color="#fbbf24" />,
            title: "১০০০+ পণ্য ও অটো স্টক এলার্ট",
            desc: "ক্রয়-বিক্রয় মূল্য ও পাইকারি মূল্য ট্র্যাকিং, বারকোড স্টিকার প্রিন্ট, এবং স্টক কমে গেলে সাথে সাথে ওয়ার্নিং নোটিফিকেশন।"
          },
          {
            icon: <MdCardGiftcard size={28} color="#f472b6" />,
            title: "কাস্টমার লয়্যালটি রিওয়ার্ড পয়েন্ট",
            desc: "প্রতি ক্রয়ে কাস্টমার পাবে পয়েন্ট যা পরবর্তী ক্রয়ে সরাসরি ক্যাশ ডিসকাউন্ট হিসেবে রিডিম করতে পারবে।"
          },
          {
            icon: <MdAccountBalanceWallet size={28} color="#a78bfa" />,
            title: "প্রকৃত লাভ-ক্ষতি ও খরচের হিসাব",
            desc: "ক্রয় মূল্য বনাম বিক্রয় মূল্য হিসেবে রিয়েল-টাইম গ্রস প্রফিট এবং দোকান ভাড়াসহ যাবতীয় খরচ বাদ দিয়ে নেট প্রফিট রিপোর্ট।"
          },
          {
            icon: <MdCloudDone size={28} color="#60a5fa" />,
            title: "মাল্টিটেন্যান্ট ক্লাউড আর্কিটেকচার",
            desc: "Firebase + Cloudflare চালিত। প্রতি দোকানের নিজস্ব সাবডোমেন বা কাস্টম ডোমেইন সাপোর্ট এবং সুপার এডমিন থেকে সেন্ট্রাল কন্ট্রোল।"
          }
        ].map((item, idx) => (
          <div key={idx} style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              background: 'rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {item.icon}
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#ffffff' }}>{item.title}</h3>
            <p style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '1.6' }}>{item.desc}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer style={{
        maxWidth: '1200px',
        margin: '60px auto 0',
        padding: '30px 24px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        textAlign: 'center',
        color: '#64748b',
        fontSize: '13px'
      }}>
        © 2026 Mahin POS Platform. All rights reserved. Built with Firebase & Cloudflare.
      </footer>
    </div>
  );
};

export default LandingPage;
