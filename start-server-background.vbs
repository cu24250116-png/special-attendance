Set WshShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strPath & "\server"
WshShell.Run "cmd /c node index.js", 0, False
Set WshShell = Nothing
MsgBox "CampusSync Attendance Server is now running silently in the background!" & vbCrLf & "It will continue running even if VS Code or terminal is closed." & vbCrLf & vbCrLf & "Access at: http://localhost:5000", vbInformation, "CampusSync Server Background Runner"
