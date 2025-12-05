/**
 * Utility to diagnose and fix localStorage/cache issues
 */

export function clearAllAppData() {
  try {
    // Clear localStorage
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) keysToRemove.push(key);
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    console.log('✅ All app data cleared');
    return true;
  } catch (error) {
    console.error('❌ Failed to clear app data:', error);
    return false;
  }
}

export async function diagnoseApiConnection() {
  const issues = [];
  
  // Check API URL
  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  const hasApiUrl = Boolean(apiUrl);
  
  if (!hasApiUrl) {
    issues.push('API URL not configured');
  }
  
  // Try to check API health
  try {
    const healthUrl = apiUrl.startsWith('http') ? `${apiUrl}/health` : `${window.location.origin}${apiUrl}/health`;
    const response = await fetch(healthUrl, { method: 'GET' });
    if (!response.ok) {
      issues.push(`API server returned status ${response.status}`);
    } else {
      const data = await response.json();
      if (data.database !== 'connected') {
        issues.push('Database connection failed');
      }
    }
  } catch (error: any) {
    issues.push(`Cannot connect to API: ${error.message}`);
  }
  
  // Check localStorage size
  try {
    const size = JSON.stringify(localStorage).length;
    if (size > 5 * 1024 * 1024) { // 5MB
      issues.push('localStorage is large (>5MB), may cause issues');
    }
  } catch {
    issues.push('Cannot access localStorage');
  }
  
  return {
    healthy: issues.length === 0,
    issues,
    recommendations: issues.length > 0 
      ? ['Clear browser cache', 'Check API server status', 'Verify environment variables', 'Ensure database is running']
      : []
  };
}

export async function getApiHealthStatus(): Promise<'unknown' | 'healthy' | 'degraded' | 'down'> {
  try {
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    const healthUrl = apiUrl.startsWith('http') ? `${apiUrl}/health` : `${window.location.origin}${apiUrl}/health`;
    const response = await fetch(healthUrl, { method: 'GET' });
    
    if (!response.ok) return 'down';
    
    const data = await response.json();
    if (data.status === 'ok' && data.database === 'connected') {
      return 'healthy';
    }
    return 'degraded';
  } catch {
    return 'down';
  }
}

// Add to window for debugging
if (typeof window !== 'undefined') {
  (window as any).apiDebug = {
    clearAllAppData,
    diagnoseApiConnection,
    getApiHealthStatus,
  };
}
