import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom';
import { differenceInHours, differenceInMinutes, parseISO } from 'date-fns';

const getClientHash = () => {
  let hash = localStorage.getItem('clientHash');
  if (!hash) {
    hash = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('clientHash', hash);
  }
  return hash;
};

const clientHash = getClientHash();

const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
  </svg>
);

const ThumbIcon = ({ up, filled }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: up ? 'none' : 'rotate(180deg)' }}>
    <path d="M7 11l5-8c1.5 0 2.5 1 2.2 2.6L13.5 9H19a2 2 0 011.9 2.6l-2 7A2 2 0 0117 20H7z"/><path d="M3 11h4v9H3z"/>
  </svg>
);

const AppFrame = ({ children, className = "", style }) => (
  <main className={`app ${className}`} style={style}>
    {children}
  </main>
);

function StartScreen() {
  const navigate = useNavigate();
  
  const handleStartClick = () => {
    // If they already accepted the TOS, jump straight to write. Otherwise go to legal.
    if (localStorage.getItem('rant_tos_accepted') === 'true') {
      navigate('/write');
    } else {
      navigate('/legal');
    }
  };

  return (
    <AppFrame className="start">
      <button className="start-btn btn" onClick={handleStartClick}>
        <span className="script">rant</span>
      </button>
      <div className="arrows" onClick={() => navigate('/feed')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
      </div>
    </AppFrame>
  );
}

function FeedScreen() {
  const navigate = useNavigate();
  const [rants, setRants] = useState([]);
  const [tab, setTab] = useState('fresh'); // fresh, hot, ending

  const fetchRants = async () => {
    try {
      const res = await fetch('/api/rants?page=0&size=50');
      if (res.ok) {
        const data = await res.json();
        setRants(data.content);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRants();
    const interval = setInterval(fetchRants, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleVote = async (id, type) => {
    try {
      const res = await fetch(`/api/rants/${id}/reaction`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Client-Hash': clientHash },
        body: JSON.stringify({ type })
      });
      if (res.ok) fetchRants();
    } catch (err) {
      console.error(err);
    }
  };

  // Sorting logic based on tabs
  const displayedRants = [...rants].sort((a, b) => {
    if (tab === 'hot') {
      return (b.likeCount - b.dislikeCount) - (a.likeCount - a.dislikeCount);
    } else if (tab === 'ending') {
      return parseISO(a.expiresAt).getTime() - parseISO(b.expiresAt).getTime();
    }
    // fresh (default)
    return parseISO(b.expiresAt).getTime() - parseISO(a.expiresAt).getTime();
  });

  return (
    <AppFrame>
      <header className="row feed-head">
        <span className="wordmark script">rant</span>
        <span className="badge">gone in 24h</span>
      </header>
      <nav className="tabs">
        <button className={`tab ${tab === 'fresh' ? 'on' : ''}`} onClick={() => setTab('fresh')}>Fresh</button>
        <button className={`tab ${tab === 'hot' ? 'on' : ''}`} onClick={() => setTab('hot')}>Hot</button>
        <button className={`tab ${tab === 'ending' ? 'on' : ''}`} onClick={() => setTab('ending')}>Ending soon</button>
      </nav>
      <section className="list" aria-label="Rants">
        {displayedRants.map(rant => {
          const hoursLeft = differenceInHours(parseISO(rant.expiresAt), new Date());
          const minsLeft = differenceInMinutes(parseISO(rant.expiresAt), new Date());
          const timeLeftStr = hoursLeft > 0 ? `${hoursLeft}h left` : `${minsLeft}m left`;
          
          if (minsLeft <= 0) return null; // already expired
          
          return (
            <article key={rant.id} className="card">
              <p className="txt">{rant.body}</p>
              <div className="row">
                <span className="time"><ClockIcon />{timeLeftStr}</span>
                <div className="btns">
                  <button className="vote" onClick={() => handleVote(rant.id, 'LIKE')}>
                    <ThumbIcon up={true} />{rant.likeCount}
                  </button>
                  <button className="vote" onClick={() => handleVote(rant.id, 'DISLIKE')}>
                    <ThumbIcon up={false} />{rant.dislikeCount}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
      <Link className="btn btn-pill feed-cta" to="/write">Rant about something</Link>
    </AppFrame>
  );
}

function WriteScreen() {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePost = async () => {
    if (!text.trim() || text.length > 280) return;
    setLoading(true);
    try {
      const res = await fetch('/api/rants', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Client-Hash': clientHash
        },
        body: JSON.stringify({ body: text })
      });
      if (res.ok) {
        navigate('/feed');
      } else {
        alert(res.status === 429
          ? "Only one rant allowed per 24 hours."
          : "Could not post. Your rant may contain blocked words."
        );
      }
    } catch (err) {
      console.error(err);
      alert("Can't reach the server. Try again.");
    }
    setLoading(false);
  };

  return (
    <AppFrame className="write">
      <div className="row">
        <Link className="icon-btn" to="/feed" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </Link>
        <button className="btn post" onClick={handlePost} disabled={loading || !text.trim() || text.length > 280}>Post</button>
      </div>
      <h1 className="display"><label htmlFor="rant">Get it out.</label></h1>
      <textarea 
        id="rant" 
        maxLength={280} 
        placeholder="Say it. No name, no account, gone in 24 hours."
        value={text}
        onChange={e => setText(e.target.value)}
      />
      <footer>
        <span>Anonymous. Expires in 24h.</span>
        <span style={{ color: text.length > 280 ? 'red' : 'inherit' }}>{text.length} / 280</span>
      </footer>
    </AppFrame>
  );
}

function ExpiredScreen() {
  return (
    <AppFrame className="expired">
      <h1 className="display">Too late.</h1>
      <p>This rant has already expired and been permanently deleted.</p>
      <Link className="btn btn-pill" to="/feed">Back to the feed</Link>
    </AppFrame>
  );
}

function LegalScreen() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  const handleAccept = () => {
    if (!agreed) return;
    localStorage.setItem('rant_tos_accepted', 'true');
    navigate('/write');
  };

  return (
    <AppFrame style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column' }}>
      <h1 className="display" style={{ marginBottom: '24px', fontSize: '28px', color: 'var(--accent)' }}>Terms & Policies</h1>
      
      <div style={{ flex: 1, overflowY: 'auto', textAlign: 'left', fontSize: '15px', color: 'var(--ink)', lineHeight: '1.6', paddingRight: '8px' }}>
        <p style={{ marginBottom: '16px' }}>Welcome to Rant. To keep this community safe and truly anonymous, you must agree to these rules before posting.</p>
        
        <strong style={{ color: 'var(--muted)' }}>1. Privacy Policy</strong>
        <p style={{ marginBottom: '16px' }}>We store zero personally identifiable information (PII). We do not require or collect accounts, emails, or phone numbers. A hashed version of your IP address is temporarily stored strictly for abuse prevention, rate-limiting, and preventing double voting.</p>
        
        <strong style={{ color: 'var(--muted)' }}>2. Content Policy</strong>
        <p style={{ marginBottom: '16px' }}>This is a place to vent, not a place to harm. The following are strictly prohibited:</p>
        <ul style={{ marginBottom: '16px', paddingLeft: '20px' }}>
          <li>Illegal content or CSAM</li>
          <li>Threats of violence or self-harm</li>
          <li>Targeted harassment, doxxing, or sharing PII (like phone numbers/emails)</li>
          <li>Hate speech or slurs</li>
        </ul>
        <p style={{ marginBottom: '16px' }}>Rants containing blocked slurs or PII will be automatically rejected. Rants hitting our report threshold will be automatically hidden from the feed pending review.</p>

        <strong style={{ color: 'var(--muted)' }}>3. Grievance Officer (IT Rules)</strong>
        <p style={{ marginBottom: '16px' }}>If you need to report severe violations that require legal escalation, please contact our grievance officer at: grievances@rant.example.com</p>
      </div>

      <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', fontSize: '15px', marginBottom: '20px' }}>
          <input 
            type="checkbox" 
            id="agreeLegal" 
            checked={agreed} 
            onChange={e => setAgreed(e.target.checked)} 
            style={{ marginTop: '4px', transform: 'scale(1.4)', accentColor: 'var(--accent)' }}
          />
          <label htmlFor="agreeLegal" style={{ cursor: 'pointer' }}>
            I have read and agree to follow the Privacy and Content Policies.
          </label>
        </div>

        <button 
          className="btn btn-pill" 
          style={{ width: '100%', opacity: agreed ? 1 : 0.5 }} 
          disabled={!agreed} 
          onClick={handleAccept}
        >
          I Accept, Let Me Rant
        </button>
        
        <button 
          className="btn btn-pill" 
          onClick={() => navigate('/feed')} 
          style={{ width: '100%', marginTop: '12px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--line)' }}
        >
          No thanks, I'll just read
        </button>
      </div>
    </AppFrame>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartScreen />} />
        <Route path="/feed" element={<FeedScreen />} />
        <Route path="/write" element={<WriteScreen />} />
        <Route path="/expired" element={<ExpiredScreen />} />
        <Route path="/legal" element={<LegalScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
