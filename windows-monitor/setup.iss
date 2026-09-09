; Script Inno Setup para compilação alternativa do instalador MPM Player
#define MyAppName "Mídia por Mídia Player"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Mídia por Mídia"
#define MyAppURL "https://midiapormidia.com.br"
#define MyAppExeName "MPMMonitor.exe"

[Setup]
AppId={{D7E9B420-E45B-4C09-91B1-9D23B643A4C2}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\MidiaPorMidia\Monitor
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=MPM-Player-Setup-Inno
OutputDir=bin
Compression=lzma
SolidCompression=yes
WizardStyle=modern

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "bin\MPMMonitor.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "bin\Uninstall.exe"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{userstartup}\MidiaPorMidia Monitor"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
