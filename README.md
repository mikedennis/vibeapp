# Email Application - Aspire Microservices Sample

This project demonstrates a microservices application built with .NET Aspire, React, RabbitMQ, Redis, and Keycloak for authentication. It allows users to log in, send emails (which are queued and processed asynchronously), and track the status of sent emails.

## Project Overview

This application was scaffolded based on the following requirements:

1.  **Frontend:** A React (TypeScript) website with a simple form for inputting email To, Subject, and Body, plus a Send button. Requires OpenID Connect (OIDC) authentication. The 'From' email address is derived from the authenticated user's account.
2.  **API Backend:** A .NET 8 Minimal API secured with OIDC (Bearer token). It receives email requests from the frontend and submits a corresponding message to an AMQP queue (RabbitMQ).
3.  **Queue Listener:** A .NET 8 Background Service that listens to the AMQP queue. Upon receiving a message, it sends the email via an SMTP server.
4.  **Status Tracking:** Email delivery status (Queued, Processing, Sent, Failed) is tracked using Redis.
5.  **Status Display:** The logged-in user can view the delivery status of their sent emails on the frontend.
6.  **Technology Choices & Local Development:**
    *   Runs locally using **.NET Aspire** (v8.x or later).
    *   Utilizes Aspire components for service discovery and orchestration.
    *   Dependencies (RabbitMQ, Redis, MailDev (SMTP), Keycloak (OIDC)) run as containers managed by Aspire for local development.
    *   Designed for eventual deployment to Kubernetes (includes Dockerfiles and generation steps for Kubernetes manifests).

## Getting Started

### Prerequisites

Ensure the following are installed on your system:

*   **.NET SDK 8.0 or later:** (Includes the .NET CLI)
*   **Node.js and npm:** Required for the React frontend (LTS version recommended).
*   **Docker Desktop:** Required to run the containerized dependencies managed by .NET Aspire.
*   **.NET Aspire Workload:** If not already installed, run `dotnet workload install aspire`.

### Building and Running Locally

1.  **Clone the Repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory> # Navigate into the cloned project folder
    ```
    Replace `<repository-url>` with the actual URL and `<repository-directory>` with the folder name created by the clone (usually derived from the repo name).
2.  **Install Client Dependencies:**
    *   Navigate to the React client directory: `cd EmailApplication/emailapplication.client`
    *   Install required Node.js packages based on the existing `package.json` file:
        ```bash
        npm install
        ```
    *   Navigate back to the solution root: `cd ../..` # Assuming you are in the client dir
3.  **Restore .NET Dependencies:**
    *   Run from the solution root (`EmailApplication`):
        ```bash
        dotnet restore EmailApplication.sln
        ```
4.  **Run the Application via Aspire AppHost:**
    *   Navigate to the solution root directory (`EmailApplication`).
    *   Run the AppHost project:
        ```bash
        dotnet run --project EmailApplication.AppHost
        ```
    *   This command starts all the application services, including the Keycloak container. Note the Keycloak service endpoint URL displayed in the Aspire Dashboard.
5.  **Initial Keycloak Setup (First Run Only):**
    *   Once the application is running (after the previous step), access the Keycloak Admin Console using the URL noted from the Aspire Dashboard.
    *   Perform the one-time setup detailed in the **"Initial Keycloak Setup (Local Development)"** section below.

### Initial Keycloak Setup (Local Development)

When running the application locally for the first time using `.NET Aspire`, a Keycloak container will be started (as part of step 4 in "Building and Running Locally"). You need to configure this running instance:

1.  **Access Keycloak Admin Console:**
    *   Find the Keycloak service endpoint in the Aspire Dashboard (usually something like `http://localhost:<port>`). This is available after running `dotnet run --project EmailApplication.AppHost`.
    *   Go to the Admin Console (typically `http://localhost:<port>/admin`).
    *   Log in using the default credentials (often `admin`/`admin`, unless changed via environment variables in `AppHost`). You might be prompted to change the password on first login.
2.  **Create a Realm:**
    *   Hover over the "master" realm name in the top-left corner and click "Add realm".
    *   Enter a name for your realm (e.g., `emailapp-realm`) and click "Create".
3.  **Create the React Client:**
    *   Ensure you are in your new realm (`emailapp-realm`).
    *   Navigate to "Clients" in the left-hand menu and click "Create".
    *   **Client ID:** `emailapp-client` (This needs to match the `client_id` used in the React app's OIDC configuration).
    *   **Client Protocol:** `openid-connect`
    *   **Root URL:** Leave blank or set if needed.
    *   Click "Save".
    *   On the client settings page:
        *   **Access Type:** `public`
        *   **Standard Flow Enabled:** `ON`
        *   **Direct Access Grants Enabled:** `ON`
        *   **Implicit Flow Enabled:** `ON` (Sometimes needed depending on exact OIDC flow)
        *   **Valid Redirect URIs:** Add the URL where Keycloak should redirect after login. Based on the default React template, this is likely `http://localhost:5173/*` (or whatever port your React app runs on). Add this value.
        *   **Web Origins:** Add the base URL of your React app (e.g., `http://localhost:5173`). Use `+` to add more if needed.
        *   Click "Save".
4.  **Configure Client Scopes / Mappers (Optional but Recommended):**
    *   Go to the "Client Scopes" tab for `emailapp-client`.
    *   Select the `email` scope (usually present by default under "Assigned Default Client Scopes").
    *   Go to the "Mappers" tab for this scope.
    *   Ensure standard OIDC claims like `email`, `profile`, `preferred_username` are mapped (they usually are by default). Add them if missing, using "Add Mapper" > "By Configuration" > "User Property" or "User Attribute".
5.  **Create a User:**
    *   Navigate to "Users" in the left-hand menu and click "Add user".
    *   Fill in the required fields (Username is mandatory). Set "Email verified" to `ON` and enter an email address (this will be used as the 'From' address).
    *   Click "Save".
    *   Go to the "Credentials" tab for the new user.
    *   Set a password and confirm it. Ensure "Temporary" is `OFF` unless you want the user to reset it on first login.
    *   Click "Set Password".

Note: The same Keycloak client (e.g., `emailapp-client`) can be used for both the React frontend and the API. Ensure that the client is configured with the appropriate scopes (`openid`, `profile`, `email`) and that both the frontend and API use the same client ID in their OIDC/JWT configuration.

> **Note:**
> If you want your Keycloak realm, clients, and users to persist between runs, update the Keycloak container definition in `EmailApplication.AppHost/Program.cs` to use a host directory that exists on your machine for the data volume. For example:
>
> ```csharp
> .WithVolume("/absolute/path/on/your/machine/keycloak-data", "/opt/keycloak/data")
> ```
>
> Replace `/absolute/path/on/your/machine/keycloak-data` with a directory that exists and is writable. If the directory does not exist, create it before running the application. This will ensure your Keycloak configuration is not lost between runs.

## Preparing for Production Deployment (Kubernetes)

The application includes Dockerfiles for containerizing the services. However, the development setup relies heavily on Aspire managing local containers for dependencies.

**Before deploying to a production Kubernetes environment, the following MUST be addressed:**

1.  **Replace Development Dependencies:**
    *   **RabbitMQ, Redis, Keycloak:** Configure the API, QueueListener, and React app to connect to your **production instances** of these services (e.g., managed cloud services like Azure Service Bus/Cache for Redis/Entra ID, or production-grade Kubernetes deployments). This involves:
        *   Creating Kubernetes Secrets to store connection strings, URLs, and credentials securely.
        *   Modifying the Kubernetes Deployment YAMLs for `EmailApplication.Api`, `EmailApplication.QueueListener`, and `emailapplication.client` to mount these secrets as environment variables or files.
        *   Updating the application code/configuration (if necessary) to read these environment variables/files.
    *   **MailDev:** Remove MailDev entirely. Configure the `EmailApplication.QueueListener` deployment to use your production SMTP server (e.g., SendGrid, Mailgun, Office 365) by providing its host, port, and credentials via Kubernetes Secrets / environment variables.
2.  **Secrets Management:** Ensure **NO** sensitive information (passwords, connection strings, API keys) is hardcoded in the code, Dockerfiles, or Kubernetes manifests. Use Kubernetes Secrets.
3.  **Configuration:**
    *   Review and adjust environment variables for production.
    *   Set appropriate CPU/Memory resource requests and limits in the Deployment YAMLs.
    *   Configure desired replica counts and update strategies.
    *   Verify and enhance liveness and readiness probes for each service.
4.  **Ingress:** Configure a Kubernetes Ingress controller and create Ingress resources to expose the React frontend and potentially the API externally, managing hostnames, TLS termination, and routing.
5.  **Image Tagging:** Use specific, immutable image tags (e.g., Git commit SHA, semantic version) instead of `latest` when building and deploying container images.
6.  **Namespaces:** Deploy the application components into a dedicated Kubernetes namespace.

## Building Images and Generating Manifests for Kubernetes

.NET Aspire can help generate initial deployment manifests.

1.  **Publish the AppHost:** Run the following command from the solution root directory (`EmailApplication`). Replace `<YOUR_CONTAINER_REGISTRY>` with the path to your container registry (e.g., `docker.io/yourusername`, `youracr.azurecr.io`).

    ```bash
    dotnet publish ./EmailApplication.AppHost -c Release -r linux-x64 \
      /p:PublishProfile=Default \
      /p:ContainerRegistry=<YOUR_CONTAINER_REGISTRY> \
      /p:ContainerImageTag=<YOUR_IMAGE_TAG> \
      /p:UseManifests=true
    ```
    *   Replace `<YOUR_IMAGE_TAG>` with a meaningful tag (e.g., `1.0.0`, or a Git commit hash).
    *   This command builds the projects, builds the container images using the Dockerfiles, pushes them to your specified registry (you must be logged in via `docker login`), and generates Kubernetes manifest YAML files in the `publish/manifests` directory.

2.  **Review and Adapt Manifests:** As highlighted in the previous section, the generated manifests in `publish/manifests` are a **starting point only**. They will likely include manifests for the local development containers (RabbitMQ, Redis, etc.) which **must be removed or replaced**. Carefully review, adapt, and test these manifests according to your production requirements and Kubernetes best practices before applying them.

3.  **Deploy to Kubernetes:** Once adapted, use `kubectl apply -f <manifest-directory> -n <your-namespace>` to deploy the resources to your cluster.

## Known Issues / Current Limitations (Pending Investigation)

As of the last update, the application **builds successfully**, but required commenting out critical configuration sections due to persistent compile-time errors that could not be resolved within the current environment. This means certain features **will not function correctly at runtime** until these underlying issues are fixed.

**1. Issue: Service Discovery Resolution (`GetServiceUri`)**

*   **Symptoms:** Both the `EmailApplication.Api` and `EmailApplication.QueueListener` projects failed to compile when attempting to use the `builder.Configuration.GetServiceUri("...")` extension method. The error was `CS1061: 'ConfigurationManager' does not contain a definition for 'GetServiceUri'`. This occurred even when the `Microsoft.Extensions.ServiceDiscovery` package was referenced, the necessary `using` directives were present, and `builder.AddServiceDefaults()` (which should register service discovery) was called.
*   **Workaround:** The configuration blocks using `GetServiceUri` have been commented out in:
    *   `EmailApplication.QueueListener/Program.cs` (for `SmtpConfig`)
    *   `EmailApplication.Api/Program.cs` (for manual `JwtBearerOptions` Authority configuration)
*   **Impact:**
    *   **QueueListener cannot send email:** It cannot resolve the SMTP server host/port from the MailDev container reference.
    *   **API JWT Validation may fail:** The JWT middleware cannot resolve the Keycloak `Authority` URL automatically. Authentication attempts might result in errors or bypass validation improperly.

**2. Issue: Aspire Hosting Reference (`WithReference`)**

*   **Symptoms:** The `EmailApplication.AppHost` project failed to compile when trying to add a reference from the API project to the Keycloak container using `.WithReference(keycloak)`. The error was `CS1503: Argument 2: cannot convert from '...ContainerResource>' to '...IResourceWithConnectionString>'`. While sometimes valid, this reference is intended to work with Aspire's JWT extensions for automatic Authority configuration.
*   **Workaround:** The `.WithReference(keycloak)` line has been commented out in `EmailApplication.AppHost/Program.cs` for the `apiService` definition.
*   **Impact:** This reinforces the API JWT validation issue, as the primary mechanism for Aspire to automatically link the API's JWT handler to the Keycloak container is disabled.

**3. Issue: Service Defaults (`AddServiceDefaults`)**

*   **Symptoms:** Previously, errors occurred where `AddServiceDefaults` could not be found by the compiler, and the `AppHost` incorrectly attempted to run the `ServiceDefaults` project directly. The direct execution issue is resolved by removing the project reference from `AppHost`. 
*   **Workaround:** `AddServiceDefaults()` is now uncommented and called correctly within both `Api/Program.cs` and `QueueListener/Program.cs`. 
*   **Impact (Revised):** While the method is now called, its full effectiveness remains uncertain. Core Aspire features configured by `ServiceDefaults` (like default health checks, telemetry, resilience) should be active, but the persistent failure of `GetServiceUri` (Issue #1) suggests that the service discovery aspects might not be fully configured or functional yet.

**Troubleshooting Steps Taken:**

*   Verified/added necessary NuGet packages (`Microsoft.Extensions.ServiceDiscovery`, `Aspire.*` packages, etc.).
*   Verified/added necessary `using` directives.
*   Added explicit `ProjectReference` to `ServiceDefaults` from `Api` and `QueueListener`.
*   Corrected TargetFramework mismatches (`net8.0` used consistently).
*   Corrected incompatible package versions (`JwtBearer`).
*   Attempted different configuration patterns (`Configure<T>` overloads).
*   Restarted IDE/Tooling.
*   Ran `dotnet restore --force`.

**Next Steps:**

Further investigation is needed, likely involving:
*   Testing in a clean build environment with Docker available.
*   Manually cleaning build artifacts (`bin`/`obj` folders).
*   Potentially providing runtime configuration values (SMTP host/port, Keycloak Authority) via environment variables or `appsettings.json` as a temporary measure during testing.