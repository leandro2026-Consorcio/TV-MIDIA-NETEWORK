# Mídia por Mídia — Monitor Windows Nativo & Instalador Oficial

O ecossistema Windows do Mídia por Mídia foi migrado de scripts PowerShell legados para um ecossistema **100% nativo C#/.NET**, compilado com subsistema Windows GUI (`winexe`), garantindo zero consoles/terminais, instalação per-user sem necessidade de administrador, watchdog automático e suporte nativo ao Windows 10 e Windows 11.

---

## 1. Arquitetura dos Binários

| Binário | Tecnologia | Finalidade |
| :--- | :--- | :--- |
| **`MPM-Player-Setup.exe`** | C# WinForms (`winexe`) | Assistente visual profissional de instalação. Extrai binários, configura `config.json`, cria atalho no Startup do usuário, registra no Registro do Windows e inicia a TV. Suporta modo silencioso (`/silent`), modo orgânico (`/mode=organic /idle=5`) e configuração via PE Overlay. |
| **`MPMMonitor.exe`** | C# Nativo (`winexe`) | Launcher em background sem janela de console. Monitora inatividade via P/Invoke `GetLastInputInfo`, mantém tela acordada via `SetThreadExecutionState`, detecta Chrome/Edge, abre quiosque com perfil dedicado e atua como watchdog (reinicia em caso de encerramento inesperado). |
| **`Uninstall.exe`** | C# Nativo WinForms (`winexe`) | Desinstalador limpo. Encerra instâncias ativas, remove atalho de inicialização, remove chaves no Registro (`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\MidiaPorMidiaMonitor`) e limpa diretórios locais. |

---

## 2. Instalação pelo Usuário Final

O usuário final recebe **apenas**:
```
MPM-Player-Setup.exe
```

1. Duplo clique no instalador baixado pelo painel (`/downloads/mpm-player/windows` ou no cadastro da tela).
2. O assistente exibe os dados da tela (Comercial Contínua ou Residencial Orgânica).
3. 1 clique em **"Instalar Agora"**.
4. O navegador abre instantaneamente em tela cheia com o código de 6 dígitos.
5. Digite o código no painel em **Minhas TVs** para parear.

> **Zero complexidade**: O usuário não precisa abrir PowerShell, executar comandos, alterar `ExecutionPolicy`, abrir VS Code ou escolher aplicativos.

---

## 3. Diretórios e Arquivos em Tempo de Execução

- **Diretório base:** `%LOCALAPPDATA%\MidiaPorMidia\Monitor`
- **Configuração:** `%LOCALAPPDATA%\MidiaPorMidia\Monitor\config.json`
- **Perfil do Navegador:** `%LOCALAPPDATA%\MidiaPorMidia\Monitor\BrowserProfile`
- **Logs:** `%LOCALAPPDATA%\MidiaPorMidia\Monitor\logs\monitor.log` (rotacionado automaticamente ao atingir 1MB)
- **Atalho de Inicialização Automática:** `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\MidiaPorMidia Monitor.lnk`

---

## 4. Compilação e Build

Para recompilar todos os binários:
```powershell
.\build.ps1
```
O script compila os 3 executáveis em sequência, embutindo os binários no instalador final e copiando para `public/downloads/MPM-Player-Setup.exe`.
