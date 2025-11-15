# VRDVR Capture

This is a simple Go program that watches your VRChat log file and sends VRCDN usernames to VRDVR.

## Usage

Simply run the executable:

```powershell
.\VRDVRCAP.exe
```

You can also create a shortcut and auto-launch it using VRCX's App Launcher.

> [!WARNING]  
> Autostarting it seems to make EAC upset sometimes, causing VRChat to stuck as a black screen. I promise this doesn't do anything other than read the logfile and I don't know why that triggers it! You'll have to launch it manually *after* VRChat launches, if that happens to you.

The program will:

1. Find your VRChat log directory (typically `%USERPROFILE%\AppData\LocalLow\VRChat\VRChat`)
2. Start monitoring the newest log file
3. Watch for VRCDN URLs in the logs
4. Send detected usernames to the API

Press `Ctrl+C` to stop the program gracefully.

## Building

### For Windows

```powershell
go build -o VRDVRCAP.exe main.go
```

### Cross-compilation from Windows

```powershell
# For Linux
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o VRDVRCAP main.go

# For macOS
$env:GOOS="darwin"; $env:GOARCH="amd64"; go build -o VRDVRCAP main.go
```

## Default Log Location

The tool automatically looks for VRChat logs in:

- Windows: `%USERPROFILE%\AppData\LocalLow\VRChat\VRChat`

Not currently configurable.

## License

See root of this repository for license details.
