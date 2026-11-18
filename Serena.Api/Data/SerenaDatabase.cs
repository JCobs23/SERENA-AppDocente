using Microsoft.Data.Sqlite;

sealed class SerenaDatabase(string databasePath)
{
    private readonly string connectionString = new SqliteConnectionStringBuilder
    {
        DataSource = databasePath,
        ForeignKeys = true,
        Pooling = true
    }.ToString();
    private readonly object writeLock = new();
    private readonly Dictionary<string, string> lastSavedSnapshots = new(StringComparer.Ordinal);

    public void Initialize(IEnumerable<TeacherCredential> seedTeachers)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS Teachers (
                Email TEXT PRIMARY KEY COLLATE NOCASE,
                Salt TEXT NOT NULL,
                PasswordHash TEXT NOT NULL,
                Iterations INTEGER NOT NULL CHECK (Iterations BETWEEN 100000 AND 2000000)
            );
            CREATE TABLE IF NOT EXISTS ClassroomSessions (
                Code TEXT PRIMARY KEY,
                CreatedAt TEXT NOT NULL,
                TeacherEmail TEXT NOT NULL,
                NarrativeStarted INTEGER NOT NULL,
                CurrentStage INTEGER NOT NULL,
                Revision INTEGER NOT NULL,
                MediaPaused INTEGER NOT NULL,
                MediaPositionSeconds REAL NOT NULL,
                MediaRevision INTEGER NOT NULL,
                MediaCommand TEXT NOT NULL,
                VolumePercent INTEGER NOT NULL DEFAULT 70,
                AdvanceMode TEXT NOT NULL,
                VotingOpen INTEGER NOT NULL,
                FinalDecision TEXT,
                VoteRound INTEGER NOT NULL,
                FOREIGN KEY (TeacherEmail) REFERENCES Teachers(Email)
            );
            CREATE TABLE IF NOT EXISTS Students (
                SessionCode TEXT NOT NULL,
                StudentId TEXT NOT NULL,
                Name TEXT NOT NULL,
                Ready INTEGER NOT NULL,
                IntroCompleted INTEGER NOT NULL,
                PRIMARY KEY (SessionCode, StudentId),
                FOREIGN KEY (SessionCode) REFERENCES ClassroomSessions(Code) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS StudentInteractions (
                SessionCode TEXT NOT NULL,
                StudentId TEXT NOT NULL,
                Emotion TEXT,
                Decision TEXT,
                Reflection TEXT,
                PRIMARY KEY (SessionCode, StudentId),
                FOREIGN KEY (SessionCode, StudentId) REFERENCES Students(SessionCode, StudentId) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS Votes (
                SessionCode TEXT NOT NULL,
                StudentId TEXT NOT NULL,
                Choice TEXT NOT NULL CHECK (Choice IN ('continue', 'alternative')),
                PRIMARY KEY (SessionCode, StudentId),
                FOREIGN KEY (SessionCode, StudentId) REFERENCES Students(SessionCode, StudentId) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS SessionReports (
                ReportId TEXT PRIMARY KEY,
                SessionCode TEXT NOT NULL UNIQUE,
                TeacherEmail TEXT NOT NULL,
                CreatedAt TEXT NOT NULL,
                SummaryJson TEXT NOT NULL,
                Pdf BLOB NOT NULL,
                SentTo TEXT,
                SentAt TEXT
            );
            CREATE INDEX IF NOT EXISTS IX_ClassroomSessions_CreatedAt ON ClassroomSessions(CreatedAt);
            PRAGMA user_version = 1;
            """;
        command.ExecuteNonQuery();
        EnsureVolumeColumn(connection);
        foreach (var teacher in seedTeachers)
            UpsertTeacher(teacher);
    }

    private static void EnsureVolumeColumn(SqliteConnection connection)
    {
        var hasVolumeColumn = false;
        using (var command = connection.CreateCommand())
        {
            command.CommandText = "PRAGMA table_info(ClassroomSessions);";
            using var reader = command.ExecuteReader();
            while (reader.Read())
                if (string.Equals(reader.GetString(1), "VolumePercent", StringComparison.OrdinalIgnoreCase))
                    hasVolumeColumn = true;
        }

        using var migration = connection.CreateCommand();
        if (!hasVolumeColumn)
            migration.CommandText = "ALTER TABLE ClassroomSessions ADD COLUMN VolumePercent INTEGER NOT NULL DEFAULT 70; PRAGMA user_version = 2;";
        else
            migration.CommandText = "PRAGMA user_version = 2;";
        migration.ExecuteNonQuery();
    }

    public List<TeacherCredential> ReadTeacherCredentials()
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT Email, Salt, PasswordHash, Iterations FROM Teachers ORDER BY Email;";
        using var reader = command.ExecuteReader();
        var teachers = new List<TeacherCredential>();
        while (reader.Read())
            teachers.Add(new TeacherCredential(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3)));
        return teachers;
    }

    public void UpsertTeacher(TeacherCredential teacher)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO Teachers (Email, Salt, PasswordHash, Iterations)
            VALUES ($email, $salt, $hash, $iterations)
            ON CONFLICT(Email) DO UPDATE SET
                Salt = excluded.Salt,
                PasswordHash = excluded.PasswordHash,
                Iterations = excluded.Iterations;
            """;
        command.Parameters.AddWithValue("$email", teacher.Email.Trim());
        command.Parameters.AddWithValue("$salt", teacher.Salt);
        command.Parameters.AddWithValue("$hash", teacher.PasswordHash);
        command.Parameters.AddWithValue("$iterations", teacher.Iterations);
        command.ExecuteNonQuery();
    }

    public void SaveSession(ClassroomSessionSnapshot snapshot)
    {
        var fingerprint = System.Text.Json.JsonSerializer.Serialize(snapshot);
        lock (writeLock)
        {
            if (lastSavedSnapshots.TryGetValue(snapshot.Code, out var previous) && previous == fingerprint)
                return;

            using var connection = Open();
            using var transaction = connection.BeginTransaction();
            using (var command = connection.CreateCommand())
            {
                command.Transaction = transaction;
                command.CommandText = """
                    INSERT INTO ClassroomSessions
                        (Code, CreatedAt, TeacherEmail, NarrativeStarted, CurrentStage, Revision,
                         MediaPaused, MediaPositionSeconds, MediaRevision, MediaCommand, VolumePercent, AdvanceMode,
                         VotingOpen, FinalDecision, VoteRound)
                    VALUES
                        ($code, $createdAt, $teacherEmail, $started, $stage, $revision,
                         $mediaPaused, $mediaPosition, $mediaRevision, $mediaCommand, $volumePercent, $advanceMode,
                         $votingOpen, $finalDecision, $voteRound)
                    ON CONFLICT(Code) DO UPDATE SET
                        CreatedAt = excluded.CreatedAt,
                        TeacherEmail = excluded.TeacherEmail,
                        NarrativeStarted = excluded.NarrativeStarted,
                        CurrentStage = excluded.CurrentStage,
                        Revision = excluded.Revision,
                        MediaPaused = excluded.MediaPaused,
                        MediaPositionSeconds = excluded.MediaPositionSeconds,
                        MediaRevision = excluded.MediaRevision,
                        MediaCommand = excluded.MediaCommand,
                        VolumePercent = excluded.VolumePercent,
                        AdvanceMode = excluded.AdvanceMode,
                        VotingOpen = excluded.VotingOpen,
                        FinalDecision = excluded.FinalDecision,
                        VoteRound = excluded.VoteRound;
                    """;
                command.Parameters.AddWithValue("$code", snapshot.Code);
                command.Parameters.AddWithValue("$createdAt", snapshot.CreatedAt.ToString("O"));
                command.Parameters.AddWithValue("$teacherEmail", snapshot.TeacherEmail);
                command.Parameters.AddWithValue("$started", snapshot.NarrativeStarted);
                command.Parameters.AddWithValue("$stage", snapshot.CurrentStage);
                command.Parameters.AddWithValue("$revision", snapshot.Revision);
                command.Parameters.AddWithValue("$mediaPaused", snapshot.MediaPaused);
                command.Parameters.AddWithValue("$mediaPosition", snapshot.MediaPositionSeconds);
                command.Parameters.AddWithValue("$mediaRevision", snapshot.MediaRevision);
                command.Parameters.AddWithValue("$mediaCommand", snapshot.MediaCommand);
                command.Parameters.AddWithValue("$volumePercent", snapshot.VolumePercent);
                command.Parameters.AddWithValue("$advanceMode", snapshot.AdvanceMode);
                command.Parameters.AddWithValue("$votingOpen", snapshot.VotingOpen);
                command.Parameters.AddWithValue("$finalDecision", (object?)snapshot.FinalDecision ?? DBNull.Value);
                command.Parameters.AddWithValue("$voteRound", snapshot.VoteRound);
                command.ExecuteNonQuery();
            }

            using (var delete = connection.CreateCommand())
            {
                delete.Transaction = transaction;
                delete.CommandText = "DELETE FROM Students WHERE SessionCode = $code;";
                delete.Parameters.AddWithValue("$code", snapshot.Code);
                delete.ExecuteNonQuery();
            }

            foreach (var student in snapshot.Students)
            {
                using (var command = connection.CreateCommand())
                {
                    command.Transaction = transaction;
                    command.CommandText = """
                        INSERT INTO Students (SessionCode, StudentId, Name, Ready, IntroCompleted)
                        VALUES ($code, $id, $name, $ready, $introCompleted);
                        """;
                    command.Parameters.AddWithValue("$code", snapshot.Code);
                    command.Parameters.AddWithValue("$id", student.Id);
                    command.Parameters.AddWithValue("$name", student.Name);
                    command.Parameters.AddWithValue("$ready", student.Ready);
                    command.Parameters.AddWithValue("$introCompleted", student.IntroCompleted);
                    command.ExecuteNonQuery();
                }
                using (var command = connection.CreateCommand())
                {
                    command.Transaction = transaction;
                    command.CommandText = """
                        INSERT INTO StudentInteractions (SessionCode, StudentId, Emotion, Decision, Reflection)
                        VALUES ($code, $id, $emotion, $decision, $reflection);
                        """;
                    command.Parameters.AddWithValue("$code", snapshot.Code);
                    command.Parameters.AddWithValue("$id", student.Id);
                    command.Parameters.AddWithValue("$emotion", (object?)student.Emotion ?? DBNull.Value);
                    command.Parameters.AddWithValue("$decision", (object?)student.Decision ?? DBNull.Value);
                    command.Parameters.AddWithValue("$reflection", (object?)student.Reflection ?? DBNull.Value);
                    command.ExecuteNonQuery();
                }
            }

            foreach (var vote in snapshot.Votes)
            {
                using var command = connection.CreateCommand();
                command.Transaction = transaction;
                command.CommandText = "INSERT INTO Votes (SessionCode, StudentId, Choice) VALUES ($code, $id, $choice);";
                command.Parameters.AddWithValue("$code", snapshot.Code);
                command.Parameters.AddWithValue("$id", vote.Key);
                command.Parameters.AddWithValue("$choice", vote.Value);
                command.ExecuteNonQuery();
            }

            transaction.Commit();
            lastSavedSnapshots[snapshot.Code] = fingerprint;
        }
    }

    public IReadOnlyList<ClassroomSessionSnapshot> LoadSessions(DateTimeOffset now, TimeSpan lifetime)
    {
        using var connection = Open();
        var metadata = new List<(string Code, DateTimeOffset CreatedAt, string TeacherEmail, bool Started,
            int Stage, int Revision, bool MediaPaused, double MediaPosition, int MediaRevision,
            string MediaCommand, int VolumePercent, string AdvanceMode, bool VotingOpen, string? FinalDecision, int VoteRound)>();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                SELECT Code, CreatedAt, TeacherEmail, NarrativeStarted, CurrentStage, Revision,
                       MediaPaused, MediaPositionSeconds, MediaRevision, MediaCommand, VolumePercent, AdvanceMode,
                       VotingOpen, FinalDecision, VoteRound
                FROM ClassroomSessions;
                """;
            using var reader = command.ExecuteReader();
            while (reader.Read())
                metadata.Add((reader.GetString(0), DateTimeOffset.Parse(reader.GetString(1)), reader.GetString(2),
                    reader.GetBoolean(3), reader.GetInt32(4), reader.GetInt32(5), reader.GetBoolean(6),
                    reader.GetDouble(7), reader.GetInt32(8), reader.GetString(9), reader.GetInt32(10), reader.GetString(11),
                    reader.GetBoolean(12), reader.IsDBNull(13) ? null : reader.GetString(13), reader.GetInt32(14)));
        }

        var sessions = new List<ClassroomSessionSnapshot>();
        foreach (var row in metadata)
        {
            if (now - row.CreatedAt > lifetime)
            {
                DeleteSession(connection, row.Code);
                continue;
            }

            var students = new List<StudentPresenceSnapshot>();
            using (var command = connection.CreateCommand())
            {
                command.CommandText = """
                    SELECT s.StudentId, s.Name, s.Ready, s.IntroCompleted, i.Emotion, i.Decision, i.Reflection
                    FROM Students s
                    LEFT JOIN StudentInteractions i ON i.SessionCode = s.SessionCode AND i.StudentId = s.StudentId
                    WHERE s.SessionCode = $code;
                    """;
                command.Parameters.AddWithValue("$code", row.Code);
                using var reader = command.ExecuteReader();
                while (reader.Read())
                    students.Add(new StudentPresenceSnapshot(reader.GetString(0), reader.GetString(1),
                        reader.GetBoolean(2), reader.GetBoolean(3), ReadNullable(reader, 4),
                        ReadNullable(reader, 5), ReadNullable(reader, 6)));
            }

            var votes = new Dictionary<string, string>(StringComparer.Ordinal);
            using (var command = connection.CreateCommand())
            {
                command.CommandText = "SELECT StudentId, Choice FROM Votes WHERE SessionCode = $code;";
                command.Parameters.AddWithValue("$code", row.Code);
                using var reader = command.ExecuteReader();
                while (reader.Read()) votes[reader.GetString(0)] = reader.GetString(1);
            }

            var snapshot = new ClassroomSessionSnapshot(row.Code, row.CreatedAt, row.TeacherEmail,
                row.Started, row.Stage, row.Revision, row.MediaPaused, row.MediaPosition,
                row.MediaRevision, row.MediaCommand, row.VolumePercent, row.AdvanceMode, row.VotingOpen,
                row.FinalDecision, row.VoteRound, votes, students);
            lastSavedSnapshots[row.Code] = System.Text.Json.JsonSerializer.Serialize(snapshot);
            sessions.Add(snapshot);
        }
        return sessions;
    }

    public StoredSessionReport SaveReport(SessionReportSummary summary, byte[] pdf)
    {
        var summaryJson = System.Text.Json.JsonSerializer.Serialize(
            summary, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
        using var connection = Open();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                INSERT OR IGNORE INTO SessionReports
                    (ReportId, SessionCode, TeacherEmail, CreatedAt, SummaryJson, Pdf)
                VALUES ($id, $code, $teacher, $createdAt, $summary, $pdf);
                """;
            command.Parameters.AddWithValue("$id", summary.ReportId);
            command.Parameters.AddWithValue("$code", summary.SessionCode);
            command.Parameters.AddWithValue("$teacher", GetTeacherForSession(connection, summary.SessionCode));
            command.Parameters.AddWithValue("$createdAt", summary.CreatedAt.ToString("O"));
            command.Parameters.AddWithValue("$summary", summaryJson);
            command.Parameters.AddWithValue("$pdf", pdf);
            command.ExecuteNonQuery();
        }

        return GetReportBySessionCode(connection, summary.SessionCode)
            ?? throw new InvalidOperationException("The generated report could not be loaded.");
    }

    public void MarkReportSent(string reportId, string recipient, DateTimeOffset sentAt)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = "UPDATE SessionReports SET SentTo = $recipient, SentAt = $sentAt WHERE ReportId = $id;";
        command.Parameters.AddWithValue("$recipient", recipient);
        command.Parameters.AddWithValue("$sentAt", sentAt.ToString("O"));
        command.Parameters.AddWithValue("$id", reportId);
        if (command.ExecuteNonQuery() != 1)
            throw new InvalidOperationException("The sent report could not be updated.");
    }
    public StoredSessionReport? GetReportBySessionCode(string sessionCode)
    {
        using var connection = Open();
        return GetReportBySessionCode(connection, sessionCode);
    }

    public StoredSessionReport? GetReportForTeacher(string reportId, string teacherEmail)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT ReportId, SessionCode, CreatedAt, TeacherEmail, SummaryJson, Pdf, SentTo, SentAt
            FROM SessionReports WHERE ReportId = $id AND TeacherEmail = $teacher;
            """;
        command.Parameters.AddWithValue("$id", reportId);
        command.Parameters.AddWithValue("$teacher", teacherEmail);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadStoredReport(reader) : null;
    }

    public List<SessionReportListItem> GetReportsForTeacher(string teacherEmail)
    {
        using var connection = Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT ReportId, SessionCode, CreatedAt, SummaryJson, SentTo, SentAt
            FROM SessionReports WHERE TeacherEmail = $teacher ORDER BY CreatedAt DESC;
            """;
        command.Parameters.AddWithValue("$teacher", teacherEmail);
        using var reader = command.ExecuteReader();
        var reports = new List<SessionReportListItem>();
        while (reader.Read())
        {
            var summary = System.Text.Json.JsonSerializer.Deserialize<SessionReportSummary>(reader.GetString(3),
                new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
            if (summary is null)
                continue;
            reports.Add(new SessionReportListItem(reader.GetString(0), reader.GetString(1),
                DateTimeOffset.Parse(reader.GetString(2)), summary.Status, summary.ParticipantCount,
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : DateTimeOffset.Parse(reader.GetString(5))));
        }
        return reports;
    }

    private static string GetTeacherForSession(SqliteConnection connection, string sessionCode)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT TeacherEmail FROM ClassroomSessions WHERE Code = $code;";
        command.Parameters.AddWithValue("$code", sessionCode);
        return command.ExecuteScalar() as string
            ?? throw new InvalidOperationException("The session has no teacher record.");
    }

    private static StoredSessionReport? GetReportBySessionCode(SqliteConnection connection, string sessionCode)
    {
        using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT ReportId, SessionCode, CreatedAt, TeacherEmail, SummaryJson, Pdf, SentTo, SentAt
            FROM SessionReports WHERE SessionCode = $code;
            """;
        command.Parameters.AddWithValue("$code", sessionCode);
        using var reader = command.ExecuteReader();
        return reader.Read() ? ReadStoredReport(reader) : null;
    }

    private static StoredSessionReport ReadStoredReport(SqliteDataReader reader) => new(
        reader.GetString(0), reader.GetString(1), DateTimeOffset.Parse(reader.GetString(2)),
        reader.GetString(3), reader.GetString(4), (byte[])reader[5],
        reader.IsDBNull(6) ? null : reader.GetString(6),
        reader.IsDBNull(7) ? null : DateTimeOffset.Parse(reader.GetString(7)));

    private static string? ReadNullable(SqliteDataReader reader, int ordinal) =>
        reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);

    private static void DeleteSession(SqliteConnection connection, string code)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM ClassroomSessions WHERE Code = $code;";
        command.Parameters.AddWithValue("$code", code);
        command.ExecuteNonQuery();
    }

    private SqliteConnection Open()
    {
        var connection = new SqliteConnection(connectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "PRAGMA busy_timeout = 5000;";
        command.ExecuteNonQuery();
        return connection;
    }
}

sealed record ClassroomSessionSnapshot(
    string Code,
    DateTimeOffset CreatedAt,
    string TeacherEmail,
    bool NarrativeStarted,
    int CurrentStage,
    int Revision,
    bool MediaPaused,
    double MediaPositionSeconds,
    int MediaRevision,
    string MediaCommand,
    int VolumePercent,
    string AdvanceMode,
    bool VotingOpen,
    string? FinalDecision,
    int VoteRound,
    Dictionary<string, string> Votes,
    List<StudentPresenceSnapshot> Students);

sealed record StudentPresenceSnapshot(
    string Id,
    string Name,
    bool Ready,
    bool IntroCompleted,
    string? Emotion,
    string? Decision,
    string? Reflection);
