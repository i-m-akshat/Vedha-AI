import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Queue and state for silent token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Intercept requests to attach Bearer token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('vedha_token') || localStorage.getItem('resumate_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Intercept responses for global error handling and transparent token rotation
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = originalRequest.url || '';
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/revoke');

    if (error.response?.status === 401 && !isAuthEndpoint) {
      const refreshToken = localStorage.getItem('vedha_refresh_token');
      const accessToken = localStorage.getItem('vedha_token') || localStorage.getItem('resumate_token');

      // If no refresh token exists or request has already been retried, evict session and trigger unauthorized event
      if (!refreshToken || originalRequest._retry) {
        localStorage.removeItem('vedha_token');
        localStorage.removeItem('resumate_token');
        localStorage.removeItem('vedha_refresh_token');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vedha:unauthorized'));
        }
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Direct axios call bypassing instance interceptors to avoid recursion
        const response = await axios.post<{ token: string; refreshToken?: string }>(
          `${API_BASE_URL}/auth/refresh`,
          { accessToken: accessToken || '', refreshToken }
        );

        const newAccessToken = response.data.token;
        const newRefreshToken = response.data.refreshToken;

        localStorage.setItem('vedha_token', newAccessToken);
        localStorage.removeItem('resumate_token');
        if (newRefreshToken) {
          localStorage.setItem('vedha_refresh_token', newRefreshToken);
        }

        processQueue(null, newAccessToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('vedha_token');
        localStorage.removeItem('resumate_token');
        localStorage.removeItem('vedha_refresh_token');

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vedha:unauthorized'));
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

