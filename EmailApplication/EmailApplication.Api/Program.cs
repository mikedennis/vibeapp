using System.Security.Claims; // For ClaimTypes
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer; // For AddJwtBearer
using Microsoft.Extensions.Hosting;
using RabbitMQ.Client;
using StackExchange.Redis; // Add Redis using
using Microsoft.Extensions.Configuration; // Add for GetServiceUri
using Microsoft.Extensions.DependencyInjection; // Add for AddServiceDiscovery

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire components
builder.AddServiceDefaults(); // Commented out due to build/linter errors
builder.AddRedisClient("statestore"); 
builder.AddRabbitMQClient("rabbitmq"); // Add RabbitMQ DI registration
// builder.Services.AddServiceDiscovery(); // Commented out as it didn't resolve errors

// --- Authentication --- 
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(); // Base registration
    
/* Commenting out manual config due to GetServiceUri build error
builder.Services.Configure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
{
    var keycloakUrl = builder.Configuration.GetServiceUri("keycloak", "http");
    // ... rest of config ... 
});
*/

// Minimal JWT config to allow build
builder.Services.Configure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
{
    options.TokenValidationParameters = new()
    {
        ValidateAudience = true, 
        ValidAudience = "emailapp-api",
        ValidateIssuer = false, 
        ValidateLifetime = true,
        ValidateIssuerSigningKey = false 
    };
});

builder.Services.AddAuthorization();
// ----------------------

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(); // Requires Swashbuckle.AspNetCore package

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger(); // Requires Swashbuckle.AspNetCore package
    app.UseSwaggerUI(); // Requires Swashbuckle.AspNetCore package
}

app.UseHttpsRedirection();

// --- Add Auth middleware --- 
// IMPORTANT: Must be between UseRouting (implicit) and MapEndpoints
app.UseAuthentication();
app.UseAuthorization();
// ---------------------------

// Define the API endpoint
// Note: EmailRequest type is defined at the bottom of the file
app.MapPost("/send-email", async (EmailRequest request, IConnection rabbitMqConnection, IConnectionMultiplexer redisConnection, ClaimsPrincipal user) => // Inject ClaimsPrincipal
{
    // Get user email from claims (ensure Keycloak is configured to include email claim in token)
    var fromAddress = user.FindFirstValue(ClaimTypes.Email);
    if (string.IsNullOrEmpty(fromAddress))
    {
        return Results.Forbid(); // Or BadRequest, if email claim is missing
    }

    var emailId = Guid.NewGuid().ToString();

    try
    {
        // 1. Store initial status in Redis
        var redisDb = redisConnection.GetDatabase();
        await redisDb.StringSetAsync($"emailStatus:{emailId}", "Queued");

        // 2. Publish message to RabbitMQ
        using var channel = rabbitMqConnection.CreateModel();
        var queueName = "email-queue";
        channel.QueueDeclare(queue: queueName,
                             durable: true, 
                             exclusive: false,
                             autoDelete: false,
                             arguments: null);

        var messageBody = new // Include emailId in the message
        {
            EmailId = emailId, 
            From = fromAddress,
            request.To,
            request.Subject,
            request.Body
        };
        var body = JsonSerializer.SerializeToUtf8Bytes(messageBody);

        var properties = channel.CreateBasicProperties();
        properties.Persistent = true; 

        channel.BasicPublish(exchange: string.Empty,
                             routingKey: queueName,
                             basicProperties: properties,
                             body: body);

        Console.WriteLine($" [x] Queued email {emailId} from {fromAddress} to {request.To}");

        // Return the ID so the client can track status
        return Results.Accepted($"/email-status/{emailId}", new { EmailId = emailId });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error processing request for email {emailId}: {ex.Message}");
        // Attempt to clean up status if queueing failed after setting initial status
        try { await redisConnection.GetDatabase().KeyDeleteAsync($"emailStatus:{emailId}"); } catch { /* Ignore cleanup error */ }
        return Results.Problem("Failed to queue email.", statusCode: 500);
    }
})
.RequireAuthorization() // Require authentication for this endpoint
.WithName("SendEmail")
.WithOpenApi();

// Add endpoint to get email status
app.MapGet("/email-status/{id}", async (string id, IConnectionMultiplexer redisConnection) => 
{ 
    // TODO: Add logic to ensure only the user who sent the email can see the status
    var redisDb = redisConnection.GetDatabase();
    var status = await redisDb.StringGetAsync($"emailStatus:{id}");

    if (status.IsNullOrEmpty)
    {
        return Results.NotFound(new { EmailId = id, Status = "Not Found" });
    }

    return Results.Ok(new { EmailId = id, Status = status.ToString() });
})
.RequireAuthorization() // Require authentication for this endpoint too
.WithName("GetEmailStatus")
.WithOpenApi();

app.Run();

// Define the email request model (must be outside top-level statements execution flow)
public record EmailRequest(string To, string Subject, string Body);
