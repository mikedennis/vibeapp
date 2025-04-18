# Use the SDK image to build the application
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /source

# Copy csproj and restore as distinct layers to leverage Docker cache
COPY ["EmailApplication.QueueListener/EmailApplication.QueueListener.csproj", "EmailApplication.QueueListener/"]
COPY ["EmailApplication.ServiceDefaults/EmailApplication.ServiceDefaults.csproj", "EmailApplication.ServiceDefaults/"]
RUN dotnet restore "EmailApplication.QueueListener/EmailApplication.QueueListener.csproj"

# Copy everything else and build app
COPY . .
WORKDIR "/source/EmailApplication.QueueListener"
RUN dotnet publish -c release -o /app --no-restore

# Use the .NET runtime image for the final stage (doesn't need ASP.NET)
FROM mcr.microsoft.com/dotnet/runtime:8.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "EmailApplication.QueueListener.dll"] 