import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from 'oidc-client-ts';
import { getUser, login, logout, completeLogin, completeLogout, renewToken, completeSilentRenew } from './AuthService';
import userManager from './AuthService'; // Import the userManager instance

interface AuthContextProps {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  completeLogin: () => Promise<User | void>;
  completeLogout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const processUser = async () => {
      setIsLoading(true);
      try {
        const currentUser = await getUser();
        setUser(currentUser);
      } catch (error) {
        console.error("Error getting user:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    processUser();

    // Add event listeners for user changes (e.g., silent renew, logout from another tab)
    const handleUserLoaded = (loadedUser: User) => {
      console.log('User loaded:', loadedUser);
      setUser(loadedUser);
    };
    const handleUserUnloaded = () => {
      console.log('User unloaded');
      setUser(null);
    };
    const handleSilentRenewError = (error: Error) => {
        console.error('Silent renew error:', error);
        // Optionally force logout or try interactive signin
        // logout();
    };
    const handleAccessTokenExpired = () => {
      console.log('Token expired event detected.');
      // Attempt renew proactively
      renewToken().catch(handleSilentRenewError);
    };
    const handleUserSignedOut = () => {
        console.log("User signed out event detected.");
        setUser(null); // Clear user state immediately
    };

    userManager.events.addUserLoaded(handleUserLoaded);
    userManager.events.addUserUnloaded(handleUserUnloaded);
    userManager.events.addSilentRenewError(handleSilentRenewError);
    userManager.events.addAccessTokenExpired(handleAccessTokenExpired);
    userManager.events.addUserSignedOut(handleUserSignedOut);

    // Cleanup function
    return () => {
      userManager.events.removeUserLoaded(handleUserLoaded);
      userManager.events.removeUserUnloaded(handleUserUnloaded);
      userManager.events.removeSilentRenewError(handleSilentRenewError);
      userManager.events.removeAccessTokenExpired(handleAccessTokenExpired);
      userManager.events.removeUserSignedOut(handleUserSignedOut);
    };
  }, []);

  const handleCompleteLogin = async () => {
    setIsLoading(true);
    try {
      const loggedInUser = await completeLogin();
      setUser(loggedInUser);
      // Redirect or cleanup callback URL state
      window.history.replaceState({}, document.title, window.location.pathname.replace('/signin-callback', ''));
      return loggedInUser;
    } catch (error) {
      console.error("Error completing login:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteLogout = async () => {
     setIsLoading(true);
    try {
      await completeLogout();
      setUser(null);
      // Redirect or cleanup callback URL state
       window.history.replaceState({}, document.title, window.location.pathname.replace('/signout-callback', ''));
    } catch(error) {
        console.error("Error completing logout:", error);
    } finally {
        setIsLoading(false);
    }
  };

  const contextValue: AuthContextProps = {
    user,
    isAuthenticated: !!user && !user.expired,
    isLoading,
    login,
    logout,
    completeLogin: handleCompleteLogin,
    completeLogout: handleCompleteLogout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextProps => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 