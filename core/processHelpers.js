/* Process helpers for finding windows in Windows.
   Adapted for non-localized API (WMI/PowerShell).
   Created by SamRevolt (2025)
*/

const memoryjs = require('memoryjs');
const _ = require('lodash');
const cp = require('child_process');
const md5File = require('md5-file');

// Get process details using WMI (non-localized, always English keys)
function getWMIProcessDetails(pid) {
    // Get name, PID, executable path, status, user, session, memory, CPU time (most fields available via Win32_Process)
    // Win32_Process does not provide the window title directly.
    let script = `
        $p = Get-WmiObject Win32_Process -Filter "ProcessId = ${pid}";
        $owner = $p.GetOwner();
        $cpu = $p.GetTotalProcessorTime();
        $session = $p.SessionId;
        $mem = $p.WorkingSetSize;
        $ret = @{
            Name = $p.Name;
            PID = $p.ProcessId;
            ExecutablePath = $p.ExecutablePath;
            Status = $p.Status;
            UserName = $owner.User;
            SessionId = $session;
            MemUsage = $mem;
            CPUTime = $cpu;
        }
        $ret | ConvertTo-Json
    `;
    let stdout = cp.execSync(`powershell -Command "${script}"`).toString();
    let details = {};
    try {
        details = JSON.parse(stdout);
    } catch (e) {
        details = {};
    }
    return details;
}

// Try to get window title via memoryjs (preferred, as WMI can't get it directly)
function getWindowTitleMemoryjs(pid) {
    const windowList = memoryjs.getWindows();
    const match = windowList.find(w => w.processId === pid && w.title);
    return match ? match.title : "";
}

let findGame = (pair, prox) => {
    let procs = prox;
    let exeFile = pair.app;
    let title = pair.title;
    return new Promise((resolve, reject) => {
        let results = _.filter(procs, p => p.szExeFile.toLowerCase() == exeFile.toLowerCase());
        let found = null;
        if (!results || results.length === 0) {
            resolve(null);
            return;
        }
        _.each(results, (p) => {
            if (found == null) {
                const wmi = getWMIProcessDetails(p.th32ProcessID);
                // Always English fields
                const details = {
                    ...p,
                    ImageName: wmi.Name,
                    PID: Number(wmi.PID),
                    exePath: wmi.ExecutablePath,
                    SessionName: null, // Not available in WMI directly
                    Session: wmi.SessionId,
                    MemUsage: wmi.MemUsage,
                    Status: wmi.Status,
                    UserName: wmi.UserName,
                    CPUTime: wmi.CPUTime,
                    WindowTitle: getWindowTitleMemoryjs(p.th32ProcessID) // Best effort: via memoryjs
                };

                // Debug output
                console.log("CHECKING OUT " + JSON.stringify({
                    Name: details.ImageName,
                    PID: details.PID,
                    Title: details.WindowTitle
                }));

                if (!title || title.length === 0 || (details.WindowTitle || "").toLowerCase().indexOf(title.toLowerCase()) !== -1) {
                    found = details;
                }
            }
        });

        if (found !== null) {
            // Return the same structure as before
            let ret = {
                exe: found.szExeFile,
                exePath: found.exePath,
                title: found.WindowTitle,
                pid: found.PID,
                th32ProcessID: found.th32ProcessID,
                md5: null
            };
            console.log(JSON.stringify(ret));

            try {
                ret.process = memoryjs.openProcess(ret.pid);
            } catch(e) {
                // Couldn't access exe, maybe didn't have admin permissions?
                console.log("ERROR - could not attach to process. Did you run the game as admin but not this software?");
                resolve(null);
                return;
            }
            resolve({ target: ret, cfg: pair });
            return;
        }
        resolve(null);
        return;
    });
};

let findGames = (arr) => {
    let procs = memoryjs.getProcesses();
    let promises = [];
    let found = null;
    _.each(arr, (pair) => {
        promises.push(findGame(pair, procs));
    });
    return Promise.all(promises).then((results) => {
        _.each(results, r => {
            if (found === null && r !== null) {
                found = r;
            }
        });
        return found;
    });
};

exports.findGames = findGames;