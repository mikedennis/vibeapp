using Aspire.Hosting;
using EmailApplication.MailDevHost;

var builder = DistributedApplication.CreateBuilder(args);

// Add RabbitMQ container
var username = builder.AddParameter("username", "guest");
var password = builder.AddParameter("password", "guest");
var rabbitMq = builder.AddRabbitMQ("rabbitmq", username, password)
    .WithManagementPlugin();

// Add MailDev custom resource
var mailDev = builder.AddMailDev("maildev");

// Add Redis container for status tracking
var redis = builder.AddRedis("statestore");

// Add Keycloak container for OIDC
var keycloak = builder.AddContainer("keycloak", "quay.io/keycloak/keycloak")
    .WithEnvironment("KEYCLOAK_ADMIN", "admin") // Default admin user
    .WithEnvironment("KEYCLOAK_ADMIN_PASSWORD", "admin") // Default admin password - CHANGE FOR PRODUCTION!
    .WithEnvironment("KC_HTTP_ENABLED", "true") // Use http for local dev
    .WithEnvironment("KC_HOSTNAME_STRICT", "false") // Allow access via localhost/container name
    .WithEnvironment("KC_PROXY", "edge") // Required if running behind a proxy like Aspire's
    .WithEndpoint(targetPort: 8080, port: 8088, scheme: "http", name: "http") // Expose Keycloak's HTTP port (mapped to 8088 on host)
    .WithArgs("start-dev") // Start Keycloak in dev mode
    .WithVolume("/source/volumes/keycloak-data", "/opt/keycloak/data"); // NOTE update this to a folder on your local machine

// Add API project
var apiService = builder.AddProject<Projects.EmailApplication_Api>("emailapi")
    .WithReference(rabbitMq)
    .WithReference(redis)
    .WithEnvironment("Keycloak__Authority", keycloak.GetEndpoint("http") + "/realms/emailapp-realm");

// Add QueueListener project
var queueListener = builder.AddProject<Projects.EmailApplication_QueueListener>("queuelistener")
    .WithReference(rabbitMq)
    .WithReference(redis)
    .WithReference(mailDev);

// Add React client project
builder.AddNpmApp("reactfrontend", "../emailapplication.client")
    .WithReference(apiService)
    // Keycloak URL is passed via environment variable, no direct reference needed.
    .WithEndpoint(targetPort: 3000, port: 5173, scheme: "http", env: "PORT") // Use 'port' for the host port
    .WithEnvironment("BROWSER", "none") // Disable opening browser on start
    .WithEnvironment("REACT_APP_API_BASE_URL", apiService.GetEndpoint("http")) // Pass API URL to React app
    .WithEnvironment("REACT_APP_KEYCLOAK_URL", keycloak.GetEndpoint("http")); // Pass Keycloak URL to React app
    // Aspire handles Dockerfile generation for NpmApp implicitly if needed

builder.Build().Run();
