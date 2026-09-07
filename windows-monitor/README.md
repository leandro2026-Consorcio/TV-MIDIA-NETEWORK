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

## Monitor Windows da Rede Orgânica

Para um computador residencial que deve abrir a programação após ficar parado por 5 minutos:

```powershell
.\Install-MidiaMonitorOrganico.ps1 -IdleStartMinutes 5
```

O inicializador consulta a inatividade global de teclado e mouse no Windows. Ele abre `/organic-tv` em um perfil separado do navegador quando o tempo configurado é atingido e fecha apenas essa sessão de exibição quando o usuário volta a utilizar o computador. Use `0` para um computador dedicado que deve exibir continuamente.

## Desinstalação

```powershell
.\Uninstall-MidiaMonitor.ps1
```

## Limitações desta primeira versão

- Este pacote configura inicialização por atalho no perfil do usuário, não um serviço Windows.
- O computador precisa permanecer ligado e sem suspensão para exibir continuamente.
- A primeira versão já detecta inatividade global por teclado e mouse; um aplicativo assinado continua recomendado para distribuição comercial.
- O navegador precisa estar instalado.
- O pareamento e a programação continuam usando o mesmo player e token da tela.

Para distribuição comercial, substituir o script por um instalador assinado (MSIX, WiX ou instalador .NET/Tauri), com watchdog, atualização automática, controle de energia e detecção global de inatividade.
