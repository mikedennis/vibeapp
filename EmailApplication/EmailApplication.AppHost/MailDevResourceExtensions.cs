using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;

namespace EmailApplication.AppHost;

public static class MailDevResourceExtensions
{
    public static IResourceBuilder<MailDevResource> AddMailDev(
        this IDistributedApplicationBuilder builder,
        string name = "maildev",
        int? httpPort = null,
        int? smtpPort = null)
    {
        var resource = new MailDevResource(name);

        return builder.AddResource(resource)
            .WithImage("maildev/maildev")
            .WithHttpEndpoint(targetPort: 1080, port: httpPort, name: MailDevResource.HttpEndpointName)
            .WithEndpoint(targetPort: 1025, port: smtpPort, name: MailDevResource.SmtpEndpointName);
    }
} 