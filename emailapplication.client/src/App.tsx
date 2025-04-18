import React, { useEffect, useState, useCallback } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useNavigate
} from 'react-router-dom';
import logo from './logo.svg';
import './App.css';
import { useAuth } from './services/AuthProvider';
import { postJsonWithAuth, getJsonWithAuth } from './services/ApiService';

// Component to handle the OIDC signin redirect callback
function SigninCallback() {
  const { completeLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    completeLogin()
      .then(() => {
        navigate('/'); // Redirect to home page after successful login
      })
      .catch((error) => {
        console.error('Login callback failed:', error);
        // Handle login failure, maybe redirect to an error page or back home
        navigate('/');
      });
  }, [completeLogin, navigate]);

  return <div>Processing login...</div>;
}

// Component to handle the OIDC signout redirect callback
function SignoutCallback() {
  const { completeLogout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    completeLogout()
        .then(() => {
            navigate('/'); // Redirect to home page after successful logout
        })
        .catch((error) => {
            console.error('Logout callback failed:', error);
            navigate('/');
        });

  }, [completeLogout, navigate]);

  return <div>Processing logout...</div>;
}

// Email Form Component
interface EmailFormProps {
  onEmailQueued: (emailId: string) => void;
}

function EmailForm({ onEmailQueued }: EmailFormProps) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSending(true);
    setFeedback(null);

    try {
      // API expects { To: string, Subject: string, Body: string }
      const payload = { To: to, Subject: subject, Body: body };
      // API returns { EmailId: string } on success (202 Accepted)
      const result = await postJsonWithAuth<{ EmailId: string }, typeof payload>('/send-email', payload);
      
      setFeedback({ type: 'success', message: `Email queued successfully! ID: ${result.EmailId}` });
      onEmailQueued(result.EmailId);
      // Clear form on success
      setTo('');
      setSubject('');
      setBody('');
      // TODO: Trigger status refresh/display
    } catch (error) {
      console.error('Failed to send email:', error);
      setFeedback({ type: 'error', message: `Failed to send email: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '400px', margin: '20px auto' }}>
      <div>
        <label htmlFor="to">To:</label><br />
        <input 
          type="email" 
          id="to" 
          value={to} 
          onChange={(e) => setTo(e.target.value)} 
          required 
          style={{ width: '100%' }}
        />
      </div>
      <div>
        <label htmlFor="subject">Subject:</label><br />
        <input 
          type="text" 
          id="subject" 
          value={subject} 
          onChange={(e) => setSubject(e.target.value)} 
          required 
          style={{ width: '100%' }}
        />
      </div>
      <div>
        <label htmlFor="body">Body:</label><br />
        <textarea 
          id="body" 
          value={body} 
          onChange={(e) => setBody(e.target.value)} 
          required 
          rows={5} 
          style={{ width: '100%' }}
        />
      </div>
      <button type="submit" disabled={isSending}>
        {isSending ? 'Sending...' : 'Send Email'}
      </button>
      {feedback && (
        <p style={{ color: feedback.type === 'error' ? 'red' : 'green' }}>
          {feedback.message}
        </p>
      )}
    </form>
  );
}

// Status Display (Placeholder)
interface EmailStatusDisplayProps {
  emailIds: string[];
}

interface EmailStatus {
  id: string;
  status: string;
  error?: string;
  lastChecked: number;
}

function EmailStatusDisplay({ emailIds }: EmailStatusDisplayProps) {
  const [statuses, setStatuses] = useState<Record<string, EmailStatus>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchStatus = useCallback(async (id: string) => {
    try {
      const result = await getJsonWithAuth<{ EmailId: string, Status: string }>(`/email-status/${id}`);
      setStatuses(prev => ({ 
          ...prev, 
          [id]: { id: result.EmailId, status: result.Status, lastChecked: Date.now() } 
      }));
      return result.Status;
    } catch (error) {
      console.error(`Error fetching status for ${id}:`, error);
      setStatuses(prev => ({ 
          ...prev, 
          [id]: { 
              ...(prev[id] || { id: id }),
              status: 'Error', 
              error: error instanceof Error ? error.message : String(error), 
              lastChecked: Date.now() 
          } 
      }));
      return 'Error';
    }
  }, []);

  useEffect(() => {
    if (emailIds.length === 0) {
      setStatuses({});
      return;
    }

    setIsLoading(true);
    const fetchAll = async () => {
        const promises = emailIds.map(id => 
            !statuses[id] || (Date.now() - statuses[id].lastChecked > 5000) ? fetchStatus(id) : Promise.resolve(statuses[id].status)
        );
        await Promise.all(promises);
        setIsLoading(false);
    };
    fetchAll();

  }, [emailIds, fetchStatus]);

  useEffect(() => {
    const intervalId = setInterval(async () => {
        const statusEntries = Object.entries(statuses) as [string, EmailStatus][];
        
        const idsToPoll = statusEntries
            .filter(([id, statusData]) => 
                statusData.status === 'Queued' || statusData.status === 'Processing'
            )
            .map(([id, statusData]) => id);
            
        if (idsToPoll.length > 0) {
          console.log('Polling statuses for:', idsToPoll);
          const pollPromises = idsToPoll.map(id => fetchStatus(id));
          await Promise.all(pollPromises);
        }
      }, 5000);

    return () => clearInterval(intervalId);
  }, [statuses, fetchStatus]);

  if (emailIds.length === 0) {
      return <p>No emails sent yet in this session.</p>;
  }

  return (
    <div style={{ marginTop: '20px' }}>
      {isLoading && <p>Loading statuses...</p>}
      <ul>
        {emailIds.map(id => (
          <li key={id}>
            ID: {id} - Status: {statuses[id]?.status || 'Loading...'}
            {statuses[id]?.error && <span style={{ color: 'red' }}> ({statuses[id]?.error})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Main Application Component
function App() {
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();
  const [emailIds, setEmailIds] = useState<string[]>([]);

  const handleEmailQueued = useCallback((newId: string) => {
    setEmailIds(prevIds => [...prevIds, newId]);
  }, []);

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1>Email Sender App</h1>
          <nav>
            <Link to="/">Home</Link>
            {/* Add other links here later, e.g., /status */}
          </nav>
          <div className="Auth-section">
            {isLoading ? (
              <p>Loading...</p>
            ) : isAuthenticated ? (
              <div>
                <p>Welcome, {user?.profile?.email || user?.profile?.name || 'User'}!</p>
                <button onClick={() => logout()}>Logout</button>
              </div>
            ) : (
              <button onClick={() => login()}>Login</button>
            )}
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/signin-callback" element={<SigninCallback />} />
            <Route path="/signout-callback" element={<SignoutCallback />} />
            <Route path="/" element={
              <> { /* Home page content */}
                {isLoading ? (
                  <p>Checking authentication...</p>
                ) : isAuthenticated ? (
                  <div>
                    <h2>Send Email</h2>
                    <EmailForm onEmailQueued={handleEmailQueued} />
                    
                    <h2>Email Status</h2>
                    <EmailStatusDisplay emailIds={emailIds} />
                  </div>
                ) : (
                  <p>Please log in to send emails and view status.</p>
                )}
              </>
            } />
            {/* Add other routes here, e.g., a dedicated status page */}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App; 