using System.Security.Claims; // For ClaimTypes
using System.Text.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer; // For AddJwtBearer
using Microsoft.Extensions.Hosting;
using RabbitMQ.Client;
using StackExchange.Redis; // Add Redis using
using Microsoft.Extensions.Configuration; // Add for GetServiceUri
using Microsoft.Extensions.DependencyInjection; // Add for AddServiceDiscovery
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire components
builder.AddServiceDefaults(); 
builder.AddRedisClient("statestore"); 
builder.AddRabbitMQClient("rabbitmq"); // Add RabbitMQ DI registration

builder.Services.AddProblemDetails();

// --- Authentication --- 
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Keycloak__Authority"];
        options.Audience = "emailapp-api"; // or your actual API client ID
        options.TokenValidationParameters = new()
        {
            ValidateAudience = true,
            ValidAudience = "emailapp-api",
            ValidateIssuer = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true
        };
    });

builder.Services.AddAuthorization();
// ----------------------

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Email API", Version = "v1" });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger(); // Requires Swashbuckle.AspNetCore package
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Email API V1");
        c.RoutePrefix = string.Empty; // Serve Swagger UI at root
    });
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
