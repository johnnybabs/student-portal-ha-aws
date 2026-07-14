// ProtectedRoute.jsx — Auth guard component for routes that require teacher authentication
import React from 'react'; // React is required for JSX transformation
import { Navigate } from 'react-router-dom'; // Declarative redirect component from React Router v6

// ProtectedRoute wraps a page component and checks for a stored JWT before rendering it.
// If no token is found in localStorage the user is redirected to the teacher login page.
// JWT signature/expiry is NOT verified here — that is enforced by the backend returning 403,
// which Teacher.js handles by clearing the token and redirecting to /teacher-login.
export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('teacherToken'); // Read the JWT stored under the agreed key name

  if (!token) { // No token means the user is not authenticated — redirect them to login
    // replace=true replaces the current history entry so the user cannot press Back
    // to return to the protected page after being redirected to login
    return <Navigate to="/teacher-login" replace />;
  }

  return children; // Token is present — render the protected child component (e.g., <Teacher />)
}
