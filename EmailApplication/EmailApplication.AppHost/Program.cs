using Aspire.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// Add service defaults
builder.AddProject<Projects.EmailApplication_ServiceDefaults>("servicedefaults");

// Add RabbitMQ container
var rabbitMq = builder.AddRabbitMQ("rabbitmq")
    .WithManagementPlugin();

// Add MailDev container
var mailDev = builder.AddContainer("maildev", "maildev/maildev")
    .WithEndpoint(targetPort: 1080, port: 1080, scheme: "http", name: "http") // Web UI
    .WithEndpoint(targetPort: 1025, port: 1025, name: "smtp"); // SMTP port

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
    .WithArgs("start-dev"); // Start Keycloak in dev mode

// Add API project
var apiService = builder.AddProject<Projects.EmailApplication_Api>("emailapi")
    .WithReference(rabbitMq)
    .WithReference(redis);

// Add QueueListener project
var queueListener = builder.AddProject<Projects.EmailApplication_QueueListener>("queuelistener")
    .WithReference(rabbitMq)
    // SMTP details (host/port) are accessed via Service Discovery in the listener, no direct reference needed here.
    .WithReference(redis);

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
