let hasInitialised = !1,
    runtime = null;

function HandleInitRuntimeMessage(t) {
    const e = t.data;
    e && "init-runtime" === e["type"] && (InitRuntime(e), self.removeEventListener("message", HandleInitRuntimeMessage))
}

function IsAbsoluteURL(t) {
    return /^(?:[a-z\-]+:)?\/\//.test(t) || "data:" === t.substr(0, 5) || "blob:" === t.substr(0, 5)
}

function IsRelativeURL(t) {
    return !IsAbsoluteURL(t)
}
async function LoadScripts(e) {
    if (1 === e.length) {
        const t = e[0];
        await
        import ((IsRelativeURL(t) ? "./" : "") + t)
    } else {
        const i = e.map(t => `import "${IsRelativeURL(t)?"./":""}${t}";`).join("\n"),
            r = URL.createObjectURL(new Blob([i], {
                type: "application/javascript"
            }));
        try {
            await
            import (r)
        } catch (t) {
            console.warn("[Construct] Unable to import script from blob: URL. Falling back to loading scripts sequentially, which could significantly increase loading time. Make sure blob: URLs are allowed for best performance.", t);
            for (const n of e) await
            import ((IsRelativeURL(n) ? "./" : "") + n)
        }
    }
}
async function InitRuntime(t) {
    if (hasInitialised) throw new Error("already initialised");
    hasInitialised = !0;
    const e = t["messagePort"],
        i = t["exportType"],
        r = (self.devicePixelRatio = t["devicePixelRatio"], []),
        n = (self.runOnStartup = function(t) {
            if ("function" != typeof t) throw new Error("runOnStartup called without a function");
            r.push(t)
        }, t["runtimeScriptList"].map(t => new URL(t, location.href).toString()));
    try {
        await LoadScripts([...n])
    } catch (t) {
        return void console.error("[C3 runtime] Failed to load all engine scripts in worker: ", t)
    }
    const a = t["projectMainScriptPath"],
        o = t["scriptsInEventsPath"],
        s = new URL(a, location.href).toString(),
        c = new URL(o, location.href).toString();
    if (a) try {
        if (await LoadScripts([s]), "preview" === i && !globalThis.C3_ProjectMainScriptOK) throw new Error("main script did not run to completion")
    } catch (t) {
        console.error("Error loading project main script: ", t);
        const l = `Failed to load the project main script (${a}). Check all your JavaScript code has valid syntax, all imports are written correctly, and that an exception was not thrown running the script. Press F12 and check the console for error details.`;
        e.postMessage({
            "type": "alert-error",
            "message": l
        })
    }
    if (o) try {
        if (await LoadScripts([c]), "preview" === i && !globalThis.C3.ScriptsInEvents) throw new Error("scripts in events did not run to completion")
    } catch (t) {
        console.error("Error loading scripts in events: ", t);
        e.postMessage({
            "type": "alert-error",
            "message": "Failed to load scripts in events. Check all your JavaScript code has valid syntax, all imports are written correctly, and that an exception was not thrown running the 'Imports for events' script. Press F12 and check the console for error details."
        })
    }
    t["runOnStartupFunctions"] = r, e.postMessage({
        "type": "creating-runtime"
    }), runtime = self["C3_CreateRuntime"](t), await self["C3_InitRuntime"](runtime, t)
}
self.addEventListener("message", HandleInitRuntimeMessage);