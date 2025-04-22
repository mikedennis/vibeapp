using EmailApplication.QueueListener;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection; // Add for GetRequiredService
using Microsoft.Extensions.Hosting; // Add for AddRedisClient
using Microsoft.Extensions.ServiceDiscovery; // Add for GetServiceUri
using Microsoft.Extensions.Options; // Add for IOptions used in SmtpConfig
using System;
using System.Net;

var builder = Host.CreateApplicationBuilder(args);

// Add service defaults & Aspire components
builder.AddServiceDefaults();
builder.AddRedisClient("statestore");
builder.AddRabbitMQClient("rabbitmq");

// Configure SmtpConfig using IConfiguration and Aspire environment variables
builder.Services.Configure<SmtpConfig>(config =>
{
    // Configuration keys use ":" as hierarchy separator
    var smtpEndpointUrl = builder.Configuration["services:maildev:smtp:0"];

    if (!string.IsNullOrEmpty(smtpEndpointUrl))
    {
        try
        {
            var uri = new Uri(smtpEndpointUrl, UriKind.Absolute);
            config.Host = uri.Host;
            config.Port = uri.Port;
            Console.WriteLine($"[QueueListener] SMTP Configured from env var: Host={config.Host}, Port={config.Port}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[QueueListener] Warning: Could not parse SMTP endpoint URL '{smtpEndpointUrl}'. Using defaults. Error: {ex.Message}");
            // Keep defaults (Host="localhost", Port=1025)
        }
    }
    else
    {
        Console.WriteLine("[QueueListener] Warning: SMTP endpoint env var 'services:maildev:smtp:0' not found. Using defaults.");
        // Keep defaults (Host="localhost", Port=1025)
    }
});

// Register the background service
builder.Services.AddHostedService<EmailReceiverService>();

var host = builder.Build();
host.Run();

// --- Type Definitions --- 
// Removed duplicate SmtpConfig class definition; it's defined in EmailReceiverService.cs
/*
public class SmtpConfig
{
    public string Host { get; set; } = "localhost"; // Default values
    public int Port { get; set; } = 1025;
}
*/
