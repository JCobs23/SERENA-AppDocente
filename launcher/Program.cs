using System.Diagnostics;
using System.Net.Http;

var launcherDirectory = new DirectoryInfo(AppContext.BaseDirectory);
var root = launcherDirectory.FullName;
while (root is not null && !File.Exists(Path.Combine(root, "Serena.Api", "Serena.Api.csproj")))
    root = Directory.GetParent(root)?.FullName;

if (root is null || !File.Exists(Path.Combine(root, "Serena.Api", "Serena.Api.csproj")))
{
    MessageBox("No se encontró la carpeta del proyecto. Coloca Serena-Docente.exe dentro de la carpeta raíz de SERENA-AppDocente.");
    return;
}

var logsDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SERENA", "logs");
Directory.CreateDirectory(logsDirectory);
var processes = new List<Process>();
try
{
    foreach (var service in new[] { "api.log", "backend.log", "frontend.log" })
        File.WriteAllText(Path.Combine(logsDirectory, service), string.Empty);

    processes.Add(Start(root, "dotnet", logsDirectory, "api",
        ["run", "--no-build", "--project", "Serena.Api", "--launch-profile", "Serena"]));
    processes.Add(Start(Path.Combine(root, "backend"), "node", logsDirectory, "backend",
        ["server.js"]));
    processes.Add(Start(Path.Combine(root, "frontend"), "node", logsDirectory, "frontend",
        ["node_modules/vite/bin/vite.js", "--host", "localhost"]));

    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
    var ready = false;
    for (var attempt = 0; attempt < 30; attempt++)
    {
        if (processes.Any(process => process.HasExited))
            break;
        try
        {
            using var api = await client.GetAsync("http://127.0.0.1:5080/api/health");
            using var backend = await client.GetAsync("http://127.0.0.1:3001/health");
            using var frontend = await client.GetAsync("http://localhost:5173");
            if (api.IsSuccessStatusCode && backend.IsSuccessStatusCode && frontend.IsSuccessStatusCode)
            {
                ready = true;
                break;
            }
        }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException) { }
        await Task.Delay(1000);
    }

    if (!ready)
    {
        var logFiles = new[] { "api.log", "backend.log", "frontend.log" };
        var details = string.Join(Environment.NewLine + Environment.NewLine,
            logFiles.Select(name =>
            {
                var path = Path.Combine(logsDirectory, name);
                if (!File.Exists(path)) return name + ": sin registro";
                var lines = File.ReadAllLines(path);
                return name + ":" + Environment.NewLine + string.Join(Environment.NewLine, lines.TakeLast(8));
            }));
        MessageBox("Serena no pudo iniciar todos los servicios. Revisa estos registros:" +
            Environment.NewLine + logsDirectory + Environment.NewLine + Environment.NewLine + details);
        return;
    }

    Process.Start(new ProcessStartInfo
    {
        FileName = "http://localhost:5173",
        UseShellExecute = true
    });

    Console.WriteLine();
    Console.WriteLine("Serena está abierta en http://localhost:5173");
    Console.WriteLine("Mantén esta ventana abierta mientras usas la aplicación.");
    Console.WriteLine("Pulsa Enter aquí cuando quieras cerrar Serena y detener los servicios.");
    Console.ReadLine();
}
catch (Exception error)
{
    MessageBox("No se pudo iniciar Serena: " + error.Message +
        Environment.NewLine + "Registros: " + logsDirectory);
}
finally
{
    foreach (var process in processes)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                process.WaitForExit(3000);
            }
        }
        catch { }
        process.Dispose();
    }
}

static Process Start(string workingDirectory, string fileName, string logDirectory,
    string serviceName, IEnumerable<string> arguments)
{
    var startInfo = new ProcessStartInfo
    {
        FileName = fileName,
        WorkingDirectory = workingDirectory,
        UseShellExecute = false,
        CreateNoWindow = true,
        RedirectStandardOutput = true,
        RedirectStandardError = true
    };
    foreach (var argument in arguments)
        startInfo.ArgumentList.Add(argument);

    var process = new Process { StartInfo = startInfo };
    var logPath = Path.Combine(logDirectory, serviceName + ".log");
    void WriteLine(string stream, string? data)
    {
        if (data is null) return;
        lock (process)
            File.AppendAllText(logPath, $"{DateTimeOffset.Now:O} [{stream}] {data}{Environment.NewLine}");
    }

    process.OutputDataReceived += (_, eventArgs) => WriteLine("out", eventArgs.Data);
    process.ErrorDataReceived += (_, eventArgs) => WriteLine("err", eventArgs.Data);
    if (!process.Start())
        throw new InvalidOperationException("No se pudo iniciar " + serviceName + ".");
    process.BeginOutputReadLine();
    process.BeginErrorReadLine();
    return process;
}

static void MessageBox(string message)
{
    Process.Start(new ProcessStartInfo
    {
        FileName = "powershell.exe",
        Arguments = $"-NoProfile -Command \"Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('{message.Replace("'", "''")}','Serena')\"",
        UseShellExecute = false,
        CreateNoWindow = true
    })?.WaitForExit();
}