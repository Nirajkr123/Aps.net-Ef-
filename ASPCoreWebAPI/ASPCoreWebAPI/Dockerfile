FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ASPCoreWebAPI.csproj ./
RUN dotnet restore ASPCoreWebAPI.csproj

COPY . .
RUN dotnet publish ASPCoreWebAPI.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:10000
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000

COPY --from=build /app/publish ./
ENTRYPOINT ["dotnet", "ASPCoreWebAPI.dll"]
