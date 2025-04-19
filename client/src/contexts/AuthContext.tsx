'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface AuthState {
  id: string
  name: string
  email: string
  emailVerified: boolean
}

interface AuthContextType {
  auth: AuthState | null
  setAuth: (auth: AuthState | null) => void
  isAuthenticated: boolean
  user: AuthState | null
  logout: () => Promise<void>
  updateAuth: (auth: AuthState) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null)

// Function to validate auth state
const validateAuth = (authData: unknown): authData is AuthState => {
  if (
    authData &&
    typeof authData === 'object' &&
    authData !== null &&
    'id' in authData &&
    'name' in authData &&
    'email' in authData &&
    'emailVerified' in authData
  ) {
    const { id, name, email, emailVerified } = authData as AuthState;
    return (
      typeof id === 'string' &&
      typeof name === 'string' &&
      typeof email === 'string' &&
      typeof emailVerified === 'boolean'
    );
  }
  return false;
}

  // Initialize auth state from cookie
  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) {
        const cookieValue = parts.pop()?.split(';').shift()
        return cookieValue ? decodeURIComponent(cookieValue) : null
      }
      return null
    }

    const authCookie = getCookie('auth')
    if (authCookie) {
      try {
        const parsedAuth = JSON.parse(authCookie)
        // Validate the parsed auth data before setting state
        if (validateAuth(parsedAuth)) {
          setAuth(parsedAuth)
        } else {
          console.error('Invalid auth data in cookie:', parsedAuth)
          document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
        }
      } catch (error) {
        console.error('Error parsing auth cookie:', error)
        document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
      }
    }
  }, [])

  // Update cookie when auth state changes
  useEffect(() => {
    if (auth) {
      const authValue = encodeURIComponent(JSON.stringify(auth))
      document.cookie = `auth=${authValue}; path=/; secure; samesite=strict; max-age=604800`
    } else {
      document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
    }
  }, [auth])

  const logout = async () => {
    setAuth(null)
    
    // Helper function to clear a cookie with all possible path and domain combinations
    const clearCookie = (name: string, paths: string[] = ['/']) => {
      const domains = ['', window.location.hostname, `.${window.location.hostname}`]
      
      paths.forEach(path => {
        domains.forEach(domain => {
          // With secure & samesite
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${domain ? `; domain=${domain}` : ''}; secure; samesite=strict;`
          // Without secure & samesite for local development
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}${domain ? `; domain=${domain}` : ''};`
        })
      })
    }
    
    // Clear all auth-related cookies with all possible paths
    clearCookie('auth')
    clearCookie('access_token')
    clearCookie('refresh_token', ['/', '/auth', '/auth/refresh'])
    clearCookie('csrf_token')
    
    // For debugging - log cookies after clearing attempt
    console.log('[Auth] Cookies after logout attempt:', document.cookie)
  }

  const updateAuth = (newAuth: AuthState) => {
    setAuth(newAuth)
  }

  return (
    <AuthContext.Provider value={{
      auth,
      setAuth,
      isAuthenticated: !!auth,
      user: auth,
      logout,
      updateAuth
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}