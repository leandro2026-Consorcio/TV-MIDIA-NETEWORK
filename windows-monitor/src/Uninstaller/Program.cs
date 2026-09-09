using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;
using Microsoft.Win32;

namespace MidiaPorMidia.Uninstaller
{
    internal static class Program
    {
        [STAThread]
        private static void Main(string[] args)
        {
            bool isSilent = false;
            if (args != null)
            {
                foreach (var a in args)
                {
                    if (a.Equals("/silent", StringComparison.OrdinalIgnoreCase) ||
                        a.Equals("-silent", StringComparison.OrdinalIgnoreCase) ||
                        a.Equals("/s", StringComparison.OrdinalIgnoreCase) ||
                        a.Equals("-s", StringComparison.OrdinalIgnoreCase))
                    {
                        isSilent = true;
                    }
                }
            }

            if (!isSilent)
            {
                var result = MessageBox.Show(
                    "Deseja realmente remover o Mídia por Mídia Monitor deste computador?",
                    "Desinstalar Mídia por Mídia",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question);

                if (result != DialogResult.Yes)
                {
                    return;
                }
            }

            try
            {
                // 1. Encerrar instâncias de MPMMonitor
                KillProcessesByName("MPMMonitor");

                // 2. Remover atalho de Inicialização (Startup)
                string startupDir = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
                string startupShortcut = Path.Combine(startupDir, "MidiaPorMidia Monitor.lnk");
                if (File.Exists(startupShortcut))
                {
                    try { File.Delete(startupShortcut); } catch { }
                }

                // Atalho no Desktop, se houver
                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                string desktopShortcut = Path.Combine(desktopDir, "MidiaPorMidia Monitor.lnk");
                if (File.Exists(desktopShortcut))
                {
                    try { File.Delete(desktopShortcut); } catch { }
                }

                // 3. Remover entrada do Registro (Add/Remove Programs)
                try
                {
                    using (var uninstallKey = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall", true))
                    {
                        if (uninstallKey != null)
                        {
                            uninstallKey.DeleteSubKeyTree("MidiaPorMidiaMonitor", false);
                        }
                    }
                }
                catch { }

                // Remover chave Run do usuário, se houver
                try
                {
                    using (var runKey = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Run", true))
                    {
                        if (runKey != null)
                        {
                            runKey.DeleteValue("MidiaPorMidiaMonitor", false);
                        }
                    }
                }
                catch { }

                // 4. Agendar exclusão do diretório de instalação
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                string installDir = Path.Combine(localAppData, @"MidiaPorMidia\Monitor");

                if (Directory.Exists(installDir))
                {
                    // Deletar o que for possível imediatamente (arquivos de log, configs, perfil)
                    try
                    {
                        string[] files = Directory.GetFiles(installDir, "*.*", SearchOption.AllDirectories);
                        string currentExe = Process.GetCurrentProcess().MainModule.FileName;
                        foreach (var f in files)
                        {
                            if (!string.Equals(f, currentExe, StringComparison.OrdinalIgnoreCase))
                            {
                                try { File.Delete(f); } catch { }
                            }
                        }
                    }
                    catch { }

                    // Agendar exclusão do diretório após encerramento do processo
                    var psi = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = string.Format("/c timeout /t 2 /nobreak > NUL & rmdir /s /q \"{0}\"", installDir),
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    Process.Start(psi);
                }

                if (!isSilent)
                {
                    MessageBox.Show(
                        "O Mídia por Mídia Monitor foi removido com sucesso deste computador.",
                        "Mídia por Mídia",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);
                }
            }
            catch (Exception ex)
            {
                if (!isSilent)
                {
                    MessageBox.Show(
                        "Ocorreu um erro durante a desinstalação: " + ex.Message,
                        "Erro na Desinstalação",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                }
            }
        }

        private static void KillProcessesByName(string processName)
        {
            try
            {
                var procs = Process.GetProcessesByName(processName);
                foreach (var p in procs)
                {
                    try
                    {
                        p.Kill();
                        p.WaitForExit(3000);
                    }
                    catch { }
                }
            }
            catch { }
        }
    }
}
