import { UserManager, WebStorageStateStore, User, SignoutResponse } from 'oidc-client-ts';

const keycloakUrl = process.env.REACT_APP_KEYCLOAK_URL;
// Ensure the URL has a trailing slash if needed by your Keycloak setup or remove if it doesn't
const authority = keycloakUrl ? (keycloakUrl.endsWith('/') ? keycloakUrl : `${keycloakUrl}/`) + 'realms/emailapp-realm' : 'http://localhost:8088/realms/emailapp-realm'; // Default fallback for safety

const settings = {
    authority: authority,
    client_id: 'emailapp-client', // Must match the client ID created in Keycloak
    redirect_uri: window.location.origin + '/signin-callback', // Callback path after login
    post_logout_redirect_uri: window.location.origin + '/signout-callback', // Callback path after logout
    response_type: 'code', // Use Authorization Code Flow with PKCE
    scope: 'openid profile email', // Scopes to request
    userStore: new WebStorageStateStore({ store: window.localStorage }), // Store user info in local storage
    automaticSilentRenew: true, // Enable automatic token renewal
    // metadataUrl: `${authority}/.well-known/openid-configuration` // Explicitly set if needed
};

class AuthService {
    private userManager: UserManager;

    constructor() {
        if (!process.env.REACT_APP_KEYCLOAK_URL) {
            console.warn("REACT_APP_KEYCLOAK_URL environment variable not set. Using default Keycloak URL.");
        }
        this.userManager = new UserManager(settings);

        // Logging for debugging OIDC events
        this.userManager.events.addUserLoaded(user => {
            console.log('User loaded:', user);
        });
        this.userManager.events.addUserUnloaded(() => {
            console.log('User unloaded');
        });
        this.userManager.events.addAccessTokenExpiring(() => {
            console.log('Access token expiring');
        });
        this.userManager.events.addAccessTokenExpired(() => {
            console.log('Access token expired');
            // Optionally attempt silent sign-in or redirect to login
            // this.signinSilent().catch(() => this.login()); 
        });
        this.userManager.events.addUserSignedOut(() => {
            console.log('User signed out');
        });
        this.userManager.events.addSilentRenewError(error => {
            console.error('Silent renew error:', error);
            // Potentially handle logout or error display
        });
    }

    public getUser(): Promise<User | null> {
        return this.userManager.getUser();
    }

    public login(): Promise<void> {
        // Redirects the user to the Keycloak login page
        return this.userManager.signinRedirect();
    }

    public signinCallback(): Promise<User | void> {
        // Handles the callback after successful login, exchanges code for tokens
        return this.userManager.signinRedirectCallback();
    }

    public signout(): Promise<void> {
        // Redirects the user to Keycloak for logout, then back to post_logout_redirect_uri
        return this.userManager.signoutRedirect();
    }

    public signoutCallback(): Promise<SignoutResponse> {
        // Handles the callback after successful logout
        return this.userManager.signoutRedirectCallback();
    }

    public async getAccessToken(): Promise<string | null> {
        const user = await this.getUser();
        return user?.access_token ?? null;
    }

    public signinSilent(): Promise<User | null> {
        // Attempts to renew the token silently using an iframe
        return this.userManager.signinSilent();
    }

    public signinSilentCallback(): Promise<User | void> {
        // Handles the callback for silent sign-in
        return this.userManager.signinSilentCallback();
    }
}

// Export a singleton instance
const authService = new AuthService();
export default authService; 