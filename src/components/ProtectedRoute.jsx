import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageLoader from './PageLoader';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (!currentUser) {
    // If attempting to access super admin, send to /mahinerp, else /poserp
    const redirectPath = location.pathname.startsWith('/super-admin') ? '/mahinerp' : '/poserp';
    return <Navigate to={redirectPath} state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0) {
    const userRole = userProfile?.role || 'cashier';
    const hasRole = allowedRoles.includes(userRole) || (userProfile?.isImpersonating && allowedRoles.includes('shop_admin'));

    if (!hasRole) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
