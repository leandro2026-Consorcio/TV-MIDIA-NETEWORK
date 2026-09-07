# Monitor Windows — pacote inicial

Este diretório contém um inicializador PowerShell para a primeira versão do modo **Monitor Windows**. Ele abre o player `/tv` em modo quiosque e cria um atalho na inicialização do usuário atual.

## Instalação

1. No portal, cadastre uma tela com tipo **Monitor Windows**.
2. No computador conectado ao monitor, baixe este diretório ou o pacote disponibilizado pelo portal.
3. Abra o PowerShell na pasta e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\Install-MidiaMonitor.ps1
```

4. O Chrome ou Edge abrirá `https://midiapormidia.com.br/tv` em modo quiosque.
5. Faça o pareamento com o código mostrado no player.

O usuário autoriza localmente a criação do inicializador. O site nunca altera o Windows sozinho.

## Desinstalação

```powershell
.\Uninstall-MidiaMonitor.ps1
```

## Limitações desta primeira versão

- Este pacote configura inicialização por atalho no perfil do usuário, não um serviço Windows.
- O computador precisa permanecer ligado e sem suspensão para exibir continuamente.
- A configuração de inatividade global do Windows ainda deve ser adicionada ao aplicativo nativo/watchdog.
- O navegador precisa estar instalado.
- O pareamento e a programação continuam usando o mesmo player e token da tela.

Para distribuição comercial, substituir o script por um instalador assinado (MSIX, WiX ou instalador .NET/Tauri), com watchdog, atualização automática, controle de energia e detecção global de inatividade.
