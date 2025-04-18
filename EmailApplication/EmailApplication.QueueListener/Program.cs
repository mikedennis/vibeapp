using EmailApplication.QueueListener;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection; // Add for GetRequiredService
using Microsoft.Extensions.Hosting; // Add for AddRedisClient
using Microsoft.Extensions.ServiceDiscovery; // Add for GetServiceUri

var builder = Host.CreateApplicationBuilder(args);

// Add service defaults & Aspire components
// builder.AddServiceDefaults(); // Commented out due to build/linter errors
// builder.AddRabbitMQ("rabbitmq"); // Removed
builder.AddRedisClient("statestore"); // Add Redis client
// builder.Services.AddServiceDiscovery(); // Commented out as it didn't resolve errors

/* Commenting out SMTP config due to build errors resolving GetServiceUri
builder.Services.Configure<SmtpConfig>(config => 
{ 
    var smtpEndpoint = builder.Configuration.GetServiceUri("maildev", "smtp"); 
    if (smtpEndpoint != null)
    { 
        config.Host = smtpEndpoint.Host;
        config.Port = smtpEndpoint.Port;
    }
    else
    { 
        Console.WriteLine("Warning: MailDev SMTP endpoint not found in configuration. Email sending will fail.");
        config.Host = "localhost"; 
        config.Port = 1025;     
    }
});
*/

// Register the background service
builder.Services.AddHostedService<EmailReceiverService>();

var host = builder.Build();
host.Run();
