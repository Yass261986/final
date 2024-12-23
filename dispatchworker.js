"use strict";
self.inputPort = null, self.jobQueue = [], self.jobWorkers = [], self.sentBlobs = [], self.sentBuffers = [], self.importedScripts = [], self.lastBroadcasts = new Map;
class JobWorker {
    constructor(e, s) {
        this._port = e, this._number = s, this._isReady = !1, this._isBusy = !1, this._port.onmessage = e => this._OnMessage(e.data)
    }
    ImportScripts(e) {
        this._port.postMessage({
            "type": "_import_scripts",
            "scripts": e
        })
    }
    SendBlob(e, s) {
        this._port.postMessage({
            "type": "_send_blob",
            "blob": e,
            "id": s
        })
    }
    SendBuffer(e, s) {
        this._port.postMessage({
            "type": "_send_buffer",
            "buffer": e,
            "id": s
        })
    }
    SendJob(e) {
        if (this._isBusy || !this._isReady) throw new Error("cannot take job");
        this._isBusy = !0, this._port.postMessage(e, e["transferables"])
    }
    _InitBroadcast(e) {
        this._port.postMessage(e, e["transferables"])
    }
    SendReady() {
        this._port.postMessage({
            "type": "_ready"
        })
    }
    IsReady() {
        return this._isReady
    }
    _OnReady() {
        this._isReady = !0, this.MaybeStartNextJob()
    }
    IsBusy() {
        return this._isBusy
    }
    GetNumber() {
        return this._number
    }
    _OnMessage(e) {
        const s = e["type"];
        switch (s) {
            case "ready":
                return void this._OnReady();
            case "done":
                return void this._OnJobDone();
            default:
                return void console.error("unknown message from worker '" + s + "'")
        }
    }
    _OnJobDone() {
        this._isBusy = !1, this.MaybeStartNextJob()
    }
    MaybeStartNextJob() {
        if (!this._isBusy && this._isReady) {
            const e = this._FindAvailableJob();
            if (-1 !== e) {
                const s = self.jobQueue[e],
                    t = s["isBroadcast"];
                (!t || (s["doneFlags"][this._number] = !0, s["doneFlags"].every(e => e))) && self.jobQueue.splice(e, 1), this.SendJob(s)
            }
        }
    }
    _FindAvailableJob() {
        for (let e = 0, s = self.jobQueue.length; e < s; ++e) {
            const t = self.jobQueue[e];
            if (!("number" == typeof t["maxWorkerNum"] && this._number >= t["maxWorkerNum"]) && (!t["isBroadcast"] || this._number < t["doneFlags"].length && !t["doneFlags"][this._number])) return e
        }
        return -1
    }
}
let number = 0;

function AddJobWorker(e) {
    const s = new JobWorker(e, number++);
    self.jobWorkers.push(s);
    for (const [t, o] of self.sentBlobs) s.SendBlob(t, o);
    for (const [r, n] of self.sentBuffers) s.SendBuffer(r, n);
    for (const a of self.importedScripts) s.ImportScripts(a);
    for (const i of self.lastBroadcasts.values()) s._InitBroadcast(i);
    s.SendReady()
}

function CancelJob(t) {
    for (let e = 0, s = self.jobQueue.length; e < s; ++e)
        if (self.jobQueue[e].jobId === t) return void self.jobQueue.splice(e, 1)
}

function OnInputPortMessage(e) {
    const s = e.data,
        t = s["type"];
    if ("_cancel" === t) CancelJob(s.jobId);
    else if ("_import_scripts" === t) {
        const o = s["scripts"];
        for (const r of self.jobWorkers) r.ImportScripts(o);
        void self.importedScripts.push(o)
    } else if ("_send_blob" === t) {
        const n = s["blob"],
            a = s["id"];
        for (const i of self.jobWorkers) i.SendBlob(n, a);
        void self.sentBlobs.push([n, a])
    } else if ("_send_buffer" === t) {
        const f = s["buffer"],
            l = s["id"];
        for (const u of self.jobWorkers) u.SendBuffer(f, l);
        void self.sentBuffers.push([f, l])
    } else if ("_no_more_workers" === t) self.sentBlobs.length = 0, self.sentBuffers.length = 0, self.importedScripts.length = 0, self.lastBroadcasts.clear();
    else {
        if (self.jobQueue.push(s), s["isBroadcast"]) {
            const b = s["maxWorkerNum"],
                d = self.jobWorkers.length,
                p = "number" == typeof b ? Math.min(b, d) : d,
                c = (s["doneFlags"] = new Array(p).fill(!1), s["transferables"] = [], s["params"] && s["params"]["broadcastKey"] ? s["params"]["broadcastKey"] : s["type"]);
            self.lastBroadcasts.delete(c), self.lastBroadcasts.set(c, s)
        }
        for (const _ of self.jobWorkers) _.MaybeStartNextJob()
    }
}
self.addEventListener("message", e => {
    const s = e.data,
        t = s["type"];
    "_init" === t ? (self.inputPort = s["in-port"], self.inputPort.onmessage = OnInputPortMessage) : "_addJobWorker" === t && AddJobWorker(s["port"])
});