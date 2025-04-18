import { getAccessToken } from './AuthService';

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

if (!apiBaseUrl) {
    console.error('REACT_APP_API_BASE_URL is not defined. API calls will likely fail.');
}

interface FetchOptions extends RequestInit {
    // Allows specifying if the body is JSON and should be stringified
    isJson?: boolean;
}

/**
 * Wraps the native fetch function to automatically add Authorization header 
 * with Bearer token and handle common settings like base URL and Content-Type.
 * 
 * @param endpoint The API endpoint path (e.g., '/send-email')
 * @param options Standard fetch options plus an optional 'isJson' flag
 * @returns Promise<Response>
 */
export const fetchWithAuth = async (endpoint: string, options: FetchOptions = {}): Promise<Response> => {
    const token = await getAccessToken();

    if (!token) {
        // Handle the case where the token is not available
        // Option 1: Throw an error to be caught by the caller
        throw new Error('Authentication token not available. Please log in.');
        // Option 2: Redirect to login (might require access to navigation context or AuthService)
        // login(); 
        // return new Response(null, { status: 401, statusText: 'Unauthorized' }); // Or return a specific Response
    }

    const headers = new Headers(options.headers || {});
    headers.append('Authorization', `Bearer ${token}`);

    let body = options.body;
    if (options.body && options.isJson) {
        headers.append('Content-Type', 'application/json');
        body = JSON.stringify(options.body); // Stringify body if it's JSON
    } else if (!(options.body instanceof FormData) && typeof options.body !== 'string') {
        // Set default Content-Type if not FormData or string and isJson is not explicitly true
        // headers.append('Content-Type', 'application/json'); // Decide if this default is desired
    }

    const fetchOptions: RequestInit = {
        ...options,
        headers: headers,
        body: body,
    };

    const url = `${apiBaseUrl}${endpoint}`;

    try {
        const response = await fetch(url, fetchOptions);
        
        // Optional: Centralized handling for common errors like 401/403
        if (response.status === 401) {
            // Token might be invalid or expired beyond silent renew capability
            console.error('API call resulted in 401 Unauthorized.');
            // Optionally trigger logout or refresh logic here
            // logout(); 
            // Or just let the caller handle it
        } else if (response.status === 403) {
            console.error('API call resulted in 403 Forbidden.');
        }
        
        return response; // Return the raw response for the caller to handle

    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        throw error; // Re-throw the error for the caller
    }
};

// Example helper for simple GET requests expecting JSON
export const getJsonWithAuth = async <T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> => {
    const response = await fetchWithAuth(endpoint, { ...options, method: 'GET' });
    if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }
    return await response.json() as T;
};

// Example helper for POST requests sending JSON and expecting JSON
export const postJsonWithAuth = async <TResponse = any, TBody = any>(
    endpoint: string, 
    body: TBody, 
    options: FetchOptions = {}
): Promise<TResponse> => {
    const response = await fetchWithAuth(endpoint, { 
        ...options, 
        method: 'POST', 
        body: body as any, // Type assertion needed here 
        isJson: true 
    });
    if (!response.ok) {
        // Attempt to read error details if available
        let errorBody = `API request failed with status ${response.status}: ${response.statusText}`;
        try {
            const errorJson = await response.json();
            errorBody += ` - ${JSON.stringify(errorJson)}`;
        } catch { /* Ignore if error response is not JSON */ }
        throw new Error(errorBody);
    }
    // Handle cases where backend returns 202 Accepted with no body or location header
    if (response.status === 202 || response.status === 204) { 
         try {
            // Try to parse JSON even for 202/204, API might return some info
             return await response.json() as TResponse;
         } catch {
             // If no body or not JSON, return status/header info or null
             return { status: response.status, location: response.headers.get('Location') } as TResponse;
         }
    }
    return await response.json() as TResponse;
}; 