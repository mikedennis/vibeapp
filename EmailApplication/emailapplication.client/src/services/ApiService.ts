import authService from './AuthService';

const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || ''; // Default to empty string if not set

if (!process.env.REACT_APP_API_BASE_URL) {
    console.warn("REACT_APP_API_BASE_URL environment variable not set. API calls may fail.");
}

interface SendEmailRequest {
    to: string;
    subject: string;
    body: string;
}

interface SendEmailResponse {
    emailId: string;
}

interface EmailStatusResponse {
    emailId: string;
    status: string;
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    const token = await authService.getAccessToken();

    const headers = new Headers(options.headers || {});
    if (token) {
        headers.append('Authorization', `Bearer ${token}`);
    }
    headers.append('Content-Type', 'application/json');

    const response = await fetch(url, {
        ...options,
        headers: headers,
    });

    if (!response.ok) {
        // Attempt to read error details if available
        let errorBody: any = null;
        try {
            errorBody = await response.json();
        } catch (e) {
            // Ignore if body is not JSON or empty
        }
        console.error('API Error:', response.status, response.statusText, errorBody);
        // Throw an error object that includes status and potentially the body
        const error: any = new Error(`API request failed with status ${response.status}`);
        error.status = response.status;
        error.response = response;
        error.body = errorBody;
        throw error;
    }

    return response;
}

export async function sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    const url = `${apiBaseUrl}/send-email`;
    const response = await fetchWithAuth(url, {
        method: 'POST',
        body: JSON.stringify(request),
    });
    // Assuming the API returns Accepted (202) with the emailId in the body
    // or potentially in a Location header. Adapt as necessary based on actual API behavior.
    // The backend code returns Accepted(uri, { EmailId = emailId })
    const data: SendEmailResponse = await response.json(); 
    return data;
}

export async function getEmailStatus(emailId: string): Promise<EmailStatusResponse> {
    const url = `${apiBaseUrl}/email-status/${emailId}`;
    const response = await fetchWithAuth(url, {
        method: 'GET',
    });
    const data: EmailStatusResponse = await response.json();
    return data;
} 