import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthProvider';
import authService from './services/AuthService';
import EmailForm from './components/EmailForm';
import StatusPage from './components/StatusPage';
import ProtectedRoute from './components/ProtectedRoute';

// Basic CSS (can be moved to App.css or styled components)
const styles = {
    nav: {
        padding: '1rem',
        backgroundColor: '#f0f0f0',
        borderBottom: '1px solid #ccc',
        marginBottom: '1rem',
    },
    navLink: {
        marginRight: '1rem',
        textDecoration: 'none',
        color: '#333',
    },
    button: {
        padding: '0.5rem 1rem',
        cursor: 'pointer',
    },
    content: {
        padding: '1rem',
    },
    userInfo: {
        marginLeft: 'auto', // Push user info/button to the right
    }
};

function App() {
    const { isAuthenticated, user, login, logout, isLoading } = useAuth();

    const handleLogin = () => login();
    const handleLogout = () => logout();

    // OIDC Callback Components
    const SigninCallback = () => {
        React.useEffect(() => {
            authService.signinCallback()
                .then(() => {
                    window.location.replace('/'); // Redirect home after login
                })
                .catch(error => {
                    console.error("Signin callback error:", error);
                    window.location.replace('/'); // Redirect home even on error
                });
        }, []);
        return <div>Processing login...</div>;
    };

    const SignoutCallback = () => {
        React.useEffect(() => {
            authService.signoutCallback()
                .then(() => {
                     window.location.replace('/'); // Redirect home after logout
                })
                .catch(error => {
                    console.error("Signout callback error:", error);
                     window.location.replace('/'); // Redirect home even on error
                });
        }, []);
        return <div>Processing logout...</div>;
    };

    if (isLoading) {
        return <div>Loading Application...</div>;
    }

    return (
        <Router>
            <div>
                <nav style={styles.nav}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <Link style={styles.navLink} to="/">Home</Link>
                        {isAuthenticated && <Link style={styles.navLink} to="/send">Send Email</Link>}
                        {isAuthenticated && <Link style={styles.navLink} to="/status">Check Status</Link>}
                        
                        <div style={styles.userInfo}>
                             {isAuthenticated ? (
                                <>
                                    <span>Welcome, {user?.profile?.preferred_username || user?.profile?.name || 'User'}! </span>
                                    <button style={styles.button} onClick={handleLogout}>Logout</button>
                                </>
                            ) : (
                                <button style={styles.button} onClick={handleLogin}>Login</button>
                            )}
                        </div>
                    </div>
                </nav>

                <div style={styles.content}>
                    <Routes>
                        <Route path="/signin-callback" element={<SigninCallback />} />
                        <Route path="/signout-callback" element={<SignoutCallback />} />
                        
                        {/* Public Route */}
                        <Route path="/" element={ (
                            <div>
                                <h1>Welcome to the Email Application</h1>
                                {!isAuthenticated && <p>Please log in to send emails and check status.</p>}
                                {isAuthenticated && <p>You are logged in.</p>}
                            </div>
                        )} />

                        {/* Protected Routes - Use the imported components */}
                         <Route 
                            path="/send" 
                            element={ <ProtectedRoute> <EmailForm /> </ProtectedRoute> }
                        />
                         <Route 
                            path="/status" 
                            element={ <ProtectedRoute> <StatusPage /> </ProtectedRoute> }
                        />

                        {/* Fallback for unknown routes */}
                        <Route path="*" element={<div><h2>Page Not Found</h2></div>} />
                    </Routes>
                </div>
            </div>
        </Router>
    );
}

export default App;
