# Use the SDK image to build the application
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /source

# Copy csproj and restore as distinct layers to leverage Docker cache
COPY ["EmailApplication.Api/EmailApplication.Api.csproj", "EmailApplication.Api/"]
COPY ["EmailApplication.ServiceDefaults/EmailApplication.ServiceDefaults.csproj", "EmailApplication.ServiceDefaults/"]
RUN dotnet restore "EmailApplication.Api/EmailApplication.Api.csproj"

# Copy everything else and build app
COPY . .
WORKDIR "/source/EmailApplication.Api"
RUN dotnet publish -c release -o /app --no-restore

# Use the ASP.NET runtime image for the final stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .

# Expose the port the app runs on (typically 8080 in containers)
EXPOSE 8080 
ENTRYPOINT ["dotnet", "EmailApplication.Api.dll"] 