using System.Collections.Concurrent;
using System.Security.Cryptography;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://0.0.0.0:5080");

builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();

var sessions = new ConcurrentDictionary<string, ClassroomSession>();
var sessionLifetime = TimeSpan.FromHours(4);

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapPost("/api/sessions", () =>
{
    CleanupExpiredSessions(sessions, sessionLifetime);
    string code;
    do { code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6"); }
    while (sessions.ContainsKey(code));

    var session = new ClassroomSession(code, DateTimeOffset.UtcNow);
    sessions[code] = session;
    return Results.Created($"/api/sessions/{code}", new { code, createdAt = session.CreatedAt });
});

app.MapGet("/api/sessions/{code}", (string code) =>
{
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime))
        return Results.NotFound(new { message = "La sesión no existe o ya expiró." });

    return Results.Ok(new { code = session.Code, active = true });
});

app.MapPost("/api/sessions/{code}/students", (string code, JoinRequest request) =>
{
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime))
        return Results.NotFound(new { message = "La sesión no existe o ya expiró." });

    var name = (request.Name ?? string.Empty).Trim();
    if (name.Length is < 2 or > 60)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["El nombre debe tener entre 2 y 60 caracteres."] });

    var studentId = Guid.NewGuid().ToString("N");
    session.Students[studentId] = name;
    return Results.Ok(new { studentId, sessionCode = code, joined = true });
});

app.MapGet("/api/sessions/{code}/students", (string code) =>
{
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime))
        return Results.NotFound(new { message = "La sesión no existe o ya expiró." });

    return Results.Ok(new { count = session.Students.Count, students = session.Students.Select(pair => new { id = pair.Key, name = pair.Value }) });
});

app.Run();

static bool IsSessionCode(string code) => code.Length == 6 && code.All(char.IsAsciiDigit);
static bool IsExpired(ClassroomSession session, TimeSpan lifetime) => DateTimeOffset.UtcNow - session.CreatedAt > lifetime;
static void CleanupExpiredSessions(ConcurrentDictionary<string, ClassroomSession> sessions, TimeSpan lifetime)
{
    foreach (var pair in sessions)
        if (IsExpired(pair.Value, lifetime)) sessions.TryRemove(pair.Key, out _);
}

sealed class ClassroomSession(string code, DateTimeOffset createdAt)
{
    public string Code { get; } = code;
    public DateTimeOffset CreatedAt { get; } = createdAt;
    public ConcurrentDictionary<string, string> Students { get; } = new();
}

sealed record JoinRequest(string? Name);
