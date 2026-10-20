using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;

// Owned-process timer policy only. No audio capture, user data or model code.
internal static class TimerPolicy {
 [StructLayout(LayoutKind.Sequential)] private struct State { public uint Version, ControlMask, StateMask; }
 [DllImport("kernel32.dll",SetLastError=true)] private static extern IntPtr OpenProcess(uint access,bool inherit,int id);
 [DllImport("kernel32.dll",SetLastError=true)] private static extern bool GetProcessInformation(IntPtr process,int kind,ref State state,int size);
 [DllImport("kernel32.dll",SetLastError=true)] private static extern bool SetProcessInformation(IntPtr process,int kind,ref State state,int size);
 [DllImport("kernel32.dll")] private static extern bool CloseHandle(IntPtr handle);
 private static string Run(string mode,string executable,string input) {
  string[] fields=input.Split(':');int id;
  if(!Int32.TryParse(fields[0],out id)||id<=0)return "{\"ok\":false,\"error\":87}";
  string prefix="{\"id\":"+id.ToString(CultureInfo.InvariantCulture);
  try {
   using(var process=Process.GetProcessById(id)) {
    if(!String.Equals(Path.GetFullPath(process.MainModule.FileName),executable,StringComparison.OrdinalIgnoreCase))return prefix+",\"ok\":false,\"error\":5}";
    long ticks=process.StartTime.ToUniversalTime().Ticks;
    uint previousControl=0,previousState=0;long expectedTicks=0;
    if(mode=="restore"&&(fields.Length!=4||!UInt32.TryParse(fields[1],out previousControl)||!UInt32.TryParse(fields[2],out previousState)||!Int64.TryParse(fields[3],out expectedTicks)))return prefix+",\"ok\":false,\"error\":87}";
    if(mode=="restore"&&expectedTicks!=ticks)return prefix+",\"ok\":true,\"gone\":true}";
    IntPtr handle=OpenProcess(0x1200,false,id);if(handle==IntPtr.Zero)return prefix+",\"ok\":false,\"error\":"+Marshal.GetLastWin32Error()+"}";
    try {
     State before=new State{Version=1};if(!GetProcessInformation(handle,4,ref before,12))return prefix+",\"ok\":false,\"error\":"+Marshal.GetLastWin32Error()+"}";
     if(mode=="inspect")return prefix+",\"ok\":true,\"control\":"+before.ControlMask+",\"state\":"+before.StateMask+",\"startTicks\":\""+ticks.ToString(CultureInfo.InvariantCulture)+"\"}";
     State next=new State{Version=1,ControlMask=before.ControlMask,StateMask=before.StateMask};
     if(mode=="apply"){next.ControlMask|=4;next.StateMask&=~4u;}
     else {next.ControlMask=(next.ControlMask&~4u)|(previousControl&4u);next.StateMask=(next.StateMask&~4u)|(previousState&4u);}
     if((next.ControlMask!=before.ControlMask||next.StateMask!=before.StateMask)&&!SetProcessInformation(handle,4,ref next,12))return prefix+",\"ok\":false,\"error\":"+Marshal.GetLastWin32Error()+"}";
     return prefix+",\"ok\":true,\"control\":"+before.ControlMask+",\"state\":"+before.StateMask+",\"startTicks\":\""+ticks.ToString(CultureInfo.InvariantCulture)+"\"}";
    } finally {CloseHandle(handle);}
   }
  } catch(ArgumentException){return prefix+",\"ok\":true,\"gone\":true}";}
  catch(InvalidOperationException){return prefix+",\"ok\":true,\"gone\":true}";}
  catch{return prefix+",\"ok\":false,\"error\":5}";}
 }
 private static int Main(string[] args) {
  if(args.Length<3||(args[0]!="apply"&&args[0]!="restore"&&args[0]!="inspect"))return 2;
  string executable;try{executable=Path.GetFullPath(args[1]);}catch{return 2;}
  var rows=new List<string>();for(int i=2;i<args.Length;i++)rows.Add(Run(args[0],executable,args[i]));Console.WriteLine("["+String.Join(",",rows.ToArray())+"]");return 0;
 }
}
