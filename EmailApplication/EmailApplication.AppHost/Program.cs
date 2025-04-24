using Aspire.Hosting;
using EmailApplication.MailDevHost;
using Aspire.Hosting.Keycloak;

var builder = DistributedApplication.CreateBuilder(args);

// Add Keycloak resource with a stable port and data volume
var keycloak = builder.AddKeycloak("keycloak", 8088)
                      .WithDataVolume();

// Add RabbitMQ container
var username = builder.AddParameter("username", "guest");
var password = builder.AddParameter("password", "guest");
var rabbitMq = builder.AddRabbitMQ("rabbitmq", username, password)
    .WithManagementPlugin();

// Add MailDev custom resource
var mailDev = builder.AddMailDev("maildev");

// Add Redis container for status tracking
var redis = builder.AddRedis("statestore");

// Add API project
var apiService = builder.AddProject<Projects.EmailApplication_Api>("emailapi")
    .WithReference(keycloak)
    .WithReference(rabbitMq)
    .WithReference(redis);

// Add QueueListener project
var queueListener = builder.AddProject<Projects.EmailApplication_QueueListener>("queuelistener")
    .WithReference(rabbitMq)
    .WithReference(redis)
    .WithReference(mailDev);

// Add React client project
builder.AddNpmApp("reactfrontend", "../emailapplication.client")
    .WithReference(apiService)
    .WithReference(keycloak)
    .WithEndpoint(targetPort: 3000, port: 5173, scheme: "http", env: "PORT") // Use 'port' for the host port
    .WithEnvironment("BROWSER", "none") // Disable opening browser on start
    .WithEnvironment("REACT_APP_API_BASE_URL", apiService.GetEndpoint("http")) // Pass API URL to React app
    .WithEnvironment("REACT_APP_KEYCLOAK_URL", keycloak.GetEndpoint("http")); // Pass Keycloak URL to React app
    // Aspire handles Dockerfile generation for NpmApp implicitly if needed

builder.Build().Run();
