using EmailApplication.QueueListener;

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