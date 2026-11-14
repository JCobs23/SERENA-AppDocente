using System.Net.Mail;
using System.Text;
using System.Text.Json;

sealed record ReflectionAggregate(int Question, int Yes, int No, int Unanswered);

// H.U. 11.3.2: respuesta anónima (sin nombre ni identificador) para el detalle del resumen.
sealed record AnonymousResponse(string? Emotion, string? Decision, string? Reflection);

sealed record SessionReportSummary(
    string ReportId,
    string SessionCode,
    DateTimeOffset CreatedAt,
    string Status,
    int ParticipantCount,
    int ConnectedParticipants,
    int StageReached,
    string AdvanceMode,
    string? FinalDecision,
    Dictionary<string, int> EmotionCounts,
    Dictionary<string, int> DecisionCounts,
    int ContinueVotes,
    int AlternativeVotes,
    List<ReflectionAggregate> Reflections,
    // Campos opcionales: los reportes guardados antes de este cambio no los tienen.
    List<AnonymousResponse>? Responses = null,
    List<string>? ExploredDecisions = null);

sealed record StoredSessionReport(
    string ReportId,
    string SessionCode,
    DateTimeOffset CreatedAt,
    string TeacherEmail,
    string SummaryJson,
    byte[] Pdf,
    string? SentTo,
    DateTimeOffset? SentAt);

sealed record SessionReportListItem(
    string ReportId,
    string SessionCode,
    DateTimeOffset CreatedAt,
    string Status,
    int ParticipantCount,
    string? SentTo,
    DateTimeOffset? SentAt);

sealed class SessionReportService(SerenaDatabase database, IConfiguration configuration)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public IReadOnlyList<string> AuthorizedRecipients => configuration
        .GetSection("Reports:AuthorizedRecipients")
        .GetChildren()
        .Select(section => section.Value?.Trim())
        .Where(value => !string.IsNullOrWhiteSpace(value) && MailAddress.TryCreate(value, out _))
        .Select(value => value!)
        .Distinct(StringComparer.OrdinalIgnoreCase)
        .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
        .ToArray();

    public async Task SendAsync(StoredSessionReport report, string recipient, CancellationToken cancellationToken)
    {
        if (!AuthorizedRecipients.Contains(recipient, StringComparer.OrdinalIgnoreCase))
            throw new ArgumentException("The recipient is not authorized.", nameof(recipient));

        var smtp = configuration.GetSection("Reports:Smtp");
        var host = smtp["Host"];
        var username = smtp["Username"];
        var password = (Environment.GetEnvironmentVariable("SERENA_REPORTS_SMTP_PASSWORD") ?? smtp["Password"])
            ?.Replace(" ", string.Empty, StringComparison.Ordinal).Trim();
        var from = smtp["From"] ?? username;
        var port = int.TryParse(smtp["Port"], out var configuredPort) ? configuredPort : 587;
        var enableSsl = !bool.TryParse(smtp["EnableSsl"], out var configuredSsl) || configuredSsl;

        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(username)
            || string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(from)
            || !MailAddress.TryCreate(from, out _))
            throw new InvalidOperationException("Configure the SMTP server and the app password before sending reports.");

        using var message = new MailMessage
        {
            From = new MailAddress(from, "Serena"),
            Subject = "Student report",
            Body = $"Attached is the group report for session {report.SessionCode}. The document shows aggregated results and does not include student names or identifiers.",
            SubjectEncoding = Encoding.UTF8,
            BodyEncoding = Encoding.UTF8
        };
        message.To.Add(new MailAddress(recipient));
        message.Attachments.Add(new Attachment(
            new MemoryStream(report.Pdf), $"Student-report-{report.SessionCode}.pdf", "application/pdf"));

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = enableSsl,
            Credentials = new System.Net.NetworkCredential(username, password)
        };
        await client.SendMailAsync(message, cancellationToken);
    }
    public SessionReportSummary CreateOrGet(ClassroomSession session)
    {
        var existing = database.GetReportBySessionCode(session.Code);
        if (existing is not null)
            return JsonSerializer.Deserialize<SessionReportSummary>(existing.SummaryJson, JsonOptions)!;

        var snapshot = session.ExportSnapshot();
        var total = snapshot.Students.Count;
        var reflections = Enumerable.Range(0, 4).Select(index =>
        {
            var answers = snapshot.Students
                .Select(student => student.Reflection?.Split(',', StringSplitOptions.TrimEntries))
                .Where(values => values is { Length: 4 })
                .Select(values => values![index]);
            var yes = answers.Count(answer => answer == "yes");
            var no = answers.Count(answer => answer == "no");
            return new ReflectionAggregate(index + 1, yes, no, total - yes - no);
        }).ToList();

        var state = session.GetNarrativeState();
        var voting = session.GetVotingState();
        var summary = new SessionReportSummary(
            Guid.NewGuid().ToString("N"), session.Code, DateTimeOffset.UtcNow,
            state.Started && state.Stage >= 5 && voting.FinalDecision is not null ? "completed" : "partial",
            total, session.Presence.Values.Count(student => student.IsConnected), state.Stage,
            voting.Mode, voting.FinalDecision,
            Count(snapshot.Students.Select(student => student.Emotion)),
            Count(snapshot.Students.Select(student => student.Decision)),
            snapshot.Votes.Values.Count(value => value == "continue"),
            snapshot.Votes.Values.Count(value => value == "alternative"), reflections,
            // Orden por contenido (no por llegada) para no revelar quién respondió qué.
            snapshot.Students
                .Where(student => student.Emotion is not null || student.Decision is not null || student.Reflection is not null)
                .Select(student => new AnonymousResponse(student.Emotion, student.Decision, student.Reflection))
                .OrderBy(response => response.Decision ?? "￿", StringComparer.Ordinal)
                .ThenBy(response => response.Emotion ?? "￿", StringComparer.Ordinal)
                .ThenBy(response => response.Reflection ?? "￿", StringComparer.Ordinal)
                .ToList(),
            session.GetBlockedDecisions().ToList());

        var stored = database.SaveReport(summary, BuildPdf(summary));
        return JsonSerializer.Deserialize<SessionReportSummary>(stored.SummaryJson, JsonOptions)!;
    }

    private static Dictionary<string, int> Count(IEnumerable<string?> values) => values
        .Where(value => !string.IsNullOrWhiteSpace(value))
        .GroupBy(value => value!, StringComparer.Ordinal)
        .OrderBy(group => group.Key, StringComparer.Ordinal)
        .ToDictionary(group => group.Key, group => group.Count(), StringComparer.Ordinal);

    private static byte[] BuildPdf(SessionReportSummary report)
    {
        var lines = new List<string>
        {
            "SERENA - Group activity report",
            $"Session: {report.SessionCode}    Date (UTC): {report.CreatedAt:yyyy-MM-dd HH:mm}",
            $"Status: {(report.Status == "completed" ? "Completed" : "Partial/interrupted")}",
            $"Participants: {report.ParticipantCount}    Connected at the end: {report.ConnectedParticipants}",
            $"Stage reached: {report.StageReached} of 5    Advance mode: {report.AdvanceMode}",
            $"Teacher decision: {report.FinalDecision ?? "No decision"}",
            $"Votes: continue {report.ContinueVotes}    explore another decision {report.AlternativeVotes}",
            report.ExploredDecisions is { Count: > 0 }
                ? $"Most voted decisions in previous rounds: {string.Join(", ", report.ExploredDecisions)}"
                : "Decision rounds: 1",
            "",
            "Emotion distribution"
        };
        lines.AddRange(AsLines(report.EmotionCounts));
        lines.Add("");
        lines.Add("Decision distribution");
        lines.AddRange(AsLines(report.DecisionCounts));
        lines.Add("");
        lines.Add("Group reflection by question");
        lines.AddRange(report.Reflections.Select(value =>
            $"Question {value.Question}: yes {value.Yes}, no {value.No}, unanswered {value.Unanswered}"));
        lines.Add("");
        lines.Add("Anonymous report: it does not include student names or identifiers.");

        var content = new StringBuilder();
        var y = 790;
        for (var i = 0; i < lines.Count; i++)
        {
            var fontSize = i == 0 ? 18 : 11;
            var line = lines[i].Length > 88 ? lines[i][..88] : lines[i];
            var escaped = line.Replace("\\", "\\\\", StringComparison.Ordinal)
                .Replace("(", "\\(", StringComparison.Ordinal)
                .Replace(")", "\\)", StringComparison.Ordinal);
            content.Append($"BT /F1 {fontSize} Tf 48 {y} Td ({escaped}) Tj ET\n");
            y -= i == 0 ? 30 : 19;
        }

        var stream = Encoding.Latin1.GetBytes(content.ToString());
        var objects = new List<byte[]>
        {
            Encoding.ASCII.GetBytes("<< /Type /Catalog /Pages 2 0 R >>"),
            Encoding.ASCII.GetBytes("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
            Encoding.ASCII.GetBytes("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"),
            Encoding.ASCII.GetBytes("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"),
            JoinBytes(Encoding.ASCII.GetBytes($"<< /Length {stream.Length} >>\nstream\n"), stream, Encoding.ASCII.GetBytes("endstream"))
        };

        using var pdf = new MemoryStream();
        Write(pdf, Encoding.Latin1.GetBytes("%PDF-1.4\n%âãÏÓ\n"));
        var offsets = new List<long> { 0 };
        for (var index = 0; index < objects.Count; index++)
        {
            offsets.Add(pdf.Position);
            Write(pdf, Encoding.ASCII.GetBytes($"{index + 1} 0 obj\n"));
            Write(pdf, objects[index]);
            Write(pdf, Encoding.ASCII.GetBytes("\nendobj\n"));
        }

        var xref = pdf.Position;
        Write(pdf, Encoding.ASCII.GetBytes($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n"));
        foreach (var offset in offsets.Skip(1))
            Write(pdf, Encoding.ASCII.GetBytes($"{offset:0000000000} 00000 n \n"));
        Write(pdf, Encoding.ASCII.GetBytes($"trailer\n<< /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"));
        return pdf.ToArray();
    }

    private static IEnumerable<string> AsLines(Dictionary<string, int> counts) => counts.Count == 0
        ? ["No responses recorded"]
        : counts.Select(entry => $"{entry.Key}: {entry.Value}");

    private static byte[] JoinBytes(params byte[][] values)
    {
        using var stream = new MemoryStream();
        foreach (var value in values) Write(stream, value);
        return stream.ToArray();
    }

    private static void Write(Stream stream, byte[] bytes) => stream.Write(bytes, 0, bytes.Length);
}
