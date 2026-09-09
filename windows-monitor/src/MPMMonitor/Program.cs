using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

namespace MidiaPorMidia.Monitor
{
    internal static class Program
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct LASTINPUTINFO
        {
            public uint cbSize;
            public uint dwTime;
        }

        [DllImport("user32.dll")]
        private static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);

        [DllImport("kernel32.dll")]
        private static extern uint SetThreadExecutionState(uint esFlags);

        private const uint ES_CONTINUOUS = 0x80000000;
        private const uint ES_SYSTEM_REQUIRED = 0x00000001;
        private const uint ES_DISPLAY_REQUIRED = 0x00000002;

        private static string _installDir;
        private static string _logFile;
        private static Process _playerProcess;
        private static bool _isRunning = true;

        [STAThread]
        private static void Main(string[] args)
        {
            bool createdNew;
            using (var mutex = new Mutex(true, "Local\\MidiaPorMidia_Monitor_Mutex", out createdNew))
            {
                if (!createdNew)
                {
                    // Outro processo já está rodando
                    return;
                }

                InitializePaths();
                AppDomain.CurrentDomain.ProcessExit += OnProcessExit;

                Log("Iniciando Mídia por Mídia Monitor v1.0.0 (Nativo)");

                string playerUrl = "https://midiapormidia.com.br/tv";
                int idleStartMinutes = 0;
                string mode = "commercial";

                // Carregar config.json se existir
                LoadConfig(ref playerUrl, ref idleStartMinutes, ref mode);

                // Sobrescrever se vier por argumentos CLI
                ParseArgs(args, ref playerUrl, ref idleStartMinutes, ref mode);

                // Salvar configuração atualizada
                SaveConfig(playerUrl, idleStartMinutes, mode);

                Log(string.Format("Configuração ativa: Url={0}, IdleMinutes={1}, Mode={2}", playerUrl, idleStartMinutes, mode));

                string browserExe = FindBrowser();
                if (browserExe != null)
                {
                    Log("Navegador detectado: " + browserExe);
                }
                else
                {
                    Log("Aviso: Chrome ou Edge não encontrados. Usando navegador padrão do sistema.");
                }

                string profileDir = Path.Combine(_installDir, "BrowserProfile");
                if (!Directory.Exists(profileDir))
                {
                    try { Directory.CreateDirectory(profileDir); } catch { }
                }

                while (_isRunning)
                {
                    try
                    {
                        uint idleSeconds = GetIdleSeconds();
                        bool idleEnough = (idleStartMinutes <= 0) || (idleSeconds >= (uint)(idleStartMinutes * 60));
                        bool running = (_playerProcess != null && !_playerProcess.HasExited);

                        if (idleEnough && !running)
                        {
                            KeepAwake();
                            StartPlayer(browserExe, profileDir, playerUrl);
                        }
                        else if (idleStartMinutes > 0 && !idleEnough && running)
                        {
                            Log(string.Format("Atividade detectada ({0}s ocioso). Encerrando sessão do player.", idleSeconds));
                            StopPlayer();
                            RestorePowerPolicy();
                        }
                        else if (running)
                        {
                            // Manter tela acordada enquanto o player estiver em execução
                            KeepAwake();
                        }
                    }
                    catch (Exception ex)
                    {
                        Log("Erro no ciclo do monitor: " + ex.Message);
                    }

                    Thread.Sleep(5000);
                }
            }
        }

        private static void InitializePaths()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            _installDir = Path.Combine(localAppData, @"MidiaPorMidia\Monitor");
            string logDir = Path.Combine(_installDir, "logs");

            if (!Directory.Exists(logDir))
            {
                try { Directory.CreateDirectory(logDir); } catch { }
            }

            _logFile = Path.Combine(logDir, "monitor.log");
        }

        private static void LoadConfig(ref string url, ref int idle, ref string mode)
        {
            string configFile = Path.Combine(_installDir, "config.json");
            if (!File.Exists(configFile)) return;

            try
            {
                string json = File.ReadAllText(configFile, Encoding.UTF8);

                var matchUrl = Regex.Match(json, "\"playerUrl\"\\s*:\\s*\"([^\"]+)\"");
                if (matchUrl.Success) url = matchUrl.Groups[1].Value;

                var matchIdle = Regex.Match(json, "\"idleStartMinutes\"\\s*:\\s*(\\d+)");
                if (matchIdle.Success) idle = int.Parse(matchIdle.Groups[1].Value);

                var matchMode = Regex.Match(json, "\"mode\"\\s*:\\s*\"([^\"]+)\"");
                if (matchMode.Success) mode = matchMode.Groups[1].Value;
            }
            catch (Exception ex)
            {
                Log("Erro ao ler config.json: " + ex.Message);
            }
        }

        private static void SaveConfig(string url, int idle, string mode)
        {
            string configFile = Path.Combine(_installDir, "config.json");
            try
            {
                string json = string.Format(
                    "{{\n  \"playerUrl\": \"{0}\",\n  \"idleStartMinutes\": {1},\n  \"mode\": \"{2}\",\n  \"updatedAt\": \"{3}\"\n}}",
                    url, idle, mode, DateTime.UtcNow.ToString("o"));
                File.WriteAllText(configFile, json, Encoding.UTF8);
            }
            catch (Exception ex)
            {
                Log("Erro ao salvar config.json: " + ex.Message);
            }
        }

        private static void ParseArgs(string[] args, ref string url, ref int idle, ref string mode)
        {
            if (args == null || args.Length == 0) return;

            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i];
                if (arg.StartsWith("-url=", StringComparison.OrdinalIgnoreCase) || arg.StartsWith("/url=", StringComparison.OrdinalIgnoreCase))
                {
                    url = arg.Substring(5).Trim('"');
                }
                else if ((arg.Equals("-url", StringComparison.OrdinalIgnoreCase) || arg.Equals("/url", StringComparison.OrdinalIgnoreCase)) && i + 1 < args.Length)
                {
                    url = args[++i].Trim('"');
                }
                else if (arg.StartsWith("-idle=", StringComparison.OrdinalIgnoreCase) || arg.StartsWith("/idle=", StringComparison.OrdinalIgnoreCase))
                {
                    int val;
                    if (int.TryParse(arg.Substring(6), out val)) idle = Math.Max(0, Math.Min(1440, val));
                }
                else if ((arg.Equals("-idle", StringComparison.OrdinalIgnoreCase) || arg.Equals("/idle", StringComparison.OrdinalIgnoreCase)) && i + 1 < args.Length)
                {
                    int val;
                    if (int.TryParse(args[++i], out val)) idle = Math.Max(0, Math.Min(1440, val));
                }
                else if (arg.StartsWith("-mode=", StringComparison.OrdinalIgnoreCase) || arg.StartsWith("/mode=", StringComparison.OrdinalIgnoreCase))
                {
                    mode = arg.Substring(6).Trim('"');
                }
                else if ((arg.Equals("-mode", StringComparison.OrdinalIgnoreCase) || arg.Equals("/mode", StringComparison.OrdinalIgnoreCase)) && i + 1 < args.Length)
                {
                    mode = args[++i].Trim('"');
                }
            }
        }

        private static string FindBrowser()
        {
            string[] candidatePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe")
            };

            foreach (var path in candidatePaths)
            {
                if (!string.IsNullOrEmpty(path) && File.Exists(path))
                {
                    return path;
                }
            }

            return null;
        }

        private static void StartPlayer(string browserExe, string profileDir, string url)
        {
            try
            {
                if (!string.IsNullOrEmpty(browserExe) && File.Exists(browserExe))
                {
                    var psi = new ProcessStartInfo();
                    psi.FileName = browserExe;
                    psi.Arguments = string.Format(
                        "--kiosk --noerrdialogs --disable-session-crashed-bubble --user-data-dir=\"{0}\" \"{1}\"",
                        profileDir, url);
                    psi.UseShellExecute = false;
                    _playerProcess = Process.Start(psi);
                    Log("Player iniciado via: " + browserExe + " (PID: " + _playerProcess.Id + ")");
                }
                else
                {
                    _playerProcess = Process.Start(url);
                    Log("Player iniciado via Shell default URL handler.");
                }
            }
            catch (Exception ex)
            {
                Log("Falha ao iniciar player: " + ex.Message);
                _playerProcess = null;
            }
        }

        private static void StopPlayer()
        {
            if (_playerProcess != null)
            {
                try
                {
                    if (!_playerProcess.HasExited)
                    {
                        _playerProcess.Kill();
                        _playerProcess.WaitForExit(3000);
                    }
                }
                catch (Exception ex)
                {
                    Log("Aviso ao encerrar player: " + ex.Message);
                }
                finally
                {
                    _playerProcess = null;
                }
            }
        }

        private static uint GetIdleSeconds()
        {
            var lii = new LASTINPUTINFO();
            lii.cbSize = (uint)Marshal.SizeOf(lii);
            if (GetLastInputInfo(ref lii))
            {
                uint tickCount = (uint)Environment.TickCount;
                return (tickCount - lii.dwTime) / 1000;
            }
            return 0;
        }

        private static void KeepAwake()
        {
            SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED);
        }

        private static void RestorePowerPolicy()
        {
            SetThreadExecutionState(ES_CONTINUOUS);
        }

        private static void OnProcessExit(object sender, EventArgs e)
        {
            _isRunning = false;
            RestorePowerPolicy();
            Log("Mídia por Mídia Monitor finalizado.");
        }

        public static void Log(string message)
        {
            try
            {
                if (string.IsNullOrEmpty(_logFile)) return;

                // Rotacionar se passar de 1 MB
                var fi = new FileInfo(_logFile);
                if (fi.Exists && fi.Length > 1024 * 1024)
                {
                    string oldFile = _logFile + ".old";
                    if (File.Exists(oldFile)) File.Delete(oldFile);
                    File.Move(_logFile, oldFile);
                }

                string line = string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}\n", DateTime.Now, message);
                File.AppendAllText(_logFile, line, Encoding.UTF8);
            }
            catch
            {
                // Falha de log não interrompe monitor
            }
        }
    }
}
