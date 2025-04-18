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
    cd <repository-directory>
    ```
2.  **Restore Dependencies:**
    *   Navigate to the React client directory: `cd emailapplication.client`
    *   Install npm packages: `npm install`
    *   Navigate back to the solution root: `cd ..`
    *   Restore .NET dependencies (usually happens automatically, but can run manually): `dotnet restore EmailApplication/EmailApplication.sln`
3.  **Initial Keycloak Setup (First Run Only):**
    *   The first time you run the application, you need to configure the Keycloak instance managed by Aspire.
    *   Start the application (see next step).
    *   Open the Aspire Dashboard (URL provided in the console output, usually `http://localhost:15888` or similar).
    *   Find the endpoint for the `keycloak` service (likely mapped to `http://localhost:8088`).
    *   Access the Keycloak Admin Console via this URL.
    *   Log in using `admin` / `admin`.
    *   Create a new Realm named `emailapp`.
    *   Within the `emailapp` realm, create a **Client**:
        *   **Client ID:** `emailapp-react-client`
        *   **Client authentication:** Off
        *   **Valid redirect URIs:** `http://localhost:5173/*` (or your React app's host port)
        *   **Valid post logout redirect URIs:** `http://localhost:5173/*`
        *   **Web origins:** `http://localhost:5173`
        *   Save the client.
    *   Within the `emailapp` realm, create a **User**:
        *   **Username:** `testuser`
        *   **Email:** `testuser@example.com` (Ensure 'Email verified' is ON)
        *   Save the user.
        *   Go to the user's 'Credentials' tab and set a password (e.g., `password`), making sure 'Temporary' is OFF.
    *   Ensure the `email` Client Scope includes a mapper to add the user's email to the access token (Go to Client Scopes -> email -> Mappers -> Add Mapper if needed -> User Property -> Name: email, Property: email, Token Claim Name: email, Add to access token: ON).

4.  **Run the Application via Aspire AppHost:**
    *   Navigate to the solution root directory (`EmailApplication`).
    *   Run the AppHost project:
      ```bash
      dotnet run --project EmailApplication.AppHost
      ```
    *   This command will:
        *   Build all the projects.
        *   Start the containers (RabbitMQ, Redis, MailDev, Keycloak).
        *   Start the API and QueueListener services.
        *   Start the React development server.
        *   Launch the Aspire Dashboard in your browser.
    *   Access the React frontend via its URL listed in the Aspire Dashboard (likely `http://localhost:5173`).
    *   Access MailDev (local SMTP inbox) via its `http` URL in the Dashboard (likely `http://localhost:1080`).

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

*   **Symptoms:** At various points, the linter and compiler reported errors that `AddServiceDefaults` could not be found on `WebApplicationBuilder` or `HostApplicationBuilder`, despite project references and `using` statements appearing correct. While the final build succeeded with `AddServiceDefaults` uncommented, its correct functioning might be linked to the `GetServiceUri` failures.
*   **Workaround:** `AddServiceDefaults()` is currently *uncommented* in both `Api/Program.cs` and `QueueListener/Program.cs`, but its effectiveness is questionable given the `GetServiceUri` failures.
*   **Impact:** Core Aspire features provided by `ServiceDefaults` (like default health checks, telemetry, resilience configuration, and potentially fixing the service discovery issues) might not be fully active.

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