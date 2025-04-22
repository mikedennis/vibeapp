import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        // Show a loading indicator while checking authentication status
        return <div>Loading authentication...</div>;
    }

    if (!isAuthenticated) {
        // User not authenticated, redirect to home page or a dedicated login page.
        // We can pass the intended destination via state if we had a login page
        // return <Navigate to="/login" state={{ from: location }} replace />;

        // For now, redirecting to home. The login button is available there.
        return <Navigate to="/" replace />;
    }

    // User is authenticated, render the child components
    return <>{children}</>;
};

export default ProtectedRoute; 