import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { app } from 'electron'

/**
 * Send ESC/POS bytes to a print queue untouched.
 *
 * Thermal printers speak ESC/POS, not a page-description language. The bytes must
 * reach the device verbatim, which means asking the spooler for a *raw* job —
 * anything else runs them through a rendering pipeline that neither understands
 * nor forwards them.
 *
 * Windows and CUPS spell "raw" completely differently, so each gets its own
 * implementation below. Getting the Windows spelling wrong does not fail loudly:
 * the spooler accepts the job, fails to process it, and silently deletes it from
 * the queue — the job flashes past in the printer window and nothing prints.
 */
export async function sendRawToPrinter(
  printerName: string,
  data: Buffer,
  docName = 'Kaarobar receipt',
): Promise<void> {
  if (!printerName) {
    throw new Error('sendRawToPrinter: a printer name is required')
  }
  if (!data.length) return

  if (process.platform === 'win32') {
    await sendRawWindows(printerName, data, docName)
    return
  }
  await sendRawCups(printerName, data, docName)
}

/* -------------------------------------------------------------------------- */
/* Windows                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Windows raw printing goes through the Win32 spooler API with the job datatype
 * set to "RAW": OpenPrinter -> StartDocPrinter(DOC_INFO_1{ pDatatype = "RAW" })
 * -> WritePrinter -> EndDocPrinter. That datatype is what tells the spooler to
 * hand the bytes to the port driver as-is.
 *
 * The obvious-looking managed alternative, System.Printing.PrintQueue.AddJob(),
 * is NOT equivalent: it always creates an *XPS* job, and its JobStream expects a
 * valid XPS package. Writing ESC/POS bytes into it produces a job the XPS filter
 * pipeline cannot parse, so the spooler discards it — the job appears in the
 * queue and is deleted a moment later without printing. That is exactly the
 * failure this function exists to avoid.
 *
 * Node has no binding for winspool.drv, so the call is made from PowerShell via
 * P/Invoke. The generated assembly is cached under userData so only the first
 * receipt after an install pays the C# compile cost.
 */
async function sendRawWindows(
  printerName: string,
  data: Buffer,
  docName: string,
): Promise<void> {
  const scratch = scratchDir()
  const stamp = randomUUID()
  const binPath = join(scratch, `raw-${stamp}.bin`)
  const scriptPath = join(scratch, `raw-${stamp}.ps1`)
  const dllPath = join(scratch, 'KaarobarRawPrinter.dll')

  writeFileSync(binPath, data)
  // PowerShell 5.1 decodes a BOM-less .ps1 as the system ANSI code page, which
  // mangles non-ASCII printer names. The BOM forces UTF-8.
  writeFileSync(scriptPath, '﻿' + windowsScript({ printerName, binPath, dllPath, docName }), 'utf8')

  try {
    await run('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
    ])
  } finally {
    remove(binPath)
    remove(scriptPath)
  }
}

/** Escape a JS string for embedding in a PowerShell single-quoted literal. */
function ps(value: string): string {
  return value.replace(/'/g, "''")
}

function windowsScript(args: {
  printerName: string
  binPath: string
  dllPath: string
  docName: string
}): string {
  // Kept as one C# source string so it can be compiled straight to the cached
  // assembly. `$ErrorActionPreference = 'Stop'` turns every failure below into a
  // non-zero exit code, which is what `run()` reads.
  return `$ErrorActionPreference = 'Stop'

$source = @'
using System;
using System.IO;
using System.Runtime.InteropServices;

namespace Kaarobar {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DocInfo1 {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDatatype;
  }

  public static class RawPrinter {
    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DocInfo1 di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    private static Exception Fail(string what) {
      int code = Marshal.GetLastWin32Error();
      return new Exception(what + " failed (Win32 error " + code + ": " + new System.ComponentModel.Win32Exception(code).Message + ")");
    }

    public static void Send(string printerName, string filePath, string docName) {
      byte[] bytes = File.ReadAllBytes(filePath);
      IntPtr hPrinter;
      if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero))
        throw Fail("OpenPrinter('" + printerName + "')");

      try {
        DocInfo1 di = new DocInfo1();
        di.pDocName = docName;
        di.pOutputFile = null;
        // The whole point: hand the bytes to the port driver untouched.
        di.pDatatype = "RAW";

        if (StartDocPrinter(hPrinter, 1, di) == 0)
          throw Fail("StartDocPrinter");

        bool doc = true;
        try {
          if (!StartPagePrinter(hPrinter)) throw Fail("StartPagePrinter");

          IntPtr buffer = Marshal.AllocCoTaskMem(bytes.Length);
          try {
            Marshal.Copy(bytes, 0, buffer, bytes.Length);
            int written;
            if (!WritePrinter(hPrinter, buffer, bytes.Length, out written))
              throw Fail("WritePrinter");
            if (written != bytes.Length)
              throw new Exception("WritePrinter accepted " + written + " of " + bytes.Length + " bytes");
          } finally {
            Marshal.FreeCoTaskMem(buffer);
          }

          if (!EndPagePrinter(hPrinter)) throw Fail("EndPagePrinter");
          doc = false;
          if (!EndDocPrinter(hPrinter)) throw Fail("EndDocPrinter");
        } finally {
          // Only unwind the document if the happy path did not already close it,
          // otherwise a half-written job is left spooled.
          if (doc) { try { EndDocPrinter(hPrinter); } catch {} }
        }
      } finally {
        ClosePrinter(hPrinter);
      }
    }
  }
}
'@

$dll = '${ps(args.dllPath)}'

# Compiling the C# above costs a second or two, so it is cached next to the app's
# data and reused. A stale or half-written DLL just falls back to an in-memory
# compile rather than breaking printing.
$loaded = $false
if (Test-Path -LiteralPath $dll) {
  try { Add-Type -Path $dll; $loaded = $true } catch { $loaded = $false }
}
if (-not $loaded) {
  $tmp = "$dll.$PID.tmp"
  try {
    Add-Type -TypeDefinition $source -OutputAssembly $tmp
    Move-Item -LiteralPath $tmp -Destination $dll -Force
    Add-Type -Path $dll
  } catch {
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
    Add-Type -TypeDefinition $source
  }
}

[Kaarobar.RawPrinter]::Send('${ps(args.printerName)}', '${ps(args.binPath)}', '${ps(args.docName)}')
`
}

/* -------------------------------------------------------------------------- */
/* macOS / Linux                                                               */
/* -------------------------------------------------------------------------- */

/** CUPS already has a raw datatype; `-o raw` is all it takes. */
async function sendRawCups(
  printerName: string,
  data: Buffer,
  docName: string,
): Promise<void> {
  await run('lp', ['-d', printerName, '-t', docName, '-o', 'raw', '-'], data)
}

/* -------------------------------------------------------------------------- */

function scratchDir(): string {
  // `app` is unavailable in the rare case this module is exercised outside a
  // running Electron app (tests, scripts) — fall back to the system temp dir.
  let base: string
  try {
    base = app.getPath('userData')
  } catch {
    base = tmpdir()
  }
  const dir = join(base, 'rawprint')
  mkdirSync(dir, { recursive: true })
  return dir
}

function remove(path: string): void {
  try {
    unlinkSync(path)
  } catch {
    // Best effort — a leftover file in the scratch dir is harmless.
  }
}

/**
 * Longer than any healthy job needs (the first Windows job also pays a C#
 * compile), but bounded: a wedged spooler call must surface as an error the
 * caller can fall back from, not hang the sale forever.
 */
const RUN_TIMEOUT_MS = 30_000

function run(command: string, args: string[], stdin?: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      // `shell: false` keeps the printer name out of any shell's hands.
      shell: false,
      stdio: [stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill()
    }, RUN_TIMEOUT_MS)

    child.stdout?.on('data', (chunk) => {
      stdout += String(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      stderr += String(chunk)
    })

    child.on('error', (error) => {
      clearTimeout(timer)
      reject(
        new Error(
          `${command} could not be started (${error.message}). ` +
            'Raw receipt printing needs it on PATH.',
        ),
      )
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) {
        reject(
          new Error(
            `${command} did not finish within ${RUN_TIMEOUT_MS / 1000}s — ` +
              'the print spooler may be stuck.',
          ),
        )
        return
      }
      if (code === 0) {
        resolve()
        return
      }
      const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join('\n') || 'no output'
      reject(new Error(`${command} exited with code ${code}: ${detail}`))
    })

    if (stdin) {
      child.stdin?.on('error', () => {
        // The close handler reports the real failure; ignore EPIPE noise here.
      })
      child.stdin?.end(stdin)
    }
  })
}
