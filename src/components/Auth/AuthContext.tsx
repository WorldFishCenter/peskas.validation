import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin } from '../../api/auth';

interface User {
  username: string;
  role: 'admin' | 'user';
  name?: string;
  country?: string[];
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if user is already logged in (check for JWT token)
    const authToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');

    if (authToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        // Invalid stored user, clear everything
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
      }
    } else {
      // If token or user is missing, clear both
      localStorage.removeItem('user');
      localStorage.removeItem('authToken');
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      // Call login API
      const result = await apiLogin(username, password);

      if (result.success && result.user && result.token) {
        // Store JWT token separately
        localStorage.setItem('authToken', result.token);

        // Store user data
        const userData: User = {
          username: result.user.username,
          role: result.user.role as 'admin' | 'user',
          name: result.user.name,
          country: result.user.country
        };
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(userData));

        return { success: true };
      }
      return { success: false, error: result.error || 'Invalid username or password' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    // Clear both user data and JWT token
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}; 