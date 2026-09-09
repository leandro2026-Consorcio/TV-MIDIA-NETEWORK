using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace MidiaPorMidia.Setup
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string playerUrl = "https://midiapormidia.com.br/tv";
            int idleStartMinutes = 0;
            string mode = "commercial";
            bool isSilent = false;

            // 1. Detectar overlay PE
            ReadOverlayConfig(ref playerUrl, ref idleStartMinutes, ref mode);

            // 2. Detectar convenções do nome do arquivo
            string currentExeName = Path.GetFileName(Assembly.GetExecutingAssembly().Location) ?? "";
            if (currentExeName.IndexOf("organico", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                playerUrl = "https://midiapormidia.com.br/organic-tv";
                idleStartMinutes = 5;
                mode = "organic";
            }

            // 3. Argumentos de linha de comando
            if (args != null && args.Length > 0)
            {
                for (int i = 0; i < args.Length; i++)
                {
                    string a = args[i];
                    if (a.Equals("/silent", StringComparison.OrdinalIgnoreCase) ||
                        a.Equals("-silent", StringComparison.OrdinalIgnoreCase) ||
                        a.Equals("/s", StringComparison.OrdinalIgnoreCase) ||
                        a.Equals("-s", StringComparison.OrdinalIgnoreCase))
                    {
                        isSilent = true;
                    }
                    else if (a.StartsWith("/url=", StringComparison.OrdinalIgnoreCase) || a.StartsWith("-url=", StringComparison.OrdinalIgnoreCase))
                    {
                        playerUrl = a.Substring(5).Trim('"');
                    }
                    else if ((a.Equals("/url", StringComparison.OrdinalIgnoreCase) || a.Equals("-url", StringComparison.OrdinalIgnoreCase)) && i + 1 < args.Length)
                    {
                        playerUrl = args[++i].Trim('"');
                    }
                    else if (a.StartsWith("/idle=", StringComparison.OrdinalIgnoreCase) || a.StartsWith("-idle=", StringComparison.OrdinalIgnoreCase))
                    {
                        int v;
                        if (int.TryParse(a.Substring(6), out v)) idleStartMinutes = Math.Max(0, Math.Min(1440, v));
                    }
                    else if ((a.Equals("/idle", StringComparison.OrdinalIgnoreCase) || a.Equals("-idle", StringComparison.OrdinalIgnoreCase)) && i + 1 < args.Length)
                    {
                        int v;
                        if (int.TryParse(args[++i], out v)) idleStartMinutes = Math.Max(0, Math.Min(1440, v));
                    }
                    else if (a.StartsWith("/mode=", StringComparison.OrdinalIgnoreCase) || a.StartsWith("-mode=", StringComparison.OrdinalIgnoreCase))
                    {
                        mode = a.Substring(6).Trim('"');
                    }
                }
            }

            if (isSilent)
            {
                string err;
                bool ok = PerformInstall(playerUrl, idleStartMinutes, mode, out err);
                Environment.Exit(ok ? 0 : 1);
                return;
            }

            Application.Run(new SetupForm(playerUrl, idleStartMinutes, mode));
        }

        private static void ReadOverlayConfig(ref string url, ref int idle, ref string mode)
        {
            try
            {
                string exePath = Assembly.GetExecutingAssembly().Location;
                if (!File.Exists(exePath)) return;

                byte[] bytes;
                using (var fs = new FileStream(exePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite))
                {
                    bytes = new byte[fs.Length];
                    fs.Read(bytes, 0, bytes.Length);
                }

                string content = Encoding.UTF8.GetString(bytes);
                int startIdx = content.LastIndexOf("__MPM_CONFIG_START__");
                if (startIdx >= 0)
                {
                    int endIdx = content.IndexOf("__MPM_CONFIG_END__", startIdx);
                    if (endIdx > startIdx)
                    {
                        string json = content.Substring(
                            startIdx + "__MPM_CONFIG_START__".Length,
                            endIdx - (startIdx + "__MPM_CONFIG_START__".Length));

                        var matchUrl = Regex.Match(json, "\"playerUrl\"\\s*:\\s*\"([^\"]+)\"");
                        if (matchUrl.Success) url = matchUrl.Groups[1].Value;

                        var matchIdle = Regex.Match(json, "\"idleStartMinutes\"\\s*:\\s*(\\d+)");
                        if (matchIdle.Success) idle = int.Parse(matchIdle.Groups[1].Value);

                        var matchMode = Regex.Match(json, "\"mode\"\\s*:\\s*\"([^\"]+)\"");
                        if (matchMode.Success) mode = matchMode.Groups[1].Value;
                    }
                }
            }
            catch
            {
                // Ignorar erro de overlay
            }
        }

        public static bool PerformInstall(string playerUrl, int idleStartMinutes, string mode, out string error)
        {
            error = null;
            try
            {
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string installDir = Path.Combine(localAppData, @"MidiaPorMidia\Monitor");
                string logsDir = Path.Combine(installDir, "logs");
                string profileDir = Path.Combine(installDir, "BrowserProfile");

                if (!Directory.Exists(installDir)) Directory.CreateDirectory(installDir);
                if (!Directory.Exists(logsDir)) Directory.CreateDirectory(logsDir);
                if (!Directory.Exists(profileDir)) Directory.CreateDirectory(profileDir);

                // 1. Extrair binários embutidos
                ExtractResource("MPMMonitor.exe", Path.Combine(installDir, "MPMMonitor.exe"));
                ExtractResource("Uninstall.exe", Path.Combine(installDir, "Uninstall.exe"));

                // 2. Gravar config.json
                string configPath = Path.Combine(installDir, "config.json");
                string configJson = string.Format(
                    "{{\n  \"playerUrl\": \"{0}\",\n  \"idleStartMinutes\": {1},\n  \"mode\": \"{2}\",\n  \"version\": \"1.0.0\",\n  \"installedAt\": \"{3}\"\n}}",
                    playerUrl, idleStartMinutes, mode, DateTime.UtcNow.ToString("o"));
                File.WriteAllText(configPath, configJson, Encoding.UTF8);

                // 3. Criar Atalho na Inicialização (Startup)
                string startupDir = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                string startupShortcut = Path.Combine(startupDir, "MidiaPorMidia Monitor.lnk");
                CreateShortcut(startupShortcut, Path.Combine(installDir, "MPMMonitor.exe"), installDir, "Inicia o Monitor Windows Mídia por Mídia");

                // 4. Registrar no Adicionar/Remover Programas do Windows (Registry HKCU)
                RegisterInWindowsUninstall(installDir);

                // 5. Iniciar o MPMMonitor.exe imediatamente
                var psi = new ProcessStartInfo
                {
                    FileName = Path.Combine(installDir, "MPMMonitor.exe"),
                    WorkingDirectory = installDir,
                    UseShellExecute = true
                };
                Process.Start(psi);

                return true;
            }
            catch (Exception ex)
            {
                error = ex.Message;
                return false;
            }
        }

        private static void ExtractResource(string resourceName, string outputPath)
        {
            var asm = Assembly.GetExecutingAssembly();
            // Tentar localizar recurso com nome exato ou sufixado
            string foundName = null;
            foreach (var n in asm.GetManifestResourceNames())
            {
                if (n.EndsWith(resourceName, StringComparison.OrdinalIgnoreCase))
                {
                    foundName = n;
                    break;
                }
            }

            if (foundName == null)
            {
                // Se recurso não embutido, verificar se existe localmente (modo desenvolvimento)
                string localDev = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, resourceName);
                if (File.Exists(localDev))
                {
                    File.Copy(localDev, outputPath, true);
                    return;
                }
                throw new FileNotFoundException("Recurso embutido não encontrado: " + resourceName);
            }

            using (var stream = asm.GetManifestResourceStream(foundName))
            {
                if (stream == null) throw new InvalidOperationException("Não foi possível carregar stream de: " + foundName);
                using (var fs = new FileStream(outputPath, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)
                    {
                        fs.Write(buffer, 0, read);
                    }
                }
            }
        }

        private static void CreateShortcut(string shortcutPath, string targetPath, string workDir, string description)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("WScript.Shell");
                if (shellType != null)
                {
                    dynamic shell = Activator.CreateInstance(shellType);
                    dynamic shortcut = shell.CreateShortcut(shortcutPath);
                    shortcut.TargetPath = targetPath;
                    shortcut.WorkingDirectory = workDir;
                    shortcut.Description = description;
                    shortcut.Save();
                }
            }
            catch { }
        }

        private static void RegisterInWindowsUninstall(string installDir)
        {
            try
            {
                using (var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\MidiaPorMidiaMonitor"))
                {
                    if (key != null)
                    {
                        string uninstPath = Path.Combine(installDir, "Uninstall.exe");
                        string monitorPath = Path.Combine(installDir, "MPMMonitor.exe");

                        key.SetValue("DisplayName", "Mídia por Mídia - Monitor Windows", RegistryValueKind.String);
                        key.SetValue("DisplayVersion", "1.0.0", RegistryValueKind.String);
                        key.SetValue("Publisher", "Mídia por Mídia", RegistryValueKind.String);
                        key.SetValue("InstallLocation", installDir, RegistryValueKind.String);
                        key.SetValue("UninstallString", "\"" + uninstPath + "\"", RegistryValueKind.String);
                        key.SetValue("QuietUninstallString", "\"" + uninstPath + "\" /silent", RegistryValueKind.String);
                        key.SetValue("DisplayIcon", monitorPath, RegistryValueKind.String);
                        key.SetValue("HelpLink", "https://midiapormidia.com.br", RegistryValueKind.String);
                        key.SetValue("URLInfoAbout", "https://midiapormidia.com.br", RegistryValueKind.String);
                        key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                        key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
                    }
                }
            }
            catch { }
        }
    }

    internal class SetupForm : Form
    {
        private readonly string _playerUrl;
        private readonly int _idleStartMinutes;
        private readonly string _mode;

        private Label _lblStatus;
        private Button _btnInstall;
        private ProgressBar _progressBar;

        public SetupForm(string playerUrl, int idleStartMinutes, string mode)
        {
            _playerUrl = playerUrl;
            _idleStartMinutes = idleStartMinutes;
            _mode = mode;

            InitializeUi();
        }

        private void InitializeUi()
        {
            Text = "Mídia por Mídia — Instalador do Monitor Windows";
            Size = new Size(540, 430);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            MinimizeBox = true;
            BackColor = Color.FromArgb(11, 15, 25);
            ForeColor = Color.White;
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

            var pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 85,
                BackColor = Color.FromArgb(15, 23, 42),
                Padding = new Padding(24, 16, 24, 16)
            };

            var lblBadge = new Label
            {
                Text = "MÍDIA POR MÍDIA • PLAYER WINDOWS OFICIAL",
                ForeColor = Color.FromArgb(56, 189, 248),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Location = new Point(24, 14),
                AutoSize = true
            };

            var lblTitle = new Label
            {
                Text = "Instalação do Monitor Windows",
                ForeColor = Color.White,
                Font = new Font("Segoe UI", 14f, FontStyle.Bold),
                Location = new Point(24, 34),
                AutoSize = true
            };

            pnlHeader.Controls.Add(lblBadge);
            pnlHeader.Controls.Add(lblTitle);
            Controls.Add(pnlHeader);

            var pnlContent = new Panel
            {
                Location = new Point(24, 105),
                Size = new Size(475, 175),
                BackColor = Color.FromArgb(19, 27, 46),
                Padding = new Padding(16)
            };

            string modeDesc = _idleStartMinutes <= 0
                ? "Comercial contínuo (TV da empresa sem suspensão)"
                : string.Format("Residencial Orgânico (Inicia após {0} min de inatividade)", _idleStartMinutes);

            var lblInfo1 = new Label
            {
                Text = "Modo de Exibição:",
                ForeColor = Color.FromArgb(148, 163, 184),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Location = new Point(14, 16),
                AutoSize = true
            };
            var lblVal1 = new Label
            {
                Text = modeDesc,
                ForeColor = Color.FromArgb(56, 189, 248),
                Font = new Font("Segoe UI", 9f, FontStyle.Bold),
                Location = new Point(14, 34),
                AutoSize = true
            };

            var lblInfo2 = new Label
            {
                Text = "URL do Player:",
                ForeColor = Color.FromArgb(148, 163, 184),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Location = new Point(14, 62),
                AutoSize = true
            };
            var lblVal2 = new Label
            {
                Text = _playerUrl,
                ForeColor = Color.FromArgb(226, 232, 240),
                Font = new Font("Consolas", 9f, FontStyle.Regular),
                Location = new Point(14, 80),
                AutoSize = true
            };

            var lblInfo3 = new Label
            {
                Text = "Recursos integrados:",
                ForeColor = Color.FromArgb(148, 163, 184),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Bold),
                Location = new Point(14, 108),
                AutoSize = true
            };
            var lblVal3 = new Label
            {
                Text = "✔ Quiosque tela cheia   ✔ Inicia com Windows   ✔ Mantém TV ativa   ✔ Per-User (Sem Admin)",
                ForeColor = Color.FromArgb(74, 222, 128),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                Location = new Point(14, 126),
                AutoSize = true
            };

            pnlContent.Controls.Add(lblInfo1);
            pnlContent.Controls.Add(lblVal1);
            pnlContent.Controls.Add(lblInfo2);
            pnlContent.Controls.Add(lblVal2);
            pnlContent.Controls.Add(lblInfo3);
            pnlContent.Controls.Add(lblVal3);
            Controls.Add(pnlContent);

            _progressBar = new ProgressBar
            {
                Location = new Point(24, 295),
                Size = new Size(475, 10),
                Style = ProgressBarStyle.Continuous,
                Value = 0,
                Visible = false
            };
            Controls.Add(_progressBar);

            _lblStatus = new Label
            {
                Text = "Clique em 'Instalar Agora' para iniciar a TV automaticamente.",
                ForeColor = Color.FromArgb(148, 163, 184),
                Font = new Font("Segoe UI", 8.5f, FontStyle.Regular),
                Location = new Point(24, 315),
                Size = new Size(475, 20)
            };
            Controls.Add(_lblStatus);

            _btnInstall = new Button
            {
                Text = "INSTALAR AGORA",
                BackColor = Color.FromArgb(2, 132, 199),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Font = new Font("Segoe UI", 10.5f, FontStyle.Bold),
                Location = new Point(24, 340),
                Size = new Size(475, 38),
                Cursor = Cursors.Hand
            };
            _btnInstall.FlatAppearance.BorderSize = 0;
            _btnInstall.Click += OnInstallClicked;
            Controls.Add(_btnInstall);
        }

        private void OnInstallClicked(object sender, EventArgs e)
        {
            if (_btnInstall.Text == "CONCLUIR E FECHAR")
            {
                Close();
                return;
            }

            _btnInstall.Enabled = false;
            _progressBar.Visible = true;
            _progressBar.Value = 25;
            _lblStatus.Text = "Configurando diretório e extraindo arquivos...";
            _lblStatus.ForeColor = Color.FromArgb(56, 189, 248);

            var thread = new Thread(() =>
            {
                Thread.Sleep(400);

                Invoke((Action)(() =>
                {
                    _progressBar.Value = 60;
                    _lblStatus.Text = "Criando atalho de inicialização e registrando...";
                }));

                string err;
                bool ok = Program.PerformInstall(_playerUrl, _idleStartMinutes, _mode, out err);

                Thread.Sleep(400);

                Invoke((Action)(() =>
                {
                    if (ok)
                    {
                        _progressBar.Value = 100;
                        _lblStatus.Text = "Instalação concluída! O player foi iniciado em modo quiosque.";
                        _lblStatus.ForeColor = Color.FromArgb(74, 222, 128);
                        _btnInstall.Text = "CONCLUIR E FECHAR";
                        _btnInstall.BackColor = Color.FromArgb(22, 101, 52);
                        _btnInstall.Enabled = true;

                        // Timer para auto-fechar em 4 segundos
                        var t = new System.Windows.Forms.Timer { Interval = 4000 };
                        t.Tick += (s, args) => { t.Stop(); Close(); };
                        t.Start();
                    }
                    else
                    {
                        _progressBar.Visible = false;
                        _lblStatus.Text = "Falha na instalação: " + err;
                        _lblStatus.ForeColor = Color.FromArgb(244, 63, 94);
                        _btnInstall.Text = "Tentar novamente";
                        _btnInstall.Enabled = true;
                    }
                }));
            });
            thread.IsBackground = true;
            thread.Start();
        }
    }
}
