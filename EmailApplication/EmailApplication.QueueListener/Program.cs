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

// Configure SmtpConfig using Aspire connection string
builder.Services.Configure<SmtpConfig>(config =>
{
    var smtpUri = builder.Configuration.GetConnectionString("maildev");
    if (!string.IsNullOrEmpty(smtpUri))
    {
        try
        {
            var uri = new Uri(smtpUri);
            config.Host = uri.Host;
            config.Port = uri.Port;
            Console.WriteLine($"[QueueListener] SMTP Configured from connection string: Host={config.Host}, Port={config.Port}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[QueueListener] Warning: Could not parse SMTP connection string '{smtpUri}'. Using defaults. Error: {ex.Message}");
        }
    }
    else
    {
        Console.WriteLine("[QueueListener] Warning: SMTP connection string for 'maildev' not found. Using defaults.");
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
