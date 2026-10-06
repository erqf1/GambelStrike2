// GambelStrike 2 — Windows launcher.
// The offline build (GambelStrike2.html) is embedded as a resource. On start it is extracted to
// %LOCALAPPDATA%\GambelStrike2 and opened as a borderless app window in Edge or Chrome with its own
// profile (so saves persist). Without either browser it falls back to the default browser.
// Compiled with the C# compiler that ships with Windows (.NET Framework 4.x) — see tools/build.js.
using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("GambelStrike 2")]
[assembly: AssemblyProduct("GambelStrike 2")]
[assembly: AssemblyDescription("Free-for-all shooter with a pre-round roulette")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

static class Launcher
{
    const string Title = "GambelStrike 2";

    [STAThread]
    static int Main(string[] args)
    {
        bool dryRun = Array.IndexOf(args, "--dry-run") >= 0;
        try
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "GambelStrike2");
            Directory.CreateDirectory(dir);
            string html = Path.Combine(dir, "GambelStrike2.html");
            ExtractGame(html);

            string url = new Uri(html).AbsoluteUri;
            string profile = Path.Combine(dir, "browser-profile");
            string browser = FindBrowser();
            string browserArgs = "--app=\"" + url + "\" --user-data-dir=\"" + profile + "\"" +
                " --no-first-run --no-default-browser-check --disable-features=Translate --window-size=1600,900";

            if (dryRun)
            {
                Console.WriteLine("game:    " + html);
                Console.WriteLine("browser: " + (browser ?? "(default browser)"));
                Console.WriteLine("args:    " + browserArgs);
                return 0;
            }
            if (browser != null)
            {
                ProcessStartInfo psi = new ProcessStartInfo(browser, browserArgs);
                psi.UseShellExecute = false;
                Process.Start(psi);
            }
            else
            {
                Process.Start(new ProcessStartInfo(html) { UseShellExecute = true });
            }
            return 0;
        }
        catch (Exception e)
        {
            if (dryRun) Console.WriteLine("error: " + e.Message);
            else MessageBox.Show("GambelStrike 2 could not start:\n\n" + e.Message, Title, MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    // write the embedded game next to the user's data; only rewrite when it changed
    static void ExtractGame(string target)
    {
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("GambelStrike2.html"))
        {
            if (s == null) throw new Exception("The embedded game file is missing.");
            byte[] data = new byte[s.Length];
            int read = 0;
            while (read < data.Length)
            {
                int n = s.Read(data, read, data.Length - read);
                if (n <= 0) break;
                read += n;
            }
            if (File.Exists(target))
            {
                byte[] old = File.ReadAllBytes(target);
                if (Same(old, data)) return;
            }
            File.WriteAllBytes(target, data);
        }
    }

    static bool Same(byte[] a, byte[] b)
    {
        if (a.Length != b.Length) return false;
        for (int i = 0; i < a.Length; i++) if (a[i] != b[i]) return false;
        return true;
    }

    // Edge first (ships with Windows), then Chrome / Brave; null = use the default browser
    static string FindBrowser()
    {
        foreach (string exe in new[] { "msedge.exe", "chrome.exe", "brave.exe" })
        {
            string p = AppPath(Registry.CurrentUser, exe) ?? AppPath(Registry.LocalMachine, exe);
            if (p != null && File.Exists(p)) return p;
        }
        string pf86 = Environment.GetEnvironmentVariable("ProgramFiles(x86)") ?? "";
        string pf = Environment.GetEnvironmentVariable("ProgramFiles") ?? "";
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] guesses =
        {
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf, @"BraveSoftware\Brave-Browser\Application\brave.exe"),
        };
        foreach (string g in guesses) if (File.Exists(g)) return g;
        return null;
    }

    static string AppPath(RegistryKey hive, string exe)
    {
        try
        {
            using (RegistryKey k = hive.OpenSubKey(@"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
            {
                return k == null ? null : k.GetValue(null) as string;
            }
        }
        catch { return null; }
    }
}
