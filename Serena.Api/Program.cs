using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://0.0.0.0:5080;https://localhost:5081");
var app = builder.Build();

var sessions = new ConcurrentDictionary<string, ClassroomSession>();
var teacherSessions = new ConcurrentDictionary<string, TeacherSession>();
var loginAttempts = new ConcurrentDictionary<string, LoginAttemptWindow>();
var sessionLifetime = TimeSpan.FromHours(4);
var teacherSessionLifetime = TimeSpan.FromHours(8);
const string sessionCookieName = "Serena.Session";
var apiContentRoot = File.Exists(Path.Combine(app.Environment.ContentRootPath, "Serena.Api.csproj"))
    ? app.Environment.ContentRootPath
    : Path.Combine(app.Environment.ContentRootPath, "Serena.Api");
var usersPath = Path.Combine(apiContentRoot, "Data", "teachers.json");
var dummyCredential = new TeacherCredential("", "AAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", 600_000);
EnsureDefaultTeacher(usersPath);

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapPost("/api/auth/login", (HttpContext context, LoginRequest request) =>
{
    if (!context.Request.IsHttps) return Results.BadRequest(new { message = "HTTPS is required." });
    context.Response.Headers.CacheControl = "no-store";
    if (string.IsNullOrWhiteSpace(request.Email) || request.Email.Length > 254
        || string.IsNullOrEmpty(request.Password) || request.Password.Length > 128)
        return Results.BadRequest(new { message = "Invalid credentials." });

    var clientKey = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    var now = DateTimeOffset.UtcNow;
    var attempts = loginAttempts.AddOrUpdate(clientKey,
        _ => new LoginAttemptWindow(now, 1),
        (_, current) => now - current.StartedAt > TimeSpan.FromMinutes(15)
            ? new LoginAttemptWindow(now, 1)
            : current with { Count = current.Count + 1 });
    if (attempts.Count > 10) return Results.StatusCode(StatusCodes.Status429TooManyRequests);

    var email = request.Email.Trim();
    var user = ReadTeacherUsers(usersPath).FirstOrDefault(candidate =>
        string.Equals(candidate.Email, email, StringComparison.OrdinalIgnoreCase));
    var passwordMatches = VerifyPassword(request.Password, user ?? dummyCredential);
    if (user is null || !passwordMatches) return Results.Unauthorized();

    loginAttempts.TryRemove(clientKey, out _);
    var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    teacherSessions[token] = new TeacherSession(user.Email, now.Add(teacherSessionLifetime));
    context.Response.Cookies.Append(sessionCookieName, token, new CookieOptions
    {
        HttpOnly = true,
        Secure = true,
        SameSite = SameSiteMode.Strict,
        IsEssential = true,
        Path = "/",
        Expires = now.Add(teacherSessionLifetime)
    });
    return Results.Ok(new { authenticated = true, email = user.Email });
});

app.MapGet("/api/auth/me", (HttpContext context) =>
{
    if (!context.Request.IsHttps || !TryGetTeacher(context, teacherSessions, sessionCookieName, out var teacher))
        return Results.Unauthorized();
    context.Response.Headers.CacheControl = "no-store";
    return Results.Ok(new { email = teacher.Email });
});

app.MapPost("/api/auth/logout", (HttpContext context) =>
{
    if (context.Request.Cookies.TryGetValue(sessionCookieName, out var token)) teacherSessions.TryRemove(token, out _);
    context.Response.Cookies.Delete(sessionCookieName, new CookieOptions
    {
        HttpOnly = true, Secure = true, SameSite = SameSiteMode.Strict, Path = "/"
    });
    return Results.Ok(new { loggedOut = true });
});

app.MapPost("/api/sessions", (HttpContext context) =>
{
    if (!context.Request.IsHttps || !TryGetTeacher(context, teacherSessions, sessionCookieName, out var teacher))
        return Results.Unauthorized();
    CleanupExpiredSessions(sessions, sessionLifetime);
    string code;
    do { code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6"); }
    while (sessions.ContainsKey(code));
    var session = new ClassroomSession(code, DateTimeOffset.UtcNow, teacher.Email);
    sessions[code] = session;
    return Results.Created($"/api/sessions/{code}", new { code, createdAt = session.CreatedAt });
});

app.MapGet("/api/sessions/{code}", (string code) =>
{
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime))
        return Results.NotFound(new { message = "Session does not exist or has expired." });
    return Results.Ok(new { code = session.Code, active = true, narrativeStarted = session.NarrativeStarted });
});

app.MapPost("/api/sessions/{code}/narrative/start", (HttpContext context, string code) =>
{
    if (!context.Request.IsHttps || !TryGetTeacher(context, teacherSessions, sessionCookieName, out var teacher))
        return Results.Unauthorized();
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime)
        || !string.Equals(session.TeacherEmail, teacher.Email, StringComparison.OrdinalIgnoreCase))
        return Results.NotFound(new { message = "Session does not exist or has expired." });

    session.NarrativeStarted = true;
    return Results.Ok(new { started = true });
});

app.MapPost("/api/sessions/{code}/students", (string code, JoinRequest request) =>
{
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime))
        return Results.NotFound(new { message = "Session does not exist or has expired." });
    var name = (request.Name ?? string.Empty).Trim();
    if (name.Length is < 2 or > 60)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["Name must contain between 2 and 60 characters."] });
    // Each join receives its own identifier. That intentionally allows the same
    // person (or display name) to join a session more than once.
    var studentId = Guid.NewGuid().ToString("N");
    session.Students[studentId] = new StudentConnection(name, false, DateTimeOffset.UtcNow);
    return Results.Ok(new { studentId, sessionCode = code, joined = true });
});

app.MapPost("/api/sessions/{code}/students/{studentId}/heartbeat", (string code, string studentId) =>
{
    if (!TryGetStudent(sessions, code, studentId, sessionLifetime, out var session, out var student))
        return Results.NotFound(new { message = "Student session does not exist or has expired." });

    session.Students[studentId] = student with { LastSeenAt = DateTimeOffset.UtcNow };
    return Results.NoContent();
});

app.MapPost("/api/sessions/{code}/students/{studentId}/ready", (string code, string studentId, ReadyRequest request) =>
{
    if (!TryGetStudent(sessions, code, studentId, sessionLifetime, out var session, out var student))
        return Results.NotFound(new { message = "Student session does not exist or has expired." });

    // A readiness update is also proof that Unity is still connected.
    session.Students[studentId] = student with { Ready = request.Ready, LastSeenAt = DateTimeOffset.UtcNow };
    return Results.NoContent();
});

app.MapPost("/api/sessions/{code}/students/{studentId}/disconnect", (string code, string studentId) =>
{
    if (!TryGetStudent(sessions, code, studentId, sessionLifetime, out var session, out var student))
        return Results.NotFound(new { message = "Student session does not exist or has expired." });

    // Used by OnApplicationQuit. Unexpected closes are handled by heartbeat expiry.
    session.Students[studentId] = student with { LastSeenAt = DateTimeOffset.MinValue };
    return Results.NoContent();
});

app.MapGet("/api/sessions/{code}/students", (HttpContext context, string code) =>
{
    if (!context.Request.IsHttps || !TryGetTeacher(context, teacherSessions, sessionCookieName, out var teacher))
        return Results.Unauthorized();
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime)
        || !string.Equals(session.TeacherEmail, teacher.Email, StringComparison.OrdinalIgnoreCase))
        return Results.NotFound(new { message = "Session does not exist or has expired." });
    context.Response.Headers.CacheControl = "no-store";
    var now = DateTimeOffset.UtcNow;
    RemoveInactiveStudents(session, now);
    return Results.Ok(new
    {
        count = session.Students.Count,
        students = session.Students.Select(pair => new
        {
            id = pair.Key,
            name = pair.Value.Name,
            ready = pair.Value.Ready,
            connected = IsStudentConnected(pair.Value, now)
        })
    });
});

// Unity uses this read-only roster endpoint to show the students in the same
// classroom. The session code is the access key; no teacher cookie is needed.
app.MapGet("/api/sessions/{code}/students/roster", (string code) =>
{
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime))
        return Results.NotFound(new { message = "Session does not exist or has expired." });

    var now = DateTimeOffset.UtcNow;
    RemoveInactiveStudents(session, now);
    return Results.Ok(new
    {
        count = session.Students.Count,
        students = session.Students.Select(pair => new
        {
            id = pair.Key,
            name = pair.Value.Name,
            ready = pair.Value.Ready,
            connected = IsStudentConnected(pair.Value, now)
        })
    });
});

app.Run();

static List<TeacherCredential> ReadTeacherUsers(string path)
{
    try
    {
        if (!File.Exists(path)) return [];
        var store = JsonSerializer.Deserialize<TeacherStore>(File.ReadAllText(path), new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        return store?.Users ?? [];
    }
    catch (JsonException) { return []; }
    catch (IOException) { return []; }
}

static bool VerifyPassword(string password, TeacherCredential user)
{
    try
    {
        if (string.IsNullOrWhiteSpace(user.Salt) || string.IsNullOrWhiteSpace(user.PasswordHash)) return false;
        if (user.Iterations is < 100_000 or > 2_000_000) return false;
        var salt = Convert.FromBase64String(user.Salt);
        var expected = Convert.FromBase64String(user.PasswordHash);
        if (salt.Length < 16 || expected.Length < 32) return false;
        var actual = Rfc2898DeriveBytes.Pbkdf2(password, salt, user.Iterations, HashAlgorithmName.SHA256, expected.Length);
        var matches = CryptographicOperations.FixedTimeEquals(actual, expected);
        CryptographicOperations.ZeroMemory(actual);
        return matches;
    }
    catch (FormatException) { return false; }
    catch (ArgumentException) { return false; }
}

static bool TryGetTeacher(HttpContext context, ConcurrentDictionary<string, TeacherSession> sessions, string cookieName, out TeacherSession teacher)
{
    teacher = null!;
    if (!context.Request.Cookies.TryGetValue(cookieName, out var token) || !sessions.TryGetValue(token, out var found)) return false;
    if (found.ExpiresAt <= DateTimeOffset.UtcNow)
    {
        sessions.TryRemove(token, out _);
        return false;
    }
    teacher = found;
    return true;
}

static bool IsSessionCode(string code) => code.Length == 6 && code.All(char.IsAsciiDigit);
static bool IsExpired(ClassroomSession session, TimeSpan lifetime) => DateTimeOffset.UtcNow - session.CreatedAt > lifetime;
static bool IsStudentConnected(StudentConnection student, DateTimeOffset now) => now - student.LastSeenAt <= TimeSpan.FromSeconds(8);
static void RemoveInactiveStudents(ClassroomSession session, DateTimeOffset now)
{
    foreach (var pair in session.Students)
        if (now - pair.Value.LastSeenAt >= TimeSpan.FromSeconds(10))
            session.Students.TryRemove(pair.Key, out _);
}

static void EnsureDefaultTeacher(string path)
{
    const string defaultEmail = "docente@gmail.com";
    // This is a PBKDF2 hash for the documented default password. The password is
    // never stored in this file or in teachers.json as plain text.
    var defaultTeacher = new TeacherCredential(
        defaultEmail,
        "Np7u16CMWTfgZvQ9/7F9Sw==",
        "IAlqQAOzoU4RdBQ4YUe2eOtwIj39vQzTgm2QaSXyMtM=",
        600_000);
    var users = ReadTeacherUsers(path);
    var existingIndex = users.FindIndex(user => string.Equals(user.Email, defaultEmail, StringComparison.OrdinalIgnoreCase));

    if (existingIndex >= 0) users[existingIndex] = defaultTeacher;
    else users.Add(defaultTeacher);

    Directory.CreateDirectory(Path.GetDirectoryName(path)!);
    var json = JsonSerializer.Serialize(new TeacherStore(users), new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    });
    File.WriteAllText(path, json);
}
static bool TryGetStudent(ConcurrentDictionary<string, ClassroomSession> sessions, string code, string studentId, TimeSpan lifetime, out ClassroomSession session, out StudentConnection student)
{
    session = null!;
    student = null!;
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var foundSession) || IsExpired(foundSession, lifetime)
        || !foundSession.Students.TryGetValue(studentId, out var foundStudent)) return false;
    session = foundSession;
    student = foundStudent;
    return true;
}
static void CleanupExpiredSessions(ConcurrentDictionary<string, ClassroomSession> sessions, TimeSpan lifetime)
{
    foreach (var pair in sessions)
        if (IsExpired(pair.Value, lifetime)) sessions.TryRemove(pair.Key, out _);
}

sealed record TeacherStore(List<TeacherCredential> Users);
sealed record TeacherCredential(string Email, string Salt, string PasswordHash, int Iterations);
sealed record TeacherSession(string Email, DateTimeOffset ExpiresAt);
sealed record LoginAttemptWindow(DateTimeOffset StartedAt, int Count);
sealed record LoginRequest(string? Email, string? Password);
sealed record JoinRequest(string? Name);
sealed record ReadyRequest(bool Ready);
sealed record StudentConnection(string Name, bool Ready, DateTimeOffset LastSeenAt);

sealed class ClassroomSession(string code, DateTimeOffset createdAt, string teacherEmail)
{
    public string Code { get; } = code;
    public DateTimeOffset CreatedAt { get; } = createdAt;
    public string TeacherEmail { get; } = teacherEmail;
    public bool NarrativeStarted { get; set; }
    public ConcurrentDictionary<string, StudentConnection> Students { get; } = new();
}
