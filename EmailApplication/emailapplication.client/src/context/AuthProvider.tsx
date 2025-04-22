import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { User } from 'oidc-client-ts';
import authService from '../services/AuthService';

interface AuthContextProps {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: () => void;
    logout: () => void;
    getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkUser = async () => {
            try {
                const currentUser = await authService.getUser();
                setUser(currentUser);
            } catch (error) {
                console.error("Error checking user session:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkUser();

        // Optional: Set up event listeners for user session changes
        const userLoaded = (loadedUser: User) => {
            console.log('AuthContext: User loaded event');
            setUser(loadedUser);
        };
        const userUnloaded = () => {
            console.log('AuthContext: User unloaded event');
            setUser(null);
        };

        // Assuming userManager is accessible or events are handled within AuthService
        // This part requires careful handling based on how AuthService exposes events
        // For simplicity, we rely on the initial check and manual login/logout 

        // Clean up listeners if necessary
        // return () => { 
        //     authService.userManager.events.removeUserLoaded(userLoaded);
        //     authService.userManager.events.removeUserUnloaded(userUnloaded);
        // };

    }, []);

    const login = () => {
        setIsLoading(true);
        authService.login().catch((error: Error) => {
            console.error("Login failed:", error);
            setIsLoading(false);
            // Handle login failure display if needed
        });
        // User state will be updated via redirect callback and useEffect check
    };

    const logout = () => {
        authService.signout().catch((error: Error) => {
            console.error("Logout failed:", error);
            // Handle logout failure display if needed
        });
        // User state will be updated via redirect callback and useEffect check
    };

    const contextValue: AuthContextProps = {
        user,
        isAuthenticated: !!user && !user.expired, // Check if user exists and is not expired
        isLoading,
        login,
        logout,
        getAccessToken: authService.getAccessToken,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextProps => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 