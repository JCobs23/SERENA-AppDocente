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
            CREATE INDEX IF NOT EXISTS IX_ClassroomSessions_CreatedAt ON ClassroomSessions(CreatedAt);
            PRAGMA user_version = 1;
            """;
        command.ExecuteNonQuery();
        foreach (var teacher in seedTeachers)
            UpsertTeacher(teacher);
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
                         MediaPaused, MediaPositionSeconds, MediaRevision, MediaCommand, AdvanceMode,
                         VotingOpen, FinalDecision, VoteRound)
                    VALUES
                        ($code, $createdAt, $teacherEmail, $started, $stage, $revision,
                         $mediaPaused, $mediaPosition, $mediaRevision, $mediaCommand, $advanceMode,
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
            string MediaCommand, string AdvanceMode, bool VotingOpen, string? FinalDecision, int VoteRound)>();
        using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                SELECT Code, CreatedAt, TeacherEmail, NarrativeStarted, CurrentStage, Revision,
                       MediaPaused, MediaPositionSeconds, MediaRevision, MediaCommand, AdvanceMode,
                       VotingOpen, FinalDecision, VoteRound
                FROM ClassroomSessions;
                """;
            using var reader = command.ExecuteReader();
            while (reader.Read())
                metadata.Add((reader.GetString(0), DateTimeOffset.Parse(reader.GetString(1)), reader.GetString(2),
                    reader.GetBoolean(3), reader.GetInt32(4), reader.GetInt32(5), reader.GetBoolean(6),
                    reader.GetDouble(7), reader.GetInt32(8), reader.GetString(9), reader.GetString(10),
                    reader.GetBoolean(11), reader.IsDBNull(12) ? null : reader.GetString(12), reader.GetInt32(13)));
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
                row.MediaRevision, row.MediaCommand, row.AdvanceMode, row.VotingOpen,
                row.FinalDecision, row.VoteRound, votes, students);
            lastSavedSnapshots[row.Code] = System.Text.Json.JsonSerializer.Serialize(snapshot);
            sessions.Add(snapshot);
        }
        return sessions;
    }

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
