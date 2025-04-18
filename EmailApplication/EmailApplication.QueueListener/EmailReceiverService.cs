using System;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using MailKit.Net.Smtp;
using MimeKit;
using StackExchange.Redis;

namespace EmailApplication.QueueListener;

// Define the structure of the message expected from the queue
public record EmailQueueMessage(string EmailId, string From, string To, string Subject, string Body);

public class EmailReceiverService : BackgroundService
{
    private readonly ILogger<EmailReceiverService> _logger;
    private readonly IConnection _rabbitMqConnection;
    private readonly IConnectionMultiplexer _redisConnection;
    private readonly SmtpConfig _smtpConfig;
    private IModel? _channel;
    private const string QueueName = "email-queue";

    public EmailReceiverService(
        ILogger<EmailReceiverService> logger,
        IConnection rabbitMqConnection,
        IConnectionMultiplexer redisConnection,
        IOptions<SmtpConfig> smtpConfigOptions)
    {
        _logger = logger;
        _rabbitMqConnection = rabbitMqConnection;
        _redisConnection = redisConnection;
        _smtpConfig = smtpConfigOptions.Value;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        stoppingToken.Register(() => _logger.LogInformation("Email Receiver Service is stopping."));

        _channel = _rabbitMqConnection.CreateModel();

        _channel.QueueDeclare(queue: QueueName,
                             durable: true,
                             exclusive: false,
                             autoDelete: false,
                             arguments: null);
                             
        _channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);

        var consumer = new EventingBasicConsumer(_channel);
        consumer.Received += async (model, ea) =>
        {
            var body = ea.Body.ToArray();
            var messageJson = Encoding.UTF8.GetString(body);
            EmailQueueMessage? emailMessage = null;
            string emailId = "unknown";

            try
            {
                emailMessage = JsonSerializer.Deserialize<EmailQueueMessage>(messageJson);

                if (emailMessage != null)
                {
                    emailId = emailMessage.EmailId;
                    _logger.LogInformation($" [.] Received message for EmailId: {emailId}");

                    var redisDb = _redisConnection.GetDatabase();

                    await redisDb.StringSetAsync($"emailStatus:{emailId}", "Processing");
                    _logger.LogInformation($" [.] Status updated to Processing for EmailId: {emailId}");

                    await SendEmailAsync(emailMessage, stoppingToken);

                    await redisDb.StringSetAsync($"emailStatus:{emailId}", "Sent");
                    _logger.LogInformation($" [x] Status updated to Sent for EmailId: {emailId}");

                    // Acknowledge the message was processed successfully
                    _channel?.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
                    _logger.LogInformation($" [x] Done processing message for {emailMessage.To}.");
                }
                else
                {
                     _logger.LogError("Failed to deserialize message body.");
                     // Reject the message without requeuing if deserialization fails
                     _channel?.BasicNack(deliveryTag: ea.DeliveryTag, multiple: false, requeue: false);
                }
            }
            catch (JsonException jsonEx)
            {
                 _logger.LogError(jsonEx, "Error deserializing message.");
                 // Reject the message without requeuing for bad format
                 _channel?.BasicNack(deliveryTag: ea.DeliveryTag, multiple: false, requeue: false);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing message.");
                // Negative Acknowledge the message, potentially requeue for transient errors
                // Consider adding retry logic or moving to a dead-letter queue for persistent errors
                 _channel?.BasicNack(deliveryTag: ea.DeliveryTag, multiple: false, requeue: true); // Requeue for now
            }
        };

        _channel.BasicConsume(queue: QueueName,
                             autoAck: false, // Manual acknowledgment
                             consumer: consumer);

        _logger.LogInformation(" [*] Waiting for messages. To exit press CTRL+C");

        return Task.CompletedTask; // The service runs until the application shuts down
    }

    private async Task SendEmailAsync(EmailQueueMessage emailMessage, CancellationToken cancellationToken)
    {
        _logger.LogInformation($"Attempting to send email to {emailMessage.To} via {_smtpConfig.Host}:{_smtpConfig.Port}");

        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(emailMessage.From));
        message.To.Add(MailboxAddress.Parse(emailMessage.To));
        message.Subject = emailMessage.Subject;

        message.Body = new TextPart("plain") // Assuming plain text body for now
        {
            Text = emailMessage.Body
        };

        using var client = new SmtpClient();
        try
        {
            // MailDev typically doesn't require authentication or SSL/TLS for local dev
            await client.ConnectAsync(_smtpConfig.Host, _smtpConfig.Port, MailKit.Security.SecureSocketOptions.None, cancellationToken);
            
            // Note: MailDev often doesn't require authentication. Add if your SMTP server needs it.
            // await client.AuthenticateAsync("username", "password", cancellationToken); 

            await client.SendAsync(message, cancellationToken);
            _logger.LogInformation($"Email sent successfully to {emailMessage.To}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Failed to send email to {emailMessage.To}");
            // Rethrow or handle exception to allow Nack/requeue logic in the consumer event handler
            throw; 
        }
        finally
        {
            await client.DisconnectAsync(true, cancellationToken);
        }
    }

    public override void Dispose()
    {
        _channel?.Close();
        _channel?.Dispose();
        base.Dispose();
        GC.SuppressFinalize(this);
    }
}

// Simple configuration class for SMTP settings
public class SmtpConfig
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
} 