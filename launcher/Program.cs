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

var processes = new List<Process>();
try
{
    processes.Add(Start(root, "dotnet", "run --project Serena.Api --launch-profile Serena"));
    processes.Add(Start(root, "npm.cmd", "--prefix backend run start"));
    processes.Add(Start(root, "npm.cmd", "--prefix frontend run dev -- --host localhost"));

    using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
    var ready = false;
    for (var attempt = 0; attempt < 30; attempt++)
    {
        try
        {
            using var response = await client.GetAsync("http://localhost:5173");
            if ((int)response.StatusCode < 500)
            {
                ready = true;
                break;
            }
        }
        catch (HttpRequestException) { }
        await Task.Delay(1000);
    }

    if (!ready)
    {
        MessageBox("Los servicios no respondieron a tiempo. Revisa las ventanas de consola para ver el error.");
        return;
    }

    Process.Start(new ProcessStartInfo
    {
        FileName = "http://localhost:5173",
        UseShellExecute = true
    });

    MessageBox("Serena está abierta en el navegador. Pulsa Aceptar para cerrar los servicios.");
}
finally
{
    foreach (var process in processes)
    {
        try { if (!process.HasExited) process.Kill(entireProcessTree: true); } catch { }
        process.Dispose();
    }
}

static Process Start(string workingDirectory, string fileName, string arguments)
{
    var process = Process.Start(new ProcessStartInfo
    {
        FileName = fileName,
        Arguments = arguments,
        WorkingDirectory = workingDirectory,
        UseShellExecute = true,
        CreateNoWindow = false
    });
    return process ?? throw new InvalidOperationException($"No se pudo iniciar {fileName}.");
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
