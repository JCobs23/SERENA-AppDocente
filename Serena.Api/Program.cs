using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Net.WebSockets;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls("http://0.0.0.0:5080;https://localhost:5081");
var app = builder.Build();
app.UseWebSockets();

var sessions = new ConcurrentDictionary<string, ClassroomSession>();
var teacherSessions = new ConcurrentDictionary<string, TeacherSession>();
var loginAttempts = new ConcurrentDictionary<string, LoginAttemptWindow>();
var sessionLifetime = TimeSpan.FromHours(4);
var studentDisconnectAfter = TimeSpan.FromSeconds(15);
var teacherSessionLifetime = TimeSpan.FromHours(8);
const string sessionCookieName = "Serena.Session";
var narrativeStages = new[]
{
    (Title: "En espera", Description: "Esperando a que el docente inicie la experiencia."),
    (Title: "Narrativa inicial", Description: "Observa la situación y comprende el contexto."),
    (Title: "Reconocer la emoción", Description: "Identifica qué emoción aparece en esta situación."),
    (Title: "Elegir una decisión", Description: "Piensa en las alternativas y elige cómo actuar."),
    (Title: "Ver las consecuencias", Description: "Observa el efecto de la decisión en las demás personas."),
    (Title: "Reflexionar en grupo", Description: "Comparte una reflexión sobre lo ocurrido.")
};
NarrativeClientState BuildNarrativeState(ClassroomSession classroom)
{
    var state = classroom.GetNarrativeState();
    var stage = state.Started && state.Stage == 0
        ? (Title: "Introducción", Description: "Mira el video introductorio antes de comenzar la narrativa.")
        : narrativeStages[state.Stage];
    return new NarrativeClientState(
        state.Started, state.Stage, stage.Title, stage.Description, state.Revision,
        classroom.Presence.Values.Count(student => student.IsConnected),
        classroom.Presence.Values.Count(student => student.IsConnected && student.IsReady),
        classroom.Presence.Values.Count(student => student.IsConnected && student.IsIntroCompleted)
    );
}
var apiContentRoot = File.Exists(Path.Combine(app.Environment.ContentRootPath, "Serena.Api.csproj"))
    ? app.Environment.ContentRootPath
    : Path.Combine(app.Environment.ContentRootPath, "Serena.Api");
var usersPath = Path.Combine(apiContentRoot, "Data", "teachers.json");
var dummyCredential = new TeacherCredential("", "AAAAAAAAAAAAAAAAAAAAAA==", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=", 600_000);

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
    var narrativeState = BuildNarrativeState(session);
    return Results.Ok(new
    {
        code = session.Code,
        active = true,
        narrativeState.NarrativeStarted,
        narrativeState.Stage,
        narrativeState.StageLabel,
        narrativeState.StageDescription,
        narrativeState.Revision,
        narrativeState.ConnectedStudents,
        narrativeState.ReadyStudents,
        narrativeState.IntroCompletedStudents
    });
});

app.MapPost("/api/sessions/{code}/students", (string code, JoinRequest request) =>
{
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime))
        return Results.NotFound(new { message = "Session does not exist or has expired." });
    var name = (request.Name ?? string.Empty).Trim();
    if (name.Length is < 2 or > 60)
        return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["Name must contain between 2 and 60 characters."] });
    var now = DateTimeOffset.UtcNow;
    var requestedStudentId = Guid.TryParseExact(request.StudentId, "N", out _) ? request.StudentId! : Guid.NewGuid().ToString("N");
    StudentPresence student;
    string eventType;
    if (session.Presence.TryGetValue(requestedStudentId, out var existing))
    { student = existing; eventType = student.MarkConnected(now) ? "reconnected" : "heartbeat"; }
    else
    {
        var candidate = new StudentPresence(requestedStudentId, name, now);
        student = session.Presence.GetOrAdd(requestedStudentId, candidate);
        if (ReferenceEquals(student, candidate)) eventType = "connected";
        else eventType = student.MarkConnected(now) ? "reconnected" : "heartbeat";
    }
    if (eventType != "heartbeat") _ = session.BroadcastStudentAsync(eventType, student);
    return Results.Ok(new { studentId = student.Id, sessionCode = code, joined = true });
});

app.MapPost("/api/sessions/{code}/students/{studentId}/ready", async (string code, string studentId, ReadyRequest request) =>
{
    if (!sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime)
        || !session.Presence.TryGetValue(studentId, out var student) || !student.IsConnected)
        return Results.NotFound();
    student.SetReady(request.Ready);
    await session.BroadcastStudentAsync("ready", student);
    return Results.Ok(new { ready = request.Ready });
});
app.MapPost("/api/sessions/{code}/students/{studentId}/intro-complete", async (string code, string studentId) =>
{
    if (!sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime)
        || !session.Presence.TryGetValue(studentId, out var student) || !student.IsConnected)
        return Results.NotFound();
    if (!session.GetNarrativeState().Started)
        return Results.Conflict(new { message = "The narrative has not started." });

    student.SetIntroCompleted(true);
    session.TryBeginNarrativeStages();
    await session.BroadcastNarrativeStateAsync(BuildNarrativeState(session));
    return Results.Ok(new { introCompleted = true });
});
app.MapPost("/api/sessions/{code}/students/{studentId}/heartbeat", (string code, string studentId) =>
{
    if (!sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime) || !session.Presence.TryGetValue(studentId, out var student)) return Results.NotFound();
    var reconnected = student.MarkHeartbeat(DateTimeOffset.UtcNow);
    if (reconnected) _ = session.BroadcastStudentAsync("reconnected", student);
    return Results.Ok(new { connected = true });
});
app.MapPost("/api/sessions/{code}/students/{studentId}/leave", (string code, string studentId) =>
{
    if (!sessions.TryGetValue(code, out var session) || !session.Presence.TryGetValue(studentId, out var student)) return Results.NotFound();
    if (student.MarkDisconnected()) _ = session.BroadcastStudentAsync("disconnected", student);
    return Results.Ok(new { connected = false });
});
app.MapPost("/api/sessions/{code}/start", async (HttpContext context, string code) =>
{
    if (!context.Request.IsHttps || !TryGetTeacher(context, teacherSessions, sessionCookieName, out var teacher))
        return Results.Unauthorized();
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime)
        || !string.Equals(session.TeacherEmail, teacher.Email, StringComparison.OrdinalIgnoreCase))
        return Results.NotFound(new { message = "Session does not exist or has expired." });
    var connectedStudents = session.Presence.Values.Where(student => student.IsConnected).ToArray();
    if (connectedStudents.Length < 1)
        return Results.Conflict(new { message = "Connect at least one student before starting." });
    if (connectedStudents.Any(student => !student.IsReady))
        return Results.Conflict(new { message = "Every connected student must be ready before starting." });

    session.StartNarrative();
    var state = BuildNarrativeState(session);
    await session.BroadcastNarrativeStateAsync(state);
    return Results.Ok(state);
});

app.MapPost("/api/sessions/{code}/stage", async (HttpContext context, string code, StageChangeRequest request) =>
{
    if (!context.Request.IsHttps || !TryGetTeacher(context, teacherSessions, sessionCookieName, out var teacher))
        return Results.Unauthorized();
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime)
        || !string.Equals(session.TeacherEmail, teacher.Email, StringComparison.OrdinalIgnoreCase))
        return Results.NotFound(new { message = "Session does not exist or has expired." });
    var narrativeState = session.GetNarrativeState();
    if (!narrativeState.Started)
        return Results.Conflict(new { message = "Start the narrative before changing stages." });
    var connectedStudents = session.Presence.Values.Where(student => student.IsConnected).ToArray();
    if (narrativeState.Stage == 0 || connectedStudents.Length == 0 || connectedStudents.Any(student => !student.IsIntroCompleted))
        return Results.Conflict(new { message = "Wait until every connected student has completed the introduction." });
    if (request.Direction is not (-1 or 1))
        return Results.BadRequest(new { message = "Direction must be -1 or 1." });

    if (session.ChangeStage(request.Direction, narrativeStages.Length - 1))
        await session.BroadcastNarrativeStateAsync(BuildNarrativeState(session));
    return Results.Ok(BuildNarrativeState(session));
});
app.MapMethods("/api/sessions/{code}/stream", ["GET"], async (HttpContext context, string code) =>
{
    if (!context.Request.IsHttps || !TryGetTeacher(context, teacherSessions, sessionCookieName, out var teacher)) { context.Response.StatusCode = 401; return; }
    if (!sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime) || !string.Equals(session.TeacherEmail, teacher.Email, StringComparison.OrdinalIgnoreCase)) { context.Response.StatusCode = 404; return; }
    if (!context.WebSockets.IsWebSocketRequest) { context.Response.StatusCode = 400; return; }
    using var socket = await context.WebSockets.AcceptWebSocketAsync();
    var streamId = Guid.NewGuid().ToString("N"); var stream = new TeacherStream(socket); session.TeacherStreams[streamId] = stream;
    try
    {
        await stream.SendAsync(new { type = "snapshot", students = session.Presence.Values.Select(student => student.ToDto()) }, context.RequestAborted);
        await stream.SendAsync(new { type = "narrative-state", state = BuildNarrativeState(session) }, context.RequestAborted);
        var buffer = new byte[256];
        while (socket.State == WebSocketState.Open && !context.RequestAborted.IsCancellationRequested) { var result = await socket.ReceiveAsync(buffer, context.RequestAborted); if (result.MessageType == WebSocketMessageType.Close) break; }
    }
    catch (OperationCanceledException) { } catch (WebSocketException) { }
    finally { session.TeacherStreams.TryRemove(streamId, out _); if (socket.State is WebSocketState.Open or WebSocketState.CloseReceived) await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Stream closed", CancellationToken.None); }
});

app.MapGet("/api/sessions/{code}/students/roster", (string code, string studentId) =>
{
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime) || !session.Presence.ContainsKey(studentId))
        return Results.NotFound(new { message = "Session does not exist or has expired." });
    var students = session.Presence.Values.Select(student => student.ToDto()).ToArray();
    var count = session.Presence.Values.Count(student => student.IsConnected);
    return Results.Ok(new { count, students });
});
app.MapGet("/api/sessions/{code}/students", (HttpContext context, string code) =>
{
    if (!context.Request.IsHttps || !TryGetTeacher(context, teacherSessions, sessionCookieName, out var teacher))
        return Results.Unauthorized();
    if (!IsSessionCode(code) || !sessions.TryGetValue(code, out var session) || IsExpired(session, sessionLifetime)
        || !string.Equals(session.TeacherEmail, teacher.Email, StringComparison.OrdinalIgnoreCase))
        return Results.NotFound(new { message = "Session does not exist or has expired." });
    context.Response.Headers.CacheControl = "no-store";
    var students = session.Presence.Values.Select(student => student.ToDto()).ToArray();
    return Results.Ok(new { count = students.Length, students });
});

using var presenceMonitor = new Timer(state =>
{
    var now = DateTimeOffset.UtcNow;
    foreach (var session in sessions.Values)
    foreach (var student in session.Presence.Values)
        if (student.IsConnected && now - student.LastSeenAt > studentDisconnectAfter && student.MarkDisconnected()) _ = session.BroadcastStudentAsync("disconnected", student);
}, null, TimeSpan.FromSeconds(2), TimeSpan.FromSeconds(2));
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
sealed record JoinRequest(string? Name, string? StudentId = null);
sealed record ReadyRequest(bool Ready);
sealed record StageChangeRequest(int Direction);
sealed record NarrativeClientState(bool NarrativeStarted, int Stage, string StageLabel, string StageDescription, int Revision, int ConnectedStudents, int ReadyStudents, int IntroCompletedStudents);

sealed class ClassroomSession(string code, DateTimeOffset createdAt, string teacherEmail)
{
    private readonly object stateGate = new();
    private bool narrativeStarted;
    private int currentStage;
    private int revision;

    public string Code { get; } = code;
    public DateTimeOffset CreatedAt { get; } = createdAt;
    public string TeacherEmail { get; } = teacherEmail;
    public ConcurrentDictionary<string, StudentPresence> Presence { get; } = new();
    public ConcurrentDictionary<string, TeacherStream> TeacherStreams { get; } = new();

    public (bool Started, int Stage, int Revision) GetNarrativeState()
    {
        lock (stateGate) return (narrativeStarted, currentStage, revision);
    }

    public void StartNarrative()
    {
        lock (stateGate)
        {
            if (narrativeStarted) return;
            narrativeStarted = true;
            foreach (var student in Presence.Values) student.SetIntroCompleted(false);
            currentStage = 0;
            revision++;
        }
    }

    public bool TryBeginNarrativeStages()
    {
        lock (stateGate)
        {
            if (!narrativeStarted || currentStage != 0) return false;
            var connectedStudents = Presence.Values.Where(student => student.IsConnected).ToArray();
            if (connectedStudents.Length == 0 || connectedStudents.Any(student => !student.IsIntroCompleted)) return false;
            currentStage = 1;
            revision++;
            return true;
        }
    }

    public bool ChangeStage(int direction, int maxStage)
    {
        lock (stateGate)
        {
            var nextStage = Math.Clamp(currentStage + direction, 1, maxStage);
            if (nextStage == currentStage) return false;
            currentStage = nextStage;
            revision++;
            return true;
        }
    }

    public async Task BroadcastStudentAsync(string eventType, StudentPresence student)
    {
        var payload = new { type = "student-status", @event = eventType, student = student.ToDto() };
        await Task.WhenAll(TeacherStreams.Values.Select(stream => stream.SendAsync(payload, CancellationToken.None)));
    }

    public async Task BroadcastNarrativeStateAsync(object state)
    {
        var payload = new { type = "narrative-state", state };
        await Task.WhenAll(TeacherStreams.Values.Select(stream => stream.SendAsync(payload, CancellationToken.None)));
    }
}
sealed class StudentPresence(string id, string name, DateTimeOffset now)
{
    private readonly object gate = new();
    private readonly string name = name;
    private bool connected = true;
    private bool ready;
    private bool introCompleted;
    private DateTimeOffset lastSeenAt = now;

    public string Id { get; } = id;
    public DateTimeOffset LastSeenAt { get { lock (gate) return lastSeenAt; } }
    public bool IsConnected { get { lock (gate) return connected; } }
    public bool IsReady { get { lock (gate) return ready; } }
    public bool IsIntroCompleted { get { lock (gate) return introCompleted; } }

    public bool MarkConnected(DateTimeOffset at)
    {
        lock (gate)
        {
            var changed = !connected;
            connected = true;
            lastSeenAt = at;
            if (changed) ready = false;
            return changed;
        }
    }

    public bool MarkHeartbeat(DateTimeOffset at)
    {
        lock (gate)
        {
            var changed = !connected;
            connected = true;
            lastSeenAt = at;
            if (changed) ready = false;
            return changed;
        }
    }

    public void SetReady(bool value) { lock (gate) ready = value; }
    public void SetIntroCompleted(bool value) { lock (gate) introCompleted = value; }

    public bool MarkDisconnected()
    {
        lock (gate)
        {
            if (!connected) return false;
            connected = false;
            ready = false;
            return true;
        }
    }

    public object ToDto() { lock (gate) return new { id = Id, name, ready, connected, introCompleted }; }
}
sealed class TeacherStream(WebSocket socket)
{
    private readonly SemaphoreSlim sendLock=new(1,1);
    public async Task SendAsync<T>(T payload,CancellationToken token) { if(socket.State!=WebSocketState.Open)return; var bytes=JsonSerializer.SerializeToUtf8Bytes(payload,new JsonSerializerOptions(JsonSerializerDefaults.Web)); await sendLock.WaitAsync(token); try { if(socket.State==WebSocketState.Open) await socket.SendAsync(bytes,WebSocketMessageType.Text,true,token); } catch(WebSocketException) { } finally { sendLock.Release(); } }
}
