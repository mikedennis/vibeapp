import { UserManager, WebStorageStateStore, User } from 'oidc-client-ts';

const keycloakUrl = process.env.REACT_APP_KEYCLOAK_URL;
const clientId = 'emailapp-react-client'; // Match the Client ID in Keycloak
const realm = 'emailapp'; // Match the Realm name in Keycloak

if (!keycloakUrl) {
  console.error('REACT_APP_KEYCLOAK_URL is not defined. Authentication will not work.');
}

const settings = {
  authority: `${keycloakUrl}/realms/${realm}`,
  client_id: clientId,
  redirect_uri: `${window.location.origin}/signin-callback`, // Callback URL after login
  post_logout_redirect_uri: `${window.location.origin}/signout-callback`, // Callback URL after logout
  response_type: 'code', // Use Authorization Code Flow
  scope: 'openid profile email', // Request standard scopes + email
  userStore: new WebStorageStateStore({ store: window.localStorage }), // Store user state in local storage
  automaticSilentRenew: true, // Enable silent token renewal
  // For Keycloak, often need to explicitly set metadata endpoint details if discovery fails
  metadataUrl: `${keycloakUrl}/realms/${realm}/.well-known/openid-configuration`,
};

const userManager = new UserManager(settings);

export const login = () => {
  return userManager.signinRedirect();
};

export const completeLogin = () => {
  return userManager.signinRedirectCallback();
};

export const renewToken = () => {
  return userManager.signinSilent();
};

export const completeSilentRenew = () => {
  return userManager.signinSilentCallback();
}

export const logout = () => {
  // Remove user from local storage before redirecting
  return userManager.signoutRedirect(); 
};

export const completeLogout = () => {
  // Clear user data after Keycloak logout redirect
  return userManager.signoutRedirectCallback();
};

export const getUser = (): Promise<User | null> => {
  return userManager.getUser();
};

// Function to get the access token for API calls
export const getAccessToken = async (): Promise<string | null> => {
  const user = await userManager.getUser();
  if (user && !user.expired) {
    return user.access_token;
  }
  // Attempt silent renew if token is expired or missing
  try {
    const renewedUser = await userManager.signinSilent();
    return renewedUser?.access_token ?? null;
  } catch (error) {
    console.error('Silent renew failed:', error);
    // Optional: Initiate interactive login if silent renew fails
    // login(); 
    return null;
  }
};

// Listen for token expiration events to handle renewals proactively
userManager.events.addAccessTokenExpired(() => {
  console.log('Access token expired, attempting silent renew...');
  renewToken().catch(error => {
    console.error('Silent renew failed after token expiration event:', error);
    // Optionally trigger interactive login
    // login(); 
  });
});

// Optional: Handle scenario where user is signed out from another tab/window
userManager.events.addUserSignedOut(() => {
  console.log('User signed out from another location.');
  userManager.removeUser(); // Clear local user state
  // Optionally redirect to login or home page
  // window.location.href = '/';
});

export default userManager; 